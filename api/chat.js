// /api/chat.js
// Vercel Serverless (Node). Génère { reply, proposalSpec, actions }.
// - Expertise vente B2B + direction artistique
// - Reconnaît le type de requête (contenu / design / prix / méta)
// - Garantit JSON strict + contraste lisible (AA >= 4.5:1)

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- Utils ----------
function asJson(txt) {
  try {
    const s = txt.indexOf("{");
    const e = txt.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(txt.slice(s, e + 1));
  } catch {}
  return null;
}
const HEX = /^#?([0-9a-f]{6})$/i;
const clamp01 = (n) => Math.min(1, Math.max(0, n));
function hexToRgb(hex) {
  const m = (hex || "").toString().match(HEX);
  if (!m) return { r: 0, g: 0, b: 0 };
  const i = parseInt(m[1], 16);
  return { r: (i >> 16) & 255, g: (i >> 8) & 255, b: i & 255 };
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function contrastRatio(a, b) {
  const L1 = luminance(a), L2 = luminance(b);
  const hi = Math.max(L1, L2) + 0.05, lo = Math.min(L1, L2) + 0.05;
  return hi / lo;
}
function ensureReadablePalette(p) {
  // Défauts
  const palette = {
    primary: "#3B82F6",
    secondary: "#8B5CF6",
    surface: "#FFFFFF",
    ink: "#0A1020",
    muted: "#5C667A",
    stroke: "#E0E6F4",
    accentA: "#60A5FA",
    accentB: "#93C5FD",
    ...(p || {}),
  };
  // Garantir contraste texte/surface
  if (contrastRatio(palette.ink, palette.surface) < 4.5) {
    // Essaie : texte foncé sur surface claire ou inverse
    const dark = "#0A1020", light = "#FFFFFF";
    const try1 = contrastRatio(dark, palette.surface);
    const try2 = contrastRatio(light, palette.surface);
    palette.ink = try1 >= try2 ? dark : light;
    // Si surface trop proche, inverse surface + ink
    if (contrastRatio(palette.ink, palette.surface) < 4.5) {
      const swap = palette.surface;
      palette.surface = palette.ink === dark ? "#FFFFFF" : "#0A1020";
      palette.ink = swap === "#FFFFFF" ? "#0A1020" : "#FFFFFF";
    }
  }
  return palette;
}
function deepMerge(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
  if (a && typeof a === "object" && b && typeof b === "object") {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
    return out;
  }
  return b === undefined ? a : b;
}

// ---------- Prompt ----------
const STYLE_LEXICON = `
# Lexique design (FR/EN) → tokens
- luxe | premium | haut de gamme | luxury → noir #111827, or #E5B344/#CFB06A, serif titres, texture très faible, reflets doux (glow)
- sobre | corporate | pro | institutionnel → bleus/gris froids, Inter/DM Sans, contrastes élevés, pas d'effets
- magazine | éditorial | éditoriale | editorial → Playfair/Source Serif en titres, interlignage ↑, grilles
- startup | vibrant | fun | playful → secondaires saturées, radius ↑, blobs/dots légers
- nature | éco | green | durable | eco → verts sapin + beiges chauds, textures grain/dots très faibles
- tech | cyber | data | IA | SaaS → bleu pétrole, violet, diagonales/dots, mesh subtil
- sport | énergie → rouges/oranges, diagonales dynamiques
- 3D | glass | néomorphisme → glow doux, mesh radial, ombres longues faibles
- Canva-like → propreté, spacing généreux, icônes nettes, décor ≤ 3 couches, lisibilité prioritaire
`;

const SYSTEM_PROMPT = `
ROLE
Tu es à la fois : (1) Senior B2B Proposal Strategist, (2) Brand/Visual Designer, (3) Layout Artist.
Objectif : transformer chaque échange en une proposition exploitable, cohérente et esthétiquement pro (qualité Canva).

SORTIE — JSON STRICT
{
  "reply": "<texte pour l’utilisateur (FR si ambigu)>",
  "proposalSpec": {
    "meta": {
      "lang":"fr|en",
      "title":"", "company":"", "client":"", "date":"", "currency":"EUR",
      "style": {
        "palette": { "primary":"#hex","secondary":"#hex","surface":"#hex","ink":"#hex","muted":"#hex","stroke":"#hex","accentA":"#hex","accentB":"#hex" },
        "shapes": { "radius":"12px|16px|20px","shadow":"0 18px 48px rgba(10,16,32,.12)" },
        "typography": { "heading":"Inter|Montserrat|Playfair|Poppins|DM Sans","body":"Inter|DM Sans" },
        "logoDataUrl": "",
        "decor_layers":[
          { "type":"glow|gradient_blob|grid|dots|diagonal", "position":"top|bottom|left|right|center", "opacity":0.12, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"normal|screen|overlay" }
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

RÈGLES
- Langue : déduire; FR par défaut. Réponse brève et actionable.
- Ne JAMAIS inventer d'entités critiques (client, société, devis). Si manque → "actions: ask".
- Budget/prix incertains → items + hypothèses + "à confirmer".
- Design : utilise le LEXIQUE ci-dessous pour convertir des mots en tokens (couleurs/typo/décor/3D léger).
- Palette : privilégie l’accessibilité (texte vs surface lisible). Décor ≤ 3 couches, subtil.
- Structure : toujours fournir une spec complète mais compacte; n’ajoute rien hors JSON strict.

${STYLE_LEXICON}
`;

// ---------- Few-shots (très courts) ----------
const FEWSHOTS = [
  {
    role: "user",
    content: "Brief: Identité 'indus' noir & jaune, style énergique, diagonales, tech B2B FR. Offre: refonte site vitrine 6 pages. Deadline 5 semaines. Budget 8–10k."
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply: "Ok. Je prépare une propale cadrage/design/dev, noir-jaune industriel, avec diagonales subtiles et lisibilité élevée.",
      proposalSpec: {
        meta: {
          lang: "fr",
          title: "Proposition — Refonte site vitrine",
          currency: "EUR",
          style: {
            palette: {
              primary:"#111827", secondary:"#F59E0B", surface:"#FFFFFF", ink:"#0A1020", muted:"#5C667A", stroke:"#E5E7EB", accentA:"#FCD34D", accentB:"#F59E0B"
            },
            shapes:{ radius:"12px", shadow:"0 18px 48px rgba(10,16,32,.16)" },
            typography:{ heading:"Montserrat", body:"Inter" },
            decor_layers:[
              { type:"diagonal", position:"top", opacity:0.18, h:45, s:95, l:50, rotate:-20, scale:1.1, blend:"overlay" },
              { type:"dots", position:"right", opacity:0.20, h:220, s:15, l:70, rotate:0, scale:1 }
            ]
          }
        },
        executive_summary:{ paragraphs:["Refonte pour crédibiliser l’offre et améliorer la conversion."]},
        objectives:{ bullets:["Moderniser l’image","Accroître les leads","Optimiser SEO de base"]},
        approach:{ phases:[
          { title:"Cadrage", duration:"1 semaine", activities:["Atelier objectifs","Arborescence"], outcomes:["Backlog validé"] },
          { title:"Design UI", duration:"2 semaines", activities:["Maquettes","Design system"], outcomes:["UI validée"] },
          { title:"Développement", duration:"1.5 semaine", activities:["Intégration","CMS"], outcomes:["Site prêt"] },
          { title:"Recette & Go-live", duration:"0.5 semaine", activities:["Tests","Corrections","Mise en ligne"], outcomes:["Production"] }
        ]},
        pricing:{ model:"forfait", currency:"EUR", tax_rate:20,
          items:[
            { name:"Cadrage", qty:1, unit:"forfait", unit_price:1500, subtotal:1500 },
            { name:"Design (6 pages)", qty:1, unit:"forfait", unit_price:2800, subtotal:2800 },
            { name:"Dév & intégration", qty:1, unit:"forfait", unit_price:3600, subtotal:3600 }
          ],
          terms:["40% commande, 40% design, 20% livraison","Validité: 30 jours"]
        },
        next_steps:{ paragraphs:["Point 30 min pour verrouiller périmètre et planning."] }
      },
      actions:[{type:"preview"}]
    })
  }
];

