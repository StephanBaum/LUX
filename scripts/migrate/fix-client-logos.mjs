/**
 * One-off: give every client its own logo back.
 *
 * When the seed replaced the Beratung page it took the uploaded client logos
 * with it. They were recovered by matching filenames, and the matching went
 * wrong: Lillet ended up with Canon's picture, and Opel and ARRI were swapped.
 * This pairs each name with the file that is actually named after it, and
 * writes the alt text a logo should have.
 *
 * Run with:  node scripts/migrate/fix-client-logos.mjs
 */
import {client} from './lib.mjs'

const ALT = {
  de: (name) => `Logo von ${name}`,
  en: (name) => `${name} logo`,
  fr: (name) => `Logo de ${name}`,
  lu: (name) => `Logo vu ${name}`,
}

const altFor = (name) =>
  Object.entries(ALT).map(([language, phrase]) => ({
    _key: language,
    _type: 'internationalizedArrayStringValue',
    language,
    value: phrase(name),
  }))

/** The file whose name contains the client's name, e.g. "opel-1.svg" for Opel. */
function assetFor(name, assets) {
  const wanted = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return assets.find((asset) =>
    asset.originalFilename?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(wanted),
  )
}

const assets = await client.fetch('*[_type == "sanity.imageAsset"]{_id, originalFilename}')

for (const id of ['beratungPage', 'drafts.beratungPage']) {
  const doc = await client.fetch('*[_id == $id][0]{_id, clients}', {id})
  if (!doc?.clients?.length) continue

  const patch = {}

  for (const entry of doc.clients) {
    const name = typeof entry.name === 'string' ? entry.name : entry.name?.[0]?.value
    if (!name) continue

    const asset = assetFor(name, assets)
    if (!asset) {
      console.warn(`  no file found for ${name} - left as it was`)
      continue
    }

    patch[`clients[_key=="${entry._key}"].logo`] = {
      _type: 'photo',
      asset: {_type: 'reference', _ref: asset._id},
      alt: altFor(name),
    }
    console.log(`  ${name} -> ${asset.originalFilename}`)
  }

  // A name that was stored as a translated field is a brand name again.
  for (const entry of doc.clients) {
    if (Array.isArray(entry.name)) {
      patch[`clients[_key=="${entry._key}"].name`] = entry.name[0]?.value ?? ''
    }
  }

  if (Object.keys(patch).length === 0) continue
  await client.patch(id).set(patch).commit()
  console.log(`${id}: ${Object.keys(patch).length} fields corrected`)
}
