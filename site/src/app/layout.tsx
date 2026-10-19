import "@/styles/index.css";
import "@/theme/brand.css";
import "@/site.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@/components/Analytics";
import { GoogleTag } from "@/components/GoogleTag";
import { SiteFrame } from "@/components/SiteFrame";
import { appUrl } from "@/lib/flags";
import { SHORT_DESCRIPTION, SITE_DESCRIPTION, SOCIAL_IMAGE } from "@/lib/seo";

const SITE_URL = new URL(appUrl);

// The defaults: a page that sets nothing (a 404) still gets these. Every public page sets its own with pageMeta.
export const metadata: Metadata = {
  title: { default: "TekJobs", template: "%s · TekJobs" },
  description: SITE_DESCRIPTION,
  metadataBase: SITE_URL,
  authors: [{ name: "Timurtek Bizel", url: "https://www.timurtek.com" }],
  creator: "Timurtek Bizel",
  publisher: "Timurtek LLC",
  icons: { icon: "/brand/tekjobs-avatar-192.png" },
  openGraph: { title: "TekJobs", description: SHORT_DESCRIPTION, siteName: "TekJobs", type: "website", images: [SOCIAL_IMAGE] },
  twitter: { card: "summary_large_image", title: "TekJobs", description: SHORT_DESCRIPTION, images: [SOCIAL_IMAGE.url] },
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
        <GoogleTag />
        <Analytics />
      </body>
    </html>
  );
}
