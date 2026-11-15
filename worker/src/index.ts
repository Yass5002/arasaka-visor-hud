export interface Env {
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_DEPLOYMENT: string;
  AZURE_OPENAI_API_VERSION: string;
  AZURE_OPENAI_KEY: string;
  AZURE_SPEECH_REGION: string;
  AZURE_SPEECH_KEY: string;
  ALLOWED_ORIGINS: string;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          deployment: env.AZURE_OPENAI_DEPLOYMENT,
          speechRegion: env.AZURE_SPEECH_REGION,
          hasLlmKey: Boolean(env.AZURE_OPENAI_KEY),
          hasSpeechKey: Boolean(env.AZURE_SPEECH_KEY),
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      if (!env.AZURE_OPENAI_KEY) {
        return new Response(JSON.stringify({ error: "AZURE_OPENAI_KEY not configured" }), {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const body = await request.json<Record<string, unknown>>();
      const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "");
      const targetUrl = `${endpoint}/openai/deployments/${encodeURIComponent(
        env.AZURE_OPENAI_DEPLOYMENT
      )}/chat/completions?api-version=${encodeURIComponent(env.AZURE_OPENAI_API_VERSION)}`;

      const upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": env.AZURE_OPENAI_KEY,
        },
        body: JSON.stringify(body),
      });

      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/speech-token" && request.method === "GET") {
      if (!env.AZURE_SPEECH_KEY) {
        return new Response(JSON.stringify({ error: "AZURE_SPEECH_KEY not configured" }), {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const stsUrl = `https://${env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      const res = await fetch(stsUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
          "Content-Length": "0",
        },
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to issue speech token" }), {
          status: res.status,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const token = await res.text();
      return new Response(
        JSON.stringify({ token, region: env.AZURE_SPEECH_REGION }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/api/tts" && request.method === "POST") {
      if (!env.AZURE_SPEECH_KEY) {
        return new Response(JSON.stringify({ error: "AZURE_SPEECH_KEY not configured" }), {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const {
        text,
        voice = "en-US-EmmaMultilingualNeural",
        urgency = "nominal",
      } = await request.json<{
        text: string;
        voice?: string;
        urgency?: "nominal" | "advisory" | "caution" | "emergency";
      }>();

      if (!text || !text.trim()) {
        return new Response(JSON.stringify({ error: "Missing text" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const langMatch = voice.match(/^([a-z]{2}-[A-Z]{2})/);
      const lang = langMatch ? langMatch[1] : "en-US";
      const prosodyRate =
        urgency === "emergency"
          ? "+14%"
          : urgency === "caution"
            ? "+7%"
            : urgency === "advisory"
              ? "+3%"
              : "0%";
      const prosodyPitch =
        urgency === "emergency" ? "+2%" : urgency === "caution" ? "+1%" : "0%";
      const ssml = `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${escapeXml(
        voice
      )}'><prosody rate='${prosodyRate}' pitch='${prosodyPitch}'>${escapeXml(text)}</prosody></voice></speak>`;

      const ttsUrl = `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
      const res = await fetch(ttsUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "arasaka-health-assistant",
        },
        body: ssml,
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(err, {
          status: res.status,
          headers: { ...cors, "Content-Type": "text/plain" },
        });
      }

      return new Response(res.body, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
