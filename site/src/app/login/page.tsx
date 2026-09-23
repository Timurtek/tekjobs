import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <section className="section">
      <div className="wrap narrow">
        <AuthCard />
      </div>
    </section>
  );
}
