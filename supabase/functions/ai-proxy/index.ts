import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Status probe: tells the client which provider keys are configured
    // server-side WITHOUT revealing the keys themselves.
    if (body?.action === "probe") {
      return json({
        ollamaCloud: !!Deno.env.get("OLLAMA_CLOUD_API_KEY"),
        anthropic:   !!Deno.env.get("ANTHROPIC_API_KEY"),
      });
    }

    const { provider } = body;

    if (provider === "ollama") {
      // Proxy Ollama Cloud requests. API key is read from Edge Function
      // secrets — the client never sends it.
      const apiKey = Deno.env.get("OLLAMA_CLOUD_API_KEY");
      if (!apiKey) {
        return json({
          error: "Server is missing OLLAMA_CLOUD_API_KEY. Set it in Supabase → Edge Functions → Manage secrets."
        }, 503);
      }
      const { endpoint, ollamaBody } = body;
      const ollamaEndpoint = endpoint || "https://ollama.com";
      const ollamaResp = await fetch(`${ollamaEndpoint}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(ollamaBody),
      });
      const respText = await ollamaResp.text();
      let data;
      try {
        data = JSON.parse(respText);
      } catch {
        return json({
          error: `Ollama returned non-JSON (status ${ollamaResp.status}): ${respText.slice(0, 200)}`
        }, 502);
      }
      return new Response(JSON.stringify(data), {
        status: ollamaResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider !== "anthropic") {
      return json({ error: "Unsupported provider: " + provider }, 400);
    }

    // Anthropic: API key read from Edge Function secrets — the client
    // never sends it.
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({
        error: "Server is missing ANTHROPIC_API_KEY. Set it in Supabase → Edge Functions → Manage secrets."
      }, 503);
    }

    const { model, messages, system } = body;

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-6",
        // Each new-play block is ~4 plays × ~1K tokens of formation + routes
        // description (detailed per the animation-grammar prompt). 2048 was
        // clipping mid-JSON; 8192 leaves comfortable headroom without
        // burning an unbounded budget.
        max_tokens: 8192,
        system: system || undefined,
        messages: messages,
      }),
    });

    const data = await anthropicResp.json();

    return new Response(JSON.stringify(data), {
      status: anthropicResp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: e.message || "Internal server error" }, 500);
  }
});
