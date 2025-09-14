// /api/chat.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ===================== PROMPT SYSTÈME AVEC MÉMOIRE ===================== */
const SYSTEM_PROMPT = `
ROLE: Senior Presales/Proposal Strategist (FR/EN), Brand & Layout Designer.
OBJECTIF: mener une vraie conversation pour co-construire une proposition commerciale
professionnelle ET générer en parallèle un "proposalSpec" (schéma ci-dessous) + maintenir une mémoire.

SORTIE: JSON STRICT UNIQUEMENT, sans texte autour.

SCHEMA:
{
  "reply": "<texte lisible pour l'utilisateur (FR/EN)>",
  "proposalSpec": { /* facultatif, delta ou spec complète (voir plus bas) */ },
  "memoryUpdate": {
    "summary": "<≤300 mots, synthèse actualisée de ce qui est important>",
    "facts_add": ["clé: valeur", "..."],         // faits à ajouter
    "facts_remove": ["clé: valeur", "..."],      // faits obsolètes à retirer
    "design_prefs": {                            // préférences design persistantes
      "palette": { "primary":"#hex", "secondary":"#hex", "surface":"#hex",
                   "ink":"#hex", "muted":"#hex", "stroke":"#hex",
                   "accentA":"#hex", "accentB":"#hex" },
      "typography": { "heading":"Inter|Poppins|...", "body":"Inter|..." },
      "shapes": { "radius":"12px|16px", "shadow":"0 18px 48px rgba(...)" },
      "decor_layers": [
        { "type":"glow|gradient_blob|grid|dots|diagonal", "position":"top|bottom|left|right|center",
          "opacity":0.18, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"normal|screen|overlay" }
      ]
    },
    "pending_questions": ["question ouverte manquante", "..."] // à poser plus tard
  },
  "actions": [
    { "type":"ask", "field":"meta.client", "hint":"Quel est le client ?" }
  ]
}

PROPOSAL SPEC (structure cible côté preview):
{
  "meta": {
    "lang":"fr|en",
    "title":"", "company":"", "client":"", "date":"", "currency":"EUR",
    "style": {
      "palette": { "primary":"#hex","secondary":"#hex","surface":"#hex","ink":"#hex","muted":"#hex","stroke":"#hex","accentA":"#hex","accentB":"#hex" },
      "shapes": { "radius":"12px|16px", "shadow":"0 18px 48px rgba(10,16,32,.12)" },
      "typography": { "heading":"Inter|Montserrat|Poppins|...", "body":"Inter|..." },
      "logoDataUrl": "",
      "decor_layers": [ { /* cf. ci-dessus */ } ]
    }
  },
  "letter": { "paragraphs":[""] },
  "executive_summary": { "paragraphs":[""] },
  "objectives": { "bullets":[""] },
  "approach": { "phases":[{ "title":"", "duration":"", "activities":[""], "outcomes":[""] }] },
  "deliverables": { "in":[""], "out":[""] },
  "timeline": { "milestones":[{ "title":"", "dateOrWeek":"", "notes":"" }] },
  "pricing": { "model":"forfait|regie", "currency":"EUR",
               "items":[{ "name":"", "qty":1, "unit":"jour|mois|forfait|lot", "unit_price":0, "subtotal":0 }],
               "tax_rate":20, "terms":[""], "price": null },
  "assumptions": { "paragraphs":[""] },
  "next_steps": { "paragraphs":[""] }
}

RÈGLES:
- Langue: déduire; FR par défaut si ambigu.
- Conduire la discussion comme un vrai consultant: ne re-demande pas une info si elle est déjà dans la mémoire.
- Si info critique manquante → ajoute dans "pending_questions" + "actions: ask".
- "proposalSpec": tu peux rendre un DELTA partiel (les champs à modifier) ou une spec entière.
- STYLE: palette accessible, contraste suffisant. Décor subtil (2–4 layers max).
- Mémoire: ne duplique pas. Dédupliquer facts_add vs existants; utilise facts_remove pour nettoyer.
- JSON strict. Pas d’URL, pas de commentaires hors JSON.
`;

/* ===================== HELPERS ===================== */
function asJson(txt) {
  try {
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(txt.slice(start, end + 1));
  } catch {}
  return null;
}

/* ===================== HANDLER ===================== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const {
      message = "",
      proposalSpec = null,
      history = [],
      memory = {
        summary: "",
        facts: [],
        design_prefs: null,
        pending_questions: [],
      },
    } = body;

    const langGuess = (proposalSpec?.meta?.lang || "fr");

    // On formate un "méga message" user qui donne au modèle la mémoire concise + derniers échanges
    const MEMORY_BLOCK = `
Mémoire actuelle (résumé):
${memory.summary || "(vide)"}

Faits mémorisés (clé: valeur):
- ${(Array.isArray(memory.facts) ? memory.facts : []).join("\n- ") || "(aucun)"}

Préférences design mémorisées (si présentes):
${JSON.stringify(memory.design_prefs || {}, null, 2)}

Questions en attente:
- ${(Array.isArray(memory.pending_questions) ? memory.pending_questions : []).join("\n- ") || "(aucune)"}  
`.trim();

    const LAST_TURNS = history
      .slice(-8)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const USER_PROMPT = `
CONTEXTE
=======
${MEMORY_BLOCK}

DERNIERS ÉCHANGES (résumé):
${LAST_TURNS || "(aucun historique exploitable)"}

SPÉCIFICATION ACTUELLE (si connue):
${JSON.stringify(proposalSpec || {}, null, 2)}

NOUVEAU MESSAGE UTILISATEUR (${langGuess}):
"""${message}"""

Consigne: réponds au format JSON strict décrit par le schéma. Mets à jour "proposalSpec" (delta ok) + "memoryUpdate".
`.trim();

    const openaiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_PROMPT },
    ];

    // Appel modèle
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      temperature: 0.4,
    });

    const text = r?.choices?.[0]?.message?.content || "";
    const json = asJson(text) || {
      reply: (langGuess === "en"
        ? "I couldn't produce structured JSON. Please rephrase."
        : "Je n’ai pas pu produire le JSON attendu. Reformulez, svp."),
      proposalSpec: null,
      memoryUpdate: null,
      actions: [],
    };

    res.status(200).json(json);
  } catch (err) {
    console.error("chat.js error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
