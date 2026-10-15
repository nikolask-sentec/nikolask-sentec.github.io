/**
 * Bilingual content toggle for room detail pages.
 *
 * Content markup: wrap translatable text in <span data-lang="en|id|jp">.
 * Visibility is driven entirely by CSS via the data-lang attribute set on
 * <html> (see the inline snippet in <head> that applies it before first
 * paint, to avoid a flash of every language at once).
 */
(function () {
  var STORAGE_KEY = 'mgrLang';
  var SUPPORTED = ['en', 'id', 'jp'];

  function normalize(lang) {
    return SUPPORTED.indexOf(lang) !== -1 ? lang : 'en';
  }

  function setActiveButtons(lang) {
    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang-btn') === lang);
    });
  }

  // Exposed for the header [ EN | ID | JP ] control.
  window.setMgrLang = function (lang) {
    lang = normalize(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('data-lang', lang);
    setActiveButtons(lang);
  };

  document.addEventListener('DOMContentLoaded', function () {
    setActiveButtons(normalize(document.documentElement.getAttribute('data-lang')));
    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        window.setMgrLang(btn.getAttribute('data-lang-btn'));
      });
    });
  });
})();
