"use client";
import { Avatar, Button, Icon, Menu } from "@/components/ui";
import { useAuth } from "./AuthProvider";

/**
 * The signed-in person's corner of the nav: their avatar (Google photo, or initials from the name or email)
 * opening a menu with their postings, the account page, and sign out. Renders nothing signed out, so the
 * Post a job button stays the one call to action.
 */
export function AccountMenu() {
  const auth = useAuth();
  if (!auth.configured || !auth.user) return null;
  const u = auth.user;
  const name = u.displayName || u.email || "Account";
  const go = (href: string) => () => window.location.assign(href);
  return (
    <Menu>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Account menu for ${name}`}>
          <Avatar src={u.photoURL || undefined} name={name} size="sm" />
        </Button>
      </Menu.Trigger>
      <Menu.Content align="end">
        <Menu.Label>{u.email || name}</Menu.Label>
        <Menu.Item leadingIcon={<Icon.Layers />} onSelect={go("/app/post-a-job")}>Your postings</Menu.Item>
        <Menu.Item leadingIcon={<Icon.Plus />} onSelect={go("/app/post-a-job/new")}>New posting</Menu.Item>
        <Menu.Item leadingIcon={<Icon.User />} onSelect={go("/account")}>Account</Menu.Item>
        <Menu.Separator />
        <Menu.Item tone="danger" leadingIcon={<Icon.LogOut />} onSelect={() => { auth.signOut().then(go("/")); }}>Sign out</Menu.Item>
      </Menu.Content>
    </Menu>
  );
}
