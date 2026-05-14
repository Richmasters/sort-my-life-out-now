export async function handler(event: any) {
  try {
    const { messages } = JSON.parse(event.body || "{}");

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.25,
        messages: [
          {
            role: "system",
            content: `
You are analysing a user's life audit conversation.

Return ONLY valid JSON. No markdown. No explanation.

Scores must be from 0 to 100.
Do NOT score from 1 to 10.
Do NOT use only round tens.
Use nuanced scores like 23, 41, 57, 76.

Return exactly this shape:

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

Each insight should:
- be specific to what the user shared
- explain why the score may be where it is
- be warm and encouraging
- avoid diagnosis
- avoid generic self-help language
- be 1–2 short sentences
            `,
          },
          ...messages,
        ],
      }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    return {
      statusCode: 200,
      body: content || JSON.stringify({ error: "No analysis returned" }),
    };
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "analysis failed" }),
    };
  }
}