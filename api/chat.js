// /api/chat.js — Vercel Serverless (Node 18+)
// IA "Senior Proposal Strategist + 3D HTML/CSS Designer"
// Sortie JSON stricte + fallback (jamais d’HTML) pour éviter les erreurs réseau.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// =========================== SYSTEM PROMPT ===========================
const SYSTEM_PROMPT = `
Tu es **PropoFlash Brain** : 
- Expert mondial des **propositions commerciales** (B2B/B2C), structuration, valeur, pricing.
- **Designer 3D HTML/CSS** (effets glow/mesh/dots/diagonal, élévations, grilles responsives, typographie).
- Chef d'orchestre **conversationnel** : questionne, reformule, propose, mémorise, jamais redondant.

## Objectifs
1) Conduire un vrai **dialogue** : poser les bonnes questions (objectif, client, contexte, contraintes, style, budget/échéance, preuves).
2) Construire/affiner une **proposition** cohérente et **super design**, pages verticales (cover, lettre, résumé, objectifs, approche/phasage, livrables in/out, planning, pricing, hypothèses/risques, prochaines étapes).
3) Générer du **style live** (palette, typo, décor 3D doux, shapes) pour l’aperçu.
4) Garder une **mémoire structurée** (ne pas faire répéter).

## Dialogue — règles
- **FR par défaut** si ambigu.
- **Toujours 1 à 3 questions utiles max** pour avancer, jamais une liste interminable.
- **Ne réinterroge pas** ce qui est déjà mémorisé ; exploite la mémoire.
- Quand des infos manquent, **fais des hypothèses raisonnables** mais **marque-les** "à confirmer".

## Style & accessibilité
- Contraste suffisant (ink vs surface).
- Design pro, subtil, moderne ; 2–4 layers décor max (glow/mesh/dots/diagonal/grid), pas flashy.
- 3D soft : ombres réalistes, degrés faibles.

## Sortie — JSON STRICT UNIQUEMENT
Renvoie **exactement** cet objet (même si partiel) :

{
  "reply": "texte pour l'utilisateur (questions incluses si besoin)",
  "proposalSpec": { ... },                // sections de la propal (tu peux envoyer des deltas)
  "designSpecDiff": {                     // diff à fusionner dans meta.style
    "palette": { "primary":"#hex", "secondary":"#hex", "surface":"#hex", "ink":"#hex", "muted":"#hex", "stroke":"#hex", "accentA":"#hex", "accentB":"#hex" },
    "typography": { "heading":"Inter|Montserrat|Poppins|Playfair", "body":"Inter" },
    "shapes": { "radius":"12px|16px", "shadow":"0 18px 48px rgba(10,16,32,.12)" },
    "decor_layers": [
      { "type":"glow|gradient_blob|grid|dots|diagonal|mesh", "position":"top|bottom|left|right|center", "opacity":0.18, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"normal|screen|overlay" }
    ]
  },
  "previewOps": [                        // actions ciblées pour l'aperçu (facultatif)
    { "op":"set", "path":"meta.title", "value":"Proposition — ..." },
    { "op":"ensureSection", "id":"executive_summary" },
    { "op":"append", "path":"pricing.items", "value":{ "name":"Cadrage", "qty":1, "unit":"forfait", "unit_price":1500 } }
  ],
  "memoryPatch": {                       // ce que tu as compris/confirmé (sera mergé côté client)
    "lang":"fr|en",
    "client":"", "company":"", "industry":"",
    "tone":["sobre","corporate"], "colors":["bleu","gris"],
    "constraints":{"deadline":"","budget":""},
    "known": ["..."], "unknown": ["besoin de ..."]
  },
  "actions": [                           // éventuels next steps machine
    { "type":"ask", "field":"client", "hint":"Quel est le nom du client ?" },
    { "type":"preview" }
  ]
}

### Conseils design rapides
- "luxe/premium/noir-or" -> noir #111827 + or #E5B344, texture faible.
- "sobre/corporate/bleu" -> bleus froids, gris doux, Inter, décor léger.
- "magazine/éditorial/serif" -> Playfair/Source Serif en heading.
- "startup/vibrant" -> secondaires saturées, radius ↑, légère texture.
`.trim();

