import type {Bundles} from './bundle'

/**
 * Server-side twin of `i18n.t()` in `src/scripts/i18n.js`: dotted lookup,
 * the page bundle first and `_global` as the fallback, so a page that defines
 * its own wording for a shared key (the Mieten form) actually wins. A missing
 * key renders as the key itself rather than silently blank.
 */
export function createT(bundles: Bundles, page: string) {
  const walk = (root: any, parts: string[]) => {
    let value = root
    for (const part of parts) {
      value = value ? value[part] : undefined
      if (value === undefined) return undefined
    }
    return value
  }

  return function t(key: string): string {
    const parts = key.split('.')
    const local = walk(bundles[page], parts)
    if (local !== undefined) return String(local)
    const global = walk(bundles._global, parts)
    return global === undefined ? key : String(global)
  }
}
