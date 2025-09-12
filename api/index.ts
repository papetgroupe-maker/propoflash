import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { message = "", proposalSpec = null, history = [] } = body ?? {};

  if (!message) {
    return new Response(JSON.stringify({ error: "Missing message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    reply: `OK reçu: ${message}`,
    proposalSpec,
    historyLen: history.length,
  }), { headers: { "Content-Type": "application/json" }});
});