// =========================== FEWSHOTS (1 mini exemple) ===========================
const FEWSHOTS = [
  {
    role: "user",
    content:
      "Style sobre corporate bleu. Client banque. Je veux une proposition pour landing page d’un nouveau service. Délai 4 semaines.",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply:
        "Parfait. Pour affiner : 1) Nom du client ? 2) Objectif clé de la landing (leads, rdv, souscriptions) ? 3) Avez-vous un budget indicatif ?",
      designSpecDiff: {
        palette: {
          primary: "#0B5ED7",
          secondary: "#5B8DEF",
          surface: "#FFFFFF",
          ink: "#0A1020",
          muted: "#687086",
          stroke: "#E3E8F5",
          accentA: "#7FB3FF",
          accentB: "#A6C8FF",
        },
        typography: { heading: "Inter", body: "Inter" },
        shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
        decor_layers: [
          { type: "glow", position: "top", opacity: 0.18, h: 220, s: 60, l: 55 },
          { type: "dots", position: "right", opacity: 0.14, h: 220, s: 20, l: 70, scale: 1 },
        ],
      },
      memoryPatch: {
        lang: "fr",
        industry: "banque",
        tone: ["sobre", "corporate"],
        colors: ["bleu"],
        constraints: { deadline: "4 semaines" },
      },
      actions: [{ type: "preview" }],
    }),
  },
];

// ============================== UTILITAIRES ===============================
function jsonOnly(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.send(JSON.stringify(data));
}

function asJson(txt) {
  try { return JSON.parse(txt); } catch {}
  const m = txt && txt.match(/\{[\s\S]*\}$/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function safeReply(err) {
  const e = err ? String(err.message || err) : undefined;
  return {
    reply:
      "Je commence la proposition. Dites-moi le client, les objectifs business, le style (ex. sobre/entreprise/bleu) et un ordre de budget/délai.",
    proposalSpec: {
      meta: {
        lang: "fr",
        title: "Proposition commerciale",
        currency: "EUR",
      },
    },
    designSpecDiff: {
      palette: {
        primary: "#3B82F6",
        secondary: "#8B5CF6",
        surface: "#FFFFFF",
        ink: "#0A1020",
        muted: "#6B7280",
        stroke: "#E5E7EB",
        accentA: "#60A5FA",
        accentB: "#93C5FD",
      },
      typography: { heading: "Inter", body: "Inter" },
      shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
      decor_layers: [{ type: "glow", position: "top", opacity: 0.18, h: 220, s: 60, l: 55 }],
    },
    memoryPatch: { lang: "fr" },
    actions: [{ type: "preview" }],
    fallback: true,
    error: e,
  };
}

// ================================ HANDLER ================================
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return jsonOnly(res, 204, {});
  if (req.method !== "POST") return jsonOnly(res, 405, { ok: false, error: "Use POST" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return jsonOnly(res, 200, safeReply("Missing OPENAI_API_KEY"));

  // corps
  let body = {};
  try { body = req.body ?? JSON.parse(req.body || "{}"); } catch {}
  const message = String(body.message || "");
  const proposalSpec = body.proposalSpec || {};
  const memory = body.memory || {};
  const history = Array.isArray(body.history) ? body.history : [];

  // conversation
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...FEWSHOTS,
    // petite mémoire synthétique injectée au modèle
    {
      role: "system",
      content: `Mémoire actuelle (résumé JSON) : ${JSON.stringify(memory).slice(0, 3000)}`,
    },
    ...history.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
    {
      role: "user",
      content:
        `Dernier état (extrait) : ${JSON.stringify({
          meta: proposalSpec?.meta || {},
          sections: Object.keys(proposalSpec || {}).filter((k) => k !== "meta"),
        }).slice(0, 1200)}\n\nMessage utilisateur : ${message}`,
    },
  ];

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    const txt = await r.text();
    if (!r.ok) {
      return jsonOnly(res, 200, safeReply(new Error(`OpenAI ${r.status}: ${txt.slice(0, 600)}`)));
    }
    const out = asJson(txt) || {};
    // valeurs de secours au cas où
    const reply = out.reply || "J’ai avancé la structure. Souhaitez-vous affiner le style ou le périmètre ?";
    const spec = out.proposalSpec || {};
    const styleDiff = out.designSpecDiff || {};
    const previewOps = Array.isArray(out.previewOps) ? out.previewOps : [];
    const memoryPatch = out.memoryPatch || {};
    const actions = Array.isArray(out.actions) ? out.actions : [{ type: "preview" }];

    return jsonOnly(res, 200, {
      ok: true,
      reply,
      proposalSpec: spec,
      designSpecDiff: styleDiff,
      previewOps,
      memoryPatch,
      actions,
    });
  } catch (e) {
    return jsonOnly(res, 200, safeReply(e));
  }
}
