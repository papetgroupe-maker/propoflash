// /api/chat.js — Vercel Serverless Function (Node runtime / ESM)

export default async function handler(req, res) {
  /* CORS + no-store */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  // --- petits utilitaires ---
  const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const stripTrailingCommas = (s) => s.replace(/,\s*([}\]])/g, '$1');

  const deepMerge = (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) return b; // on remplace (sections, phases, etc.)
    if (a && typeof a === 'object' && b && typeof b === 'object') {
      const out = { ...a };
      for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
      return out;
    }
    return b === undefined ? a : b;
  };

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        reply: '',
        proposalSpec: {},
        actions: [],
        error: 'Missing OPENAI_API_KEY on Vercel',
      });
    }

    const { message = '', proposalSpec = {}, history = [] } = req.body || {};
    const lang = proposalSpec?.meta?.lang ? String(proposalSpec.meta.lang) : 'fr';
    const style = proposalSpec?.meta?.style || {}; // ex. {voice, tone, forbid[], currency, pages, etc.}
    const quality = proposalSpec?.meta?.quality || 'strict'; // 'strict' par défaut

    /* ───── (Optionnel) Gating Supabase (plans/limites) ───── */
    const supaUrl = process.env.SUPABASE_URL;
    const supaSrv = process.env.SUPABASE_SERVICE_ROLE;
    const authHeader = req.headers.authorization || '';
    const supaJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (supaUrl && supaSrv && supaJwt) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sbAdmin = createClient(supaUrl, supaSrv, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: u, error: uErr } = await sbAdmin.auth.getUser(supaJwt);
        if (!uErr && u?.user) {
          const uid = u.user.id;
          // plan
          let plan = 'free';
          const { data: prof, error: pErr } = await sbAdmin
            .from('profiles')
            .select('plan')
            .eq('id', uid)
            .maybeSingle();
          if (!pErr && prof?.plan) plan = String(prof.plan);

          const LIMITS = { free: 3, starter: 50, pro: Number.POSITIVE_INFINITY };
          const limit = LIMITS[plan] ?? 3;

          if (Number.isFinite(limit)) {
            const now = new Date();
            const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
            const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
            const { count, error: cErr } = await sbAdmin
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', uid)
              .eq('role', 'assistant')
              .gte('created_at', start.toISOString())
              .lt('created_at',  end.toISOString());
            if (!cErr && typeof count === 'number' && count >= limit) {
              return res.status(402).json({
                reply: lang === 'fr'
                  ? "Limite atteinte pour votre plan. Passez à Starter pour davantage d’aperçus et l’export PDF."
                  : "Limit reached for your plan. Upgrade to Starter for more previews and PDF export.",
                proposalSpec: {},
                actions: [{ type: 'upgrade' }],
              });
            }
          }
        }
      } catch (gErr) {
        console.warn('Supabase gating warning:', gErr?.message || gErr);
      }
    }
    /* ──────────────────────────────────────────────────────── */

    // ========= PROMPTS HAUTE QUALITÉ =========
    const STYLE_RULES = `
Règles de style fermes:
- Langue: "${lang}". Respecte la typographie locale (espaces insécables avant : ; ? ! en FR si nécessaire).
- Ton: ${style.tone || 'professionnel, clair, confiant'} ; Voix: ${style.voice || 'exécutive/concise'}.
- Interdits (remplacer par concret): ${Array.isArray(style.forbid) ? style.forbid.join(', ') : 'synergie, best-in-class, solution clé en main, révolutionner'}.
- Jamais inventer de chiffres/preuves. Utiliser "à confirmer" quand l’info manque.
- Orienté valeur et résultat, pas de remplissage. Phrases courtes. Listes à puces denses.
- Chiffrages: ${style.currency || 'EUR'} ; formats FR (1 234,56). Si incertitude → fourchettes + hypothèses.
- Prix: modèle, inclus/exclus, jalons de facturation, conditions (validité, délais, révisions).
- Toujours proposer des "next_steps" actionnables (appel, atelier, livrables attendus côté client).
    `.trim();

    const STRUCTURE_RULES = `
Structure cible (complète mais compacte):
- letter
- executive_summary
- objectives
- approach (phases[])
- deliverables (in/out)
- timeline (milestones[])
- pricing (model, price, terms[])
- assumptions (paragraphs[])
- risks (mitigations[]) si pertinent
- next_steps (paragraphs[])
Toujours marquer les trous par "à confirmer" sans bloquer. 
    `.trim();

    const SYSTEM_PROMPT = `
Tu es un RÉDACTEUR DE PROPOSITIONS B2B senior.
Tu dois générer UNIQUEMENT du JSON strict: {"reply","proposalSpec","actions"}.
${STYLE_RULES}

${STRUCTURE_RULES}

Comportement:
- Pose max 2 questions UNIQUEMENT si l'information est indispensable à la validité (pas de redites).
- "reply": très courte réponse de chat (2–3 phrases max).
- "proposalSpec": patch minimal (meta/style/sections). Ne réécris pas tout si un patch suffit.
- "actions": parmi {"type":"ask","field","hint"}, {"type":"preview"}, {"type":"update_style","patch":{...}}.

Ne fournis aucune explication hors JSON. 
Si un élément n'est pas justifié par le brief ou le style, mets "à confirmer".
`.trim();

    const CRITIC_PROMPT = `
Tu es RELECTEUR/QA de propositions B2B.
Objectif: élever la proposition au niveau "direction" sans blabla.
Retourne du JSON strict: {"reply","scorecard","issues","proposalSpecPatch","actions"}.

Règles:
- Évalue: ton/voix, clarté, adéquation objectifs, différenciation, crédibilité, pricing/ROI, risques/assumptions, next_steps.
- Ne jamais inventer. Remplacer les zones floues par "à confirmer" + hypothèse courte.
- "proposalSpecPatch": un patch minimal et sûr (pas de refonte totale inutile).
- "reply": 1 phrase max (ex: "J'ai resserré le pricing, clarifié les hypothèses et renforcé l’ESG.").
`.trim();

    // historique nettoyé
    const safeHistory = Array.isArray(history)
      ? history
          .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .slice(-12)
          .map(m => ({ role: m.role, content: m.content }))
      : [];

    const baseMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...safeHistory,
      { role: 'user', content: JSON.stringify({ message, proposalSpec, style, lang }) },
    ];

    // === 1) PASSAGE RÉDACTEUR ===
    const r1 = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: baseMessages
      }),
    });
    const raw1 = await r1.text();
    if (!r1.ok) {
      return res.status(r1.status).json({
        reply: lang === 'fr'
          ? 'Désolé, une erreur est survenue côté modèle. Réessayez.'
          : 'Sorry, a model error occurred. Please try again.',
        proposalSpec: {},
        actions: [],
        error: raw1?.slice(0, 800),
      });
    }

    let out = safeJson(raw1)?.choices?.[0]?.message?.content || '';
    if (typeof out !== 'string') out = String(out || '');
    let draft = safeJson(out) || safeJson(stripTrailingCommas(out)) || { reply: out || '', proposalSpec: {}, actions: [] };

    // formes par défaut
    if (typeof draft !== 'object' || draft === null) draft = { reply: String(draft || '') };
    if (typeof draft.reply !== 'string') draft.reply = '';
    if (!draft.proposalSpec || typeof draft.proposalSpec !== 'object') draft.proposalSpec = {};
    if (!Array.isArray(draft.actions)) draft.actions = [];

    // === 2) PASSAGE RELECTEUR/QA (si quality=strict) ===
    let mergedSpec = deepMerge(proposalSpec || {}, draft.proposalSpec || {});
    if (quality === 'strict') {
      const criticMessages = [
        { role: 'system', content: CRITIC_PROMPT + '\n' + STYLE_RULES + '\n' + STRUCTURE_RULES },
        { role: 'user', content: JSON.stringify({
            lang, style, brief: message, draft: mergedSpec
          }) }
      ];

      const r2 = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: criticMessages
        }),
      });

      const raw2 = await r2.text();
      if (r2.ok) {
        let criticOut = safeJson(raw2)?.choices?.[0]?.message?.content || '';
        if (typeof criticOut !== 'string') criticOut = String(criticOut || '');
        let review = safeJson(criticOut) || safeJson(stripTrailingCommas(criticOut));
        if (review && typeof review === 'object') {
          if (review.proposalSpecPatch && typeof review.proposalSpecPatch === 'object') {
            mergedSpec = deepMerge(mergedSpec, review.proposalSpecPatch);
          }
          // Option: raccourcir la reply
          if (typeof review.reply === 'string' && review.reply.trim()) {
            draft.reply = review.reply.trim();
          }
          // On pousse un preview si on a un contenu exploitable
          if (!Array.isArray(draft.actions)) draft.actions = [];
          const hasSections = mergedSpec && (
            (Array.isArray(mergedSpec.sections) && mergedSpec.sections.length) ||
            Object.keys(mergedSpec).length > 0
          );
          if (hasSections && !draft.actions.some(a => a.type === 'preview')) {
            draft.actions.push({ type: 'preview' });
          }
        }
      } else {
        // En cas d'échec du relecteur, on continue avec le 1er jet
        console.warn('Critic pass failed:', raw2?.slice(0, 400));
      }
    }

    // sortie finale
    const finalOut = {
      reply: (draft.reply || '').slice(0, 600),
      proposalSpec: mergedSpec || {},
      actions: Array.isArray(draft.actions) ? draft.actions.slice(0, 2) : [],
    };

    return res.status(200).json(finalOut);
  } catch (e) {
    console.error('API /api/chat error:', e);
    return res.status(500).json({
      reply: 'Erreur serveur',
      proposalSpec: {},
      actions: [],
      error: e?.message?.slice(0, 500) || 'unknown',
    });
  }
}
