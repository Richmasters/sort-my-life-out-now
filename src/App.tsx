import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type Step =
  | "landing"
  | "onboarding"
  | "conversation"
  | "analysing"
  | "wheel"
  | "actionPlan";

type Message = {
  role: "assistant" | "user";
  text: string;
};

type Onboarding = {
  name: string;
  ageRange: string;
  currentFeeling: string;
  pressureArea: string;
  helpWanted: string;
};

type Result = {
  scores: Record<string, number>;
  insights?: Record<string, string>;
  quickWins: string[];
};

type ActionPlan = {
  title: string;
  summary: string;
  weeks: {
    week: number;
    theme: string;
    focus: string;
    actions: string[];
  }[];
};

type Zone = {
  label: string;
  icon: string;
};

type CoverageState = "unexplored" | "forming" | "clear";
type ConversationPhase = "exploring" | "finalCheck" | "ready";
type CoverageMap = Record<string, CoverageState>;

const zones: Zone[] = [
  { label: "Mind", icon: "🧠" },
  { label: "Body", icon: "💪" },
  { label: "Money", icon: "💰" },
  { label: "Work", icon: "💼" },
  { label: "Love", icon: "❤️" },
  { label: "Home", icon: "🏠" },
  { label: "Life Admin", icon: "🗂️" },
  { label: "Purpose", icon: "🌟" },
];

const initialCoverage: CoverageMap = {
  Mind: "unexplored",
  Body: "unexplored",
  Money: "unexplored",
  Work: "unexplored",
  Love: "unexplored",
  Home: "unexplored",
  "Life Admin": "unexplored",
  Purpose: "unexplored",
};

const fallbackResult: Result = {
  scores: {
    Mind: 26,
    Body: 48,
    Money: 22,
    Work: 41,
    Love: 72,
    Home: 55,
    "Life Admin": 31,
    Purpose: 44,
  },
  insights: {
    Mind: "Your mind looks like it may be carrying a lot at once. The first win here is not to solve everything, but to reduce the noise.",
    Body: "Your body may not be the main problem, but it still affects how much capacity you have. Small routines could help stabilise everything else.",
    Money: "Money looks like one of the pressure points. Getting visibility on what is coming in and going out could create quick relief.",
    Work: "Work appears to be taking up mental space. A clearer boundary or priority list may help reduce the sense of being dragged around by it.",
    Love: "This looks like one of the steadier areas. It may be worth leaning on safe relationships rather than trying to carry everything alone.",
    Home: "Home seems functional but could probably feel calmer. Small improvements to your environment may help your head feel clearer.",
    "Life Admin":
      "Life admin looks like it may be adding background stress. One short, focused admin session could make things feel less chaotic.",
    Purpose:
      "Purpose seems a little unclear right now. That is normal when life is noisy — clarity often returns after the pressure reduces.",
  },
  quickWins: [
    "Choose one small life-admin task and finish it today.",
    "Take a 10-minute walk before trying to solve everything.",
    "Write down the three things causing the most pressure.",
    "Send one honest message to someone you trust.",
    "Pick tomorrow’s first task before bed tonight.",
  ],
};

const fallbackActionPlan: ActionPlan = {
  title: "Your 30-day reset plan",
  summary:
    "A simple, steady plan to reduce pressure and create movement without overwhelming you.",
  weeks: [
    {
      week: 1,
      theme: "Stabilise",
      focus: "Reduce noise and create breathing room.",
      actions: [
        "Write down the three areas causing the most pressure.",
        "Choose one small task you can finish today.",
        "Take one 10-minute walk without your phone.",
      ],
    },
    {
      week: 2,
      theme: "Clear pressure",
      focus: "Deal with the most obvious sources of stress.",
      actions: [
        "Tackle one life-admin task.",
        "Review one recurring payment or commitment.",
        "Have one honest conversation you have been avoiding.",
      ],
    },
    {
      week: 3,
      theme: "Build rhythm",
      focus: "Create repeatable habits that support you.",
      actions: [
        "Pick a simple morning or evening routine.",
        "Block one weekly reset slot in your calendar.",
        "Choose one boundary that protects your energy.",
      ],
    },
    {
      week: 4,
      theme: "Review and refine",
      focus: "Notice what changed and decide what comes next.",
      actions: [
        "Revisit your Life Picture and notice what has shifted.",
        "Keep what worked and drop what felt unrealistic.",
        "Choose one focus area for the next month.",
      ],
    },
  ],
};

