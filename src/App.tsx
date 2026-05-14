import { useState, useRef, useEffect } from "react";
import "./App.css";

type Step = "landing" | "onboarding" | "conversation" | "analysing" | "wheel";

type Message = {
  role: "assistant" | "user";
  text: string;
};

type Result = {
  scores: Record<string, number>;
  quickWins: string[];
};

export default function App() {
  const [step, setStep] = useState<Step>("landing");
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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

      setMessages((current) => [
        ...current,
        { role: "assistant", text: data.choices[0].message.content },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: "Something went wrong." },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  async function analyseLife() {
    setStep("analysing");

    const response = await fetch("/.netlify/functions/analyse", {
      method: "POST",
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.text,
        })),
      }),
    });

    const text = await response.text();

    try {
      const parsed = JSON.parse(text);
      setResult(parsed);
      setStep("wheel");
    } catch {
      console.error(text);
    }
  }

  const canReveal = messages.filter((m) => m.role === "user").length >= 3;

  return (
    <main className="app">
      {step === "landing" && (
        <section className="card hero">
          <h1>Sort My Life Out Now</h1>
          <button onClick={() => setStep("onboarding")}>
            Start your life audit
          </button>
        </section>
      )}

      {step === "onboarding" && (
        <section className="card">
          <h2>Let’s get a feel for where you are</h2>
          <button onClick={() => setStep("conversation")}>
            Continue
          </button>
        </section>
      )}

      {step === "conversation" && (
        <section className="card chat-card">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>
                {m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {canReveal && (
            <button onClick={analyseLife}>
              Reveal my Wheel of Life
            </button>
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button onClick={sendMessage}>Send</button>
        </section>
      )}

      {step === "analysing" && (
        <section className="card">
          <h2>Analysing your life...</h2>
          <p>This usually takes a few seconds</p>
        </section>
      )}

      {step === "wheel" && result && (
        <section className="card">
          <h2>Your Wheel of Life</h2>

          {Object.entries(result.scores).map(([key, value]) => (
            <div key={key}>
              {key}: {value}/10
            </div>
          ))}

          <h3>Quick wins</h3>
          {result.quickWins.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </section>
      )}
    </main>
  );
}