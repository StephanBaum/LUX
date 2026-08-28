/**
 * The days the studio is not free, for the calendar on the Mieten page.
 *
 * Two sources, and they are not alike:
 *
 * - **Reservations** stay a read-only iCal feed. Nothing writes to it by
 *   hand; the studio fills it from Google, and the approval flow adds holds.
 * - **Workshops and events** come from Sanity. A workshop fills the rooms, so
 *   its day cannot also be rented out.
 *
 * The reading itself lives in src/lib/content/busy.ts, because the
 * reservation endpoint has to ask the same question before it holds a day.
 */

import {sanityClient} from '../../lib/sanity/client'
import {imageUrl} from '../../lib/sanity/image'
import {asBlockedDates} from '../../lib/content/occupancy'
import {fetchReservations} from '../../lib/content/busy'

export const prerender = false;

async function fetchStudioDates() {
  try {
    const docs = await sanityClient.fetch(
      `*[_type in ["workshop", "event"] && defined(startAt)]{_id, _type, title, slug, photo, startAt, endAt}`
    );
    return {
      name: 'studio',
      type: 'blocked',
      events: asBlockedDates(docs, new Date(), imageUrl)
    };
  } catch (error) {
    console.error('Error reading workshops and events from Sanity:', error.message);
    return {name: 'studio', type: 'blocked', events: [], error: error.message};
  }
}

export async function GET() {
  const results = {timestamp: new Date().toISOString(), feeds: {}};

  // Both sources in parallel; the slowest one sets the pace.
  const feedResults = await Promise.all([
    fetchReservations(import.meta.env.ICAL_RESERVATIONS_URL || ''),
    fetchStudioDates()
  ]);

  for (const result of feedResults) {
    results.feeds[result.name] = {
      type: result.type,
      events: result.events,
      count: result.events.length,
      error: result.error || null
    };
  }

  results.blocked = feedResults
    .filter(r => r.type === 'blocked')
    .flatMap(r => r.events)
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
