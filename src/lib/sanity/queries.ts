import {sanityClient} from './client'

/** Everything the site needs, in one round trip. */
const SITE_QUERY = /* groq */ `{
  "siteSettings": *[_id == "siteSettings"][0],
  "homePage": *[_id == "homePage"][0]{
    ...,
    sectionMenschen{..., people[]->}
  },
  "studioPage": *[_id == "studioPage"][0]{
    ...,
    sectionMenschen{..., people[]->}
  },
  "mietenPage": *[_id == "mietenPage"][0],
  "workshopsPage": *[_id == "workshopsPage"][0],
  "veranstaltungenPage": *[_id == "veranstaltungenPage"][0],
  "beratungPage": *[_id == "beratungPage"][0]{
    ...,
    services[]->
  },
  "legal": *[_type == "legalPage"]{...},
  "people": *[_type == "person"] | order(order asc),
  "rooms": *[_type == "room"] | order(order asc),
  "equipment": *[_type == "equipmentItem"] | order(category asc, order asc),
  "workshops": *[_type == "workshop"] | order(startAt desc){
    ...,
    teacher->
  },
  "events": *[_type == "event"] | order(startAt desc),
  "services": *[_type == "service"] | order(order asc)
}`

export type SiteContent = Record<string, any>

let cached: SiteContent | null = null

/**
 * Fetched once per build. Every page imports this, so without the cache a
 * nine-page build would hit the API nine times for the same data.
 *
 * The cache is skipped while developing: the dev server is a long-running
 * process, and caching there means it keeps serving whatever it read at start
 * — content edited in the Studio, or a re-run seed script, would never show up
 * until the server was restarted.
 */
export async function getSiteContent(): Promise<SiteContent> {
  if (import.meta.env.DEV) {
    return withImageMetadata(await sanityClient.fetch(SITE_QUERY))
  }
  if (!cached) {
    const content = await sanityClient.fetch(SITE_QUERY)
    cached = await withImageMetadata(content)
  }
  return cached!
}

/**
 * Image fields come back holding only an asset reference. Rather than
 * projecting `asset->` on every one of them, collect the references once and
 * attach the metadata the frontend needs (dimensions and the LQIP placeholder).
 */
async function withImageMetadata(content: SiteContent): Promise<SiteContent> {
  const refs = new Set<string>()

  const collect = (value: any) => {
    if (Array.isArray(value)) return value.forEach(collect)
    if (!value || typeof value !== 'object') return
    if (typeof value.asset?._ref === 'string') refs.add(value.asset._ref)
    Object.values(value).forEach(collect)
  }
  collect(content)

  if (refs.size === 0) return content

  const assets: {_id: string}[] = await sanityClient.fetch(
    '*[_id in $ids]{_id, url, originalFilename, metadata}',
    {ids: [...refs]},
  )
  const byId = new Map(assets.map((asset) => [asset._id, asset]))

  const attach = (value: any): any => {
    if (Array.isArray(value)) return value.map(attach)
    if (!value || typeof value !== 'object') return value
    const out: Record<string, any> = {}
    for (const [key, item] of Object.entries(value)) out[key] = attach(item)
    const asset = byId.get(value.asset?._ref)
    if (asset) out.asset = {...value.asset, ...asset}
    return out
  }

  return attach(content)
}
