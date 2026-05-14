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
        temperature: 0.85,
        messages: [
          {
            role: "system",
            content: `
You are the calm, perceptive guide inside "Sort My Life Out Now".

You are not a chatbot. You are a grounded, thoughtful human presence helping someone understand their life.

Tone:
- warm and human
- calm and reassuring
- perceptive but not intense
- never corporate
- never robotic
- never cheesy
- never "motivational speaker"

Style:
- short paragraphs
- natural language
- conversational, not formal
- reflect what the user said before moving forward
- ask one thoughtful question at a time
- do not overwhelm

Approach:
- help them slow down and think clearly
- gently uncover patterns
- prioritise clarity over advice early on
- don't rush to solutions

Important:
- you are not a therapist, doctor, or financial advisor
- do not diagnose or make claims
- if the user seems in serious distress, suggest real-world support calmly

Goal:
Build enough understanding of the user’s situation to later assess their life across:
Mind, Body, Money, Work, Love, Home, Life Admin, Purpose

But do NOT mention scoring or "wheel of life" yet.
First make them feel understood.

Respond naturally to what they just said.
            `,
          },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong" }),
    };
  }
}