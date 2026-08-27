import type {APIRoute} from 'astro'
import {reconcile} from '../../../lib/sync/reconcile'
import {
  agreed,
  asAppointment,
  calendarFor,
  findById,
  lastAgreed,
  note,
  SYNCED_TYPES,
  writeHere,
  type SyncedType,
} from '../../../lib/sync/documents'
import {sanityWriteClient} from '../../../lib/sanity/client'
import {
  asAppointment as eventAsAppointment,
  createEvent,
  deleteEvent,
  getEvent,
  patchEvent,
} from '../../../lib/google/calendar'
import {calendarCredentials} from '../../../lib/google/auth'

/**
 * The website changed a workshop or an event; tell the calendar.
 *
 * Sanity calls this on every publish and delete of the two types that carry a
 * date. Most calls have nothing to do — the interesting work is deciding that,
 * which is what keeps a change we made ourselves from bouncing back and forth
 * between the two systems forever.
 */
export const prerender = false

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  })

export const POST: APIRoute = async ({request}) => {
  const secret = import.meta.env.SYNC_SECRET
  if (!secret || request.headers.get('x-sync-secret') !== secret) {
    return json({error: 'not allowed'}, 401)
  }

  if (!calendarCredentials()) return json({skipped: 'Google ist nicht eingerichtet.'})

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return json({error: 'Ungültige Anfrage.'}, 400)
  }

  const id: string = payload?._id ?? payload?.documentId ?? ''
  const type: SyncedType = payload?._type
  if (!id || !SYNCED_TYPES.includes(type)) return json({skipped: 'Nichts zu tun.'})

  // A draft is not on the website, so it has no business in the calendar.
  if (id.startsWith('drafts.')) return json({skipped: 'Entwurf.'})

  const doc = await findById(id)

  /*
   * Gone from Sanity means gone from the calendar. This is the one direction
   * where a deletion travels: a calendar entry is trivially remade, while a
   * workshop is twenty minutes of writing and a photograph.
   */
  if (!doc) {
    const eventId = payload?.googleEventId
    const calendarId = payload?.googleCalendarId
    if (eventId && calendarId) await deleteEvent(calendarId, eventId)
    return json({deleted: Boolean(eventId)})
  }

  const calendarId = doc.googleCalendarId || calendarFor(type)
  if (!calendarId) return json({skipped: 'Für diesen Typ ist kein Kalender hinterlegt.'})

  const here = asAppointment(doc)

  try {
    let there = null
    let thereAt: string | null = null

    if (doc.googleEventId) {
      const event = await getEvent(calendarId, doc.googleEventId).catch(() => null)
      // Google keeps a deleted entry around, marked cancelled.
      if (event && event.status !== 'cancelled') {
        there = eventAsAppointment(event)
        thereAt = event.updated ?? null
      }
    }

    const plan = reconcile({
      here,
      there,
      last: lastAgreed(doc),
      hereAt: doc._updatedAt,
      thereAt,
      linked: Boolean(doc.googleEventId),
    })

    switch (plan.do) {
      case 'nothing':
        return json({done: 'nothing', why: plan.why})

      case 'orphan-here':
        await sanityWriteClient
          .patch(doc._id)
          .set({googleEventId: '', ...note('date-missing', plan.why)})
          .commit()
        return json({done: 'orphaned'})

      case 'create-there': {
        const created = await createEvent(calendarId, plan.write)
        await sanityWriteClient
          .patch(doc._id)
          .set({googleEventId: created.id, googleCalendarId: calendarId, ...agreed(plan.write)})
          .commit()
        return json({done: 'created', eventId: created.id})
      }

      case 'write-there':
        await patchEvent(calendarId, doc.googleEventId!, plan.write)
        await sanityWriteClient.patch(doc._id).set(agreed(plan.write)).commit()
        return json({done: 'pushed'})

      case 'write-here':
        await writeHere(doc, plan.write)
        return json({done: 'pulled'})

      case 'write-both':
        await patchEvent(calendarId, doc.googleEventId!, plan.write)
        await writeHere(doc, plan.write, {syncMessage: plan.note})
        return json({done: 'merged', note: plan.note})
    }
  } catch (error: any) {
    const message = error?.message ?? String(error)
    await sanityWriteClient.patch(doc._id).set(note('error', message)).commit().catch(() => {})
    return json({error: message}, 502)
  }
}
