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

/*
 * Two edits, both to the dedupe aliases @sanity/astro installs.
 *
 * They point `sanity` and `styled-components` at a resolved file path. On
 * Windows the path is built with a POSIX-only regex, so it keeps the trailing
 * "/package.json" and the Studio renders blank. And even when the path is
 * right, aliasing a bare specifier to a file makes Vite pre-bundle the package
 * twice, producing chunk names that disagree with each other:
 * "Failed to fetch dynamically imported module", white panes, no recovery.
 *
 * There is only one copy of each package here, so the aliases have nothing to
 * dedupe. Disable them by giving them a pattern that never matches.
 */
const EDITS = [
  [String.raw`find: /^sanity$/`, String.raw`find: /^sanity-alias-disabled-by-lux$/`],
  [
    String.raw`find: /^styled-components$/`,
    String.raw`find: /^styled-components-alias-disabled-by-lux$/`,
  ],
]

let patched = 0
for (const file of ['dist/sanity-astro.mjs', 'dist/sanity-astro.js']) {
  const path = join(root, 'node_modules', '@sanity', 'astro', file)
  if (!existsSync(path)) continue

  let src = readFileSync(path, 'utf8')
  let changed = false
  for (const [from, to] of EDITS) {
    if (!src.includes(from)) continue
    src = src.split(from).join(to)
    changed = true
  }
  if (!changed) continue

  writeFileSync(path, src)
  patched++
}

console.log(
  patched
    ? `patch-sanity-astro: disabled the dedupe aliases in ${patched} file(s)`
    : 'patch-sanity-astro: nothing to patch',
)
