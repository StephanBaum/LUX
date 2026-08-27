import type {APIRoute} from 'astro'
import {getBundles} from '../../../lib/content/bundle'
import {LANGS, type Lang} from '../../../lib/content/localize'

/**
 * Emits `/content/{de,en,fr,lu}/{page}.json` at build time — the same files
 * `src/scripts/i18n.js` fetches when the visitor switches language.
 */
export async function getStaticPaths() {
  const paths = []
  for (const lang of LANGS) {
    const bundles = await getBundles(lang)
    for (const page of Object.keys(bundles)) {
      paths.push({params: {lang, page}, props: {bundle: bundles[page]}})
    }
  }
  return paths
}

export const GET: APIRoute = ({props}) =>
  new Response(JSON.stringify((props as {bundle: unknown}).bundle), {
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

export type {Lang}
