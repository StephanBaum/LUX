/**
 * Form Component
 * Fully functional form with validation
 */

(function() {
  'use strict';

  // Track instances for cleanup
  var instances = [];

  function Form(container) {
    this.form = container;
    this.submitButton = container.querySelector('[data-form-submit]');
    this.dateDisplay = container.querySelector('[data-form-date]');
    this.selectionDisplay = container.querySelector('[data-form-selection]');
    this.fields = container.querySelectorAll('[data-validate]');

    // Find all checkboxes on the page for rooms and equipment
    this.roomCheckboxes = document.querySelectorAll('input[name="room"]');
    this.equipmentCheckboxes = document.querySelectorAll('input[name="equipment"]');

    // Store handlers for cleanup
    this.handlers = {
      fieldBlur: [],
      fieldInput: [],
      submit: null,
      calendarChange: null,
      roomChange: [],
      equipmentChange: []
    };

    this.init();
  }

  Form.prototype.init = function() {
    this.bindEvents();
    this.updateSubmitState();
    this.updateSelectionDisplay();
  };

  Form.prototype.cleanup = function() {
    var self = this;

    this.handlers.fieldBlur.forEach(function(item) {
      item.field.removeEventListener('blur', item.handler);
    });
    this.handlers.fieldInput.forEach(function(item) {
      item.field.removeEventListener('input', item.handler);
    });
    if (this.handlers.submit) {
      this.form.removeEventListener('submit', this.handlers.submit);
    }
    if (this.handlers.calendarChange) {
      document.removeEventListener('calendar:change', this.handlers.calendarChange);
    }
    this.handlers.roomChange.forEach(function(item) {
      item.checkbox.removeEventListener('change', item.handler);
    });
    this.handlers.equipmentChange.forEach(function(item) {
      item.checkbox.removeEventListener('change', item.handler);
    });

    this.handlers = {
      fieldBlur: [],
      fieldInput: [],
      submit: null,
      calendarChange: null,
      roomChange: [],
      equipmentChange: []
    };
  };

  Form.prototype.bindEvents = function() {
    var self = this;

    // Validate on blur
    this.fields.forEach(function(field) {
      var blurHandler = function() { self.validateField(field); };
      var inputHandler = function() {
        if (field.classList.contains('is-invalid')) {
          self.clearFieldError(field);
        }
        self.updateSubmitState();
      };

      field.addEventListener('blur', blurHandler);
      field.addEventListener('input', inputHandler);

      self.handlers.fieldBlur.push({ field: field, handler: blurHandler });
      self.handlers.fieldInput.push({ field: field, handler: inputHandler });
    });

    // Form submit
    this.handlers.submit = function(e) { self.handleSubmit(e); };
    this.form.addEventListener('submit', this.handlers.submit);

    // Listen for calendar changes
    this.handlers.calendarChange = function(e) { self.updateDateDisplay(e.detail); };
    document.addEventListener('calendar:change', this.handlers.calendarChange);

    // Listen for checkbox changes
    var updateSelectionHandler = function() { self.updateSelectionDisplay(); };

    this.roomCheckboxes.forEach(function(checkbox) {
      checkbox.addEventListener('change', updateSelectionHandler);
      self.handlers.roomChange.push({ checkbox: checkbox, handler: updateSelectionHandler });
    });
    this.equipmentCheckboxes.forEach(function(checkbox) {
      checkbox.addEventListener('change', updateSelectionHandler);
      self.handlers.equipmentChange.push({ checkbox: checkbox, handler: updateSelectionHandler });
    });
  };

  Form.prototype.validateField = function(field) {
    var value = field.value.trim();
    var isRequired = field.hasAttribute('required');
    var type = field.getAttribute('type');

    var isValid = true;

    if (isRequired && !value) {
      isValid = false;
    }

    if (type === 'email' && value) {
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  };

  Form.prototype.showFieldError = function(field) {
    field.classList.add('is-invalid');
    var fieldContainer = field.closest('.form__field');
    if (fieldContainer) {
      fieldContainer.classList.add('is-invalid');
    }
  };

  Form.prototype.clearFieldError = function(field) {
    field.classList.remove('is-invalid');
    var fieldContainer = field.closest('.form__field');
    if (fieldContainer) {
      fieldContainer.classList.remove('is-invalid');
    }
  };

  Form.prototype.validateAll = function() {
    var isValid = true;
    var self = this;
    this.fields.forEach(function(field) {
      if (!self.validateField(field)) {
        isValid = false;
      }
    });
    return isValid;
  };

  Form.prototype.updateSubmitState = function() {
    var allFilled = true;
    this.fields.forEach(function(field) {
      if (field.hasAttribute('required') && !field.value.trim()) {
        allFilled = false;
      }
    });

    if (this.submitButton) {
      this.submitButton.disabled = !allFilled;
    }
  };

  Form.prototype.updateDateDisplay = function(detail) {
    if (this.dateDisplay && detail.startDate && detail.endDate) {
      var startStr = this.formatDisplayDate(detail.startDate);
      var endStr = this.formatDisplayDate(detail.endDate);
      this.dateDisplay.textContent = startStr + ' → ' + endStr;
    }
  };

  Form.prototype.updateSelectionDisplay = function() {
    if (!this.selectionDisplay) return;

    var selections = [];

    // Get selected rooms
    this.roomCheckboxes.forEach(function(checkbox) {
      if (checkbox.checked) {
        var item = checkbox.closest('.accordion__item');
        if (item) {
          var title = item.querySelector('.accordion__title');
          if (title) {
            selections.push(title.textContent);
          }
        }
      }
    });

    // Get selected equipment
    this.equipmentCheckboxes.forEach(function(checkbox) {
      if (checkbox.checked) {
        var label = checkbox.closest('.checkbox-group__label');
        if (label) {
          var text = label.querySelector('.checkbox-group__text');
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
  };

  Form.prototype.formatDisplayDate = function(date) {
    var MONTHS_DE = [
      'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
      'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'
    ];
    var day = date.getDate();
    var month = MONTHS_DE[date.getMonth()];
    return day + ' ' + month;
  };

  Form.prototype.handleSubmit = function(e) {
    e.preventDefault();

    if (!this.validateAll()) {
      var firstInvalid = this.form.querySelector('.is-invalid');
      if (firstInvalid) {
        firstInvalid.focus();
      }
      return;
    }

    var formData = new FormData(this.form);
    var data = {};
    formData.forEach(function(value, key) {
      data[key] = value;
    });

    console.log('Form submitted:', data);
    this.showSuccess();
  };

  Form.prototype.showSuccess = function() {
    this.form.classList.add('is-success');

    if (typeof gsap !== 'undefined') {
      var successEl = this.form.querySelector('[data-form-success]');
      if (successEl) {
        gsap.fromTo(successEl,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
        );
      }
    }
  };

  function initForms() {
    // Cleanup previous instances
    instances.forEach(function(instance) {
      instance.cleanup();
    });
    instances = [];

    var forms = document.querySelectorAll('[data-form]');
    forms.forEach(function(container) {
      var form = new Form(container);
      instances.push(form);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    initForms();
  }

  // Re-initialize after View Transitions page swap
  document.addEventListener('astro:page-load', initForms);
})();
