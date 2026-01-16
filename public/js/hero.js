/**
 * LUX Hero Component
 * Features:
 * - Floating images with parallax on scroll
 * - Nav links with arrow animation on hover
 * - Mouse-following image
 * - Text masking (white text over cursor image)
 */

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// ============================================
// Configuration
// ============================================
const config = {
  cursor: {
    smoothing: 0.15,      // Mouse follow smoothing (lower = smoother)
    scaleOnHover: 1,      // Scale when visible
    scaleOnLeave: 0.8     // Scale when hiding
  },
  parallax: {
    scrub: 1.5            // Scroll smoothing
  }
};

// ============================================
// State
// ============================================
const state = {
  mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  cursorTarget: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  isHovering: false,
  currentLink: null,
  rafId: null
};

// ============================================
// DOM Elements
// ============================================
const elements = {
  hero: document.querySelector('.hero'),
  navLinks: document.querySelectorAll('.hero__nav-link'),
  cursorImage: document.querySelector('.cursor-image'),
  cursorImg: document.querySelector('.cursor-image img'),
  floatingImages: document.querySelectorAll('.hero__image')
};

// ============================================
// Initialize
// ============================================
function init() {
  // Set initial cursor image state
  gsap.set(elements.cursorImage, {
    scale: config.cursor.scaleOnLeave,
    xPercent: -50,
    yPercent: -50
  });

  setupImagePositions();
  setupMaskedText();
  setupParallax();
  setupNavHover();
  setupMouseTracking();
  startRenderLoop();
}

// ============================================
// Image Positioning from Data Attributes
// ============================================
function setupImagePositions() {
  elements.floatingImages.forEach(img => {
    // Read position data attributes
    const top = img.dataset.top;
    const bottom = img.dataset.bottom;
    const left = img.dataset.left;
    const right = img.dataset.right;
    const width = img.dataset.width;
    const height = img.dataset.height;

    // Apply styles
    if (top) img.style.top = top;
    if (bottom) img.style.bottom = bottom;
    if (left) img.style.left = left;
    if (right) img.style.right = right;
    if (width) img.style.width = width;
    if (height) img.style.height = height;
  });
}

// ============================================
// Create Masked Text Clones
// For white text effect when cursor image overlaps
// ============================================
function setupMaskedText() {
  elements.navLinks.forEach(link => {
    // Clone the inner content for masking
    const maskedClone = document.createElement('span');
    maskedClone.className = 'masked-text';
    maskedClone.innerHTML = link.innerHTML;
    link.appendChild(maskedClone);

    // Set initial state for all arrows (original + cloned)
    const allArrows = link.querySelectorAll('.hero__nav-arrow');
    gsap.set(allArrows, { opacity: 0, x: '-0.5em' });
  });
}

// ============================================
// Parallax Scroll Effect
// All elements move UP at different speeds
// ============================================
function setupParallax() {
  // Parallax for floating images - all move up, different speeds
  elements.floatingImages.forEach(img => {
    const speed = parseFloat(img.dataset.speed) || 1;
    // Negative value = move up as you scroll down
    const yMovement = -200 * speed;

    gsap.to(img, {
      y: yMovement,
      ease: 'none',
      scrollTrigger: {
        trigger: elements.hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5
      }
    });
  });

  // Parallax for nav links - first moves most, last moves least
  const totalLinks = elements.navLinks.length;
  elements.navLinks.forEach((link, index) => {
    // First link (index 0) gets highest speed, last gets lowest
    // More dramatic range: 1.0 down to 0.2
    const speed = 1 - (index / (totalLinks - 1)) * 0.8;
    const yMovement = -250 * speed;

    gsap.to(link, {
      y: yMovement,
      ease: 'none',
      scrollTrigger: {
        trigger: elements.hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5
      }
    });
  });
}

