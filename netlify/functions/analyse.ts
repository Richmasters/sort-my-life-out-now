export async function handler(event: any) {
  try {
    const { messages } = JSON.parse(event.body);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
You are analysing a conversation to produce a structured "Wheel of Life" result.

Return ONLY valid JSON. No explanation.

The structure must be:

{
  "scores": {
    "Mind": number (1-10),
    "Body": number (1-10),
    "Money": number (1-10),
    "Work": number (1-10),
    "Love": number (1-10),
    "Home": number (1-10),
    "Life Admin": number (1-10),
    "Purpose": number (1-10)
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
- Scores must reflect what the user said
- If unsure, estimate intelligently
- Quick wins must be practical, specific, and easy to act on
- No generic advice
- No explanation outside JSON
            `,
          },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    const content = data.choices?.[0]?.message?.content;

    return {
      statusCode: 200,
      body: content,
    };
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "analysis failed" }),
    };
  }
}