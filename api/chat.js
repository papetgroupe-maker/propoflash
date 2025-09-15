// /api/chat.js  — Serverless route Vercel / Next (Node)
// Nécessite process.env.OPENAI_API_KEY

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Util: extrait un bloc JSON même si le modèle bavarde autour */
function asJson(txt) {
  try {
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(txt.slice(start, end + 1));
    }
  } catch (_) {}
  return null;
}

/** Util: crée une spec minimale si absente */
function minimalSpec(prev, lang = "fr") {
  const L = lang === "en" ? "en" : "fr";
  const base = {
    meta: {
      lang: L,
      title: L === "en" ? "Business Proposal" : "Proposition commerciale",
      currency: "EUR",
      style: {
        palette: {
          primary: "#3B82F6",
          secondary: "#8B5CF6",
          surface: "#FFFFFF",
          ink: "#0A1020",
          muted: "#5C667A",
          stroke: "#E0E6F4",
          accentA: "#60A5FA",
          accentB: "#93C5FD"
        },
        shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
        typography: { heading: "Inter", body: "Inter" },
        decor_layers: [
          { type: "glow", position: "top", opacity: 0.20, h: 220, s: 60, l: 55, rotate: 0, scale: 1.1, blend: "screen" },
          { type: "dots", position: "right", opacity: 0.18, h: 220, s: 12, l: 70, rotate: 0, scale: 1.0, blend: "normal" }
        ]
      }
    },
    letter: { greeting: "", body_paragraphs: [], closing: "", signature: "" },
    executive_summary: { paragraphs: [] },
    objectives: { bullets: [] },
    approach: { phases: [] },
    deliverables: { in: [], out: [] },
    timeline: { milestones: [] },
    pricing: { model: "forfait", currency: "EUR", items: [], tax_rate: 20, terms: [], price: 0 },
    assumptions: { paragraphs: [] },
    next_steps: { paragraphs: [] }
  };
  return { ...(prev || {}), ...base, meta: { ...(base.meta), ...((prev || {}).meta || {}) } };
}

/** SYSTEM PROMPT — oblige JSON strict */
const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist + Brand/Layout Designer.
OBJECTIF: À CHAQUE TOUR, retourner UNIQUEMENT du JSON strict:

{
  "reply": "<texte pour l'utilisateur>",
  "proposalSpec": { ... (voir schema) ... },
  "actions": []
}

SCHEMA (résumé):
proposalSpec.meta.lang ("fr"|"en"), title, company, client, date, currency
proposalSpec.meta.style: palette(primary,secondary,surface,ink,muted,stroke,accentA,accentB),
  shapes(radius,shadow), typography(heading,body), logoDataUrl(optional),
  decor_layers[] (type:"glow|gradient_blob|grid|dots|diagonal", position:"top|bottom|left|right|center",
    opacity,h,s,l,rotate,scale,blend)
Sections: letter, executive_summary, objectives, approach(phases[]), deliverables, timeline, pricing, assumptions, next_steps.

RÈGLES:
- Toujours renvoyer un proposalSpec COMPLÉTÉ (au minimum: meta + pricing + quelques sections vides) — même si la réponse est une question.
- Respecter/étendre le proposalSpec précédent fourni dans l'entrée (ne jamais l'écraser sans raison).
- Si l'utilisateur mentionne le STYLE (sobre, premium, noir/or, bleu corporate, 3D, diagonal, dots, mesh, etc.)
  => METTRE À JOUR meta.style (palette/typography/decor_layers) avec des valeurs raisonnables et lisibles.
