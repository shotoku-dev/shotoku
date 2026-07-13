import Navbar from "./components/Navbar";
import HeroPlayground from "./components/HeroPlayground";
import StackingCardsSection from "./components/StackingCardsSection";
import CTARow from "./components/CTARow";
import FAQSection from "./components/FAQSection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="pt-[52px]">
        <section className="px-6 sm:px-16 lg:px-64 pt-20 pb-8 flex flex-col gap-10">
          <h1 className="text-[1.625rem] sm:text-[2rem] lg:text-[2.625rem] font-medium tracking-tight leading-[1.15] text-balance text-left text-[#0A0A0A] max-w-full lg:max-w-[60%]" style={{ fontFamily: "Satoshi, sans-serif" }}>
            Give your agents a budget, not your card.
          </h1>
          <p className="text-[15px] sm:text-[16px] leading-[1.6] max-w-[480px] -mt-5" style={{ fontFamily: "Satoshi, sans-serif", color: "rgba(0,0,0,0.5)" }}>
            Budgets, approvals, and a tamper-evident audit trail for AI agent
            spending — enforced before the payment happens, entirely on your
            machine. Deterministic. No custody.
          </p>
          <CTARow githubLabel="GitHub" />
          <HeroPlayground />
        </section>

        <StackingCardsSection />

        <FAQSection />

        <section className="px-6 sm:px-16 lg:px-64 pt-8 pb-4 flex flex-col gap-4">
          <p className="text-[1.125rem] sm:text-[1.25rem] lg:text-[1.5rem] font-medium tracking-tight leading-[1.2] text-[#0A0A0A]" style={{ fontFamily: "Satoshi, sans-serif" }}>
            Your agents are already spending.
            <span className="text-[rgba(0,0,0,0.35)]"> Set the limits.</span>
          </p>
          <CTARow />
        </section>
      </main>
      <Footer />
    </>
  );
}
