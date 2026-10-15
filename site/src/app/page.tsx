import type { Metadata } from "next";
import { Boundary } from "@/sections/Boundary";
import { Demo } from "@/sections/Demo";
import { GetStarted } from "@/sections/GetStarted";
import { Hero } from "@/sections/Hero";
import { HowItWorks } from "@/sections/HowItWorks";
import { PostAJob } from "@/sections/PostAJob";
import { Proof } from "@/sections/Proof";
import { Requirements } from "@/sections/Requirements";
import { Screens } from "@/sections/Screens";
import { WhoFor } from "@/sections/WhoFor";
import { AUTHOR, NPM, REPO } from "@/content";
import { appUrl, purchasesOpen } from "@/lib/flags";
import { homeLd, jsonLd, pageMeta, SITE_DESCRIPTION } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "TekJobs: a job search that remembers who you are",
  description: SITE_DESCRIPTION,
  path: "/",
  // Next resolves image URLs against metadataBase but writes video URLs as given, so this one is absolute.
  openGraph: { videos: [{ url: new URL("/showreel/tekjobs-showreel.mp4", appUrl).href, width: 1920, height: 1080, type: "video/mp4" }] },
});

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(homeLd({ siteUrl: appUrl, repo: REPO, npm: NPM, author: AUTHOR })) }} />
      <Hero />
      <HowItWorks />
      <Demo />
      <Screens />
      <WhoFor />
      <Boundary />
      <PostAJob open={purchasesOpen} />
      <Proof />
      <Requirements />
      <GetStarted />
    </>
  );
}
