/** Shared helpers for the V3 -> Sanity content migration. */
import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createClient} from '@sanity/client'
import {parse as parseYaml} from 'yaml'
import {config as loadDotenv} from 'dotenv'

export const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
loadDotenv({path: join(root, '.env'), quiet: true})

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.PUBLIC_SANITY_DATASET ?? 'production'
const token = process.env.SANITY_API_WRITE_TOKEN

if (!projectId) throw new Error('PUBLIC_SANITY_PROJECT_ID is missing from .env')
if (!token) throw new Error('SANITY_API_WRITE_TOKEN is missing from .env')

export const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2026-08-01',
  useCdn: false,
})

/**
 * Read one of the V3 German content files and return its frontmatter.
 *
 * These live in `scripts/migrate/source/` — a frozen copy of what the old site
 * shipped. `public/content/` was deleted once the pages started rendering from
 * Sanity, and the seed script still has to be re-runnable.
 */
export function readContent(name) {
  const raw = readFileSync(join(root, 'scripts', 'migrate', 'source', `${name}.md`), 'utf8')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) throw new Error(`No frontmatter in ${name}.md`)
  return parseYaml(match[1]) ?? {}
}

/** The German hint shown under every seeded field in the Studio. */
export const PLACEHOLDER_NOTE = 'Aus der alten Webseite übernommen.'
