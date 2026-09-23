import "@/styles/index.css";
import "@/theme/brand.css";
import "@/site.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFrame } from "@/components/SiteFrame";

export const metadata: Metadata = {
  title: { default: "TekJobs", template: "%s · TekJobs" },
  description: "A local-first job-search machine. It watches hundreds of company boards every day, scores every posting against a profile you own, and files the matches as markdown notes on your machine.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tekjobs.timurtek.com"),
  icons: { icon: "/brand/tekjobs-avatar-192.png" },
  openGraph: { title: "TekJobs", description: "A local-first job-search machine. Your notes are the record.", images: ["/brand/tekjobs-avatar-512.png"] },
};

// The theme is applied before paint from what the visitor chose last time, or the system's preference.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("tekjobs-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600&family=Azeret+Mono:wght@400;500&display=swap" data-zengin="fonts" precedence="default" />
      </head>
      <body>
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}
