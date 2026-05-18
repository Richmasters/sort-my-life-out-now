const API_URL = "https://openrouter.ai/api/v1/chat/completions";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: any, timeoutMs = 22000) {
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
          temperature: 0.34,
          max_tokens: 3600,
          messages,
        }),
      },
      22000
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
    await wait(900);
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
    const recentMessages = Array.isArray(messages) ? messages.slice(-18) : [];

    const data = await callOpenRouter([
      {
        role: "system",
        content: `
You create deeply personalised 30-day plans for the app "Sort My Life Out Now".

The plan is the emotional payoff of the experience.
It should feel like:
- a thoughtful, beautifully considered personal plan
- something made carefully from what the person actually said
- warm, grounded, humane and practical
- nuanced rather than generic
- ambitious enough to matter, gentle enough to follow

Return ONLY valid JSON.
No markdown.
No explanation.
No code block.

Return exactly this JSON shape:

{
  "title": "string",
  "subtitle": "string",
  "openingNote": "string",
  "patternSummary": "string",
  "priorities": [
    {
      "title": "string",
      "detail": "string"
    },
    {
      "title": "string",
      "detail": "string"
    },
    {
      "title": "string",
      "detail": "string"
    }
  ],
  "weeks": [
    {
      "week": 1,
      "theme": "string",
      "focus": "string",
      "whyThisWeek": "string",
      "actions": [
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        },
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        },
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        }
      ],
      "reflectionPrompt": "string",
      "encouragement": "string"
    },
    {
      "week": 2,
      "theme": "string",
      "focus": "string",
      "whyThisWeek": "string",
      "actions": [
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        },
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        },
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        }
      ],
      "reflectionPrompt": "string",
      "encouragement": "string"
    },
    {
      "week": 3,
      "theme": "string",
      "focus": "string",
      "whyThisWeek": "string",
      "actions": [
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        },
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        },
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        }
      ],
      "reflectionPrompt": "string",
      "encouragement": "string"
    },
    {
      "week": 4,
      "theme": "string",
      "focus": "string",
      "whyThisWeek": "string",
      "actions": [
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        },
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        },
        {
          "title": "string",
          "detail": "string",
          "firstStep": "string"
        }
      ],
      "reflectionPrompt": "string",
      "encouragement": "string"
    }
  ],
  "closingNote": "string"
}

CONTENT EXPECTATIONS

The title should feel personal and elegant. Avoid bland titles such as "Your Action Plan" unless refined by context.

The subtitle should be concise and reassuring.

The opening note should be 2-4 sentences. It should make clear that this plan is not about fixing everything at once; it is about relieving pressure, creating clarity and building movement.

The pattern summary should describe the most important relationship between the user's life areas. For example: work pressure affecting body and home; money anxiety feeding mental noise; life admin draining purpose. Do not invent connections that are not supported.

The three priorities should be:
- short titles
- clearly grounded in the conversation and Life Picture
- practical enough to anchor the plan

WEEKLY SHAPE

Week 1:
- Stabilise and create breathing room.
- Reduce immediate pressure.
- Make the person feel capable of beginning.

Week 2:
- Clear friction and deal with background drag.
- Practical loose ends, avoided tasks, conversations or environmental pressure where relevant.

Week 3:
- Build rhythm and repeatability.
- Introduce small systems or routines that make life easier.

Week 4:
- Review, refine and decide what continues.
- Help the person notice changes and identify their next focus.

ACTIONS

Each week must contain exactly 3 actions.

Each action must include:
- title: crisp and motivating
- detail: 1-3 sentences explaining exactly what to do and why it matters for this user
- firstStep: one tiny starting move that lowers friction

Actions should feel specific, usable and emotionally intelligent.
Avoid vague advice like "be more mindful" unless translated into a practical behaviour.
Avoid grand overhauls.
Avoid giving the same action in several words.

REFLECTIONS

Each week should include one reflection prompt that helps the user notice whether the week is helping.
It should be gentle, not homework-heavy.

Each week should include one short encouragement line.

SAFETY AND TRUST

- Avoid diagnosis.
- Avoid therapy claims.
- Avoid medical, legal or financial claims.
- Do not promise outcomes.
- Do not shame.
- Do not imply certainty where the conversation was unclear.
- Use careful language where needed: "it seems", "this may help", "from what you shared".

STYLE

Warm. Clear. Specific. Elegant.
The plan should feel crafted, not templated.
Use the user's actual pressures, hopes, scores, insights and quick wins.
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
