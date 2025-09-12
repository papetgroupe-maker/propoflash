// /api/chat.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist & Bid Writer (FR/EN).
OBJECTIF: transformer chaque échange en une proposition exploitable,
structurée dans un schéma "proposalSpec" + un "reply" clair.

TOUJOURS respecter ce format JSON:
{
  "reply": "<texte lisible pour l'utilisateur>",
  "proposalSpec": {
    "meta": {
      "lang": "fr|en",
      "title": "",
      "company": "",
      "client": "",
      "date": "",
      "currency": "EUR",
      "style": {
        "themeId": "minimal-slate|modern-mono|bold-yellow|soft-pastel|tech-blue",
        "primary": "#hex",
        "secondary": "#hex",
        "paper": "#hex",
        "ink": "#hex",
        "muted": "#hex",
        "stroke": "#hex",
        "radius": 12,
        "shadow": "soft|none|hard",
        "fonts": { "headings": "Inter", "body": "Inter" },
        "cover": { "layout": "angled-band|clean|top-bar" },
        "pattern": { "kind": "none|dots|grid", "opacity": 0.1 },
        "derivedFrom": "user-intent|logo|default"
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

STYLE/THEME (IMPORTANT):
- Déduis un thème visuel à partir du brief / des mots-clés (ex: minimal, noir & blanc, jaune/noir, corporate, luxe, fun, tech).
- Mappe vers l’un de: minimal-slate, modern-mono, bold-yellow, soft-pastel, tech-blue.
- Renseigne les tokens dans meta.style: primary (couleur d’accent), secondary (accent 2), paper (fond de page),
  ink (texte), muted (texte secondaire), stroke (traits), radius (arrondis), shadow (soft par défaut).
- Si l’utilisateur impose des couleurs / thème → respecte. Sinon choisis "le plus proche" et mets derivedFrom:"user-intent".
- Si le logo est mentionné ou présent (spec.meta.style.logoDataUrl dans spec actuelle) et aucune couleur n’est fixée,
  propose un set cohérent (contraste AA), derivedFrom:"logo".

PRINCIPES:
- FR/EN selon meta.lang (déduire; FR par défaut).
- Toujours produire une proposalSpec cohérente; si info manquante → actions: ask.
- Pricing: si incertain → items + hypothèses + marquer "à confirmer". Calculer subtotal si manquant.
- Ne renvoyer que le JSON demandé.
`;

const FEWSHOTS = [
  { role:"user", content:"Brief: refonte site vitrine 8 pages, deadline 6 semaines, budget cible 8–12 k€, style sobre corporate, FR." },
  { role:"assistant", content: JSON.stringify({
      reply:"Je prépare une proposition structurée (cadrage, design, dev, recette) avec un thème sobre corporate.",
      proposalSpec:{
        meta:{
          lang:"fr",
          title:"Proposition — Refonte site vitrine",
          currency:"EUR",
          style:{
            themeId:"minimal-slate",
            primary:"#3B82F6",
            secondary:"#8B5CF6",
            paper:"#FFFFFF",
            ink:"#0A1020",
            muted:"#5C667A",
            stroke:"#E7ECF6",
            radius:12,
            shadow:"soft",
            fonts:{headings:"Inter", body:"Inter"},
            cover:{layout:"top-bar"},
            pattern:{kind:"none", opacity:0.0},
            derivedFrom:"user-intent"
          }
        },
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

    // Merge meta + style sans écraser ce qui existe déjà
    if (out.proposalSpec) {
      const prev = proposalSpec || {};
      const prevMeta = prev.meta || {};
      const nextMeta = { ...prevMeta, ...(out.proposalSpec.meta||{}) };
      const mergedStyle = { ...(prevMeta.style||{}), ...((out.proposalSpec.meta||{}).style||{}) };
      out.proposalSpec.meta = { ...nextMeta, style: mergedStyle };
    }

    res.status(200).json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: "Erreur serveur", actions: [] });
  }
}
