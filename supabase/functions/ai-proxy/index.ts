import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { provider } = body;

    if (provider === "ollama") {
      // Proxy Ollama Cloud requests
      const { apiKey, endpoint, ollamaBody } = body;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Ollama API key is required for cloud proxy" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
        return new Response(
          JSON.stringify({ error: `Ollama returned non-JSON (status ${ollamaResp.status}): ${respText.slice(0, 200)}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(data), {
        status: ollamaResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider !== "anthropic") {
      return new Response(
        JSON.stringify({ error: "Unsupported provider: " + provider }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { model, messages, system, apiKey } = body;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-6",
        max_tokens: 2048,
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
    return new Response(
      JSON.stringify({ error: e.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
