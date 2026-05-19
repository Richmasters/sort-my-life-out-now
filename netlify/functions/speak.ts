const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const ELEVENLABS_TTS_MODEL = "eleven_flash_v2_5";

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\s+/g, " ")
    .replace(/[{}[\]"`]/g, "")
    .trim()
    .slice(0, 1200);
}

export async function handler(event: any) {
  try {
    if (event.httpMethod === "GET") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, function: "speak" }),
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "method not allowed" }),
      };
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "missing ELEVENLABS_API_KEY" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const text = cleanText(body.text);
    const voiceId =
      typeof body.voiceId === "string" && body.voiceId.trim()
        ? body.voiceId.trim()
        : process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

    if (!text) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "text is required" }),
      };
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_TTS_MODEL,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.15,
            use_speaker_boost: true,
            speed: 0.96,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs speech error ${response.status}: ${errorText}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
      body: audio.toString("base64"),
    };
  } catch (error) {
    console.error("SPEAK FUNCTION ERROR:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "speech failed" }),
    };
  }
}
