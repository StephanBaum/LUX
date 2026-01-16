/**
 * Form Component
 * Fully functional form with validation
 */

(function() {
  'use strict';

  class Form {
    constructor(container) {
      this.form = container;
      this.submitButton = container.querySelector('[data-form-submit]');
      this.dateDisplay = container.querySelector('[data-form-date]');
      this.selectionDisplay = container.querySelector('[data-form-selection]');
      this.fields = container.querySelectorAll('[data-validate]');

      // Find all checkboxes on the page for rooms and equipment
      this.roomCheckboxes = document.querySelectorAll('input[name="room"]');
      this.equipmentCheckboxes = document.querySelectorAll('input[name="equipment"]');

      this.init();
    }

    init() {
      this.bindEvents();
      this.updateSubmitState();
      this.updateSelectionDisplay();
    }

    bindEvents() {
      // Validate on blur
      this.fields.forEach(field => {
        field.addEventListener('blur', () => this.validateField(field));
        field.addEventListener('input', () => {
          // Clear error on input
          if (field.classList.contains('is-invalid')) {
            this.clearFieldError(field);
          }
          this.updateSubmitState();
        });
      });

      // Form submit
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));

      // Listen for calendar changes
      document.addEventListener('calendar:change', (e) => {
        this.updateDateDisplay(e.detail);
      });

      // Listen for checkbox changes
      this.roomCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => this.updateSelectionDisplay());
      });
      this.equipmentCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => this.updateSelectionDisplay());
      });
    }

    validateField(field) {
      const value = field.value.trim();
      const isRequired = field.hasAttribute('required');
      const type = field.getAttribute('type');

      let isValid = true;

      // Required check
      if (isRequired && !value) {
        isValid = false;
      }

      // Email validation
      if (type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          isValid = false;
        }
      }

      if (isValid) {
        this.clearFieldError(field);
      } else {
        this.showFieldError(field);
      }

      return isValid;
    }

    showFieldError(field) {
      field.classList.add('is-invalid');
      const fieldContainer = field.closest('.form__field');
      if (fieldContainer) {
        fieldContainer.classList.add('is-invalid');
      }
    }

    clearFieldError(field) {
      field.classList.remove('is-invalid');
      const fieldContainer = field.closest('.form__field');
      if (fieldContainer) {
        fieldContainer.classList.remove('is-invalid');
      }
    }

    validateAll() {
      let isValid = true;
      this.fields.forEach(field => {
        if (!this.validateField(field)) {
          isValid = false;
        }
      });
      return isValid;
    }

    updateSubmitState() {
      // Check if all required fields have values
      let allFilled = true;
      this.fields.forEach(field => {
        if (field.hasAttribute('required') && !field.value.trim()) {
          allFilled = false;
        }
      });

      if (this.submitButton) {
        this.submitButton.disabled = !allFilled;
      }
    }

    updateDateDisplay(detail) {
      if (this.dateDisplay && detail.startDate && detail.endDate) {
        const startStr = this.formatDisplayDate(detail.startDate);
        const endStr = this.formatDisplayDate(detail.endDate);
        this.dateDisplay.textContent = `${startStr} → ${endStr}`;
      }
    }

    updateSelectionDisplay() {
      if (!this.selectionDisplay) return;

      const selections = [];

      // Get selected rooms
      this.roomCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
          // Get the title from the accordion item
          const item = checkbox.closest('.accordion__item');
          if (item) {
            const title = item.querySelector('.accordion__title');
            if (title) {
              selections.push(title.textContent);
            }
          }
        }
      });

      // Get selected equipment
      this.equipmentCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
          // Get the text from the checkbox label
          const label = checkbox.closest('.checkbox-group__label');
          if (label) {
            const text = label.querySelector('.checkbox-group__text');
            if (text) {
              selections.push(text.textContent);
            }
          }
        }
      });

      // Update display
      if (selections.length > 0) {
        this.selectionDisplay.textContent = selections.join(', ');
      } else {
        this.selectionDisplay.textContent = 'Keine Auswahl';
      }
    }

    formatDisplayDate(date) {
      const MONTHS_DE = [
        'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
        'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'
      ];
      const day = date.getDate();
      const month = MONTHS_DE[date.getMonth()];
      return `${day} ${month}`;
    }

    handleSubmit(e) {
      e.preventDefault();

      if (!this.validateAll()) {
        // Focus first invalid field
        const firstInvalid = this.form.querySelector('.is-invalid');
        if (firstInvalid) {
          firstInvalid.focus();
        }
        return;
      }

      // Collect form data
      const formData = new FormData(this.form);
      const data = Object.fromEntries(formData.entries());

      console.log('Form submitted:', data);

      // Show success state
      this.showSuccess();
    }

    showSuccess() {
      this.form.classList.add('is-success');

      // Animate with GSAP if available
      if (typeof gsap !== 'undefined') {
        const successEl = this.form.querySelector('[data-form-success]');
        if (successEl) {
          gsap.fromTo(successEl,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
          );
        }
      }
    }
  }

  // Initialize all forms on page
  function initForms() {
    const forms = document.querySelectorAll('[data-form]');
    forms.forEach(container => {
      new Form(container);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    initForms();
  }
})();
