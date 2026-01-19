/**
 * Calendar Configuration
 * Defines iCal feed sources and display settings
 */

export default {
  feeds: {
    reservations: {
      url: process.env.ICAL_RESERVATIONS_URL || '',
      type: 'blocked',
      description: 'Studio reservations - blocks dates on rental calendar'
    },
    events: {
      url: process.env.ICAL_EVENTS_URL || '',
      type: 'event',
      description: 'Events - displayed on Veranstaltungen page'
    },
    workshops: {
      url: process.env.ICAL_WORKSHOPS_URL || '',
      type: 'workshop',
      description: 'Workshops - displayed on Workshops page'
    }
  },
  // How many days into the future to fetch events
  futureWindow: 365,
  // How many days in the past to keep (for recent events display)
  pastWindow: 30,
  // Cache duration in seconds (for client-side caching)
  cacheDuration: 300
};
