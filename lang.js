// lang.js — i18n global (FR/EN) avec application auto par page
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
    // notifie toutes les pages/composants
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  // expose global
  window.getLang = getLang;
  window.setLang = setLang;

  // init
  document.documentElement.lang = getLang();

  // Helpers DOM
  const Q = (sel, ctx = document) => ctx.querySelector(sel);
  const QA = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const setTxt = (sel, fr, en) => { const el = Q(sel); if (el) el.textContent = (getLang() === 'en' ? en : fr); };
  const setHTML = (sel, fr, en) => { const el = Q(sel); if (el) el.innerHTML = (getLang() === 'en' ? en : fr); };
  const setPH = (sel, fr, en) => { const el = Q(sel); if (el) el.placeholder = (getLang() === 'en' ? en : fr); };
  const setAttr = (sel, attr, fr, en) => { const el = Q(sel); if (el) el.setAttribute(attr, (getLang() === 'en' ? en : fr)); };

  // Application par page
  function applyPageTranslations() {
    const lang = getLang();
    // Aligne tous les sélecteurs de langue <select data-lang-picker>
    QA('select[data-lang-picker]').forEach((sel) => { sel.value = lang; });

    const path = (location.pathname || '').toLowerCase();

    // ===== INDEX =====
    if (path.endsWith('/') || path.endsWith('/index.html') || path === '' ) {
      // NAV
      setTxt('.menu a[href="#why"]', 'Pourquoi nous', 'Why us');
      setTxt('.menu a[href="#use"]', 'Cas d’usage', 'Use cases');
      setTxt('.menu a[href="#pricing"]', 'Tarifs', 'Pricing');

      setTxt('#authBtn', 'Se connecter', 'Sign in');
      setTxt('#startBtn', 'Commencer', 'Start');

      // HERO
      setHTML('.lead h1',
        'Donnez vie à vos propositions. <span class="accent-word">Maintenant.</span>',
        'Bring your proposals to life. <span class="accent-word">Now.</span>'
      );
      setTxt('#heroSub',
        'Générez des offres et propositions professionnelles en minutes, à partir d’un simple brief. Zéro complexité.',
        'Create professional proposals in minutes from a simple brief. Zero complexity.'
      );
      setPH('#brief', 'Collez votre brief ici…', 'Paste your brief here…');
      setAttr('#sendBrief', 'title', 'Envoyer', 'Send');
      setAttr('#sendBrief', 'aria-label', 'Envoyer', 'Send');

      // SECTION — Pourquoi
      const why = Q('#why');
      if (why) {
        setTxt('#why .h2', 'Pourquoi PropoFlash ?', 'Why PropoFlash?');
        setTxt('#why .sub',
          'Notre signature : qualité éditoriale + exécution instantanée, sans vous perdre dans des outils.',
          'Our signature: editorial quality + instant execution, without getting lost in tools.'
        );
        const cards = QA('#why .card');
        if (cards[0]) { setTxt(cards[0].querySelector('h3'), 'Rédaction premium', 'Premium writing'); setTxt(cards[0].querySelector('p'), 'Ton professionnel, argumentation claire, structure prête à envoyer à des décideurs.', 'Professional tone, clear arguments, structure ready for decision-makers.'); }
        if (cards[1]) { setTxt(cards[1].querySelector('h3'), 'Adaptée au contexte', 'Context-aware'); setTxt(cards[1].querySelector('p'), 'Chaque proposition s’appuie sur votre brief et vos preuves pour coller à l’objectif.', 'Each proposal uses your brief and proof points to match the goal.'); }
        if (cards[2]) { setTxt(cards[2].querySelector('h3'), 'Aperçu instantané', 'Instant preview'); setTxt(cards[2].querySelector('p'), 'Vous collez le brief, vous prévisualisez, vous peaufinez — puis PDF en 1 clic.', 'Paste your brief, preview, refine — then one-click PDF.'); }
      }

      // SECTION — Cas d’usage
      const use = Q('#use');
      if (use) {
        setTxt('#use .h2', 'Cas d’usage fréquents', 'Common use cases');
        setTxt('#use .sub', 'Du devis B2B aux offres e-commerce, PropoFlash couvre les besoins essentiels.', 'From B2B quotes to e-commerce offers, PropoFlash covers the essentials.');
        const cards = QA('#use .card');
        if (cards[0]) { setTxt(cards[0].querySelector('h3'), 'Devis B2B', 'B2B quotes'); setTxt(cards[0].querySelector('p'), 'Qualification, périmètre, livrables, échéancier et conditions.', 'Qualification, scope, deliverables, schedule and terms.'); }
        if (cards[1]) { setTxt(cards[1].querySelector('h3'), 'Services', 'Services'); setTxt(cards[1].querySelector('p'), 'Marketing, design, développement, conseil, formation.', 'Marketing, design, development, consulting, training.'); }
        if (cards[2]) { setTxt(cards[2].querySelector('h3'), 'E-commerce', 'E-commerce'); setTxt(cards[2].querySelector('p'), 'Fiches produits, bundles et offres saisonnières structurées.', 'Product sheets, bundles and structured seasonal offers.'); }
      }

      // SECTION — Pricing
      const pr = Q('#pricing');
      if (pr) {
        setTxt('#pricing .h2', 'Des plans clairs pour chaque besoin', 'Clear plans for every need');
        setTxt('#pricing .sub', 'Commencez gratuitement, évoluez quand vous êtes prêt.', 'Start free, upgrade when you’re ready.');
        const tiers = QA('.price-grid .pcard');
        // Gratuit
        if (tiers[0]) {
          setTxt(tiers[0].querySelector('.tier'), 'Gratuit', 'Free');
          setTxt(tiers[0].querySelector('.badge'), '3/mois', '3/mo');
          setTxt(tiers[0].querySelector('.bullets li:nth-child(1)'), '• 3 aperçus par mois', '• 3 previews per month');
          setTxt(tiers[0].querySelector('.bullets li:nth-child(2)'), '• Chat IA guidé', '• Guided AI chat');
          setTxt(tiers[0].querySelector('.bullets li:nth-child(3)'), '• Export PDF verrouillé', '• Watermarked PDF export');
          setTxt(tiers[0].querySelector('a.btn'), 'Essayer', 'Try');
          setAttr(tiers[0].querySelector('a.btn'), 'title', 'L’export est réservé aux offres payantes', 'Export is for paid plans');
        }
        // Starter
        if (tiers[1]) {
          setTxt(tiers[1].querySelector('.tier'), 'Starter', 'Starter');
          setTxt(tiers[1].querySelector('.badge'), 'Populaire', 'Popular');
          setTxt(tiers[1].querySelector('.bullets li:nth-child(1)'), '• PDF sans filigrane', '• PDF without watermark');
          setTxt(tiers[1].querySelector('.bullets li:nth-child(2)'), '• 50 aperçus / mois', '• 50 previews / month');
          setTxt(tiers[1].querySelector('.bullets li:nth-child(3)'), '• Jusqu’à 3 preuves intégrées', '• Up to 3 embedded proof points');
          setTxt(tiers[1].querySelector('a.btn'), 'Choisir Starter', 'Choose Starter');
        }
        // Pro
        if (tiers[2]) {
          setTxt(tiers[2].querySelector('.tier'), 'Pro', 'Pro');
          setTxt(tiers[2].querySelector('.badge'), 'Équipes', 'Teams');
          setTxt(tiers[2].querySelector('.bullets li:nth-child(1)'), '• Aperçus illimités', '• Unlimited previews');
          setTxt(tiers[2].querySelector('.bullets li:nth-child(2)'), '• Sections & modèles illimités', '• Unlimited sections & templates');
          setTxt(tiers[2].querySelector('.bullets li:nth-child(3)'), '• Micro-échantillon si aucune preuve', '• Micro-sample if no proof');
          setTxt(tiers[2].querySelector('a.btn'), 'Choisir Pro', 'Choose Pro');
        }
      }

      // FOOTER
      setHTML('footer .container > div:first-child',
        `© <span id="y">${new Date().getFullYear()}</span> PropoFlash. Tous droits réservés.`,
        `© <span id="y">${new Date().getFullYear()}</span> PropoFlash. All rights reserved.`
      );
      const fLinks = QA('.footer a');
      if (fLinks[0]) fLinks[0].textContent = (lang === 'en' ? 'Legal' : 'Mentions légales');
      if (fLinks[1]) fLinks[1].textContent = (lang === 'en' ? 'Privacy' : 'Confidentialité');
    }

    // ===== AUTH =====
    if (path.endsWith('/auth.html')) {
      setTxt('#ttl', 'Bienvenue', 'Welcome');
      setTxt('#sub', 'Connectez-vous pour retrouver vos discussions et aperçus.', 'Sign in to access your chats and previews.');
      setTxt('#gbtn', 'Se connecter avec Google', 'Sign in with Google');
      setTxt('#or', 'ou', 'or');
      setTxt('#lem', 'Email', 'Email');
      setTxt('#lpw', 'Mot de passe', 'Password');
      setTxt('#forgot', 'Mot de passe oublié ?', 'Forgot password?');
      setTxt('#submitBtn', 'Se connecter', 'Log in');
      setTxt('#noacc', 'Pas de compte ?', 'No account?');
      const toggle = Q('#toggleMode'); if (toggle) toggle.textContent = (lang === 'en' ? 'Create an account' : 'Créer un compte');
      setTxt('#back', '← Retour au site', '← Back to site');
      // placeholders
      setPH('#email', 'vous@email.com', 'you@email.com');
      setPH('#password', '••••••••', '••••••••');
    }

    // ===== STUDIO =====
    if (path.endsWith('/studio.html')) {
      // Top bar
      setTxt('#openHistory', 'Historique', 'History');
      setTxt('#status', 'Prêt', 'Ready');
      // Menu
      setTxt('#logoutBtn', 'Se déconnecter', 'Sign out');
      // Chat area
      setTxt('#chatTitle', 'Chat', 'Chat');
      const hint = Q('#chatHint');
      if (hint) hint.textContent = (lang === 'en' ? 'Enter = send • Shift+Enter = new line' : 'Entrée = envoyer • Maj+Entrée = nouvelle ligne');
      // Composer placeholder
      const comp = Q('#composer'); if (comp) comp.placeholder = (lang === 'en' ? 'Type your message' : 'Écrivez votre message');
    }

    // ===== PREVIEW =====
    if (path.endsWith('/preview.html')) {
      setTxt('#brandBtn', 'PropoFlash', 'PropoFlash');
      setTxt('#backBtn', '← Retour au chat', '← Back to chat');
      setTxt('#pdfBtn', 'Exporter PDF', 'Export PDF');
      const st = Q('#status'); if (st) st.textContent = (lang === 'en' ? 'Loading preview…' : 'Chargement de l’aperçu…');
    }
  }

  // Lancer au chargement du DOM puis à chaque changement de langue
  document.addEventListener('DOMContentLoaded', () => {
    applyPageTranslations();
  });
  window.addEventListener('langchange', () => {
    applyPageTranslations();
  });
})();