- Si des infos manquent (client, contenu précis, budget), poser la question DANS "reply" et laisser des placeholders dans proposalSpec.
- Langue par défaut: FR si ambigu.
- PAS DE PROSE HORS JSON. PAS d'URL. PAS de markdown. JSON strict uniquement.
`;

/** FEW-SHOTS concis forcent le format */
const FEWSHOTS = [
  {
    role: "user",
    content:
      "Brief: Identité 'indus' noir & or, diagonales subtiles, tech B2B. Offre: refonte site vitrine 6 pages. Deadline 5 semaines. Budget 8–10k."
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply:
        "Je structure la proposition (cadrage, design, dev) en style industriel noir/or avec diagonales discrètes. Dites-moi le nom de votre client.",
      proposalSpec: {
        meta: {
          lang: "fr",
          title: "Proposition — Refonte site vitrine",
          currency: "EUR",
          style: {
            palette: {
              primary: "#111827",
              secondary: "#CFB06A",
              surface: "#FFFFFF",
              ink: "#0A1020",
              muted: "#6B7280",
              stroke: "#E5E7EB",
              accentA: "#F5E6B3",
              accentB: "#CFB06A"
            },
            shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.16)" },
            typography: { heading: "Montserrat", body: "Inter" },
            decor_layers: [
              { type: "diagonal", position: "top", opacity: 0.16, h: 45, s: 90, l: 50, rotate: -18, scale: 1.1, blend: "overlay" },
              { type: "dots", position: "right", opacity: 0.22, h: 45, s: 10, l: 70, rotate: 0, scale: 1, blend: "normal" }
            ]
          }
        },
        executive_summary: { paragraphs: ["Refonte pour crédibiliser l’offre et augmenter les leads."] },
        objectives: { bullets: ["Moderniser l’image", "Optimiser conversion", "SEO de base"] },
        approach: {
          phases: [
            {
              title: "Cadrage",
              duration: "1 semaine",
              activities: ["Atelier objectifs", "Arborescence"],
              outcomes: ["Backlog validé"]
            }
          ]
        },
        pricing: {
          model: "forfait",
          currency: "EUR",
          tax_rate: 20,
          items: [{ name: "Cadrage", qty: 1, unit: "forfait", unit_price: 1500, subtotal: 1500 }],
          terms: ["40% commande, 40% design, 20% livraison"]
        }
      },
      actions: [{ type: "preview" }]
    })
  }
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await (async () => {
      try {
        return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch {
        return {};
      }
    })();

    const userMsg = (body?.message || "").toString();
    const prevSpec = body?.proposalSpec || null;
    const history = Array.isArray(body?.history) ? body.history : [];

    const seed = minimalSpec(prevSpec, prevSpec?.meta?.lang || "fr");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      {
        role: "user",
        content:
          `Contexte — proposalSpec précédent:\n` +
          "```json\n" +
          JSON.stringify(seed, null, 2) +
          "\n```\n\n" +
          `Dernier message utilisateur:\n"""${userMsg}"""\n\n` +
          `Exigence: réponds **UNIQUEMENT** avec un JSON strict { "reply": "...", "proposalSpec": { ... }, "actions": [] }`
      }
    ];

    // (Optionnel) on ajoute un bout de l'historique récent (sans dépasser ~3-4 tours pour rester léger)
    const recent = history.slice(-6).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content?.toString().slice(0, 2000) || ""
    }));
    messages.push(...recent);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages
    });

    const raw = completion?.choices?.[0]?.message?.content || "";
    const parsed = asJson(raw);

    if (!parsed || typeof parsed !== "object") {
      // Fallback robuste: on renvoie au moins le reply + spec seed
      return res.status(200).json({
        reply:
          "J’ai bien reçu. Peux-tu préciser le client, l’objectif et le style désiré (ex: sobre, premium, couleurs) ?",
        proposalSpec: seed,
        actions: [{ type: "ask", field: "meta.client", hint: "Quel est le client ?" }]
      });
    }

    // Merge doux: on part du seed, puis on applique la proposition du modèle
    const nextSpec = (() => {
      const prop = parsed.proposalSpec || {};
      const merged = {
        ...seed,
        ...prop,
        meta: {
          ...(seed.meta || {}),
          ...(prop.meta || {}),
          style: { ...((seed.meta || {}).style || {}), ...(((prop.meta || {}).style) || {}) }
        }
      };
      return merged;
    })();

    return res.status(200).json({
      reply: parsed.reply || "",
      proposalSpec: nextSpec,
      actions: Array.isArray(parsed.actions) ? parsed.actions : []
    });
  } catch (err) {
    console.error("API /api/chat error:", err);
    res
      .status(500)
      .json({ error: "SERVER_ERROR", message: (err && err.message) || "Unexpected error" });
  }
}
