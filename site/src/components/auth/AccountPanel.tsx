"use client";
import { Badge, Button, Card, Table } from "@/components/ui";
import { useAuth } from "./AuthProvider";
import type { Entitlement } from "@/server/entitlements";

export function AccountPanel({ email, uid, entitlements }: { email: string | null; uid: string; entitlements: Entitlement[] }) {
  const auth = useAuth();
  return (
    <div className="stack">
      <Card padding="lg">
        <div className="authcard">
          <h1 className="authcard__title">Account</h1>
          <p className="muted">{email || "No email on this account"} <span className="mono">· {uid}</span></p>
          <div className="hero__actions">
            <Button variant="soft" size="sm" onClick={() => auth.signOut().then(() => window.location.assign("/"))}>Sign out</Button>
          </div>
        </div>
      </Card>
      <Card padding={entitlements.length ? "none" : "lg"}>
        {entitlements.length === 0 ? (
          <p className="muted">No purchases yet. Job posting opens soon.</p>
        ) : (
          <Table aria-label="Purchases" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>What</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>When</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {entitlements.map((e) => (
                <Table.Row key={e.id}>
                  <Table.Cell>{e.sku}</Table.Cell>
                  <Table.Cell><Badge size="sm" tone={e.status === "active" ? "success" : e.status === "refunded" ? "danger" : "neutral"}>{e.status}</Badge></Table.Cell>
                  <Table.Cell><span className="mono">{e.createdAt.slice(0, 10)}</span></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
    </div>
  );
}
