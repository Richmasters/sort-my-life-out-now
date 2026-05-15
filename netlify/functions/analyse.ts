const API_URL = "https://openrouter.ai/api/v1/chat/completions";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: any, timeoutMs = 12000) {
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
          temperature: 0.2,
          max_tokens: 1200,
          messages,
        }),
      },
      12000
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter analyse error ${response.status}: ${errorText}`);
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
        body: JSON.stringify({ ok: true, function: "analyse" }),
      };
    }

    const { messages } = JSON.parse(event.body || "{}");
    const incomingMessages = Array.isArray(messages) ? messages.slice(-10) : [];

    const data = await callOpenRouter([
      {
        role: "system",
        content: `
You are analysing a user's life audit conversation for the app "Sort My Life Out Now".

Return ONLY valid JSON.
No markdown.
No explanation.
No code block.

Scores must be from 0 to 100.
Do NOT score from 1 to 10.
Do NOT use only round tens.
Use nuanced scores such as 23, 41, 57, 76.

Scoring meaning:
- 0 to 33 = needs attention
- 34 to 67 = building
- 68 to 100 = strong

You are not judging the user.
You are creating a useful, compassionate snapshot.

Return exactly this JSON shape:

{
  "scores": {
    "Mind": 0-100,
    "Body": 0-100,
    "Money": 0-100,
    "Work": 0-100,
    "Love": 0-100,
    "Home": 0-100,
    "Life Admin": 0-100,
    "Purpose": 0-100
  },
  "insights": {
    "Mind": "warm personalised explanation",
    "Body": "warm personalised explanation",
    "Money": "warm personalised explanation",
    "Work": "warm personalised explanation",
    "Love": "warm personalised explanation",
    "Home": "warm personalised explanation",
    "Life Admin": "warm personalised explanation",
    "Purpose": "warm personalised explanation"
  },
  "quickWins": [
    "short practical action",
    "short practical action",
    "short practical action",
    "short practical action",
    "short practical action"
  ]
}

Rules:
- Insights must be specific to what the user shared.
- Each insight should explain why that area may be where it is.
- Keep insights warm, grounded and non-judgemental.
- Avoid diagnosis.
- Avoid generic self-help language.
- Quick wins must be small, practical and based on the conversation.
- Do not invent dramatic problems the user did not mention.
        `,
      },
      ...incomingMessages,
    ]);

    const content = data?.choices?.[0]?.message?.content;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: content || JSON.stringify({ error: "No analysis returned" }),
    };
  } catch (error) {
    console.error("ANALYSE FUNCTION ERROR:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "analysis failed" }),
    };
  }
}