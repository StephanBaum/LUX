/**
 * Events Loader
 * Dynamically loads and renders events/workshops from iCal calendar data
 */

(function() {
  'use strict';

  // Default images for events when none specified
  var DEFAULT_IMAGES = [
    '/Assets/img/image 1.png',
    '/Assets/img/image 2.png',
    '/Assets/img/image 3.png',
    '/Assets/img/image 4.png',
    '/Assets/img/image 5.png',
    '/Assets/img/image 6.png'
  ];

  /**
   * Format date for display
   */
  function formatDate(date) {
    var day = String(date.getDate()).padStart(2, '0');
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var year = date.getFullYear();
    return day + '.' + month + '.' + year;
  }

  /**
   * Generate accordion item HTML for an event
   */
  function createEventAccordionItem(event, index, isFirst) {
    var imageUrl = DEFAULT_IMAGES[index % DEFAULT_IMAGES.length];
    var dateLabel = formatDate(event.start);
    var isOpenClass = isFirst ? ' is-open' : '';

    return '<div class="accordion__item' + isOpenClass + '" data-accordion-item data-image="' + imageUrl + '">' +
      '<button class="accordion__header" data-accordion-trigger>' +
        '<span class="accordion__label">' + dateLabel + '</span>' +
        '<span class="accordion__title">' + escapeHtml(event.title) + '</span>' +
        '<svg class="accordion__arrow" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M28 0V27H24V6.37305L3.17383 27.1016L0.351562 24.2666L20.7139 4H0V0H28Z" fill="currentColor"/>' +
        '</svg>' +
      '</button>' +
      '<div class="accordion__content" data-accordion-content>' +
        '<div class="accordion__inner">' +
          '<div class="accordion__text">' +
            '<div class="accordion__profile-intro">' +
              '<h3 class="accordion__profile-title">' + escapeHtml(event.title) + '</h3>' +
              (event.location ? '<span class="accordion__profile-location">' + escapeHtml(event.location) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="accordion__description">' +
            '<p>' + escapeHtml(event.description || '') + '</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Generate accordion item HTML for a workshop
   */
  function createWorkshopAccordionItem(workshop, index, isFirst) {
    var imageUrl = DEFAULT_IMAGES[index % DEFAULT_IMAGES.length];
    var workshopLabel = 'Workshop #' + (index + 1);
    var isOpenClass = isFirst ? ' is-open' : '';

    return '<div class="accordion__item' + isOpenClass + '" data-accordion-item data-image="' + imageUrl + '">' +
      '<button class="accordion__header" data-accordion-trigger>' +
        '<span class="accordion__label">' + workshopLabel + '</span>' +
        '<span class="accordion__title">' + escapeHtml(workshop.title) + '</span>' +
        '<svg class="accordion__arrow" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M28 0V27H24V6.37305L3.17383 27.1016L0.351562 24.2666L20.7139 4H0V0H28Z" fill="currentColor"/>' +
        '</svg>' +
      '</button>' +
      '<div class="accordion__content" data-accordion-content>' +
        '<div class="accordion__inner">' +
          '<div class="accordion__text">' +
            '<div class="accordion__profile-intro">' +
              '<h3 class="accordion__profile-title">' + escapeHtml(workshop.title) + '</h3>' +
              (workshop.location ? '<span class="accordion__profile-location">' + escapeHtml(workshop.location) + '</span>' : '') +
            '</div>' +
            '<div class="accordion__profile-section">' +
              '<h4 class="accordion__profile-section-title">Termin</h4>' +
              '<div class="accordion__profile-item">' +
                '<span class="accordion__profile-item-title">' + formatDate(workshop.start) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="accordion__description">' +
            '<p>' + escapeHtml(workshop.description || '') + '</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /**
   * Escape HTML entities
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Load and render dynamic events
   */
  function loadEvents() {
    var eventsContainer = document.querySelector('[data-events-dynamic]');
    if (!eventsContainer) return;

    var accordion = eventsContainer.querySelector('.accordion');
    if (!accordion) return;

    // Store original static content as fallback
    var staticContent = accordion.innerHTML;

    function renderEvents() {
      if (!window.icalClient) return;

      window.icalClient.getEvents().then(function(events) {
        // Only render if we have events
        if (events && events.length > 0) {
          var html = events.map(function(event, index) {
            return createEventAccordionItem(event, index, index === 0);
          }).join('');

          accordion.innerHTML = html;

          // Re-initialize accordion component
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('accordion:reinit'));
          }
        }
        // If no events, keep static content
      }).catch(function(error) {
        console.error('Failed to load events:', error);
        // Keep static content on error
      });
    }

    // Wait for iCal client
    if (window.icalClient) {
      renderEvents();
    } else {
      document.addEventListener('ical:ready', renderEvents, { once: true });
    }
  }

  /**
   * Load and render dynamic workshops
   */
  function loadWorkshops() {
    var workshopsContainer = document.querySelector('[data-workshops-dynamic]');
    if (!workshopsContainer) return;

    var accordion = workshopsContainer.querySelector('.accordion');
    if (!accordion) return;

    // Store original static content as fallback
    var staticContent = accordion.innerHTML;

    function renderWorkshops() {
      if (!window.icalClient) return;

      window.icalClient.getWorkshops().then(function(workshops) {
        // Only render if we have workshops
        if (workshops && workshops.length > 0) {
          var html = workshops.map(function(workshop, index) {
            return createWorkshopAccordionItem(workshop, index, index === 0);
          }).join('');

          accordion.innerHTML = html;

          // Re-initialize accordion component
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('accordion:reinit'));
          }
        }
        // If no workshops, keep static content
      }).catch(function(error) {
        console.error('Failed to load workshops:', error);
        // Keep static content on error
      });
    }

    // Wait for iCal client
    if (window.icalClient) {
      renderWorkshops();
    } else {
      document.addEventListener('ical:ready', renderWorkshops, { once: true });
    }
  }

  /**
   * Initialize events loader
   */
  function init() {
    loadEvents();
    loadWorkshops();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize after View Transitions page swap
  document.addEventListener('astro:page-load', init);
})();
