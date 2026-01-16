/**
 * i18n - Markdown-based translation system
 * No build step required - loads and parses markdown files client-side
 */
(function() {
  'use strict';

  const SUPPORTED_LANGS = ['de', 'en', 'fr', 'lu'];
  const DEFAULT_LANG = 'de';
  const COOKIE_NAME = 'lang';
  const COOKIE_DAYS = 365;

  class I18n {
    constructor() {
      this.currentLang = this.detectLanguage();
      this.translations = {};
      this.globalStrings = {};
    }

    // Detect language: cookie > URL param > browser > default
    detectLanguage() {
      // Check cookie
      const cookie = document.cookie
        .split('; ')
        .find(row => row.startsWith(COOKIE_NAME + '='));
      if (cookie) {
        const lang = cookie.split('=')[1];
        if (SUPPORTED_LANGS.includes(lang)) return lang;
      }

      // Check URL parameter
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang');
      if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
        this.setLanguageCookie(urlLang);
        return urlLang;
      }

      // Check browser language
      const browserLang = navigator.language.split('-')[0];
      if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;

      return DEFAULT_LANG;
    }

    setLanguageCookie(lang) {
      const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
      document.cookie = `${COOKIE_NAME}=${lang}; expires=${expires}; path=/; SameSite=Lax`;
    }

    async init() {
      // Load global strings
      await this.loadContent('_global');

      // Load page-specific content
      const page = this.getCurrentPage();
      await this.loadContent(page);

      // Apply translations
      this.translate();

      // Mark as ready (removes CSS hiding)
      document.documentElement.setAttribute('data-i18n-ready', '');

      // Update HTML lang attribute
      document.documentElement.lang = this.currentLang;

      // Setup language switcher
      this.setupSwitcher();
    }

    getCurrentPage() {
      const path = window.location.pathname;
      const filename = path.split('/').pop().replace('.html', '') || 'index';
      // Handle root path
      return filename === '' ? 'index' : filename;
    }

    async loadContent(name) {
      try {
        const url = `/content/${this.currentLang}/${name}.md`;
        const response = await fetch(url);

        if (!response.ok) {
          // Fallback to German if translation missing
          if (this.currentLang !== DEFAULT_LANG) {
            const fallback = await fetch(`/content/${DEFAULT_LANG}/${name}.md`);
            if (fallback.ok) {
              const text = await fallback.text();
              this.parseMarkdown(name, text);
            }
          }
          return;
        }

        const text = await response.text();
        this.parseMarkdown(name, text);
      } catch (err) {
        console.warn(`i18n: Could not load ${name}.md`, err);
      }
    }

    parseMarkdown(name, text) {
      // Split frontmatter and body
      const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

      if (match) {
        const frontmatter = this.parseYaml(match[1]);
        const body = match[2].trim();

        if (name === '_global') {
          this.globalStrings = frontmatter;
        } else {
          this.translations[name] = { ...frontmatter, _body: body };
        }
      }
    }

    // Simple YAML parser for flat/nested objects
    parseYaml(yaml) {
      const result = {};
      let currentSection = null;

      yaml.split(/\r?\n/).forEach(line => {
        // Skip empty lines and comments
        if (!line.trim() || line.trim().startsWith('#')) return;

        // Check for section header (no leading spaces)
        const sectionMatch = line.match(/^(\w+):$/);
        if (sectionMatch) {
          currentSection = sectionMatch[1];
          result[currentSection] = {};
          return;
        }

        // Key-value pair
        const kvMatch = line.match(/^\s*(\w+):\s*["']?(.+?)["']?$/);
        if (kvMatch) {
          const [, key, value] = kvMatch;
          if (currentSection) {
            result[currentSection][key] = value;
          } else {
            result[key] = value;
          }
        }
      });

      return result;
    }

    // Get translation by dot notation: "nav.workshops" or "form.submit"
    t(key) {
      const parts = key.split('.');

      // Check global strings first
      let value = this.globalStrings;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      if (value !== undefined) return value;

      // Check page translations
      const page = this.getCurrentPage();
      value = this.translations[page];
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }

      return value || key; // Return key if not found
    }

    translate(animate = false) {
      const duration = 200; // ms for fade transition

      // Helper to update element with optional animation
      const updateElement = (el, newContent, isHTML = false) => {
        if (animate) {
          el.style.transition = `opacity ${duration}ms ease`;
          el.style.opacity = '0';
          setTimeout(() => {
            if (isHTML) {
              el.innerHTML = newContent;
            } else {
              el.textContent = newContent;
            }
            el.style.opacity = '1';
          }, duration);
        } else {
          if (isHTML) {
            el.innerHTML = newContent;
          } else {
            el.textContent = newContent;
          }
        }
      };

      // Translate elements with data-i18n attribute
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = this.t(key);
        if (translated !== key) {
          updateElement(el, translated);
        }
      });

      // Translate placeholders (no animation needed)
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = this.t(key);
        if (translated !== key) {
          el.placeholder = translated;
        }
      });

      // Translate aria-labels (no animation needed)
      document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        const translated = this.t(key);
        if (translated !== key) {
          el.setAttribute('aria-label', translated);
        }
      });

      // Translate HTML content (for elements with markup)
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const translated = this.t(key);
        if (translated !== key) {
          updateElement(el, translated, true);
        }
      });
    }

    setupSwitcher() {
      // Update active state on language links
      document.querySelectorAll('.footer__lang-link').forEach(link => {
        const lang = link.getAttribute('data-lang');
        if (!lang) return;

        // Set active class
        link.classList.toggle('footer__lang-link--active', lang === this.currentLang);

        // Add click handler
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.switchLanguage(lang);
        });
      });

      // Also handle menu overlay language links if they exist
      document.querySelectorAll('[data-lang]').forEach(link => {
        const lang = link.getAttribute('data-lang');
        if (!lang) return;

        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.switchLanguage(lang);
        });
      });
    }

    async switchLanguage(lang) {
      if (!SUPPORTED_LANGS.includes(lang)) return;
      if (lang === this.currentLang) return;

      // Update current language
      this.currentLang = lang;
      this.setLanguageCookie(lang);

      // Clear existing translations
      this.translations = {};
      this.globalStrings = {};

      // Reload content for new language
      await this.loadContent('_global');
      const page = this.getCurrentPage();
      await this.loadContent(page);

      // Re-apply translations with animation
      this.translate(true);

      // Update HTML lang attribute
      document.documentElement.lang = lang;

      // Update switcher active states
      this.updateSwitcherStates();

      // Dispatch event for other scripts after animation completes (200ms fade + 50ms buffer)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
      }, 250);
    }

    updateSwitcherStates() {
      // Footer switcher
      document.querySelectorAll('.footer__lang-link').forEach(link => {
        const linkLang = link.getAttribute('data-lang');
        link.classList.toggle('footer__lang-link--active', linkLang === this.currentLang);
      });

      // Menu switcher
      document.querySelectorAll('.menu-overlay__lang-link').forEach(link => {
        const linkLang = link.getAttribute('data-lang');
        link.classList.toggle('menu-overlay__lang-link--active', linkLang === this.currentLang);
      });
    }

    // Expose translation function globally
    getTranslation(key) {
      return this.t(key);
    }
  }

  // Initialize on DOM ready
  window.i18n = new I18n();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.i18n.init());
  } else {
    window.i18n.init();
  }
})();
