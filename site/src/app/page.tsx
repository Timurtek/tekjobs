import { Boundary } from "@/sections/Boundary";
import { GetStarted } from "@/sections/GetStarted";
import { Hero } from "@/sections/Hero";
import { HowItWorks } from "@/sections/HowItWorks";
import { PostAJob } from "@/sections/PostAJob";
import { Proof } from "@/sections/Proof";
import { Requirements } from "@/sections/Requirements";
import { Screens } from "@/sections/Screens";
import { purchasesOpen } from "@/lib/flags";

export default function Page() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Screens />
      <Boundary />
      <PostAJob open={purchasesOpen} />
      <Proof />
      <Requirements />
      <GetStarted />
    </>
  );
}
