/**
 * Calendar Component
 * Fully functional date range picker with 2-month display
 */

(function() {
  'use strict';

  // Fallback month names (German)
  const MONTHS_SHORT_FALLBACK = [
    'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
    'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'
  ];

  const MONTHS_FULL_FALLBACK = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // Get localized month names from i18n system
  function getMonthsFull() {
    if (window.i18n) {
      const monthsStr = window.i18n.getTranslation('calendar.months');
      if (monthsStr && monthsStr !== 'calendar.months') {
        return monthsStr.split(',');
      }
    }
    return MONTHS_FULL_FALLBACK;
  }

  function getMonthsShort() {
    if (window.i18n) {
      const monthsStr = window.i18n.getTranslation('calendar.months_short');
      if (monthsStr && monthsStr !== 'calendar.months_short') {
        return monthsStr.split(',');
      }
    }
    return MONTHS_SHORT_FALLBACK;
  }

  class Calendar {
    constructor(container) {
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

      this.init();
    }

    init() {
      this.render();
      this.updateDisplay();
      this.bindEvents();
    }

    render() {
      // Render current month and next month
      this.renderMonth(this.grids[0], this.currentMonth);

      const nextMonth = new Date(this.currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      this.renderMonth(this.grids[1], nextMonth);
    }

    renderMonth(grid, monthDate) {
      if (!grid) return;

      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      // Get first day of month and total days
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const totalDays = lastDay.getDate();

      // Get day of week for first day (adjust for Monday start)
      let startDayOfWeek = firstDay.getDay() - 1;
      if (startDayOfWeek < 0) startDayOfWeek = 6;

      let html = '';

      // Empty cells for days before month starts
      for (let i = 0; i < startDayOfWeek; i++) {
        html += '<div class="calendar__day calendar__day--empty"></div>';
      }

      // Days of month
      for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const classes = ['calendar__day'];

        // Check if past
        if (date < this.today) {
          classes.push('calendar__day--disabled');
        }

        // Check if today
        if (date.getTime() === this.today.getTime()) {
          classes.push('calendar__day--today');
        }

        // Check if weekend
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          classes.push('calendar__day--weekend');
        }

        // Check if selected or in range
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

        html += `<div class="${classes.join(' ')}" data-date="${date.toISOString()}">${day}</div>`;
      }

      // Fill remaining cells to complete 6 rows (42 total cells)
      const totalCells = startDayOfWeek + totalDays;
      const remainingCells = 42 - totalCells;
      for (let i = 0; i < remainingCells; i++) {
        html += '<div class="calendar__day calendar__day--empty"></div>';
      }

      grid.innerHTML = html;
    }

    bindEvents() {
      // Day click for both grids
      this.grids.forEach(grid => {
        if (grid) {
          grid.addEventListener('click', (e) => {
            const dayEl = e.target.closest('.calendar__day');
            if (!dayEl || dayEl.classList.contains('calendar__day--disabled') || dayEl.classList.contains('calendar__day--empty')) {
              return;
            }

            const date = new Date(dayEl.dataset.date);
            this.selectDate(date);
          });
        }
      });

      // Month navigation
      if (this.prevBtn) {
        this.prevBtn.addEventListener('click', () => this.changeMonth(-1));
      }
      if (this.nextBtn) {
        this.nextBtn.addEventListener('click', () => this.changeMonth(1));
      }
    }

    changeMonth(delta) {
      this.currentMonth.setMonth(this.currentMonth.getMonth() + delta);
      this.render();
      this.updateDisplay();
    }

    selectDate(date) {
      // If no start date, or both dates are set, start fresh
      if (!this.startDate || (this.startDate && this.endDate)) {
        this.startDate = date;
        this.endDate = null;
      }
      // If start date exists but no end, set end date
      else if (this.startDate && !this.endDate) {
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
    }

    updateDisplay() {
      if (!this.display) return;

      const monthsShort = getMonthsShort();
      const monthsFull = getMonthsFull();

      if (this.startDate && this.endDate) {
        const startStr = `${this.startDate.getDate()}. ${monthsShort[this.startDate.getMonth()]}`;
        const endStr = `${this.endDate.getDate()}. ${monthsShort[this.endDate.getMonth()]}`;
        this.display.textContent = `${startStr} → ${endStr}`;
        this.container.classList.add('has-selection');
      } else if (this.startDate) {
        const startStr = `${this.startDate.getDate()}. ${monthsShort[this.startDate.getMonth()]}`;
        this.display.textContent = `${startStr} → ...`;
        this.container.classList.add('has-selection');
      } else {
        // Show current month range
        const month1 = monthsFull[this.currentMonth.getMonth()];
        const nextMonth = new Date(this.currentMonth);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const month2 = monthsFull[nextMonth.getMonth()];
        this.display.textContent = `${month1} / ${month2}`;
        this.container.classList.remove('has-selection');
      }
    }

    updateInputs() {
      if (this.startInput) {
        this.startInput.value = this.startDate ? this.formatDate(this.startDate) : '';
      }
      if (this.endInput) {
        this.endInput.value = this.endDate ? this.formatDate(this.endDate) : '';
      }

      // Dispatch change event for form
      document.dispatchEvent(new CustomEvent('calendar:change', {
        bubbles: true,
        detail: {
          startDate: this.startDate,
          endDate: this.endDate
        }
      }));
    }

    formatDate(date) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${year}-${month}-${day}`;
    }
  }

  // Initialize all calendars on page
  function initCalendars() {
    const calendars = document.querySelectorAll('[data-calendar]');
    calendars.forEach(container => {
      new Calendar(container);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendars);
  } else {
    initCalendars();
  }

  // Listen for language changes and re-render calendars
  window.addEventListener('languageChanged', () => {
    document.querySelectorAll('[data-calendar]').forEach(el => {
      const calendar = el._calendarInstance;
      if (calendar) {
        calendar.render();
        calendar.updateDisplay();
      }
    });
  });
})();
