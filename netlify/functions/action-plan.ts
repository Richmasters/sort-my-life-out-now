const API_URL = "https://openrouter.ai/api/v1/chat/completions";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: any, timeoutMs = 15000) {
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
          temperature: 0.3,
          max_tokens: 1500,
          messages,
        }),
      },
      15000
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter action-plan error ${response.status}: ${errorText}`
      );
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
        body: JSON.stringify({ ok: true, function: "action-plan" }),
      };
    }

    const { onboarding, result, messages } = JSON.parse(event.body || "{}");

    const recentMessages = Array.isArray(messages) ? messages.slice(-10) : [];

    const data = await callOpenRouter([
      {
        role: "system",
        content: `
You create practical 30-day action plans for the app "Sort My Life Out Now".

Return ONLY valid JSON.
No markdown.
No explanation.
No code block.

The plan should feel:
- warm
- realistic
- encouraging
- specific to the user's life audit
- not generic
- not overwhelming

Return exactly this JSON shape:

{
  "title": "string",
  "summary": "short warm summary",
  "weeks": [
    {
      "week": 1,
      "theme": "string",
      "focus": "string",
      "actions": ["action", "action", "action"]
    },
    {
      "week": 2,
      "theme": "string",
      "focus": "string",
      "actions": ["action", "action", "action"]
    },
    {
      "week": 3,
      "theme": "string",
      "focus": "string",
      "actions": ["action", "action", "action"]
    },
    {
      "week": 4,
      "theme": "string",
      "focus": "string",
      "actions": ["action", "action", "action"]
    }
  ]
}

Rules:
- Use the user's onboarding, conversation, scores, insights and quick wins.
- Week 1 should stabilise and reduce pressure.
- Week 2 should clear obvious friction.
- Week 3 should build rhythm and consistency.
- Week 4 should review, refine and choose the next focus.
- Each week must contain exactly 3 actions.
- Actions must be small enough to do soon.
- Avoid vague advice like "be more mindful" unless made practical.
- Avoid therapy, medical, legal or financial claims.
- Do not diagnose.
- Do not promise outcomes.
- Do not create huge life overhauls.
- Make it feel like a calm plan a real person could actually follow.
        `,
      },
      {
        role: "user",
        content: JSON.stringify({
          onboarding,
          result,
          messages: recentMessages,
        }),
      },
    ]);

    const content = data?.choices?.[0]?.message?.content;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: content || JSON.stringify({ error: "No plan returned" }),
    };
  } catch (error) {
    console.error("ACTION PLAN FUNCTION ERROR:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "plan failed" }),
    };
  }
}