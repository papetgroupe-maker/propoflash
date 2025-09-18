export const config = { runtime: "edge" };

/**
 * PropoFlash Chat → SSE NDJSON events
 * Events:
 *  - {"type":"say","html":"..."}            → message assistant (HTML simple: p, ul/li, b, i, br)
 *  - {"type":"spec.merge","spec":{...}}     → patch profond dans la proposition
 *  - {"type":"style.merge","style":{...}}   → patch profond dans meta.style (tokens)
 *  - {"type":"done"}                        → fin de tour
 */
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('Missing OPENAI_API_KEY', { status: 500 });

  let body;
  try { body = await req.json(); } catch { body = {}; }
  const { message = '', history = [], proposalSpec = {} } = body || {};

  const system = `
You are **PropoFlash Studio Orchestrator**, an expert assistant that co-creates long, structured business proposals AND a live visual design.
You control a right-hand HTML/CSS preview in real time by emitting NDJSON events.

OUTPUT FORMAT — CRITICAL:
- Output ONLY newline-delimited JSON (NDJSON). One JSON object per line. No prose outside JSON. No markdown.
- Allowed event types:
  1) {"type":"say","html":"<p>...</p>"}  → short assistant messages, HTML inline only (p, ul/li, b, i, br)
  2) {"type":"spec.merge","spec":{...}}  → deep merge patch to the proposal structure
  3) {"type":"style.merge","style":{...}}→ deep merge patch to tokens (palette, typography, shapes, decor_layers)
  4) {"type":"done"}                     → end of turn

GENERAL RULES:
- Language: answer in the user's language (French likely).
- Always start with ONE short "say" acknowledging intent + next questions.
- Then, for each bit of usable info, emit small **incremental** patches:
   * spec.merge for content (letter, executive_summary, objectives, approach, deliverables, timeline, pricing, assumptions, next_steps).
   * style.merge for look & feel (palette.primary/secondary/surface/ink/muted/stroke/accentA/accentB, typography.heading/body, shapes.radius/shadow, decor_layers[]).
- Prefer multiple small events over a single huge block.
- Be proactive: if key fields are missing (client, company, objectives, pricing model), ask concise questions via "say".
- Finish with {"type":"done"}.

SPEC KEYS REFERENCE:
meta {lang, title, currency, company, client, date, style}
letter {greeting, body_paragraphs[], closing, signature}
executive_summary {paragraphs[]}
objectives {bullets[]}
approach {phases:[{title, duration, description, activities[], outcomes[]}]}
deliverables {in:[], out:[]}
timeline {milestones:[{title, dateOrWeek, notes}]}
pricing {model, currency, items:[{name, qty, unit, unit_price, subtotal}], price, tax_rate, terms:[]}
assumptions {paragraphs[]}
next_steps {paragraphs[]}

STYLE TOKENS REFERENCE:
style {
  palette:{primary, secondary, surface, ink, muted, stroke, accentA, accentB},
  typography:{heading, body},
  shapes:{radius, shadow},
  decor_layers:[{ type: "glow"|"gradient_blob"|"grid"|"dots", position: "top"|"bottom"|"left"|"right"|"center",
                   h:0-360, s:0-100, l:0-100, opacity:0-1, rotate:number, scale:number, blend:"normal"|"overlay"}]
}
  `.trim();

  const userEnvelope = {
    locale: 'fr',
    userMessage: message,
    currentSpec: proposalSpec || {},
    guidance: {
      goal: "Créer/éditer une proposition commerciale ET piloter le design live.",
      preferSmallEvents: true
    }
  };

  // On appelle OpenAI (non-streaming), puis on re-stream en SSE NDJSON vers le client.
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      messages: [
        { role: 'system', content: system },
        ...history.slice(-12).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: JSON.stringify(userEnvelope) }
      ]
    })
  });

  if (!upstream.ok) {
    const err = await upstream.text().catch(() => '');
    return new Response(`Upstream error: ${upstream.status}\n${err}`, { status: 502 });
  }
  const json = await upstream.json();
  const text = json?.choices?.[0]?.message?.content || '';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (line) => controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      const finish = () => { send('{"type":"done"}'); controller.close(); };

      const lines = (text || '').split(/\r?\n/).filter(l => l.trim().length);
      if (!lines.length) {
        send('{"type":"say","html":"<p>Je n’ai pas reçu d’éléments exploitables. Donnez-moi le client, le style (ex: sobre corporate bleu) et les sections à inclure.</p>"}');
        return finish();
      }
      for (const raw of lines) {
        const l = raw.trim();
        try { JSON.parse(l); send(l); }
        catch {
          const safe = l.replace(/"/g, '\\"');
          send(`{"type":"say","html":"<p>${safe}</p>"}`);
        }
      }
      finish();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
