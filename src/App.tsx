import { useState } from "react";
import "./App.css";

type Step = "landing" | "onboarding" | "conversation";

type Message = {
  role: "assistant" | "user";
  text: string;
};

export default function App() {
  const [step, setStep] = useState<Step>("landing");
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Before we build your Wheel of Life, let’s slow things down a little. What feels most messy or heavy in your life right now?",
    },
  ]);

  function sendMessage() {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: "user",
      text: message.trim(),
    };

    async function sendMessage() {
  if (!message.trim()) return;

  const updatedMessages: Message[] = [
    ...messages,
    { role: "user", text: message.trim() },
  ];

  setMessages(updatedMessages);
  setMessage("");

  try {
    const response = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
  }
}

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setMessage("");
  }

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
          </div>

          <div className="chat-input">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type what’s on your mind..."
            />

            <button type="button" onClick={sendMessage}>
              Send
            </button>
          </div>
        </section>
      )}
    </main>
  );
}