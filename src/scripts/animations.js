/**
 * Scroll Animations
 * GSAP-powered animations with parallax and text reveal
 */

(function() {
  'use strict';

  var cleanup = null;

  function waitForGSAP(callback) {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      callback();
    } else {
      setTimeout(function() { waitForGSAP(callback); }, 50);
    }
  }

  // Check for reduced motion preference
  function shouldAnimate() {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Consistent trigger point for all animations
  var TRIGGER_START = 'top 92%';
  var TRIGGER_END = 'bottom 8%';

  // Track ScrollTriggers created by this module
  var ownScrollTriggers = [];

  /**
   * Section Parallax
   */
  function initParallax() {
    var sections = document.querySelectorAll('[data-parallax]');

    sections.forEach(function(section) {
      var speed = parseFloat(section.dataset.parallax) || 0.1;
      var distance = 50 * speed;

      var tween = gsap.fromTo(section,
        { y: distance },
        {
          y: -distance,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.5
          }
        }
      );
      if (tween.scrollTrigger) ownScrollTriggers.push(tween.scrollTrigger);
    });
  }

  /**
   * Fade Up Animation
   */
  function initFadeUp() {
    var elements = document.querySelectorAll('[data-animate="fade-up"]');

    elements.forEach(function(el) {
      if (el.closest('[data-footer-reveal]')) return;

      var tween = gsap.fromTo(el,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: TRIGGER_START,
            toggleActions: 'play reverse play reverse'
          }
        }
      );
      if (tween.scrollTrigger) ownScrollTriggers.push(tween.scrollTrigger);
    });
  }

  /**
   * Text Write-On Animation
   */
  function initTextReveal() {
    var elements = document.querySelectorAll('[data-animate="text-reveal"]');

    elements.forEach(function(el) {
      // Skip if already processed
      if (el.querySelector('.line-inner')) return;

      var text = el.textContent;
      var words = text.split(' ');

      // Create word spans to measure line breaks
      el.innerHTML = words.map(function(word) { return '<span class="word">' + word + '</span>'; }).join(' ');

      // Measure line breaks synchronously
      var wordSpans = el.querySelectorAll('.word');
      var currentLine = [];
      var lines = [];
      var lastTop = null;

      wordSpans.forEach(function(word) {
        var top = word.getBoundingClientRect().top;
        if (lastTop !== null && top !== lastTop) {
          lines.push(currentLine);
          currentLine = [];
        }
        currentLine.push(word);
        lastTop = top;
      });
      if (currentLine.length) lines.push(currentLine);

      // Build final structure with line wrappers
      el.innerHTML = lines.map(function(line) {
        var lineText = line.map(function(w) { return w.textContent; }).join(' ');
        return '<span class="line"><span class="line-inner">' + lineText + '</span></span>';
      }).join(' ');

      var lineInners = el.querySelectorAll('.line-inner');

      // Use gsap.fromTo like fade-up does
      var tween = gsap.fromTo(lineInners,
        { y: '100%' },
        {
          y: '0%',
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.06,
          scrollTrigger: {
            trigger: el,
            start: TRIGGER_START,
            toggleActions: 'play reverse play reverse'
          }
        }
      );
      if (tween.scrollTrigger) ownScrollTriggers.push(tween.scrollTrigger);
    });
  }

  /**
   * Footer Reveal
   */
  function initFooterReveal() {
    var footer = document.querySelector('[data-footer-reveal]');
    if (!footer) return;

    var footerElements = footer.querySelectorAll('[data-animate="fade-up"]');

    gsap.set(footer, { clipPath: 'inset(100% 0 0 0)' });
    gsap.set(footerElements, { opacity: 0, y: 30 });

    var st = ScrollTrigger.create({
      trigger: footer,
      start: 'top 90%',
      onEnter: function() {
        var tl = gsap.timeline();
        tl.to(footer, { clipPath: 'inset(0% 0 0 0)', duration: 1, ease: 'power3.out' });
        tl.to(footerElements, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08 }, '-=0.3');
      }
    });
    ownScrollTriggers.push(st);
  }

  /**
   * Initialize all animations
   */
  function initAnimations() {
    if (!shouldAnimate()) return;

    // Kill only ScrollTriggers created by this module (preserve hero parallax etc.)
    ownScrollTriggers.forEach(function(st) { st.kill(); });
    ownScrollTriggers = [];

    initParallax();
    initFadeUp();
    initTextReveal();
    initFooterReveal();

    // Initial refresh
    ScrollTrigger.refresh();

    // Delayed refresh to catch elements already in viewport after preloader
    setTimeout(function() {
      ScrollTrigger.refresh(true);
    }, 100);
  }

  /**
   * Wait for i18n to be ready
   */
  function waitForI18nAndInit() {
    var initAfterFonts = function() {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          // Small delay to ensure DOM is fully settled after i18n
          setTimeout(initAnimations, 50);
        });
      } else {
        setTimeout(initAnimations, 150);
      }
    };

    if (document.documentElement.hasAttribute('data-i18n-ready')) {
      initAfterFonts();
    } else {
      var observer = new MutationObserver(function(mutations, obs) {
        if (document.documentElement.hasAttribute('data-i18n-ready')) {
          obs.disconnect();
          initAfterFonts();
        }
      });
      observer.observe(document.documentElement, { attributes: true });

      setTimeout(function() {
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
    // Kill text-reveal ScrollTriggers from our owned list and reset elements
    ownScrollTriggers = ownScrollTriggers.filter(function(trigger) {
      var el = trigger.trigger;
      if (el && el.hasAttribute && el.hasAttribute('data-animate') &&
          el.getAttribute('data-animate') === 'text-reveal') {
        trigger.kill();
        return false;
      }
      return true;
    });

    // Reset text-reveal elements so they can be re-processed
    document.querySelectorAll('[data-animate="text-reveal"]').forEach(function(el) {
      // Get original text from line-inners if they exist
      var lineInners = el.querySelectorAll('.line-inner');
      if (lineInners.length > 0) {
        var originalText = Array.from(lineInners).map(function(line) {
          return line.textContent;
        }).join(' ');
        el.textContent = originalText;
      }
    });

    initTextReveal();
    ScrollTrigger.refresh();
  }

  var hasInitialized = false;

  function init() {
    if (hasInitialized) return;
    hasInitialized = true;
    waitForGSAP(waitForI18nAndInit);
  }

  function initAfterPreloader() {
    // If preloader is showing (first visit), wait for it to complete
    if (document.body.classList.contains('is-loading')) {
      window.addEventListener('preloaderComplete', function() {
        setTimeout(init, 50);
      }, { once: true });
    } else {
      // No preloader (return visit or page already loaded)
      init();
    }
  }

  window.addEventListener('languageChanged', reinitTextReveal);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAfterPreloader);
  } else {
    initAfterPreloader();
  }

  // Re-initialize after View Transitions (preloader doesn't show on these)
  document.addEventListener('astro:page-load', function() {
    hasInitialized = false;
    init();
  });
})();
