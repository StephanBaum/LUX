import type {APIRoute} from 'astro'

/**
 * Translates a batch of German strings for the Studio's "Übersetzen" action.
 *
 * It runs here rather than in the browser so the Google API key stays on the
 * server. Input and output are keyed by the same paths, so the caller can put
 * the answers straight back where they came from.
 */
export const prerender = false

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  lu: 'Luxembourgish (Lëtzebuergesch)',
}

const SYSTEM = `You translate website copy for a German photography and film studio.

Rules:
- Translate from German into the target language.
- Keep the tone: confident, plain, no marketing filler. The studio writes the
  way a craftsperson speaks.
- Keep proper nouns, brand names, equipment names and people's names unchanged.
- Keep any punctuation that carries meaning, including the em dash.
- Do not add, remove or reorder anything. One input string, one output string.
- Return only the JSON object described by the schema.`

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

export const POST: APIRoute = async ({request}) => {
  const apiKey = import.meta.env.GEMINI_API_KEY
  if (!apiKey) {
    return json({error: 'GEMINI_API_KEY ist nicht gesetzt.'}, 500)
  }

  let payload: {target?: string; texts?: Record<string, string>}
  try {
    payload = await request.json()
  } catch {
    return json({error: 'Ungültige Anfrage.'}, 400)
  }

  const target = payload.target ?? ''
  const texts = payload.texts ?? {}
  const language = LANGUAGE_NAMES[target]

  if (!language) return json({error: `Unbekannte Sprache: ${target}`}, 400)

  const paths = Object.keys(texts)
  if (paths.length === 0) return json({translations: {}})

  const model = import.meta.env.GEMINI_MODEL || DEFAULT_MODEL

  /*
   * Ask for one object with exactly the keys we sent. A schema keyed by path
   * means the model cannot silently drop or reorder an entry — and if it did,
   * the check below would catch it.
   */
  const properties = Object.fromEntries(paths.map((path) => [path, {type: 'STRING'}]))

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
                `Translate every value into ${language}. ` +
                `Keep the keys exactly as they are.\n\n` +
                JSON.stringify(texts, null, 2),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties,
          required: paths,
        },
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    return json(
      {error: `Übersetzungsdienst antwortet nicht (${response.status}).`, detail: detail.slice(0, 400)},
      502,
    )
  }

  const body = await response.json()
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof text !== 'string') {
    return json({error: 'Der Übersetzungsdienst hat nichts zurückgegeben.'}, 502)
  }

  let translations: Record<string, string>
  try {
    translations = JSON.parse(text)
  } catch {
    return json({error: 'Antwort des Übersetzungsdienstes war kein gültiges JSON.'}, 502)
  }

  // Never write back a key we did not ask for, or a non-string value.
  const clean: Record<string, string> = {}
  for (const path of paths) {
    const value = translations[path]
    if (typeof value === 'string' && value.trim()) clean[path] = value
  }

  return json({
    translations: clean,
    missing: paths.filter((path) => !(path in clean)),
  })
}
