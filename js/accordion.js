/**
 * Accordion Component
 * Expandable rows with animated content reveal
 */

(function() {
  'use strict';

  function initAccordions() {
    const accordions = document.querySelectorAll('[data-accordion]');

    accordions.forEach(accordion => {
      const items = accordion.querySelectorAll('[data-accordion-item]');

      items.forEach(item => {
        const trigger = item.querySelector('[data-accordion-trigger]');

        if (trigger) {
          trigger.addEventListener('click', () => {
            toggleItem(item, items);
          });
        }
      });
    });
  }

  function toggleItem(item, allItems) {
    const isOpen = item.classList.contains('is-open');

    // Close all other items
    allItems.forEach(otherItem => {
      if (otherItem !== item && otherItem.classList.contains('is-open')) {
        otherItem.classList.remove('is-open');
      }
    });

    // Toggle current item
    if (isOpen) {
      item.classList.remove('is-open');
    } else {
      item.classList.add('is-open');

      // Scroll into view if needed (with slight delay for animation)
      setTimeout(() => {
        const rect = item.getBoundingClientRect();
        const headerHeight = 100; // Account for fixed header

        if (rect.top < headerHeight) {
          window.scrollBy({
            top: rect.top - headerHeight - 20,
            behavior: 'smooth'
          });
        }
      }, 100);
    }

    // Refresh ScrollTrigger after content changes
    if (typeof ScrollTrigger !== 'undefined') {
      setTimeout(() => {
        ScrollTrigger.refresh();
      }, 500);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccordions);
  } else {
    initAccordions();
  }
})();
