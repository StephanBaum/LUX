import type {APIRoute} from 'astro'

/**
 * Writes the German alt text for a picture, by looking at the picture.
 *
 * Alt text is the one field nobody fills in: it is invisible on the page, so it
 * is skipped, and then a screen reader reads out "image" and Google learns
 * nothing. The machine writes a first draft the moment a picture is chosen; the
 * other languages follow on publish, like every other field.
 *
 * It runs on the server so the Google key stays there, and so the studio's
 * pictures are fetched by us rather than by the browser.
 */
export const prerender = false

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.7-flash'

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production'

const SYSTEM = `You write German alt text for the website of LUX Studio, a
photography and film studio in Luxembourg with a 400 m² hall, a darkroom and a
rental business.

Rules:
- Write one sentence in German. Around 60 to 120 characters.
- Describe what is actually visible. Do not guess names, places or events.
- No "Bild von", "Foto von", "Ansicht von" — start with the subject itself.
- Plain, factual, no adjectives that sell. A blind visitor should learn what is
  in the picture, not how good it is.
- If people are visible, say what they are doing, not who they are.
- Return only the JSON object described by the schema.`

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

/**
 * An asset reference carries everything the image URL needs:
 *   image-<hash>-<width>x<height>-<extension>
 * so the picture can be fetched without asking Sanity for it first.
 */
function urlFor(ref: string): string | null {
  const match = /^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/.exec(ref)
  if (!match || !projectId) return null
  const [, hash, size, extension] = match
  /*
   * 384 px on the long side. Gemini charges one tile — about 258 tokens —
   * for anything that small, and tiles anything bigger. It is more than
   * enough to say what is in a picture, and it costs a fraction of a cent.
   */
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${hash}-${size}.${extension}?w=384&h=384&fit=max&q=75&auto=format`
}

export const POST: APIRoute = async ({request}) => {
  const apiKey = import.meta.env.GEMINI_API_KEY
  if (!apiKey) return json({error: 'GEMINI_API_KEY ist nicht gesetzt.'}, 500)

  let payload: {ref?: string; context?: string}
  try {
    payload = await request.json()
  } catch {
    return json({error: 'Ungültige Anfrage.'}, 400)
  }

  const url = payload.ref ? urlFor(payload.ref) : null
  if (!url) return json({error: 'Kein gültiges Bild angegeben.'}, 400)

  const picture = await fetch(url)
  if (!picture.ok) return json({error: `Bild nicht erreichbar (${picture.status}).`}, 502)

  const mimeType = picture.headers.get('content-type') ?? 'image/jpeg'
  const data = Buffer.from(await picture.arrayBuffer()).toString('base64')

  const model = import.meta.env.GEMINI_MODEL || DEFAULT_MODEL

  const response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      systemInstruction: {parts: [{text: SYSTEM}]},
      contents: [
        {
          role: 'user',
          parts: [
            {inlineData: {mimeType, data}},
            {
              text: payload.context
                ? `Beschreibe dieses Bild. Es steht auf der Seite: ${payload.context}.`
                : 'Beschreibe dieses Bild.',
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {alt: {type: 'STRING'}},
          required: ['alt'],
        },
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    return json(
      {error: `Bildbeschreibung fehlgeschlagen (${response.status}).`, detail: detail.slice(0, 400)},
      502,
    )
  }

  const body = await response.json()
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text

  let alt: unknown
  try {
    alt = JSON.parse(typeof text === 'string' ? text : '{}')?.alt
  } catch {
    return json({error: 'Antwort war kein gültiges JSON.'}, 502)
  }

  if (typeof alt !== 'string' || !alt.trim()) {
    return json({error: 'Es kam keine Beschreibung zurück.'}, 502)
  }

  return json({alt: alt.trim()})
}
