export type Step =
  | "landing"
  | "onboarding"
  | "conversation"
  | "analysing"
  | "wheel"
  | "actionPlan";

export type Message = {
  role: "assistant" | "user";
  text: string;
};

export type Onboarding = {
  name: string;
  ageRange: string;
  currentFeeling: string;
  pressureArea: string;
  helpWanted: string;
};

export type Result = {
  scores: Record<string, number>;
  insights?: Record<string, string>;
  quickWins: string[];
};

export type ActionPlan = {
  title: string;
  subtitle: string;
  openingNote: string;
  patternSummary: string;
  priorities: {
    title: string;
    detail: string;
  }[];
  weeks: {
    week: number;
    theme: string;
    focus: string;
    whyThisWeek: string;
    actions: {
      title: string;
      detail: string;
      firstStep: string;
    }[];
    reflectionPrompt: string;
    encouragement: string;
  }[];
  closingNote: string;
};

export type Zone = {
  label: string;
  icon: string;
};

export type CoverageState = "unexplored" | "forming" | "clear";
export type ConversationPhase = "exploring" | "finalCheck" | "ready";
export type CoverageMap = Record<string, CoverageState>;

export const zones: Zone[] = [
  { label: "Mind", icon: "\u{1F9E0}" },
  { label: "Body", icon: "\u{1F4AA}" },
  { label: "Money", icon: "\u{1F4B0}" },
  { label: "Work", icon: "\u{1F4BC}" },
  { label: "Love", icon: "\u2764\uFE0F" },
  { label: "Home", icon: "\u{1F3E0}" },
  { label: "Life Admin", icon: "\u{1F5C2}\uFE0F" },
  { label: "Purpose", icon: "\u{1F31F}" },
];

export const initialCoverage: CoverageMap = {
  Mind: "unexplored",
  Body: "unexplored",
  Money: "unexplored",
  Work: "unexplored",
  Love: "unexplored",
  Home: "unexplored",
  "Life Admin": "unexplored",
  Purpose: "unexplored",
};

export function getScoreColour(score: number) {
  if (score <= 33) return "#dc2626";
  if (score <= 67) return "#f59e0b";
  return "#16a34a";
}

export function getScoreStatus(score: number) {
  if (score <= 33) {
    return {
      label: "Needs attention",
      message:
        "This area looks like it is carrying real pressure at the moment. That does not mean failure - it simply means this may be one of the best places to start gently.",
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

export function clampScore(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return 50;
  if (value <= 10) return Math.round(value * 10);
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateAverage(scores: Record<string, number>) {
  const values = zones.map((zone) => clampScore(scores[zone.label]));
  return Math.round(
    values.reduce((total, score) => total + score, 0) / values.length
  );
}

export function getLowestZone(scores: Record<string, number>) {
  return zones.reduce((lowest, zone) => {
    const score = clampScore(scores[zone.label]);
    const lowestScore = clampScore(scores[lowest.label]);
    return score < lowestScore ? zone : lowest;
  }, zones[0]);
}

export function getFocusOrder(scores: Record<string, number>) {
  return [...zones].sort(
    (a, b) => clampScore(scores[a.label]) - clampScore(scores[b.label])
  );
}

export function polar(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number
) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
}

export function segmentPath(
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

export function getCoverageLabel(state: CoverageState) {
  if (state === "clear") return "Clear enough";
  if (state === "forming") return "Taking shape";
  return "Not explored yet";
}

export function normaliseCoverage(value: unknown): CoverageMap {
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

export function normalisePhase(value: unknown): ConversationPhase {
  if (value === "finalCheck" || value === "ready") return value;
  return "exploring";
}
