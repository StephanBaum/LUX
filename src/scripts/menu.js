/**
 * Menu Overlay
 * Handles the slide-in menu panel with image fade effect
 */

(function() {
  'use strict';

  let cleanup = null;

  function init() {
    // Cleanup previous instance
    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    const menuToggle = document.querySelector('.header__menu-toggle');
    const menuOverlay = document.querySelector('.menu-overlay');
    const menuClose = document.querySelector('.menu-overlay__close');
    const menuBgImg = document.querySelector('.menu-overlay__bg img');
    const menuBg = document.querySelector('.menu-overlay__bg');
    const body = document.body;

    // Available images for random selection
    const menuImages = [
      '/Assets/img/image 0.png',
      '/Assets/img/image 1.png',
      '/Assets/img/image 2.png',
      '/Assets/img/image 3.png',
      '/Assets/img/image 4.png',
      '/Assets/img/image 5.png',
      '/Assets/img/image 6.png',
      '/Assets/img/image 7.png',
      '/Assets/img/image 8.png'
    ];

    if (!menuToggle || !menuOverlay) return;

    function getRandomImage() {
      const randomIndex = Math.floor(Math.random() * menuImages.length);
      return menuImages[randomIndex];
    }

    function getScrollbarWidth() {
      return window.innerWidth - document.documentElement.clientWidth;
    }

    function openMenu() {
      // Set random image before opening
      if (menuBgImg) {
        menuBgImg.src = getRandomImage();
      }
      // Compensate for scrollbar width to prevent layout shift
      const scrollbarWidth = getScrollbarWidth();
      document.documentElement.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');

      body.classList.add('menu-open');
      menuOverlay.classList.add('is-open');
      menuToggle.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      body.classList.remove('menu-open');
      menuOverlay.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');

      // Reset scrollbar compensation
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    }

    function toggleMenu() {
      if (menuOverlay.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    function handleKeydown(e) {
      if (e.key === 'Escape' && menuOverlay.classList.contains('is-open')) {
        closeMenu();
      }
    }

    // Toggle button click
    menuToggle.addEventListener('click', toggleMenu);

    // Close button click
    if (menuClose) {
      menuClose.addEventListener('click', closeMenu);
    }

    // Close on escape key
    document.addEventListener('keydown', handleKeydown);

    // Close when clicking on background image area
    if (menuBg) {
      menuBg.addEventListener('click', closeMenu);
    }

    // Store cleanup function
    cleanup = function() {
      menuToggle.removeEventListener('click', toggleMenu);
      if (menuClose) {
        menuClose.removeEventListener('click', closeMenu);
      }
      document.removeEventListener('keydown', handleKeydown);
      if (menuBg) {
        menuBg.removeEventListener('click', closeMenu);
      }
      // Ensure menu is closed on cleanup
      body.classList.remove('menu-open');
      menuOverlay.classList.remove('is-open');
    };
  }

  // Initialize on DOMContentLoaded and after View Transitions
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize after View Transitions page swap
  document.addEventListener('astro:page-load', init);
})();
