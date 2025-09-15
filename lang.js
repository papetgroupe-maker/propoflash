// lang.js — i18n FR/EN simple et robuste
(() => {
  const KEY = 'pf_lang';
  const SUP = ['fr', 'en'];
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

  // init <html lang>
  document.documentElement.lang = getLang();

  // Helpers DOM
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const txt  = (el, fr, en) => { if (!el) return; el.textContent = (getLang()==='en') ? en : fr; };
  const html = (el, fr, en) => { if (!el) return; el.innerHTML   = (getLang()==='en') ? en : fr; };
  const ph   = (el, fr, en) => { if (!el) return; el.placeholder  = (getLang()==='en') ? en : fr; };
  const attr = (el, name, fr, en) => { if (!el) return; el.setAttribute(name, (getLang()==='en') ? en : fr); };

  function syncLangPickers() {
    const lang = getLang();
    $$('select[data-lang-picker]').forEach((sel) => {
      sel.value = lang;
      if (!sel._pfBound) {
        sel.addEventListener('change', (e) => setLang(e.target.value));
        sel._pfBound = true;
      }
    });
  }

  /* === Index page === */
  function applyIndex() {
    txt($('.menu a[href="#why"]'),     'Pourquoi nous',   'Why us');
    txt($('.menu a[href="#use"]'),     'Cas d’usage',     'Use cases');
    txt($('.menu a[href="#pricing"]'), 'Tarifs',          'Pricing');

    txt($('#authBtn'), 'Se connecter', 'Sign in');
    txt($('#startBtn'),'Commencer',    'Start');

    html($('.lead h1'),
      'Donnez vie à vos propositions. <span class="accent-word">Maintenant.</span>',
      'Bring your proposals to life. <span class="accent-word">Now.</span>'
    );
    txt($('#heroSub'),
      'Générez des offres et propositions professionnelles en minutes, à partir d’un simple brief. Zéro complexité.',
      'Create professional proposals in minutes from a simple brief. Zero complexity.'
    );
    ph($('#brief'), 'Collez votre brief ici…', 'Paste your brief here…');
    attr($('#sendBrief'), 'title',      'Envoyer', 'Send');
    attr($('#sendBrief'), 'aria-label', 'Envoyer', 'Send');

    const why = $('#why');
    if (why) {
      txt($('#why .h2'), 'Pourquoi PropoFlash ?', 'Why PropoFlash?');
      txt($('#why .sub'),
        'Notre signature : qualité éditoriale + exécution instantanée, sans vous perdre dans des outils.',
        'Our signature: editorial quality + instant execution, without getting lost in tools.'
      );
      const cards = $$('#why .card');
      if (cards[0]) { txt(cards[0].querySelector('h3'), 'Rédaction premium', 'Premium writing'); txt(cards[0].querySelector('p'), 'Ton professionnel, argumentation claire, structure prête à envoyer à des décideurs.', 'Professional tone, clear arguments, structure ready for decision-makers.'); }
      if (cards[1]) { txt(cards[1].querySelector('h3'), 'Adaptée au contexte', 'Context-aware');  txt(cards[1].querySelector('p'), 'Chaque proposition s’appuie sur votre brief et vos preuves pour coller à l’objectif.', 'Each proposal uses your brief and proof points to match the goal.'); }
      if (cards[2]) { txt(cards[2].querySelector('h3'), 'Aperçu instantané',  'Instant preview'); txt(cards[2].querySelector('p'), 'Vous collez le brief, vous prévisualisez, vous peaufinez — puis PDF en 1 clic.', 'Paste your brief, preview, refine — then one-click PDF.'); }
    }

    const use = $('#use');
    if (use) {
      txt($('#use .h2'), 'Cas d’usage fréquents', 'Common use cases');
      txt($('#use .sub'),
        'Du devis B2B aux offres e-commerce, PropoFlash couvre les besoins essentiels.',
        'From B2B quotes to e-commerce offers, PropoFlash covers the essentials.'
      );
      const cards = $$('#use .card');
      if (cards[0]) { txt(cards[0].querySelector('h3'), 'Devis B2B', 'B2B quotes');     txt(cards[0].querySelector('p'), 'Qualification, périmètre, livrables, échéancier et conditions.', 'Qualification, scope, deliverables, schedule and terms.'); }
      if (cards[1]) { txt(cards[1].querySelector('h3'), 'Services',  'Services');       txt(cards[1].querySelector('p'), 'Marketing, design, développement, conseil, formation.', 'Marketing, design, development, consulting, training.'); }
      if (cards[2]) { txt(cards[2].querySelector('h3'), 'E-commerce','E-commerce');     txt(cards[2].querySelector('p'), 'Fiches produits, bundles et offres saisonnières structurées.', 'Product sheets, bundles and structured seasonal offers.'); }
    }

    const pricing = $('#pricing');
    if (pricing) {
      txt($('#pricing .h2'), 'Des plans clairs pour chaque besoin', 'Clear plans for every need');
      txt($('#pricing .sub'), 'Commencez gratuitement, évoluez quand vous êtes prêt.', 'Start free, upgrade when you’re ready.');

      const tiers = $$('.price-grid .pcard');

      if (tiers[0]) {
        txt(tiers[0].querySelector('.tier'),   'Gratuit', 'Free');
        txt(tiers[0].querySelector('.badge'),  '3/mois',  '3/mo');
        const l1 = tiers[0].querySelectorAll('.bullets li');
        if (l1[0]) l1[0].textContent = (getLang()==='en') ? '• 3 previews per month' : '• 3 aperçus par mois';
        if (l1[1]) l1[1].textContent = (getLang()==='en') ? '• Guided AI chat'       : '• Chat IA guidé';
        if (l1[2]) l1[2].textContent = (getLang()==='en') ? '• Watermarked PDF export': '• Export PDF verrouillé';
        txt(tiers[0].querySelector('a.btn'), 'Essayer', 'Try');
        attr(tiers[0].querySelector('a.btn'), 'title', 'L’export est réservé aux offres payantes', 'Export is for paid plans');
      }
      if (tiers[1]) {
        txt(tiers[1].querySelector('.tier'),  'Starter', 'Starter');
        txt(tiers[1].querySelector('.badge'), 'Populaire', 'Popular');
        const l2 = tiers[1].querySelectorAll('.bullets li');
        if (l2[0]) l2[0].textContent = (getLang()==='en') ? '• PDF without watermark' : '• PDF sans filigrane';
        if (l2[1]) l2[1].textContent = (getLang()==='en') ? '• 50 previews / month'   : '• 50 aperçus / mois';
        if (l2[2]) l2[2].textContent = (getLang()==='en') ? '• Up to 3 embedded proof points' : '• Jusqu’à 3 preuves intégrées';
        txt(tiers[1].querySelector('a.btn'), 'Choisir Starter', 'Choose Starter');
      }
      if (tiers[2]) {
        txt(tiers[2].querySelector('.tier'),  'Pro', 'Pro');
        txt(tiers[2].querySelector('.badge'), 'Équipes', 'Teams');
        const l3 = tiers[2].querySelectorAll('.bullets li');
        if (l3[0]) l3[0].textContent = (getLang()==='en') ? '• Unlimited previews' : '• Aperçus illimités';
        if (l3[1]) l3[1].textContent = (getLang()==='en') ? '• Unlimited sections & templates' : '• Sections & modèles illimités';
        if (l3[2]) l3[2].textContent = (getLang()==='en') ? '• Micro-sample if no proof' : '• Micro-échantillon si aucune preuve';
        txt(tiers[2].querySelector('a.btn'), 'Choisir Pro', 'Choose Pro');
      }
    }

    const f1 = $('footer .container > div:first-child');
    if (f1) f1.innerHTML = (getLang()==='en')
      ? `© <span id="y">${new Date().getFullYear()}</span> PropoFlash. All rights reserved.`
      : `© <span id="y">${new Date().getFullYear()}</span> PropoFlash. Tous droits réservés.`;
    const fLinks = $$('.footer a');
    if (fLinks[0]) fLinks[0].textContent = (getLang()==='en') ? 'Legal'   : 'Mentions légales';
    if (fLinks[1]) fLinks[1].textContent = (getLang()==='en') ? 'Privacy' : 'Confidentialité';
  }

  function applyAuth() {
    txt($('#ttl'),       'Bienvenue', 'Welcome');
    txt($('#sub'),       'Connectez-vous pour retrouver vos discussions et aperçus.', 'Sign in to access your chats and previews.');
    txt($('#gbtn'),      'Se connecter avec Google', 'Sign in with Google');
    txt($('#or'),        'ou', 'or');
    txt($('#lem'),       'Email', 'Email');
    txt($('#lpw'),       'Mot de passe', 'Password');
    txt($('#forgot'),    'Mot de passe oublié ?', 'Forgot password?');
    txt($('#submitBtn'), 'Se connecter', 'Log in');
    txt($('#noacc'),     'Pas de compte ?', 'No account?');
    const toggle = $('#toggleMode'); if (toggle) toggle.textContent = (getLang()==='en') ? 'Create an account' : 'Créer un compte';
    txt($('#back'),      '← Retour au site', '← Back to site');
    ph($('#email'),      'vous@email.com', 'you@email.com');
    ph($('#password'),   '••••••••', '••••••••');
  }

  function applyStudio() {
    txt($('#openHistory'), 'Historique', 'History');
    txt($('#newChatBtn'),  'Nouvelle discussion', 'New chat');
    txt($('#status'),       'Prêt', 'Ready');
    txt($('#logoutBtn'),    'Se déconnecter', 'Sign out');
    txt($('#chatTitle'),    'Chat', 'Chat');
    const hint = $('#chatHint');
    if (hint) hint.textContent = (getLang()==='en')
      ? 'Enter = send • Shift+Enter = new line'
      : 'Entrée = envoyer • Maj+Entrée = nouvelle ligne';
    const comp = $('#composer');
    if (comp) comp.placeholder = (getLang()==='en')
      ? 'Type your message'
      : 'Écrivez votre message';
    txt($('#histTitle'), 'Discussions', 'Discussions');
  }

  function applyPreview() {
    txt($('#backBtn'), '← Retour au chat', '← Back to chat');
    txt($('#pdfBtn'),  'Exporter PDF',     'Export PDF');
    const st = $('#status');
    if (st) st.textContent = (getLang()==='en') ? 'Loading preview…' : 'Chargement de l’aperçu…';
  }

  function applyPerPage() {
    syncLangPickers();
    const path = (location.pathname || '').toLowerCase();
    if (path.endsWith('/') || path.endsWith('/index.html') || path === '') applyIndex();
    if (path.endsWith('/auth.html'))     applyAuth();
    if (path.endsWith('/studio.html'))   applyStudio();
    if (path.endsWith('/preview.html'))  applyPreview();
  }

  document.addEventListener('DOMContentLoaded', applyPerPage);
  window.addEventListener('langchange', applyPerPage);
})();
