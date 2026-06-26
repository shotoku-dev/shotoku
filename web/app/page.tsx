import Navbar from "./components/Navbar";
import HeroPlayground from "./components/HeroPlayground";
import StackingCardsSection from "./components/StackingCardsSection";
import InstallButton from "./components/InstallButton";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="pt-[52px]">
        <section className="px-64 pt-20 pb-8 flex flex-col gap-10">
          <h1 className="text-[2.625rem] font-medium tracking-tight leading-[1.15] text-balance text-left text-[#0A0A0A] max-w-[60%]" style={{ fontFamily: "Satoshi, sans-serif" }}>
            See, approve and audit what your agents do.
          </h1>
          <div className="flex items-center justify-start gap-3">
            <InstallButton />
            <a
              href="https://github.com/shotoku-dev/shotoku"
              className="px-4 py-2 text-[13px] font-medium text-[#0A0A0A] bg-black/5 rounded-[10px] transition-[background-color,scale] duration-150 ease-out hover:bg-black/10 active:scale-[0.96]"
            >
              View GitHub
            </a>
          </div>

          <HeroPlayground />
        </section>

        <StackingCardsSection />
      </main>
    </>
  );
}
