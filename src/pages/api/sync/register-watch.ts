import type {APIRoute} from 'astro'
import {watchCalendar, stopWatch, changedEvents} from '../../../lib/google/calendar'
import {calendarCredentials} from '../../../lib/google/auth'
import {readChannels, writeChannels, type Channels} from '../../../lib/sync/state'

/**
 * Ask Google to keep calling us.
 *
 * A push channel lives about a week and then goes quiet without saying so — and
 * a calendar link that stops working in silence is worse than none at all. A
 * daily cron re-registers both channels well before they lapse, and a channel
 * that has broken is simply replaced.
 *
 * Safe to call by hand at any time; add ?force=1 to replace a channel that has
 * not expired yet.
 */
export const prerender = false

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

/** Renew two days before Google would drop it, so a late cron is still in time. */
const SOON = 2 * 864e5

async function register(force: boolean) {
  const secret = import.meta.env.SYNC_SECRET
  const site = import.meta.env.PUBLIC_SITE_URL
  if (!secret || !site) throw new Error('SYNC_SECRET oder PUBLIC_SITE_URL fehlt.')

  /*
   * Google calls us over the open internet, so the address has to be one it
   * can reach. Say so here rather than letting the registration appear to
   * succeed and the calendar quietly never call back.
   */
  if (!/^https:\/\//.test(site) || /localhost|127\.0\.0\.1|\.local(:|$)/.test(site)) {
    throw new Error(
      `PUBLIC_SITE_URL ist ${site} — Google kann diese Adresse nicht erreichen. ` +
        'Es muss die öffentliche https-Adresse der Seite sein.',
    )
  }

  const address = `${site.replace(/\/$/, '')}/api/sync/from-google`
  const calendars = [
    import.meta.env.GOOGLE_CALENDAR_WORKSHOPS,
    import.meta.env.GOOGLE_CALENDAR_EVENTS,
  ].filter(Boolean) as string[]

  if (calendars.length === 0) throw new Error('Es ist kein Kalender hinterlegt.')

  const channels: Channels = await readChannels()
  const done: string[] = []

  for (const calendarId of calendars) {
    const existing = channels[calendarId]

    if (!force && existing && existing.expiresAt - Date.now() > SOON) {
      done.push(`${calendarId}: läuft noch`)
      continue
    }

    if (existing) await stopWatch(existing.channelId, existing.resourceId)

    // A fresh id every time, so a replaced channel can never be mistaken for
    // the one it replaced.
    const channelId = `lux-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const opened = await watchCalendar(calendarId, channelId, address, secret)

    /*
     * Take a reading position now. Without one, the first notification would
     * ask for "everything that ever changed" and walk the whole calendar.
     */
    const syncToken = existing?.syncToken ?? (await changedEvents(calendarId)).syncToken

    channels[calendarId] = {
      calendarId,
      channelId,
      resourceId: opened.resourceId,
      expiresAt: Number(opened.expiration ?? Date.now() + 6 * 864e5),
      syncToken,
    }
    done.push(`${calendarId}: neu angemeldet`)
  }

  await writeChannels(channels, {registeredAt: new Date().toISOString(), lastError: ''})
  return done
}

async function run(request: Request) {
  const secret = import.meta.env.SYNC_SECRET
  const header = request.headers.get('x-sync-secret') ?? request.headers.get('authorization')
  const fromCron = request.headers.get('user-agent')?.includes('vercel-cron')

  if (!fromCron && (!secret || (header !== secret && header !== `Bearer ${secret}`))) {
    return json({error: 'not allowed'}, 401)
  }

  if (!calendarCredentials()) return json({skipped: 'Google ist nicht eingerichtet.'})

  try {
    const force = new URL(request.url).searchParams.get('force') === '1'
    return json({registered: await register(force)})
  } catch (error: any) {
    const message = error?.message ?? String(error)
    await writeChannels(await readChannels(), {lastError: message}).catch(() => {})
    return json({error: message}, 502)
  }
}

export const GET: APIRoute = ({request}) => run(request)
export const POST: APIRoute = ({request}) => run(request)
