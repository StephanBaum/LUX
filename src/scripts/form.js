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

    // A tick box is filled in by being ticked, not by having text in it.
    if (type === 'checkbox') {
      if (isRequired && !field.checked) {
        isValid = false;
      }
    } else if (isRequired && !value) {
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
      if (!field.hasAttribute('required')) return;
      var filled = field.getAttribute('type') === 'checkbox' ? field.checked : field.value.trim();
      if (!filled) {
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

    var self = this;
    var failed = this.form.querySelector('[data-form-failed]');

    var data = {};
    new FormData(this.form).forEach(function(value, key) {
      data[key] = value;
    });

    // The dates and the ticked rooms live outside the form, on the calendar
    // and in the accordion, so they are read off the summary line the visitor
    // can see. What they were shown is what gets sent.
    if (this.dateDisplay) data.datum = this.dateDisplay.textContent.trim();
    if (this.selectionDisplay) data.auswahl = this.selectionDisplay.textContent.trim();
    data.seite = window.location.href;

    if (failed) failed.hidden = true;
    this.form.classList.add('is-sending');
    if (this.submitButton) this.submitButton.disabled = true;

    /*
     * A request with dates holds those days and needs approving; one without
     * is an enquiry and stays an e-mail, exactly as before.
     */
    var startEl = document.querySelector('[data-calendar-start]');
    var endEl = document.querySelector('[data-calendar-end]');
    var start = startEl && startEl.value;
    var end = endEl && endEl.value;
    var endpoint = '/api/inquiry';

    if (start && end) {
      endpoint = '/api/reservation';
      data.startAt = start;
      // The end is exclusive everywhere else, so the last chosen day is included.
      var after = new Date(end + 'T12:00:00Z');
      after.setUTCDate(after.getUTCDate() + 1);
      data.endAt = after.toISOString().slice(0, 10);
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function(response) {
        if (response.status === 409) {
          return response.json().then(function(body) {
            self.showTaken(body && body.error);
            throw new Error('taken');
          });
        }
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function(body) {
        // Not set up yet: the request was not taken, so say so plainly.
        if (body && body.skipped) throw new Error('skipped');
        self.showSuccess();
      })
      .catch(function(error) {
        if (error && error.message === 'taken') return;
        // The enquiry is not lost — it is still in the form, and the failure
        // message carries the studio's address so it can be sent by hand.
        if (failed) failed.hidden = false;
        if (self.submitButton) self.submitButton.disabled = false;
      })
      .then(function() {
        self.form.classList.remove('is-sending');
      });
  };

  /**
   * Somebody else took the days between the page loading and the send. Say so,
   * re-read the calendar so they grey out, and leave the form filled in.
   */
  Form.prototype.showTaken = function(message) {
    var failed = this.form.querySelector('[data-form-failed]');
    if (failed) {
      failed.hidden = false;
      var text = message || 'Diese Tage sind inzwischen vergeben.';
      var slot = failed.querySelector('[data-form-failed-text]') || failed;
      slot.textContent = text;
    }
    if (this.submitButton) this.submitButton.disabled = false;

    var cal = document.querySelector('.calendar');
    if (cal && cal._calendarInstance) cal._calendarInstance.loadBlockedDates();
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
