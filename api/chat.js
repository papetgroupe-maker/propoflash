// /api/chat.js — Next.js / Vercel API Route (Node env)
// But : orchestrer un chat "expert proposition commerciale" qui renvoie
// 1) reply (texte chat)
// 2) proposalSpec (structure de proposition)
// 3) designSpecDiff (tokens de style à fusionner côté client)
// 4) memoryUpdate (faits & préférences apprises à stocker côté client)

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Util: robust JSON extraction même si le modèle parle autour (on exige JSON only, mais sécurité)
function asJson(txt) {
  try {
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(txt.slice(start, end + 1));
  } catch {}
  return null;
}

// === SYSTEM PROMPT — Expert Proposals + Style Interpreter intégré ===
const SYSTEM_PROMPT = `
ROLE: Senior Proposal Architect (FR/EN), Brand/UI Stylist, Pricing & Scope sensei.
OBJECTIF: conduire un échange naturel et guidé pour ACCUMULER:
- les infos de proposition (contexte, objectifs, périmètre, phasage, preuves, planning, pricing),
- les préférences de DESIGN (sobre/corporate/vibrant/luxe, couleurs, typos, densité, déco),
et produire à chaque tour un JSON STRICT pour générer l'aperçu live.

SORTIE — JSON STRICT UNIQUEMENT, format:
{
  "reply": "<réponse lisible pour l'utilisateur, en FR si l'utilisateur parle FR>",
  "proposalSpec": {
    "meta": {
      "lang":"fr|en",
      "title":"", "company":"", "client":"", "date":"", "currency":"EUR",
      "style": {
        "palette": { "primary":"#hex", "secondary":"#hex", "surface":"#hex", "ink":"#hex", "muted":"#hex", "stroke":"#hex", "accentA":"#hex", "accentB":"#hex" },
        "shapes": { "radius":"12px|16px", "shadow":"0 18px 48px rgba(10,16,32,.16)" },
        "typography": { "heading":"Inter|Montserrat|Poppins|Playfair|Source Serif Pro","body":"Inter|Work Sans|Source Sans 3" },
        "logoDataUrl": "",
        "decor_layers": [
          { "type":"glow|gradient_blob|grid|dots|diagonal", "position":"top|bottom|left|right|center", "opacity":0.18, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"normal|screen|overlay" }
        ]
      }
    },
    "letter": { "greeting":"", "body_paragraphs":[""], "closing":"", "signature":"" },
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
  "designSpecDiff": {
    "palette": {}, "typography": {}, "shapes": {}, "texture": { "kind":"none|mesh|blob", "intensity":0.06 }, "brand": { "tone":["premium|sobre|fun|tech"] }
  },
  "memoryUpdate": {
    "design_prefs": { "tone":"", "primary":"#hex?", "secondary":"#hex?", "serif_title":false, "density":"compact|comfortable|spacious" },
    "facts": { "company":"", "client":"", "sector":"", "scope":[""], "deadline":"", "budget_hint":"", "currency":"EUR" },
    "pending_questions": [""]  // questions encore nécessaires
  },
  "actions": [
    { "type":"preview" } | { "type":"ask", "field":"meta.client", "hint":"Quel est le client ?" }
  ]
}

RÈGLES:
- Langue: déduire. FR par défaut si ambigu. Conserver la langue de l'utilisateur pour "reply".
- NE PAS INVENTER: si info critique manque: renseigner "actions":[{"type":"ask",...}] + ajouter une question dans memoryUpdate.pending_questions.
- Style par défaut: lisible, contrasté, Inter; "surface" #fff, "ink" #0A1020, stroke #E0E6F4.
- Indices "luxe/premium/noir et or" => primary #111827 / secondaires dorés #CFB06A #E5B344, texture faible, serif possible pour titres.
- "sobre/corporate/tech" => froid, texture très faible, Inter, radius 12px.
- "fun/startup/vibrant" => secondaires saturés, radius 16px, décor léger (dots/blob), contrast OK.
- Pricing: si incertain → items hypothétiques + "assumptions" explicites + marquer "à confirmer".
- Toujours renvoyer un objet JSON strict (pas de prose hors reply).
`;

