/**
 * @sanity/astro 3.5.1 builds its Vite dedupe aliases like this:
 *
 *   require.resolve(`${pkg}/package.json`).replace(/\/package\.json$/, '')
 *
 * The regex only accepts a forward slash, so on Windows the alias keeps
 * pointing at package.json itself. Vite then resolves `sanity` and
 * `styled-components` to a JSON file and the Studio never hydrates.
 *
 * This rewrites the regex to accept both separators. Runs on postinstall.
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const BROKEN = String.raw`/\/package\.json$/`
const FIXED = String.raw`/.package.json$/`

let patched = 0
for (const file of ['dist/sanity-astro.mjs', 'dist/sanity-astro.js']) {
  const path = join(root, 'node_modules', '@sanity', 'astro', file)
  if (!existsSync(path)) continue
  const src = readFileSync(path, 'utf8')
  if (!src.includes(BROKEN)) continue
  writeFileSync(path, src.split(BROKEN).join(FIXED))
  patched++
}

console.log(
  patched
    ? `patch-sanity-astro: fixed Windows alias in ${patched} file(s)`
    : 'patch-sanity-astro: nothing to patch',
)
