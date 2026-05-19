import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Brain,
  BriefcaseBusiness,
  ClipboardList,
  Heart,
  Home,
  Sparkles,
  Wallet,
} from "lucide-react";
import "./App.css";
import {
  calculateAverage,
  clampScore,
  getCoverageLabel,
  getFocusOrder,
  getLowestZone,
  getScoreColour,
  getScoreStatus,
  initialCoverage,
  normaliseCoverage,
  normalisePhase,
  polar,
  segmentPath,
  zones,
} from "./domain/lifePicture";
import type {
  ActionPlan,
  ConversationPhase,
  CoverageMap,
  Message,
  Onboarding,
  Result,
  Step,
  ZoneIcon,
} from "./domain/lifePicture";

const zoneIcons = {
  brain: Brain,
  activity: Activity,
  wallet: Wallet,
  briefcase: BriefcaseBusiness,
  heart: Heart,
  home: Home,
  clipboard: ClipboardList,
  sparkles: Sparkles,
} satisfies Record<ZoneIcon, typeof Brain>;

function ZoneIconMark({
  icon,
  className,
}: {
  icon: ZoneIcon;
  className?: string;
}) {
  const Icon = zoneIcons[icon];
  return <Icon aria-hidden="true" className={className} strokeWidth={1.9} />;
}

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
  title: "Your 30-Day Life Reset",
  subtitle:
    "A calm, practical plan to reduce pressure, create clarity and build steadier momentum.",
  openingNote:
    "This is not a demand to overhaul your whole life at once. It is a carefully paced reset: first make things feel more manageable, then clear obvious friction, then build a rhythm that is easier to keep. Small moves, done with intention, can change the emotional weight of a month.",
  patternSummary:
    "From what you have shared, the biggest opportunity is to reduce the background pressure that makes everything else feel heavier. When mental noise, practical loose ends and uncertainty stack up together, even simple choices can start to feel draining.",
  priorities: [
    {
      title: "Create breathing room",
      detail:
        "Begin by reducing the sense that everything is urgent at once. A little prioritisation will make the next steps feel more possible.",
    },
    {
      title: "Clear one layer of friction",
      detail:
        "Choose practical tasks that have been quietly taking up space in your head and move a few of them to done.",
    },
    {
      title: "Build a gentler rhythm",
      detail:
        "Introduce small routines that support your energy and attention without becoming another source of pressure.",
    },
  ],
  weeks: [
    {
      week: 1,
      theme: "Stabilise",
      focus: "Make the immediate pressure feel more containable.",
      whyThisWeek:
        "The first week is about reducing overwhelm, not achieving perfection. You need a little more room to think before larger change becomes useful.",
      actions: [
        {
          title: "Name the three loudest pressures",
          detail:
            "Write down the three things taking up the most mental space right now. Keep it brutally simple; the point is to stop carrying them as a vague cloud.",
          firstStep: "Open a note and write the first pressure in one sentence.",
        },
        {
          title: "Finish one small, lingering task",
          detail:
            "Choose a task that has been creating background drag but can realistically be completed in one sitting. Finishing something contained can create a surprising amount of relief.",
          firstStep: "Pick the smallest task that would make you exhale when done.",
        },
        {
          title: "Protect one pocket of recovery",
          detail:
            "Create one short moment this week that is not for solving, catching up or performing. This is not indulgence; it helps reduce the sense of living in permanent reaction mode.",
          firstStep: "Block 20 minutes in your calendar with no obligation attached.",
        },
      ],
      reflectionPrompt:
        "At the end of the week, ask: what feels even slightly less noisy than it did seven days ago?",
      encouragement:
        "A better month starts with one part of life feeling a little less impossible.",
    },
    {
      week: 2,
      theme: "Clear friction",
      focus: "Deal with the things that keep tugging at your attention.",
      whyThisWeek:
        "Once there is a little more space, it becomes easier to tackle the practical knots that quietly drain confidence and energy.",
      actions: [
        {
          title: "Hold one focused admin session",
          detail:
            "Set aside a contained block of time for bills, forms, messages, bookings or overdue life admin. Do not try to solve all of it; aim to move the most irritating items forward.",
          firstStep: "Make a five-item admin list before the session starts.",
        },
        {
          title: "Review one source of avoidable pressure",
          detail:
            "Look at one commitment, cost, habit or unresolved obligation that no longer feels worth the weight it carries. Decide whether it needs action, a boundary or a clean ending.",
          firstStep: "Choose the one thing that keeps resurfacing in your mind.",
        },
        {
          title: "Say one clear thing you have been postponing",
          detail:
            "If an unspoken request, boundary or clarification is creating tension, prepare a simple honest version. It does not need to be dramatic to be freeing.",
          firstStep: "Draft the message before deciding whether to send it.",
        },
      ],
      reflectionPrompt:
        "What practical loose end felt bigger in your head than it did once you touched it?",
      encouragement:
        "Clearing friction is often less about effort than about finally giving one thing a proper place.",
    },
    {
      week: 3,
      theme: "Build rhythm",
      focus: "Create small repeatable supports for the life you want to feel.",
      whyThisWeek:
        "This week turns relief into steadiness. The goal is not a perfect routine; it is to make a few helpful behaviours easier to repeat.",
      actions: [
        {
          title: "Choose one weekly reset ritual",
          detail:
            "Create a short recurring slot to review tasks, calendar pressure and what matters next. A regular reset can stop life from building up silently.",
          firstStep: "Pick a day and time you could repeat most weeks.",
        },
        {
          title: "Create one energy-protecting boundary",
          detail:
            "Decide on one small limit that protects attention, rest or emotional bandwidth. It might be a work cut-off, a slower morning or less immediate responsiveness.",
          firstStep: "Finish the sentence: 'This week I am less available for…'",
        },
        {
          title: "Repeat the most helpful quick win",
          detail:
            "Return to the small action that created the most relief so far and make it part of your ordinary week. Repetition is where insight starts becoming change.",
          firstStep: "Identify the one action from Weeks 1–2 that actually helped.",
        },
      ],
      reflectionPrompt:
        "Which small behaviour is starting to make life feel more predictable or kinder?",
      encouragement:
        "A rhythm does not need to be impressive. It needs to make tomorrow slightly easier.",
    },
    {
      week: 4,
      theme: "Review and refine",
      focus: "Notice what shifted and choose what deserves continued attention.",
      whyThisWeek:
        "The final week is about learning from the month, not scoring yourself. Some things will have helped, others may need adjusting, and that is useful information.",
      actions: [
        {
          title: "Revisit your Life Picture",
          detail:
            "Look back at the areas that felt strongest and most strained. Notice what has changed in feeling, clarity or urgency, even if the numbers are not formally updated yet.",
          firstStep: "Write one sentence about what feels different from the start.",
        },
        {
          title: "Keep, adjust or release",
          detail:
            "Review the actions you tried and decide which ones are worth carrying forward. A plan earns its place by helping, not by demanding loyalty.",
          firstStep: "Make three headings: Keep, Adjust, Release.",
        },
        {
          title: "Choose your next focus",
          detail:
            "Name the one life area that would benefit most from another month of kind, practical attention. This prevents slipping back into 'everything at once.'",
          firstStep: "Pick one area, then write why it matters now.",
        },
      ],
      reflectionPrompt:
        "If the next month were shaped around one wiser decision from this month, what would it be?",
      encouragement:
        "Progress is not proving that life is fixed. It is noticing that you have more choice than before.",
    },
  ],
  closingNote:
    "You do not need to complete this perfectly for it to matter. The plan has done its job if it helps you feel a little clearer, a little less pinned down, and more able to choose your next move with intention.",
};;

