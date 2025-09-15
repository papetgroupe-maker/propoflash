// /api/style.js — Vercel Serverless Function (sans dépendances externes)
// Lit la clé dans process.env.OPENAI_API_KEY (ne rien mettre en dur)

const STYLE_SYSTEM_PROMPT = `
Tu es un "Style Interpreter" pour une proposition commerciale (type Canva).
Objectif : convertir une description libre (ex: "super pro, noir et or, très lisible")
en un diff JSON strict nommé "designSpecDiff" (PAS de prose, PAS de CSS).

Règles :
- Retourne UNIQUEMENT du JSON, schema :
{
  "designSpecDiff": {
    "palette": { "primary": "#111827", "secondary": "#E5B344", "surface": "#FFFFFF", "ink":"#0A1020", "muted":"#7A8195", "stroke":"#E5EAF3", "accentA":"#93C5FD", "accentB":"#8B5CF6" },
    "typography": {
      "heading": "Inter",
      "body": "Inter"
    },
    "shapes": { "radius": "12px", "shadow": "0 18px 48px rgba(10,16,32,.12)" },
    "decor_layers": [
      { "type":"glow|gradient_blob|grid|dots|diagonal", "position":"top|bottom|left|right|center", "opacity":0.18, "h":220, "s":60, "l":55, "rotate":0, "scale":1, "blend":"normal|screen|overlay" }
    ],
    "brand": { "tone": ["premium","sobre"] }
  }
}
- "luxe/premium/noir et or" -> noir (#111827) + or (#E5B344/#CFB06A), texture faible.
- "corporate/sobre/pro" -> contrastes élevés, couleurs froides, texture très faible, Inter.
- "magazine/éditorial/serif" -> heading serif (Playfair/Source Serif), body humanist.
- "startup/vibrant/fun" -> secondaires saturées, radius ↑, texture légère.
- Toujours privilégier la LISIBILITÉ (contrast, lineHeight >= 1.35).
`;

function error(res, code, message, details) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: message, details }));
}
function safeJson(str, fb = {}) {
  if (typeof str !== "string") return fb;
  try { return JSON.parse(str); } catch {}
  const i = str.indexOf("{"), j = str.lastIndexOf("}");
  if (i >= 0 && j > i) { try { return JSON.parse(str.slice(i, j + 1)); } catch {} }
  return fb;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return error(res, 405, "Method Not Allowed", { allow: "POST" });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return error(res, 500, "OPENAI_API_KEY is not set");

    // parse body
    let body = {};
    try {
      if (typeof req.body === "string") body = JSON.parse(req.body);
      else if (req.body) body = req.body;
      else {
        const chunks = [];
        for await (const ch of req) chunks.push(ch);
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      }
    } catch { return error(res, 400, "Invalid JSON body"); }

    const { userText = "", currentDesign = {} } = body || {};
    const userPrompt = [
      `Texte utilisateur:\n"""${userText}"""`,
      `\nDesign courant (contexte):\n${JSON.stringify(currentDesign || {}, null, 2)}`,
      `\nExigence: réponds STRICTEMENT { "designSpecDiff": { ... } }.`
    ].join("\n");

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STYLE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => null);
    if (!r.ok) return error(res, r.status, data?.error?.message || "OpenAI error", data);

    const text = data?.choices?.[0]?.message?.content ?? "{}";
    const json = safeJson(text, { designSpecDiff: {} });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 200;
    res.end(JSON.stringify(json));
  } catch (e) {
    return error(res, 500, "Server error", String(e?.message || e));
  }
};
