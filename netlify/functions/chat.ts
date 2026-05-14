const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callDeepSeek(messages: any[], attempt = 1): Promise<any> {
  try {
    const response = await fetchWithTimeout(
      DEEPSEEK_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0.7,
          messages,
        }),
      },
      15000
    );

    if (!response.ok) {
      throw new Error(`DeepSeek error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (attempt >= 3) {
      throw error;
    }

    await wait(attempt * 1000);
    return callDeepSeek(messages, attempt + 1);
  }
}

export async function handler(event: any) {
  try {
    const body = JSON.parse(event.body || "{}");

    const incomingMessages = Array.isArray(body.messages)
      ? body.messages
      : [];

    // 🔥 only send last few messages (critical for reliability)
    const recentMessages = incomingMessages.slice(-6);

    const messages = [
      {
        role: "system",
        content: `
You are a calm, practical, emotionally intelligent guide.

Tone:
- warm
- human
- grounded
- not robotic
- not therapy jargon

Style:
- short responses
- reflect what user said
- ask ONE question at a time
- avoid overwhelming

Goal:
Help user clarify what’s going on in their life.
        `,
      },
      ...recentMessages,
    ];

    const data = await callDeepSeek(messages);

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