import {mayExpire} from './hold.ts'

/**
 * A hold nobody answered.
 *
 * Seven days is long enough for a studio to make up its mind and short
 * enough that a forgotten request does not block a room all season. The
 * marker in the entry is what keeps this away from bookings the studio typed
 * in itself.
 *
 * The two Google calls are handed in so this can be tested without a network.
 */

type Deps = {
  calendarId: string
  list: (calendarId: string, params: Record<string, string>) => Promise<{items?: any[]}>
  remove: (calendarId: string, eventId: string) => Promise<unknown>
}

export async function expireHolds(deps: Deps, now = new Date()) {
  if (!deps.calendarId) return {expired: 0}

  const {items = []} = await deps.list(deps.calendarId, {
    maxResults: '250',
    showDeleted: 'false',
    singleEvents: 'false',
  })

  let expired = 0
  for (const event of items) {
    if (!mayExpire(event, now)) continue
    await deps.remove(deps.calendarId, event.id)
    expired++
  }

  return {expired}
}
