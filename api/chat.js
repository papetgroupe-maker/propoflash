// Vercel Serverless Function — /api/chat.js
// Node.js 18+ (runtime par défaut sur Vercel)

import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing" });
    }
    const openai = new OpenAI({ apiKey });

    const { message, proposalSpec = null, history = [] } = req.body || {};

    // Sécurité : tronquer l'historique si besoin
    const shortHistory = Array.isArray(history) ? history.slice(-12) : [];

    // Le modèle doit retourner STRICTEMENT un JSON avec { reply, proposalSpec }
    const systemPrompt = `
Tu es **PropoFlash**, IA experte en propositions commerciales (FR par défaut).
Ta mission à chaque tour :
1) Répondre à l’utilisateur dans un style pro et concis (champ "reply" en français).
2) Mettre à jour une **spec de proposition** (champ "proposalSpec") qui pilote l’aperçu HTML/CSS.

### Règles de la spec
- Tu reçois "current" (la spec existante). **Tu complètes et améliores**; tu ne supprimes rien sauf si l’utilisateur l’exige explicitement.
- Structure EXACTE attendue (toutes les clés sont optionnelles mais conseillées) :

{
  "meta": {
    "lang": "fr|en",
    "title": "string",
    "company": "string",
    "client": "string",
    "date": "YYYY-MM-DD",
    "currency": "EUR",
    "style": {
      "palette": { "primary": "hex/hsl", "secondary": "hex/hsl", "surface": "hex/hsl", "ink":"hex/hsl", "muted":"hex/hsl", "stroke":"hex/hsl", "accentA":"hex/hsl", "accentB":"hex/hsl" },
      "shapes": { "radius": "12px", "shadow": "css-box-shadow" },
      "typography": { "heading":"Inter", "body":"Inter" },
      "logoDataUrl": "data:image/... (laisser tel quel si déjà fourni)",
      "decor_layers": [
        { "type":"glow|gradient_blob|diagonal|grid|dots", "position":"top|bottom|left|right|center", "scale":1, "rotate":0, "h":220, "s":60, "l":55, "opacity":0.18, "blend":"normal|multiply|screen" }
      ]
    }
  },
  "letter": { "greeting":"", "body_paragraphs": ["..."], "closing":"", "signature":"" },
  "executive_summary": { "paragraphs": ["..."] },
  "objectives": { "bullets": ["..."] },
  "approach": { "phases": [ { "title":"", "duration":"2 semaines", "description":"", "activities":["..."], "outcomes":["..."] } ] },
  "deliverables": { "in": ["..."], "out": ["..."] },
  "timeline": { "milestones": [ { "title":"Kick-off", "dateOrWeek":"Semaine 1", "notes":"" } ] },
  "pricing": {
    "model": "forfait|TJM|licence|mixte",
    "currency": "EUR",
    "items": [ { "name":"", "qty":1, "unit":"jour", "unit_price":800, "subtotal": null } ],
    "tax_rate": 20,
    "terms": ["Conditions de paiement 50/50", "Devis valable 30 jours"]
  },
  "assumptions": { "paragraphs": ["..."] },
  "next_steps": { "paragraphs": ["..."] }
}

- Cohérence : si l’utilisateur parle "sobre, entreprise, bleu", reflète-le dans palette.primary/secondary et decor_layers.
- Si manque d’info, fais des hypothèses raisonnables **étiquetées** ("à confirmer") au lieu de laisser vide.
- Toujours répondre en **français** si meta.lang est "fr" ou absent.

### IMPORTANT
Retourne **UNIQUEMENT** un objet JSON valide : { "reply": "...", "proposalSpec": { ... } }
Aucun texte hors JSON.
`;

    // Construit le message utilisateur pour donner du contexte clair
    const userPayload = {
      input: String(message || ""),
      current: proposalSpec || {},
      history: shortHistory,
    };

    // On demande un JSON strict
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const out = safeParseJson(raw);

    // Normalisation clé → proposalSpec
    const proposal =
      out?.proposalSpec ||
      out?.proposal_spec ||
      out?.proposal ||
      out?.spec ||
      null;

    const reply = out?.reply || "D’accord, je poursuis la structuration de votre proposition.";

    return res.status(200).json({
      reply,
      proposalSpec: proposal,
      model: completion.model,
    });
  } catch (err) {
    console.error("chat error", err);
    return res.status(500).json({ error: "FUNCTION_INVOCATION_FAILED", detail: String(err?.message || err) });
  }
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Tentative d’extraction d’un bloc JSON dans du texte éventuel
    const m = String(text || "").match(/\{[\s\S]*\}$/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    return {};
  }
}
