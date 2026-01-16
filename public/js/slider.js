/**
 * Draggable Image Slider
 * Starts at grid margin, drag left to reveal more, loops at end
 */

gsap.registerPlugin(Draggable);

(function() {
  'use strict';

  function initSlider() {
    const slider = document.querySelector('.slider');
    const track = document.querySelector('[data-slider-track]');
    const wrapper = document.querySelector('.slider__track-wrapper');
    const customCursor = document.querySelector('.slider__cursor');

    if (!track || !wrapper) return;

    // Custom cursor follow
    if (customCursor) {
      const line = customCursor.querySelector('.slider__cursor-line');
      const leftHead = customCursor.querySelector('.slider__cursor-head--left');
      const rightHead = customCursor.querySelector('.slider__cursor-head--right');

      wrapper.addEventListener('mouseenter', () => {
        gsap.to(customCursor, { opacity: 1, duration: 0.2 });
        // Animate line to stretch
        gsap.to(line, { attr: { x1: 6, x2: 74 }, duration: 0.4, ease: 'power2.out' });
        // Animate arrow heads outward
        gsap.to(leftHead, { x: -10, duration: 0.4, ease: 'power2.out' });
        gsap.to(rightHead, { x: 10, duration: 0.4, ease: 'power2.out' });
      });

      wrapper.addEventListener('mouseleave', () => {
        gsap.to(customCursor, { opacity: 0, duration: 0.2 });
        gsap.to(line, { attr: { x1: 16, x2: 64 }, duration: 0.3 });
        gsap.to(leftHead, { x: 0, duration: 0.3 });
        gsap.to(rightHead, { x: 0, duration: 0.3 });
      });

      wrapper.addEventListener('mousemove', (e) => {
        gsap.to(customCursor, {
          x: e.clientX,
          y: e.clientY,
          duration: 0.12,
          ease: 'power2.out'
        });
      });
    }

    const slides = Array.from(track.children);
    const slideCount = slides.length;

    // Clone slides 3 times for seamless loop with buffer
    for (let i = 0; i < 3; i++) {
      slides.forEach(slide => {
        const clone = slide.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      });
    }

    // Get dimensions
    const gap = parseFloat(getComputedStyle(track).gap) || 24;
    const slideWidth = slides[0].offsetWidth + gap;
    const singleSetWidth = slideWidth * slideCount;
    const viewportWidth = window.innerWidth;

    // State
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    let momentumTween = null;

    // Start at 0 (CSS margin handles grid alignment)
    gsap.set(track, { x: 0 });

    // Create draggable
    const draggable = Draggable.create(track, {
      type: 'x',
      edgeResistance: 0.65,
      bounds: { maxX: 0 }, // Can't drag past start

      onPress: function() {
        slider.classList.add('is-dragging');

        if (momentumTween) {
          momentumTween.kill();
        }

        lastX = this.x;
        lastTime = performance.now();
        velocity = 0;
      },

      onDrag: function() {
        const now = performance.now();
        const dt = now - lastTime;

        if (dt > 0) {
          velocity = (this.x - lastX) / dt;
        }

        lastX = this.x;
        lastTime = now;

        // Check for loop point (dragged left past one full set)
        checkLoop(this);
      },

      onRelease: function() {
        slider.classList.remove('is-dragging');

        const throwVelocity = velocity * 300;

        // Apply momentum if velocity is significant (either direction)
        if (Math.abs(throwVelocity) > 20) {
          applyMomentum(this, throwVelocity);
        }
      }
    })[0];

    // Apply momentum
    function applyMomentum(instance, initialVelocity) {
      const currentX = gsap.getProperty(track, 'x');
      // Clamp to not go past 0 (start position)
      const targetX = Math.min(currentX + initialVelocity, 0);

      momentumTween = gsap.to(track, {
        x: targetX,
        duration: Math.min(Math.abs(initialVelocity) / 500, 0.8),
        ease: 'power2.out',
        onUpdate: function() {
          // Only check loop for leftward movement
          if (initialVelocity < 0) {
            checkLoopFromTween();
          }
          instance.update();
        }
      });
    }

    // Loop threshold - when first set is completely off-screen left
    // Add buffer to ensure images are fully off-screen before looping
    const loopPoint = -(singleSetWidth + slideWidth);

    function checkLoopFromTween() {
      let x = gsap.getProperty(track, 'x');

      if (x < loopPoint) {
        const newX = x + singleSetWidth;
        gsap.set(track, { x: newX });
        if (momentumTween) {
          momentumTween.vars.x += singleSetWidth;
        }
      }
    }

    function checkLoop(instance) {
      const x = gsap.getProperty(track, 'x');

      if (x < loopPoint) {
        gsap.set(track, { x: x + singleSetWidth });
        instance.update();
        lastX = gsap.getProperty(track, 'x');
      }
    }

    // Resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        draggable.update();
      }, 250);
    });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSlider);
  } else {
    initSlider();
  }
})();
