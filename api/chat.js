// /api/chat.js
// Vercel/Next API function — renvoie TOUJOURS du JSON { reply, proposalSpec, actions }
// Prérequis : variable d'environnement OPENAI_API_KEY définie sur Vercel

import OpenAI from "openai";

// ---------- PROMPT ----------
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
    "pricing": { "model":"forfait|regie", "currency":"EUR",
                 "items":[{ "name":"", "qty":1, "unit":"jour|mois|forfait", "unit_price":0, "subtotal":0 }],
                 "tax_rate":20, "terms":[""], "price": null },
    "assumptions": { "paragraphs":[""] },
    "next_steps": { "paragraphs":[""] }
  },
  "actions": [{ "type":"preview" } | { "type":"ask", "field":"meta.client", "hint":"Quel est le client ?" }]
}

RÈGLES:
- Langue: déduire; FR par défaut si ambigu.
- Ne JAMAIS inventer d'entités critiques; si info manque → "actions: ask".
- Si budget incertain: items + hypothèses + marquer "à confirmer".
- STYLE: toujours raisonnable et pro. Palette accessible (contraste suffisant: texte vs surface).
  Couleurs: extraire du brief si mention ("noir & jaune", "vert sapin", "bleu pétrole + violet").
  Décor: rester subtil (2-4 layers max).
- Respecter le schéma, JSON strict uniquement.
`;

// (facultatif) quelques few-shots pour ancrer le format
const FEWSHOTS = [
  {
    role: "user",
    content:
      "Brief: Identité 'indus' noir & jaune, style énergique, diagonales, tech B2B FR. Offre: refonte site vitrine 6 pages. Deadline 5 semaines. Budget 8–10k.",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply:
        "Je prépare une proposition structurée (cadrage, design, dev) avec un style noir/jaune industriel et des diagonales subtiles.",
      proposalSpec: {
        meta: {
          lang: "fr",
          title: "Proposition — Refonte site vitrine",
          currency: "EUR",
          style: {
            palette: {
              primary: "#111827",
              secondary: "#F59E0B",
              surface: "#FFFFFF",
              ink: "#0A1020",
              muted: "#5C667A",
              stroke: "#E5E7EB",
              accentA: "#FCD34D",
              accentB: "#F59E0B",
            },
            shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.16)" },
            typography: { heading: "Montserrat", body: "Inter" },
            decor_layers: [
              {
                type: "diagonal",
                position: "top",
                opacity: 0.18,
                h: 45,
                s: 95,
                l: 50,
                rotate: -20,
                scale: 1.1,
                blend: "overlay",
              },
              {
                type: "dots",
                position: "right",
                opacity: 0.2,
                h: 220,
                s: 15,
                l: 70,
                rotate: 0,
                scale: 1,
              },
            ],
          },
        },
        executive_summary: {
          paragraphs: [
            "Refonte pour crédibiliser l’offre, améliorer la conversion et l’autonomie CMS.",
          ],
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
            { name: "Dév & intégration", qty: 1, unit: "forfait", unit_price: 3600, subtotal: 3600 },
          ],
          terms: ["40% commande, 40% design, 20% livraison", "Validité: 30 jours"],
        },
        next_steps: { paragraphs: ["Point 30 min pour verrouiller le périmètre et le planning."] },
      },
      actions: [{ type: "preview" }],
    }),
  },
];

// ---------- UTILS ----------
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractJson(text) {
  try {
    // Si le modèle ajoute de la prose autour, on tente d'extraire le plus grand bloc JSON
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
  } catch {
    // ignore
  }
  return null;
}

function minimalSpec(lang = "fr") {
  return {
    meta: {
      lang,
      title: lang === "en" ? "Business Proposal" : "Proposition commerciale",
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
          accentB: "#93C5FD",
        },
        shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
        typography: { heading: "Inter", body: "Inter" },
        decor_layers: [
          { type: "glow", position: "top", opacity: 0.18, h: 220, s: 60, l: 55, rotate: 0, scale: 1, blend: "screen" },
        ],
      },
    },
    executive_summary: { paragraphs: [] },
    objectives: { bullets: [] },
    approach: { phases: [] },
    deliverables: { in: [], out: [] },
    timeline: { milestones: [] },
    pricing: { model: "forfait", currency: "EUR", items: [], tax_rate: 20, terms: [], price: null },
    assumptions: { paragraphs: [] },
    next_steps: { paragraphs: [] },
  };
}

// ---------- HANDLER ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, proposalSpec, history } = await parseBody(req);

    // Messages OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      {
        role: "user",
        content:
          `Contexte (proposalSpec actuel, si présent) :\n` +
          "```json\n" +
          JSON.stringify(proposalSpec || {}, null, 2) +
          "\n```\n" +
          `Derniers messages (user/assistant) :\n` +
          "```json\n" +
          JSON.stringify(history || [], null, 2) +
          "\n```\n" +
          `Nouveau message utilisateur : """${message || ""}"""\n` +
          `RENVOIE STRICTEMENT le JSON du schéma (pas de prose).`,
      },
    ];

    // Appel modèle en JSON Mode pour garantir un objet JSON
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages,
    });

    let raw = completion.choices?.[0]?.message?.content || "";
    let data = null;

    // Sécurité: si jamais JSON Mode ne s'applique pas
    try {
      data = JSON.parse(raw);
    } catch {
      data = extractJson(raw);
    }

    // Filets de sécurité pour toujours renvoyer la bonne structure
    if (!data || typeof data !== "object") {
      data = { reply: raw || "Ok.", proposalSpec: minimalSpec() };
    }
    if (!data.proposalSpec) {
      data.proposalSpec = minimalSpec();
    }
    if (!data.reply) {
      data.reply = "Ok.";
    }
    if (!Array.isArray(data.actions)) {
      data.actions = [{ type: "preview" }];
    }

    // Nettoyage léger: s'assurer que meta.lang existe
    const lang =
      data?.proposalSpec?.meta?.lang ||
      guessLangFromHistory(history) ||
      "fr";
    data.proposalSpec.meta = { ...(data.proposalSpec.meta || {}), lang };

    res.status(200).json(data);
  } catch (err) {
    console.error("[/api/chat] error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
}

// ---------- helpers ----------
async function parseBody(req) {
  // Vercel/Next fournit déjà req.body quand bodyParser est actif; sinon on lit le stream
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const txt = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

function guessLangFromHistory(history = []) {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const s = (lastUser?.content || "").toLowerCase();
  if (!s) return null;
  const frHints = [" bonjour ", " proposition ", " devis ", " merci ", " client ", " objectif ", " livrables "];
  const enHints = [" proposal ", " quote ", " thanks ", " client ", " objective ", " deliverables "];
  const frScore = frHints.reduce((n, h) => n + (s.includes(h) ? 1 : 0), 0);
  const enScore = enHints.reduce((n, h) => n + (s.includes(h) ? 1 : 0), 0);
  if (frScore >= enScore) return "fr";
  if (enScore > frScore) return "en";
  return null;
}
