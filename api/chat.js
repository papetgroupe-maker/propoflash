// /api/chat.js — Vercel Serverless (Node 18+)
// => Toujours retourner du JSON (jamais d'HTML), pour que le front ne tombe pas en "Erreur réseau"

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// --- Prompt & fewshots (tu peux adapter) ---
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
  }
}

RÈGLES:
- FR par défaut si ambigu. Ne JAMAIS inventer d'entités critiques; si info manque → propose des "actions: ask" implicites dans le reply.
- Si budget incertain: items + hypothèses + marquer "à confirmer".
- STYLE pro & accessible (contraste texte/surface). Palette extraite du brief si possible.
- Décor subtil (2–4 layers max).
- Respect strict du schéma, JSON strict uniquement.
`.trim();

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
        objectives: {
          bullets: ["Moderniser l’image", "Accroître les leads", "Optimiser SEO de base"],
        },
        approach: {
          phases: [
            {
              title: "Cadrage",
              duration: "1 semaine",
              activities: ["Atelier objectifs", "Arborescence"],
              outcomes: ["Backlog validé"],
            },
            {
              title: "Design UI",
              duration: "2 semaines",
              activities: ["Maquettes", "Design system"],
              outcomes: ["UI validée"],
            },
            {
              title: "Développement",
              duration: "1.5 semaine",
              activities: ["Intégration", "CMS"],
              outcomes: ["Site prêt"],
            },
            {
              title: "Recette & Go-live",
              duration: "0.5 semaine",
              activities: ["Tests", "Corrections", "Mise en ligne"],
              outcomes: ["Prod en ligne"],
            },
          ],
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
    }),
  },
];

// --- Helpers ---
function jsonOnly(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  // CORS permissif si tu ouvres depuis un autre domaine / file://
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.send(JSON.stringify(data));
}

function asJson(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    const m = txt.match(/\{[\s\S]*\}$/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    return null;
  }
}

function safeReply(e) {
  return {
    reply:
      "Je n’ai pas pu contacter le modèle pour le moment. Donnez-moi le client, le contexte, 3 objectifs clés et un style (ex. sobre/entreprise/bleu).",
    proposalSpec: {
      meta: {
        lang: "fr",
        title: "Proposition commerciale",
        currency: "EUR",
        style: {
          palette: {
            primary: "#0B2446",
            secondary: "#3B82F6",
            surface: "#FFFFFF",
            ink: "#0A1020",
            muted: "#6B7280",
            stroke: "#E5E7EB",
            accentA: "#60A5FA",
            accentB: "#93C5FD",
          },
          shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
          typography: { heading: "Inter", body: "Inter" },
          decor_layers: [{ type: "glow", position: "top", opacity: 0.18, h: 220, s: 60, l: 55 }],
        },
      },
    },
    error: e ? String(e.message || e) : undefined,
    fallback: true,
  };
}

// --- Handler ---
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return jsonOnly(res, 204, {});
  if (req.method !== "POST")
    return jsonOnly(res, 405, { error: "Use POST", ok: false });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Ne pas casser l'UI : on répond 200 + fallback
    return jsonOnly(res, 200, safeReply("Missing OPENAI_API_KEY"));
  }

  let body = {};
  try { body = req.body ?? JSON.parse(req.body || "{}"); } catch {}

  const message = String(body.message || "");
  const proposalSpec = body.proposalSpec || {};
  const history = Array.isArray(body.history) ? body.history : [];

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...FEWSHOTS,
    ...history.slice(-10).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
    { role: "user", content: message },
  ];

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    const txt = await r.text();
    if (!r.ok) {
      // Renvoie un fallback "200" pour ne pas casser le front
      return jsonOnly(res, 200, safeReply(new Error(`OpenAI ${r.status}: ${txt.slice(0, 600)}`)));
    }

    const out = asJson(txt) || {};
    const reply = out.reply || "J’ai préparé une structure de proposition. Souhaitez-vous affiner le style ?";
    const spec = out.proposalSpec || {};

    return jsonOnly(res, 200, { reply, proposalSpec: spec, ok: true });
  } catch (e) {
    return jsonOnly(res, 200, safeReply(e));
  }
}
