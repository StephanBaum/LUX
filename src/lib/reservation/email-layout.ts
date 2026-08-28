/**
 * The shell every e-mail from the site is built in.
 *
 * Mail clients are not browsers. There is no flexbox, no grid, no external
 * stylesheet and, in Outlook, barely any CSS at all — so this is tables and
 * inline styles, which is the only thing that renders the same everywhere.
 *
 * Web fonts are left out on purpose: most clients block them, and a font that
 * loads for some readers and not others looks worse than one honest fallback.
 * The stack starts at Inter for the people who already have it.
 */

const FONT =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** The site's own palette, from src/styles/main.css. */
const TEAL = '#2A9D8F'
const BLACK = '#000000'
const WHITE = '#FFFFFF'
const GREY_100 = '#F5F5F5'
const GREY_300 = '#D4D4D4'
const GREY_500 = '#737373'

/** Anything from a visitor is escaped before it reaches the markup. */
export const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c] as string,
  )

/** A label-and-value line. The label is small and grey, the value is the point. */
export function row(label: string, value: string, href?: string) {
  if (!value) return ''
  const inner = href
    ? `<a href="${esc(href)}" style="color:${BLACK};text-decoration:underline">${esc(value)}</a>`
    : esc(value)

  return `<tr>
      <td style="padding:0 0 14px 0;vertical-align:top;width:96px">
        <span style="font:500 11px/16px ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${GREY_500}">${esc(label)}</span>
      </td>
      <td style="padding:0 0 14px 0;vertical-align:top">
        <span style="font:400 15px/22px ${FONT};color:${BLACK}">${inner}</span>
      </td>
    </tr>`
}

/** A list of things, one per line, so eight pieces of kit stay readable. */
export function listRow(label: string, values: string[]) {
  if (!values.length) return ''
  const items = values
    .map(
      (v) =>
        `<span style="font:400 15px/22px ${FONT};color:${BLACK};display:block">${esc(v)}</span>`,
    )
    .join('')

  return `<tr>
      <td style="padding:0 0 14px 0;vertical-align:top;width:96px">
        <span style="font:500 11px/16px ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${GREY_500}">${esc(label)}</span>
      </td>
      <td style="padding:0 0 14px 0;vertical-align:top">${items}</td>
    </tr>`
}

/** What the visitor wrote, set apart so it reads as their voice. */
export const quote = (text: string) =>
  !text
    ? ''
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 28px 0">
        <tr><td style="border-left:2px solid ${GREY_300};padding:2px 0 2px 16px">
          <span style="font:400 15px/24px ${FONT};color:${BLACK}">${esc(text).replace(/\n/g, '<br>')}</span>
        </td></tr>
      </table>`

/**
 * A button that survives Outlook, which ignores padding on an anchor — hence
 * the padding living on the cell instead.
 */
export function button(label: string, href: string, kind: 'primary' | 'secondary' = 'primary') {
  const fill = kind === 'primary' ? TEAL : WHITE
  const ink = kind === 'primary' ? WHITE : BLACK
  const edge = kind === 'primary' ? TEAL : GREY_300

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:0 8px 8px 0">
      <tr><td align="center" bgcolor="${fill}" style="background:${fill};border:1px solid ${edge};padding:14px 28px">
        <a href="${esc(href)}" style="font:500 15px/20px ${FONT};color:${ink};text-decoration:none;display:inline-block">${esc(label)}</a>
      </td></tr>
    </table>`
}

/** Small print under a rule: the things worth saying but not worth shouting. */
export const note = (html: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0 0">
      <tr><td style="border-top:1px solid ${GREY_300};padding:16px 0 0 0">
        <span style="font:400 13px/20px ${FONT};color:${GREY_500}">${html}</span>
      </td></tr>
    </table>`

/**
 * The whole message. `preheader` is the line a client shows next to the
 * subject in the inbox list; hiding it in the markup keeps the top of the
 * mail clean while still saying something useful there.
 */
export function shell(options: {title: string; preheader: string; body: string; ref?: string}) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(options.title)}</title></head>
<body style="margin:0;padding:0;background:${GREY_100};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(options.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${GREY_100}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:${WHITE};border:1px solid ${GREY_300}">
      <tr><td bgcolor="${BLACK}" style="background:${BLACK};padding:22px 32px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="left" style="font:700 16px/20px ${FONT};letter-spacing:.18em;color:${WHITE}">LUX STUDIO</td>
            ${
              options.ref
                ? `<td align="right" style="font:400 12px/20px ${FONT};letter-spacing:.04em;color:${GREY_300};white-space:nowrap">Buchung <span style="color:${WHITE};font-weight:500">${esc(options.ref)}</span></td>`
                : ''
            }
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:36px 32px 32px 32px">${options.body}</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%">
      <tr><td style="padding:16px 32px">
        <span style="font:400 12px/18px ${FONT};color:${GREY_500}">LUX Studio · Schwalbach</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/** A headline, and the sentence under it. */
export const heading = (title: string, lead = '') =>
  `<h1 style="margin:0 0 ${lead ? '6px' : '24px'} 0;font:600 24px/32px ${FONT};color:${BLACK}">${esc(title)}</h1>` +
  (lead
    ? `<p style="margin:0 0 28px 0;font:400 16px/24px ${FONT};color:${GREY_500}">${esc(lead)}</p>`
    : '')

/** A run of body text. */
export const para = (text: string) =>
  `<p style="margin:0 0 18px 0;font:400 16px/26px ${FONT};color:${BLACK}">${esc(text)}</p>`

/** The table the rows live in. */
export const rows = (inner: string) =>
  !inner
    ? ''
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px 0">${inner}</table>`
