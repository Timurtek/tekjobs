import { Toast, Tooltip } from "@/components/ui";
import { useEffect, useState } from "react";
import { api } from "./api";
import { Shell, type Page } from "./components/Shell";
import { Agent } from "./views/Agent";
import { Companies } from "./views/Companies";
import { Criteria } from "./views/Criteria";
import { Jobs } from "./views/Jobs";
import { Mail } from "./views/Mail";
import { Onboarding } from "./views/Onboarding";
import { Overview } from "./views/Overview";
import { People } from "./views/People";
import { Today } from "./views/Today";
import { Pipeline } from "./views/Pipeline";
import { Profile } from "./views/Profile";
import { Runs } from "./views/Runs";
import { Settings } from "./views/Settings";

type Theme = "light" | "dark";

/** The theme lives on <html> so the tokens flow into portals (menus, sheets, toasts) as well as the page. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === "light" || stamped === "dark") return stamped;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

/** Page and the jobs search live in the URL hash, so a filtered view is a link you can keep. */
function useRoute(): [Page, string, (page: Page, q?: string) => void] {
  const parse = () => {
    const [p, qs] = window.location.hash.replace(/^#\/?/, "").split("?");
    const page = (["onboarding", "today", "overview", "jobs", "pipeline", "mail", "people", "companies", "criteria", "profile", "runs", "agent", "settings"].includes(p ?? "") ? p : "today") as Page;
    return { page, q: new URLSearchParams(qs).get("q") ?? "" };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (page: Page, q?: string) => {
    window.location.hash = q ? `/${page}?q=${encodeURIComponent(q)}` : `/${page}`;
  };
  return [route.page, route.q, go];
}

export function App() {
  const [page, q, go] = useRoute();
  const [theme, toggleTheme] = useTheme();
  const [onboarded, setOnboarded] = useState(true);
  const [counts, setCounts] = useState<Partial<Record<Page, number>>>({});
  const [lastScan, setLastScan] = useState("");
  // A fresh profile lands on Get started; once every step is done Today is home, because the decisions are
  // the point and the inventory is not.
  useEffect(() => {
    api.onboarding().then((o) => { setOnboarded(o.complete); if (!o.complete && !window.location.hash) go("onboarding"); }).catch(() => {});
  }, []);
  // The counts beside Today, Jobs and Companies, and the footer's last scan; refreshed on every page change.
  useEffect(() => {
    api.summary().then((s) => {
      setCounts((c) => ({ ...c, jobs: s.open, companies: s.companies }));
      if (s.lastRun) setLastScan(`Last scan ${s.lastRun.when.slice(11, 16)} · ${s.lastRun.boardsOk}/${s.lastRun.boardsTotal} boards`);
    }).catch(() => {});
    api.today().then((t) => setCounts((c) => ({ ...c, today: t.sections.triage.length }))).catch(() => {});
    api.mail().then((m) => setCounts((c) => ({ ...c, mail: m.groups.length }))).catch(() => {});
  }, [page]);
  return (
    <Tooltip.Provider>
      <Toast.Provider position="bottom-right">
        <Shell page={page} onNavigate={(p) => go(p)} onSearch={(text) => go("jobs", text)} theme={theme} onToggleTheme={toggleTheme} onboarded={onboarded} counts={counts} lastScan={lastScan}>
          <div key={page} className="page z-enter-fade">
            {page === "onboarding" && <Onboarding onDone={() => go("overview")} />}
            {page === "today" && <Today onNavigate={go} />}
            {page === "overview" && <Overview onNavigate={go} />}
            {page === "jobs" && <Jobs initialQuery={q} />}
            {page === "pipeline" && <Pipeline />}
            {page === "mail" && <Mail />}
            {page === "people" && <People />}
            {page === "companies" && <Companies />}
            {page === "criteria" && <Criteria />}
            {page === "profile" && <Profile />}
            {page === "runs" && <Runs />}
            {page === "agent" && <Agent />}
            {page === "settings" && <Settings />}
          </div>
        </Shell>
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
