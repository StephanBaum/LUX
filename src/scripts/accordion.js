/**
 * Accordion Component
 * Expandable rows with animated content reveal
 * Supports external image display that updates based on active item
 */

(function() {
  'use strict';

  let cleanup = null;

  function initAccordions() {
    // Cleanup previous instance
    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    var clickHandlers = [];
    var accordions = document.querySelectorAll('[data-accordion]');

    accordions.forEach(function(accordion) {
      var items = accordion.querySelectorAll('[data-accordion-item]');
      var hasExternalImages = accordion.hasAttribute('data-accordion-images');

      // Find external image container (sibling in parent grid)
      var imageTarget = null;
      if (hasExternalImages) {
        var parent = accordion.closest('.grid');
        if (parent) {
          imageTarget = parent.querySelector('[data-accordion-image-target]');
        }
      }

      items.forEach(function(item) {
        var trigger = item.querySelector('[data-accordion-trigger]');

        if (trigger) {
          var handler = function(e) {
            // Don't toggle if clicking on checkbox
            if (e.target.closest('.accordion__checkbox')) {
              e.stopPropagation();
              return;
            }
            toggleItem(item, items, imageTarget);
          };

          trigger.addEventListener('click', handler);
          clickHandlers.push({ trigger: trigger, handler: handler });
        }
      });

      // Initialize image for initially open item
      if (imageTarget) {
        var openItem = accordion.querySelector('.accordion__item.is-open');
        if (openItem) {
          updateExternalImage(openItem, imageTarget);
        }
      }
    });

    // Store cleanup function
    cleanup = function() {
      clickHandlers.forEach(function(item) {
        item.trigger.removeEventListener('click', item.handler);
      });
      clickHandlers = [];
    };
  }

  function toggleItem(item, allItems, imageTarget) {
    var isOpen = item.classList.contains('is-open');

    // Close all other items
    allItems.forEach(function(otherItem) {
      if (otherItem !== item && otherItem.classList.contains('is-open')) {
        otherItem.classList.remove('is-open');
      }
    });

    // Toggle current item
    if (isOpen) {
      item.classList.remove('is-open');
      // Hide image when closing
      if (imageTarget) {
        imageTarget.classList.remove('is-visible');
      }
    } else {
      item.classList.add('is-open');
      // Update external image
      if (imageTarget) {
        updateExternalImage(item, imageTarget);
      }

      // Scroll into view if needed (with slight delay for animation)
      setTimeout(function() {
        var rect = item.getBoundingClientRect();
        var headerHeight = 100;

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
      setTimeout(function() {
        ScrollTrigger.refresh();
      }, 500);
    }
  }

  function updateExternalImage(item, imageTarget) {
    var imageSrc = item.getAttribute('data-image');
    if (imageSrc && imageTarget) {
      var img = imageTarget.querySelector('img');
      if (img) {
        // Fade out, change src, fade in
        imageTarget.classList.remove('is-visible');
        setTimeout(function() {
          img.src = imageSrc;
          img.onload = function() {
            imageTarget.classList.add('is-visible');
          };
          // Fallback if image is cached
          if (img.complete) {
            imageTarget.classList.add('is-visible');
          }
        }, 200);
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccordions);
  } else {
    initAccordions();
  }

  // Re-initialize after View Transitions page swap
  document.addEventListener('astro:page-load', initAccordions);
})();
