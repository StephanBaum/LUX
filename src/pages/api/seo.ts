import type {APIRoute} from 'astro'

/**
 * Writes the two lines Google shows for a page: the title and the description
 * under it.
 *
 * They are separate from the page's own headline — a headline is written for a
 * visitor who is already here, a search result for someone who is not. Nobody
 * writes them twice, so they stay empty and Google invents its own. Here the
 * page's German text goes in and a first draft comes back, to be edited like
 * any other field.
 */
export const prerender = false

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

const SYSTEM = `You write German search-result text for LUX Studio — a
photography and film studio in Luxemburg, Saarland, Germany. 400 m² hall,
darkroom, full film set. The studio rents its rooms, runs workshops and events,
and advises companies on their pictures.

Write two things about the page you are given.

metaTitle — around 55 characters, never over 60:
- Say what the page is, in the words someone would search for.
- End with " | LUX Studio" only if it still fits under 60 characters.
- No colon-stuffing, no "Willkommen bei", no exclamation marks.

metaDescription — between 140 and 155 characters:
- One or two sentences. Say what is on the page and what a visitor can do.
- Concrete nouns: the room, the size, the workshop, the equipment.
- The studio's voice is authority and craft, never speed or hustle. No
  "professionell", "hochwertig", "einzigartig", "Ihr Partner für".
- No call to action of the "Jetzt anfragen!" kind.

Both in German. Return only the JSON object described by the schema.`

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

export const POST: APIRoute = async ({request}) => {
  const apiKey = import.meta.env.GEMINI_API_KEY
  if (!apiKey) return json({error: 'GEMINI_API_KEY ist nicht gesetzt.'}, 500)

  let payload: {page?: string; text?: string}
  try {
    payload = await request.json()
  } catch {
    return json({error: 'Ungültige Anfrage.'}, 400)
  }

  const text = (payload.text ?? '').trim()
  if (text.length < 40) {
    return json({error: 'Die Seite hat noch zu wenig Text für einen Vorschlag.'}, 400)
  }

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
            {
              text:
                `Seite: ${payload.page ?? 'unbekannt'}\n\n` +
                `Das ist der deutsche Text der Seite:\n\n${text.slice(0, 6000)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            metaTitle: {type: 'STRING'},
            metaDescription: {type: 'STRING'},
          },
          required: ['metaTitle', 'metaDescription'],
        },
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    return json(
      {error: `Vorschlag fehlgeschlagen (${response.status}).`, detail: detail.slice(0, 400)},
      502,
    )
  }

  const body = await response.json()
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text

  let result: any
  try {
    result = JSON.parse(typeof raw === 'string' ? raw : '{}')
  } catch {
    return json({error: 'Antwort war kein gültiges JSON.'}, 502)
  }

  const metaTitle = typeof result.metaTitle === 'string' ? result.metaTitle.trim() : ''
  const metaDescription =
    typeof result.metaDescription === 'string' ? result.metaDescription.trim() : ''

  if (!metaTitle || !metaDescription) {
    return json({error: 'Es kam kein vollständiger Vorschlag zurück.'}, 502)
  }

  return json({metaTitle, metaDescription})
}
