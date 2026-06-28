export default function PageFooter() {
  return (
    <footer className="px-64 pt-10 pb-8 flex flex-col gap-8" style={{ fontFamily: "Satoshi, sans-serif" }}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-0.5">
          <img src="/assets/brand/shotoku-logo-rw.svg" alt="Shotoku" width={44} height={44} style={{ marginLeft: -8 }} />
          <span className="text-[17px] font-medium text-[#0A0A0A] tracking-tight">Shotoku</span>
        </div>
        <span className="text-[13px] text-[rgba(0,0,0,0.5)]">Local-first authorization layer for AI agents.</span>
      </div>
      <div className="flex items-center">
        <span className="text-xs text-[rgba(0,0,0,0.4)] flex items-center gap-2 flex-1">
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, position: "relative", flexShrink: 0 }}>
            <span style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", border: "1.5px solid #22c55e", animation: "ring-expand 2.4s ease-out infinite" }} />
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "block", flexShrink: 0 }} />
          </span>
          All systems operational
        </span>
        <div className="flex items-center gap-4 text-xs text-[rgba(0,0,0,0.35)] flex-1 justify-center">
          <a href="/privacy" className="hover:text-[#0A0A0A] transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="/license" className="hover:text-[#0A0A0A] transition-colors">MIT License</a>
        </div>
        <span className="text-xs text-[rgba(0,0,0,0.25)] flex-1 text-right">© Shotoku 2026</span>
      </div>
    </footer>
  );
}