function getScoreColour(score: number) {
  if (score <= 33) return "#dc2626";
  if (score <= 67) return "#f59e0b";
  return "#16a34a";
}

function getScoreStatus(score: number) {
  if (score <= 33) {
    return {
      label: "Needs attention",
      message:
        "This area looks like it is carrying real pressure at the moment. That does not mean failure — it simply means this may be one of the best places to start gently.",
      encouragement:
        "Start small. One clear, manageable action here can create more relief than trying to fix everything at once.",
    };
  }

  if (score <= 67) {
    return {
      label: "Building",
      message:
        "There is something to work with here. This area is not broken, but it could probably feel steadier, lighter or more organised with a little focused attention.",
      encouragement:
        "You do not need a dramatic overhaul. A few consistent improvements could compound quickly.",
    };
  }

  return {
    label: "Strong",
    message:
      "This looks like one of your stronger areas. Something here is already working, even if the rest of life feels messy.",
    encouragement:
      "Notice what is supporting you here. The same strengths may help you improve other parts of life too.",
  };
}

function clampScore(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return 50;
  if (value <= 10) return Math.round(value * 10);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateAverage(scores: Record<string, number>) {
  const values = zones.map((zone) => clampScore(scores[zone.label]));
  return Math.round(
    values.reduce((total, score) => total + score, 0) / values.length
  );
}

function getLowestZone(scores: Record<string, number>) {
  return zones.reduce((lowest, zone) => {
    const score = clampScore(scores[zone.label]);
    const lowestScore = clampScore(scores[lowest.label]);
    return score < lowestScore ? zone : lowest;
  }, zones[0]);
}

function getFocusOrder(scores: Record<string, number>) {
  return [...zones].sort(
    (a, b) => clampScore(scores[a.label]) - clampScore(scores[b.label])
  );
}

function polar(centerX: number, centerY: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
}

function segmentPath(
  center: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const a = polar(center, center, outerRadius, startAngle);
  const b = polar(center, center, outerRadius, endAngle);
  const c = polar(center, center, innerRadius, endAngle);
  const d = polar(center, center, innerRadius, startAngle);

  return [
    `M ${a.x} ${a.y}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${d.x} ${d.y}`,
    "Z",
  ].join(" ");
}

function getCoverageLabel(state: CoverageState) {
  if (state === "clear") return "Clear enough";
  if (state === "forming") return "Taking shape";
  return "Not explored yet";
}

function normaliseCoverage(value: unknown): CoverageMap {
  if (!value || typeof value !== "object") return initialCoverage;

  const raw = value as Record<string, unknown>;

  return zones.reduce<CoverageMap>((accumulator, zone) => {
    const candidate = raw[zone.label];
    accumulator[zone.label] =
      candidate === "forming" || candidate === "clear"
        ? candidate
        : "unexplored";
    return accumulator;
  }, {});
}

function normalisePhase(value: unknown): ConversationPhase {
  if (value === "finalCheck" || value === "ready") return value;
  return "exploring";
}

export default function App() {
  const [step, setStep] = useState<Step>("landing");
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [coverage, setCoverage] = useState<CoverageMap>(initialCoverage);
  const [conversationPhase, setConversationPhase] =
    useState<ConversationPhase>("exploring");

  const [onboarding, setOnboarding] = useState<Onboarding>({
    name: "",
    ageRange: "35–44",
    currentFeeling: "Overwhelming",
    pressureArea: "Mind",
    helpWanted: "",
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Before we try to fix anything, let’s just get a proper feel for what’s going on. What part of life feels heaviest at the moment?",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  function onboardingContext() {
    return `
User context from onboarding:
Name: ${onboarding.name || "Not given"}
Age range: ${onboarding.ageRange}
Current feeling: ${onboarding.currentFeeling}
Biggest pressure area: ${onboarding.pressureArea}
What they most hope to come away with today: ${onboarding.helpWanted || "Not given"}

Use this naturally. Do not list it back mechanically.
    `.trim();
  }

  async function sendMessage() {
    if (!message.trim() || isThinking || conversationPhase === "ready") return;

    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", text: message.trim() },
    ];

    setMessages(updatedMessages);
    setMessage("");
    setIsThinking(true);

    try {
      const response = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: onboardingContext() },
            ...updatedMessages.map((m) => ({
              role: m.role,
              content: m.text,
            })),
          ],
          coverage,
          phase: conversationPhase,
        }),
      });

      const data = await response.json();

      const aiReply =
  typeof data?.reply === "string" && data.reply.trim()
    ? data.reply.trim()
    : typeof data?.choices?.[0]?.message?.content === "string" &&
        data.choices[0].message.content.trim()
      ? data.choices[0].message.content.trim()
      : "I’m here with you. Tell me a little more about what feels hardest right now.";

      setMessages((current) => [
        ...current,
        { role: "assistant", text: aiReply },
      ]);

      setCoverage(normaliseCoverage(data?.coverage));
      setConversationPhase(normalisePhase(data?.phase));
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "I couldn’t connect properly. Try again in a moment.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  async function analyseLife() {
    setStep("analysing");

    try {
      const response = await fetch("/.netlify/functions/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: onboardingContext() },
            ...messages.map((m) => ({
              role: m.role,
              content: m.text,
            })),
          ],
        }),
      });

      const text = await response.text();
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      setResult(parsed);
      setStep("wheel");
    } catch {
      setResult(fallbackResult);
      setStep("wheel");
    }
  }

  async function generateActionPlan() {
    if (!result) return;

    setIsGeneratingPlan(true);

    try {
      const response = await fetch("/.netlify/functions/action-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding,
          result,
          messages,
        }),
      });

      const text = await response.text();
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      setActionPlan(parsed);
      setStep("actionPlan");
    } catch {
      setActionPlan(fallbackActionPlan);
      setStep("actionPlan");
    } finally {
      setIsGeneratingPlan(false);
    }
  }

  const coverageStats = useMemo(() => {
    const values = Object.values(coverage);
    return {
      clear: values.filter((value) => value === "clear").length,
      forming: values.filter((value) => value === "forming").length,
      unexplored: values.filter((value) => value === "unexplored").length,
    };
  }, [coverage]);

  const progressMessage =
    conversationPhase === "ready"
      ? "Your Life Picture is ready. I have enough to build a meaningful first view."
      : conversationPhase === "finalCheck"
        ? "We are nearly there. One final thought from you will help make the picture feel complete."
        : coverageStats.clear >= 4
          ? "A strong picture is forming. I’m filling in the remaining gaps so your Life Picture feels properly grounded."
          : "We are building your Life Picture as we talk. The zones below show what is becoming clearer.";

  return (
    <main className="app">
      {step === "landing" && (
        <section className="card hero landing-card">
          <p className="eyebrow">Sort My Life Out Now</p>

          <h1>
            A calmer way to understand your <em>whole life</em>
          </h1>

          <p className="intro">
            Have a warm, intelligent conversation about what’s really going on.
            Then get your personal Life Picture, five quick wins, and a clearer
            sense of what to do next.
          </p>

          <div className="hero-actions desktop-hero-actions">
            <button onClick={() => setStep("onboarding")}>
              Start my Life Picture
            </button>
            <span>No judgement. No noise. Just clarity.</span>
          </div>

          <div className="landing-panels">
            <div>
              <strong>1</strong>
              <h3>Talk it through</h3>
              <p>
                Start with a short context check, then speak naturally about
                what feels heavy, messy, stuck or unclear.
              </p>
            </div>

            <div>
              <strong>2</strong>
              <h3>Find the pattern</h3>
              <p>
                The AI gently looks across your mind, body, money, work, love,
                home, life admin and purpose.
              </p>
            </div>

            <div>
              <strong>3</strong>
              <h3>Get your next move</h3>
              <p>
                Reveal your Life Picture, then leave with five practical quick
                wins you can actually do.
              </p>
            </div>
          </div>

          <div className="hero-actions mobile-hero-actions">
            <button onClick={() => setStep("onboarding")}>
              Start my Life Picture
            </button>
            <span>No judgement. No noise. Just clarity.</span>
          </div>

          <div className="life-area-strip">
            {zones.map((zone) => (
              <span key={zone.label}>{zone.label}</span>
            ))}
          </div>

          <div className="trust-note">
            <p>
              Built to feel private, calm and useful. Free users can explore
              without creating an account; premium features will add saved
              progress, monthly check-ins and deeper action plans.
            </p>
          </div>
        </section>
      )}

      {step === "onboarding" && (
        <section className="card">
          <p className="eyebrow">First, a little context</p>

          <h2>Let’s get a feel for where you are.</h2>

          <form>
            <label>
              What should we call you?
              <input
                value={onboarding.name}
                onChange={(event) =>
                  setOnboarding({ ...onboarding, name: event.target.value })
                }
                placeholder="Your first name"
              />
            </label>

            <label>
              Age range
              <select
                value={onboarding.ageRange}
                onChange={(event) =>
                  setOnboarding({
                    ...onboarding,
                    ageRange: event.target.value,
                  })
                }
              >
                <option>18–24</option>
                <option>25–34</option>
                <option>35–44</option>
                <option>45–54</option>
                <option>55–64</option>
                <option>65+</option>
              </select>
            </label>

            <label>
              How does life feel right now?
              <select
                value={onboarding.currentFeeling}
                onChange={(event) =>
                  setOnboarding({
                    ...onboarding,
                    currentFeeling: event.target.value,
                  })
                }
              >
                <option>Overwhelming</option>
                <option>Stuck</option>
                <option>Busy but okay</option>
                <option>Changing</option>
                <option>Mostly good, but could be better</option>
              </select>
            </label>

            <label>
              Biggest pressure area
              <select
                value={onboarding.pressureArea}
                onChange={(event) =>
                  setOnboarding({
                    ...onboarding,
                    pressureArea: event.target.value,
                  })
                }
              >
                <option>Mind</option>
                <option>Body</option>
                <option>Money</option>
                <option>Work</option>
                <option>Love</option>
                <option>Home</option>
                <option>Life Admin</option>
                <option>Purpose</option>
              </select>
            </label>

            <label>
              What would you most like to come away with today?
              <textarea
                value={onboarding.helpWanted}
                onChange={(event) =>
                  setOnboarding({
                    ...onboarding,
                    helpWanted: event.target.value,
                  })
                }
                placeholder="A clearer head, a practical plan, help knowing where to start..."
              />
            </label>

            <button type="button" onClick={() => setStep("conversation")}>
              Continue to conversation
            </button>
          </form>
        </section>
      )}

      {step === "conversation" && (
        <section className="card chat-card">
          <p className="eyebrow">Your conversation</p>

          <h2>
            {onboarding.name
              ? `Let’s sort through this properly, ${onboarding.name}.`
              : "Let’s sort through this properly."}
          </h2>

          <LifePictureProgress
            coverage={coverage}
            progressMessage={progressMessage}
          />

          <div className="messages">
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`message ${item.role}`}>
                {item.text}
              </div>
            ))}

            {isThinking && (
              <div className="message assistant typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {conversationPhase === "ready" ? (
            <div className="ready-panel">
              <p>
                I have enough now to build a meaningful Life Picture from what
                you have shared.
              </p>
              <button className="reveal-button" onClick={analyseLife}>
                Reveal my Life Picture
              </button>
            </div>
          ) : (
            <div className="chat-input">
              <textarea
                value={message}
                disabled={isThinking}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={
                  isThinking ? "Thinking..." : "Type what’s on your mind..."
                }
              />

              <button type="button" onClick={sendMessage} disabled={isThinking}>
                {isThinking ? "Thinking" : "Send"}
              </button>
            </div>
          )}
        </section>
      )}

      {step === "analysing" && (
        <section className="card hero">
          <p className="eyebrow">Creating your Life Picture</p>
          <h2>Building your first clear picture...</h2>

          <div className="message assistant typing analysing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <p className="intro">
            I’m looking for patterns across your mind, body, money, work,
            relationships, home, life admin and purpose.
          </p>
        </section>
      )}

      {step === "wheel" && result && (
        <ResultsScreen
          result={result}
          onboarding={onboarding}
          onContinue={() => setStep("conversation")}
          onGeneratePlan={generateActionPlan}
          isGeneratingPlan={isGeneratingPlan}
        />
      )}

      {step === "actionPlan" && actionPlan && (
        <section className="card results-card">
          <p className="eyebrow">Your 30-day plan</p>

          <h2>{actionPlan.title}</h2>

          <p className="intro">{actionPlan.summary}</p>

          <div className="plan-weeks">
            {actionPlan.weeks.map((week) => (
              <div className="plan-week" key={week.week}>
                <span>Week {week.week}</span>
                <h3>{week.theme}</h3>
                <p>{week.focus}</p>

                <ul>
                  {week.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button onClick={() => setStep("wheel")}>Back to Life Picture</button>
        </section>
      )}
    </main>
  );
}

function LifePictureProgress({
  coverage,
  progressMessage,
}: {
  coverage: CoverageMap;
  progressMessage: string;
}) {
  const states = Object.values(coverage);
  const clearCount = states.filter((state) => state === "clear").length;
  const formingCount = states.filter((state) => state === "forming").length;
  const unexploredCount = states.filter((state) => state === "unexplored").length;

  const summaryParts = [
    clearCount > 0 ? `${clearCount} clear enough` : null,
    formingCount > 0 ? `${formingCount} taking shape` : null,
    unexploredCount > 0 ? `${unexploredCount} still to explore` : null,
  ].filter(Boolean);

  return (
    <div className="coverage-strip">
      <div className="coverage-strip-copy">
        <p className="eyebrow">Your Life Picture is taking shape</p>
        <p>{progressMessage}</p>
        <small>{summaryParts.join(" · ")}</small>
      </div>

      <div className="coverage-pills" aria-label="Life Picture conversation progress">
        {zones.map((zone) => {
          const state = coverage[zone.label] || "unexplored";

          return (
            <span
              className={`coverage-pill ${state}`}
              key={zone.label}
              title={`${zone.label}: ${getCoverageLabel(state)}`}
            >
              <em>{zone.icon}</em>
              {zone.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ResultsScreen({
  result,
  onboarding,
  onContinue,
  onGeneratePlan,
  isGeneratingPlan,
}: {
  result: Result;
  onboarding: Onboarding;
  onContinue: () => void;
  onGeneratePlan: () => void;
  isGeneratingPlan: boolean;
}) {
  const overallScore = calculateAverage(result.scores);
  const priorityZone = getLowestZone(result.scores);
  const priorityScore = clampScore(result.scores[priorityZone.label]);
  const priorityStatus = getScoreStatus(priorityScore);
  const priorityColour = getScoreColour(priorityScore);
  const focusOrder = getFocusOrder(result.scores);

  return (
    <section className="card wheel-card results-card">
      <p className="eyebrow">Your Life Picture</p>

      <h2>
        {onboarding.name
          ? `Here’s the first clear picture, ${onboarding.name}.`
          : "Here’s the first clear picture."}
      </h2>

      <LifeWheel scores={result.scores} insights={result.insights} />

      <div className="results-summary">
        <div className="overall-score">
          <span>Overall life score</span>
          <strong style={{ color: getScoreColour(overallScore) }}>
            {overallScore}/100
          </strong>
          <p>
            This is not a judgement. It is simply a snapshot of where life feels
            strong, strained, or ready for attention.
          </p>
        </div>

        <div className="priority-card" style={{ borderColor: priorityColour }}>
          <span>Priority focus</span>
          <strong>
            {priorityZone.icon} {priorityZone.label}
          </strong>
          <em style={{ color: priorityColour }}>{priorityScore}/100</em>
          <p>{priorityStatus.message}</p>
        </div>
      </div>

      <div className="focus-order">
        <div>
          <p className="eyebrow">Your focus order</p>
          <h3>Where to start first</h3>
          <p>
            Start with the lowest scores first. These are the areas most likely
            to create relief if you give them gentle, focused attention.
          </p>
        </div>

        <div className="focus-list">
          {focusOrder.map((zone, index) => {
            const score = clampScore(result.scores[zone.label]);
            const status = getScoreStatus(score);
            const colour = getScoreColour(score);

            return (
              <button
                type="button"
                className="focus-item"
                key={zone.label}
                style={{ borderColor: colour }}
              >
                <span>{index + 1}</span>
                <strong>
                  {zone.icon} {zone.label}
                </strong>
                <em style={{ color: colour }}>{score}/100</em>
                <small>{status.label}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="quick-wins upgraded-quick-wins">
        <h3>Your five quick wins</h3>
        <p className="quick-wins-intro">
          Start here. These are deliberately small, practical actions designed
          to create movement without overwhelming you.
        </p>

        {result.quickWins.map((win, index) => (
          <div className="quick-win" key={`${win}-${index}`}>
            <span>{index + 1}</span>
            <p>{win}</p>
          </div>
        ))}
      </div>

      <div className="premium-unlock">
        <p className="eyebrow">Premium preview</p>
        <h3>Turn your Life Picture into a 30-day action plan</h3>
        <p>
          Generate a personalised month-long reset plan based on your scores,
          conversation and quick wins.
        </p>

        <div className="premium-actions">
          <button
            type="button"
            onClick={onGeneratePlan}
            disabled={isGeneratingPlan}
          >
            {isGeneratingPlan ? "Building your plan..." : "Generate 30-day plan"}
          </button>
        </div>
      </div>

      <button onClick={onContinue}>Continue the conversation</button>
    </section>
  );
}

function LifeWheel({
  scores,
  insights,
}: {
  scores: Record<string, number>;
  insights?: Record<string, string>;
}) {
  const [activeZone, setActiveZone] = useState("Mind");

  const center = 200;
  const innerRadius = 50;
  const maxRadius = 150;
  const gap = 3;

  const active = zones.find((zone) => zone.label === activeZone) || zones[0];
  const activeScore = clampScore(scores[active.label]);
  const activeStatus = getScoreStatus(activeScore);
  const activeColour = getScoreColour(activeScore);
  const activeInsight =
    insights?.[active.label] ||
    "This area is part of your current Life Picture. The score is not a judgement — it is a starting point for clearer action.";

  return (
    <div className="life-wheel-wrap">
      <svg viewBox="0 0 400 400" className="life-wheel segmented-wheel">
        {zones.map((zone, index) => {
          const score = clampScore(scores[zone.label]);
          const colour = getScoreColour(score);

          const start = -90 + index * 45 + gap;
          const end = -90 + (index + 1) * 45 - gap;
          const mid = (start + end) / 2;

          const scoreRadius =
            innerRadius + ((maxRadius - innerRadius) * score) / 100;

          const labelPos = polar(center, center, 178, mid);
          const scorePos = polar(center, center, 104, mid);

          return (
            <g
              key={zone.label}
              className="wheel-zone"
              onClick={() => setActiveZone(zone.label)}
            >
              <path
                d={segmentPath(center, innerRadius, maxRadius, start, end)}
                className={
                  activeZone === zone.label ? "wheel-bg active" : "wheel-bg"
                }
              />

              {score > 0 && (
                <path
                  d={segmentPath(center, innerRadius, scoreRadius, start, end)}
                  fill={colour}
                  className={
                    activeZone === zone.label
                      ? "wheel-fill active"
                      : "wheel-fill"
                  }
                  style={{ animationDelay: `${index * 90}ms` }}
                />
              )}

              <text
                x={labelPos.x}
                y={labelPos.y - 9}
                textAnchor="middle"
                className="wheel-icon"
              >
                {zone.icon}
              </text>

              <text
                x={labelPos.x}
                y={labelPos.y + 10}
                textAnchor="middle"
                className={
                  activeZone === zone.label
                    ? "wheel-label active"
                    : "wheel-label"
                }
              >
                {zone.label}
              </text>

              <text
                x={scorePos.x}
                y={scorePos.y + 5}
                textAnchor="middle"
                className="wheel-score-inside"
              >
                {score}
              </text>
            </g>
          );
        })}

        <circle cx={center} cy={center} r="42" className="wheel-centre" />

        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          className="wheel-centre-text"
        >
          your
        </text>

        <text
          x={center}
          y={center + 13}
          textAnchor="middle"
          className="wheel-centre-text"
        >
          life
        </text>
      </svg>

      <div className="active-zone-card" style={{ borderColor: activeColour }}>
        <div className="active-zone-top">
          <span>{active.icon}</span>
          <strong>{active.label}</strong>
          <em style={{ color: activeColour }}>{activeScore}/100</em>
        </div>

        <div className="zone-status" style={{ color: activeColour }}>
          {activeStatus.label}
        </div>

        <p>{activeInsight}</p>

        <p className="encouragement">{activeStatus.encouragement}</p>
      </div>
    </div>
  );
}
