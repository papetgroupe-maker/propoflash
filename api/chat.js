// /api/chat.js
// API route compatible Vercel (Node runtime). Pas besoin du SDK OpenAI.
// Assure-toi d'avoir OPENAI_API_KEY dans les variables d'env du projet.

const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist & Bid Writer (FR/EN).
OBJECTIF: transformer chaque échange en une proposition commerciale exploitable,
structurée dans un schéma "proposalSpec" et un message "reply" clair, orienté décision.

RENVOIE UNIQUEMENT un JSON valide (pas de texte hors JSON) au format:
{
  "reply": "<texte lisible pour l'utilisateur>",
  "proposalSpec": {
    "meta": { "lang":"fr|en", "title":"", "company":"", "client":"", "date":"", "currency":"EUR",
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

RÈGLES:
- FR/EN selon meta.lang ou contexte (FR par défaut).
- Toujours un JSON strictement valide, aucun texte en dehors.
- Si des infos manquent: remplir au mieux + "actions: ask".
- Pricing: items + hypothèses; calculer "subtotal" si manquant.
`;

const FEWSHOTS = [
  {
    role: "user",
    content:
      "Brief: refonte site vitrine 8 pages, deadline 6 semaines, budget cible 8-12 k€, FR.",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply:
        "Je prépare une proposition structurée (cadrage, design, dev, recette) avec tarifs au forfait et prochaines étapes.",
      proposalSpec: {
        meta: { lang: "fr", title: "Proposition — Refonte site vitrine", currency: "EUR" },
        executive_summary: {
          paragraphs: ["Objectif: moderniser l’image, améliorer conversions, autonomie CMS."],
        },
        approach: {
          phases: [
            { title: "Cadrage & ateliers", duration: "1 semaine",
              activities: ["Atelier objectifs","Arborescence"], outcomes: ["Backlog validé"] },
            { title: "Design UI", duration: "2 semaines",
              activities: ["Maquettes","Design system"], outcomes: ["UI validée"] },
            { title: "Développement", duration: "2 semaines",
              activities: ["Intégration","CMS"], outcomes: ["Site prêt à recetter"] },
            { title: "Recette & mise en ligne", duration: "1 semaine",
              activities: ["Tests","Corrections","Go-live"], outcomes: ["Prod en ligne"] }
          ]
        },
        pricing: {
          model: "forfait",
          currency: "EUR",
          tax_rate: 20,
          items: [
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

module.exports = async (req, res) => {
  // CORS light (utile si tu changes d’hébergement)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, proposalSpec, history = [] } = req.body || {};
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      ...history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content || "" })),
      proposalSpec ? { role: "user", content: `Spec actuelle:\n${JSON.stringify(proposalSpec)}` } : null,
      { role: "user", content: message || "" },
    ].filter(Boolean);

    // Appel OpenAI
    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages
      })
    });

    const body = await openaiResp.json().catch(() => null);
    if (!openaiResp.ok || !body) {
      console.error("OpenAI error:", openaiResp.status, body);
      return res.status(500).json({ error: "OpenAI error", details: body });
    }

    const content = body?.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      // Le modèle a renvoyé autre chose que du JSON (rare avec response_format)
      const fallback = (content || "").trim() || "Je n’ai pas pu structurer la proposition. Reformulez.";
      return res.status(200).json({ reply: fallback, actions: [] });
    }

    // Nettoyage + merge meta existante
    if (parsed?.proposalSpec && proposalSpec?.meta) {
      parsed.proposalSpec.meta = { ...(proposalSpec.meta || {}), ...(parsed.proposalSpec.meta || {}) };
    }

    const reply = parsed?.reply || "Je n’ai pas pu structurer la proposition.";
    const out = {
      reply,
      proposalSpec: parsed?.proposalSpec || null,
      actions: Array.isArray(parsed?.actions) ? parsed.actions : []
    };

    return res.status(200).json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", details: e.message });
  }
};
