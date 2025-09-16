// /api/chat.js  (Vercel – Node runtime)
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const {
      message,
      proposalSpec = {},
      history = [],
      memory = {}
    } = (req.body || {});

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // 🔧 SYSTEM PROMPT — Expert proposition + Designer HTML/CSS 3D
    const system = `
Tu es **PropoFlash**, une IA experte en **propositions commerciales** ET **design front (HTML/CSS/3D)**.

Objectifs :
- Conduire une **discussion proactive** (questions, validations, suggestions).
- Ne pas faire répéter : mémorise tout (client, marque, ton, couleurs, public, contraintes).
- Construire / améliorer la **structure de la proposition** (letter, executive_summary, objectives, approach/phases, deliverables in/out, timeline, pricing, assumptions, next_steps).
- Savoir **designer** : palette, typo, rayons, ombres, décor 3D doux (blobs/mesh/glows/grids), et indiquer les diffs de style.

Contraintes de sortie :
- Tu dois renvoyer **uniquement** un JSON valide, **sans texte** hors JSON.
- Schéma EXACT (champs optionnels acceptés) :

{
  "reply": "string, message chat pour l'utilisateur",
  "titleSuggestion": "string | null",
  "followUps": ["string", ...] | null,
  "proposalSpecPatch": { ... },       // patch ou objet partiel à fusionner
  "designSpecDiff": {                  // tokens de style à appliquer
    "palette": { "primary": "#...", "secondary": "#...", "surface": "#...", "ink": "#...", "muted": "#...", "stroke": "#..." },
    "typography": { "heading": "Inter", "body": "Inter" },
    "shapes": { "radius": "12px", "shadow": "0 18px 48px rgba(10,16,32,.12)" },
    "decor_layers": [
      { "type": "glow|gradient_blob|grid|dots|diagonal", "position": "top|bottom|left|right|center", "opacity": 0.18, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"overlay" }
    ]
  },
  "previewOps": [                     // micro-opérations ciblées
    { "op": "set",    "path": "letter.greeting", "value": "Bonjour ..." },
    { "op": "append", "path": "timeline.milestones", "value": { "title": "Kickoff", "date": "S1" } },
    { "op": "merge",  "path": "pricing", "value": { "model": "forfait", "currency": "EUR" } }
  ],
  "memoryPatch": { ... }              // ex: { brand:"Crédit Agricole", tone:"sobre", mainColor:"#0E4AA8" }
}

Bonnes pratiques :
- Toujours **proposer 1-3 questions de suivi** pertinentes (followUps) si le brief est incomplet.
- Si l’utilisateur parle de **style** (ex: sobre, corporate, bleu, banque, 3D léger), refléter cela dans **designSpecDiff**.
- Si le client/secteur est connu (banque, santé, luxe, SaaS), adapter terminologie et phasage métier.
- Préparer **pricing** simple par défaut (forfait ou T&M) si non précisé.
    `.trim();

    const user = `
Mémoire: ${JSON.stringify(memory || {})}
Spec actuelle (résumé): ${JSON.stringify(proposalSpec || {})}
Historique (derniers): ${JSON.stringify(history.slice(-10) || [])}
Message utilisateur: ${message}
    `.trim();

    const body = {
      model: 'gpt-4o-mini',
      temperature: 0.6,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      // On essaye d'obtenir du JSON strict (si le modèle le supporte)
      response_format: { type: 'json_object' }
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return res.status(502).json({ error: 'OpenAI error', details: t });
    }

    const js = await r.json();
    const raw = js?.choices?.[0]?.message?.content?.trim() || '{}';

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      // fallback: on encapsule la réponse brute
      payload = { reply: raw };
    }

    const out = {
      reply: payload.reply || "D'accord, je continue.",
      titleSuggestion: payload.titleSuggestion || null,
      followUps: Array.isArray(payload.followUps) ? payload.followUps : null,
      proposalSpecPatch: payload.proposalSpecPatch || payload.proposalSpec || null, // compat
      designSpecDiff: payload.designSpecDiff || null,
      previewOps: Array.isArray(payload.previewOps) ? payload.previewOps : null,
      memoryPatch: payload.memoryPatch || null
    };

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: 'Server failure', details: String(e?.message || e) });
  }
}
