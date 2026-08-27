/**
 * The days the studio is already booked, for the calendar on the Mieten page.
 *
 * One feed, deliberately. The workshops and the events used to be read here
 * too, but those pages come from Sanity now and their calendars are kept in
 * step by the two-way sync — reading them again here would have been two
 * network calls per page load for something nobody looks at.
 *
 * The reservations calendar stays a read-only iCal feed. Nothing writes to it,
 * the studio fills it from Google as it always has, and the website only needs
 * to know which days are taken.
 */

export const prerender = false;

const calendarConfig = {
  feeds: {
    reservations: {
      url: import.meta.env.ICAL_RESERVATIONS_URL || '',
      type: 'blocked'
    }
  },
  futureWindow: 365,
  pastWindow: 30,
  cacheDuration: 300
};

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

    // Sort by start date
    filteredEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    return { name, type: config.type, events: filteredEvents };
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

  // Fetch all configured feeds in parallel
  const feedPromises = Object.entries(calendarConfig.feeds).map(
    ([name, config]) => fetchFeed(name, config)
  );

  const feedResults = await Promise.all(feedPromises);

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
    .flatMap(r => r.events);

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
