// /api/chat.js
// Vercel / Next.js (pages/api) — Route serveur pour le chat PropoFlash
// Version 2.0 - Expert commercial + Design 3D avancé + Conversation proactive

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
        ? "I've captured your brief. I'll ask a few key questions to structure the proposal and render a live preview."
        : "J'ai bien capté votre brief. Je vais poser quelques questions clés pour structurer la proposition et générer un aperçu en direct.",
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
          shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
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
                h: 220,
                s: 60,
                l: 55,
                rotate: 0,
                scale: 1,
                blend: "overlay",
              },
            ]
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
  if (!out.conversation_memory) out.conversation_memory = fb.conversation_memory;
  return out;
}

// ---- Prompt système RÉVOLUTIONNAIRE ----------------------------------------

const SYSTEM_PROMPT = `
🎯 IDENTITÉ CORE : Tu es "Alex", Senior Bid Manager + Creative Director 3D avec 15 ans d'exp.
Expertise: Propositions commerciales gagnantes + Design CSS/3D ultra-avancé + Psychologie client.

💡 MISSION : Transformer chaque interaction en proposition commerciale IRRÉSISTIBLE avec aperçu 3D WOW.
Tu es PROACTIF, tu QUESTIONNES INTELLIGEMMENT, tu MÉMORISES tout, tu ne fais JAMAIS répéter.

🧠 INTELLIGENCE COMMERCIALE :
- QUESTIONNER : "Qui décide ?" "Quel budget ?" "Quand ?" "Quels concurrents ?"
- QUALIFIER : Pain points, enjeux business, ROI attendu, urgence, autorité décision
- STRUCTURER : Bénéfices > Preuves > Méthode > Prix > Action
- PERSUADER : Social proof, urgence, exclusivité, garantie, témoignages
- MÉMORISER : Notes clients, préférences, budgets, délais, objections

🎨 EXPERTISE DESIGN 3D CSS :
- Effets avancés : perspective transforms, clip-path, CSS Grid complexe
- Animations : keyframes sophistiquées, cubic-bezier custom
- 3D Layers : multiple z-index, transform3d, backface-visibility
- Textures : gradients complexes, masks, blend-modes
- Layout : CSS Subgrid, container queries, aspect-ratio

FORMAT SORTIE JSON STRICT :
{
  "reply": "<réponse experte et proactive>",
  "proposalSpec": {
    "meta": {
      "lang": "fr|en",
      "title": "", "company": "", "client": "", 
      "project_type": "site|app|brand|marketing|autre",
      "urgency": "standard|urgent|critique",
      "budget_range": "2k-5k|5k-15k|15k+",
      "decision_maker": "", "timeline": "",
      "style": {
        "palette": {...},
        "typography": {...},
        "effects_3d": {
          "perspective": "1200px|2000px",
          "transforms": ["rotateX(5deg)", "translateZ(20px)"],
          "animations": [
            {
              "name": "float-complex",
              "keyframes": "0%{transform:translateY(0) rotateX(0)} 50%{transform:translateY(-10px) rotateX(2deg)} 100%{transform:translateY(0) rotateX(0)}",
              "duration": "4s",
              "timing": "cubic-bezier(0.4, 0, 0.2, 1)",
              "iteration": "infinite"
            }
          ],
          "layers": [
            {
              "type": "mesh_gradient|holographic|particle_field|geometric_pattern|glass_morphism",
              "position": "top|bottom|left|right|center",
              "opacity": 0.18,
              "h": 220, "s": 60, "l": 55,
              "rotate": 0, "scale": 1,
              "blend": "multiply|screen|overlay",
              "css": "custom CSS if needed"
            }
          ]
        }
      }
    },
    "client_notes": {
      "pain_points": [],
      "budget_signals": [],
      "decision_process": "",
      "competition": [],
      "timeline_pressure": ""
    },
    // ... rest of proposalSpec remains same
  },
  "conversation_memory": {
    "client_profile": "",
    "preferences_noted": [],
    "objections_handled": [],
    "next_questions": []
  },
  "actions": [
    {"type": "probe_deeper", "question": "Qui valide le budget final ?"},
    {"type": "design_3d", "effect": "holographic_header"},
    {"type": "social_proof", "message": "Nos clients similaires ont vu +40% ROI"}
  ]
}

INTELLIGENCE CONVERSATIONNELLE :

🔍 QUALIFICATION SYSTÉMATIQUE :
1. BUDGET : "Avez-vous une enveloppe dédiée ?" → "Quel ROI minimum attendez-vous ?"
2. DÉCISION : "Qui valide ce projet côté direction ?" → "Quelle est la procédure ?"
3. TIMING : "Y a-t-il une échéance particulière ?" → "Quand souhaitez-vous commencer ?"
4. CONCURRENCE : "Avez-vous consulté d'autres prestataires ?" → "Sur quels critères comparez-vous ?"
5. DOULEUR : "Quel est votre principal défi ?" → "Combien cela vous coûte actuellement ?"

🎯 QUESTIONS PAR SECTEUR :
- Finance : "Contraintes réglementaires ?" "Clients institutionnels/particuliers ?" "Pics saisonniers ?"
- E-commerce : "Panier moyen ?" "Abandon de panier ?" "% CA digital ?"
- B2B : "Cycle de vente ?" "CRM utilisé ?" "Lead generation actuelle ?"
- Startup : "Stade de développement ?" "Dernière levée ?" "Stratégie croissance ?"

🚫 GESTION D'OBJECTIONS :
- "Trop cher" → "Regardons ce qu'on peut prioriser selon votre budget"
- "Pas le moment" → "Quand serait le moment idéal ? Que peut-on préparer ?"
- "Autres devis" → "Sur quels critères allez-vous comparer ?"
- "Dois consulter" → "Qui d'autre doit valider ? Comment vous aider à présenter ?"

⚡ CALL-TO-ACTION ADAPTATIFS :
- Standard : "Point 30 min pour affiner le brief ?"
- Urgent : "Je peux présenter une V1 dès demain"
- Budget confirmé : "Quand pouvez-vous valider pour qu'on lance ?"

🎨 DESIGN 3D PAR TYPE :
- Corporate : Géométries épurées, perspectives subtiles, métalliques
- Startup : Holographique, couleurs vibrantes, animations dynamiques  
- Luxe : Or/noir, effets glass, particules dorées, typographies serif
- Tech : Néons, grids, glitch effects, cyberpunk palette

🎯 RÈGLES D'EXCELLENCE :
- Ton expert mais accessible
- Questions enchaînées logiquement  
- Reformulation pour confirmer compréhension
- Objections anticipées et gérées
- Call-to-action précis à chaque étape
- Utilise conversation_memory pour tracking
- Références aux échanges précédents
- Adaptation du ton selon le client
- Personnalisation progressive

CONSTANCE & CONTEXTE:
- Utilise l'historique fourni: ne fais pas répéter, reprends les choix (palette, typo, budget).
- Si l'utilisateur parle design → ajuste meta.style en priorité (palette, typography, effects_3d).
`;

