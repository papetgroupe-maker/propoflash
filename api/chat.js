export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
    const { message, proposalSpec } = req.body || {};

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

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ message, proposalSpec }) }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5
      })
    });

    const j = await r.json();
    const text = j.output?.[0]?.content?.[0]?.text ?? '{}';
    let out;
    try { out = JSON.parse(text); }
    catch { out = JSON.parse(text.replace(/,\s*}/g,'}').replace(/,\s*]/g,']')); }

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ reply: 'Erreur serveur', error: e.message });
  }
}
