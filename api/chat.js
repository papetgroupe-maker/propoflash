// supabase/functions/proposal/index.ts
// Edge Function "proposal" — génère { reply, proposalSpec, actions }
// Secrets requis: OPENAI_API_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const SYSTEM_PROMPT = `
ROLE: Senior B2B Proposal Strategist, Brand Designer & Layout Artist (FR/EN).
OBJECTIF: transformer chaque échange en une proposition exploitable ET stylée.
Produire un "proposalSpec" cohérent + un "reply" clair. DÉDUIRE un STYLE complet
à partir des indices utilisateur (couleurs, ambiance, industrie, sobriété vs fun),
et proposer des couches décoratives subtiles.

SCHEMA DE SORTIE (JSON STRICT):
{
  "reply": "<texte lisible pour l'utilisateur>",
  "proposalSpec": {
    "meta": {
      "lang":"fr|en",
      "title": "", "company":"", "client":"", "date":"", "currency":"EUR",
      "style": {
        "palette": { "primary":"#hex", "secondary":"#hex", "surface":"#hex", "ink":"#hex", "muted":"#hex", "stroke":"#hex", "accentA":"#hex", "accentB":"#hex" },
        "shapes": { "radius":"12px|16px", "shadow":"0 18px 48px rgba(...)" },
        "typography": { "heading":"Inter|Montserrat|Poppins|...","body":"Inter|..." },
        "logoDataUrl": "",
        "decor_layers": [
          { "type":"glow|gradient_blob|grid|dots|diagonal", "position":"top|bottom|left|right|center", "opacity":0.18, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"normal|screen|overlay" }
        ]
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

RÈGLES:
- FR par défaut si ambigu.
- Ne pas inventer d’entités critiques → "actions: ask".
- STYLE pro + accessible; décor subtil (2–4 layers).
- JSON strict uniquement.
`;

const FEWSHOTS = [
  {
    role: "user",
    content:
      "Brief: Identité 'indus' noir & jaune, style énergique, diagonales, tech B2B FR. Offre: refonte site vitrine 6 pages. Deadline 5 semaines. Budget 8–10k.",
  },
  {
    role: "assistant",
    content: JSON.stringify({
      reply:
        "Je prépare une proposition structurée (cadrage, design, dev) avec un style noir/jaune industriel et des diagonales subtiles.",
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
        },
        next_steps: {
          paragraphs: ["Point 30 min pour verrouiller le périmètre et le planning."],
        },
      },
    }),
  },
];

function pickJson(txt: string) {
  try {
    const s = txt.indexOf("{");
    const e = txt.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(txt.slice(s, e + 1));
  } catch {}
  return null;
}

async function callOpenAI(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  if (!OPENAI_API_KEY) {
    return { ok: false, text: '{"reply":"Clé OpenAI manquante côté serveur.","proposalSpec":null,"actions":[]}' };
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.3, messages }),
  });
  const data = await r.json().catch(() => ({}));
  const text = data?.choices?.[0]?.message?.content ?? "";
  return { ok: true, text };
}

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    if (req.method === "GET") {
      return new Response(JSON.stringify({ ok: true, health: "proposal edge up" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { message, proposalSpec, history } = (await req.json().catch(() => ({}))) as {
      message?: string;
      proposalSpec?: unknown;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...FEWSHOTS,
      ...(Array.isArray(history) ? history : []).map((m) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user" as const, content: String(message || "") },
    ];

    const ai = await callOpenAI(messages);
    const parsed =
      pickJson(ai.text) ||
      { reply: ai.text || "(vide)", proposalSpec: null, actions: [] };

    // Merge léger si le client envoie déjà une spec
    if (proposalSpec && parsed.proposalSpec) {
      parsed.proposalSpec = {
        ...(proposalSpec as any),
        ...(parsed.proposalSpec as any),
        meta: { ...((proposalSpec as any)?.meta || {}), ...((parsed.proposalSpec as any)?.meta || {}) },
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error("proposal edge error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
