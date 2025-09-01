// /api/chat.js — Vercel Serverless Function (Node runtime)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY on Vercel' });
    }

    // On accepte des champs facultatifs
    const { message = '', proposalSpec = null, history = [] } = req.body || {};

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

    // On garde un petit historique si tu veux faire une vraie conversation.
    const msgs = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(Array.isArray(history) ? history : []).slice(-8), // sécurité
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
        messages: msgs,
      }),
    });

    const raw = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({ error: 'OpenAI error', detail: raw });
    }

    // raw -> JSON OpenAI -> content (string JSON) -> objet
    let data; try { data = JSON.parse(raw); } catch {}
    let content = data?.choices?.[0]?.message?.content ?? raw;

    let out;
    try {
      out = JSON.parse(content);
    } catch {
      // Tolérance légère aux virgules traînantes
      out = JSON.parse(content.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
    }

    return res.status(200).json(out);
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ reply: 'Erreur serveur', error: e.message });
  }
}
