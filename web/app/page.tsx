import Navbar from "./components/Navbar";
import HeroPlayground from "./components/HeroPlayground";
import StackingCardsSection from "./components/StackingCardsSection";
import CTARow from "./components/CTARow";
import FAQSection from "./components/FAQSection";
import PageFooter from "./components/PageFooter";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="pt-[52px]">
        <section className="px-6 sm:px-16 lg:px-64 pt-20 pb-8 flex flex-col gap-10">
          <h1 className="text-[1.625rem] sm:text-[2rem] lg:text-[2.625rem] font-medium tracking-tight leading-[1.15] text-balance text-left text-[#0A0A0A] max-w-full lg:max-w-[60%]" style={{ fontFamily: "Satoshi, sans-serif" }}>
            See, approve and audit what your agents do.
          </h1>
          <CTARow githubLabel="GitHub" />
          <HeroPlayground />
        </section>

        <StackingCardsSection />

        <FAQSection />

        <section className="px-6 sm:px-16 lg:px-64 pt-8 pb-20 flex flex-col gap-4">
          <p className="text-[1.125rem] sm:text-[1.25rem] lg:text-[1.5rem] font-medium tracking-tight leading-[1.2] text-[#0A0A0A]" style={{ fontFamily: "Satoshi, sans-serif" }}>
            Your agents are already acting.
            <span className="text-[rgba(0,0,0,0.35)]"> Start with why.</span>
          </p>
          <CTARow />
        </section>
      </main>

      <PageFooter />
    </>
  );
}
