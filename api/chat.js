// /api/chat.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Étape 1 — Le modèle extrait le "style kit" depuis les messages utilisateur.
 * Résultat: proposalSpec.meta.style est BEAUCOUP plus riche (palette, typo,
 * arrondis/ombres, et couches décoratives paramétrables).
 *
 * AUCUN changement côté front (studio/aperçu) dans cette étape.
 * Étape 2 utilisera ces tokens pour rendre un design “Canva-like” en live.
 */

const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist & Design System Architect (FR/EN).

OBJECTIF:
1) Transformer chaque échange en une proposition exploitable ("proposalSpec").
2) DÉDUIRE un "style kit" complet à partir des intentions: ambiance, mots-clés visuels, références (ex: "sobre noir & or", "néon 3D", "professionnel minimal", "corporate bleu", "tech violet", "diagonales", "mesh gradient", "dotted grid", "glassmorphism", etc.).
3) Toujours renvoyer un JSON STRICT (response_format=json_object), avec une "proposalSpec" cohérente et un "reply" lisible.

CONTRAINTES:
- Langue FR/EN selon contexte ou meta.lang.
- Jamais d'URL d'assets externes dans le style (uniquement des tokens/couleurs/paramètres).
- Si l'utilisateur ne donne pas d'indice visuel, générer un style pro par défaut (sobre, accessible).

SCHÉMA DE SORTIE STRICT:
{
  "reply": "<texte pour l'utilisateur>",
  "proposalSpec": {
    "meta": {
      "lang": "fr|en",
      "title": "",
      "company": "",
      "client": "",
      "date": "",
      "currency": "EUR",
      "style": {
        "theme_name": "",               // bref nom humain ("Corporate Bleu", "Neo Neon", etc.)
        "palette": {                    // valeurs hex complètes
          "primary": "#000000",
          "secondary": "#000000",
          "surface": "#FFFFFF",
          "ink": "#0A1020",
          "muted": "#5C667A",
          "stroke": "#E0E6F4",
          "accentA": "#000000",         // optionnels
          "accentB": "#000000"
        },
        "typography": {
          "heading": "Inter",
          "body": "Inter",
          "accent": "Inter"
        },
        "shapes": {
          "radius": "12px",
          "shadow": "0 18px 48px rgba(10,16,32,.12)"
        },
        "cover": {                      // intention de couverture (aperçu/page titre)
          "layout": "split|full|sidebar",
          "image_style": "none|gradient|mesh|geometric"
        },
        "decor_layers": [               // 0..3 couches décoratives, rendables en CSS/SVG
          {
            "id": "layer-1",
            "type": "glow|gradient_blob|grid|dots|diagonal|ribbon|wave|mesh",
            "position": "top|bottom|left|right|center",
            "opacity": 0.20,
            "blend": "normal|overlay|screen|multiply",
            "rotate": 0,                // degrés
            "scale": 1.0,               // facteur
            "h": 220, "s": 70, "l": 55  // teinte/saturation/luminosité guides (0..360 / % / %)
          }
        ]
      }
    },
    "letter": { "subject":"", "preheader":"", "greeting":"", "body_paragraphs":[""], "closing":"", "signature":"" },
    "executive_summary": { "paragraphs":[""] },
    "objectives": { "bullets":[""] },
    "approach": {
      "phases":[{ "title":"", "duration":"", "activities":[""], "outcomes":[""] }]
    },
    "deliverables": { "in":[""], "out":[""] },
    "timeline": { "milestones":[{ "title":"", "dateOrWeek":"", "notes":"" }] },
    "pricing": {
      "model":"forfait|regie",
      "currency":"EUR",
      "items":[{ "name":"", "qty":1, "unit":"jour|mois|forfait", "unit_price":0, "subtotal":0 }],
      "tax_rate":20,
      "terms":[""],
      "price": null
    },
    "assumptions": { "paragraphs":[""] },
    "next_steps": { "paragraphs":[""] }
  },
  "actions": [
    { "type":"preview" } |
    { "type":"ask", "field":"meta.client", "hint":"Quel est le client ?" }
  ]
}

RÈGLES:
- Toujours fournir palette complète (primary, secondary, surface, ink, muted, stroke).
- "decor_layers": décrire des motifs compatibles CSS/SVG (glow, blobs, wave, dots, grid, diagonal, ribbon, mesh).
- Respecter l’accessibilité (contrastes suffisants entre ink et surface).
- Si budget/planning flous: ajouter hypotheses et "à confirmer".
- Ne pas inventer des références clients; rester générique/pro.

EXTRACTION DE STYLE:
- Déduire à partir de phrases comme "j’aime un look noir & jaune, industriel, fort, avec diagonales" ou "sobriété minimaliste bleu/gris", etc.
- À défaut, style par défaut: theme_name="Corporate Bleu",
  palette primary=#3b82f6, secondary=#8b5cf6, surface=#ffffff, ink=#0a1020, muted=#5c667a, stroke=#e0e6f4.
