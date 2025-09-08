// /api/chat.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist & Bid Writer (FR/EN).
OBJECTIF: transformer chaque échange en une proposition commerciale exploitable,
structurée dans un schéma "proposalSpec" et un message "reply" clair, orienté décision.

OUTPUT JSON STRICT:
{
  "reply": "<texte lisible pour l'utilisateur>",
  "proposalSpec": {
    "meta": { "lang":"fr|en", "title": "", "company":"", "client":"", "date":"", "currency":"EUR",
              "style": { "primary":"#hex", "secondary":"#hex", "logoDataUrl":"" } },
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

PRINCIPES:
- FR/EN selon meta.lang (déduire du contexte; FR par défaut).
- Toujours produire une proposalSpec cohérente; si info manquante → "actions: ask".
- Pricing: si incertain → items + hypothèses + marquer "à confirmer". Calculer subtotal si manquant.
- Ne pas inventer de références; proposer micro-échantillon si aucune preuve.
- Ne renvoyer que le JSON demandé.
`;

const FEWSHOTS = [
  { role:"user", content:"Brief: refonte site vitrine 8 pages, deadline 6 semaines, budget cible 8-12 k€, FR." },
  { role:"assistant", content: JSON.stringify({
      reply:"Je prépare une proposition structurée (cadrage, design, dev, recette) avec tarifs au forfait et prochaines étapes.",
      proposalSpec:{
        meta:{ lang:"fr", title:"Proposition — Refonte site vitrine", currency:"EUR" },
        executive_summary:{ paragraphs:["Objectif: moderniser l’image, améliorer conversions, autonomie CMS."]},
        approach:{ phases:[
          { title:"Cadrage & ateliers", duration:"1 semaine", activities:["Atelier objectifs","Arborescence"], outcomes:["Backlog validé"] },
          { title:"Design UI", duration:"2 semaines", activities:["Maquettes","Design system"], outcomes:["UI validée"] },
          { title:"Développement", duration:"2 semaines", activities:["Intégration","CMS"], outcomes:["Site prêt à recetter"] },
          { title:"Recette & mise en ligne", duration:"1 semaine", activities:["Tests","Corrections","Go-live"], outcomes:["Prod en ligne"] }
        ]},
        pricing:{ model:"forfait", currency:"EUR", tax_rate:20,
          items:[
            { name:"Cadrage & ateliers", qty:1, unit:"forfait", unit_price:1800, subtotal:1800 },
            { name:"Design UI (8 pages)", qty:1, unit:"forfait", unit_price:3200, subtotal:3200 },
            { name:"Développement & intégration", qty:1, unit:"forfait", unit_price:4200, subtotal:4200 }
          ],
          terms:["40% commande, 40% design, 20% livraison","Validité: 30 jours"]
        },
        next_steps:{ paragraphs:["Point 30 min pour valider périmètre & planning."] }
      },
      actions:[{type:"preview"}]
    })
  }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }
  try {
    const { message, proposalSpec, history = [] } = req.body || {};
    const messages = [
      { role:"system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      proposalSpec ? { role:"user", content: `Spec actuelle:\n${JSON.stringify(proposalSpec)}` } : null,
      { role:"user", content: message || "" },
    ].filter(Boolean);

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages
    });

    let out = {};
    try { out = JSON.parse(resp.choices[0].message.content || "{}"); }
    catch { out = { reply:"Je n’ai pas pu structurer la proposition. Reformulez.", actions:[] }; }

    // Merge minimal sur meta
    if (out.proposalSpec) {
      out.proposalSpec.meta = { ...(proposalSpec?.meta||{}), ...(out.proposalSpec.meta||{}) };
    }

    res.status(200).json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: "Erreur serveur", actions: [] });
  }
}
