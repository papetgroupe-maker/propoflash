// lang.js — i18n global (FR/EN) + propagation auto sur tout le site
(() => {
  const KEY = 'pf_lang';
  const SUP = ['fr','en'];
  const FALLBACK = 'fr';

  const STR = {
    fr: {
      // Global
      language: 'Langue',
      // Index (home)
      nav_why: 'Pourquoi nous',
      nav_use: 'Cas d’usage',
      nav_pricing: 'Tarifs',
      start: 'Commencer',
      sign_in: 'Se connecter',
      sign_out: 'Se déconnecter',
      paste_brief: 'Collez votre brief ici…',
      hero_sub: 'Générez des offres et propositions professionnelles en minutes, à partir d’un simple brief. Zéro complexité.',
      // Auth
      auth_title: 'Bienvenue',
      auth_sub: 'Connectez-vous pour retrouver vos discussions et aperçus.',
      auth_google: 'Se connecter avec Google',
      auth_or: 'ou',
      auth_email_label: 'Email',
      auth_pwd_label: 'Mot de passe',
      auth_forgot: 'Mot de passe oublié ?',
      auth_login: 'Se connecter',
      auth_create: 'Créer un compte',
      auth_have_account: 'J’ai déjà un compte',
      auth_no_account: 'Pas de compte ?',
      auth_back_site: '← Retour au site',
      // Studio
      chat: 'Chat',
      chat_hint: 'Entrée = envoyer • Maj+Entrée = nouvelle ligne',
      history: 'Historique',
      ready: 'Prêt',
      logout: 'Se déconnecter',
      composer_ph: 'Écrivez votre message',
      // Preview
      back_chat: '← Retour au chat',
      export_pdf: 'Exporter PDF',
      loading_preview: 'Chargement de l’aperçu…',
    },
    en: {
      // Global
      language: 'Language',
      // Index (home)
      nav_why: 'Why us',
      nav_use: 'Use cases',
      nav_pricing: 'Pricing',
      start: 'Start',
      sign_in: 'Sign in',
      sign_out: 'Sign out',
      paste_brief: 'Paste your brief here…',
      hero_sub: 'Create professional proposals in minutes from a simple brief. Zero complexity.',
      // Auth
      auth_title: 'Welcome',
      auth_sub: 'Sign in to access your chats and previews.',
      auth_google: 'Sign in with Google',
      auth_or: 'or',
      auth_email_label: 'Email',
      auth_pwd_label: 'Password',
      auth_forgot: 'Forgot password?',
      auth_login: 'Log in',
      auth_create: 'Create an account',
      auth_have_account: 'Log in',
      auth_no_account: 'No account?',
      auth_back_site: '← Back to site',
      // Studio
      chat: 'Chat',
      chat_hint: 'Enter = send • Shift+Enter = new line',
      history: 'History',
      ready: 'Ready',
      logout: 'Sign out',
      composer_ph: 'Type your message',
      // Preview
      back_chat: '← Back to chat',
      export_pdf: 'Export PDF',
      loading_preview: 'Loading preview…',
    }
  };

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
    // sync selects
    document.querySelectorAll('select[data-lang-picker]').forEach(sel => { sel.value = lang; });
    const looseSel = document.getElementById('langSel');
    if (looseSel && !looseSel.matches('[data-lang-picker]')) looseSel.value = lang;
    // fire event
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
    // apply immediately
    applyI18n();
  }

  // expose global
  window.getLang = getLang;
  window.setLang = setLang;

  // helpers
  const T = () => STR[getLang()] || STR[FALLBACK];
  const setTxt = (id, key) => { const el = document.getElementById(id); if (el && T()[key] != null) el.textContent = T()[key]; };
  const setPH  = (id, key) => { const el = document.getElementById(id); if (el && T()[key] != null) el.placeholder = T()[key]; };

  function applyI18n(){
    // Always set <html lang>
    document.documentElement.lang = getLang();

    const dict = T();

    // ===== INDEX =====
    // nav labels by href (pas d’ID dans la nav)
    const aWhy = document.querySelector('.menu a[href="#why"]'); if (aWhy) aWhy.textContent = dict.nav_why;
    const aUse = document.querySelector('.menu a[href="#use"]'); if (aUse) aUse.textContent = dict.nav_use;
    const aPri = document.querySelector('.menu a[href="#pricing"]'); if (aPri) aPri.textContent = dict.nav_pricing;

    setTxt('startBtn', 'start');
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      // Si connecté, certains scripts locaux remplacent le libellé; on se base sur le texte courant pour décider
      if (/déconnecter|sign out/i.test(authBtn.textContent)) {
        authBtn.textContent = dict.sign_out;
      } else {
        authBtn.textContent = dict.sign_in;
      }
    }
    setPH('brief', 'paste_brief');
    const heroSub = document.getElementById('heroSub'); if (heroSub) heroSub.textContent = dict.hero_sub;

    // ===== AUTH =====
    setTxt('ttl', 'auth_title');
    setTxt('sub', 'auth_sub');
    setTxt('gbtn', 'auth_google');
    setTxt('or', 'auth_or');
    setTxt('lem', 'auth_email_label');
    setTxt('lpw', 'auth_pwd_label');
    setTxt('forgot', 'auth_forgot');
    // submit / toggle / foot
    const submitBtn = document.getElementById('submitBtn');
    const toggleMode = document.getElementById('toggleMode');
    const noacc = document.getElementById('noacc');
    if (noacc) noacc.textContent = dict.auth_no_account;
    if (toggleMode && submitBtn) {
      // Si on est en mode "signup" (heuristique sur le libellé)
      const isSignup = /créer|create/i.test(submitBtn.textContent);
      submitBtn.textContent = isSignup ? dict.auth_create : dict.auth_login;
      toggleMode.textContent = isSignup ? dict.auth_have_account : dict.auth_create;
    }
    setTxt('back', 'auth_back_site');

    // ===== STUDIO =====
    setTxt('chatTitle', 'chat');
    setTxt('chatHint', 'chat_hint');
    setTxt('openHistory', 'history');
    const status = document.getElementById('status'); if (status && /prêt|ready|chargement|loading/i.test(status.textContent)) status.textContent = dict.ready;
    setTxt('logoutBtn', 'logout');
    setPH('composer', 'composer_ph');
    // Label "Langue" (pas d’ID)
    const labelLangStudio = document.querySelector('.bar .right label');
    if (labelLangStudio) labelLangStudio.textContent = dict.language;

    // ===== PREVIEW =====
    setTxt('backBtn', 'back_chat');
    setTxt('pdfBtn', 'export_pdf');
    const st2 = document.getElementById('status');
    if (st2 && /aperçu|preview/i.test(st2.textContent)) st2.textContent = dict.loading_preview;
    const labelLangPrev = document.querySelector('.bar .right label');
    if (labelLangPrev) labelLangPrev.textContent = dict.language;
  }

  // init document lang
  document.documentElement.lang = getLang();

  // Auto-bind sur tous les <select data-lang-picker> (et fallback #langSel)
  function bindPickers(){
    document.querySelectorAll('select[data-lang-picker]').forEach((sel) => {
      sel.value = getLang();
      sel.onchange = (e) => setLang(e.target.value);
    });
    const looseSel = document.getElementById('langSel');
    if (looseSel && !looseSel.matches('[data-lang-picker]')) {
      looseSel.value = getLang();
      looseSel.onchange = (e) => setLang(e.target.value);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindPickers();
    applyI18n();
  });

  // Re-appliquer à chaque changement
  window.addEventListener('langchange', applyI18n);
})();
