// supabase/functions/chat/index.ts
// Deno Edge Function — "chat" mode=style → renvoie { designSpecDiff }.
// Amélioré : lexique riche, 3D soft layers, lisibilité, JSON strict.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type DesignSpec = {
  palette?: {
    primary?: string; secondary?: string; surface?: string; ink?: string; muted?: string; stroke?: string; accentA?: string; accentB?: string;
  };
  typography?: {
    title?: { family?: string; weight?: number; case?: "normal" | "upper" };
    body?: { family?: string; weight?: number; lineHeight?: number };
  };
  layout?: { radius?: { panel?: number; card?: number; bubble?: number }; density?: "compact" | "comfortable" | "spacious" };
  texture?: { kind?: "none" | "mesh" | "blob" | "dots" | "grid"; intensity?: number };
  brand?: { company?: string; tone?: string[] };
  decor_layers?: Array<{ type: "glow" | "gradient_blob" | "grid" | "dots" | "diagonal"; position?: "top"|"bottom"|"left"|"right"|"center"; opacity?: number; h?: number; s?: number; l?: number; rotate?: number; scale?: number; blend?: "normal"|"screen"|"overlay" }>;
};

type StylePayload = {
  mode?: "style";
  userText: string;
  currentDesign?: DesignSpec;
  proposalSpec?: unknown;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

function asJson<T>(txt: string): T | null {
  try {
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(txt.slice(start, end + 1)) as T;
  } catch {}
  return null;
}

const LEXICON = `
— Lexique (FR/EN) → tokens :
luxe|premium → noir #111827, or #E5B344/#CFB06A, serif titres (Playfair), texture=none|glow faible
sobre|corporate|institutionnel → bleus/gris froids, Inter/DM Sans, texture très faible
magazine|éditorial → titres serif, interlignage +10–20%, layout comfortable
startup|vibrant|fun → secondaires saturées, radius +, blobs/dots légers
nature|éco|green → verts sapin + beiges chauds, dots/grid très faible
tech|cyber|data|SaaS|IA → bleu pétrole + violet, diagonales/dots, mesh léger
sport|énergie → rouges/oranges, diagonales
3D|glass|néomorphisme → glow doux, gradient_blob, ombres longues faibles
` as const;

const STYLE_SYSTEM_PROMPT = `
Tu es un "Style Interpreter" pour une proposition commerciale (qualité Canva).
Convertis une description libre en un diff JSON STRICT nommé "designSpecDiff" (PAS de prose, PAS de CSS).

Schéma attendu :
{
  "designSpecDiff": {
    "palette": { "primary":"#111827", "secondary":"#E5B344", "surface":"#FFFFFF", "ink":"#0A1020", "muted":"#7A8195", "stroke":"#E5EAF3", "accentA":"#60A5FA", "accentB":"#93C5FD" },
    "typography": { "title":{ "family":"Inter|Playfair|Montserrat", "weight":800, "case":"normal" }, "body":{ "family":"Inter", "weight":500, "lineHeight":1.45 } },
    "layout": { "radius": { "panel": 16, "card": 12, "bubble": 14 }, "density": "comfortable" },
    "texture": { "kind": "none|mesh|blob|dots|grid", "intensity": 0.04 },
    "brand": { "tone": ["premium","sobre"] },
    "decor_layers":[
      { "type":"glow|gradient_blob|grid|dots|diagonal", "position":"top|bottom|left|right|center", "opacity":0.12, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"normal|screen|overlay" }
    ]
  }
}

Règles :
- Utilise le LEXIQUE ci-dessous pour mapper les mots de style → tokens.
- Toujours favoriser la LISIBILITÉ (contraste texte/surface élevé).
- 1 à 3 "decor_layers" max, subtils.
- Si l’utilisateur mentionne "luxe/premium/noir et or" → noir + or, texture faible, éventuellement glow discret.
- "sobre/corporate/pro" → bleus/gris froids, Inter, contrastes élevés.
- "magazine/éditorial" → serif titres (Playfair/Source Serif), lineHeight 1.5–1.6.
- "startup/fun" → couleurs vives, radius ↑, blobs/dots légers.
- "tech/cyber/data/IA" → bleu pétrole + violet, diagonales ou dots, mesh faible.
- Réponds STRICTEMENT par l’objet JSON.

${LEXICON}
`;

async function callOpenAI(messages: Array<{ role: "system" | "user"; content: string }>) {
  if (!OPENAI_API_KEY) return { ok: false, text: `{"designSpecDiff":{}}` };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, messages })
  });
  const data = await r.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content ?? `{"designSpecDiff":{}}`;
  return { ok: true, text };
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { mode, userText, currentDesign } = body as StylePayload;

    if (mode === "style") {
      const userPrompt = `
Texte utilisateur:
"""${userText}"""

Style courant (conserver si non contredit):
${JSON.stringify(currentDesign ?? {}, null, 2)}

Exigence: réponds UNIQUEMENT avec un objet JSON { "designSpecDiff": { ... } }.
`;
      const res = await callOpenAI([
        { role: "system", content: STYLE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]);

      const json = asJson<{ designSpecDiff?: DesignSpec }>(res.text) ?? { designSpecDiff: {} };
      return new Response(JSON.stringify(json), { headers: { "Content-Type": "application/json" } });
    }

    // Fallback / ping
    const msg = (body?.message ?? body?.userText ?? "").toString();
    return new Response(JSON.stringify({ reply: msg ? `OK reçu: ${msg}` : "Hello undefined!" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
