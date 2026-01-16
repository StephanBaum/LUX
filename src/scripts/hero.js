/**
 * LUX Hero Component
 * Features:
 * - Floating images with parallax on scroll
 * - Nav links with arrow animation on hover
 * - Mouse-following image
 * - Text masking (white text over cursor image)
 */

(function() {
  'use strict';

  var rafId = null;
  var scrollTriggers = [];
  var cleanup = null;

  function waitForGSAP(callback) {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      callback();
    } else {
      setTimeout(function() { waitForGSAP(callback); }, 10);
    }
  }

  function initHero() {
    // Cleanup previous instance
    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    // Configuration
    var config = {
      cursor: {
        smoothing: 0.15,
        scaleOnHover: 1,
        scaleOnLeave: 0.8
      }
    };

    // State
    var state = {
      mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      cursorTarget: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      isHovering: false,
      currentLink: null
    };

    // DOM Elements
    var hero = document.querySelector('.hero');
    if (!hero) return;

    var navLinks = document.querySelectorAll('.hero__nav-link');
    var originalCursor = document.querySelector('.cursor-image');
    var cursorImage = null;
    var cursorImg = null;
    var floatingImages = document.querySelectorAll('.hero__image');

    // Move cursor to body so it's truly fixed to viewport
    if (originalCursor) {
      // Check if we already have a body cursor from previous init
      var existingBodyCursor = document.body.querySelector(':scope > .cursor-image');
      if (existingBodyCursor) {
        cursorImage = existingBodyCursor;
      } else {
        cursorImage = originalCursor.cloneNode(true);
        document.body.appendChild(cursorImage);
      }
      originalCursor.style.display = 'none';
      cursorImg = cursorImage.querySelector('img');
    }

    // Event handlers for cleanup
    var mouseMoveHandler = null;
    var navLeaveHandler = null;
    var linkHandlers = [];

    // Set initial cursor state with GSAP
    if (cursorImage) {
      gsap.set(cursorImage, {
        scale: config.cursor.scaleOnLeave,
        xPercent: -50,
        yPercent: -50
      });
    }

    // Setup image positions from data attributes
    floatingImages.forEach(function(img) {
      var top = img.dataset.top;
      var bottom = img.dataset.bottom;
      var left = img.dataset.left;
      var right = img.dataset.right;
      var width = img.dataset.width;
      var height = img.dataset.height;

      if (top) img.style.top = top;
      if (bottom) img.style.bottom = bottom;
      if (left) img.style.left = left;
      if (right) img.style.right = right;
      if (width) img.style.width = width;
      if (height) img.style.height = height;
    });

    // Create white text overlays (fixed position, outside links)
    var textOverlays = [];
    navLinks.forEach(function(link) {
      // Remove any old masked-text inside link
      var oldMask = link.querySelector('.masked-text');
      if (oldMask) oldMask.remove();

      // Create fixed overlay with same structure as link
      var overlay = document.createElement('div');
      overlay.className = 'hero__text-overlay';
      var styles = getComputedStyle(link);
      overlay.style.cssText = 'position:fixed;pointer-events:none;opacity:0;color:#fff;font-size:' + styles.fontSize + ';font-weight:' + styles.fontWeight + ';line-height:' + styles.lineHeight + ';z-index:100;display:flex;align-items:baseline;gap:0.3em;';
      document.body.appendChild(overlay);
      textOverlays.push({ link: link, overlay: overlay });

      var allArrows = link.querySelectorAll('.hero__nav-arrow');
      gsap.set(allArrows, { opacity: 0, x: '-0.5em' });
    });

    // Setup parallax for floating images
    floatingImages.forEach(function(img) {
      var speed = parseFloat(img.dataset.speed) || 1;
      var yMovement = -200 * speed;

      var st = ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
        animation: gsap.to(img, { y: yMovement, ease: 'none' })
      });
      scrollTriggers.push(st);
    });

    // Setup parallax for nav links
    var totalLinks = navLinks.length;
    navLinks.forEach(function(link, index) {
      var speed = 1 - (index / (totalLinks - 1)) * 0.8;
      var yMovement = -250 * speed;

      var st = ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
        animation: gsap.to(link, { y: yMovement, ease: 'none' })
      });
      scrollTriggers.push(st);
    });

    // Reset link state helper
    function resetLinkState(link) {
      var arrows = link.querySelectorAll('.hero__nav-arrow');

      // Hide overlay for this link
      textOverlays.forEach(function(item) {
        if (item.link === link) {
          item.overlay.style.opacity = '0';
        }
      });

      gsap.killTweensOf(arrows);
      gsap.to(arrows, {
        opacity: 0,
        x: '-0.5em',
        duration: 0.3,
        ease: 'power2.in'
      });
    }

    // Reset all hover states
    function resetAllHoverStates() {
      state.isHovering = false;
      state.currentLink = null;

      navLinks.forEach(function(link) { resetLinkState(link); });

      // Hide all overlays
      textOverlays.forEach(function(item) {
        item.overlay.style.opacity = '0';
      });

      if (cursorImage) {
        gsap.killTweensOf(cursorImage);
        gsap.to(cursorImage, {
          opacity: 0,
          scale: config.cursor.scaleOnLeave,
          duration: 0.3,
          ease: 'power2.in'
        });
      }
    }

    // Setup nav hover
    var nav = document.querySelector('.hero__nav');
    if (nav) {
      navLeaveHandler = resetAllHoverStates;
      nav.addEventListener('mouseleave', navLeaveHandler);
    }

    navLinks.forEach(function(link) {
      var imgSrc = link.dataset.img;

      var enterHandler = function() {
        navLinks.forEach(function(otherLink) {
          if (otherLink !== link) {
            resetLinkState(otherLink);
          }
        });

        state.isHovering = true;
        state.currentLink = link;

        if (imgSrc && cursorImg) {
          cursorImg.src = imgSrc;
        }

        var arrows = link.querySelectorAll('.hero__nav-arrow');
        gsap.killTweensOf(arrows);
        gsap.to(arrows, {
          opacity: 1,
          x: 0,
          duration: 0.4,
          ease: 'power3.out'
        });

        if (cursorImage) {
          gsap.killTweensOf(cursorImage);
          gsap.to(cursorImage, {
            opacity: 1,
            scale: config.cursor.scaleOnHover,
            duration: 0.4,
            ease: 'power3.out'
          });
        }
      };

      var leaveHandler = function() {
        resetLinkState(link);

        if (cursorImage) {
          gsap.killTweensOf(cursorImage);
          gsap.to(cursorImage, {
            opacity: 0,
            scale: config.cursor.scaleOnLeave,
            duration: 0.3,
            ease: 'power2.in'
          });
        }

        state.isHovering = false;
        state.currentLink = null;
      };

      link.addEventListener('mouseenter', enterHandler);
      link.addEventListener('mouseleave', leaveHandler);

      linkHandlers.push({ link: link, enter: enterHandler, leave: leaveHandler });
    });

    // Mouse tracking
    mouseMoveHandler = function(e) {
      state.mouse.x = e.clientX;
      state.mouse.y = e.clientY;
    };
    document.addEventListener('mousemove', mouseMoveHandler);

    // Update text masking - position overlays at link positions, clip to cursor
    function updateTextMasking() {
      if (!cursorImage) return;

      var cursorRect = cursorImage.getBoundingClientRect();

      textOverlays.forEach(function(item) {
        var link = item.link;
        var overlay = item.overlay;

        if (link !== state.currentLink) {
          overlay.style.opacity = '0';
          return;
        }

        // Get link position
        var linkRect = link.getBoundingClientRect();

        // Update overlay content to match link (text + arrow with current animation state)
        var textEl = link.querySelector('.hero__nav-text');
        var arrowEl = link.querySelector('.hero__nav-arrow:not(.masked-text .hero__nav-arrow)');
        var arrowStyle = arrowEl ? getComputedStyle(arrowEl) : null;
        var arrowOpacity = arrowStyle ? arrowStyle.opacity : '0';
        var arrowTransform = arrowStyle ? arrowStyle.transform : '';

        overlay.innerHTML = '<span style="color:#fff">' + textEl.textContent + '</span>' +
          '<svg style="width:0.8em;height:0.8em;color:#fff;opacity:' + arrowOpacity + ';transform:' + arrowTransform + '" viewBox="0 0 28 28" fill="none"><path d="M28 0V27H24V6.37305L3.17383 27.1016L0.351562 24.2666L20.7139 4H0V0H28Z" fill="currentColor"/></svg>';

        overlay.style.left = linkRect.left + 'px';
        overlay.style.top = linkRect.top + 'px';
        overlay.style.opacity = '1';

        // Clip to cursor bounds
        var clipLeft = Math.max(0, cursorRect.left - linkRect.left);
        var clipTop = Math.max(0, cursorRect.top - linkRect.top);
        var clipRight = Math.max(0, linkRect.right - cursorRect.right);
        var clipBottom = Math.max(0, linkRect.bottom - cursorRect.bottom);

        overlay.style.clipPath = 'inset(' + clipTop + 'px ' + clipRight + 'px ' + clipBottom + 'px ' + clipLeft + 'px)';
      });
    }

    // Render loop
    function render() {
      state.cursorTarget.x += (state.mouse.x - state.cursorTarget.x) * config.cursor.smoothing;
      state.cursorTarget.y += (state.mouse.y - state.cursorTarget.y) * config.cursor.smoothing;

      // Position cursor with GSAP
      if (cursorImage) {
        gsap.set(cursorImage, {
          x: state.cursorTarget.x,
          y: state.cursorTarget.y,
          xPercent: -50,
          yPercent: -50
        });
      }

      if (state.isHovering) {
        updateTextMasking();
      }

      rafId = requestAnimationFrame(render);
    }

    render();

    // Store cleanup function
    cleanup = function() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      scrollTriggers.forEach(function(st) { st.kill(); });
      scrollTriggers = [];

      if (mouseMoveHandler) {
        document.removeEventListener('mousemove', mouseMoveHandler);
      }

      if (nav && navLeaveHandler) {
        nav.removeEventListener('mouseleave', navLeaveHandler);
      }

      linkHandlers.forEach(function(handler) {
        handler.link.removeEventListener('mouseenter', handler.enter);
        handler.link.removeEventListener('mouseleave', handler.leave);
      });
      linkHandlers = [];

      // Remove body cursor and restore original
      if (cursorImage && cursorImage.parentNode === document.body) {
        cursorImage.remove();
      }
      if (originalCursor) {
        originalCursor.style.display = '';
      }

      // Remove text overlays
      textOverlays.forEach(function(item) {
        if (item.overlay.parentNode) {
          item.overlay.remove();
        }
      });
      textOverlays = [];
    };
  }

  function init() {
    waitForGSAP(initHero);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize after View Transitions
  document.addEventListener('astro:page-load', init);
})();
