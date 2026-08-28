/**
 * The days the studio is not free, for the calendar on the Mieten page.
 *
 * Two sources, and they are not alike:
 *
 * - **Reservations** stay a read-only iCal feed. Nothing writes to it, the
 *   studio fills it from Google as it always has, and the website only needs
 *   to know which days are taken.
 * - **Workshops and events** come from Sanity. They used to be read here as
 *   two more iCal feeds, which was two extra network calls per page load and
 *   was dropped. Their dates live in Sanity now, so one query gets both and
 *   the old cost does not come back.
 *
 * A workshop fills the rooms, so its day cannot also be rented out. Leaving
 * them out let someone book a room on top of the studio's own programme.
 */

import {sanityClient} from '../../lib/sanity/client'
import {imageUrl} from '../../lib/sanity/image'
import {asBlockedDates, asBookedDates, PAST_WINDOW, FUTURE_WINDOW} from '../../lib/content/occupancy'

export const prerender = false;

const calendarConfig = {
  feeds: {
    reservations: {
      url: import.meta.env.ICAL_RESERVATIONS_URL || '',
      type: 'blocked'
    }
  },
  futureWindow: FUTURE_WINDOW,
  pastWindow: PAST_WINDOW,
  cacheDuration: 300
};

/**
 * The studio's own programme, straight out of Sanity.
 *
 * `sanityClient` only sees published documents, so a workshop still being
 * written does not take a day off the rental calendar. A failure here must
 * not take the reservations down with it — the calendar is more useful with
 * one source than with none.
 */
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

/**
 * Parse iCal data into events array
 */
function parseIcal(icalData, feedType) {
  const events = [];

  // Split into event blocks
  const eventBlocks = icalData.split('BEGIN:VEVENT');

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split('END:VEVENT')[0];

    const event = {
      type: feedType,
      uid: extractField(block, 'UID'),
      summary: extractField(block, 'SUMMARY'),
      description: extractField(block, 'DESCRIPTION'),
      location: extractField(block, 'LOCATION'),
      start: parseIcalDate(extractField(block, 'DTSTART')),
      end: parseIcalDate(extractField(block, 'DTEND')),
    };

    // Only add valid events with at least a start date
    if (event.start) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Extract a field value from iCal block
 */
function extractField(block, fieldName) {
  // Handle fields with parameters like DTSTART;VALUE=DATE:20240115
  const regex = new RegExp(`${fieldName}[^:]*:([^\\r\\n]+)`, 'i');
  const match = block.match(regex);

  if (match) {
    // Decode escaped characters
    return match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  return null;
}

/**
 * Parse iCal date format to ISO string
 * Supports: 20240115, 20240115T100000, 20240115T100000Z
 */
function parseIcalDate(dateStr) {
  if (!dateStr) return null;

  // Remove any parameters prefix
  const cleanDate = dateStr.split(':').pop() || dateStr;

  // Handle date-only format (YYYYMMDD)
  if (cleanDate.length === 8) {
    const year = cleanDate.substring(0, 4);
    const month = cleanDate.substring(4, 6);
    const day = cleanDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  // Handle datetime format (YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
  if (cleanDate.length >= 15) {
    const year = cleanDate.substring(0, 4);
    const month = cleanDate.substring(4, 6);
    const day = cleanDate.substring(6, 8);
    const hour = cleanDate.substring(9, 11);
    const minute = cleanDate.substring(11, 13);
    const second = cleanDate.substring(13, 15);
    const isUtc = cleanDate.endsWith('Z');

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${isUtc ? 'Z' : ''}`;
  }

  return null;
}

/**
 * Fetch a single iCal feed
 */
async function fetchFeed(name, config) {
  if (!config.url) {
    return { name, events: [], error: 'No URL configured' };
  }

  try {
    const response = await fetch(config.url, {
      headers: {
        'Accept': 'text/calendar',
        'User-Agent': 'LUX-Studio-Calendar/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const icalData = await response.text();
    const events = parseIcal(icalData, config.type);

    // Filter events within the configured time window
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - calendarConfig.pastWindow);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + calendarConfig.futureWindow);

    const filteredEvents = events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= pastDate && eventStart <= futureDate;
    });

    /*
     * asBookedDates keeps the dates and throws the rest away. A reservation's
     * summary is a customer's name, and everything returned here is sent to
     * the browser, so it is dropped now rather than hidden in the markup
     * later — no future change to the calendar can leak what is not there.
     */
    return { name, type: config.type, events: asBookedDates(filteredEvents) };
  } catch (error) {
    console.error(`Error fetching ${name} calendar:`, error.message);
    return { name, type: config.type, events: [], error: error.message };
  }
}

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    feeds: {}
  };

  // Fetch every source in parallel; the slowest one sets the pace.
  const feedPromises = Object.entries(calendarConfig.feeds).map(
    ([name, config]) => fetchFeed(name, config)
  );

  const feedResults = await Promise.all([...feedPromises, fetchStudioDates()]);

  // Organize results by feed name and type
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
