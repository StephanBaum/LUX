import type {APIRoute} from 'astro'
import {reconcile} from '../../../lib/sync/reconcile'
import {
  agreed,
  asAppointment,
  findByEventId,
  lastAgreed,
  note,
  writeHere,
  withGermanTitle,
  type SyncedType,
} from '../../../lib/sync/documents'
import {sanityWriteClient} from '../../../lib/sanity/client'
import {
  asAppointment as eventAsAppointment,
  changedEvents,
  patchEvent,
  type CalendarEvent,
} from '../../../lib/google/calendar'
import {readChannels, writeChannels} from '../../../lib/sync/state'
import {calendarCredentials} from '../../../lib/google/auth'

/**
 * The calendar changed; tell the website.
 *
 * Google calls this the moment anything moves, but the call says only that
 * something happened — never what. The answer comes from asking the calendar
 * what changed since we last asked, using the token it gave us last time.
 */
export const prerender = false

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

/** Which of the two calendars a notification is about. */
const typeOf = (calendarId: string): SyncedType =>
  calendarId === import.meta.env.GOOGLE_CALENDAR_EVENTS ? 'event' : 'workshop'

/**
 * An entry made on the phone with no workshop behind it becomes a draft, with
 * nothing but its name and its date. Being a draft it is invisible on the
 * website — the client blocks the day now and writes it up later.
 */
async function draftFor(event: CalendarEvent, calendarId: string) {
  const appointment = eventAsAppointment(event)
  if (!appointment.startAt) return

  const type = typeOf(calendarId)
  const id = `drafts.${type}-${event.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`

  await sanityWriteClient.createIfNotExists({
    _id: id,
    _type: type,
    title: withGermanTitle(undefined, appointment.title || 'Ohne Titel'),
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    googleEventId: event.id,
    googleCalendarId: calendarId,
    ...agreed(appointment),
    ...note(
      'needs-details',
      'Aus dem Google Kalender übernommen. Bitte ergänzen und veröffentlichen — ' +
        'bis dahin steht dieser Termin nicht auf der Website.',
    ),
  })
}

/**
 * Deleted in the calendar. The document survives: it goes back to being a
 * draft, which takes it off the website while leaving every word of it intact.
 * A calendar entry is remade in seconds; a workshop is an evening's writing.
 */
async function orphan(doc: any) {
  const draftId = doc._id.startsWith('drafts.') ? doc._id : `drafts.${doc._id}`

  if (!doc._id.startsWith('drafts.')) {
    await sanityWriteClient.createIfNotExists({...doc, _id: draftId})
    await sanityWriteClient.delete(doc._id)
  }

  await sanityWriteClient
    .patch(draftId)
    .set({
      googleEventId: '',
      ...note('date-missing', 'Der Termin wurde im Google Kalender gelöscht.'),
    })
    .commit()
}

async function handle(event: CalendarEvent, calendarId: string) {
  const doc = await findByEventId(event.id)

  if (event.status === 'cancelled') {
    if (!doc) return 'unknown-cancelled'
    await orphan(doc)
    return 'orphaned'
  }

  if (!doc) {
    await draftFor(event, calendarId)
    return 'drafted'
  }

  const plan = reconcile({
    here: asAppointment(doc),
    there: eventAsAppointment(event),
    last: lastAgreed(doc),
    hereAt: doc._updatedAt,
    thereAt: event.updated ?? null,
    linked: true,
  })

  switch (plan.do) {
    case 'write-here':
      await writeHere(doc, plan.write)
      return 'pulled'
    case 'write-there':
      await patchEvent(calendarId, event.id, plan.write)
      await sanityWriteClient.patch(doc._id).set(agreed(plan.write)).commit()
      return 'pushed'
    case 'write-both':
      await patchEvent(calendarId, event.id, plan.write)
      await writeHere(doc, plan.write, {syncMessage: plan.note})
      return 'merged'
    default:
      return 'nothing'
  }
}

export const POST: APIRoute = async ({request}) => {
  const secret = import.meta.env.SYNC_SECRET
  // Anyone can find the address; only Google knows the token we registered with.
  if (!secret || request.headers.get('x-goog-channel-token') !== secret) {
    return json({error: 'not allowed'}, 401)
  }

  if (!calendarCredentials()) return new Response(null, {status: 200})

  const channelId = request.headers.get('x-goog-channel-id') ?? ''
  const channels = await readChannels()
  const entry = Object.values(channels).find((channel) => channel.channelId === channelId)

  if (!entry) return json({skipped: 'Unbekannter Kanal.'})

  // The first notification after registering only says "the channel is open".
  if (request.headers.get('x-goog-resource-state') === 'sync') {
    return new Response(null, {status: 200})
  }

  try {
    let delta
    try {
      delta = await changedEvents(entry.calendarId, entry.syncToken)
    } catch (error: any) {
      // A reading position that is too old is rejected; start again without one.
      if (error?.status !== 410) throw error
      delta = await changedEvents(entry.calendarId)
    }

    const results: Record<string, number> = {}
    for (const event of delta.events) {
      const outcome = await handle(event, entry.calendarId)
      results[outcome] = (results[outcome] ?? 0) + 1
    }

    channels[entry.calendarId] = {...entry, syncToken: delta.syncToken}
    await writeChannels(channels)

    return json({changed: delta.events.length, results})
  } catch (error: any) {
    const message = error?.message ?? String(error)
    await writeChannels(channels, {lastError: message}).catch(() => {})
    return json({error: message}, 502)
  }
}
