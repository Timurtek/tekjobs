import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { safeNext } from "@/lib/next";
import { currentIdentity } from "@/server/auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/** Sign in, then go where you were headed (`?next=/app/post-a-job`). Already signed in, you never see this page. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentIdentity()) redirect(next);
  return (
    <section className="section">
      <div className="wrap narrow">
        <AuthCard next={next} />
      </div>
    </section>
  );
}
