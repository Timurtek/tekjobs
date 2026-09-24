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
import { purchasesOpen } from "@/lib/flags";

export default function Page() {
  return (
    <>
      <Hero />
      <Demo />
      <HowItWorks />
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
