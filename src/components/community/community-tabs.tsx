import { TabLinks } from "@/components/layout/tab-links";

const TABS = [
  { href: "/community", label: "Activity" },
  { href: "/ranking", label: "Leaderboard" },
  { href: "/members", label: "Members" },
  { href: "/clubs", label: "Clubs" },
];

/** One sub-navigation shared by every community page, so they read as one section. */
export function CommunityTabs({ active }: { active: string }) {
  return <TabLinks tabs={TABS} active={active} />;
}
