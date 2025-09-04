// /api/chat.js — Vercel Serverless Function (Node runtime / ESM)

export default async function handler(req, res) {
  /* CORS + no-store */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const apiKey = process.env.OPENAI_API_KEY; // ← définis sur Vercel
    if (!apiKey) {
      return res.status(500).json({
        reply: '',
        proposalSpec: {},
        actions: [],
        error: 'Missing OPENAI_API_KEY on Vercel',
      });
    }

    const { message = '', proposalSpec = {}, history = [] } = req.body || {};
    const lang = proposalSpec?.meta?.lang ? String(proposalSpec.meta.lang) : 'fr';

    /* ───── (Optionnel) Gating avec Supabase (plans/limites) ───── */
    const supaUrl = process.env.SUPABASE_URL;
    const supaSrv = process.env.SUPABASE_SERVICE_ROLE;
    const authHeader = req.headers.authorization || '';
    const supaJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (supaUrl && supaSrv && supaJwt) {
      try {
        const { createClient } = await import('@supabase/supabase-js');

        const sbAdmin = createClient(supaUrl, supaSrv, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: u, error: uErr } = await sbAdmin.auth.getUser(supaJwt);
        if (!uErr && u?.user) {
          const uid = u.user.id;

          // plan depuis profiles (default: free)
          let plan = 'free';
          const { data: prof, error: pErr } = await sbAdmin
            .from('profiles')
            .select('plan')
            .eq('id', uid)
            .maybeSingle();
          if (!pErr && prof?.plan) plan = String(prof.plan);

          const LIMITS = { free: 3, starter: 50, pro: Number.POSITIVE_INFINITY };
          const limit = LIMITS[plan] ?? 3;

          if (Number.isFinite(limit)) {
            const now = new Date();
            const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
            const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

            const { count, error: cErr } = await sbAdmin
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', uid)
              .eq('role', 'assistant')
              .gte('created_at', start.toISOString())
              .lt('created_at',  end.toISOString());

            if (!cErr && typeof count === 'number' && count >= limit) {
              return res.status(402).json({
                reply: lang === 'fr'
                  ? "Limite atteinte pour votre plan. Passez à Starter pour davantage d’aperçus et l’export PDF."
                  : "Limit reached for your plan. Upgrade to Starter for more previews and PDF export.",
                proposalSpec: {},
                actions: [{ type: 'upgrade' }],
              });
            }
          }
        }
      } catch (gErr) {
        console.warn('Supabase gating warning:', gErr?.message || gErr);
      }
    }
    /* ───────────────────────────────────────────────────────────── */

    const SYSTEM_PROMPT = `
Tu es **Rédacteur senior de propositions commerciales B2B** (stratégie + copywriting) ET un **DA** (direction artistique) pour l'alignement marque.
Objectif: générer et itérer des offres **professionnelles, actionnables, prêtes à envoyer** (proposition + email).

Tu dois TOUJOURS répondre en **JSON strict** (sans Markdown, sans texte hors JSON):
{"reply","proposalSpec","actions"}

Définitions:
- "reply": court message de chat (<= 120 mots) en "${lang}" qui:
  • confirme ce que tu as compris ou modifié,
  • pose AU PLUS UNE question essentielle s'il manque quelque chose de bloquant,
  • propose une prochaine étape claire (ex: "Je rafraîchis l’aperçu.").
- "proposalSpec": **patch minimal** (diff) à appliquer sur l’état courant.
  • Ne renvoie QUE les champs modifiés/ajoutés/supprimés. N’envoie JAMAIS tout l’objet si inutile.
  • Respecte le schéma ci-dessous. Conserve autant que possible les IDs existants.
- "actions": 0–3 éléments parmi:
  • {"type":"ask","field":"<label>","hint":"<exemple>"}  ← une seule question bloquante max
  • {"type":"preview"}                                   ← suggère d’ouvrir/rafraîchir l’aperçu
  • {"type":"update_style","patch":{...}}                ← propose un changement de style (palette, ton, typo…)
  • {"type":"focus","target":"<path>"}                   ← indique la section à mettre en avant dans l’UI (ex: "pricing")

Schéma cible (extraits utiles pour PATCH):
{
  "meta": { "lang":"fr|en" },
  "style": {
    "tone":"executive|premium|energetic|institutional|technical",
    "politeness":"vous|tu",
    "font":"Inter",
    "primary":"#3b82f6",
    "secondary":"#8b5cf6",
    "logoDataUrl": "<dataURL|url|null>"
  },
  "brand": {
    "company": "...",
    "palette": {"primary":"#...","secondary":"#...","ink":"#0A1020","muted":"#5C667A"},
    "fonts": {"heading":"Inter","body":"Inter"},
    "tone": "sobre|percutant|formel|convaincant"
  },
  "email": {
    "subject": "...",
    "body": "Corps d’email prêt à envoyer (salutation, contexte, valeur, call-to-action, pièces jointes)."
  },
  "sections": [
    {"id":"letter","title":"Lettre d’accompagnement","subject":"...","preheader":"...","greeting":"...","body_paragraphs":["..."],"closing":"...","signature":"..."},
    {"id":"executive_summary","title":"Résumé exécutif","paragraphs":["..."]},
    {"id":"problem","title":"Problème / Contexte","content":"..."},
    {"id":"objectives","title":"Objectifs","bullets":["..."]},
    {"id":"solution","title":"Solution / Approche","content":"..."},
    {"id":"approach","title":"Approche par phases","phases":[{"id":"phase_1","title":"...","description":"...","activities":["..."],"outcomes":["..."],"duration":"..."}]},
    {"id":"deliverables","title":"Livrables","in":["..."],"out":["..."]},
    {"id":"timeline","title":"Planning & Jalons","milestones":[{"id":"m1","title":"...","dateOrWeek":"YYYY-Www"}]},
    {"id":"pricing","title":"Budget","currency":"EUR","model":"forfait|régie|abonnement","total":4900,"items":[{"id":"p1","name":"...","qty":1,"unit":"jour","unit_price":950,"subtotal":950}],"terms":["validité 30j","50% à la commande","solde à livraison"]},
    {"id":"team","title":"Équipe & Rôles","members":[{"name":"...","role":"...","bio":"..."}]},
    {"id":"case_studies","title":"Références","items":[{"name":"...","impact":["+29% MRR","+19% churn réduit"]}]},
    {"id":"assumptions","title":"Hypothèses","paragraphs":["..."]},
    {"id":"risks","title":"Risques & parades","items":[{"risk":"...","mitigation":"..."}]},
    {"id":"next_steps","title":"Prochaines étapes","paragraphs":["Validation périmètre","Signature devis","Kick-off semaine 42"]}
  ],
  "layout": {
    "theme":"modern|minimal|corporate",
    "accent_style":"navy_red|gray_white|black_yellow|blue_white",
    "page":"A4",
    "columns":"mono|two",
    "density":"airy|compact"
  }
}

Règles d’itération:
- Si l’utilisateur dit: "raccourcis l’email", "monte le total à 4 900€", "supprime la phase 3", "ajoute un livrable SEO" :
  → renvoie un **patch minimal** ciblé (sections concernées seulement), conserve IDs, mets à jour total/termes si nécessaire.
- Si ambigu : pose **UNE** question concrète via "actions".

Rédaction:
- Ton clair, orienté décision. Mesure les bénéfices (KPI si possible).
- Toujours générer/tenir à jour: "email" (subject + body) et les sections majeures.
- Si des infos manquent, écrire "à confirmer" sans bloquer. Proposer une fourchette budgétaire avec hypothèses si pertinent.

Design:
- Si style/brand fournis: respecter palette/typo/ton.
- Sinon, proposer un style par défaut sobre (primary navy #0B2446, accent #3b82f6, font Inter) **dans le patch**, pas dans "reply".

Validation avant sortie:
- S’assurer que le JSON est valide, compact, sans commentaires ni Markdown.
- Aucune fuite de réflexion interne; uniquement les clés demandées.
`.trim();

    // Historique nettoyé
    const safeHistory = Array.isArray(history)
      ? history
          .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .slice(-12)
          .map(m => ({ role: m.role, content: m.content }))
      : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...safeHistory,
      { role: 'user', content: JSON.stringify({ message, proposalSpec }) },
    ];

    // Appel OpenAI
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 2200,
        messages,
      }),
    });

    const rawText = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({
        reply: lang === 'fr'
          ? 'Désolé, une erreur est survenue côté modèle. Réessayez.'
          : 'Sorry, a model error occurred. Please try again.',
        proposalSpec: {},
        actions: [],
        error: rawText?.slice(0, 800),
      });
    }

    // Parse réponse OpenAI (JSON externe puis JSON content)
    let data;
    try { data = JSON.parse(rawText); } catch { data = null; }

    let content = data?.choices?.[0]?.message?.content ?? '';
    if (!content || typeof content !== 'string') content = String(rawText || '');

    let out;
    try {
      out = JSON.parse(content);
    } catch {
      try {
        // Supprime les virgules traînantes potentielles
        out = JSON.parse(content.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        out = { reply: content || '', proposalSpec: {}, actions: [] };
      }
    }

    // Formes par défaut
    if (typeof out !== 'object' || out === null) out = { reply: String(out || '') };
    if (typeof out.reply !== 'string') out.reply = '';
    if (!out.proposalSpec || typeof out.proposalSpec !== 'object') out.proposalSpec = {};
    if (!Array.isArray(out.actions)) out.actions = [];

    return res.status(200).json(out);
  } catch (e) {
    console.error('API /api/chat error:', e);
    return res.status(500).json({
      reply: 'Erreur serveur',
      proposalSpec: {},
      actions: [],
      error: e?.message?.slice(0, 500) || 'unknown',
    });
  }
}