// ---------- Handler ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = await (async () => {
      if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const txt = await new Promise((r) => {
        let data = ""; req.on("data", (c) => (data += c)); req.on("end", () => r(data || "{}"));
      });
      return JSON.parse(txt || "{}");
    })();

    const userMsg = (body?.message || "").toString().trim();
    const currentSpec = body?.proposalSpec || null;
    const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];

    const ctx = `
Contexte courant (optionnel) :
${JSON.stringify(currentSpec || {}, null, 2)}

Consigne : renvoyer STRICTEMENT un JSON conforme au schéma. Si une info manque (client/société/budget…), ajouter "actions":[{"type":"ask",...}].
`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMsg + "\n\n" + ctx }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages
    });

    const text = completion.choices?.[0]?.message?.content || "{}";
    const json = asJson(text) || {};
    const reply = (json.reply || "OK").toString();

    // Merge & post-process spec + lisibilité palette
    let nextSpec = deepMerge(currentSpec || {}, json.proposalSpec || {});
    if (!nextSpec.meta) nextSpec.meta = { lang: "fr" };
    if (!nextSpec.meta.lang) nextSpec.meta.lang = "fr";

    if (!nextSpec.meta.style) nextSpec.meta.style = {};
    nextSpec.meta.style.palette = ensureReadablePalette(nextSpec.meta.style.palette || {});
    if (!nextSpec.meta.style.shapes) nextSpec.meta.style.shapes = { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" };
    if (!nextSpec.meta.style.typography) nextSpec.meta.style.typography = { heading: "Inter", body: "Inter" };

    res.status(200).json({
      reply,
      proposalSpec: nextSpec,
      actions: Array.isArray(json.actions) ? json.actions : [{ type: "preview" }]
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
