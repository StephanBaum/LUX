/**
 * Draggable Image Slider
 * Starts at grid margin, drag left to reveal more, loops at end
 */

(function() {
  'use strict';

  var cleanup = null;
  var draggableInstance = null;
  var bodyCursor = null;

  function waitForGSAP(callback) {
    if (typeof gsap !== 'undefined' && typeof Draggable !== 'undefined') {
      callback();
    } else {
      setTimeout(function() { waitForGSAP(callback); }, 10);
    }
  }

  function initSlider() {
    // Cleanup previous instance
    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    var slider = document.querySelector('.slider');
    var track = document.querySelector('[data-slider-track]');
    var wrapper = document.querySelector('.slider__track-wrapper');
    var customCursor = document.querySelector('.slider__cursor');

    if (!track || !wrapper) return;

    // Move cursor to body to avoid transform context issues
    if (customCursor && customCursor.parentNode !== document.body) {
      // Clone the cursor and append to body
      bodyCursor = customCursor.cloneNode(true);
      document.body.appendChild(bodyCursor);
      // Hide the original
      customCursor.style.display = 'none';
    } else if (bodyCursor) {
      // Reuse existing body cursor
    } else {
      bodyCursor = customCursor;
    }

    // Event handlers for cleanup
    var handlers = {
      mouseenter: null,
      mouseleave: null,
      mousemove: null,
      resize: null
    };

    // Cursor state
    var cursorX = -200;
    var cursorY = -200;
    var targetX = -200;
    var targetY = -200;
    var cursorVisible = false;
    var rafId = null;

    // Custom cursor setup
    if (bodyCursor) {
      var line = bodyCursor.querySelector('.slider__cursor-line');
      var leftHead = bodyCursor.querySelector('.slider__cursor-head--left');
      var rightHead = bodyCursor.querySelector('.slider__cursor-head--right');

      // Position cursor off-screen initially
      bodyCursor.style.left = '-200px';
      bodyCursor.style.top = '-200px';
      bodyCursor.style.opacity = '0';

      // Smooth cursor animation loop
      function animateCursor() {
        // Lerp towards target
        cursorX += (targetX - cursorX) * 0.15;
        cursorY += (targetY - cursorY) * 0.15;

        // Apply position (centered on cursor)
        bodyCursor.style.left = (cursorX - 60) + 'px';
        bodyCursor.style.top = (cursorY - 24) + 'px';

        rafId = requestAnimationFrame(animateCursor);
      }

      // Start animation loop
      rafId = requestAnimationFrame(animateCursor);

      handlers.mouseenter = function() {
        cursorVisible = true;
        bodyCursor.style.opacity = '1';
        // Animate arrow expansion
        if (line) gsap.to(line, { attr: { x1: 6, x2: 74 }, duration: 0.4, ease: 'power2.out' });
        if (leftHead) gsap.to(leftHead, { x: -10, duration: 0.4, ease: 'power2.out' });
        if (rightHead) gsap.to(rightHead, { x: 10, duration: 0.4, ease: 'power2.out' });
      };

      handlers.mouseleave = function() {
        cursorVisible = false;
        bodyCursor.style.opacity = '0';
        // Reset arrows
        if (line) gsap.to(line, { attr: { x1: 16, x2: 64 }, duration: 0.3 });
        if (leftHead) gsap.to(leftHead, { x: 0, duration: 0.3 });
        if (rightHead) gsap.to(rightHead, { x: 0, duration: 0.3 });
      };

      handlers.mousemove = function(e) {
        targetX = e.clientX;
        targetY = e.clientY;
      };

      wrapper.addEventListener('mouseenter', handlers.mouseenter);
      wrapper.addEventListener('mouseleave', handlers.mouseleave);
      wrapper.addEventListener('mousemove', handlers.mousemove);
    }

    var slides = Array.from(track.children);
    var slideCount = slides.length;

    // Remove any existing clones first (keep only originals)
    var allSlides = track.querySelectorAll('.slider__slide');
    var originals = [];
    for (var i = 0; i < allSlides.length; i++) {
      if (i < slideCount) {
        originals.push(allSlides[i]);
      } else {
        allSlides[i].remove();
      }
    }

    // Clone slides 3 times for seamless loop with buffer
    for (var j = 0; j < 3; j++) {
      originals.forEach(function(slide) {
        var clone = slide.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      });
    }

    // Get dimensions
    var gap = parseFloat(getComputedStyle(track).gap) || 24;
    var slideWidth = slides[0].offsetWidth + gap;
    var singleSetWidth = slideWidth * slideCount;

    // State
    var velocity = 0;
    var lastX = 0;
    var lastTime = 0;
    var momentumTween = null;

    // Start at 0 (CSS margin handles grid alignment)
    gsap.set(track, { x: 0 });

    // Create draggable
    draggableInstance = Draggable.create(track, {
      type: 'x',
      edgeResistance: 0.65,
      bounds: { maxX: 0 },

      onPress: function() {
        if (momentumTween) {
          momentumTween.kill();
        }

        lastX = this.x;
        lastTime = performance.now();
        velocity = 0;
      },

      onDrag: function() {
        var now = performance.now();
        var dt = now - lastTime;

        if (dt > 0) {
          velocity = (this.x - lastX) / dt;
        }

        lastX = this.x;
        lastTime = now;

        checkLoop(this);
      },

      onRelease: function() {
        var throwVelocity = velocity * 300;

        if (Math.abs(throwVelocity) > 20) {
          applyMomentum(this, throwVelocity);
        }
      }
    })[0];

    // Apply momentum
    function applyMomentum(instance, initialVelocity) {
      var currentX = gsap.getProperty(track, 'x');
      var targetXPos = Math.min(currentX + initialVelocity, 0);

      momentumTween = gsap.to(track, {
        x: targetXPos,
        duration: Math.min(Math.abs(initialVelocity) / 500, 0.8),
        ease: 'power2.out',
        onUpdate: function() {
          if (initialVelocity < 0) {
            checkLoopFromTween();
          }
          instance.update();
        }
      });
    }

    var loopPoint = -(singleSetWidth + slideWidth);

    function checkLoopFromTween() {
      var x = gsap.getProperty(track, 'x');

      if (x < loopPoint) {
        var newX = x + singleSetWidth;
        gsap.set(track, { x: newX });
        if (momentumTween) {
          momentumTween.vars.x += singleSetWidth;
        }
      }
    }

    function checkLoop(instance) {
      var x = gsap.getProperty(track, 'x');

      if (x < loopPoint) {
        gsap.set(track, { x: x + singleSetWidth });
        instance.update();
        lastX = gsap.getProperty(track, 'x');
      }
    }

    // Resize handler
    var resizeTimeout;
    handlers.resize = function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        if (draggableInstance) {
          draggableInstance.update();
        }
      }, 250);
    };
    window.addEventListener('resize', handlers.resize);

    // Store cleanup function
    cleanup = function() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (draggableInstance) {
        draggableInstance.kill();
        draggableInstance = null;
      }
      if (momentumTween) {
        momentumTween.kill();
        momentumTween = null;
      }
      if (handlers.mouseenter) wrapper.removeEventListener('mouseenter', handlers.mouseenter);
      if (handlers.mouseleave) wrapper.removeEventListener('mouseleave', handlers.mouseleave);
      if (handlers.mousemove) wrapper.removeEventListener('mousemove', handlers.mousemove);
      if (handlers.resize) window.removeEventListener('resize', handlers.resize);
      // Remove body cursor
      if (bodyCursor && bodyCursor.parentNode === document.body) {
        bodyCursor.remove();
        bodyCursor = null;
      }
      // Show original cursor again
      if (customCursor) {
        customCursor.style.display = '';
      }
    };
  }

  function init() {
    waitForGSAP(initSlider);
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
