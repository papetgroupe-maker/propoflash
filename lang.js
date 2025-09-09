// lang.js — global FR/EN for whole site
(function(){
  const KEY = 'pf_lang';
  const SUP = ['fr','en'];
  const FALLBACK = 'fr';

  function norm(l){
    const s = String(l||'').slice(0,2).toLowerCase();
    return SUP.includes(s) ? s : FALLBACK;
  }

  window.getLang = function(){
    try{
      return norm(localStorage.getItem(KEY) || (navigator.language||FALLBACK));
    }catch{ return FALLBACK }
  };

  window.setLang = function(l){
    const lang = norm(l);
    try{ localStorage.setItem(KEY, lang); }catch{}
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  };

  window.applyI18N = function(){  // petit helper si besoin (pages existantes)
    window.dispatchEvent(new CustomEvent('langchange', { detail: getLang() }));
  };

  // Auto-init + branchement sur tous les <select data-lang-picker>
  document.addEventListener('DOMContentLoaded', ()=>{
    document.documentElement.lang = getLang();
    document.querySelectorAll('select[data-lang-picker]').forEach(sel=>{
      sel.value = getLang();
      sel.addEventListener('change', e=> setLang(e.target.value));
    });
  });
})();
