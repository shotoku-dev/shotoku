import Navbar from "./components/Navbar";
import HeroPlayground from "./components/HeroPlayground";

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
            <a
              href="#install"
              className="px-4 py-2 text-[13px] font-medium text-white rounded-[10px] flex items-center gap-1.5 transition-[background-color,scale] duration-150 ease-out hover:bg-[var(--brand-red-deep)] active:scale-[0.96]"
              style={{ background: "var(--brand-red)" }}
            >
              Install Shotoku
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.50005 1.04999C7.74858 1.04999 7.95005 1.25146 7.95005 1.49999V8.41359L10.1819 6.18179C10.3576 6.00605 10.6425 6.00605 10.8182 6.18179C10.994 6.35753 10.994 6.64245 10.8182 6.81819L7.81825 9.81819C7.64251 9.99392 7.35759 9.99392 7.18185 9.81819L4.18185 6.81819C4.00611 6.64245 4.00611 6.35753 4.18185 6.18179C4.35759 6.00605 4.64251 6.00605 4.81825 6.18179L7.05005 8.41359V1.49999C7.05005 1.25146 7.25152 1.04999 7.50005 1.04999ZM2.5 10C2.77614 10 3 10.2239 3 10.5V12C3 12.5539 3.44565 13 3.99635 13H11.0012C11.5529 13 12 12.5528 12 12V10.5C12 10.2239 12.2239 10 12.5 10C12.7761 10 13 10.2239 13 10.5V12C13 13.1041 12.1062 14 11.0012 14H3.99635C2.89019 14 2 13.103 2 12V10.5C2 10.2239 2.22386 10 2.5 10Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </a>
            <a
              href="https://github.com/shotoku-dev/shotoku"
              className="px-4 py-2 text-[13px] font-medium text-[#0A0A0A] bg-black/5 rounded-[10px] transition-[background-color,scale] duration-150 ease-out hover:bg-black/10 active:scale-[0.96]"
            >
              View GitHub
            </a>
          </div>

          <HeroPlayground />
        </section>
      </main>
    </>
  );
}
