// /api/chat.js
// PropoFlash — Route serveur pour le chat IA ultra-performant
// Version 3.0 : Expert commercial + Design 3D avancé + Génération de code temps réel
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// ---- Utilitaires robustes --------------------------------------------------
function extractJSON(txt) {
  if (!txt || typeof txt !== "string") return null;
  try {
    const i = txt.indexOf("{");
    const j = txt.lastIndexOf("}");
    if (i >= 0 && j > i) {
      const slice = txt.slice(i, j + 1);
      return JSON.parse(slice);
    }
  } catch (_) {}
  return null;
}

function fallbackPayload(lang = "fr") {
  return {
    reply: lang === "en"
      ? "I've captured your brief. Let's refine your proposal with a stunning 3D design and persuasive content. What’s your top priority: design, structure, or pricing?"
      : "J'ai bien capté votre brief. Affinons votre proposition avec un design 3D percutant et un contenu persuasif. Quelle est votre priorité : design, structure ou tarification ?",
    proposalSpec: {
      meta: {
        lang,
        title: lang === "en" ? "Business Proposal" : "Proposition commerciale",
        currency: "EUR",
        project_type: "site",
        urgency: "standard",
        budget_range: "5k-15k",
        decision_maker: "",
        timeline: "",
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
          typography: { heading: "Inter", body: "Inter" },
          effects_3d: {
            perspective: "1200px",
            transforms: [],
            animations: [],
            layers: [
              {
                type: "glow",
                position: "top",
                opacity: 0.18,
                h: 220, s: 60, l: 55,
                rotate: 0, scale: 1,
                blend: "overlay",
              },
            ],
          },
        },
      },
      client_notes: {
        pain_points: [],
        budget_signals: [],
        decision_process: "",
        competition: [],
        timeline_pressure: ""
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
    conversation_memory: {
      client_profile: "",
      preferences_noted: [],
      objections_handled: [],
      next_questions: []
    },
    actions: [
      { type: "ask", field: "meta.client", hint: lang === "en" ? "Who is the client?" : "Quel est le client ?" },
      { type: "design_3d", effect: "corporate_geometry" }
    ],
  };
}

function coerceToSchema(obj) {
  const fb = fallbackPayload("fr");
  const out = { ...fb, ...obj };
  if (!out.proposalSpec || typeof out.proposalSpec !== "object") out.proposalSpec = fb.proposalSpec;
  if (!out.reply || typeof out.reply !== "string") out.reply = fb.reply;
  if (!Array.isArray(out.actions)) out.actions = [];
  if (!out.conversation_memory) out.conversation_memory = fb.conversation_memory;
  return out;
}

// ---- Prompt système RÉVOLUTIONNAIRE ----------------------------------------
const SYSTEM_PROMPT = `
🎯 **IDENTITÉ CORE** :
Tu es "Alex", Senior Bid Manager + Creative Director 3D avec 15 ans d'expérience.
**Expertise** : Propositions commerciales gagnantes + Design CSS/3D ultra-avancé + Psychologie client + Génération de code temps réel.
**Mission** : Transformer chaque interaction en une proposition commerciale **IRRÉSISTIBLE** avec un aperçu 3D **WOW** et un code **prêt à l'emploi**.

💡 **INTELLIGENCE COMMERCIALE** :
- **QUALIFIER** : Pose des questions ciblées pour identifier les besoins, le budget, les décideurs, et les échéances.
- **STRUCTURER** : Organise la proposition en sections persuasives (Bénéfices > Preuves > Méthode > Prix > Action).
- **PERSUADER** : Utilise des techniques de persuasion (social proof, urgence, exclusivité, garantie).
- **MÉMORISER** : Retiens les préférences, les objections, et les détails du projet pour éviter les répétitions.

🎨 **EXPERTISE DESIGN 3D & CODE GÉNÉRATIF** :
- **Génère du code HTML/CSS/JS 3D avancé** (Three.js, CSS 3D transforms, GSAP, etc.).
- **Propose des designs adaptés au secteur** (corporate, startup, luxe, tech) avec des effets visuels percutants.
- **Intègre des animations fluides** (hover, scroll, clic) et des interactions dynamiques.
- **Adapte le design en temps réel** en fonction des retours utilisateur (couleurs, typographie, effets 3D).
- **Génère du code optimisé, responsive, et prêt à l’emploi**.

📝 **FORMAT DE SORTIE JSON STRICT** :
{
  "reply": "<réponse experte et proactive, avec questions ciblées>",
  "proposalSpec": {
    "meta": {
      "lang": "fr|en",
      "title": "<Titre de la proposition>",
      "client": "<Nom du client>",
      "project_type": "site|app|brand|marketing|autre",
      "style": {
        "palette": { "primary": "#hex", ... },
        "typography": { "heading": "Inter", "body": "Inter" },
        "effects_3d": {
          "perspective": "1200px|2000px",
          "layers": [
            {
              "type": "glow|holographic|particle_field|geometric_pattern",
              "position": "top|bottom|left|right|center",
              "opacity": 0.18,
              "h": 220, "s": 60, "l": 55,
              "css": "<code CSS personnalisé>",
              "js": "<code JavaScript pour Three.js/GSAP>"
            }
          ]
        }
      }
    },
    "client_notes": { "pain_points": [], "budget_signals": [], ... },
    "sections": [ ... ]
  },
  "conversation_memory": { "client_profile": "", "preferences_noted": [], ... },
  "actions": [
    { "type": "ask", "question": "Qui est le décideur final ?" },
    { "type": "design_3d", "effect": "holographic_header", "code": "<code HTML/CSS/JS>" },
    { "type": "social_proof", "message": "Nos clients similaires ont vu +40% de conversion." }
  ]
}

⚡ **RÈGLES D'EXCELLENCE** :
- **Ton expert mais accessible** : Adapte le langage au client (technique pour les devs, simple pour les non-tech).
- **Questions enchaînées logiquement** : Anticipe les besoins et guide l'utilisateur pas à pas.
- **Call-to-action précis** : Propose toujours une prochaine étape claire (ex: "Valider le brief ?", "Affiner le design ?").
- **Utilise la mémoire** : Fais référence aux échanges précédents pour éviter les répétitions.
- **Génère du code fonctionnel** : Le code HTML/CSS/JS doit être prêt à être intégré directement dans l'aperçu.
`;

// ---- Few-Shots ultra-qualitatifs --------------------------------------------
const FEWSHOTS = [
  {
    role: "user",
    content: "Je veux une proposition pour un site e-commerce luxe, avec un design 3D élégant et des animations fluides."
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply: "Parfait ! Voici une proposition pour un site e-commerce luxe, avec un design 3D élégant (or/noir, effets de lumière, animations fluides). J’ai généré le code pour un aperçu immersif. Souhaitez-vous ajuster les couleurs ou les animations ?",
      proposalSpec: {
        meta: {
          lang: "fr",
          title: "Proposition — Site E-commerce Luxe",
          project_type: "ecommerce",
          style: {
            palette: {
              primary: "#111827", secondary: "#E5B344", surface: "#FFFFFF",
              ink: "#0F172A", muted: "#64748B", stroke: "#E2E8F0",
              accentA: "#CFB06A", accentB: "#D4AF37"
            },
            typography: { heading: "Playfair Display", body: "Inter" },
            effects_3d: {
              perspective: "2000px",
              layers: [
                {
                  type: "holographic",
                  position: "center",
                  opacity: 0.2,
                  h: 30, s: 80, l: 60,
                  css: `
                    .holographic-layer {
                      position: absolute;
                      width: 100%; height: 100%;
                      background: linear-gradient(135deg, rgba(229, 179, 68, 0.1), rgba(212, 175, 55, 0.1));
                      border-radius: 12px;
                      animation: float 6s ease-in-out infinite;
                    }
                    @keyframes float {
                      0%, 100% { transform: translateY(0) rotateX(0); }
                      50% { transform: translateY(-10px) rotateX(5deg); }
                    }
                  `,
                  js: `
                    // Animation GSAP pour un effet holographique
                    gsap.to(".holographic-layer", {
                      duration: 6,
                      y: -10,
                      rotationX: 5,
                      ease: "sine.inOut",
                      repeat: -1,
                      yoyo: true
                    });
                  `
                }
              ]
            }
          }
        },
        client_notes: {
          pain_points: ["Crédibilité", "Expérience utilisateur premium", "Conversion"],
          budget_signals: ["Budget luxe", "ROI attendu élevé"]
        },
        executive_summary: {
          paragraphs: [
            "Ce site e-commerce luxe mettra en valeur vos produits avec un design élégant, des animations fluides, et une expérience utilisateur premium pour maximiser la conversion."
          ]
        }
      },
      actions: [
        { type: "ask", question: "Souhaitez-vous ajouter des effets de particules ou un fond animé ?" },
        { type: "design_3d", effect: "luxury_holographic", code: "<div class='holographic-layer'></div>" }
      ]
    })
  },
  // Ajoute d'autres few-shots selon tes besoins
];

