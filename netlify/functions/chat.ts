const API_URL = "https://openrouter.ai/api/v1/chat/completions";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: any, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenRouter(messages: any[], attempt = 1): Promise<any> {
  try {
    const response = await fetchWithTimeout(
      API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://sortmylifeout-now.com",
          "X-OpenRouter-Title": "Sort My Life Out Now",
        },
        body: JSON.stringify({
          model: "x-ai/grok-4.3",
          temperature: 0.7,
          max_tokens: 450,
          messages,
        }),
      },
      7000
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (attempt >= 2) throw error;
    await wait(800);
    return callOpenRouter(messages, attempt + 1);
  }
}

export async function handler(event: any) {
  try {
    if (event.httpMethod === "GET") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, function: "chat" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
    const recentMessages = incomingMessages.slice(-6);

    const messages = [
      {
        role: "system",
        content: `
You are a calm, perceptive, emotionally intelligent guide.

Your goal is to understand what is actually going on in the user's life so the app can later generate a useful life analysis and action plan.

Be warm, focused, concise and gently probing.

Rules:
- Ask one strong question at a time.
- Do not jump topics too quickly.
- If the user is vague, ask what specifically they mean.
- Look for pressure points, avoidance, uncertainty, emotional load and practical blocks.
- Do not give solutions too early.
- Avoid therapy jargon.
        `,
      },
      ...recentMessages,
    ];

    const data = await callOpenRouter(messages);

    const reply =
      data?.choices?.[0]?.message?.content ||
      "I’m still here — could you say that again slightly differently?";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        choices: [{ message: { content: reply } }],
      }),
    };
  } catch (error) {
    console.error("CHAT FUNCTION ERROR:", error);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        choices: [
          {
            message: {
              content:
                "I’m having trouble connecting for a moment, but I haven’t lost the thread. Give me a few seconds and try again.",
            },
          },
        ],
      }),
    };
  }
}