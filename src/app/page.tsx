import styles from "@/components/landing/Landing.module.css";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { TrustBar } from "@/components/landing/TrustBar";
import { Problem } from "@/components/landing/Problem";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <main>
      <div className={styles.lpInner}>
        <LandingNav />
        <Hero />
      </div>
      <TrustBar />
      <Problem />
      <HowItWorks />
      <FeatureCards />
      <LandingFooter />
    </main>
  );
}
