import { Button, Icon, Sheet, TextField, Tooltip } from "@/components/ui";
import { useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { BrandMark } from "./brand-mark";
import { CopyPanel } from "./CopyPanel";

export type Page = "onboarding" | "today" | "overview" | "jobs" | "pipeline" | "mail" | "people" | "companies" | "criteria" | "profile" | "runs" | "agent" | "settings";

const NAV: { page: Page; label: string; icon: ComponentType }[] = [
  { page: "onboarding", label: "Get started", icon: Icon.Sparkles },
  { page: "today", label: "Today", icon: Icon.Star },
  { page: "overview", label: "Overview", icon: Icon.Home },
  { page: "jobs", label: "Jobs", icon: Icon.Inbox },
  { page: "pipeline", label: "Pipeline", icon: Icon.Layers },
  { page: "mail", label: "Mail", icon: Icon.Mail },
  { page: "people", label: "People", icon: Icon.Users },
  { page: "companies", label: "Sources", icon: Icon.Globe },
  { page: "criteria", label: "Criteria", icon: Icon.Filter },
  { page: "profile", label: "Profile", icon: Icon.User },
  { page: "runs", label: "Runs", icon: Icon.Refresh },
  { page: "agent", label: "Agent access", icon: Icon.Terminal },
  { page: "settings", label: "Settings", icon: Icon.Settings },
];

const TITLES: Record<Page, string> = { onboarding: "Get started", today: "Today", overview: "Overview", jobs: "Jobs", pipeline: "Pipeline", mail: "Mail", people: "People", companies: "Sources", criteria: "Criteria", profile: "Profile", runs: "Runs", agent: "Agent access", settings: "Settings" };

/** Sidebar groups, by intent: the work, the numbers, the setup, the machinery. */
const GROUPS: { title: string; pages: Page[] }[] = [
  { title: "Work", pages: ["today", "jobs", "pipeline", "mail", "people"] },
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
  children: ReactNode;
}

/** The frame every page sits in: sidebar navigation, a top bar with search and theme, and the content column. */
export function Shell({ page, onNavigate, onSearch, theme, onToggleTheme, onboarded = true, counts = {}, lastScan = "", children }: ShellProps) {
  const [drawer, setDrawer] = useState(false);
  // On a phone the sidebar is a horizontal strip of icons across the top: the collapsed navigation laid out in a
  // row, tooltips below. Between phone and desktop widths it is the drawer behind the menu button.
  const strip = useMediaQuery("(max-width: 40rem)");
  const [q, setQ] = useState("");
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
        <Navigation page={page} onNavigate={go} onboarded={onboarded} counts={counts} lastScan={lastScan} collapsed={collapsed || strip} onToggleCollapsed={strip ? undefined : toggleCollapsed} tipSide={strip ? "bottom" : "right"} />
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
                <Navigation page={page} onNavigate={go} onboarded={onboarded} counts={counts} lastScan={lastScan} collapsed={false} />
              </div>
            </Sheet.Content>
          </Sheet>
          <h1 className="topbar__title">{TITLES[page]}</h1>
          <form className="topbar__search" onSubmit={submit}>
            <TextField size="sm" placeholder="Search company or role" aria-label="Search jobs" leadingIcon={<Icon.Search />} trailingIcon={<span className="num">⌘K</span>} value={q} onChange={(e) => setQ(e.target.value)} />
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

function Navigation({ page, onNavigate, onboarded, counts, lastScan, collapsed, onToggleCollapsed, tipSide = "right" }: { page: Page; onNavigate: (page: Page) => void; onboarded: boolean; counts: Partial<Record<Page, number>>; lastScan: string; collapsed: boolean; onToggleCollapsed?: () => void; tipSide?: "right" | "bottom" }) {
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
                  aria-label={collapsed ? item.label : undefined}
                  onClick={() => onNavigate(item.page)}
                >
                  {collapsed ? null : item.label}
                </Button>
              );
              return collapsed ? <Tooltip key={item.page} content={counts[item.page] != null ? `${item.label} · ${counts[item.page]}` : item.label} side={tipSide}>{button}</Tooltip> : button;
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
            <br /><a className="sidebar__legal" href="https://tekjobs.timurtek.com/legal/terms" target="_blank" rel="noreferrer">Terms</a> · <a className="sidebar__legal" href="https://tekjobs.timurtek.com/legal/privacy" target="_blank" rel="noreferrer">Privacy</a>
          </div>
        </div>
      )}
    </>
  );
}
