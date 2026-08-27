import {getSiteContent} from '../sanity/queries'

/**
 * Which page document lives at which address. The client orders the menu by
 * dragging the pages in Einstellungen; the label and the picture come from the
 * page itself, so re-ordering can never leave a word pointing at the wrong
 * image.
 */
const HREF_BY_TYPE: Record<string, string> = {
  homePage: '/',
  studioPage: '/studio',
  mietenPage: '/mieten',
  workshopsPage: '/workshops',
  veranstaltungenPage: '/veranstaltungen',
  beratungPage: '/beratung',
}

/** The i18n key a menu word uses, kept stable: nav.studio, nav.mieten, … */
const KEY_BY_TYPE: Record<string, string> = {
  homePage: 'home',
  studioPage: 'studio',
  mietenPage: 'mieten',
  workshopsPage: 'workshops',
  veranstaltungenPage: 'veranstaltungen',
  beratungPage: 'beratung',
}

export type NavEntry = {
  key: string
  href: string
  label: string
  image: any
}

/** Fallback order and wording, used until the client has sorted the menu. */
const FALLBACK_ORDER = [
  'veranstaltungenPage',
  'workshopsPage',
  'studioPage',
  'beratungPage',
  'mietenPage',
]

export async function getNavigation(): Promise<NavEntry[]> {
  const content = await getSiteContent()
  const ordered: any[] = content.siteSettings?.navigation?.filter(Boolean) ?? []

  const pages = ordered.length
    ? ordered
    : FALLBACK_ORDER.map((type) => content[type]).filter(Boolean)

  return pages
    .filter((page) => HREF_BY_TYPE[page?._type])
    .map((page) => ({
      key: KEY_BY_TYPE[page._type],
      href: HREF_BY_TYPE[page._type],
      label: page.navLabel || page.header?.title || KEY_BY_TYPE[page._type],
      image: page.seo?.shareImage,
    }))
}

export {HREF_BY_TYPE, KEY_BY_TYPE}
