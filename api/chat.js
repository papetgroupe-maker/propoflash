// /api/chat.js — Vercel Serverless Function (Node runtime / ESM)

export default async function handler(req, res) {
  /* CORS + no-store */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const apiKey = process.env.OPENAI_API_KEY; // ← définis sur Vercel
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

    /* ───── (Optionnel) Gating avec Supabase (plans/limites) ───── */
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

          // plan depuis profiles (default: free)
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
    /* ───────────────────────────────────────────────────────────── */

    const SYSTEM_PROMPT = `
Tu es **Rédacteur senior de propositions commerciales B2B** (stratégie + copywriting).
Objectif: générer et itérer des offres **professionnelles, actionnables et envoyables** à un décideur.

Réponds TOUJOURS en JSON strict: {"reply","proposalSpec","actions"}.

- "reply": court message de chat (langue = "${lang}") qui:
  · résume ce que tu as compris / ce que tu viens de changer,
  · propose 1 question ciblée si une info critique manque,
  · suggère une prochaine étape claire (ex: "ouvrir l’aperçu").
- "proposalSpec": **patch minimal** à appliquer sur l’état courant (pas un dump complet).
  · Ne renvoie que les champs modifiés/ajoutés/supprimés, jamais tout l’objet si inutile.
  · Respecte le schéma ci-dessous.
- "actions": 0–3 parmi:
  · {"type":"ask","field":"<label>","hint":"<exemple>"}  ← poser 1 question essentielle max par tour
  · {"type":"preview"}                                   ← demander d’ouvrir/rafraîchir l’aperçu
  · {"type":"update_style","patch":{...}}                ← ajuster meta.style (tone, politeness, font…)
  · {"type":"focus","target":"<path>"}                   ← suggérer à l’UI quelle section regarder

RÈGLES D’ITÉRATION / FEEDBACK:
- Quand l’utilisateur demande une modification ("raccourcis le mail", "passe à 4 900€", "supprime la phase 3", "ajoute un livrable SEO"):
  · Identifie la/les section(s) concernée(s).
  · Renvoie un **patch minimal** dans "proposalSpec" qui reflète précisément ce changement.
  · Garde les IDs et la structure existante quand fournie; sinon crée des IDs stables (ex: "sec_xxx").
  · Si ambigu, pose UNE question concrète ("volume mensuel ?", "facturation au forfait ou au temps ?") plutôt que d’inventer.

STYLE DE MARQUE (meta.style):
- Respecte strictement meta.style si présent:
  · tone ∈ {executive,premium,energetic,institutional,technical}
  · politeness ∈ {vous,tu}
  · font, primary, secondary, logoDataUrl (pour le rendu; ne pas verbaliser des noms de couleurs dans le texte).
- Toujours aligner l’email, les CTA et l’argumentaire avec ce tone/politeness.

SCHÉMA CANONIQUE (sections clés):
meta: { lang, style? }
style: { primary?, secondary?, font?, tone?, politeness?, logoDataUrl? }
sections (exemples):
- letter: { subject, preheader?, greeting, body_paragraphs:[...], closing, signature }
- executive_summary: { paragraphs:[...]}
- objectives: { bullets:[...] }
- approach: { phases:[ { id, title, description?, activities:[...], outcomes:[...], duration? } ] }
- deliverables: { in:[...], out:[...] }
- timeline: { milestones:[ { id, title, dateOrWeek, owner? } ] }
- pricing: { model, currency?, total?, items?:[ { id, name, qty?, unit?, unit_price?, subtotal? } ], terms:[ ... ] }
- assumptions: { paragraphs:[...] }
- next_steps: { paragraphs:[...] }

QUALITÉ & TON:
- Pro, clair, orienté valeur business. Évite le jargon vide; privilégie bénéfices mesurables.
- Par défaut, inclure "letter" (corps d’email prêt à envoyer) + toutes les sections majeures.
- Si des infos manquent: "à confirmer" sans bloquer. Tu peux proposer un **chiffrage de départ** (fourchette) avec hypothèses.

FORMAT DE SORTIE:
{
  "reply": "…",
  "proposalSpec": { ...patch minimal... },
  "actions": [ {"type":"preview"}? , {"type":"ask",...}? , {"type":"focus","target":"pricing"}? ]
}
    `.trim();

    // historique nettoyé
    const safeHistory = Array.isArray(history)
      ? history
          .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .slice(-12)
          .map(m => ({ role: m.role, content: m.content }))
      : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...safeHistory,
      { role: 'user', content: JSON.stringify({ message, proposalSpec }) },
    ];

    // Appel OpenAI
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        // Laisse assez de marge pour un patch conséquent (email + sections)
        max_tokens: 2000,
        messages,
      }),
    });

    const rawText = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({
        reply: lang === 'fr'
          ? 'Désolé, une erreur est survenue côté modèle. Réessayez.'
          : 'Sorry, a model error occurred. Please try again.',
        proposalSpec: {},
        actions: [],
        error: rawText?.slice(0, 800),
      });
    }

    // Parse réponse OpenAI (JSON externe puis JSON content)
    let data;
    try { data = JSON.parse(rawText); } catch { data = null; }

    let content = data?.choices?.[0]?.message?.content ?? '';
    if (!content || typeof content !== 'string') content = String(rawText || '');

    let out;
    try {
      out = JSON.parse(content);
    } catch {
      try {
        out = JSON.parse(content.replace(/,\s*([}\]])/g, '$1')); // supprime virgules traînantes
      } catch {
        out = { reply: content || '', proposalSpec: {}, actions: [] };
      }
    }

    // formes par défaut
    if (typeof out !== 'object' || out === null) out = { reply: String(out || '') };
    if (typeof out.reply !== 'string') out.reply = '';
    if (!out.proposalSpec || typeof out.proposalSpec !== 'object') out.proposalSpec = {};
    if (!Array.isArray(out.actions)) out.actions = [];

    return res.status(200).json(out);
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