// ---- Handler HTTP -----------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  if (!process.env.OPENAI_API_KEY) {
    const fb = fallbackPayload("fr");
    fb.reply = "⚠️ Clé OpenAI manquante. Mode dégradé activé.";
    return res.status(200).json(fb);
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const userMessage = String(body.message || "").trim();
    const proposalSpec = body.proposalSpec || null;
    const history = Array.isArray(body.history) ? body.history : [];
    const now = new Date().toISOString().slice(0, 10);

    const specForModel = JSON.stringify(proposalSpec || { meta: { lang: "fr", title: "Proposition commerciale" } });

    const userPrompt = `
[DATE]: ${now}
[USER_MESSAGE]
${userMessage}
[CURRENT_PROPOSAL_SPEC_JSON]
${specForModel}
[INSTRUCTIONS]
- Mets à jour la proposalSpec de manière incrémentale.
- Si l'utilisateur parle de design → génère du code HTML/CSS/JS 3D et ajoute-le à meta.style.effects_3d.
- Utilise conversation_memory pour suivre le contexte.
- Pose des questions proactives pour affiner la proposition.
- Retourne STRICTEMENT du JSON. Pas de texte en dehors du JSON.
`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      ...history.slice(-10).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      { role: "user", content: userPrompt },
    ];

    const model = process.env.PF_OPENAI_MODEL || "gpt-4o";
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages,
      max_tokens: 2000,
    });

    const text = response?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(text);
    const payload = coerceToSchema(parsed);

    // Sécurité : limite la taille des tableaux
    const cap = (arr, n = 20) => Array.isArray(arr) ? arr.slice(0, n) : [];
    if (payload?.proposalSpec?.approach?.phases) payload.proposalSpec.approach.phases = cap(payload.proposalSpec.approach.phases, 12);
    if (payload?.proposalSpec?.timeline?.milestones) payload.proposalSpec.timeline.milestones = cap(payload.proposalSpec.timeline.milestones, 24);
    if (payload?.proposalSpec?.pricing?.items) payload.proposalSpec.pricing.items = cap(payload.proposalSpec.pricing.items, 40);

    return res.status(200).json(payload);
  } catch (err) {
    console.error("chat api error", err);
    const fb = fallbackPayload("fr");
    fb.reply = "Erreur temporaire. Je garde le contexte. Précisez à nouveau votre besoin (design, structure, prix…).";
    return res.status(200).json(fb);
  }
}
