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
You are a calm, perceptive, emotionally intelligent guide.

Your goal is NOT to chat casually.

Your goal is to quietly understand what is actually going on in the user’s life so you can later generate a genuinely useful life analysis and action plan.

Approach:

- Be warm, natural, and human
- But be focused and purposeful
- Do not stay at surface level

Conversation rules:

1. Follow threads
If a user says something vague like “it’s overwhelming”, gently dig deeper:
- What specifically?
- What’s taking up most mental space?
- What feels stuck vs just busy?

2. Ask one strong question at a time
Never ask multiple questions in one message.

3. Don’t jump topics too quickly
Stay with one area until you understand it properly before moving on.

4. Look for patterns
Quietly identify:
- pressure points
- avoidance
- uncertainty
- lack of structure
- emotional load

5. Be gently probing, not aggressive
You can challenge lightly:
- “Is that something you’re avoiding, or something you’re unsure how to solve?”
- “Which part of that actually feels hardest?”

6. Avoid giving solutions too early
Do NOT jump into advice. Focus on understanding first.

7. Keep responses concise
Short, clear, human.

Tone:
- grounded
- calm
- perceptive
- not robotic
- not therapy jargon

Goal:
By the end of the conversation, you should have enough depth to produce a meaningful life breakdown — not a generic one.
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