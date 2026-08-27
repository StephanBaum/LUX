/**
 * Phase 4 — put the V3 images into Sanity as the seed photo for every image
 * field, so the client can swap each one instead of facing an empty box.
 *
 * Idempotent: an asset is uploaded once and found again by its original
 * filename on every later run.
 *
 * Must run after `migrate:content`, which replaces whole documents and would
 * otherwise drop these fields. `npm run migrate` does both in order.
 */
import {readFileSync, existsSync} from 'node:fs'
import {basename, join} from 'node:path'
import {client, root} from './lib.mjs'

const BERATUNG_SHOTS = join(
  process.env.LOCALAPPDATA ?? '',
  'Temp/claude/C--Users-sb-Documents--DEV-Lux/f13e4fad-1a11-4db5-b6c7-2371397928d7/scratchpad/beratung',
)

const img = (name) => join(root, 'public', 'Assets', 'img', name)
const shot = (name) => join(BERATUNG_SHOTS, name)
const logo = (name) => join(root, 'scripts', 'migrate', 'logos', name)

/**
 * Client logos, if the files are there. See logos/README.md — drop a file in,
 * re-run, and the Beratung page shows it instead of the client's name.
 */
const CLIENT_LOGOS = ['canon', 'arri', 'tufa', 'opel', 'adc', 'lillet', 'arteholic']

/**
 * Anything already uploaded through the Studio counts too: match an asset
 * whose filename contains the client's name, so a logo picked in the media
 * browser survives a re-seed.
 */
async function uploadedLogo(name) {
  const asset = await client.fetch(
    `*[_type == "sanity.imageAsset" && lower(originalFilename) match $needle][0]{_id, originalFilename}`,
    {needle: `*${name}*`},
  )
  return asset?._id ?? null
}

async function clientLogos() {
  const out = []
  for (const [i, name] of CLIENT_LOGOS.entries()) {
    let value = null
    for (const ext of ['svg', 'png', 'jpg', 'jpeg', 'webp', 'avif']) {
      value = await photo(logo(`${name}.${ext}`), `i${i}`)
      if (value) break
    }
    if (!value) {
      const id = await uploadedLogo(name)
      if (id) {
        value = {_type: 'photo', _key: `i${i}`, asset: {_type: 'reference', _ref: id}, alt: name}
      }
    }
    if (value) out.push({index: i, logo: value})
  }
  return out
}

/** filename -> German alt text. Every seeded image needs one. */
const ALT = {
  'image 0.png': 'Studio Luxenburger, Blick in den Aufnahmeraum',
  'image 1.png': 'Fotoproduktion im Studioraum',
  'image 2.png': 'Portraitaufnahme im Studio',
  'image 3.png': 'Professionelles Fotoshooting im Studio',
  'image 4.png': 'Studioaufnahme mit professioneller Beleuchtung',
  'image 5.png': 'Studio Ambiente und Ausstattung',
  'image 6.png': 'Kreative Fotografie im Studio Luxenburger',
  'image 7.png': 'Ergebnis einer Studioproduktion',
  'image 8.png': 'Studioraum mit Aufbau',
  '360_F_244426.jpg': 'Großes Studio mit Hohlkehle',
  'gettyimages-168253056-612x612.jpg': 'Kleines Studio für Portrait und Produkt',
  'analog.webp': 'Dunkelkammer des Analog Studios',
  'shot-a.jpg': 'Arbeit am Set',
  'shot-b.jpg': 'Art Direction, Bildauswahl',
  'shot-c.jpg': 'Generative Bildproduktion',
  'shot-d.jpg': 'Kamera und Licht am Drehtag',
}

const uploaded = new Map()

/** Upload once, then reuse the asset on every later run. */
async function assetId(path) {
  const filename = basename(path)
  if (uploaded.has(filename)) return uploaded.get(filename)

  const existing = await client.fetch(
    '*[_type == "sanity.imageAsset" && originalFilename == $filename][0]._id',
    {filename},
  )
  if (existing) {
    uploaded.set(filename, existing)
    return existing
  }

  if (!existsSync(path)) {
    uploaded.set(filename, null)
    return null
  }

  const asset = await client.assets.upload('image', readFileSync(path), {filename})
  console.log(`  uploaded ${filename}`)
  uploaded.set(filename, asset._id)
  return asset._id
}

/** A `photo` field value pointing at an uploaded asset. */
async function photo(path, key) {
  const id = await assetId(path)
  if (!id) return null
  const filename = basename(path)
  return {
    _type: 'photo',
    ...(key ? {_key: key} : {}),
    asset: {_type: 'reference', _ref: id},
    alt: ALT[filename] ?? '',
  }
}

