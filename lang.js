<!-- Place ce fichier dans le même dossier que tes pages, puis inclus-le dans chaque page -->
<script>
/* site-lang.js — gestion globale de la langue (FR/EN) pour TOUT le site */
(function(){
  const KEY = 'pf_lang';
  const FALLBACK = 'en';
  const SUP = ['fr','en'];

  function norm(l) {
    const s = String(l||'').slice(0,2).toLowerCase();
    return SUP.includes(s) ? s : FALLBACK;
  }

  window.getLang = function(){
    return norm(localStorage.getItem(KEY) || (navigator.language||'en'));
  };

  window.setLang = function(l){
    const lang = norm(l);
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
    // notifie toutes les pages/composants
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  };

  // Auto-init + branchement sur tous les <select data-lang-picker>
  document.addEventListener('DOMContentLoaded', ()=>{
    const lang = getLang();
    document.documentElement.lang = lang;
    document.querySelectorAll('select[data-lang-picker]').forEach(sel=>{
      sel.value = lang;
      sel.addEventListener('change', e=> setLang(e.target.value));
    });
  });
})();
</script>
