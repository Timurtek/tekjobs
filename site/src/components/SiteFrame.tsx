"use client";
import { Toast, Tooltip } from "@/components/ui";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Nav } from "@/sections/Nav";
import { AUTHOR, REPO, ZENGIN } from "@/content";

type Theme = "light" | "dark";

/** The theme lives on <html> so the tokens flow into portals as well as the page; the head script set it before paint. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === "light" || stamped === "dark") setTheme(stamped);
  }, []);
  const toggle = () => setTheme((t) => {
    const next = t === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("tekjobs-theme", next); } catch { /* private mode: the choice still applies for this visit */ }
    return next;
  });
  return [theme, toggle];
}

/** The frame every page sits in: the nav, the page, the footer, and the providers the components need. */
export function SiteFrame({ children }: { children: ReactNode }) {
  const [theme, toggleTheme] = useTheme();
  return (
    <AuthProvider>
      <Tooltip.Provider>
        <Toast.Provider position="bottom-right">
          <div className="site">
            <Nav theme={theme} onToggleTheme={toggleTheme} />
            <main>{children}</main>
            <footer className="footer">
              <div className="wrap footer__inner">
                <span>TekJobs is MIT licensed. Notes are the record.</span>
                <span className="footer__links">
                  <a href={REPO} target="_blank" rel="noreferrer">github.com/Timurtek/tekjobs</a>
                  <a href={ZENGIN} target="_blank" rel="noreferrer">built on Zengin</a>
                  <a href={AUTHOR} target="_blank" rel="noreferrer">timurtek.com</a>
                </span>
              </div>
            </footer>
          </div>
        </Toast.Provider>
      </Tooltip.Provider>
    </AuthProvider>
  );
}
