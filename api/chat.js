// Vercel/Next Serverless Function (ESM)
// /api/chat.js
import OpenAI from "openai";

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
- STYLE: toujours raisonnable et pro. Palette accessible (contraste suffisant).
  Couleurs: extraire du brief si mention.
  Décor: rester subtil (2-4 layers max).
- Respecter le schéma, JSON strict uniquement.
`;

const FEWSHOTS = [
  {
    role:"user",
    content:"Brief: Identité 'indus' noir & jaune, style énergique, diagonales, tech B2B FR. Offre: refonte site vitrine 6 pages. Deadline 5 semaines. Budget 8–10k."
  },
  {
    role:"assistant",
    content: JSON.stringify({
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
              { type:"diagonal", position:"top", opacity:0.18, h:45, s:95, l:50, rotate: -20, scale: 1.1, blend:"overlay" },
              { type:"dots", position:"right", opacity:0.20, h:220, s:15, l:70, rotate: 0, scale: 1 }
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

function pickJson(txt){
  try{
    const s = txt.indexOf("{"); const e = txt.lastIndexOf("}");
    if(s>=0 && e>s) return JSON.parse(txt.slice(s, e+1));
  }catch{/* ignore */}
  return null;
}

export default async function handler(req, res){
  // CORS safe par défaut (utile en local)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods","POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  if(req.method === "GET"){
    return res.status(200).json({ ok:true, health:"/api/chat up" });
  }

  if(req.method !== "POST"){
    return res.status(405).json({ error:"Method not allowed" });
  }

  try{
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message, proposalSpec, history } = req.body || {};

    const messages = [
      { role:"system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      ...(Array.isArray(history) ? history.map(m=>({ role: m.role, content: String(m.content||"") })) : []),
      { role:"user", content: String(message||"") }
    ];

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages
    });

    const text = r.choices?.[0]?.message?.content?.trim() || "";
    const parsed = pickJson(text) || { reply: text || "(vide)", proposalSpec: null, actions: [] };

    // Merge très léger si tu renvoies déjà un proposalSpec de base
    if(proposalSpec && parsed.proposalSpec){
      parsed.proposalSpec = {
        ...proposalSpec,
        ...parsed.proposalSpec,
        meta: { ...(proposalSpec.meta||{}), ...(parsed.proposalSpec.meta||{}) }
      };
    }

    return res.status(200).json(parsed);
  }catch(err){
    console.error("API /api/chat error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
