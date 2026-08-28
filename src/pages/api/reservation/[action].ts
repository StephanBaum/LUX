import type {APIRoute} from 'astro'
import {open, type ReservationClaim} from '../../../lib/reservation/token'
import {confirmedPatch, roomsFromTitle} from '../../../lib/reservation/hold'
import {getEvent, patchRawEvent, deleteEvent} from '../../../lib/google/calendar'
import {approved, declined, germanRange} from '../../../lib/reservation/messages'
import {sendMail} from '../../../lib/mail'

/**
 * Zusagen und Absagen.
 *
 * GET only shows a page. POST does the deed.
 *
 * This split is load-bearing and must not be "simplified" away. Gmail,
 * Outlook and every mail scanner fetch each link in a message to check it,
 * so a bare GET that approved a booking would approve every booking the
 * moment the e-mail landed, unattended.
 */
export const prerender = false

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} — LUX Studio</title>
<style>
 body{font-family:system-ui,sans-serif;max-width:34rem;margin:12vh auto;padding:0 1.5rem;line-height:1.5;color:#111}
 h1{font-size:1.4rem;font-weight:600}
 dl{display:grid;grid-template-columns:auto 1fr;gap:.35rem 1rem;margin:1.5rem 0}
 dt{color:#666} dd{margin:0}
 button{font:inherit;padding:.7rem 1.4rem;border:0;background:#111;color:#fff;cursor:pointer}
 .muted{color:#666;font-size:.9rem}
</style></head><body>${body}</body></html>`,
    {status: 200, headers: {'Content-Type': 'text/html; charset=utf-8'}},
  )

const problem = (message: string) =>
  page('Nicht möglich', `<h1>Nicht möglich</h1><p>${message}</p>`)

/** The claim, or a page explaining why not. */
function read(url: URL, action: string): ReservationClaim | Response {
  const key = import.meta.env.RESERVATION_SECRET
  if (!key) return problem('Reservierungen sind auf dieser Seite nicht eingerichtet.')

  const token = url.searchParams.get('t') ?? ''
  let claim: ReservationClaim
  try {
    claim = open(token, key)
  } catch (error: any) {
    return problem(
      /abgelaufen/.test(error?.message ?? '')
        ? 'Dieser Link ist abgelaufen. Der Zeitraum ist wieder frei — bitte antworten Sie der Anfrage per E-Mail.'
        : 'Dieser Link ist ungültig.',
    )
  }

  if (claim.a !== action) return problem('Dieser Link gehört zu einer anderen Aktion.')
  return claim
}

const dates = (claim: ReservationClaim) => {
  const [from, to] = claim.d.split('/')
  return germanRange(from, to)
}

export const GET: APIRoute = async ({params, url}) => {
  const action = params.action === 'approve' ? 'approve' : params.action === 'decline' ? 'decline' : ''
  if (!action) return problem('Unbekannte Aktion.')

  const claim = read(url, action)
  if (claim instanceof Response) return claim

  const verb = action === 'approve' ? 'Zusagen' : 'Absagen'
  return page(verb, `
    <h1>Anfrage ${claim.r}</h1>
    <dl>
      <dt>Wer</dt><dd>${escapeHtml(claim.n)}</dd>
      <dt>E-Mail</dt><dd>${escapeHtml(claim.m)}</dd>
      <dt>Zeitraum</dt><dd>${dates(claim)}</dd>
    </dl>
    <form method="post">
      <button type="submit">${verb}</button>
    </form>
    <p class="muted">${
      action === 'approve'
        ? 'Der Zeitraum wird gebucht und der Gast bekommt eine Zusage.'
        : 'Der Zeitraum wird wieder frei und der Gast bekommt eine freundliche Absage.'
    }</p>`)
}

export const POST: APIRoute = async ({params, url}) => {
  const action = params.action === 'approve' ? 'approve' : params.action === 'decline' ? 'decline' : ''
  if (!action) return problem('Unbekannte Aktion.')

  const claim = read(url, action)
  if (claim instanceof Response) return claim

  const [from, to] = claim.d.split('/')
  let request = {name: claim.n, email: claim.m, startAt: from, endAt: to, raeume: [] as string[]}

  // The calendar entry is the state: tentative, confirmed, or gone.
  // Only 404 and 410 mean the entry is really gone. Any other failure is
  // Google being unwell, and must not be reported as "already handled" —
  // the studio would believe the booking was done and stop chasing it.
  let event: any = null
  try {
    event = await getEvent(claim.c, claim.e)
  } catch (error: any) {
    if (error?.status !== 404 && error?.status !== 410) {
      console.error('[reservation] calendar unreachable', error?.message ?? error)
      return page('Gerade nicht möglich', `<h1>Gerade nicht möglich</h1>
        <p>Der Kalender antwortet im Moment nicht. Es wurde nichts verändert
        und nichts verschickt. Bitte öffnen Sie den Link in ein paar Minuten
        noch einmal.</p>`)
    }
    event = null
  }

  if (!event || event.status === 'cancelled') {
    return page('Schon erledigt', `<h1>Schon erledigt</h1>
      <p>Diese Anfrage wurde bereits beantwortet oder der Eintrag wurde entfernt.
      Es wurde nichts noch einmal verschickt.</p>`)
  }

  // The entry names the rooms, so the visitor's mail can too.
  request = {...request, raeume: roomsFromTitle(event.summary)}

  if (action === 'approve') {
    if (event.status === 'confirmed') {
      return page('Schon zugesagt', `<h1>Schon zugesagt</h1>
        <p>Diese Anfrage ist bereits bestätigt. Es wurde nichts noch einmal verschickt.</p>`)
    }
    await patchRawEvent(claim.c, claim.e, confirmedPatch(event.summary))
    const mail = approved(request, claim.r)
    try {
      await sendMail({to: claim.m, subject: mail.subject, text: mail.text, html: mail.html})
    } catch (error: any) {
      console.error('[reservation] approval mail failed', error?.message ?? error)
      return page('Zugesagt, aber ohne E-Mail', `<h1>Zugesagt</h1>
        <p>${escapeHtml(claim.n)} ist für ${dates(claim)} eingetragen und der
        Zeitraum ist im Kalender gebucht.</p>
        <p><strong>Die Bestätigung konnte nicht verschickt werden.</strong>
        Bitte antworten Sie ${escapeHtml(claim.m)} von Hand.</p>`)
    }
    return page('Zugesagt', `<h1>Zugesagt</h1>
      <p>${escapeHtml(claim.n)} hat die Zusage für ${dates(claim)} bekommen.
      Der Zeitraum ist im Kalender gebucht.</p>`)
  }

  await deleteEvent(claim.c, claim.e)
  const mail = declined(request, claim.r)
  try {
    await sendMail({to: claim.m, subject: mail.subject, text: mail.text, html: mail.html})
  } catch (error: any) {
    console.error('[reservation] decline mail failed', error?.message ?? error)
    return page('Abgesagt, aber ohne E-Mail', `<h1>Abgesagt</h1>
      <p>${dates(claim)} ist wieder frei im Kalender.</p>
      <p><strong>Die Absage konnte nicht verschickt werden.</strong>
      Bitte antworten Sie ${escapeHtml(claim.m)} von Hand.</p>`)
  }
  return page('Abgesagt', `<h1>Abgesagt</h1>
    <p>${escapeHtml(claim.n)} hat eine freundliche Absage bekommen.
    ${dates(claim)} ist wieder frei.</p>`)
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c] as string,
  )
