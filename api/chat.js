// /api/chat.js
// Vercel / Next.js (pages/api) — Route serveur pour le chat PropoFlash
// Nécessite la variable d'env OPENAI_API_KEY configurée sur Vercel

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ---- Utilitaires robustes --------------------------------------------------

/** Extrait un objet JSON depuis un texte même s'il y a de la prose autour */
function extractJSON(txt) {
  if (!txt || typeof txt !== "string") return null;
  try {
    // Heuristique: prend du 1er "{" au dernier "}"
    const i = txt.indexOf("{");
    const j = txt.lastIndexOf("}");
    if (i >= 0 && j > i) {
      const slice = txt.slice(i, j + 1);
      return JSON.parse(slice);
    }
  } catch (_) {}
  return null;
}

/** Hard-guard pour renvoyer un squelette valide si le modèle dévie */
function fallbackPayload(lang = "fr") {
  return {
    reply:
      lang === "en"
        ? "I’ve captured your brief. I’ll ask a few key questions to structure the proposal and render a live preview."
        : "J’ai bien capté votre brief. Je vais poser quelques questions clés pour structurer la proposition et générer un aperçu en direct.",
    proposalSpec: {
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
            {
              type: "glow",
              position: "top",
              opacity: 0.18,
              h: 220,
              s: 60,
              l: 55,
              rotate: 0,
              scale: 1,
              blend: "overlay",
            },
          ],
        },
      },
      letter: { paragraphs: [] },
      executive_summary: { paragraphs: [] },
      objectives: { bullets: [] },
      approach: { phases: [] },
      deliverables: { in: [], out: [] },
      timeline: { milestones: [] },
      pricing: {
        model: "forfait",
        currency: "EUR",
        items: [],
        tax_rate: 20,
        terms: [],
        price: null,
      },
      assumptions: { paragraphs: [] },
      next_steps: { paragraphs: [] },
    },
    actions: [{ type: "ask", field: "meta.client", hint: "Quel est le client ?" }],
  };
}

/** Merge simple pour garder un JSON léger côté client */
function coerceToSchema(obj) {
  const fb = fallbackPayload("fr");
  const out = { ...fb, ...obj };

  // Nettoyages minimaux
  if (!out.proposalSpec || typeof out.proposalSpec !== "object") {
    out.proposalSpec = fb.proposalSpec;
  }
  if (!out.reply || typeof out.reply !== "string") {
    out.reply = fb.reply;
  }
  if (!Array.isArray(out.actions)) out.actions = [];
  return out;
}

// ---- Prompt système (expert “sur-entraîné”) --------------------------------

const SYSTEM_PROMPT = `
ROLE: Directeur(trice) de création + Bid Manager senior + Expert 3D/CSS (FR/EN).
MISSION: transformer chaque échange en (1) réponse utile et (2) mise à jour d'une
"proposalSpec" exploitable, complète et prête à rendre un APERÇU ULTRA SOIGNÉ.
Tu es proactif(ve), tu questionnes sans faire répéter, tu mémorises le contexte.

SORTIE OBLIGATOIRE — JSON STRICT :
{
  "reply": "<texte clair adressé à l'utilisateur (FR/EN)>",
  "proposalSpec": {
    "meta": {
      "lang":"fr|en",
      "title":"", "company":"", "client":"", "date":"", "currency":"EUR",
      "style":{
        "palette":{"primary":"#hex","secondary":"#hex","surface":"#hex","ink":"#hex","muted":"#hex","stroke":"#hex","accentA":"#hex","accentB":"#hex"},
        "shapes":{"radius":"12px|16px","shadow":"0 18px 48px rgba(...)"},
        "typography":{"heading":"Inter|Montserrat|Poppins|Playfair|Source Serif","body":"Inter|Source Sans|IBM Plex Sans"},
        "logoDataUrl":"",
        "decor_layers":[
          {"type":"glow|gradient_blob|grid|dots|diagonal","position":"top|bottom|left|right|center","opacity":0.18,"h":220,"s":60,"l":55,"rotate":0,"scale":1,"blend":"normal|screen|overlay"}
        ]
      }
    },
    "letter":{"subject":"","preheader":"","greeting":"","body_paragraphs":[],"closing":"","signature":""},
    "executive_summary":{"paragraphs":[]},
    "objectives":{"bullets":[]},
    "approach":{"phases":[{"title":"","duration":"","activities":[],"outcomes":[]}]} ,
    "deliverables":{"in":[],"out":[]},
    "timeline":{"milestones":[{"title":"","dateOrWeek":"","notes":""}]},
    "pricing":{"model":"forfait|regie","currency":"EUR","items":[{"name":"","qty":1,"unit":"jour|mois|forfait","unit_price":0,"subtotal":0}],"tax_rate":20,"terms":[],"price": null},
    "assumptions":{"paragraphs":[]},
    "next_steps":{"paragraphs":[]}
  },
  "actions":[ { "type":"preview" } | { "type":"ask","field":"meta.client","hint":"Quel est le client ?" } ]
}

RÈGLES & INTELLIGENCE:
- Langue: déduire à partir du message. FR par défaut si ambigu.
- Jamais inventer des noms d’entreprise/clients ou montants si absents → poser des questions “actions: ask”.
- Toujours raisonnable, pro, lisible. Pense accessibilité (contrastes suffisants).
- STYLE: déduire depuis le brief (ex: “sobre corporate bleu pétrole + violet” → palette + typo Inter, décor léger, diagonales).
  - Premium/luxe/noir-or → noir #111827 + or #E5B344, texture discrète, radius 12.
  - Éditorial/serif → heading Playfair/Source Serif, body humanist, interligne >= 1.45.
  - Startup/vibrant → secondaires saturées, radius 16, meshes/dots légers.
- 3D/CSS: propose des “decor_layers” discrets (2–4 max), pas de kitsch.
- Pricing: si incertain → items détaillés + montant “à confirmer”.
- Toujours remplir proprement la “proposalSpec” (même partiellement) pour que l’aperçu change en direct.
- “reply” doit *résumer ce que tu as compris*, proposer les prochaines questions/actions, et confirmer les changements de style/structure.

CONSTANCE & CONTEXTE:
- Utilise l’historique fourni: ne fais pas répéter, reprends les choix (palette, typo, budget).
- Si l’utilisateur parle design → ajuste meta.style en priorité (palette, typography, decor_layers).
`;

