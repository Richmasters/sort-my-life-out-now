import type { Zone } from "./lifePicture";

export type AffiliateResource = {
  id: string;
  zone: Zone["label"];
  title: string;
  description: string;
  category: string;
  url: string;
  isAffiliate: boolean;
};

export const affiliateDisclosure =
  "Some resource links may be affiliate links. They help support the app, but suggestions are chosen to be useful first.";

export const affiliateResources: AffiliateResource[] = [
  {
    id: "mind-journal",
    zone: "Mind",
    title: "Guided journal",
    description: "A quiet place to untangle thoughts and notice patterns.",
    category: "Reflection",
    url: "#",
    isAffiliate: true,
  },
  {
    id: "body-sleep",
    zone: "Body",
    title: "Sleep support",
    description: "Simple tools for building a steadier wind-down routine.",
    category: "Rest",
    url: "#",
    isAffiliate: true,
  },
  {
    id: "money-budget",
    zone: "Money",
    title: "Budget tracker",
    description: "A practical way to see what is coming in and going out.",
    category: "Money",
    url: "#",
    isAffiliate: true,
  },
  {
    id: "life-admin-tasks",
    zone: "Life Admin",
    title: "Task manager",
    description: "A lightweight system for getting loose ends out of your head.",
    category: "Organisation",
    url: "#",
    isAffiliate: true,
  },
];

export function getResourcesForZone(zone: Zone["label"]) {
  return affiliateResources.filter((resource) => resource.zone === zone);
}
