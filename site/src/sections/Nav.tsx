"use client";
import { Button, Icon, Separator, Sheet, Tooltip } from "@/components/ui";
import { useState } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { useAuth } from "@/components/auth/AuthProvider";
import { NAV, REPO } from "@/content";

const EXTERNAL = { target: "_blank", rel: "noreferrer" } as const;

/**
 * Wide: the section links run inline. Narrower: they fold into a sheet behind a menu button. The mark is the
 * author's avatar, as on the app's first design. Sign in appears only once Firebase is configured.
 */
export function Nav({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  const [open, setOpen] = useState(false);
  const auth = useAuth();
  return (
    <header className="nav">
      <div className="nav__inner">
        <a className="nav__mark" href="/" aria-label="TekJobs, home">
          <img className="nav__avatar" src="/brand/tekjobs-avatar-192.png" alt="" width={36} height={36} />
          <span className="nav__wordmark">
            <span>Tek<span className="nav__accent">Jobs</span></span>
            <small>Local-first job search</small>
          </span>
        </a>
        <nav aria-label="Sections">
          <ul className="nav__links">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} {...(item.external ? EXTERNAL : {})}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav__end">
          <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
            <Button variant="ghost" size="sm" onClick={onToggleTheme} aria-label="Toggle theme" leadingIcon={theme === "light" ? <Icon.Moon /> : <Icon.Sun />} />
          </Tooltip>
          <Button className="nav__github" asChild variant="ghost" size="sm">
            <a href={REPO} {...EXTERNAL}>GitHub</a>
          </Button>
          <Button className="nav__post" asChild tone="primary" size="sm">
            <a href="/post-a-job">Post a job</a>
          </Button>
          <AccountMenu />
          <Sheet open={open} onOpenChange={setOpen} side="right" size="sm">
            <Sheet.Trigger asChild>
              <Button className="nav__menu" variant="ghost" size="sm" aria-label="Open menu" leadingIcon={<Icon.Menu />} />
            </Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Title>TekJobs</Sheet.Title>
              <Sheet.Description>Sections of this page, the docs, and where the code lives.</Sheet.Description>
              <nav aria-label="Sections">
                <ul className="nav__sheet">
                  {NAV.map((item) => (
                    <li key={item.href}>
                      <a href={item.href} onClick={() => setOpen(false)} {...(item.external ? EXTERNAL : {})}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
              <Separator />
              <ul className="nav__sheet">
                <li><a href="/post-a-job" onClick={() => setOpen(false)}>Post a job</a></li>
                {auth.configured && auth.user && <li><a href="/app/post-a-job" onClick={() => setOpen(false)}>Your postings</a></li>}
                {auth.configured && auth.user && <li><a href="/account" onClick={() => setOpen(false)}>Account</a></li>}
                {auth.configured && auth.user && <li><a href="/" onClick={(e) => { e.preventDefault(); setOpen(false); auth.signOut().then(() => window.location.assign("/")); }}>Sign out</a></li>}
              </ul>
            </Sheet.Content>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
