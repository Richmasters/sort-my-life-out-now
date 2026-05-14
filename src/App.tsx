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

const lifeAreas = zones.map((zone) => zone.label);

const fallbackResult: Result = {
  scores: {
    Mind: 42,
    Body: 55,
    Money: 28,
    Work: 40,
    Love: 68,
    Home: 52,
    "Life Admin": 31,
    Purpose: 45,
  },
  quickWins: [
    "Choose one small life-admin task and finish it today.",
    "Take a 10-minute walk before trying to solve everything.",
    "Write down the three things causing the most pressure.",
    "Send one honest message to someone you trust.",
    "Pick tomorrow’s first task before bed tonight.",
  ],
};

function normaliseScore(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 50;

  if (value <= 10) {
    return Math.round(value * 10);
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function getScoreStatus(score: number) {
  if (score <= 33) {
    return {
      label: "Needs attention",
      color: "#C2410C",
      message:
        "This area looks like it needs some care. That does not mean failure — it simply means this may be one of the best places to start gently.",
    };
  }

  if (score <= 67) {
    return {
      label: "Developing",
      color: "#D97706",
      message:
        "There is something to work with here. This area is not broken, but it could probably feel lighter, steadier or more organised with a few focused changes.",
    };
  }

  return {
    label: "Strong area",
    color: "#15803D",
    message:
      "This looks like one of your stronger areas. It is worth noticing what is already working here, because those habits or supports may help other parts of life too.",
  };
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
            {lifeAreas.map((area) => (
              <span key={area}>{area}</span>
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

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeSegment(
  center: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarToCartesian(center, center, outerRadius, startAngle);
  const outerEnd = polarToCartesian(center, center, outerRadius, endAngle);
  const innerEnd = polarToCartesian(center, center, innerRadius, endAngle);
  const innerStart = polarToCartesian(center, center, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function getScoreColour(score: number) {
  if (score <= 33) return "#dc2626";   // red
  if (score <= 67) return "#f59e0b";   // amber
  return "#16a34a";                   // green
}

function getScoreStatus(score: number) {
  if (score <= 33) {
    return {
      label: "Needs attention",
      message:
        "This area looks like it’s carrying pressure. That doesn’t mean failure — it simply means this is a good place to start gently.",
      encouragement:
        "Start small. Even one simple action here can create noticeable relief.",
    };
  }

  if (score <= 67) {
    return {
      label: "Building",
      message:
        "There is something to work with here. This area isn’t broken, but it could feel steadier or lighter with a bit of focus.",
      encouragement:
        "A couple of small improvements here could compound quickly.",
    };
  }

  return {
    label: "Strong",
    message:
      "This looks like one of your stronger areas. Something here is working well for you.",
    encouragement:
      "Notice what’s working — you may be able to apply that elsewhere.",
    };
  }
}

function LifeWheel({ scores }: { scores: Record<string, number> }) {
  const [activeZone, setActiveZone] = useState("Mind");

  const zones = [
    { label: "Mind", icon: "🧠" },
    { label: "Body", icon: "💪" },
    { label: "Money", icon: "💰" },
    { label: "Work", icon: "💼" },
    { label: "Love", icon: "❤️" },
    { label: "Home", icon: "🏠" },
    { label: "Life Admin", icon: "🗂️" },
    { label: "Purpose", icon: "🌟" },
  ];

  const center = 200;
  const innerRadius = 50;
  const maxRadius = 150;
  const gap = 3;

  function polar(cx: number, cy: number, r: number, angle: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function arc(
    innerR: number,
    outerR: number,
    start: number,
    end: number
  ) {
    const a = polar(center, center, outerR, start);
    const b = polar(center, center, outerR, end);
    const c = polar(center, center, innerR, end);
    const d = polar(center, center, innerR, start);

    return `
      M ${a.x} ${a.y}
      A ${outerR} ${outerR} 0 0 1 ${b.x} ${b.y}
      L ${c.x} ${c.y}
      A ${innerR} ${innerR} 0 0 0 ${d.x} ${d.y}
      Z
    `;
  }

  const active = zones.find((z) => z.label === activeZone)!;
  const score = Math.max(0, Math.min(100, scores[active.label] || 50));
  const status = getScoreStatus(score);

  return (
    <div className="life-wheel-wrap">
      <svg viewBox="0 0 400 400" className="life-wheel">
        {zones.map((zone, i) => {
          const raw = Math.max(0, Math.min(100, scores[zone.label] || 50));
          const colour = getScoreColour(raw);

          const start = -90 + i * 45 + gap;
          const end = -90 + (i + 1) * 45 - gap;

          const outer =
            innerRadius + ((maxRadius - innerRadius) * raw) / 100;

          const path = arc(innerRadius, outer, start, end);

          const mid = (start + end) / 2;
          const labelPos = polar(center, center, 180, mid);

          return (
            <g
              key={zone.label}
              onClick={() => setActiveZone(zone.label)}
              className="wheel-zone"
            >
              <path d={arc(innerRadius, maxRadius, start, end)}
                    className="wheel-bg" />

              {raw > 0 && (
                <path
                  d={path}
                  fill={colour}
                  className="wheel-fill"
                  style={{
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              )}

              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                className="wheel-label"
              >
                {zone.icon} {zone.label}
              </text>
            </g>
          );
        })}

        <circle cx={center} cy={center} r="40" className="wheel-centre" />
      </svg>

      <div className="active-zone-card">
        <h3>
          {active.label} — {score}/100
        </h3>

        <strong>{status.label}</strong>

        <p>{status.message}</p>

        <p className="encouragement">{status.encouragement}</p>
      </div>
    </div>
  );
}