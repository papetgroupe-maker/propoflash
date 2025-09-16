// /api/chat.js  — Vercel Serverless (Node / ESM)
// Répond au front avec { reply, proposalSpec } en JSON strict.
// Nécessite la variable d'env Vercel: OPEN API

import OpenAI from "openai";

// ---------- CORS util ----------
const ALLOW_ORIGIN = "*"; // mets ton domaine si tu veux restreindre
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
}
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY on Vercel" });
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // -------- lecture du body ----------
  let body = {};
  try {
    body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  const userText = String(body.message || body.userText || "").trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const proposalSpec = body.proposalSpec || {};

  // --------- Prompts ----------
  const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist, Brand Designer & Layout Artist (FR/EN).
OBJECTIF: transformer chaque échange en une proposition exploitable ET stylée.
Produire un "proposalSpec" cohérent + un "reply" clair. DÉDUIRE un STYLE complet
à partir des indices utilisateur (couleurs, ambiance, industrie, sobriété vs fun),
et proposer des couches décoratives subtiles.

SCHEMA DE SORTIE (JSON STRICT):
{
  "reply": "<texte lisible pour l'utilisateur>",
  "proposalSpec": {
    "meta": {
      "lang":"fr|en",
      "title": "", "company":"", "client":"", "date":"", "currency":"EUR",
      "style": {
        "palette": { "primary":"#hex", "secondary":"#hex", "surface":"#hex", "ink":"#hex", "muted":"#hex", "stroke":"#hex", "accentA":"#hex", "accentB":"#hex" },
        "shapes": { "radius":"12px|16px", "shadow":"0 18px 48px rgba(...)" },
        "typography": { "heading":"Inter|Montserrat|Poppins|...","body":"Inter|..." },
        "logoDataUrl": "",
        "decor_layers": [
          { "type":"glow|gradient_blob|grid|dots|diagonal", "position":"top|bottom|left|right|center", "opacity":0.18, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"normal|screen|overlay" }
        ]
      }
    },
    "letter": { "subject":"", "preheader":"", "greeting":"", "body_paragraphs":[""], "closing":"", "signature":"" },
    "executive_summary": { "paragraphs":[""] },
    "objectives": { "bullets":[""] },
    "approach": { "phases":[{ "title":"", "duration":"", "activities":[""], "outcomes":[""] }] },
    "deliverables": { "in":[""], "out":[""] },
    "timeline": { "milestones":[{ "title":"", "dateOrWeek":"", "notes":"" }] },
    "pricing": { "model":"forfait|regie|tjm|licence", "currency":"EUR",
                 "items":[{ "name":"", "qty":1, "unit":"jour|mois|forfait", "unit_price":0, "subtotal":0 }],
                 "tax_rate":20, "terms":[""], "price": null },
    "assumptions": { "paragraphs":[""] },
    "next_steps": { "paragraphs":[""] }
  }
}

RÈGLES:
- Langue: déduire; FR par défaut si ambigu.
- Ne JAMAIS inventer d'entités critiques; si info manque → poser des questions dans "reply".
- Si budget incertain: items + hypothèses + marquer "à confirmer".
- STYLE: toujours pro & accessible (contraste suffisant texte/surface).
- Décor: subtil (2–4 layers max). Toujours retourner du JSON strict.
`.trim();

  // historique > format minimal pour OpenAI
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
    {
      role: "user",
      content:
        `Contexte (spec actuelle, facultatif):\n` +
        "```json\n" + JSON.stringify(proposalSpec || {}, null, 2) + "\n```\n\n" +
        `Message utilisateur:\n${userText || "(vide)"}\n\n` +
        `Réponds EXCLUSIVEMENT avec l'objet JSON demandé (pas de prose autour).`,
    },
  ];

  // ---------- Appel OpenAI ----------
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" }, // force JSON
      messages,
    });

    const raw = completion?.choices?.[0]?.message?.content || "{}";

    // extraction JSON robuste
    let out;
    try {
      out = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}$/);
      out = m ? JSON.parse(m[0]) : {};
    }

    const reply = out?.reply || "Je commence la structuration. Pouvez-vous préciser le client, l’échéance et le style visuel (sobre, corporate, bleu…) ?";
    const spec  = out?.proposalSpec || {};

    return res.status(200).json({ reply, proposalSpec: spec });
  } catch (err) {
    // Retourne un message d’erreur exploitable au front
    const msg = err?.response?.data || err?.message || String(err);
    return res.status(500).json({ error: "OpenAI error", detail: msg });
  }
}
