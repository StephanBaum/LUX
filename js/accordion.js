/**
 * Accordion Component
 * Expandable rows with animated content reveal
 * Supports external image display that updates based on active item
 */

(function() {
  'use strict';

  function initAccordions() {
    const accordions = document.querySelectorAll('[data-accordion]');

    accordions.forEach(accordion => {
      const items = accordion.querySelectorAll('[data-accordion-item]');
      const hasExternalImages = accordion.hasAttribute('data-accordion-images');

      // Find external image container (sibling in parent grid)
      let imageTarget = null;
      if (hasExternalImages) {
        const parent = accordion.closest('.grid');
        if (parent) {
          imageTarget = parent.querySelector('[data-accordion-image-target]');
        }
      }

      items.forEach(item => {
        const trigger = item.querySelector('[data-accordion-trigger]');

        if (trigger) {
          trigger.addEventListener('click', () => {
            toggleItem(item, items, imageTarget);
          });
        }
      });

      // Initialize image for initially open item
      if (imageTarget) {
        const openItem = accordion.querySelector('.accordion__item.is-open');
        if (openItem) {
          updateExternalImage(openItem, imageTarget);
        }
      }
    });
  }

  function toggleItem(item, allItems, imageTarget) {
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

  function updateExternalImage(item, imageTarget) {
    const imageSrc = item.getAttribute('data-image');
    if (imageSrc && imageTarget) {
      const img = imageTarget.querySelector('img');
      if (img) {
        // Fade out, change src, fade in
        imageTarget.classList.remove('is-visible');
        setTimeout(() => {
          img.src = imageSrc;
          img.onload = () => {
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
})();
