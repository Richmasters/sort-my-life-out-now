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

Return ONLY valid JSON. No markdown. No explanation. No code block.

You must score each life area from 0 to 100.

Important scoring rules:
- Do NOT score from 1 to 10.
- Do NOT use only round tens.
- Use nuanced scores such as 17, 28, 43, 56, 71, 84.
- 0 means this area is completely depleted or absent.
- 100 means this area is exceptionally strong.
- Most real scores should fall somewhere between 15 and 85.

Colour meaning used by the app:
- 0 to 33 = red / needs attention
- 34 to 67 = amber / developing
- 68 to 100 = green / strong

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
  "quickWins": [
    "short practical action",
    "short practical action",
    "short practical action",
    "short practical action",
    "short practical action"
  ]
}

Quick wins must be:
- specific
- practical
- small enough to do soon
- based on what the user actually shared
- not generic wellness advice
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