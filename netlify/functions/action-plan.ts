export async function handler(event: any) {
  try {
    const { onboarding, result, messages } = JSON.parse(event.body || "{}");

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: `
Create a warm, practical 30-day life improvement plan.

Return ONLY valid JSON. No markdown.

Shape:

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
- Make it specific to the user's scores and conversation
- Keep actions small and realistic
- Avoid therapy/medical/financial/legal claims
- Warm, practical, encouraging tone
            `,
          },
          {
            role: "user",
            content: JSON.stringify({ onboarding, result, messages }),
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    return {
      statusCode: 200,
      body: content || JSON.stringify({ error: "No plan returned" }),
    };
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "plan failed" }),
    };
  }
}