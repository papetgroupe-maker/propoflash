// /api/chat.js — Vercel Serverless Function (sans dépendances externes)

// 🔐 Clé OpenAI
// OPTION PROD (recommandé) : définis OPENAI_API_KEY dans Vercel → Settings → Environment Variables
// OPTION DEV (non recommandé) : remplace "" ci-dessous par ta clé pour tester en local,
//                               mais NE COMMIT PAS cette valeur.
const FALLBACK_DEV_KEY = ""; // <-- (DEV UNIQUEMENT) mets "sk-..." ici si tu dois tester vite

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
  "designSpecDiff": {},
  "memoryUpdate": { "design_prefs":{}, "facts":{}, "pending_questions":[] },
  "actions": [{ "type":"preview" } | { "type":"ask", "field":"meta.client", "hint":"Quel est le client ?" }]
}

RÈGLES:
- Langue: déduire; FR par défaut si ambigu.
- Ne JAMAIS inventer d'entités critiques; si info manque → "actions: ask".
- Si budget incertain: items + hypothèses + marquer "à confirmer".
- STYLE: pro & accessible (contraste).
- Répondre en JSON STRICT UNIQUEMENT.
`;

const FEWSHOTS = [
  { role: "user", content: "Brief: Identité 'indus' noir & jaune, style énergique, diagonales, tech B2B FR. Offre: refonte site vitrine 6 pages. Deadline 5 semaines. Budget 8–10k." },
  { role: "assistant", content: JSON.stringify({
      reply: "Je prépare une proposition structurée (cadrage, design, dev) avec un style noir/jaune industriel et des diagonales subtiles.",
      proposalSpec: {
        meta: {
          lang: "fr",
          title: "Proposition — Refonte site vitrine",
          currency: "EUR",
          style: {
            palette: {
              primary: "#111827", secondary: "#F59E0B",
              surface: "#FFFFFF", ink:"#0A1020", muted:"#5C667A", stroke:"#E5E7EB",
              accentA:"#FCD34D", accentB:"#F59E0B"
            },
            shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.16)" },
            typography: { heading:"Montserrat", body:"Inter" },
            decor_layers: [
              { type:"diagonal", position:"top", opacity:0.18, h:45, s:95, l:50, rotate:-20, scale:1.1, blend:"overlay" },
              { type:"dots", position:"right", opacity:0.20, h:220, s:15, l:70, rotate:0, scale:1 }
            ]
          }
        },
        executive_summary: { paragraphs:["Refonte pour crédibiliser l’offre, améliorer la conversion et l’autonomie CMS."]},
        objectives: { bullets:["Moderniser l’image","Accroître les leads","Optimiser SEO de base"]},
        approach: {
          phases:[
            { title:"Cadrage", duration:"1 semaine", activities:["Atelier objectifs","Arborescence"], outcomes:["Backlog validé"] },
            { title:"Design UI", duration:"2 semaines", activities:["Maquettes","Design system"], outcomes:["UI validée"] },
            { title:"Développement", duration:"1.5 semaine", activities:["Intégration","CMS"], outcomes:["Site prêt"] },
            { title:"Recette & Go-live", duration:"0.5 semaine", activities:["Tests","Corrections","Mise en ligne"], outcomes:["Prod en ligne"] }
          ]
        },
        pricing:{
          model:"forfait", currency:"EUR", tax_rate:20,
          items:[
            { name:"Cadrage", qty:1, unit:"forfait", unit_price:1500, subtotal:1500 },
            { name:"Design (6 pages)", qty:1, unit:"forfait", unit_price:2800, subtotal:2800 },
            { name:"Dév & intégration", qty:1, unit:"forfait", unit_price:3600, subtotal:3600 }
          ],
          terms:["40% commande, 40% design, 20% livraison","Validité: 30 jours"]
        },
        next_steps:{ paragraphs:["Point 30 min pour verrouiller le périmètre et le planning."] }
      }
    })
  }
];

// —— helpers
function safeJson(str, fallback = {}) {
  if (typeof str !== "string") return fallback;
  try { return JSON.parse(str); } catch {}
  const i = str.indexOf("{"), j = str.lastIndexOf("}");
  if (i >= 0 && j > i) { try { return JSON.parse(str.slice(i, j + 1)); } catch {} }
  return fallback;
}
function error(res, code, message, details) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: message, details }));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return error(res, 405, "Method Not Allowed", { allow: "POST" });

    // 🔑 Récupère la clé (env d'abord, sinon fallback dev)
    const key = process.env.OPENAI_API_KEY || FALLBACK_DEV_KEY;
    if (!key) return error(res, 500, "OPENAI_API_KEY is not set (and no dev fallback provided)");

    // parse body
    let body = {};
    try {
      if (typeof req.body === "string") body = JSON.parse(req.body);
      else if (req.body) body = req.body;
      else {
        const chunks = [];
        for await (const ch of req) chunks.push(ch);
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      }
    } catch { return error(res, 400, "Invalid JSON body"); }

    const { message = "", proposalSpec = {}, history = [], memory = {} } = body || {};

    const userPrompt = [
      `Message utilisateur:\n"""${message}"""`,
      `\n— Contexte: proposalSpec courant:`,
      JSON.stringify(proposalSpec || {}, null, 2),
      `\n— Mémoire (préférences/faits):`,
      JSON.stringify(memory || {}, null, 2),
      `\n— Historique (derniers échanges):`,
      JSON.stringify(history || [], null, 2),
      `\nExigence: réponds UNIQUEMENT en JSON STRICT selon le schéma.`
    ].join("\n");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      { role: "user", content: userPrompt }
    ];

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return error(res, r.status, data?.error?.message || "OpenAI error", data);
    }

    const text = data?.choices?.[0]?.message?.content ?? "{}";
    const json = safeJson(text, { reply: text });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 200;
    res.end(JSON.stringify(json));
  } catch (e) {
    return error(res, 500, "Server error", String(e?.message || e));
  }
};
