// supabase/functions/chat/index.ts
// Deno Edge Function — "chat" : mode "style" => renvoie un designSpecDiff JSON
// Secrets requis : OPENAI_API_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type DesignSpec = {
  palette?: {
    primary?: string;
    secondary?: string;
    surface?: string;
    ink?: string;
    muted?: string;
    stroke?: string;
  };
  typography?: {
    title?: { family?: string; weight?: number; case?: "normal" | "upper" };
    body?: { family?: string; weight?: number; lineHeight?: number };
  };
  layout?: { radius?: { panel?: number; card?: number; bubble?: number }; density?: "compact" | "comfortable" | "spacious" };
  texture?: { kind?: "none" | "mesh" | "blob"; intensity?: number };
  brand?: { company?: string; tone?: string[] };
};

type StylePayload = {
  mode?: "style";
  userText: string;
  currentDesign?: DesignSpec;
  // facultatifs :
  proposalSpec?: unknown;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

function asJson<T>(txt: string): T | null {
  try {
    // extrait un bloc JSON même si le modèle a parlé autour
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(txt.slice(start, end + 1)) as T;
    }
  } catch {}
  return null;
}

const STYLE_SYSTEM_PROMPT = `
Tu es un "Style Interpreter" pour une proposition commerciale (type Canva).
Objectif : convertir une description libre (ex: "super pro, noir et or, très lisible")
en un diff JSON strict nommé "designSpecDiff" (PAS de prose, PAS de CSS).

Règles :
- Retourne UNIQUEMENT du JSON.
- Respecte ce schema souple :
{
  "designSpecDiff": {
    "palette": { "primary": "#111827", "secondary": "#E5B344", "surface": "#FFFFFF", "ink":"#0A1020", "muted":"#7A8195", "stroke":"#E5EAF3" },
    "typography": {
      "title": { "family": "Inter", "weight": 800, "case": "normal" },
      "body": { "family":"Inter", "weight": 500, "lineHeight": 1.5 }
    },
    "layout": { "radius": { "panel": 16, "card": 12 }, "density": "comfortable" },
    "texture": { "kind": "none | mesh | blob", "intensity": 0.06 },
    "brand": { "tone": ["premium","sobre"] }
  }
}
- Si l’utilisateur mentionne : "luxe", "premium", "noir et or" -> noir (#111827) + or (#E5B344/#CFB06A), texture faible.
- "super pro / corporate / sobre" -> contrastes élevés, couleurs froides, texture très faible, Inter.
- "magazine / éditorial / serif" -> title serif (Playfair/Source Serif), body humanist, interlignage plus grand.
- "startup / vibrant / fun" -> secondaires saturées, radius ↑, texture légère.
- Toujours privilégier la LISIBILITÉ (contrast, lineHeight >= 1.35). 
- Pas d’URL, pas d’HTML, pas de commentaires en dehors du JSON.
`;

async function callOpenAI(messages: Array<{ role: "system" | "user"; content: string }>) {
  if (!OPENAI_API_KEY) {
    return { ok: false, text: `{"designSpecDiff":{}}` };
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
    }),
  });
  const data = await r.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content ?? `{"designSpecDiff":{}}`;
  return { ok: true, text };
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { mode, userText, currentDesign } = body as StylePayload;

    // MODE STYLE => retourne un designSpecDiff
    if (mode === "style") {
      const userPrompt = `
Texte utilisateur:
"""${userText}"""

Style courant (pour contexte, à respecter si non contredit):
${JSON.stringify(currentDesign ?? {}, null, 2)}

Exigence: réponds UNIQUEMENT avec un objet JSON { "designSpecDiff": { ... } }.
`;
      const res = await callOpenAI([
        { role: "system", content: STYLE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);

      const json = asJson<{ designSpecDiff?: DesignSpec }>(res.text) ?? { designSpecDiff: {} };
      return new Response(JSON.stringify(json), { headers: { "Content-Type": "application/json" } });
    }

    // Fallback : mini echo / health
    const msg = (body?.message ?? body?.userText ?? "").toString();
    return new Response(JSON.stringify({ reply: msg ? `OK reçu: ${msg}` : "Hello undefined!" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