/** An array of `photo` values, keyed so Sanity can track the items. */
async function photos(paths) {
  const out = []
  for (const [i, path] of paths.entries()) {
    const value = await photo(path, `img${i}`)
    if (value) out.push(value)
  }
  return out
}

const HOME_SLIDER = [1, 2, 3, 4, 5, 6].map((n) => img(`image ${n}.png`))
const PROFILE_GALLERY = [1, 2, 3, 4].map((n) => img(`image ${n}.png`))

console.log('Uploading images and attaching them to documents...')

const patches = [
  [
    'siteSettings',
    async () => ({
      menuImage: await photo(img('image 1.png')),
      defaultOgImage: await photo(img('image 0.png')),
    }),
  ],
  [
    'homePage',
    async () => ({
      heroImages: await photos([0, 4, 6, 7].map((n) => img(`image ${n}.png`))),
      sliderImages: await photos(HOME_SLIDER),
      'sectionMenschen.gallery': await photos(PROFILE_GALLERY),
    }),
  ],
  [
    'studioPage',
    async () => ({
      sliderImages: await photos(HOME_SLIDER),
      'sectionMenschen.gallery': await photos(PROFILE_GALLERY),
    }),
  ],
  ['workshopsPage', async () => ({sliderImages: await photos(HOME_SLIDER)})],
  ['veranstaltungenPage', async () => ({sliderImages: await photos(HOME_SLIDER)})],

  // Each page's own picture: shown when sharing it, and in the home menu.
  ['homePage', async () => ({'seo.shareImage': await photo(img('image 0.png'))})],
  ['studioPage', async () => ({'seo.shareImage': await photo(img('image 5.png'))})],
  ['mietenPage', async () => ({'seo.shareImage': await photo(img('image 6.png'))})],
  ['workshopsPage', async () => ({'seo.shareImage': await photo(img('image 3.png'))})],
  ['veranstaltungenPage', async () => ({'seo.shareImage': await photo(img('image 1.png'))})],
  ['beratungPage', async () => ({'seo.shareImage': await photo(shot('shot-b.jpg'))})],
  [
    'beratungPage',
    async () => ({
      heroImages: await photos(['shot-a.jpg', 'shot-b.jpg', 'shot-c.jpg', 'shot-d.jpg'].map(shot)),
    }),
  ],

  ['room-large', async () => ({photo: await photo(img('studio/360_F_244426.jpg'))})],
  ['room-small', async () => ({photo: await photo(img('studio/gettyimages-168253056-612x612.jpg'))})],
  ['room-analog', async () => ({photo: await photo(img('studio/analog.webp'))})],

  ['person-martin', async () => ({photo: await photo(img('image 2.png'))})],
  ['person-florian', async () => ({photo: await photo(img('image 4.png'))})],

  ['service-art-direction', async () => ({photo: await photo(shot('shot-b.jpg'))})],
  ['service-ki-fotografie', async () => ({photo: await photo(shot('shot-c.jpg'))})],
  ['service-dop', async () => ({photo: await photo(shot('shot-d.jpg'))})],

  ...[1, 2, 3].map((n) => [
    `workshop-v3-${n}`,
    async () => ({photo: await photo(img(`image ${n}.png`))}),
  ]),
  ...[1, 2, 3].map((n) => [
    `event-v3-${n}`,
    async () => ({photo: await photo(img(`image ${n + 3}.png`))}),
  ]),
]

// Logos are attached one by one, so a missing file leaves that client as text.
const logos = await clientLogos()
if (logos.length) {
  console.log(`  found ${logos.length} client logo(s)`)
} else {
  console.log('  no client logos in scripts/migrate/logos/ — names stay as text')
}

let tx = client.transaction()
logos.forEach(({index, logo: value}) => {
  tx = tx.patch('beratungPage', (p) => p.set({[`clients[${index}].logo`]: value}))
})
for (const [id, build] of patches) {
  const fields = await build()
  const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v && (!Array.isArray(v) || v.length)))
  if (!Object.keys(set).length) {
    console.warn(`  nothing to set on ${id}`)
    continue
  }
  tx = tx.patch(id, (p) => p.set(set))
  // A draft would keep shadowing the published document in the Studio.
  tx = tx.delete(`drafts.${id}`)
}

await tx.commit()
console.log(`Attached images to ${patches.length} documents.`)
