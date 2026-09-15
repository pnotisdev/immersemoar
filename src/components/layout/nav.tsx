"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChartNoAxesColumn,
  Compass,
  House,
  Library,
  LogOut,
  Moon,
  Settings,
  Sun,
  Target,
  Terminal,
  Timer,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ranking/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogSessionEntry } from "@/components/sessions/log-session-entry";

export interface NavUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra route prefixes that should light this link up. */
  also?: string[];
}

/**
 * Five destinations, nothing more. Everything else (log history, goals, texthooker,
 * settings) lives in the account menu, and logging has its own button.
 */
const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/library", label: "Library", icon: Library, also: ["/media"] },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/community", label: "Community", icon: Users, also: ["/ranking", "/clubs", "/members", "/u"] },
  { href: "/stats", label: "Stats", icon: ChartNoAxesColumn },
];

const MENU_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/log", label: "Session log", icon: Timer },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/texthooker", label: "Texthooker", icon: Terminal },
  { href: "/settings", label: "Settings", icon: Settings },
];

function useIsActive() {
  const pathname = usePathname();
  return (l: NavLink) =>
    [l.href, ...(l.also ?? [])].some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function Nav({ user }: { user: NavUser }) {
  const isActive = useIsActive();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/dashboard" className="shrink-0 font-semibold tracking-tight">
          immerse<span className="text-muted-foreground">moar</span>
        </Link>

        <nav className="ml-4 hidden items-center md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(l) ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LogSessionEntry />
          <AccountMenu user={user} />
        </div>
      </div>
    </header>
  );
}

function AccountMenu({ user }: { user: NavUser }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account"
            className="rounded-full ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          />
        }
      >
        <Avatar name={user.name} image={user.image} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid gap-0.5">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href={`/u/${user.id}`} />}>
            <User /> Your profile
          </DropdownMenuItem>
          {MENU_LINKS.map((l) => (
            <DropdownMenuItem key={l.href} render={<Link href={l.href} />}>
              <l.icon /> {l.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            closeOnClick={false}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile tab bar. Five targets, thumb-reachable, with logging in the middle. */
export function MobileTabs() {
  const isActive = useIsActive();
  const tabs = [LINKS[0], LINKS[1], LINKS[3], LINKS[4]];

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-1 pt-1.5">
        {tabs.slice(0, 2).map((l) => (
          <Tab key={l.href} link={l} active={isActive(l)} />
        ))}
        <div className="flex justify-center">
          <LogSessionEntry compact />
        </div>
        {tabs.slice(2).map((l) => (
          <Tab key={l.href} link={l} active={isActive(l)} />
        ))}
      </div>
    </nav>
  );
}

function Tab({ link, active }: { link: NavLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] transition-colors",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "text-primary")} strokeWidth={active ? 2.4 : 1.8} />
      {link.label}
    </Link>
  );
}
