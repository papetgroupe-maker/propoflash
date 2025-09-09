<script>
/* lang.js — gestion globale FR/EN + auto-traduction de libellés et placeholders
   Utilisation dans le HTML :
   - Texte : <span data-t-fr="Bonjour" data-t-en="Hello"></span>
   - Placeholder : <textarea data-ph-fr="Collez votre brief ici…" data-ph-en="Paste your brief here…"></textarea>
   - HTML riche : <div data-html-fr="<b>Titre</b>" data-html-en="<b>Title</b>"></div>
*/
(function(){
  const KEY = 'pf_lang';
  const SUP = ['fr','en'];
  const FALLBACK = 'en';

  const norm = l => {
    const s = String(l||'').slice(0,2).toLowerCase();
    return SUP.includes(s) ? s : FALLBACK;
  };

  window.getLang = function(){
    return norm(localStorage.getItem(KEY) || (navigator.language||'en'));
  };

  window.setLang = function(l){
    const lang = norm(l);
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
    updateDomLang(lang);
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  };

  function updateDomLang(lang){
    // Texte simple
    document.querySelectorAll('[data-t-fr],[data-t-en]').forEach(el=>{
      el.textContent = el.getAttribute(lang==='en'?'data-t-en':'data-t-fr') || el.textContent;
    });
    // Placeholder
    document.querySelectorAll('[data-ph-fr],[data-ph-en]').forEach(el=>{
      el.placeholder = el.getAttribute(lang==='en'?'data-ph-en':'data-ph-fr') || el.placeholder;
    });
    // HTML riche
    document.querySelectorAll('[data-html-fr],[data-html-en]').forEach(el=>{
      const html = el.getAttribute(lang==='en'?'data-html-en':'data-html-fr');
      if(html!=null) el.innerHTML = html;
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const lang = getLang();
    document.documentElement.lang = lang;
    updateDomLang(lang);
    // branche tous les sélecteurs de langue présents
    document.querySelectorAll('select[data-lang-picker]').forEach(sel=>{
      sel.value = lang;
      sel.addEventListener('change', e=> setLang(e.target.value));
    });
  });
})();
</script>