const FEWSHOT_U = `Brief: Refonte site vitrine B2B en 6 pages. ton sobre/corporate, bleu pétrole + violet accent. deadline 5 semaines. budget 8–10k. client: Vulkia. company: Atlas Studio.`;
const FEWSHOT_A = JSON.stringify({
  reply:
    "Parfait. Je propose un style sobre (bleu pétrole + accent violet), et une structure en 4 phases. Confirmez-vous 6 pages et la deadline à 5 semaines ?",
  proposalSpec: {
    meta: {
      lang: "fr",
      title: "Proposition — Refonte site vitrine",
      company: "Atlas Studio",
      client: "Vulkia",
      currency: "EUR",
      style: {
        palette: {
          primary: "#1F2937",
          secondary: "#7C3AED",
          surface: "#FFFFFF",
          ink: "#0A1020",
          muted: "#5C667A",
          stroke: "#E0E6F4",
          accentA: "#60A5FA",
          accentB: "#93C5FD"
        },
        shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
        typography: { heading: "Montserrat", body: "Inter" },
        decor_layers: [
          {
            type: "diagonal",
            position: "top",
            opacity: 0.18,
            h: 220,
            s: 30,
            l: 55,
            rotate: -18,
            scale: 1.1,
            blend: "overlay"
          },
          { type: "dots", position: "right", opacity: 0.2, h: 220, s: 10, l: 70, rotate: 0, scale: 1 }
        ]
      }
    },
    executive_summary: {
      paragraphs: [
        "Refonte pour crédibiliser l’offre, améliorer la conversion et poser un socle SEO."
      ]
    },
    objectives: { bullets: ["Moderniser l’image", "Accroître les leads", "Optimiser SEO de base"] },
    approach: {
      phases: [
        { title: "Cadrage", duration: "1 semaine", activities: ["Atelier objectifs", "Arborescence"], outcomes: ["Backlog validé"] },
        { title: "Design UI", duration: "2 semaines", activities: ["Maquettes", "Design system"], outcomes: ["UI validée"] },
        { title: "Développement", duration: "1.5 semaine", activities: ["Intégration", "CMS"], outcomes: ["Site prêt"] },
        { title: "Recette & Go-live", duration: "0.5 semaine", activities: ["Tests", "Corrections", "Mise en ligne"], outcomes: ["Prod en ligne"] }
      ]
    },
    pricing: {
      model: "forfait",
      currency: "EUR",
      tax_rate: 20,
      items: [
        { name: "Cadrage", qty: 1, unit: "forfait", unit_price: 1500, subtotal: 1500 },
        { name: "Design (6 pages)", qty: 1, unit: "forfait", unit_price: 2800, subtotal: 2800 },
        { name: "Développement & intégration", qty: 1, unit: "forfait", unit_price: 3600, subtotal: 3600 }
      ],
      terms: ["40% commande, 40% design, 20% livraison", "Validité: 30 jours"]
    }
  },
  designSpecDiff: {
    palette: { primary: "#1F2937", secondary: "#7C3AED" },
    brand: { tone: ["tech", "sobre"] }
  },
  memoryUpdate: {
    design_prefs: {
      tone: "sobre/corporate",
      primary: "#1F2937",
      secondary: "#7C3AED",
      serif_title: false,
      density: "comfortable"
    },
    facts: {
      company: "Atlas Studio",
      client: "Vulkia",
      sector: "B2B SaaS",
      scope: ["Refonte vitrine 6 pages"],
      deadline: "5 semaines",
      budget_hint: "8–10k",
      currency: "EUR"
    },
    pending_questions: ["Pages exactes à couvrir ?", "Périmètre SEO ?"]
  },
  actions: [{ type: "preview" }]
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }
  try {
    const { message, proposalSpec, history, memory } = req.body || {};
    const langGuess =
      Array.isArray(history) && history.length
        ? (history.findLast?.(m => m.role === "user")?.content || "").match(/[a-zàâçéèêëîïôûùüÿñæœ]/i)
          ? "fr"
          : "en"
        : "fr";

    const userContext = `
Message utilisateur:
"""${message || ""}"""

Contexte actuel (proposalSpec, mémoire utilisateur):
proposalSpec: ${JSON.stringify(proposalSpec || {}, null, 2)}
memory: ${JSON.stringify(memory || {}, null, 2)}

Consignes: Réponds STRICTEMENT au format JSON demandé (pas de texte hors JSON).
Langue de "reply": ${langGuess}.
`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: FEWSHOT_U },
      { role: "assistant", content: FEWSHOT_A },
      ...(Array.isArray(history)
        ? history.slice(-8).map(m => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || "").slice(0, 4000)
          }))
        : []),
      { role: "user", content: userContext }
    ];

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages
    });

    const text = r?.choices?.[0]?.message?.content || "{}";
    const json =
      asJson(text) ||
      {
        reply:
          langGuess === "fr"
            ? "Je n’ai pas pu structurer la proposition cette fois-ci."
            : "I couldn't structure the proposal this time.",
        proposalSpec: proposalSpec || {},
        actions: [{ type: "ask", field: "meta.client", hint: "Quel est le client ?" }]
      };

    res.status(200).json(json);
  } catch (e) {
    res.status(200).json({
      reply: "Erreur réseau côté IA. Réessaie.",
      proposalSpec: proposalSpec || {},
      actions: [{ type: "preview" }]
    });
  }
}
