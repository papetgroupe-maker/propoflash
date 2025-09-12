// /api/chat.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === PROMPT STABLE AVEC STYLE (optionnel) ===
const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist & Bid Writer (FR/EN).
OBJECTIF: produire à chaque échange:
- "reply": texte lisible
- "proposalSpec": schéma structuré
- éventuellement des "style tokens" dans proposalSpec.meta.style
Format JSON STRICT (pas de texte hors JSON):
{
  "reply": "<texte>",
  "proposalSpec": {
    "meta": {
      "lang": "fr|en",
      "title": "",
      "company": "",
      "client": "",
      "date": "",
      "currency": "EUR",
      "style": {
        "themeId": "minimal-slate|modern-mono|bold-yellow|soft-pastel|tech-blue",
        "primary": "#3B82F6",
        "secondary": "#8B5CF6",
        "paper": "#FFFFFF",
        "ink": "#0A1020",
        "muted": "#5C667A",
        "stroke": "#E7ECF6",
        "radius": 12,
        "shadow": "soft|none|hard",
        "fonts": { "headings": "Inter", "body": "Inter" },
        "derivedFrom": "user-intent|logo|default"
      }
    },
    "letter": { "subject":"", "preheader":"", "greeting":"", "body_paragraphs":[""], "closing":"", "signature":"" },
    "executive_summary": { "paragraphs":[""] },
    "objectives": { "bullets":[""] },
    "approach": { "phases":[{ "title":"", "duration":"", "activities":[""], "outcomes":[""] }] },
    "deliverables": { "in":[""], "out":[""] },
    "timeline": { "milestones":[{ "title":"", "dateOrWeek":"", "notes":"" }] },
    "pricing": { "model":"forfait|regie", "currency":"EUR",
                 "items":[{ "name":"", "qty":1, "unit":"jour|mois|forfait", "unit_price":0, "subtotal":0 }],
                 "tax_rate":20, "terms":[""], "price": null },
    "assumptions": { "paragraphs":[""] },
    "next_steps": { "paragraphs":[""] }
  },
  "actions": [{ "type":"preview" } | { "type":"ask", "field":"meta.client", "hint":"Quel est le client ?" }]
}

RÈGLES:
- Langue = FR par défaut si ambigu.
- Si info manquante => actions: ask.
- Pricing: si incertain → items + hypothèses + marquer "à confirmer".
- Style: si l’utilisateur exprime un thème/couleur → respecte; sinon suggère un thème cohérent (minimal-slate par défaut).
- NE RENVOIE QUE LE JSON DEMANDÉ.
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }

  try {
    const { message, proposalSpec, history = [] } = req.body || {};

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || ''
      })),
      proposalSpec ? { role: 'user', content: `Spec actuelle:\n${JSON.stringify(proposalSpec)}` } : null,
      { role: 'user', content: message || '' },
    ].filter(Boolean);

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages
    });

    let out = {};
    try {
      out = JSON.parse(resp.choices?.[0]?.message?.content || '{}');
    } catch {
      out = { reply: "Je n’ai pas pu structurer la proposition. Reformulez.", actions: [] };
    }

    // Merge safe: on n’écrase pas le style/meta existant
    if (out.proposalSpec) {
      const prevMeta = (proposalSpec && proposalSpec.meta) || {};
      const nextMeta = { ...prevMeta, ...(out.proposalSpec.meta || {}) };
      const mergedStyle = { ...(prevMeta.style || {}), ...((out.proposalSpec.meta || {}).style || {}) };
      out.proposalSpec.meta = { ...nextMeta, style: mergedStyle };
    }

    res.status(200).json(out);
  } catch (e) {
    console.error('API /api/chat error:', e);
    res.status(200).json({
      reply: "Erreur serveur. Réessayez un peu plus tard.",
      actions: []
    });
  }
}