export default function App() {
  const [step, setStep] = useState<Step>("landing");
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [coverage, setCoverage] = useState<CoverageMap>(initialCoverage);
  const [speakingMessage, setSpeakingMessage] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState("");
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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

  async function playAssistantMessage(text: string, index: number) {
    if (speakingMessage === index) {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeakingMessage(null);
      return;
    }

    audioRef.current?.pause();
    setSpeechError("");
    setSpeakingMessage(index);

    try {
      const response = await fetch("/.netlify/functions/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Speech request failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audioUrlsRef.current.push(audioUrl);
      audioRef.current = audio;

      audio.onended = () => setSpeakingMessage(null);
      audio.onerror = () => {
        setSpeakingMessage(null);
        setSpeechError("I could not play that reply just now.");
      };

      await audio.play();
    } catch {
      setSpeakingMessage(null);
      setSpeechError("Voice is not available just yet.");
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
                <p>{item.text}</p>
                {item.role === "assistant" && (
                  <button
                    type="button"
                    className="voice-button"
                    onClick={() => playAssistantMessage(item.text, index)}
                    aria-label={
                      speakingMessage === index
                        ? "Stop voice reply"
                        : "Play voice reply"
                    }
                  >
                    {speakingMessage === index ? "Stop" : "Listen"}
                  </button>
                )}
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

          {speechError && <p className="speech-error">{speechError}</p>}

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
        <section className="card results-card premium-plan-card">
          <div className="premium-plan-hero">
            <div className="premium-plan-kicker">
              <span>Premium reset plan</span>
              <em>30 days</em>
            </div>

            <h2>{actionPlan.title}</h2>

            <p className="premium-plan-subtitle">{actionPlan.subtitle}</p>

            <div className="premium-plan-meta">
              <span>
                Prepared for {onboarding.name || "you"}
              </span>
              <span>Built from your Life Picture</span>
              <span>Four focused weeks</span>
            </div>

            <div className="premium-plan-opening">
              <p>{actionPlan.openingNote}</p>
            </div>
          </div>

          <div className="premium-plan-timeline" aria-label="30-day plan timeline">
            {actionPlan.weeks.map((week) => (
              <div className="premium-timeline-item" key={`timeline-${week.week}`}>
                <span>{week.week}</span>
                <strong>{week.theme}</strong>
              </div>
            ))}
          </div>

          <div className="premium-plan-context">
            <section className="premium-pattern-card">
              <p className="eyebrow">What this plan is responding to</p>
              <h3>The pattern beneath the pressure</h3>
              <p>{actionPlan.patternSummary}</p>
            </section>

            <section className="premium-priorities-card">
              <p className="eyebrow">Your guiding priorities</p>
              <div className="premium-priority-list">
                {actionPlan.priorities.map((priority, index) => (
                  <div className="premium-priority-item" key={`${priority.title}-${index}`}>
                    <span>{index + 1}</span>
                    <div>
                      <h4>{priority.title}</h4>
                      <p>{priority.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="premium-plan-weeks">
            {actionPlan.weeks.map((week) => (
              <article className="premium-week-card" key={week.week}>
                <div className="premium-week-heading">
                  <span>
                    <em>Week</em>
                    {week.week}
                  </span>
                  <div>
                    <h3>{week.theme}</h3>
                    <p>{week.focus}</p>
                  </div>
                </div>

                <div className="premium-week-why">
                  <strong>Why this week matters</strong>
                  <p>{week.whyThisWeek}</p>
                </div>

                <div className="premium-action-list">
                  {week.actions.map((action, index) => (
                    <div className="premium-action-card" key={`${action.title}-${index}`}>
                      <span>{index + 1}</span>
                      <div>
                        <h4>{action.title}</h4>
                        <p>{action.detail}</p>
                        <small className="premium-first-step">
                          <strong>First step:</strong> {action.firstStep}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="premium-week-footer">
                  <div className="premium-reflection">
                    <strong>Reflection</strong>
                    <p>{week.reflectionPrompt}</p>
                  </div>

                  <div className="premium-encouragement">
                    <p>{week.encouragement}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="premium-plan-closing">
            <p className="eyebrow">A final note</p>
            <p>{actionPlan.closingNote}</p>
          </div>

          <div className="premium-plan-actions">
            <button onClick={() => setStep("wheel")}>Back to Life Picture</button>
          </div>
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
              <ZoneIconMark icon={zone.icon} className="coverage-pill-icon" />
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
                  <ZoneIconMark icon={zone.icon} className="focus-item-icon" />
                  {zone.label}
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
      <div className="life-wheel-stage">
        <svg
          viewBox="0 0 400 400"
          className="life-wheel segmented-wheel"
          aria-label="Life Picture score wheel"
        >
        {zones.map((zone, index) => {
          const score = clampScore(scores[zone.label]);
          const colour = getScoreColour(score);

          const start = -90 + index * 45 + gap;
          const end = -90 + (index + 1) * 45 - gap;
          const mid = (start + end) / 2;

          const scoreRadius =
            innerRadius + ((maxRadius - innerRadius) * score) / 100;

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

        <div className="wheel-zone-controls" aria-label="Life Picture areas">
          {zones.map((zone) => {
            const score = clampScore(scores[zone.label]);
            const isActive = activeZone === zone.label;

            return (
              <button
                type="button"
                className={
                  isActive ? "wheel-zone-control active" : "wheel-zone-control"
                }
                key={zone.label}
                onClick={() => setActiveZone(zone.label)}
              >
                <ZoneIconMark
                  icon={zone.icon}
                  className="wheel-zone-control-icon"
                />
                <span>{zone.label}</span>
                <em style={{ color: getScoreColour(score) }}>{score}</em>
              </button>
            );
          })}
        </div>
      </div>

      <div className="active-zone-card" style={{ borderColor: activeColour }}>
        <div className="active-zone-top">
          <span>
            <ZoneIconMark icon={active.icon} className="active-zone-icon" />
          </span>
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

