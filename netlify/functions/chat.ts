const API_URL = "https://openrouter.ai/api/v1/chat/completions";

type CoverageState = "unexplored" | "forming" | "clear";
type ConversationPhase = "exploring" | "finalCheck" | "ready";

type CoverageMap = {
  Mind: CoverageState;
  Body: CoverageState;
  Money: CoverageState;
  Work: CoverageState;
  Love: CoverageState;
  Home: CoverageState;
  "Life Admin": CoverageState;
  Purpose: CoverageState;
};

const defaultCoverage: CoverageMap = {
  Mind: "unexplored",
  Body: "unexplored",
  Money: "unexplored",
  Work: "unexplored",
  Love: "unexplored",
  Home: "unexplored",
  "Life Admin": "unexplored",
  Purpose: "unexplored",
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: any, timeoutMs = 9000) {
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
          model: "inception/mercury-2",
          temperature: 0.35,
          max_tokens: 650,
          response_format: { type: "json_object" },
          messages,
        }),
      },
      9000
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (attempt >= 2) throw error;
    await wait(800);
    return callOpenRouter(messages, attempt + 1);
  }
}

function safeCoverage(value: unknown): CoverageMap {
  if (!value || typeof value !== "object") return defaultCoverage;

  const raw = value as Record<string, unknown>;
  const valid = new Set(["unexplored", "forming", "clear"]);

  return {
    Mind: valid.has(String(raw.Mind)) ? (raw.Mind as CoverageState) : "unexplored",
    Body: valid.has(String(raw.Body)) ? (raw.Body as CoverageState) : "unexplored",
    Money: valid.has(String(raw.Money)) ? (raw.Money as CoverageState) : "unexplored",
    Work: valid.has(String(raw.Work)) ? (raw.Work as CoverageState) : "unexplored",
    Love: valid.has(String(raw.Love)) ? (raw.Love as CoverageState) : "unexplored",
    Home: valid.has(String(raw.Home)) ? (raw.Home as CoverageState) : "unexplored",
    "Life Admin": valid.has(String(raw["Life Admin"]))
      ? (raw["Life Admin"] as CoverageState)
      : "unexplored",
    Purpose: valid.has(String(raw.Purpose)) ? (raw.Purpose as CoverageState) : "unexplored",
  };
}

function safePhase(value: unknown): ConversationPhase {
  if (value === "finalCheck" || value === "ready") return value;
  return "exploring";
}

function parseJsonReply(content: string) {
  const cleaned = content.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("No valid JSON object found in chat response");
  }
}

function looksLikeJson(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.includes('"reply"') ||
    trimmed.includes('"coverage"') ||
    trimmed.includes('"phase"')
  );
}

function countRealUserMessages(messages: any[]) {
  return messages.filter((message) => {
    if (message?.role !== "user" || typeof message?.content !== "string") {
      return false;
    }

    return !message.content.includes("User context from onboarding:");
  }).length;
}

function applyConversationGuard(
  phase: ConversationPhase,
  coverage: CoverageMap,
  userMessageCount: number,
  currentPhase: ConversationPhase
): ConversationPhase {
  if (currentPhase === "finalCheck") return "ready";
  if (phase !== "exploring") return phase;

  const coveredCount = Object.values(coverage).filter(
    (state) => state === "forming" || state === "clear"
  ).length;

  if (userMessageCount >= 7 || (userMessageCount >= 5 && coveredCount >= 4)) {
    return "finalCheck";
  }

  return phase;
}

