// /api/chat.js — Vercel Serverless Function (Node runtime)
export default async function handler(req, res) {
  // (optionnel) CORS simple + no-store pour éviter tout cache gênant
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
      return res.status(500).json({ reply: '', proposalSpec: {}, actions: [], error: 'Missing OPENAI_API_KEY on Vercel' });
    }

    const { message = '', proposalSpec = {}, history = [] } = req.body || {};

    const SYSTEM_PROMPT = `
Tu es un rédacteur de propositions B2B senior.
Réponds TOUJOURS en JSON strict: {"reply","proposalSpec","actions"}.
- "reply": texte court pour le chat (langue = proposalSpec.meta.lang).
- "proposalSpec": meta/style/sections (patch minimal).
- "actions": 0–2 parmi {"type":"ask","field":"...","hint":"..."}, {"type":"preview"}, {"type":"update_style","patch":{...}}.
Règles:
- Pose 1–2 questions ciblées UNIQUEMENT si info essentielle manquante (ne répète pas ce qui est déjà fourni).
- Style pro, clair, orienté résultats.
- Si des infos manquent: mets "à confirmer" sans bloquer.
Structure: letter, executive_summary, objectives, approach(phases[]), deliverables(in/out), timeline(milestones[]), pricing(model/price/terms[]), assumptions(paragraphs[]), next_steps(paragraphs[]).
`.trim();

    // Normalisation de l’historique (sécurité)
    const safeHistory = Array.isArray(history) ? history
      .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content })) : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...safeHistory,
      { role: 'user', content: JSON.stringify({ message, proposalSpec }) }
    ];

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages
      }),
    });

    const rawText = await r.text();
    if (!r.ok) {
      // On renvoie un objet sûr pour que le front n’affiche jamais "undefined"
      return res.status(r.status).json({
        reply: "Désolé, une erreur est survenue côté modèle. Réessayez.",
        proposalSpec: {},
        actions: [],
        error: rawText?.slice(0, 500)
      });
    }

    // Parse la réponse OpenAI
    let data;
    try { data = JSON.parse(rawText); } catch { data = null; }

    // Récupère le "content" (le JSON string retourné par le modèle)
    let content = data?.choices?.[0]?.message?.content ?? '';

    // Filets de sécurité: si vide, essaie d’autres champs ou renvoie une chaîne sûre
    if (!content || typeof content !== 'string') {
      content = typeof rawText === 'string' ? rawText : '';
    }

    // Tente de parser le JSON; en cas d’échec, tente une réparation légère
    let out;
    try {
      out = JSON.parse(content);
    } catch {
      try {
        const fixed = content.replace(/,\s*([}\]])/g, '$1'); // supprime virgules traînantes
        out = JSON.parse(fixed);
      } catch {
        // Dernier fallback: renvoyer un objet minimal lisible par le front
        out = { reply: content || '', proposalSpec: {}, actions: [] };
      }
    }

    // Défauts pour éviter tout "undefined" côté front
    if (typeof out !== 'object' || out === null) out = { reply: String(out || '') };
    if (!('reply' in out) || typeof out.reply !== 'string') out.reply = '';
    if (!('proposalSpec' in out) || typeof out.proposalSpec !== 'object' || out.proposalSpec === null) out.proposalSpec = {};
    if (!('actions' in out) || !Array.isArray(out.actions)) out.actions = [];

    return res.status(200).json(out);
  } catch (e) {
    console.error('API /api/chat error:', e);
    return res.status(500).json({
      reply: 'Erreur serveur',
      proposalSpec: {},
      actions: [],
      error: e?.message?.slice(0, 300) || 'unknown'
    });
  }
}
