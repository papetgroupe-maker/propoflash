// /api/chat.js — Vercel Serverless Function (Node runtime / ESM)

export default async function handler(req, res) {
  // CORS + no-store
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        reply: '',
        proposalSpec: {},
        actions: [],
        error: 'Missing OPENAI_API_KEY on Vercel'
      });
    }

    const { message = '', proposalSpec = {}, history = [] } = req.body || {};
    const lang =
      (proposalSpec && proposalSpec.meta && proposalSpec.meta.lang) ? String(proposalSpec.meta.lang) : 'fr';

    /* ---------- (Optionnel) Gating côté serveur via Supabase ---------- */
    const supaUrl = process.env.SUPABASE_URL;
    const supaSrv = process.env.SUPABASE_SERVICE_ROLE; // clé service rôle
    const authHeader = req.headers.authorization || '';
    const supaJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (supaUrl && supaSrv && supaJwt) {
      try {
        const { createClient } = await import('@supabase/supabase-js');

        const sbAdmin = createClient(supaUrl, supaSrv, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        // Vérifie le JWT et récupère l'utilisateur
        const { data: userData, error: userErr } = await sbAdmin.auth.getUser(supaJwt);
        if (!userErr && userData?.user) {
          const uid = userData.user.id;

          // Plan depuis profiles (défaut free)
          let plan = 'free';
          const { data: prof, error: profErr } = await sbAdmin
            .from('profiles')
            .select('plan')
            .eq('id', uid)
            .maybeSingle();

          if (!profErr && prof?.plan) plan = String(prof.plan);

          // Limites mensuelles
          const LIMITS = { free: 3, starter: 50, pro: Number.POSITIVE_INFINITY };
          const limit = LIMITS[plan] ?? 3;

          if (Number.isFinite(limit)) {
            // bornes du mois en UTC
            const now = new Date();
            const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
            const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

            // On compte les messages assistant du mois (préviews générées)
            const { count, error: cntErr } = await sbAdmin
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', uid)
              .eq('role', 'assistant')
              .gte('created_at', start.toISOString())
              .lt('created_at', end.toISOString());

            if (!cntErr && typeof count === 'number' && count >= limit) {
              return res.status(402).json({
                reply:
                  lang === 'fr'
                    ? "Limite atteinte pour votre plan. Passez à Starter pour davantage d’aperçus et l’export PDF."
                    : "Limit reached for your plan. Upgrade to Starter for more previews and PDF export.",
                proposalSpec: {},
                actions: [{ type: 'upgrade' }]
              });
            }
          }
        }
      } catch (gErr) {
        // On n'empêche pas l'appel modèle si Supabase est mal configuré : on loggue et on continue.
        console.warn('Supabase gating warning:', gErr?.message || gErr);
      }
    }
    /* ------------------------------------------------------------------ */

    const SYSTEM_PROMPT = `
Tu es un rédacteur de propositions B2B senior.
Réponds TOUJOURS en JSON strict: {"reply","proposalSpec","actions"}.
- "reply": texte court pour le chat (langue = "${lang}").
- "proposalSpec": meta/style/sections (patch minimal).
- "actions": 0–2 parmi {"type":"ask","field":"...","hint":"..."}, {"type":"preview"}, {"type":"update_style","patch":{...}}.
Règles:
- Pose 1–2 questions ciblées UNIQUEMENT si info essentielle manquante (ne répète pas ce qui est déjà fourni).
- Style pro, clair, orienté résultats.
- Si des infos manquent: mets "à confirmer" sans bloquer.
Structure: letter, executive_summary, objectives, approach(phases[]), deliverables(in/out), timeline(milestones[]), pricing(model/price/terms[]), assumptions(paragraphs[]), next_steps(paragraphs[]).
    `.trim();

    // Normalisation de l’historique (sécurité)
    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              typeof m.content === 'string' &&
              (m.role === 'user' || m.role === 'assistant')
          )
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...safeHistory,
      { role: 'user', content: JSON.stringify({ message, proposalSpec }) }
    ];

    // --- Appel modèle ---
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        response_format: { type: 'json_object' },
        // max_tokens : laisse le modèle court, on peut fixer si besoin
        messages
      })
    });

    const rawText = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({
        reply:
          lang === 'fr'
            ? 'Désolé, une erreur est survenue côté modèle. Réessayez.'
            : 'Sorry, a model error occurred. Please try again.',
        proposalSpec: {},
        actions: [],
        error: rawText?.slice(0, 800)
      });
    }

    // Parse réponse OpenAI (JSON d'OpenAI puis JSON du content)
    let data;
    try { data = JSON.parse(rawText); } catch { data = null; }

    let content = data?.choices?.[0]?.message?.content ?? '';
    if (!content || typeof content !== 'string') {
      content = typeof rawText === 'string' ? rawText : '';
    }

    let out;
    try {
      out = JSON.parse(content);
    } catch {
      try {
        const fixed = content.replace(/,\s*([}\]])/g, '$1'); // supprime virgules traînantes
        out = JSON.parse(fixed);
      } catch {
        out = { reply: content || '', proposalSpec: {}, actions: [] };
      }
    }

    // Défauts sûrs
    if (typeof out !== 'object' || out === null) out = { reply: String(out || '') };
    if (!('reply' in out) || typeof out.reply !== 'string') out.reply = '';
    if (!('proposalSpec' in out) || typeof out.proposalSpec !== 'object' || out.proposalSpec === null) {
      out.proposalSpec = {};
    }
    if (!('actions' in out) || !Array.isArray(out.actions)) out.actions = [];

    return res.status(200).json(out);
  } catch (e) {
    console.error('API /api/chat error:', e);
    return res.status(500).json({
      reply: 'Erreur serveur',
      proposalSpec: {},
      actions: [],
      error: e?.message?.slice(0, 500) || 'unknown'
    });
  }
}
