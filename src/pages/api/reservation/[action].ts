import type {APIRoute} from 'astro'
import {open, seal, type ReservationClaim} from '../../../lib/reservation/token'
import {confirmedPatch, roomsFromTitle, canCancel, cancelUntil, CANCEL_DEADLINE_DAYS, overlaps} from '../../../lib/reservation/hold'
import {getEvent, patchRawEvent, deleteEvent} from '../../../lib/google/calendar'
import {fetchReservations} from '../../../lib/content/busy'
import {sanityClient} from '../../../lib/sanity/client'
import {asBlockedDates} from '../../../lib/content/occupancy'
import {approved, declined, germanRange, germanDay, cancelledByGuest, cancelConfirmed, moved} from '../../../lib/reservation/messages'
import {sendMail, studioAddress} from '../../../lib/mail'

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

/**
 * Every page the studio and the guest land on, in the site's own clothes:
 * the black bar, the white card on grey, Inter, the teal from main.css.
 *
 * These are read once, on a phone, by somebody deciding something — so the
 * decision is the only thing that looks clickable, and everything else gets
 * out of the way.
 */
const page = (title: string, body: string, ref?: string) =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(title)} — LUX Studio</title>
<style>
 :root{
   --ink:#000;--paper:#fff;--wash:#F5F5F5;--line:#D4D4D4;--soft:#737373;--teal:#2A9D8F;
   --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
 }
 *{box-sizing:border-box}
 body{margin:0;background:var(--wash);font-family:var(--font);color:var(--ink);
      -webkit-text-size-adjust:100%;line-height:1.5}
 .wrap{max-width:640px;margin:0 auto;padding:32px 16px 64px}
 .card{background:var(--paper);border:1px solid var(--line)}
 .bar{background:var(--ink);color:var(--paper);padding:22px 32px;
      display:flex;align-items:center;justify-content:space-between;gap:16px}
 .mark{font-weight:700;font-size:16px;letter-spacing:.18em}
 .ref{font-size:12px;letter-spacing:.04em;color:var(--line);white-space:nowrap}
 .ref b{color:var(--paper);font-weight:500}
 .inner{padding:36px 32px 32px}
 h1{margin:0 0 6px;font-size:24px;line-height:1.3;font-weight:600}
 .lead{margin:0 0 28px;color:var(--soft);font-size:16px}
 p{margin:0 0 18px;font-size:16px;line-height:1.6}
 dl{display:grid;grid-template-columns:96px 1fr;gap:0;margin:0 0 28px}
 dt{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--soft);
    padding:0 0 14px;font-weight:500}
 dd{margin:0;padding:0 0 14px;font-size:15px;word-break:break-word}
 form{margin:0 0 8px}
 .field{margin:0 0 20px}
 label{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
       color:var(--soft);font-weight:500;margin:0 0 8px}
 input[type=date]{font:400 16px/1.4 var(--font);color:var(--ink);width:100%;
   padding:12px 14px;border:1px solid var(--line);background:var(--paper);border-radius:0}
 input[type=date]:focus{outline:2px solid var(--teal);outline-offset:-2px;border-color:var(--teal)}
 .dates{display:grid;grid-template-columns:1fr 1fr;gap:16px}
 @media (max-width:30rem){.dates{grid-template-columns:1fr}}
 button{font:500 15px/1.3 var(--font);padding:15px 30px;border:1px solid var(--teal);
        background:var(--teal);color:var(--paper);cursor:pointer;border-radius:0;
        width:100%;margin:4px 0 0}
 @media (min-width:30rem){button{width:auto;min-width:220px}}
 button:hover{background:#248C80;border-color:#248C80}
 .muted{margin:28px 0 0;padding:16px 0 0;border-top:1px solid var(--line);
        color:var(--soft);font-size:13px;line-height:1.6}
 .done{display:inline-block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
       font-weight:500;color:var(--teal);margin:0 0 10px}
 .warn{color:#B3261E}
 .foot{padding:16px 32px;color:var(--soft);font-size:12px}
</style></head><body>
<div class="wrap">
  <div class="card">
    <div class="bar">
      <span class="mark">LUX STUDIO</span>
      ${ref ? `<span class="ref">Buchung <b>${escapeHtml(ref).toUpperCase()}</b></span>` : ''}
    </div>
    <div class="inner">${body}</div>
  </div>
  <div class="foot">LUX Studio · Schwalbach</div>
</div>
</body></html>`,
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
  const action = ['approve', 'decline', 'cancel', 'reschedule'].includes(params.action ?? '') ? (params.action as string) : ''
  if (!action) return problem('Unbekannte Aktion.')

  const claim = read(url, action)
  if (claim instanceof Response) return claim

  const [from] = claim.d.split('/')

  /*
   * The guest may call it off themselves up to the deadline. Refusing here,
   * before the button is ever drawn, means a late guest is told to telephone
   * rather than left pressing something that will not work.
   */
  if (action === 'cancel' && !canCancel(from)) {
    return page('Zu kurzfristig', `<h1>Zu kurzfristig</h1>
      <p>Eine Absage ist so kurz vor dem Termin nicht mehr online möglich —
      dafür brauchen wir mindestens ${CANCEL_DEADLINE_DAYS} Tage Vorlauf.</p>
      <p>Bitte rufen Sie uns an oder antworten Sie einfach auf Ihre
      Bestätigungs-E-Mail. Wir finden eine Lösung.</p>`, claim.r)
  }

  if (action === 'reschedule') {
    const [was, wasEnd] = claim.d.split('/')
    // The end shown is the last booked day; the stored one is exclusive.
    const lastDay = new Date(`${wasEnd}T12:00:00Z`)
    lastDay.setUTCDate(lastDay.getUTCDate() - 1)

    return page('Termin ändern', `
      <h1>Termin ändern</h1>
      <p class="lead">${escapeHtml(claim.n)}</p>
      <dl>
        <dt>Bisher</dt><dd>${dates(claim)}</dd>
        <dt>E-Mail</dt><dd>${escapeHtml(claim.m)}</dd>
      </dl>
      <form method="post">
        <div class="dates">
          <div class="field">
            <label for="s">Neuer Beginn</label>
            <input id="s" type="date" name="startAt" value="${was}" required>
          </div>
          <div class="field">
            <label for="e">Letzter Tag</label>
            <input id="e" type="date" name="endAt" value="${lastDay.toISOString().slice(0, 10)}" required>
          </div>
        </div>
        <button type="submit">Termin verschieben</button>
      </form>
      <p class="muted">Der Kalendereintrag wird verschoben und ${escapeHtml(claim.n)}
      bekommt die alten und die neuen Daten per E-Mail.</p>`, claim.r)
  }

  const verb = action === 'approve' ? 'Zusagen' : 'Absagen'
  const heading = action === 'cancel' ? 'Termin absagen' : `Anfrage ${escapeHtml(claim.r).toUpperCase()}`

  return page(verb, `
    <h1>${action === 'cancel' ? 'Termin absagen' : action === 'approve' ? 'Anfrage zusagen' : 'Anfrage absagen'}</h1>
    <p class="lead">${escapeHtml(claim.n)}</p>
    <dl>
      <dt>Zeitraum</dt><dd>${dates(claim)}</dd>
      <dt>E-Mail</dt><dd>${escapeHtml(claim.m)}</dd>
    </dl>
    <form method="post">
      <button type="submit">${action === 'cancel' ? 'Termin absagen' : verb}</button>
    </form>
    <p class="muted">${
      action === 'approve'
        ? 'Der Zeitraum wird gebucht und der Gast bekommt sofort eine Zusage.'
        : action === 'cancel'
          ? 'Der Zeitraum wird wieder frei. Das Studio wird benachrichtigt.'
          : 'Der Zeitraum wird wieder frei und der Gast bekommt eine freundliche Absage.'
    }</p>`, claim.r)
}

export const POST: APIRoute = async ({params, url, request}) => {
  const action = ['approve', 'decline', 'cancel', 'reschedule'].includes(params.action ?? '') ? (params.action as string) : ''
  if (!action) return problem('Unbekannte Aktion.')

  const claim = read(url, action)
  if (claim instanceof Response) return claim

  const [from, to] = claim.d.split('/')
  let guest = {name: claim.n, email: claim.m, startAt: from, endAt: to, raeume: [] as string[]}

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
        <p>Der Kalender antwortet im Moment nicht.</p>
        <p><strong>Es wurde nichts verändert und nichts verschickt.</strong>
        Bitte öffnen Sie den Link in ein paar Minuten noch einmal.</p>`, claim.r)
    }
    event = null
  }

  if (!event || event.status === 'cancelled') {
    return page('Schon erledigt', `<span class="done">Bereits erledigt</span>
      <h1>Schon erledigt</h1>
      <p>Diese Anfrage wurde bereits beantwortet oder der Eintrag wurde entfernt.
      Es wurde nichts noch einmal verschickt.</p>`, claim.r)
  }

  // The entry names the rooms, so the visitor's mail can too.
  guest = {...guest, raeume: roomsFromTitle(event.summary)}

  if (action === 'approve') {
    if (event.status === 'confirmed') {
      return page('Schon zugesagt', `<span class="done">Bereits erledigt</span>
        <h1>Schon zugesagt</h1>
        <p>Diese Anfrage ist bereits bestätigt. Es wurde nichts noch einmal verschickt.</p>`, claim.r)
    }
    await patchRawEvent(claim.c, claim.e, confirmedPatch(event.summary))
    /*
     * The yes carries the guest's cancel link. It outlives the studio's own
     * two links, because a booking approved in March may be called off in
     * May — so it runs to the end of the booking, and the deadline is
     * enforced when it is pressed.
     */
    const key = import.meta.env.RESERVATION_SECRET
    const site = (import.meta.env.PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
    let cancelLink: string | undefined
    if (key && site) {
      cancelLink = `${site}/api/reservation/cancel?t=${seal({...claim, a: 'cancel', x: Date.parse(`${to}T23:59:59Z`)}, key)}`
    }
    const mail = approved(guest, claim.r, cancelLink)
    try {
      await sendMail({to: claim.m, subject: mail.subject, text: mail.text, html: mail.html})
    } catch (error: any) {
      console.error('[reservation] approval mail failed', error?.message ?? error)
      return page('Zugesagt, aber ohne E-Mail', `<span class="done">Erledigt</span>
        <h1>Zugesagt</h1>
        <p>${escapeHtml(claim.n)} ist für <strong>${dates(claim)}</strong> eingetragen
        und der Zeitraum ist im Kalender gebucht.</p>
        <p class="warn"><strong>Die Bestätigung konnte nicht verschickt werden.</strong></p>
        <p>Bitte antworten Sie <a href="mailto:${escapeHtml(claim.m)}">${escapeHtml(claim.m)}</a>
        von Hand.</p>`, claim.r)
    }
    return page('Zugesagt', `<span class="done">Erledigt</span>
      <h1>Zugesagt</h1>
      <p>${escapeHtml(claim.n)} hat die Zusage für <strong>${dates(claim)}</strong> bekommen.
      Der Zeitraum ist im Kalender gebucht.</p>
      <p class="muted">Sie können den Termin später über „Termin ändern" in der
      ursprünglichen E-Mail verschieben. Bitte nicht im Kalender ziehen —
      davon erfährt der Gast nichts.</p>`, claim.r)
  }

  if (action === 'reschedule') {
    const form = await request.formData().catch(() => null)
    const startAt = String(form?.get('startAt') ?? '')
    const lastDay = String(form?.get('endAt') ?? '')
    const DAY = /^\d{4}-\d{2}-\d{2}$/

    if (!DAY.test(startAt) || !DAY.test(lastDay) || lastDay < startAt) {
      return page('Ungültig', `<h1>Ungültige Daten</h1>
        <p>Bitte einen Beginn und einen letzten Tag wählen, der nicht davor liegt.</p>
        <p><strong>Es wurde nichts verändert.</strong></p>`, claim.r)
    }

    // Stored ends are exclusive everywhere, so the day after the last one.
    const after = new Date(`${lastDay}T12:00:00Z`)
    after.setUTCDate(after.getUTCDate() + 1)
    const endAt = after.toISOString().slice(0, 10)

    // The new days must be free — of everything except this booking itself.
    const [reservations, docs] = await Promise.all([
      fetchReservations(import.meta.env.ICAL_RESERVATIONS_URL || ''),
      sanityClient
        .fetch(`*[_type in ["workshop", "event"] && defined(startAt)]{_id, _type, title, startAt, endAt}`)
        .catch(() => []),
    ])
    const busy = [...reservations.events, ...asBlockedDates(docs)].filter(
      (b) => !(b.uid && event.id && String(b.uid).includes(String(event.id))),
    )

    if (overlaps({startAt, endAt}, busy)) {
      return page('Belegt', `<h1>Diese Tage sind belegt</h1>
        <p>Im neuen Zeitraum liegt bereits etwas anderes — eine andere Buchung
        oder ein Workshop.</p>
        <p><strong>Es wurde nichts verändert und nichts verschickt.</strong>
        Gehen Sie zurück und wählen Sie andere Tage.</p>`, claim.r)
    }

    const before = {startAt: from, endAt: to}
    await patchRawEvent(claim.c, claim.e, {start: {date: startAt}, end: {date: endAt}})

    const mail = moved({...guest, startAt, endAt}, claim.r, before)
    try {
      await sendMail({to: claim.m, subject: mail.subject, text: mail.text, html: mail.html})
    } catch (error: any) {
      console.error('[reservation] reschedule mail failed', error?.message ?? error)
      return page('Verschoben, aber ohne E-Mail', `<span class="done">Erledigt</span>
        <h1>Termin verschoben</h1>
        <p>Der Termin steht jetzt auf <strong>${escapeHtml(germanRange(startAt, endAt))}</strong>.</p>
        <p class="warn"><strong>Die Benachrichtigung konnte nicht verschickt werden.</strong></p>
        <p>Bitte sagen Sie <a href="mailto:${escapeHtml(claim.m)}">${escapeHtml(claim.m)}</a>
        von Hand Bescheid.</p>`, claim.r)
    }

    return page('Verschoben', `<span class="done">Erledigt</span>
      <h1>Termin verschoben</h1>
      <dl>
        <dt>Bisher</dt><dd>${escapeHtml(germanRange(before.startAt, before.endAt))}</dd>
        <dt>Neu</dt><dd><strong>${escapeHtml(germanRange(startAt, endAt))}</strong></dd>
      </dl>
      <p class="muted">${escapeHtml(claim.n)} hat die alten und die neuen Daten
      per E-Mail bekommen.</p>`, claim.r)
  }

  if (action === 'cancel') {
    // Checked again here: the page refuses late, but a link kept open in a
    // tab could be pressed after the deadline has passed.
    if (!canCancel(from)) {
      return page('Zu kurzfristig', `<h1>Zu kurzfristig</h1>
        <p>Eine Absage ist so kurz vor dem Termin nicht mehr online möglich.</p>
        <p>Bitte rufen Sie uns an oder antworten Sie einfach auf Ihre
        Bestätigungs-E-Mail. Wir finden eine Lösung.</p>`, claim.r)
    }

    await deleteEvent(claim.c, claim.e)

    // The studio must hear about this; the guest gets it in writing. Neither
    // failing may undo the cancellation — the days are already free.
    const studio = studioAddress()
    const toStudioMail = cancelledByGuest(guest, claim.r)
    const toGuest = cancelConfirmed(guest, claim.r)
    let told = true
    try {
      if (studio) await sendMail({to: studio, subject: toStudioMail.subject, text: toStudioMail.text, html: toStudioMail.html})
      await sendMail({to: claim.m, subject: toGuest.subject, text: toGuest.text, html: toGuest.html})
    } catch (error: any) {
      console.error('[reservation] cancellation mail failed', error?.message ?? error)
      told = false
    }

    return page('Abgesagt', `<span class="done">Erledigt</span>
      <h1>Ihr Termin ist abgesagt</h1>
      <p><strong>${dates(claim)}</strong> ist wieder frei. Schade — und gerne ein anderes Mal.</p>
      ${
        told
          ? '<p class="muted">Eine Bestätigung ist unterwegs.</p>'
          : '<p class="muted warn">Die Bestätigungs-E-Mail konnte nicht verschickt werden. Die Absage gilt trotzdem.</p>'
      }`, claim.r)
  }

  await deleteEvent(claim.c, claim.e)
  const mail = declined(guest, claim.r)
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
