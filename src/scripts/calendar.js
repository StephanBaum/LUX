/**
 * Calendar Component
 * Fully functional date range picker with 2-month display
 */

(function() {
  'use strict';

  // Fallback month names (German)
  var MONTHS_SHORT_FALLBACK = [
    'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
    'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'
  ];

  var MONTHS_FULL_FALLBACK = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // Get localized month names from i18n system
  function getMonthsFull() {
    if (window.i18n) {
      var monthsStr = window.i18n.getTranslation('calendar.months');
      if (monthsStr && monthsStr !== 'calendar.months') {
        return monthsStr.split(',');
      }
    }
    return MONTHS_FULL_FALLBACK;
  }

  function getMonthsShort() {
    if (window.i18n) {
      var monthsStr = window.i18n.getTranslation('calendar.months_short');
      if (monthsStr && monthsStr !== 'calendar.months_short') {
        return monthsStr.split(',');
      }
    }
    return MONTHS_SHORT_FALLBACK;
  }

  function Calendar(container) {
    this.container = container;
    this.grids = [
      container.querySelector('[data-calendar-grid="0"]'),
      container.querySelector('[data-calendar-grid="1"]')
    ];
    this.display = container.querySelector('[data-calendar-display]');
    this.prevBtn = container.querySelector('[data-calendar-prev]');
    this.nextBtn = container.querySelector('[data-calendar-next]');
    this.startInput = container.querySelector('[data-calendar-start]');
    this.endInput = container.querySelector('[data-calendar-end]');

    this.startDate = null;
    this.endDate = null;
    this.currentMonth = new Date();
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);

    // Blocked dates from iCal and from the studio's own programme
    this.blockedRanges = [];

    // The hover card: the element, the day it belongs to, and whether a
    // finger opened it — a tapped card must not close on the next mouseout.
    this.card = null;
    this.cardDay = null;
    this.cardOpenByTap = false;
    this.hideTimer = null;

    // Store instance on container for language change re-rendering
    this.container._calendarInstance = this;

    // Store handlers for cleanup
    this.handlers = {
      gridClick: [],
      card: [],
      dismiss: null,
      prevClick: null,
      nextClick: null
    };

    this.init();
  }

  Calendar.prototype.init = function() {
    this.render();
    this.updateDisplay();
    this.bindEvents();
    this.loadBlockedDates();
  };

  Calendar.prototype.loadBlockedDates = function() {
    var self = this;

    function fetchBlocked() {
      if (window.icalClient) {
        window.icalClient.getBlockedDates().then(function(blockedRanges) {
          self.blockedRanges = blockedRanges;
          self.render();
        });
        return true;
      }
      return false;
    }

    // Try immediately
    if (fetchBlocked()) return;

    // Listen for ical:ready event
    document.addEventListener('ical:ready', function() {
      fetchBlocked();
    }, { once: true });

    // Also poll as fallback (in case event was already fired)
    var attempts = 0;
    var maxAttempts = 20;
    var pollInterval = setInterval(function() {
      attempts++;
      if (fetchBlocked() || attempts >= maxAttempts) {
        clearInterval(pollInterval);
      }
    }, 250);
  };

  /**
   * Every appointment that falls on this day.
   *
   * The hover card needs to know which one, not merely that there is one,
   * so the matching is here and isDateBlocked is the yes/no on top of it.
   */
  Calendar.prototype.rangesOn = function(date) {
    if (!this.blockedRanges || this.blockedRanges.length === 0) {
      return [];
    }

    var checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return this.blockedRanges.filter(function(range) {
      var rangeStart = new Date(range.start);
      rangeStart.setHours(0, 0, 0, 0);

      var rangeEnd = new Date(range.end);
      rangeEnd.setHours(0, 0, 0, 0);

      // For same-day timed events, start and end normalize to the same date
      // In that case, block that single day
      if (rangeStart.getTime() === rangeEnd.getTime()) {
        return checkDate.getTime() === rangeStart.getTime();
      }

      // For multi-day events: end date is EXCLUSIVE (iCal standard)
      // So we check: start <= date < end
      return checkDate >= rangeStart && checkDate < rangeEnd;
    });
  };

  Calendar.prototype.isDateBlocked = function(date) {
    return this.rangesOn(date).length > 0;
  };

  /* ------------------------------------------------ the hover card ------ */

  /** A translated string, or the German the site was written in. */
  function say(key, fallback) {
    if (window.i18n) {
      var translated = window.i18n.getTranslation(key);
      if (translated && translated !== key) return translated;
    }
    return fallback;
  }

  /**
   * What a blocked day says when you point at it.
   *
   * A workshop or an event is the studio's own programme and is already
   * public on its own page, so it is named, pictured and linked. A
   * reservation is somebody else's booking: the server sends nothing but its
   * dates, and all the visitor is told is that the day is taken.
   */
  Calendar.prototype.cardContents = function(ranges) {
    var card = document.createElement('div');
    card.className = 'calendar__card';

    var studio = ranges.filter(function(r) { return r.source === 'studio'; });
    if (studio.length === 0) {
      var plain = document.createElement('p');
      plain.className = 'calendar__card-plain';
      plain.textContent = say('calendar.booked', 'Belegt');
      card.appendChild(plain);
      return card;
    }

    studio.forEach(function(range) {
      var item = document.createElement('div');
      item.className = 'calendar__card-item';

      if (range.image) {
        var img = document.createElement('img');
        img.className = 'calendar__card-image';
        img.src = range.image;
        img.alt = '';
        img.loading = 'lazy';
        item.appendChild(img);
      }

      var title = document.createElement('p');
      title.className = 'calendar__card-title';
      title.textContent = range.summary || say('calendar.booked', 'Belegt');
      item.appendChild(title);

      if (range.href) {
        var link = document.createElement('a');
        link.className = 'calendar__card-link';
        link.href = range.href;
        link.textContent = say('calendar.card_more', 'Mehr erfahren');
        item.appendChild(link);
      }

      card.appendChild(item);
    });

    return card;
  };

  Calendar.prototype.showCard = function(dayEl) {
    var ranges = this.rangesOn(new Date(dayEl.dataset.date));
    if (ranges.length === 0) return;

    this.hideCard(true);

    var card = this.cardContents(ranges);
    this.card = card;
    this.cardDay = dayEl;
    this.container.appendChild(card);

    // Sit under the day, and stay inside the calendar rather than inside the
    // page — the calendar is what the card is positioned against.
    var day = dayEl.getBoundingClientRect();
    var box = this.container.getBoundingClientRect();
    var left = day.left - box.left + day.width / 2 - card.offsetWidth / 2;
    left = Math.max(4, Math.min(left, box.width - card.offsetWidth - 4));
    card.style.left = left + 'px';
    card.style.top = day.bottom - box.top + 6 + 'px';

    // A card that can be clicked has to be reachable by the mouse, so
    // leaving the day does not close it while the pointer is on its way.
    var self = this;
    card.addEventListener('mouseenter', function() { self.cancelHide(); });
    card.addEventListener('mouseleave', function() { self.scheduleHide(); });

    dayEl.classList.add('calendar__day--showing-card');
  };

  Calendar.prototype.cancelHide = function() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  };

  Calendar.prototype.scheduleHide = function() {
    var self = this;
    this.cancelHide();
    this.hideTimer = setTimeout(function() { self.hideCard(); }, 220);
  };

  Calendar.prototype.hideCard = function(immediately) {
    this.cancelHide();
    if (this.cardDay) {
      this.cardDay.classList.remove('calendar__day--showing-card');
      this.cardDay = null;
    }
    if (this.card) {
      this.card.remove();
      this.card = null;
    }
    if (!immediately) this.cardOpenByTap = false;
  };

  Calendar.prototype.cleanup = function() {
    var self = this;
    this.handlers.gridClick.forEach(function(item) {
      item.grid.removeEventListener('click', item.handler);
    });

    /*
     * Astro's view transitions swap the whole body, so a listener left on
     * document outlives the page it belonged to and a card left in the DOM
     * is orphaned. Both go here.
     */
    this.handlers.card.forEach(function(item) {
      item.grid.removeEventListener('mouseover', item.over);
      item.grid.removeEventListener('mouseout', item.out);
      item.grid.removeEventListener('click', item.tap);
    });
    this.handlers.card = [];
    if (this.handlers.dismiss) {
      document.removeEventListener('click', this.handlers.dismiss);
      document.removeEventListener('keydown', this.handlers.dismiss);
      this.handlers.dismiss = null;
    }
    this.hideCard(true);
    if (this.prevBtn && this.handlers.prevClick) {
      this.prevBtn.removeEventListener('click', this.handlers.prevClick);
    }
    if (this.nextBtn && this.handlers.nextClick) {
      this.nextBtn.removeEventListener('click', this.handlers.nextClick);
    }
    this.handlers.gridClick = [];
  };

  Calendar.prototype.render = function() {
    // The day the card belongs to is about to be replaced, so the card goes
    // with it — otherwise it hangs there pointing at nothing.
    this.hideCard(true);

    this.renderMonth(this.grids[0], this.currentMonth);

    var nextMonth = new Date(this.currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    this.renderMonth(this.grids[1], nextMonth);
  };

  Calendar.prototype.renderMonth = function(grid, monthDate) {
    if (!grid) return;

    var year = monthDate.getFullYear();
    var month = monthDate.getMonth();

    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var totalDays = lastDay.getDate();

    var startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    var html = '';
    var self = this;

    for (var i = 0; i < startDayOfWeek; i++) {
      html += '<div class="calendar__day calendar__day--empty"></div>';
    }

    for (var day = 1; day <= totalDays; day++) {
      var date = new Date(year, month, day);
      var classes = ['calendar__day'];

      if (date < this.today) {
        classes.push('calendar__day--disabled');
      }

      // Check if date is blocked by iCal reservation
      if (this.isDateBlocked(date)) {
        classes.push('calendar__day--blocked');
      }

      if (date.getTime() === this.today.getTime()) {
        classes.push('calendar__day--today');
      }

      var dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        classes.push('calendar__day--weekend');
      }

      if (this.startDate && this.endDate) {
        if (date.getTime() === this.startDate.getTime()) {
          classes.push('calendar__day--selected', 'calendar__day--range-start');
        } else if (date.getTime() === this.endDate.getTime()) {
          classes.push('calendar__day--selected', 'calendar__day--range-end');
        } else if (date > this.startDate && date < this.endDate) {
          classes.push('calendar__day--in-range');
        }
      } else if (this.startDate && date.getTime() === this.startDate.getTime()) {
        classes.push('calendar__day--selected', 'calendar__day--range-start', 'calendar__day--range-end');
      }

      html += '<div class="' + classes.join(' ') + '" data-date="' + date.toISOString() + '">' + day + '</div>';
    }

    var totalCells = startDayOfWeek + totalDays;
    var remainingCells = 42 - totalCells;
    for (var j = 0; j < remainingCells; j++) {
      html += '<div class="calendar__day calendar__day--empty"></div>';
    }

    grid.innerHTML = html;
  };

  Calendar.prototype.bindEvents = function() {
    var self = this;

    this.grids.forEach(function(grid) {
      if (grid) {
        var handler = function(e) {
          var dayEl = e.target.closest('.calendar__day');
          if (!dayEl || dayEl.classList.contains('calendar__day--disabled') || dayEl.classList.contains('calendar__day--empty') || dayEl.classList.contains('calendar__day--blocked')) {
            return;
          }

          var date = new Date(dayEl.dataset.date);
          self.selectDate(date);
        };

        grid.addEventListener('click', handler);
        self.handlers.gridClick.push({ grid: grid, handler: handler });

        /*
         * The card. A mouse points at a day; a finger has no hover at all, so
         * a tap on a blocked day opens the card instead of doing nothing.
         */
        var over = function(e) {
          var blocked = e.target.closest('.calendar__day--blocked');
          if (!blocked || blocked === self.cardDay) return;
          self.cancelHide();
          self.showCard(blocked);
        };
        var out = function(e) {
          if (self.cardOpenByTap) return;
          if (e.target.closest('.calendar__day--blocked')) self.scheduleHide();
        };
        var tap = function(e) {
          var blocked = e.target.closest('.calendar__day--blocked');
          if (!blocked) return;
          if (self.cardDay === blocked) {
            self.hideCard();
          } else {
            self.cardOpenByTap = true;
            self.showCard(blocked);
          }
        };

        grid.addEventListener('mouseover', over);
        grid.addEventListener('mouseout', out);
        grid.addEventListener('click', tap);
        self.handlers.card.push({ grid: grid, over: over, out: out, tap: tap });
      }
    });

    // A tap anywhere else, or Escape, puts the card away.
    this.handlers.dismiss = function(e) {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'click' && self.container.contains(e.target)) return;
      self.hideCard();
    };
    document.addEventListener('click', this.handlers.dismiss);
    document.addEventListener('keydown', this.handlers.dismiss);

    if (this.prevBtn) {
      this.handlers.prevClick = function() { self.changeMonth(-1); };
      this.prevBtn.addEventListener('click', this.handlers.prevClick);
    }
    if (this.nextBtn) {
      this.handlers.nextClick = function() { self.changeMonth(1); };
      this.nextBtn.addEventListener('click', this.handlers.nextClick);
    }
  };

  Calendar.prototype.changeMonth = function(delta) {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + delta);
    this.render();
    this.updateDisplay();
  };

  Calendar.prototype.selectDate = function(date) {
    if (!this.startDate || (this.startDate && this.endDate)) {
      this.startDate = date;
      this.endDate = null;
      this.hideBlockedWarning();
    } else if (this.startDate && !this.endDate) {
      if (date < this.startDate) {
        this.endDate = this.startDate;
        this.startDate = date;
      } else if (date.getTime() === this.startDate.getTime()) {
        this.endDate = date;
      } else {
        this.endDate = date;
      }
      // Check for overlap with blocked dates
      this.checkBlockedOverlap();
    }

    this.updateDisplay();
    this.updateInputs();
    this.render();
  };

  Calendar.prototype.checkBlockedOverlap = function() {
    if (!this.startDate || !this.endDate || !this.blockedRanges || this.blockedRanges.length === 0) {
      this.hideBlockedWarning();
      return;
    }

    var start = new Date(this.startDate);
    var end = new Date(this.endDate);
    var hasOverlap = false;

    // Check each day in the selected range
    var current = new Date(start);
    while (current <= end) {
      if (this.isDateBlocked(current)) {
        hasOverlap = true;
        break;
      }
      current.setDate(current.getDate() + 1);
    }

    if (hasOverlap) {
      this.showBlockedWarning();
    } else {
      this.hideBlockedWarning();
    }
  };

  Calendar.prototype.showBlockedWarning = function() {
    var hint = this.container.querySelector('.calendar__hint');
    var warning = this.container.querySelector('.calendar__warning');

    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'calendar__warning';
      warning.setAttribute('data-i18n', 'calendar.blocked_warning');

      // Get translated text if i18n is available
      var text = 'Der gewählte Zeitraum enthält bereits belegte Tage.';
      if (window.i18n) {
        var translated = window.i18n.getTranslation('calendar.blocked_warning');
        if (translated && translated !== 'calendar.blocked_warning') {
          text = translated;
        }
      }
      warning.textContent = text;

      if (hint) {
        hint.parentNode.insertBefore(warning, hint.nextSibling);
      } else {
        this.container.appendChild(warning);
      }
    }
    warning.style.display = 'block';
  };

  Calendar.prototype.hideBlockedWarning = function() {
    var warning = this.container.querySelector('.calendar__warning');
    if (warning) {
      warning.style.display = 'none';
    }
  };

  Calendar.prototype.updateDisplay = function() {
    if (!this.display) return;

    var monthsShort = getMonthsShort();
    var monthsFull = getMonthsFull();

    if (this.startDate && this.endDate) {
      var startStr = this.startDate.getDate() + '. ' + monthsShort[this.startDate.getMonth()];
      var endStr = this.endDate.getDate() + '. ' + monthsShort[this.endDate.getMonth()];
      this.display.textContent = startStr + ' → ' + endStr;
      this.container.classList.add('has-selection');
    } else if (this.startDate) {
      var startStr2 = this.startDate.getDate() + '. ' + monthsShort[this.startDate.getMonth()];
      this.display.textContent = startStr2 + ' → ...';
      this.container.classList.add('has-selection');
    } else {
      var month1 = monthsFull[this.currentMonth.getMonth()];
      var nextMonth = new Date(this.currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      var month2 = monthsFull[nextMonth.getMonth()];
      this.display.textContent = month1 + ' / ' + month2;
      this.container.classList.remove('has-selection');
    }
  };

  Calendar.prototype.updateInputs = function() {
    if (this.startInput) {
      this.startInput.value = this.startDate ? this.formatDate(this.startDate) : '';
    }
    if (this.endInput) {
      this.endInput.value = this.endDate ? this.formatDate(this.endDate) : '';
    }

    document.dispatchEvent(new CustomEvent('calendar:change', {
      bubbles: true,
      detail: {
        startDate: this.startDate,
        endDate: this.endDate
      }
    }));
  };

  Calendar.prototype.formatDate = function(date) {
    var day = String(date.getDate()).padStart(2, '0');
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var year = date.getFullYear();
    return year + '-' + month + '-' + day;
  };

  // Track instances for cleanup
  var instances = [];

  function initCalendars() {
    // Cleanup previous instances
    instances.forEach(function(instance) {
      instance.cleanup();
    });
    instances = [];

    var calendars = document.querySelectorAll('[data-calendar]');
    calendars.forEach(function(container) {
      var calendar = new Calendar(container);
      instances.push(calendar);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendars);
  } else {
    initCalendars();
  }

  // Re-initialize after View Transitions page swap
  document.addEventListener('astro:page-load', initCalendars);

  // Listen for language changes and re-render calendars
  window.addEventListener('languageChanged', function() {
    document.querySelectorAll('[data-calendar]').forEach(function(el) {
      var calendar = el._calendarInstance;
      if (calendar) {
        calendar.render();
        calendar.updateDisplay();
      }
    });
  });
})();
