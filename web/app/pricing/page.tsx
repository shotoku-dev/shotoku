import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import PricingSection from "../components/PricingSection";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Pricing — Shotoku",
  description:
    "Shotoku's core authorization engine is free and open source, forever. Team and Enterprise plans add collaboration and governance on top.",
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[52px]">
        <section className="px-6 pt-20 pb-12 flex flex-col items-center gap-4 text-center">
          <h1
            className="text-[1.625rem] sm:text-[2rem] font-medium tracking-tight leading-[1.15] text-[#0A0A0A]"
            style={{ fontFamily: "Satoshi, sans-serif" }}
          >
            Open source at the core.
          </h1>
          <p
            className="text-[15px] leading-[1.6] max-w-[440px]"
            style={{ fontFamily: "Satoshi, sans-serif", color: "rgba(0,0,0,0.5)" }}
          >
            Authorization for your agents runs free on your machine.
            Pay when your team needs shared control.
          </p>
        </section>

        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