`;

const FEWSHOTS = [
  // 1) Exemple "refonte site vitrine" (déjà business) + style sobre (défaut)
  {
    role: "user",
    content: "Brief: refonte site vitrine 8 pages, deadline 6 semaines, budget cible 8-12 k€, FR."
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply: "Je prépare une proposition structurée avec planning en 4 phases et un style sobre corporate par défaut.",
      proposalSpec: {
        meta: {
          lang: "fr",
          title: "Proposition — Refonte site vitrine",
          currency: "EUR",
          style: {
            theme_name: "Corporate Bleu",
            palette: {
              primary: "#3B82F6",
              secondary: "#8B5CF6",
              surface: "#FFFFFF",
              ink: "#0A1020",
              muted: "#5C667A",
              stroke: "#E0E6F4",
              accentA: "#60A5FA",
              accentB: "#93C5FD"
            },
            typography: { heading: "Inter", body: "Inter", accent: "Inter" },
            shapes: { radius: "12px", shadow: "0 18px 48px rgba(10,16,32,.12)" },
            cover: { layout: "split", image_style: "gradient" },
            decor_layers: [
              { id: "layer-1", type: "glow", position: "top", opacity: 0.22, blend: "screen", rotate: 0, scale: 1, h: 220, s: 70, l: 58 },
              { id: "layer-2", type: "grid", position: "center", opacity: 0.12, blend: "overlay", rotate: 0, scale: 1, h: 220, s: 10, l: 80 }
            ]
          }
        },
        executive_summary: { paragraphs: ["Objectif: moderniser l’image, améliorer conversions, autonomie CMS."] },
        approach: {
          phases: [
            { title: "Cadrage & ateliers", duration: "1 semaine", activities: ["Atelier objectifs","Arborescence"], outcomes: ["Backlog validé"] },
            { title: "Design UI", duration: "2 semaines", activities: ["Maquettes","Design system"], outcomes: ["UI validée"] },
            { title: "Développement", duration: "2 semaines", activities: ["Intégration","CMS"], outcomes: ["Site prêt à recetter"] },
            { title: "Recette & mise en ligne", duration: "1 semaine", activities: ["Tests","Corrections","Go-live"], outcomes: ["Prod en ligne"] }
          ]
        },
        pricing: {
          model: "forfait",
          currency: "EUR",
          tax_rate: 20,
          items: [
            { name: "Cadrage & ateliers", qty: 1, unit: "forfait", unit_price: 1800, subtotal: 1800 },
            { name: "Design UI (8 pages)", qty: 1, unit: "forfait", unit_price: 3200, subtotal: 3200 },
            { name: "Développement & intégration", qty: 1, unit: "forfait", unit_price: 4200, subtotal: 4200 }
          ],
          terms: ["40% commande, 40% design, 20% livraison", "Validité: 30 jours"]
        },
        next_steps: { paragraphs: ["Point 30 min pour valider périmètre & planning."] }
      },
      actions: [{ type: "preview" }]
    })
  },

  // 2) Exemple "look noir & jaune industriel, diagonales et pointillés"
  {
    role: "user",
    content: "Style souhaité: noir & jaune, industriel, avec diagonales et un discret motif de points."
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply: "Style appliqué: noir/jaune industriel, diagonales marquées et micro-motif pointillé discret.",
      proposalSpec: {
        meta: {
          lang: "fr",
          style: {
            theme_name: "Industrial Black/Yellow",
            palette: {
              primary: "#FACC15",   // jaune
              secondary: "#EAB308",
              surface: "#0B0F19",   // noir bleuté chic
              ink: "#F8FAFC",       // encre claire sur fond sombre
              muted: "#CBD5E1",
              stroke: "#1F2937",
              accentA: "#FFE266",
              accentB: "#F59E0B"
            },
            typography: { heading: "Inter", body: "Inter", accent: "Inter" },
            shapes: { radius: "10px", shadow: "0 20px 60px rgba(0,0,0,.35)" },
            cover: { layout: "full", image_style: "geometric" },
            decor_layers: [
              { id: "diag", type: "diagonal", position: "top", opacity: 0.18, blend: "overlay", rotate: 15, scale: 1, h: 50, s: 80, l: 50 },
              { id: "dots", type: "dots", position: "center", opacity: 0.12, blend: "multiply", rotate: 0, scale: 1, h: 210, s: 5, l: 70 }
            ]
          }
        },
        next_steps: { paragraphs: ["Souhaitez-vous aussi un style de cartes plus anguleux ?"] }
      },
      actions: [{ type: "preview" }]
    })
  }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { message, proposalSpec, history = [] } = req.body || {};

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      proposalSpec ? { role: "user", content: `Spec actuelle:\n${JSON.stringify(proposalSpec)}` } : null,
      { role: "user", content: message || "" },
    ].filter(Boolean);

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages
    });

    let out = {};
    try {
      out = JSON.parse(resp.choices[0].message.content || "{}");
    } catch {
      out = { reply: "Je n’ai pas pu structurer la proposition. Reformulez.", actions: [] };
    }

    // Conserver les meta existantes et fusionner le nouveau style
    if (out.proposalSpec) {
      const prevMeta = (proposalSpec && proposalSpec.meta) ? proposalSpec.meta : {};
      const nextMeta = out.proposalSpec.meta || {};
      // merge méta à plat
      out.proposalSpec.meta = { ...prevMeta, ...nextMeta };
      // merge style profondément
      const prevStyle = prevMeta.style || {};
      const nextStyle = (nextMeta && nextMeta.style) ? nextMeta.style : {};
      out.proposalSpec.meta.style = { ...prevStyle, ...nextStyle };
    }

    res.status(200).json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: "Erreur serveur", actions: [] });
  }
}