export async function handler(event: any) {
  try {
    if (event.httpMethod === "GET") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, function: "chat" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
    const recentMessages = incomingMessages.slice(-18);
    const currentCoverage = safeCoverage(body.coverage);
    const currentPhase = safePhase(body.phase);
    const userMessageCount = countRealUserMessages(incomingMessages);

    const data = await callOpenRouter([
      {
        role: "system",
        content: `
You are the conversational guide inside the app "Sort My Life Out Now".

The app helps someone speak naturally about what is going on in their life, then creates a thoughtful "Life Picture" across eight zones and, later, a carefully crafted plan.

You are warm, calm, perceptive, and purposeful.
Not a therapist. Not a coach. Not a form.
You should feel like a wise, trusted person who listens carefully and gently moves the conversation somewhere useful.

You must return ONLY valid JSON.
No markdown.
No explanation.
No code block.
Never show the JSON to the user inside the reply field.
The reply field must contain only the warm conversational message the user should see.

Return exactly this shape:

{
  "reply": "the message the user will see",
  "coverage": {
    "Mind": "unexplored|forming|clear",
    "Body": "unexplored|forming|clear",
    "Money": "unexplored|forming|clear",
    "Work": "unexplored|forming|clear",
    "Love": "unexplored|forming|clear",
    "Home": "unexplored|forming|clear",
    "Life Admin": "unexplored|forming|clear",
    "Purpose": "unexplored|forming|clear"
  },
  "phase": "exploring|finalCheck|ready"
}

Current coverage state:
${JSON.stringify(currentCoverage)}

Current conversation phase:
${currentPhase}

THE EIGHT LIFE ZONES

- Mind: mental and emotional load, overwhelm, confidence, steadiness.
- Body: sleep, energy, movement, health habits, physical capacity.
- Money: financial steadiness, uncertainty, avoidance, pressure.
- Work: job, workload, direction, satisfaction, contribution.
- Love: relationships, connection, support, loneliness, family strain where relevant.
- Home: living environment, comfort, domestic friction, place of calm or stress.
- Life Admin: unfinished tasks, appointments, paperwork, bills, clutter of obligations.
- Purpose: meaning, direction, motivation, hopes, feeling stuck or moving.

COVERAGE RULES

Use these states honestly:

- unexplored: little or no meaningful signal yet.
- forming: some meaningful signal, but not enough for a confident score.
- clear: enough grounded understanding to support a credible Life Picture score and practical plan.

You do NOT need equal depth on all eight zones.
You DO need enough overall coverage that the Life Picture will not feel like guesswork.
A good conversation usually explores the user's loudest pressure deeply, then gathers a lighter but real read on other important zones.

CONVERSATION RHYTHM

1. Follow the user's opening concern first.
2. Reflect accurately. Do not merely paraphrase.
3. Ask ONE question only.
4. Once the main thread is understood, gently nudge toward under-covered zones that matter.
5. These nudges should feel natural, not like a checklist.
6. It is fine to ask direct, warm questions about underexplored zones when needed.
7. Do not drift indefinitely around one theme if other important areas remain unclear.
8. Keep replies under 95 words unless the user is in obvious distress.

Examples of good natural nudges:
- "I’m getting a clearer sense of how work is weighing on you. I’d also like to understand whether that pressure is spilling into the rest of life — is it affecting your energy, your home life, or your relationships most?"
- "Before I form the bigger picture, I want to check one practical area too: does money feel mostly steady in the background, or is it adding pressure as well?"
- "When things feel this heavy, what tends to suffer first — your sleep and energy, your home getting on top of you, or your patience with the people close to you?"

PHASE RULES

If phase is "exploring":
- Continue the conversation.
- Update coverage honestly.
- Once you have a meaningful enough overall picture, change phase to "finalCheck".
- By 5 to 7 user replies, you should normally be moving to "finalCheck" unless the conversation is unusually thin.
- When you change to "finalCheck", your reply should be exactly one warm paragraph ending with a version of:
  "Before I turn this into your Life Picture, is there anything else you'd like me to understand or keep in mind?"

Do not move to "finalCheck" too early.
Usually, this should happen only after enough meaningful back-and-forth to make a credible Life Picture.
If the user has given rich, detailed information quickly, it may happen earlier.

If phase is "finalCheck":
- The user's new message is their response to the final "anything else?" invitation.
- If they add a modest final note, acknowledge it warmly and set phase to "ready".
- Your reply should say, in your own natural wording, that you have enough now and are ready to build their Life Picture.
- If they introduce a major new issue that clearly needs one immediate clarifying question before scoring, ask that one question, update coverage, and set phase back to "exploring".

If phase is "ready":
- Say briefly that their Life Picture is ready to reveal.
- Keep phase as "ready".

TONE

Warm, observant, grounded.
Not overly soothing.
Not jargon-heavy.
Not falsely positive.
Not meandering.
Not interrogation-heavy.
No more than one question in a reply.

Keep the conversation purposeful enough that the user feels:
"This is listening to me, but it is also building toward something."
        `,
      },
      ...recentMessages,
    ]);

    const rawContent =
      data?.choices?.[0]?.message?.content ||
      JSON.stringify({
        reply: "I’m still here with you. Could you say that again slightly differently?",
        coverage: currentCoverage,
        phase: currentPhase,
      });

    let parsed: {
      reply?: string;
      coverage?: CoverageMap;
      phase?: ConversationPhase;
    };

    try {
      parsed = parseJsonReply(rawContent);
    } catch {
      parsed = {
        reply:
          "I'm here with you. I've got the thread, but I want to keep this useful rather than messy: what feels most important for me to understand before I build your Life Picture?",
        coverage: currentCoverage,
        phase: currentPhase,
      };
    }

    const nextCoverage = safeCoverage(parsed.coverage);
    const nextPhase = applyConversationGuard(
      safePhase(parsed.phase),
      nextCoverage,
      userMessageCount,
      currentPhase
    );

    const reply =
      typeof parsed.reply === "string" &&
      parsed.reply.trim() &&
      !looksLikeJson(parsed.reply)
        ? parsed.reply.trim()
        : "I’m still here with you. Could you say that again slightly differently?";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply,
        coverage: nextCoverage,
        phase: nextPhase,
      }),
    };
  } catch (error) {
    console.error("CHAT FUNCTION ERROR:", error);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply:
          "I’m having trouble connecting for a moment, but I haven’t lost the thread. Give me a few seconds and try again.",
        coverage: defaultCoverage,
        phase: "exploring",
      }),
    };
  }
}
