/**
 * Scroll Animations
 * GSAP-powered animations with parallax and text reveal
 */

(function() {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Register ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  // Consistent trigger point for all animations
  const TRIGGER_START = 'top 92%';
  const TRIGGER_END = 'bottom 8%';

  /**
   * Section Parallax
   * Elements move UP as you scroll DOWN (opposite to scroll direction)
   * Subtle floating effect - starts below, ends above natural position
   */
  function initParallax() {
    const sections = document.querySelectorAll('[data-parallax]');

    sections.forEach(section => {
      const speed = parseFloat(section.dataset.parallax) || 0.1;
      const distance = 50 * speed; // Subtle movement

      // Start slightly down, end slightly up
      gsap.fromTo(section,
        { y: distance },
        {
          y: -distance,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.5 // Smooth lag
          }
        }
      );
    });
  }

  /**
   * Fade Up Animation
   * Simple fade + translate up, consistent timing
   */
  function initFadeUp() {
    const elements = document.querySelectorAll('[data-animate="fade-up"]');

    elements.forEach(el => {
      // Skip elements inside footer (handled separately)
      if (el.closest('[data-footer-reveal]')) return;

      gsap.set(el, { opacity: 0, y: 40 });

      // Check if element is already in view
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.92;

      if (inView) {
        // Animate immediately if already visible
        gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.1 });
      }

      ScrollTrigger.create({
        trigger: el,
        start: TRIGGER_START,
        end: TRIGGER_END,
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }),
        onLeave: () => gsap.to(el, { opacity: 0, y: -30, duration: 0.5, ease: 'power2.in' }),
        onEnterBack: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }),
        onLeaveBack: () => gsap.to(el, { opacity: 0, y: 40, duration: 0.5, ease: 'power2.in' })
      });
    });
  }

  /**
   * Text Write-On Animation
   * Lines reveal from bottom, creating a write-on effect
   * Use only for large text blocks (full-width-copy, CTA)
   */
  function initTextReveal() {
    const elements = document.querySelectorAll('[data-animate="text-reveal"]');

    elements.forEach(el => {
      const text = el.innerHTML;
      const words = text.split(' ');

      // Wrap words to detect line breaks
      el.innerHTML = words.map(word => `<span class="word">${word}</span>`).join(' ');

      requestAnimationFrame(() => {
        const wordSpans = el.querySelectorAll('.word');
        let currentLine = [];
        let lines = [];
        let lastTop = null;

        wordSpans.forEach((word) => {
          const top = word.getBoundingClientRect().top;
          if (lastTop !== null && top !== lastTop) {
            lines.push(currentLine);
            currentLine = [];
          }
          currentLine.push(word);
          lastTop = top;
        });
        if (currentLine.length) lines.push(currentLine);

        // Rebuild with line wrappers
        el.innerHTML = lines.map(line => {
          const lineText = line.map(w => w.textContent).join(' ');
          return `<span class="line"><span class="line-inner">${lineText}</span></span>`;
        }).join(' ');

        const lineInners = el.querySelectorAll('.line-inner');

        gsap.set(lineInners, { y: '100%' });

        // Check if element is already in view
        const rect = el.getBoundingClientRect();
        const inView = rect.top < window.innerHeight * 0.92;

        if (inView) {
          gsap.to(lineInners, {
            y: '0%',
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.06,
            delay: 0.2
          });
        }

        ScrollTrigger.create({
          trigger: el,
          start: TRIGGER_START,
          end: TRIGGER_END,
          onEnter: () => {
            gsap.to(lineInners, {
              y: '0%',
              duration: 0.7,
              ease: 'power3.out',
              stagger: 0.06
            });
          },
          onLeave: () => {
            gsap.to(lineInners, {
              y: '-100%',
              duration: 0.4,
              ease: 'power2.in',
              stagger: 0.02
            });
          },
          onEnterBack: () => {
            gsap.to(lineInners, {
              y: '0%',
              duration: 0.7,
              ease: 'power3.out',
              stagger: 0.06
            });
          },
          onLeaveBack: () => {
            gsap.to(lineInners, {
              y: '100%',
              duration: 0.4,
              ease: 'power2.in',
              stagger: 0.02
            });
          }
        });
      });
    });
  }

  /**
   * Footer Reveal
   * Background slides up first, then content fades in
   */
  function initFooterReveal() {
    const footer = document.querySelector('[data-footer-reveal]');
    if (!footer) return;

    // Get all animated elements inside footer
    const footerElements = footer.querySelectorAll('[data-animate="fade-up"]');

    // Set initial states
    gsap.set(footer, { clipPath: 'inset(100% 0 0 0)' });
    gsap.set(footerElements, { opacity: 0, y: 30 });

    ScrollTrigger.create({
      trigger: footer,
      start: 'top 90%',
      onEnter: () => {
        // Timeline for sequential animation
        const tl = gsap.timeline();

        // First: reveal background
        tl.to(footer, {
          clipPath: 'inset(0% 0 0 0)',
          duration: 1,
          ease: 'power3.out'
        });

        // Then: fade in elements
        tl.to(footerElements, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          stagger: 0.08
        }, '-=0.3'); // Slight overlap
      }
    });
  }

  /**
   * Initialize all animations
   */
  function init() {
    initParallax();
    initFadeUp();
    initTextReveal();
    initFooterReveal();

    // Refresh after all triggers created and handle already-visible elements
    ScrollTrigger.refresh();
  }

  /**
   * Wait for i18n to be ready before initializing
   * i18n.js sets data-i18n-ready attribute when translations are applied
   */
  function waitForI18nAndInit() {
    // Wait for fonts to load (important for text-reveal line detection)
    const initAfterFonts = () => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(init);
      } else {
        setTimeout(init, 100);
      }
    };

    // Check if i18n is already ready
    if (document.documentElement.hasAttribute('data-i18n-ready')) {
      initAfterFonts();
    } else {
      // Wait for i18n to be ready
      const observer = new MutationObserver((mutations, obs) => {
        if (document.documentElement.hasAttribute('data-i18n-ready')) {
          obs.disconnect();
          initAfterFonts();
        }
      });
      observer.observe(document.documentElement, { attributes: true });

      // Fallback timeout in case i18n fails to load
      setTimeout(() => {
        observer.disconnect();
        if (!document.documentElement.hasAttribute('data-i18n-ready')) {
          initAfterFonts();
        }
      }, 2000);
    }
  }

  /**
   * Re-initialize text-reveal after language change
   */
  function reinitTextReveal() {
    // Kill existing text-reveal ScrollTriggers
    ScrollTrigger.getAll().forEach(trigger => {
      const el = trigger.trigger;
      if (el && el.hasAttribute && el.hasAttribute('data-animate') &&
          el.getAttribute('data-animate') === 'text-reveal') {
        trigger.kill();
      }
    });

    // Wait a frame for DOM to update, then reinitialize
    requestAnimationFrame(() => {
      initTextReveal();
      ScrollTrigger.refresh();
    });
  }

  // Listen for language changes from i18n.js
  window.addEventListener('languageChanged', reinitTextReveal);

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForI18nAndInit);
  } else {
    waitForI18nAndInit();
  }
})();
