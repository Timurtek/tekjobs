import { Boundary } from "@/sections/Boundary";
import { GetStarted } from "@/sections/GetStarted";
import { Hero } from "@/sections/Hero";
import { HowItWorks } from "@/sections/HowItWorks";
import { Proof } from "@/sections/Proof";
import { Requirements } from "@/sections/Requirements";
import { Screens } from "@/sections/Screens";

export default function Page() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Screens />
      <Boundary />
      <Proof />
      <Requirements />
      <GetStarted />
    </>
  );
}