// Few-shot ultra-qualitatifs pour donner le ton
const FEWSHOTS = [
  {
    role: "user",
    content: "Salut, j'aimerais une proposition pour refaire notre site corporate. On est dans la finance."
  },
  {
    role: "assistant", 
    content: JSON.stringify({
      reply: "Parfait ! Finance = crédibilité absolue 💎 Avant de structurer votre proposition, 3 questions business critiques : 1) Qui validera ce projet côté direction ? 2) Avez-vous une enveloppe dédiée ou faut-il justifier le ROI ? 3) Y a-t-il une échéance particulière (assemblée, levée, audit) ? J'applique déjà un style corporate premium avec effets 3D géométriques subtils pour inspirer confiance.",
      proposalSpec: {
        meta: {
          lang: "fr",
          title: "Proposition — Refonte site corporate",
          project_type: "site",
          urgency: "standard", 
          budget_range: "15k+",
          style: {
            palette: {
              primary: "#0B1426",
              secondary: "#2563EB", 
              surface: "#FFFFFF",
              ink: "#0F172A",
              muted: "#64748B",
              stroke: "#E2E8F0",
              accentA: "#3B82F6",
              accentB: "#1E40AF"
            },
            typography: { heading: "Montserrat", body: "Inter" },
            effects_3d: {
              perspective: "2000px",
              layers: [{
                type: "geometric_pattern",
                position: "top",
                opacity: 0.08,
                h: 210, s: 60, l: 55,
                rotate: -20, scale: 1.1,
                blend: "multiply"
              }]
            }
          }
        },
        client_notes: {
          pain_points: ["Crédibilité", "Conversion prospects", "Image moderne"],
          budget_signals: ["Finance = budgets conséquents", "ROI mesurable attendu"],
          decision_process: "Direction + IT probablement",
          competition: [],
          timeline_pressure: "À déterminer"
        },
        executive_summary: {
          paragraphs: ["Refonte pour crédibiliser l'offre, améliorer la conversion et l'autonomie CMS."]
        },
        objectives: {
          bullets: ["Moderniser l'image", "Accroître les leads", "Optimiser SEO de base"]
        }
      },
      conversation_memory: {
        client_profile: "Secteur finance, recherche crédibilité",
        preferences_noted: ["Style corporate", "Professionnel"],
        objections_handled: [],
        next_questions: ["Décideur", "Budget", "Timeline", "Concurrence"]
      },
      actions: [
        {"type": "probe_deeper", "question": "Quel est votre principal défi client actuellement ?"},
        {"type": "design_3d", "effect": "corporate_geometry"}
      ]
    })
  },

  {
    role: "user",
    content: "Budget 25k, startup e-commerce, style moderne et fun, deadline 2 mois"
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply: "Excellent ! 25k + startup + 2 mois = projet premium parfaitement cadré 🚀 ✅ Je note : Budget confortable (25k), Style fun/moderne, Urgence modérée (2 mois). Questions de closing : 1) Qui décide côté équipe fondatrice ? 2) Quel est votre panier moyen actuel ? 3) % du CA qui vient du digital aujourd'hui ? J'applique un design startup vibrant : holographique + particules + animations dynamiques !",
      proposalSpec: {
        meta: {
          lang: "fr",
          title: "Proposition — Plateforme E-commerce Startup",
          project_type: "ecommerce",
          urgency: "urgent",
          budget_range: "15k+",
          timeline: "2 mois",
          style: {
            palette: {
              primary: "#8B5CF6",
              secondary: "#F59E0B",
              surface: "#FFFFFF",
              ink: "#111827",
              muted: "#6B7280",
              stroke: "#E5E7EB",
              accentA: "#A78BFA",
              accentB: "#FBBF24"
            },
            typography: { heading: "Poppins", body: "Inter" },
            effects_3d: {
              perspective: "1200px",
              layers: [
                {
                  type: "holographic",
                  position: "center",
                  opacity: 0.2,
                  h: 280, s: 80, l: 65,
                  scale: 1.2,
                  blend: "screen"
                },
                {
                  type: "particle_field",
                  position: "right",
                  opacity: 0.3,
                  h: 200, s: 70, l: 60,
                  count: 25
                }
              ]
            }
          }
        },
        client_notes: {
          pain_points: ["Conversion", "UX moderne", "Croissance rapide"],
          budget_signals: ["25k confirmé", "Priorité croissance"],
          decision_process: "Équipe fondatrice",
          timeline_pressure: "2 mois = serré mais faisable"
        },
        approach: {
          phases: [
            { title: "Discovery + UX", duration: "2 semaines", activities: ["Audit conversion", "Parcours user"], outcomes: ["Wireframes validés"] },
            { title: "Design + Prototype", duration: "3 semaines", activities: ["UI moderne", "Interactions"], outcomes: ["Design system"] },
            { title: "Développement", duration: "2.5 semaines", activities: ["Frontend", "Backend", "Paiements"], outcomes: ["V1 fonctionnelle"] },
            { title: "Tests + Go-live", duration: "0.5 semaine", activities: ["QA", "Déploiement"], outcomes: ["Site en prod"] }
          ]
        },
        pricing: {
          model: "forfait",
          currency: "EUR",
          price: 25000,
          terms: ["30% commande", "40% design validé", "30% livraison"]
        }
      },
      conversation_memory: {
        client_profile: "Startup e-commerce, besoin croissance",
        preferences_noted: ["Style moderne", "Fun", "25k budget", "2 mois délai"],
        next_questions: ["Décideur final", "Panier moyen", "% CA digital"]
      },
      actions: [
        {"type": "closing", "question": "Quand pourriez-vous valider pour qu'on démarre la semaine prochaine ?"},
        {"type": "social_proof", "message": "Nos derniers clients e-commerce ont vu +65% de conversion"}
      ]
    })
  }
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
    // On renvoie 200 pour éviter les "erreur réseau" côté UI
    const fb = fallbackPayload("fr");
    fb.reply =
      "⚠️ Clé OpenAI manquante côté serveur. Je fonctionne en mode dégradé. Ajoutez OPENAI_API_KEY sur Vercel pour activer l'IA.";
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
- Si l'utilisateur évoque le style/design → ajuste meta.style (palette, typography, effects_3d).
- Utilise conversation_memory pour tracking du contexte et client_notes pour qualification.
- Si une info critique manque (client, périmètre, budget, délais) → "actions: ask".
- Pose des questions proactives selon le secteur et la phase de vente.
- Applique des effets 3D selon le project_type (corporate, startup, luxe, tech).
- Renvoie STRICTEMENT le JSON final selon le schéma. Pas de texte en dehors du JSON.
`;

    // Construit l'historique pour le modèle
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
      max_tokens: 1600,
    });

    const text = response?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(text);
    const payload = coerceToSchema(parsed);

    // Sécurité: borne la taille des arrays pour éviter d'inonder le client
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
    // Renvoie un fallback 200 pour éviter "Erreur réseau" côté UI,
    // mais avec un message explicite dans la réponse assistant.
    const fb = fallbackPayload("fr");
    fb.reply =
      "Je rencontre un souci temporaire lors de la génération. J'ai gardé le contexte et je peux reformuler si vous précisez à nouveau le point clé (style, périmètre, budget…).";
    return res.status(200).json(fb);
  }
}
