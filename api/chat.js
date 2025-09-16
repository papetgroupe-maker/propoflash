// /api/chat.js  — Vercel Serverless (Node ESM)
// Besoin: variable d'env OPENAI_API_KEY dans Vercel
// Rôle: cerveau "super expert proposition commerciale" + sortie JSON STRICT
//       -> reply (chat), proposalSpecPatch (fond), designSpecDiff (style),
//          previewOps (patchs ciblés pour l'aperçu), followUps (questions proactives)

import OpenAI from "openai";

/* ----------------------------- Setup + CORS ----------------------------- */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_PUBLIC, // fallback
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req, res) {
  try {
    // Preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Cache-Control", "no-store");
      for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
      return res.status(204).end();
    }

    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);

    if (req.method === "GET") {
      return res.status(200).json({ ok: true, status: "chat api ready" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {};
    const { message = "", history = [], proposalSpec = {} } = body;

    /* ------------------------- Messages vers le LLM ------------------------- */
    const SYSTEM_PROMPT = `
Tu es **PropoFlash Brain** : un·e stratège senior de propositions commerciales B2B,
directeur·trice artistique (HTML/CSS 3D soft), PMO planning & pricing — FR/EN.

Objectifs:
1) Mener une vraie conversation (questions proactives, pas de répétition).
2) Construire ET affiner la proposition (fond) + le style (forme) en parallèle.
3) Toujours répondre au format JSON **STRICT** (rien en dehors du JSON).

Schéma STRICT à respecter:
{
  "reply": "<texte pour l'utilisateur (FR par défaut si ambigu)>",
  "proposalSpecPatch": {
    "meta": {
      "lang": "fr|en",
      "title": "", "company": "", "client": "", "date": "",
      "currency": "EUR",
      "style": {
        "palette": { "primary":"#hex","secondary":"#hex","surface":"#hex","ink":"#hex","muted":"#hex","stroke":"#hex","accentA":"#hex","accentB":"#hex" },
        "shapes": { "radius":"12px|16px","shadow":"0 18px 48px rgba(10,16,32,.16)" },
        "typography": { "heading":"Inter|Montserrat|Poppins|Playfair","body":"Inter|Source Sans 3" },
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
    "pricing": {
      "model":"forfait|regie", "currency":"EUR", "tax_rate":20,
      "items":[{ "name":"", "qty":1, "unit":"jour|mois|forfait", "unit_price":0, "subtotal":0 }],
      "terms":[""], "price": null
    },
    "assumptions": { "paragraphs":[""] },
    "next_steps": { "paragraphs":[""] }
  },
  "designSpecDiff": {
    "palette": {}, "typography": {}, "layout": { "radius": { "panel": 12, "card": 12 } }, "texture": { "kind":"none|mesh|blob","intensity":0.04 },
    "brand": { "company":"", "tone":["premium|sobre|fun|tech|editorial"] }
  },
  "previewOps": [
    { "op":"set", "path":"meta.title", "value":"..." },
    { "op":"push", "path":"timeline.milestones", "value": { "title":"Kickoff","dateOrWeek":"Semaine 1" } }
  ],
  "followUps": ["<question courte 1>", "<question courte 2>"]
}

Règles:
- FR par défaut si la langue est ambiguë.
- Ne JAMAIS inventer de noms de clients/entreprises si non fournis: poser une question via followUps.
- Style: contrasté, lisible, pro. Extraire couleurs/ambiance si l'utilisateur les mentionne ("sobre", "corporate", "bleu pétrole", "or/noir", "éditeur/serif", "startup/fun").
- Si “luxe/premium/noir & or”: noir #111827 + or #CFB06A (ou #E5B344), textures faibles.
- Si “corporate/sobre/banque”: bleus froids, gris, texture très faible, Inter/Source Sans 3.
- Si “éditorial/magazine/serif”: Playfair/Source Serif en titres, interlignage ↑.
- Si “startup/vibrant/fun”: secondaires saturées, radius ↑, blobs doux.
- Toujours respecter le schéma JSON EXACT. Aucune prose hors JSON.
`;

    const FEWSHOTS = [
      {
        role: "user",
        content:
          "Brief: Refonte offre B2B. Style sobre corporate bleu, très lisible. Client non communiqué. 6 pages, budget à confirmer.",
      },
      {
        role: "assistant",
        content: JSON.stringify(
          {
            reply:
              "Super. Je vais structurer la proposition (lettre, objectifs, approche, planning, pricing) et appliquer un style sobre/bleu. Pourriez-vous me donner le nom du client et la devise souhaitée ?",
            proposalSpecPatch: {
              meta: {
                lang: "fr",
                title: "Proposition — Refonte offre B2B",
                currency: "EUR",
                style: {
                  palette: {
                    primary: "#0E4AA8",
                    secondary: "#7C9CD7",
                    surface: "#FFFFFF",
                    ink: "#0A1020",
                    muted: "#5C667A",
                    stroke: "#E5EAF3",
                    accentA: "#60A5FA",
                    accentB: "#93C5FD",
                  },
                  shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
                  typography: { heading: "Inter", body: "Inter" },
                  decor_layers: [
                    { type: "glow", position: "top", opacity: 0.12, h: 220, s: 44, l: 52, rotate: 0, scale: 1, blend: "screen" },
                  ],
                },
              },
              executive_summary: { paragraphs: ["Refonte pour crédibiliser l’offre et améliorer la conversion."] },
              objectives: { bullets: ["Moderniser l’image", "Clarifier l’offre", "Optimiser la prise de contact"] },
              approach: {
                phases: [
                  { title: "Cadrage", duration: "1 sem.", activities: ["Atelier objectifs", "Périmètre"], outcomes: ["Backlog validé"] },
                  { title: "Design UI", duration: "2 sem.", activities: ["Maquettes", "Design system"], outcomes: ["UI validée"] },
                  { title: "Développement", duration: "1.5 sem.", activities: ["Intégration", "CMS"], outcomes: ["Pré-prod"] },
                  { title: "Recette & Go-live", duration: "0.5 sem.", activities: ["QA", "Corrections"], outcomes: ["Mise en ligne"] },
                ],
              },
              pricing: {
                model: "forfait",
                currency: "EUR",
                tax_rate: 20,
                items: [
                  { name: "Cadrage", qty: 1, unit: "forfait", unit_price: 1500, subtotal: 1500 },
                  { name: "Design (6 pages)", qty: 1, unit: "forfait", unit_price: 2800, subtotal: 2800 },
                  { name: "Développement", qty: 1, unit: "forfait", unit_price: 3600, subtotal: 3600 },
                ],
                terms: ["40% à la commande, 40% au design, 20% à la livraison", "Validité: 30 jours"],
              },
              next_steps: { paragraphs: ["Call 30 min pour verrouiller périmètre & planning."] },
            },
            designSpecDiff: {
              palette: { primary: "#0E4AA8", secondary: "#7C9CD7", surface: "#FFFFFF", ink: "#0A1020", stroke: "#E5EAF3" },
              typography: { title: { family: "Inter", weight: 800 }, body: { family: "Inter", weight: 500, lineHeight: 1.5 } },
              layout: { radius: { panel: 16, card: 12 } },
              texture: { kind: "mesh", intensity: 0.04 },
              brand: { tone: ["corporate", "sobre"] },
            },
            previewOps: [
              { op: "set", path: "meta.title", value: "Proposition — Refonte offre B2B" },
              { op: "push", path: "timeline.milestones", value: { title: "Kickoff", dateOrWeek: "S1" } },
            ],
            followUps: ["Quel est le nom du client ?", "Souhaitez-vous afficher une adresse/coordonnées dans l’en-tête ?"],
          },
          null,
          2
        ),
      },
    ];

    const userPrompt = `
CONTEXTE COURANT:
- proposalSpec (état actuel côté aperçu): ${safeStringify(proposalSpec)}
- historique (derniers tours): ${safeStringify(history)}

NOUVELLE DEMANDE UTILISATEUR:
"""${message || ""}"""

CONSIGNE: Retourne UNIQUEMENT du JSON strict conforme au schéma. Pas de \`\`\`, pas de texte hors JSON.
`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      { role: "user", content: userPrompt },
    ];

    /* ------------------------------ Appel LLM ------------------------------ */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages,
    });

    const raw = completion?.choices?.[0]?.message?.content || "";
    const parsed =
      extractJson(raw) ||
      fallbackTolerantJson(raw) || {
        reply:
          "Je n’ai pas pu formater la réponse en JSON. Peux-tu reformuler ?",
        proposalSpecPatch: {},
        designSpecDiff: {},
        previewOps: [],
        followUps: [],
      };

    // filet de sécurité: s'assurer des clés minimales
    const out = {
      reply: parsed.reply ?? "",
      proposalSpecPatch: parsed.proposalSpecPatch ?? {},
      designSpecDiff: parsed.designSpecDiff ?? {},
      previewOps: Array.isArray(parsed.previewOps) ? parsed.previewOps : [],
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(out);
  } catch (err) {
    console.error("[/api/chat] error:", err);
    const status = err?.status || err?.statusCode || 500;
    return res.status(status).json({
      error: "chat_api_error",
      detail: String(err?.message || err),
    });
  }
}

/* ---------------------------- Helpers parsing ---------------------------- */
function extractJson(txt = "") {
  // Cherche le plus grand bloc {...} et tente de parser
  try {
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const cut = txt.slice(start, end + 1);
      return JSON.parse(cut);
    }
  } catch {}
  return null;
}

function fallbackTolerantJson(txt = "") {
  // Tente d'extraire un bloc json même si le modèle a glissé des commentaires
  try {
    const cleaned = txt
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {}
  return null;
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}
