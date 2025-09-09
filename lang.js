/* lang.js — gestion globale FR/EN pour tout le site */
(function () {
  const KEY = 'pf_lang';
  const SUP = ['fr', 'en'];
  const FALLBACK = 'fr';

  function norm(v) {
    const s = String(v || '').slice(0, 2).toLowerCase();
    return SUP.includes(s) ? s : FALLBACK;
  }

  function getLang() {
    return norm(localStorage.getItem(KEY) || (navigator.language || FALLBACK));
  }

  function setLang(l) {
    const lang = norm(l);
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  // Expose global
  window.getLang = getLang;
  window.setLang = setLang;

  // Auto-init + brancher les sélecteurs
  document.addEventListener('DOMContentLoaded', () => {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.querySelectorAll('select[data-lang-picker]').forEach((sel) => {
      sel.value = lang;
      sel.addEventListener('change', (e) => setLang(e.target.value));
    });
  });
})();
