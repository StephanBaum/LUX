/**
 * iCal Client
 * Fetches calendar data from the API and provides it to other components
 */

(function() {
  'use strict';

  // Cache for calendar data
  var calendarCache = null;
  var cacheTimestamp = null;
  var CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Fetch calendar data from API
   * @returns {Promise<Object>} Calendar data
   */
  function fetchCalendarData() {
    // Return cached data if still valid
    if (calendarCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
      return Promise.resolve(calendarCache);
    }

    return fetch('/api/calendars.json')
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to fetch calendar data');
        }
        return response.json();
      })
      .then(function(data) {
        // Update cache
        calendarCache = data;
        cacheTimestamp = Date.now();
        return data;
      })
      .catch(function(error) {
        console.error('iCal Client Error:', error);
        // Return empty data structure on error
        return {
          timestamp: new Date().toISOString(),
          feeds: {},
          blocked: [],
          events: [],
          workshops: [],
          error: error.message
        };
      });
  }

  /**
   * Get blocked date ranges for calendar
   * @returns {Promise<Array>} Array of blocked date ranges
   */
  function getBlockedDates() {
    return fetchCalendarData().then(function(data) {
      return (data.blocked || []).map(function(event) {
        return {
          start: new Date(event.start),
          end: event.end ? new Date(event.end) : new Date(event.start),
          summary: event.summary
        };
      });
    });
  }

  /**
   * Get events for Veranstaltungen page
   * @returns {Promise<Array>} Array of events
   */
  function getEvents() {
    return fetchCalendarData().then(function(data) {
      return (data.events || []).map(function(event) {
        return {
          uid: event.uid,
          title: event.summary,
          description: event.description,
          location: event.location,
          start: new Date(event.start),
          end: event.end ? new Date(event.end) : null
        };
      });
    });
  }

  /**
   * Get workshops for Workshops page
   * @returns {Promise<Array>} Array of workshops
   */
  function getWorkshops() {
    return fetchCalendarData().then(function(data) {
      return (data.workshops || []).map(function(event) {
        return {
          uid: event.uid,
          title: event.summary,
          description: event.description,
          location: event.location,
          start: new Date(event.start),
          end: event.end ? new Date(event.end) : null
        };
      });
    });
  }

  /**
   * Check if a specific date falls within any blocked range
   * @param {Date} date - The date to check
   * @param {Array} blockedRanges - Array of blocked date ranges
   * @returns {boolean} True if date is blocked
   */
  function isDateBlocked(date, blockedRanges) {
    var checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return blockedRanges.some(function(range) {
      var rangeStart = new Date(range.start);
      rangeStart.setHours(0, 0, 0, 0);

      var rangeEnd = new Date(range.end);
      rangeEnd.setHours(23, 59, 59, 999);

      return checkDate >= rangeStart && checkDate <= rangeEnd;
    });
  }

  /**
   * Clear the cache (useful for forcing refresh)
   */
  function clearCache() {
    calendarCache = null;
    cacheTimestamp = null;
  }

  // Expose API globally
  window.icalClient = {
    fetchCalendarData: fetchCalendarData,
    getBlockedDates: getBlockedDates,
    getEvents: getEvents,
    getWorkshops: getWorkshops,
    isDateBlocked: isDateBlocked,
    clearCache: clearCache
  };

  // Dispatch event when client is ready
  document.dispatchEvent(new CustomEvent('ical:ready'));
})();
