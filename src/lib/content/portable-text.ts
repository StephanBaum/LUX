type Span = {_type?: string; text?: string; marks?: string[]}
type Block = {
  _type?: string
  style?: string
  listItem?: string
  children?: Span[]
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function renderSpan(span: Span): string {
  let html = escapeHtml(span.text ?? '')
  for (const mark of span.marks ?? []) {
    if (mark === 'strong') html = `<strong>${html}</strong>`
    else if (mark === 'em') html = `<em>${html}</em>`
  }
  return html
}

const renderChildren = (block: Block) => (block.children ?? []).map(renderSpan).join('')

/**
 * Portable Text to HTML for the legal pages.
 *
 * Deliberately small: those documents only ever contain paragraphs, two
 * heading levels and bullet lists. Anything else falls back to a paragraph
 * rather than disappearing.
 */
export function portableTextToHtml(blocks: Block[] | undefined): string {
  if (!Array.isArray(blocks)) return ''

  const out: string[] = []
  let list: string[] | null = null

  const closeList = () => {
    if (list) {
      out.push(`<ul>${list.join('')}</ul>`)
      list = null
    }
  }

  for (const block of blocks) {
    if (block?._type !== 'block') continue
    const inner = renderChildren(block)

    if (block.listItem === 'bullet') {
      list ??= []
      list.push(`<li>${inner}</li>`)
      continue
    }

    closeList()
    if (block.style === 'h2') out.push(`<h2>${inner}</h2>`)
    else if (block.style === 'h3') out.push(`<h3>${inner}</h3>`)
    else if (inner) out.push(`<p>${inner}</p>`)
  }

  closeList()
  return out.join('')
}
