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

    // Store instance on container for language change re-rendering
    this.container._calendarInstance = this;

    // Store handlers for cleanup
    this.handlers = {
      gridClick: [],
      prevClick: null,
      nextClick: null
    };

    this.init();
  }

  Calendar.prototype.init = function() {
    this.render();
    this.updateDisplay();
    this.bindEvents();
  };

  Calendar.prototype.cleanup = function() {
    var self = this;
    this.handlers.gridClick.forEach(function(item) {
      item.grid.removeEventListener('click', item.handler);
    });
    if (this.prevBtn && this.handlers.prevClick) {
      this.prevBtn.removeEventListener('click', this.handlers.prevClick);
    }
    if (this.nextBtn && this.handlers.nextClick) {
      this.nextBtn.removeEventListener('click', this.handlers.nextClick);
    }
    this.handlers.gridClick = [];
  };

  Calendar.prototype.render = function() {
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
          if (!dayEl || dayEl.classList.contains('calendar__day--disabled') || dayEl.classList.contains('calendar__day--empty')) {
            return;
          }

          var date = new Date(dayEl.dataset.date);
          self.selectDate(date);
        };

        grid.addEventListener('click', handler);
        self.handlers.gridClick.push({ grid: grid, handler: handler });
      }
    });

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
    } else if (this.startDate && !this.endDate) {
      if (date < this.startDate) {
        this.endDate = this.startDate;
        this.startDate = date;
      } else if (date.getTime() === this.startDate.getTime()) {
        this.endDate = date;
      } else {
        this.endDate = date;
      }
    }

    this.updateDisplay();
    this.updateInputs();
    this.render();
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
