 // /api/chat.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -----------------------------------------------------------
   DEFAULT DESIGN SPEC (contrat par défaut côté serveur)
   Sert de base pour merge si l'IA renvoie un design partiel
----------------------------------------------------------- */
const DEFAULT_DESIGN_SPEC = {
  palette: {
    primary:   "#3b82f6",   // accent 1
    secondary: "#8b5cf6",   // accent 2 (dégradé / tags…)
    surface:   "#f6f8fc",   // fond de la page / cartes
    ink:       "#0a1020",   // texte principal
    muted:     "#5c667a",   // texte secondaire
    stroke:    "#e0e6f4"    // bordures
  },
  radius: { panel: 16, bubble: 14, card: 12 }, // px
  texture: { kind: "none", intensity: 0.0 },   // "none" | "mesh" | "blob"
  brand: { company: "", website: "", contact: "" }
};

/* -------- utils: deep merge (obj1 <- obj2 <- obj3) -------- */
function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
function deepMerge(...objs) {
  const out = {};
  for (const o of objs) {
    if (!isObj(o)) continue;
    for (const k of Object.keys(o)) {
      if (isObj(o[k])) out[k] = deepMerge(out[k], o[k]);
      else out[k] = o[k];
    }
  }
  return out;
}

/* -------------------- SYSTEM PROMPT ----------------------- */
const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist & Layout Designer (FR/EN).

OBJECTIF:
- Produire à chaque tour un JSON strict { reply, proposalSpec, actions }.
- "proposalSpec" décrit le contenu (lettre, phasage, pricing, etc.)
- Et contient META.STYLE.DESIGNSPEC = contrat de design (voir ci-dessous).
- Quand l’utilisateur évoque un style / thème / couleurs / logo,
  tu mets à jour proposalSpec.meta.style.designSpec (partiellement possible).

CONTRAT DESIGNSPEC (toujours sous proposalSpec.meta.style.designSpec) :
{
  "palette": {
    "primary":   "#RRGGBB",    // accent 1 (boutons, tags, dégradé user bubble)
    "secondary": "#RRGGBB",    // accent 2
    "surface":   "#RRGGBB",    // fond général / cartes
    "ink":       "#RRGGBB",    // texte principal
    "muted":     "#RRGGBB",    // texte secondaire
    "stroke":    "#RRGGBB"     // bordures
  },
  "radius": { "panel": <px>, "bubble": <px>, "card": <px> },
  "texture": { "kind": "none|mesh|blob", "intensity": 0..1 },
  "brand":   { "company": "", "website": "", "contact": "" }
}

RÈGLES :
- Si l’utilisateur tape un style ("corporate navy", "lime accent", "radius 12",
  "texture mesh légère", "super pro minimal", etc.), mets à jour "designSpec"
  en conséquence en renvoyant uniquement les champs utiles (partiel OK).
- Ne jamais inventer des champs hors contrat.
- Répondre en JSON STRICT (response_format=json_object), pas de texte hors JSON.
`;

/* ------------------- Fewshots (facultatif) ---------------- */
const FEWSHOTS = [
  {
    role: "user",
    content:
      "Style: corporate navy, accent lime, radius 14 panel/12 bubble/10 card, texture mesh légère."
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply:
        "Je passe sur une charte corporate (bleu marine avec accent lime) et des rayons plus doux.",
      proposalSpec: {
        meta: {
          style: {
            designSpec: {
              palette: {
                primary: "#0b1a3a",
                secondary: "#68d391",
                surface: "#f5f8ff",
                ink: "#0a1020",
                muted: "#5c667a",
                stroke: "#dfe6f4"
              },
              radius: { panel: 14, bubble: 12, card: 10 },
              texture: { kind: "mesh", intensity: 0.2 }
            }
          }
        }
      },
      actions: [{ type: "preview" }]
    })
  }
];

/* ----------------------- Handler -------------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { message, proposalSpec, history = [] } = req.body || {};

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      ...history.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      })),
      proposalSpec
        ? { role: "user", content: `Spec actuelle:\n${JSON.stringify(proposalSpec)}` }
        : null,
      { role: "user", content: message || "" }
    ].filter(Boolean);

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages
    });

    let out = {};
    try {
      out = JSON.parse(resp.choices[0]?.message?.content || "{}");
    } catch {
      out = { reply: "Je n’ai pas pu structurer la proposition.", actions: [] };
    }

    /* --------- merge du designSpec (DEFAULT <- existing <- AI) --------- */
    const existingDesign =
      proposalSpec?.meta?.style?.designSpec || {};

    const aiDesign =
      out?.proposalSpec?.meta?.style?.designSpec || {};

    const finalDesign = deepMerge(DEFAULT_DESIGN_SPEC, existingDesign, aiDesign);

    // Toujours renvoyer proposalSpec + meta + style + designSpec fusionné
    out.proposalSpec = deepMerge(
      { meta: { style: {} } },
      out.proposalSpec || {},
      { meta: { style: { designSpec: finalDesign } } }
    );

    res.status(200).json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: "Erreur serveur", actions: [] });
  }
}
