import { useState, useRef, useEffect } from "react";
import "./App.css";

type Step = "landing" | "onboarding" | "conversation" | "wheel";

type Message = {
  role: "assistant" | "user";
  text: string;
};

const wheelScores = [
  { label: "Mind", icon: "🧠", score: 4 },
  { label: "Body", icon: "💪", score: 5 },
  { label: "Money", icon: "💰", score: 3 },
  { label: "Work", icon: "💼", score: 4 },
  { label: "Love", icon: "❤️", score: 6 },
  { label: "Home", icon: "🏠", score: 5 },
  { label: "Life Admin", icon: "🗂️", score: 3 },
  { label: "Purpose", icon: "🌟", score: 4 },
];

const quickWins = [
  "Choose one life-admin task and finish it today.",
  "Take a 10-minute walk before making any big decisions.",
  "Write down every subscription, bill, or recurring payment.",
  "Send one honest message to someone you trust.",
  "Pick tomorrow’s first task before you go to bed tonight.",
];

export default function App() {
  const [step, setStep] = useState<Step>("landing");
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);

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
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.text,
          })),
        }),
      });

      const data = await response.json();

      const aiReply =
        data?.choices?.[0]?.message?.content ||
        "Something went wrong. Try again.";

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

  const canRevealWheel = messages.filter((m) => m.role === "user").length >= 3;

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
              <input placeholder="Your first name" />
            </label>

            <label>
              Age range
              <select>
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
              <select>
                <option>Overwhelming</option>
                <option>Stuck</option>
                <option>Busy but okay</option>
                <option>Changing</option>
                <option>Mostly good, but could be better</option>
              </select>
            </label>

            <label>
              Biggest pressure area
              <select>
                <option>Mind</option>
                <option>Body</option>
                <option>Money</option>
                <option>Work</option>
                <option>Love</option>
                <option>Home</option>
                <option>Life admin</option>
                <option>Purpose</option>
              </select>
            </label>

            <label>
              What would you like help with?
              <textarea placeholder="A sentence or two is enough..." />
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
          <h2>Let’s sort through this properly.</h2>

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

          {canRevealWheel && (
            <button className="reveal-button" onClick={() => setStep("wheel")}>
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

      {step === "wheel" && (
        <section className="card wheel-card">
          <p className="eyebrow">Your Life Audit</p>
          <h2>Here’s the first clear picture.</h2>

          <div className="wheel-grid">
            {wheelScores.map((item) => (
              <div className="score-card" key={item.label}>
                <div className="score-icon">{item.icon}</div>
                <div>
                  <strong>{item.label}</strong>
                  <div className="score-bar">
                    <span style={{ width: `${item.score * 10}%` }} />
                  </div>
                </div>
                <em>{item.score}/10</em>
              </div>
            ))}
          </div>

          <div className="quick-wins">
            <h3>Your five quick wins</h3>
            {quickWins.map((win, index) => (
              <div className="quick-win" key={win}>
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