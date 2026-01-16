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
      this.initialized = false;
    }

    detectLanguage() {
      const cookie = document.cookie
        .split('; ')
        .find(function(row) { return row.startsWith(COOKIE_NAME + '='); });
      if (cookie) {
        const lang = cookie.split('=')[1];
        if (SUPPORTED_LANGS.indexOf(lang) !== -1) return lang;
      }

      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang');
      if (urlLang && SUPPORTED_LANGS.indexOf(urlLang) !== -1) {
        this.setLanguageCookie(urlLang);
        return urlLang;
      }

      const browserLang = navigator.language.split('-')[0];
      if (SUPPORTED_LANGS.indexOf(browserLang) !== -1) return browserLang;

      return DEFAULT_LANG;
    }

    setLanguageCookie(lang) {
      const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
      document.cookie = COOKIE_NAME + '=' + lang + '; expires=' + expires + '; path=/; SameSite=Lax';
    }

    async init() {
      // Clear previous state for View Transitions
      this.translations = {};
      this.globalStrings = {};

      await this.loadContent('_global');
      const page = this.getCurrentPage();
      await this.loadContent(page);

      this.translate();
      document.documentElement.setAttribute('data-i18n-ready', '');
      document.documentElement.lang = this.currentLang;
      this.setupSwitcher();
      this.initialized = true;
    }

    getCurrentPage() {
      const path = window.location.pathname;
      const filename = path.split('/').pop().replace('.html', '') || 'index';
      return filename === '' ? 'index' : filename;
    }

    async loadContent(name) {
      try {
        const url = '/content/' + this.currentLang + '/' + name + '.md';
        const response = await fetch(url);

        if (!response.ok) {
          if (this.currentLang !== DEFAULT_LANG) {
            const fallback = await fetch('/content/' + DEFAULT_LANG + '/' + name + '.md');
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
        console.warn('i18n: Could not load ' + name + '.md', err);
      }
    }

    parseMarkdown(name, text) {
      const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

      if (match) {
        const frontmatter = this.parseYaml(match[1]);
        const body = match[2].trim();

        if (name === '_global') {
          this.globalStrings = frontmatter;
        } else {
          this.translations[name] = Object.assign({}, frontmatter, { _body: body });
        }
      }
    }

    parseYaml(yaml) {
      const result = {};
      let currentSection = null;

      yaml.split(/\r?\n/).forEach(function(line) {
        if (!line.trim() || line.trim().startsWith('#')) return;

        const sectionMatch = line.match(/^(\w+):$/);
        if (sectionMatch) {
          currentSection = sectionMatch[1];
          result[currentSection] = {};
          return;
        }

        const kvMatch = line.match(/^\s*(\w+):\s*["']?(.+?)["']?$/);
        if (kvMatch) {
          const key = kvMatch[1];
          const value = kvMatch[2];
          if (currentSection) {
            result[currentSection][key] = value;
          } else {
            result[key] = value;
          }
        }
      });

      return result;
    }

    t(key) {
      const parts = key.split('.');
      const self = this;

      let value = this.globalStrings;
      for (let i = 0; i < parts.length; i++) {
        value = value ? value[parts[i]] : undefined;
        if (value === undefined) break;
      }
      if (value !== undefined) return value;

      const page = this.getCurrentPage();
      value = this.translations[page];
      for (let i = 0; i < parts.length; i++) {
        value = value ? value[parts[i]] : undefined;
        if (value === undefined) break;
      }

      return value || key;
    }

    translate(animate) {
      const duration = 200;
      const self = this;

      var updateElement = function(el, newContent, isHTML) {
        if (animate) {
          el.style.transition = 'opacity ' + duration + 'ms ease';
          el.style.opacity = '0';
          setTimeout(function() {
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

      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        const key = el.getAttribute('data-i18n');
        const translated = self.t(key);
        if (translated !== key) {
          updateElement(el, translated, false);
        }
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = self.t(key);
        if (translated !== key) {
          el.placeholder = translated;
        }
      });

      document.querySelectorAll('[data-i18n-aria]').forEach(function(el) {
        const key = el.getAttribute('data-i18n-aria');
        const translated = self.t(key);
        if (translated !== key) {
          el.setAttribute('aria-label', translated);
        }
      });

      document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
        const key = el.getAttribute('data-i18n-html');
        const translated = self.t(key);
        if (translated !== key) {
          updateElement(el, translated, true);
        }
      });
    }

    setupSwitcher() {
      const self = this;

      document.querySelectorAll('.footer__lang-link').forEach(function(link) {
        const lang = link.getAttribute('data-lang');
        if (!lang) return;

        link.classList.toggle('footer__lang-link--active', lang === self.currentLang);

        // Remove old listeners by cloning
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);

        newLink.addEventListener('click', function(e) {
          e.preventDefault();
          self.switchLanguage(lang);
        });
      });

      document.querySelectorAll('[data-lang]').forEach(function(link) {
        const lang = link.getAttribute('data-lang');
        if (!lang || link.classList.contains('footer__lang-link')) return;

        // Remove old listeners by cloning
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);

        newLink.addEventListener('click', function(e) {
          e.preventDefault();
          self.switchLanguage(lang);
        });
      });
    }

    async switchLanguage(lang) {
      if (SUPPORTED_LANGS.indexOf(lang) === -1) return;
      if (lang === this.currentLang) return;

      this.currentLang = lang;
      this.setLanguageCookie(lang);

      this.translations = {};
      this.globalStrings = {};

      await this.loadContent('_global');
      const page = this.getCurrentPage();
      await this.loadContent(page);

      this.translate(true);
      document.documentElement.lang = lang;
      this.updateSwitcherStates();

      const self = this;
      setTimeout(function() {
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: lang } }));
      }, 250);
    }

    updateSwitcherStates() {
      const self = this;

      document.querySelectorAll('.footer__lang-link').forEach(function(link) {
        const linkLang = link.getAttribute('data-lang');
        link.classList.toggle('footer__lang-link--active', linkLang === self.currentLang);
      });

      document.querySelectorAll('.menu-overlay__lang-link').forEach(function(link) {
        const linkLang = link.getAttribute('data-lang');
        link.classList.toggle('menu-overlay__lang-link--active', linkLang === self.currentLang);
      });
    }

    getTranslation(key) {
      return this.t(key);
    }
  }

  // Create or reinitialize i18n
  function initI18n() {
    if (!window.i18n) {
      window.i18n = new I18n();
    }
    window.i18n.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }

  // Re-initialize after View Transitions page swap
  document.addEventListener('astro:page-load', initI18n);
})();
