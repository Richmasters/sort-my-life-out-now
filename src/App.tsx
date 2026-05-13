import { useState } from "react";
import "./App.css";

type Step = "landing" | "onboarding";

export default function App() {
  const [step, setStep] = useState<Step>("landing");

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

            <button type="button">Continue to conversation</button>
          </form>
        </section>
      )}
    </main>
  );
}