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

const fallbackResult: Result = {
  scores: {
    Mind: 4,
    Body: 5,
    Money: 3,
    Work: 4,
    Love: 6,
    Home: 5,
    "Life Admin": 3,
    Purpose: 4,
  },
  quickWins: [
    "Choose one small life-admin task and finish it today.",
    "Take a 10-minute walk before trying to solve everything.",
    "Write down the three things causing the most pressure.",
    "Send one honest message to someone you trust.",
    "Pick tomorrow’s first task before bed tonight.",
  ],
};

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

Use this context naturally. Do not list it back mechanically.
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
        <section className="card hero">
          <p className="eyebrow">Your Life Audit</p>

          <h1>
            Sort My Life Out <em>Now</em>
          </h1>

          <p className="intro">
            A calm, intelligent conversation that helps you understand what is
            actually going on in your life — and what to do next.
          </p>

          <button onClick={() => setStep("onboarding")}>
            Start your life audit
          </button>
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

  const zones = [
    { label: "Mind", icon: "🧠", color: "#8B5CF6" },
    { label: "Body", icon: "💪", color: "#16A34A" },
    { label: "Money", icon: "💰", color: "#D97706" },
    { label: "Work", icon: "💼", color: "#2563EB" },
    { label: "Love", icon: "❤️", color: "#E11D48" },
    { label: "Home", icon: "🏠", color: "#0D9488" },
    { label: "Life Admin", icon: "🗂️", color: "#7C3AED" },
    { label: "Purpose", icon: "🌟", color: "#C47C4E" },
  ];

  const center = 200;
  const maxRadius = 130;
  const active = zones.find((zone) => zone.label === activeZone) || zones[0];
  const activeScore = scores[active.label] || 5;

  const points = zones
    .map((zone, index) => {
      const score = Math.max(1, Math.min(10, scores[zone.label] || 5));
      const angle = -90 + index * 45;
      const radius = (score / 10) * maxRadius;
      const x = center + radius * Math.cos((angle * Math.PI) / 180);
      const y = center + radius * Math.sin((angle * Math.PI) / 180);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="life-wheel-wrap">
      <svg viewBox="0 0 400 400" className="life-wheel">
        {[2, 4, 6, 8, 10].map((ring) => (
          <circle
            key={ring}
            cx={center}
            cy={center}
            r={(ring / 10) * maxRadius}
            className="wheel-ring"
          />
        ))}

        {zones.map((zone, index) => {
          const score = Math.max(1, Math.min(10, scores[zone.label] || 5));
          const angle = -90 + index * 45;
          const radians = (angle * Math.PI) / 180;

          const axisX = center + maxRadius * Math.cos(radians);
          const axisY = center + maxRadius * Math.sin(radians);

          const pointX =
            center + ((score / 10) * maxRadius) * Math.cos(radians);
          const pointY =
            center + ((score / 10) * maxRadius) * Math.sin(radians);

          const labelX = center + 165 * Math.cos(radians);
          const labelY = center + 165 * Math.sin(radians);

          return (
            <g
              key={zone.label}
              className="wheel-zone"
              onClick={() => setActiveZone(zone.label)}
            >
              <line
                x1={center}
                y1={center}
                x2={axisX}
                y2={axisY}
                className="wheel-axis"
              />

              <circle
                cx={pointX}
                cy={pointY}
                r={activeZone === zone.label ? 9 : 6}
                fill={zone.color}
                className="wheel-point"
              />

              <text
                x={labelX}
                y={labelY - 8}
                textAnchor="middle"
                className="wheel-icon"
              >
                {zone.icon}
              </text>

              <text
                x={labelX}
                y={labelY + 13}
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
                x={labelX}
                y={labelY + 29}
                textAnchor="middle"
                className="wheel-score"
              >
                {score}/10
              </text>
            </g>
          );
        })}

        <polygon points={points} className="wheel-shape" />

        <circle cx={center} cy={center} r="30" className="wheel-centre" />
        <text
          x={center}
          y={center + 5}
          textAnchor="middle"
          className="wheel-centre-text"
        >
          your life
        </text>
      </svg>

      <div className="active-zone-card" style={{ borderColor: active.color }}>
        <div className="active-zone-top">
          <span>{active.icon}</span>
          <strong>{active.label}</strong>
          <em>{activeScore}/10</em>
        </div>

        <p>
          This area is currently scoring {activeScore}/10. Tap another part of
          the wheel to explore a different life zone.
        </p>
      </div>
    </div>
  );
}