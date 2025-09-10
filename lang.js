// lang.js
(() => {
  const KEY = 'pf_lang';
  const SUP = ['fr','en'];
  const FALLBACK = 'fr';

  const norm = (l) => {
    const s = (l || '').toString().slice(0, 2).toLowerCase();
    return SUP.includes(s) ? s : FALLBACK;
  };

  function getLang() {
    try {
      return norm(localStorage.getItem(KEY) || navigator.language || FALLBACK);
    } catch {
      return FALLBACK;
    }
  }

  function setLang(l) {
    const lang = norm(l);
    try { localStorage.setItem(KEY, lang); } catch {}
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  // expose global
  window.getLang = getLang;
  window.setLang = setLang;

  // init document lang
  document.documentElement.lang = getLang();

  // auto-bind sur tous les <select data-lang-picker>
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('select[data-lang-picker]').forEach((sel) => {
      sel.value = getLang();
      sel.addEventListener('change', (e) => setLang(e.target.value));
    });
  });
})();
