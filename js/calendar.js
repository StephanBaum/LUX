/**
 * Calendar Component
 * Fully functional date range picker
 */

(function() {
  'use strict';

  const MONTHS_DE = [
    'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
    'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'
  ];

  class Calendar {
    constructor(container) {
      this.container = container;
      this.grid = container.querySelector('[data-calendar-grid]');
      this.rangeDisplay = container.querySelector('[data-calendar-range]');
      this.startInput = container.querySelector('[data-calendar-start]');
      this.endInput = container.querySelector('[data-calendar-end]');

      this.startDate = null;
      this.endDate = null;
      this.currentMonth = new Date();
      this.today = new Date();
      this.today.setHours(0, 0, 0, 0);

      this.init();
    }

    init() {
      this.render();
      this.bindEvents();
    }

    render() {
      const year = this.currentMonth.getFullYear();
      const month = this.currentMonth.getMonth();

      // Get first day of month and total days
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const totalDays = lastDay.getDate();

      // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
      // Adjust for Monday start (0 = Monday, 6 = Sunday)
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

        // Check if weekend (Saturday = 6, Sunday = 0)
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

      this.grid.innerHTML = html;
    }

    bindEvents() {
      this.grid.addEventListener('click', (e) => {
        const dayEl = e.target.closest('.calendar__day');
        if (!dayEl || dayEl.classList.contains('calendar__day--disabled') || dayEl.classList.contains('calendar__day--empty')) {
          return;
        }

        const date = new Date(dayEl.dataset.date);
        this.selectDate(date);
      });
    }

    selectDate(date) {
      // If no start date, or both dates are set, start fresh
      if (!this.startDate || (this.startDate && this.endDate)) {
        this.startDate = date;
        this.endDate = null;
      }
      // If start date exists but no end, set end date
      else if (this.startDate && !this.endDate) {
        // If clicked date is before start date, swap them
        if (date < this.startDate) {
          this.endDate = this.startDate;
          this.startDate = date;
        } else if (date.getTime() === this.startDate.getTime()) {
          // Same date clicked, just keep as single day selection
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
      if (this.startDate && this.endDate) {
        const startStr = `${this.startDate.getDate()} ${MONTHS_DE[this.startDate.getMonth()]}`;
        const endStr = `${this.endDate.getDate()} ${MONTHS_DE[this.endDate.getMonth()]}`;
        this.rangeDisplay.textContent = `${startStr} → ${endStr}`;
      } else if (this.startDate) {
        const startStr = `${this.startDate.getDate()} ${MONTHS_DE[this.startDate.getMonth()]}`;
        this.rangeDisplay.textContent = `${startStr} → ...`;
      } else {
        this.rangeDisplay.textContent = 'Zeitraum wählen';
      }
    }

    updateInputs() {
      if (this.startInput) {
        this.startInput.value = this.startDate ? this.formatDate(this.startDate) : '';
      }
      if (this.endInput) {
        this.endInput.value = this.endDate ? this.formatDate(this.endDate) : '';
      }

      // Dispatch change event for form validation
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

    formatDisplayDate(date) {
      const day = date.getDate();
      const month = MONTHS_DE[date.getMonth()];
      return `${day} ${month}`;
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
})();
