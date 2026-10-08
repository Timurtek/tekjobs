import { Button, Icon, Sheet, TextField, Tooltip } from "@/components/ui";
import { useEffect, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { BrandMark } from "./brand-mark";
import { CopyPanel } from "./CopyPanel";

/** The search shortcut, for the keyboard in front of the person: ⌘K on a Mac, Ctrl K elsewhere. The hint showed ⌘K everywhere and nothing was bound to it; a QA pass on Windows caught both. */
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SEARCH_HINT = IS_MAC ? "⌘K" : "Ctrl K";

export type Page = "onboarding" | "today" | "overview" | "jobs" | "pipeline" | "mail" | "calendar" | "people" | "companies" | "criteria" | "profile" | "runs" | "agent" | "settings";

const NAV: { page: Page; label: string; icon: ComponentType }[] = [
  { page: "onboarding", label: "Get started", icon: Icon.Sparkles },
  { page: "today", label: "Today", icon: Icon.Star },
  { page: "overview", label: "Overview", icon: Icon.Home },
  { page: "jobs", label: "Jobs", icon: Icon.Inbox },
  { page: "pipeline", label: "Pipeline", icon: Icon.Layers },
  { page: "mail", label: "Mail", icon: Icon.Mail },
  { page: "calendar", label: "Calendar", icon: Icon.Calendar },
  { page: "people", label: "People", icon: Icon.Users },
  { page: "companies", label: "Sources", icon: Icon.Globe },
  { page: "criteria", label: "Criteria", icon: Icon.Filter },
  { page: "profile", label: "Profile", icon: Icon.User },
  { page: "runs", label: "Runs", icon: Icon.Refresh },
  { page: "agent", label: "Agent access", icon: Icon.Terminal },
  { page: "settings", label: "Settings", icon: Icon.Settings },
];

const TITLES: Record<Page, string> = { onboarding: "Get started", today: "Today", overview: "Overview", jobs: "Jobs", pipeline: "Pipeline", mail: "Mail", calendar: "Calendar", people: "People", companies: "Sources", criteria: "Criteria", profile: "Profile", runs: "Runs", agent: "Agent access", settings: "Settings" };

/** Sidebar groups, by intent: the work, the numbers, the setup, the machinery. */
const GROUPS: { title: string; pages: Page[] }[] = [
  { title: "Work", pages: ["today", "jobs", "pipeline", "mail", "calendar", "people"] },
  { title: "Insights", pages: ["overview"] },
  { title: "Setup", pages: ["profile", "criteria", "companies"] },
  { title: "System", pages: ["runs", "agent", "settings", "onboarding"] },
];

interface ShellProps {
  page: Page;
  onNavigate: (page: Page) => void;
  onSearch: (q: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** Once onboarding is complete, Get started leaves the top of the navigation and sits under System. */
  onboarded?: boolean;
  /** Counts beside nav items (today's queue, open matches, boards) and the last scan, for the footer. */
  counts?: Partial<Record<Page, number>>;
  lastScan?: string;
  /** Whose search this is; null until the summary answers. */
  who?: { name: string; dir: string; folder: string } | null;
  children: ReactNode;
}

/** The frame every page sits in: sidebar navigation, a top bar with search and theme, and the content column. */
/** "Maya's search": the first name, possessive, or a nickname given in quotes. A name ending in s takes the apostrophe alone. */
export function possessive(name: string) {
  const nick = name.match(/["“]([^"”]+)["”]/);
  const first = (nick?.[1] ?? name.trim().split(/\s+/)[0] ?? "").trim();
  return /s$/i.test(first) ? `${first}'` : `${first}'s`;
}

export function Shell({ page, onNavigate, onSearch, theme, onToggleTheme, onboarded = true, counts = {}, lastScan = "", who = null, children }: ShellProps) {
  const [drawer, setDrawer] = useState(false);
  // On a phone the sidebar is a horizontal strip of icons across the top: the collapsed navigation laid out in a
  // row, tooltips below. Between phone and desktop widths it is the drawer behind the menu button.
  const strip = useMediaQuery("(max-width: 40rem)");
  const [q, setQ] = useState("");
  const searchForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(IS_MAC ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      const input = searchForm.current?.querySelector("input");
      input?.focus();
      input?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // The sidebar collapses to an icon strip; the choice is this browser's own.
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("tekjobs.sidebar") === "collapsed"; } catch { return false; } });
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem("tekjobs.sidebar", c ? "open" : "collapsed"); } catch { /* fine */ } return !c; });
  const go = (p: Page) => {
    onNavigate(p);
    setDrawer(false);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(q.trim());
  };

  return (
    <div className={`shell${collapsed ? " shell--collapsed" : ""}${strip ? " shell--strip" : ""}`}>
      <aside className="sidebar" aria-label="Primary">
        <Navigation page={page} onNavigate={go} onboarded={onboarded} counts={counts} lastScan={lastScan} who={who} collapsed={collapsed || strip} strip={strip} onToggleCollapsed={strip ? undefined : toggleCollapsed} tipSide={strip ? "bottom" : "right"} />
      </aside>

      <div className="main">
        <header className="topbar">
          <Sheet open={drawer} onOpenChange={setDrawer} side="left" size="sm">
            <Sheet.Trigger asChild>
              <Button className="topbar__menu" variant="ghost" size="sm" aria-label="Open navigation" leadingIcon={<Icon.Menu />} />
            </Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Title>Navigation</Sheet.Title>
              <div className="sidebar sidebar--sheet">
                <Navigation page={page} onNavigate={go} onboarded={onboarded} counts={counts} lastScan={lastScan} who={who} collapsed={false} />
              </div>
            </Sheet.Content>
          </Sheet>
          <h1 className="topbar__title">{TITLES[page]}</h1>
          <form className="topbar__search" onSubmit={submit} ref={searchForm}>
            <TextField size="sm" placeholder="Search company or role" aria-label="Search jobs" leadingIcon={<Icon.Search />} trailingIcon={<span className="num">{SEARCH_HINT}</span>} value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="topbar__actions">
            <CopyPanel />
            <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
              <Button variant="ghost" size="sm" onClick={onToggleTheme} aria-label="Toggle theme" leadingIcon={theme === "light" ? <Icon.Moon /> : <Icon.Sun />} />
            </Tooltip>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function Navigation({ page, onNavigate, onboarded, counts, lastScan, who, collapsed, strip = false, onToggleCollapsed, tipSide = "right" }: { page: Page; onNavigate: (page: Page) => void; onboarded: boolean; counts: Partial<Record<Page, number>>; lastScan: string; who: ShellProps["who"]; collapsed: boolean; /** The phone strip: icons with their labels beside them, no tooltips, no counts. */ strip?: boolean; onToggleCollapsed?: () => void; tipSide?: "right" | "bottom" }) {
  const byPage = new Map(NAV.map((n) => [n.page, n]));
  // Before onboarding is done, Get started leads on its own; after, it is a System item.
  const groups = onboarded ? GROUPS : [{ title: "Start", pages: ["onboarding"] as Page[] }, ...GROUPS.map((g) => ({ ...g, pages: g.pages.filter((p) => p !== "onboarding") }))];
  return (
    <>
      <div className="brand">
        <BrandMark />
        {onToggleCollapsed && (
          <Tooltip content={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}>
            <Button className="sidebar__collapse" variant="ghost" size="sm" tone="neutral" aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"} leadingIcon={collapsed ? <Icon.ChevronRight /> : <Icon.ChevronLeft />} onClick={onToggleCollapsed} />
          </Tooltip>
        )}
      </div>
      {/* Whose search this is. Two profiles on one machine (the sample, a test persona, a second person) look the same otherwise. */}
      {who && (() => {
        const title = who.name ? `${possessive(who.name)} search` : "Your search";
        const initials = (who.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
        return (
          <div className={collapsed ? "sidebar__who sidebar__who--collapsed" : "sidebar__who"} role="note" aria-label={`${title}, profile folder ${who.dir}`} title={who.dir}>
            {collapsed ? <span className="sidebar__who-initials num" aria-hidden="true">{initials}</span> : (
              <>
                <span className="sidebar__who-name">{title}</span>
                <span className="sidebar__who-dir num">{who.folder}</span>
              </>
            )}
          </div>
        );
      })()}
      <nav className="nav" aria-label="Pages">
        {groups.map((g) => (
          <div key={g.title} className="nav__group">
            {!collapsed && <div className="nav__group-title">{g.title}</div>}
            {g.pages.map((p) => byPage.get(p)).filter((i): i is (typeof NAV)[number] => !!i).map((item) => {
              const button = (
                <Button
                  key={item.page}
                  className="nav__item"
                  align="start"
                  variant={page === item.page ? "soft" : "ghost"}
                  tone={page === item.page ? "primary" : "neutral"}
                  size="sm"
                  leadingIcon={<item.icon />}
                  trailingIcon={!collapsed && counts[item.page] != null ? <span className="nav__count">{counts[item.page]}</span> : undefined}
                  aria-current={page === item.page ? "page" : undefined}
                  aria-label={collapsed && !strip ? item.label : undefined}
                  onClick={() => onNavigate(item.page)}
                >
                  {collapsed && !strip ? null : item.label}
                </Button>
              );
              return collapsed && !strip ? <Tooltip key={item.page} content={counts[item.page] != null ? `${item.label} · ${counts[item.page]}` : item.label} side={tipSide}>{button}</Tooltip> : button;
            })}
          </div>
        ))}
      </nav>
      {!collapsed && (
        <div className="sidebar__foot">
          <div>
            Notes are the record.
            {lastScan && <><br /><span className="num">{lastScan}</span></>}
            <br /><span className="num">v{__APP_VERSION__}</span>
            <br />by <a className="sidebar__legal" href="https://www.timurtek.com" target="_blank" rel="noreferrer">timurtek.com</a>
            <br /><a className="sidebar__legal" href="https://tekjobs.timurtek.com/legal/terms" target="_blank" rel="noreferrer">Terms</a> · <a className="sidebar__legal" href="https://tekjobs.timurtek.com/legal/privacy" target="_blank" rel="noreferrer">Privacy</a>
          </div>
        </div>
      )}
    </>
  );
}
