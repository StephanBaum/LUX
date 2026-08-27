/** Minimal Portable Text builders for the legal pages. */
let n = 0
const key = () => `k${(n++).toString(36)}`

const block = (style, text, listItem) => ({
  _type: 'block',
  _key: key(),
  style,
  ...(listItem ? {listItem, level: 1} : {}),
  markDefs: [],
  children: [{_type: 'span', _key: key(), text, marks: []}],
})

export const h2 = (text) => block('h2', text)
export const h3 = (text) => block('h3', text)
export const p = (text) => block('normal', text)
export const li = (text) => block('normal', text, 'bullet')

/** Drop empty entries so a missing key never produces a blank paragraph. */
export const body = (...blocks) => blocks.flat().filter(Boolean)
