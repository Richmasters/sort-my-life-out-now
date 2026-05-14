import { useEffect, useRef, useState } from "react";
import "./App.css";

type Step = "landing" | "onboarding" | "conversation" | "analysing" | "wheel";

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
  quickWins: string[];
};

type Zone = {
  label: string;
  icon: string;
};

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
  quickWins: [
    "Choose one small life-admin task and finish it today.",
    "Take a 10-minute walk before trying to solve everything.",
    "Write down the three things causing the most pressure.",
    "Send one honest message to someone you trust.",
    "Pick tomorrow’s first task before bed tonight.",
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

export default function App() {
  const [step, setStep] = useState<Step>("landing");
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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
What they want help with: ${onboarding.helpWanted || "Not given"}

Use this naturally. Do not list it back mechanically.
    `.trim();
  }

  async function sendMessage() {
    if (!message.trim() || isThinking) return;

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
        }),
      });

      const data = await response.json();

      const aiReply =
        data?.choices?.[0]?.message?.content ||
        "I’m here with you. Tell me a little more about what feels hardest right now.";

      setMessages((current) => [
        ...current,
        { role: "assistant", text: aiReply },
      ]);
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

  const canReveal = messages.filter((m) => m.role === "user").length >= 3;

  return (
    <main className="app">
      {step === "landing" && (
        <section className="card hero landing-card">
          <p className="eyebrow">Sort My Life Out Now</p>

          <h1>
            A calmer way to understand your <em>whole life</em>.
          </h1>

          <p className="intro">
            Have a warm, intelligent conversation about what’s really going on.
            Then get your personal Wheel of Life, five quick wins, and a clearer
            sense of what to do next.
          </p>

          <div className="hero-actions">
            <button onClick={() => setStep("onboarding")}>
              Start your life audit
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
                Reveal your Wheel of Life, then leave with five practical quick
                wins you can actually do.
              </p>
            </div>
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
                onChange={(e) =>
                  setOnboarding({ ...onboarding, name: e.target.value })
                }
                placeholder="Your first name"
              />
            </label>

            <label>
              Age range
              <select
                value={onboarding.ageRange}
                onChange={(e) =>
                  setOnboarding({ ...onboarding, ageRange: e.target.value })
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
                onChange={(e) =>
                  setOnboarding({
                    ...onboarding,
                    currentFeeling: e.target.value,
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
                onChange={(e) =>
                  setOnboarding({
                    ...onboarding,
                    pressureArea: e.target.value,
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
              What would you like help with?
              <textarea
                value={onboarding.helpWanted}
                onChange={(e) =>
                  setOnboarding({
                    ...onboarding,
                    helpWanted: e.target.value,
                  })
                }
                placeholder="A sentence or two is enough..."
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

          <div className="messages">
            {messages.map((item, index) => (
              <div key={index} className={`message ${item.role}`}>
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

          {canReveal && (
            <button className="reveal-button" onClick={analyseLife}>
              Reveal my Wheel of Life
            </button>
          )}

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
        </section>
      )}

      {step === "analysing" && (
        <section className="card hero">
          <p className="eyebrow">Analysing your life</p>
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
        <section className="card wheel-card">
          <p className="eyebrow">Your Life Audit</p>

          <h2>
            {onboarding.name
              ? `Here’s the first clear picture, ${onboarding.name}.`
              : "Here’s the first clear picture."}
          </h2>

          <LifeWheel scores={result.scores} />

          <div className="quick-wins">
            <h3>Your five quick wins</h3>

            {result.quickWins.map((win, index) => (
              <div className="quick-win" key={`${win}-${index}`}>
                <span>{index + 1}</span>
                <p>{win}</p>
              </div>
            ))}
          </div>

          <button onClick={() => setStep("conversation")}>
            Continue the conversation
          </button>
        </section>
      )}
    </main>
  );
}

function LifeWheel({ scores }: { scores: Record<string, number> }) {
  const [activeZone, setActiveZone] = useState("Mind");

  const center = 200;
  const innerRadius = 50;
  const maxRadius = 150;
  const gap = 3;

  const active = zones.find((zone) => zone.label === activeZone) || zones[0];
  const activeScore = clampScore(scores[active.label]);
  const activeStatus = getScoreStatus(activeScore);
  const activeColour = getScoreColour(activeScore);

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

        <p>{activeStatus.message}</p>

        <p className="encouragement">{activeStatus.encouragement}</p>
      </div>
    </div>
  );
}