/**
 * Lightbox for the galleries and sliders.
 *
 * The picture grows out of the thumbnail it was clicked on rather than cutting
 * to a full-screen view, and the page behind it darkens, blurs and drifts a
 * little with the pointer. Any image carrying `data-lightbox="<group>"` opens;
 * arrow keys and swipe move between the images of that group.
 *
 * Clicks are handled on the document, so the copies the endless sliders create
 * work too: a copy opens where it sits, and stepping moves to the slide next
 * to it. On closing, the picture shrinks into whichever copy of it sits
 * closest to the middle of the screen, so it never flies off to an edge — the
 * slider itself is left alone, since it keeps its own looping position.
 */
(function () {
  'use strict';

  var SWIPE_THRESHOLD = 50;
  // Pointer movement beyond this is a slider drag, not a click on the image.
  var DRAG_TOLERANCE = 8;
  var OPEN_MS = 520;
  var CLOSE_MS = 380;
  var SWITCH_MS = 380;
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var overlay = null;
  var figure = null;
  var overlayImage = null;
  var counter = null;
  var group = [];
  var index = 0;
  var lastFocused = null;
  var touchStartX = 0;
  var animation = null;
  var source = null;
  var menuToggle = null;
  var originals = [];

  // ------------------------------------------------------------------ dom --

  function build() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Bildansicht');
    overlay.hidden = true;

    overlay.innerHTML =
      '<div class="lightbox__scrim"></div>' +
      // Two bars, like the menu button, drawn the same way and rotated into an X.
      '<button class="lightbox__close" type="button" aria-label="Schließen">' +
      '<span class="lightbox__close-line"></span><span class="lightbox__close-line"></span>' +
      '</button>' +
      '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Vorheriges Bild">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 19L8 12L15 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<figure class="lightbox__figure"><img class="lightbox__image" alt=""></figure>' +
      '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Nächstes Bild">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<p class="lightbox__counter" aria-live="polite"></p>';

    document.body.appendChild(overlay);

    figure = overlay.querySelector('.lightbox__figure');
    overlayImage = overlay.querySelector('.lightbox__image');
    counter = overlay.querySelector('.lightbox__counter');

    overlay.querySelector('.lightbox__close').addEventListener('click', close);
    overlay.querySelector('.lightbox__nav--prev').addEventListener('click', function () { step(-1); });
    overlay.querySelector('.lightbox__nav--next').addEventListener('click', function () { step(1); });

    // A click on the backdrop closes; a click on the picture itself does not.
    overlay.addEventListener('click', function (event) {
      if (event.target === overlayImage) return;
      if (event.target.closest('.lightbox__close, .lightbox__nav')) return;
      close();
    });

    overlay.addEventListener('touchstart', function (event) {
      touchStartX = event.changedTouches[0].clientX;
    }, {passive: true});

    overlay.addEventListener('touchend', function (event) {
      var delta = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > SWIPE_THRESHOLD) step(delta < 0 ? 1 : -1);
    }, {passive: true});

    document.addEventListener('keydown', onKeydown);

    /*
     * The header's menu button doubles as the close button while the view is
     * open: same place, same two bars turning into an X as the menu does.
     */
    document.addEventListener('click', function (event) {
      if (overlay.hidden) return;
      if (!event.target.closest || !event.target.closest('.header__menu-toggle')) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }, true);
  }

  // --------------------------------------------------------------- groups --

  /** The sliders clone their slides for the endless loop. */
  function isClone(el) {
    return !!el.closest('[aria-hidden="true"]');
  }

  function fullSrc(el) {
    return el.getAttribute('data-lightbox-src') || el.getAttribute('src');
  }

  /**
   * Every image of the group in document order, copies included. Stepping
   * moves to the physically next slide, so the slider behind creeps forward
   * instead of rewinding to the first copy of the picture.
   */
  function membersOf(name) {
    return Array.prototype.slice.call(
      document.querySelectorAll('[data-lightbox="' + name + '"]'),
    );
  }

  /** The distinct pictures, for the counter. */
  function originalsOf(name) {
    return membersOf(name).filter(function (el) { return !isClone(el); });
  }

  /**
   * A copy shows the same picture as the slide it came from, so match on the
   * image source to find which of the distinct pictures it is.
   */
  function positionOf(el, originals) {
    var src = fullSrc(el);
    for (var i = 0; i < originals.length; i++) {
      if (fullSrc(originals[i]) === src) return i;
    }
    return 0;
  }

  // ------------------------------------------------------------ animation --

  /**
   * Where an image is actually painted. `object-fit` means the element's box
   * and the visible picture are not the same rectangle: a thumbnail crops
   * (cover) while the lightbox letterboxes (contain). Measuring the painted
   * area makes both ends of the animation describe the same picture, so it
   * scales evenly instead of stretching.
   */
  function paintedRect(el) {
    var box = el.getBoundingClientRect();
    var nw = el.naturalWidth;
    var nh = el.naturalHeight;
    if (!nw || !nh || !box.width || !box.height) return box;

    var ratioW = box.width / nw;
    var ratioH = box.height / nh;
    var scale = getComputedStyle(el).objectFit === 'contain'
      ? Math.min(ratioW, ratioH)
      : Math.max(ratioW, ratioH);

    var width = nw * scale;
    var height = nh * scale;
    return {
      left: box.left + (box.width - width) / 2,
      top: box.top + (box.height - height) / 2,
      width: width,
      height: height,
    };
  }

  /**
   * The crop the thumbnail applies, as insets on the whole picture. Without
   * this the closing animation ends on the full picture and the thumbnail
   * clips it away in one frame, which reads as a jump.
   */
  function cropInset(el) {
    var painted = paintedRect(el);
    var box = el.getBoundingClientRect();
    if (!painted.width || !painted.height) return 'inset(0%)';

    var pct = function (value, total) {
      return Math.max(0, Math.min(50, (value / total) * 100)).toFixed(3) + '%';
    };

    return 'inset(' +
      pct(box.top - painted.top, painted.height) + ' ' +
      pct(painted.left + painted.width - (box.left + box.width), painted.width) + ' ' +
      pct(painted.top + painted.height - (box.top + box.height), painted.height) + ' ' +
      pct(box.left - painted.left, painted.width) + ')';
  }

  /** Grow the picture out of the thumbnail it was opened from. */
  function flip(from, reverse) {
    if (reduceMotion || !from || !overlayImage.naturalWidth) return null;

    var start = paintedRect(from);
    if (!start.width || !start.height) return null;

    var end = paintedRect(overlayImage);
    if (!end.width || !end.height) return null;

    var transform =
      'translate(' +
      (start.left + start.width / 2 - (end.left + end.width / 2)) + 'px, ' +
      (start.top + start.height / 2 - (end.top + end.height / 2)) + 'px) ' +
      // Both rectangles describe the same picture, so one factor is enough.
      'scale(' + start.width / end.width + ')';

    // No fade: the picture must read as the same one growing, not a new one.
    var frames = [
      {transform: transform, clipPath: cropInset(from)},
      {transform: 'none', clipPath: 'inset(0%)'},
    ];

    return overlayImage.animate(reverse ? frames.slice().reverse() : frames, {
      duration: reverse ? CLOSE_MS : OPEN_MS,
      easing: EASE,
      fill: 'both',
    });
  }

  // ------------------------------------------------------------- rendering --

  /** The picture's proportions drive its size, so nothing is letterboxed. */
  function setRatio(image) {
    if (image.naturalWidth && image.naturalHeight) {
      overlayImage.style.setProperty('--ar', image.naturalWidth / image.naturalHeight);
    }
  }

  /** Show the thumbnail first so the animation can start at once, then sharpen. */
  function show(from) {
    var el = group[index];
    var small = from && from.getAttribute('src');
    var large = fullSrc(el);

    overlayImage.alt = el.getAttribute('alt') || '';
    // Counted over the distinct pictures, never over the slider's copies.
    counter.textContent = originals.length > 1
      ? positionOf(el, originals) + 1 + ' / ' + originals.length
      : '';
    overlay.classList.toggle('lightbox--single', originals.length < 2);

    if (from) setRatio(from);
    if (small && small !== overlayImage.src) overlayImage.src = small;
    if (!small) overlayImage.src = large;
    overlayImage.addEventListener('load', function () { setRatio(overlayImage); }, {once: true});

    if (large && large !== overlayImage.src) {
      var sharp = new Image();
      sharp.onload = function () {
        if (!overlay.hidden && group[index] === el) overlayImage.src = large;
      };
      sharp.src = large;
    }
  }

  function step(direction) {
    if (group.length < 2) return;

    var previous = group[index];
    index = (index + direction + group.length) % group.length;
    var next = group[index];

    // Cancel outright rather than chaining off an animation's finish event:
    // a cancelled or replaced animation never fires it, and the picture would
    // then be stuck on the old frame.
    overlayImage.getAnimations().forEach(function (a) { a.cancel(); });
    animation = null;

    reveal(previous, false);
    reveal(next, true);
    show(next);

    if (reduceMotion) return;

    animation = overlayImage.animate(
      [
        {transform: 'translateX(' + direction * 56 + 'px)', opacity: 0, filter: 'blur(12px)'},
        {transform: 'none', opacity: 1, filter: 'blur(0px)'},
      ],
      {duration: SWITCH_MS, easing: EASE},
    );
  }

  /** Hide the thumbnail the picture came from, so it never shows twice. */
  function reveal(el, hide) {
    if (!el) return;
    el.style.visibility = hide ? 'hidden' : '';
  }

  // -------------------------------------------------------- open and close --

  function open(clicked) {
    build();

    var name = clicked.getAttribute('data-lightbox');
    var members = membersOf(name);
    if (members.length === 0) return;

    group = members;
    originals = originalsOf(name);
    // Open on the copy that was actually clicked, so nothing jumps.
    index = Math.max(0, members.indexOf(clicked));

    lastFocused = document.activeElement;
    overlay.hidden = false;
    lockScroll();

    overlayImage.getAnimations().forEach(function (a) { a.cancel(); });
    show(clicked);
    source = group[index];
    menuToggle = document.querySelector('.header__menu-toggle');

    var start = function () {
      if (animation) animation.cancel();
      animation = flip(clicked, false);
      // Hidden only once the full-size copy is in place, so nothing blinks.
      reveal(clicked, true);
      reveal(source, true);
    };
    if (overlayImage.complete && overlayImage.naturalWidth) start();
    else overlayImage.addEventListener('load', start, {once: true});

    if (menuToggle) {
      menuToggle.setAttribute('aria-label', 'Bild schließen');
      menuToggle.focus();
    }
  }

  function close() {
    if (!overlay || overlay.hidden) return;

    var target = nearestCopy(group[index]);
    var finish = function () {
      overlay.hidden = true;
      overlay.classList.remove('is-closing');
      overlayImage.removeAttribute('src');
      if (menuToggle) menuToggle.setAttribute('aria-label', 'Menu');
      group.forEach(function (el) { reveal(el, false); });
      reveal(source, false);
      unlockScroll();
      source = null;
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      lastFocused = null;
    };


    if (animation) animation.cancel();
    overlay.classList.add('is-closing');

    // Shrink back into the thumbnail when it is still on screen. It stays
    // hidden until the very end, so the two are never both visible.
    group.forEach(function (el) { reveal(el, el === target); });
    var back = target && isOnScreen(target) ? flip(target, true) : null;
    if (!back) {
      finish();
      return;
    }
    animation = back;
    back.onfinish = finish;
    back.oncancel = finish;
  }

  /**
   * Hiding the page scrollbar would otherwise let the layout jump sideways by
   * its width, both on open and on close.
   */
  function lockScroll() {
    var width = window.innerWidth - document.documentElement.clientWidth;
    if (width > 0) document.body.style.paddingRight = width + 'px';
    document.body.classList.add('has-lightbox');
  }

  function unlockScroll() {
    document.body.classList.remove('has-lightbox');
    document.body.style.paddingRight = '';
  }

  function isOnScreen(el) {
    var rect = el.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth
    );
  }

  /**
   * The endless sliders hold many copies of the same picture, most of them far
   * off to the side. When closing, shrink into the copy nearest the middle of
   * the screen rather than the one that happened to be stepped to.
   */
  function nearestCopy(el) {
    if (!el) return el;

    var src = fullSrc(el);
    var centreX = window.innerWidth / 2;
    var centreY = window.innerHeight / 2;
    var best = null;
    var bestDistance = Infinity;

    group.forEach(function (candidate) {
      if (fullSrc(candidate) !== src || !isOnScreen(candidate)) return;
      var rect = candidate.getBoundingClientRect();
      var distance =
        Math.abs(rect.left + rect.width / 2 - centreX) +
        Math.abs(rect.top + rect.height / 2 - centreY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    });

    return best || el;
  }

  function onKeydown(event) {
    if (!overlay || overlay.hidden) return;

    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowRight') {
      step(1);
    } else if (event.key === 'ArrowLeft') {
      step(-1);
    } else if (event.key === 'Tab') {
      // Keep focus inside the overlay while it is open.
      var focusable = overlay.querySelectorAll('button');
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  // ------------------------------------------------------------ delegation --

  var downX = 0;
  var downY = 0;

  document.addEventListener('pointerdown', function (event) {
    downX = event.clientX;
    downY = event.clientY;
  }, true);

  function onClick(event) {
    if (overlay && !overlay.hidden) return;

    var el = event.target.closest && event.target.closest('[data-lightbox]');
    if (!el) return;

    var moved = Math.abs(event.clientX - downX) + Math.abs(event.clientY - downY);
    if (moved > DRAG_TOLERANCE) return;

    event.preventDefault();
    open(el);
  }

  /*
   * Capture phase: the slider runs on GSAP Draggable, which stops the click
   * from bubbling. Capturing at the document runs before it can.
   */
  document.addEventListener('click', onClick, true);

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    var el = document.activeElement;
    if (!el || !el.matches || !el.matches('[data-lightbox]')) return;
    event.preventDefault();
    open(el);
  });

  /** Only the real images are reachable by keyboard; the clones are decoration. */
  function init() {
    /*
     * Astro's view transitions swap the whole <body>, which takes the overlay
     * with it. The element then still exists in this closure but is detached,
     * so `build()` skips creating a new one and every open happens off-screen.
     * Putting it back keeps its listeners.
     */
    if (overlay && !overlay.isConnected) document.body.appendChild(overlay);

    close();
    document.querySelectorAll('[data-lightbox]').forEach(function (el) {
      if (isClone(el)) return;
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');

      // Belt and braces: a listener on the image itself, in case anything
      // between it and the document swallows the event.
      if (el.dataset.lightboxBound) return;
      el.dataset.lightboxBound = 'true';
      el.addEventListener('click', onClick);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('astro:page-load', init);
})();