// Few-shot concis pour donner le ton et le format
const FEWSHOTS = [
  {
    role: "user",
    content:
      "Brief: Identité 'indus' noir & jaune, diagonales tech B2B FR. Refonte 6 pages. 5 semaines. Budget 8–10k.",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply:
        "J’applique un style noir/jaune industriel (diagonales) et je structure cadrage → UI → dev → recette. Je vous propose de valider le périmètre et la page d’accueil d’abord.",
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
          price: null,
        },
        next_steps: { paragraphs: ["Point 30 min pour verrouiller le périmètre et le planning."] },
      },
      actions: [{ type: "preview" }],
    }),
  },
];

// ---- Handler HTTP -----------------------------------------------------------

export default async function handler(req, res) {
  // CORS (au cas où hébergé sur un domaine distinct)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!process.env.OPENAI_API_KEY) {
    // On renvoie 200 pour éviter les “erreur réseau” côté UI
    const fb = fallbackPayload("fr");
    fb.reply =
      "⚠️ Clé OpenAI manquante côté serveur. Je fonctionne en mode dégradé. Ajoutez OPENAI_API_KEY sur Vercel pour activer l’IA.";
    return res.status(200).json(fb);
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const userMessage = String(body.message || "").trim();
    const proposalSpec = body.proposalSpec || null;
    const history = Array.isArray(body.history) ? body.history : [];

    const now = new Date().toISOString().slice(0, 10);

    // Construit le contexte utilisateur: on résume la spec pour donner de la mémoire
    const specForModel = JSON.stringify(
      proposalSpec || {
        meta: { lang: "fr", title: "Proposition commerciale", currency: "EUR" },
      }
    );

    const userPrompt = `
[DATE]: ${now}

[USER_MESSAGE]
${userMessage}

[CURRENT_PROPOSAL_SPEC_JSON]
${specForModel}

[INSTRUCTIONS]
- Mets à jour la proposalSpec de manière sûre et incrémentale (merge-friendly).
- Si l'utilisateur évoque le style → ajuste meta.style (palette, typography, decor_layers, shapes).
- Si une info critique manque (client, périmètre, budget, délais) → "actions: ask".
- Renvoie STRICTEMENT le JSON final selon le schéma. Pas de texte en dehors du JSON.
`;

    // Construit l’historique pour le modèle
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      // Historique récent (max ~10)
      ...history
        .slice(-10)
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      { role: "user", content: userPrompt },
    ];

    // Appel modèle — privilégie gpt-4o pour qualité; fallback 4o-mini
    const model = process.env.PF_OPENAI_MODEL || "gpt-4o";
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.4,
      messages,
      // On demande du JSON mais l’API chat ne garantit pas la validation stricte → extraction robuste.
      // response_format: { type: "json_object" }, // Optionnel (selon modèle)
      max_tokens: 1400,
    });

    const text = response?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(text);
    const payload = coerceToSchema(parsed);

    // Sécurité: borne la taille des arrays pour éviter d’inonder le client
    const cap = (arr, n = 20) => (Array.isArray(arr) ? arr.slice(0, n) : []);
    if (payload?.proposalSpec?.approach?.phases) {
      payload.proposalSpec.approach.phases = cap(payload.proposalSpec.approach.phases, 12);
    }
    if (payload?.proposalSpec?.timeline?.milestones) {
      payload.proposalSpec.timeline.milestones = cap(payload.proposalSpec.timeline.milestones, 24);
    }
    if (payload?.proposalSpec?.pricing?.items) {
      payload.proposalSpec.pricing.items = cap(payload.proposalSpec.pricing.items, 40);
    }
    if (payload?.proposalSpec?.executive_summary?.paragraphs) {
      payload.proposalSpec.executive_summary.paragraphs = cap(
        payload.proposalSpec.executive_summary.paragraphs,
        12
      );
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error("chat api error", err);
    // Renvoie un fallback 200 pour éviter “Erreur réseau” côté UI,
    // mais avec un message explicite dans la réponse assistant.
    const fb = fallbackPayload("fr");
    fb.reply =
      "Je rencontre un souci temporaire lors de la génération. J’ai gardé le contexte et je peux reformuler si vous précisez à nouveau le point clé (style, périmètre, budget…).";
    return res.status(200).json(fb);
  }
}