// ============================================
// Navigation Hover Effects
// ============================================
function setupNavHover() {
  const nav = document.querySelector('.hero__nav');

  // Fallback: reset everything when leaving nav area
  nav.addEventListener('mouseleave', resetAllHoverStates);

  elements.navLinks.forEach(link => {
    const imgSrc = link.dataset.img;

    // Hover enter
    link.addEventListener('mouseenter', () => {
      // Reset other links first
      elements.navLinks.forEach(otherLink => {
        if (otherLink !== link) {
          resetLinkState(otherLink);
        }
      });

      state.isHovering = true;
      state.currentLink = link;

      // Update cursor image source
      if (imgSrc && elements.cursorImg) {
        elements.cursorImg.src = imgSrc;
      }

      // Animate arrows in
      const arrows = link.querySelectorAll('.hero__nav-arrow');
      gsap.killTweensOf(arrows);
      gsap.to(arrows, {
        opacity: 1,
        x: 0,
        duration: 0.4,
        ease: 'power3.out'
      });

      // Show cursor image
      gsap.killTweensOf(elements.cursorImage);
      gsap.to(elements.cursorImage, {
        opacity: 1,
        scale: config.cursor.scaleOnHover,
        duration: 0.4,
        ease: 'power3.out'
      });
    });

    // Hover leave
    link.addEventListener('mouseleave', () => {
      resetLinkState(link);

      // Hide cursor image
      gsap.killTweensOf(elements.cursorImage);
      gsap.to(elements.cursorImage, {
        opacity: 0,
        scale: config.cursor.scaleOnLeave,
        duration: 0.3,
        ease: 'power2.in'
      });

      state.isHovering = false;
      state.currentLink = null;
    });
  });
}

// Reset a single link's hover state
function resetLinkState(link) {
  const arrows = link.querySelectorAll('.hero__nav-arrow');
  const maskedText = link.querySelector('.masked-text');

  // Reset masked text immediately
  if (maskedText) {
    maskedText.style.clipPath = 'inset(100%)';
  }

  // Animate arrows out
  gsap.killTweensOf(arrows);
  gsap.to(arrows, {
    opacity: 0,
    x: '-0.5em',
    duration: 0.3,
    ease: 'power2.in'
  });
}

// Reset all links and cursor
function resetAllHoverStates() {
  state.isHovering = false;
  state.currentLink = null;

  elements.navLinks.forEach(link => resetLinkState(link));

  // Hide cursor image
  gsap.killTweensOf(elements.cursorImage);
  gsap.to(elements.cursorImage, {
    opacity: 0,
    scale: config.cursor.scaleOnLeave,
    duration: 0.3,
    ease: 'power2.in'
  });
}

// ============================================
// Mouse Tracking
// ============================================
function setupMouseTracking() {
  document.addEventListener('mousemove', (e) => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
  });
}

// ============================================
// Render Loop
// Smooth cursor following + text masking
// ============================================
function startRenderLoop() {
  function render() {
    // Smooth cursor follow
    state.cursorTarget.x += (state.mouse.x - state.cursorTarget.x) * config.cursor.smoothing;
    state.cursorTarget.y += (state.mouse.y - state.cursorTarget.y) * config.cursor.smoothing;

    // Update cursor image position (centered on cursor)
    gsap.set(elements.cursorImage, {
      x: state.cursorTarget.x,
      y: state.cursorTarget.y,
      xPercent: -50,
      yPercent: -50
    });

    // Update text masking based on cursor position
    if (state.isHovering) {
      updateTextMasking();
    }

    state.rafId = requestAnimationFrame(render);
  }

  render();
}

// ============================================
// Text Masking Effect
// Creates white text where cursor image overlaps
// Uses rectangle matching the hover image bounds
// ============================================
function updateTextMasking() {
  const cursorRect = elements.cursorImage.getBoundingClientRect();

  // Get the actual image bounds (centered on cursor position)
  const imgWidth = cursorRect.width;
  const imgHeight = cursorRect.height;
  const imgLeft = state.cursorTarget.x - imgWidth / 2;
  const imgTop = state.cursorTarget.y - imgHeight / 2;
  const imgRight = imgLeft + imgWidth;
  const imgBottom = imgTop + imgHeight;

  elements.navLinks.forEach(link => {
    const maskedText = link.querySelector('.masked-text');
    if (!maskedText) return;

    // Only apply masking to the currently hovered link
    if (link !== state.currentLink) {
      maskedText.style.clipPath = 'inset(100%)';
      return;
    }

    const linkRect = link.getBoundingClientRect();

    // Calculate the image rectangle relative to the link
    const relLeft = imgLeft - linkRect.left;
    const relTop = imgTop - linkRect.top;
    const relRight = imgRight - linkRect.left;
    const relBottom = imgBottom - linkRect.top;

    // Convert to inset values (from each edge)
    const insetTop = Math.max(0, relTop);
    const insetRight = Math.max(0, linkRect.width - relRight);
    const insetBottom = Math.max(0, linkRect.height - relBottom);
    const insetLeft = Math.max(0, relLeft);

    // Apply rectangular clip-path matching image bounds
    maskedText.style.clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`;
  });
}

// ============================================
// Cleanup
// ============================================
function destroy() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
  }
  ScrollTrigger.getAll().forEach(st => st.kill());
}

// ============================================
// Start
// ============================================
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', destroy);
