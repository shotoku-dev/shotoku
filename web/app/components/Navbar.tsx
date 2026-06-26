"use client";

import Image from "next/image";
import { useRef } from "react";
import { AirplaneIcon, type AirplaneIconHandle } from "./AirplaneIcon";

export default function Navbar() {
  const airplaneRef = useRef<AirplaneIconHandle>(null);

  return (
    <header className="fixed top-5 left-1/2 -translate-x-1/2 z-100 flex items-center gap-5 py-0 pl-0 pr-2 bg-black rounded-[18px] whitespace-nowrap overflow-hidden">
      <div className="flex items-center">
        <Image
          src="/assets/brand/shotoku-logo-rw.svg"
          alt="Shotoku"
          width={52}
          height={52}
        />

        <nav className="flex items-center gap-0.5">
          <a href="/docs" className="px-2.5 py-2.5 text-[13px] font-medium text-white/50 transition-colors duration-150 hover:text-white/80">Docs</a>
          <a href="/examples" className="px-2.5 py-2.5 text-[13px] font-medium text-white/50 transition-colors duration-150 hover:text-white/80">Examples</a>
          <a href="https://github.com/shotoku-dev/shotoku" className="px-2.5 py-2.5 text-[13px] font-medium text-white/50 transition-colors duration-150 hover:text-white/80">GitHub</a>
        </nav>
      </div>

      <a
        href="#install"
        className="ml-auto px-3 py-2 text-[13px] font-medium text-white flex items-center gap-1.5 rounded-[10px] transition-[background-color,scale] duration-150 ease-out active:scale-[0.96]"
        style={{ background: "#E54B4B" }}
        onMouseEnter={() => airplaneRef.current?.startAnimation()}
        onMouseLeave={() => airplaneRef.current?.stopAnimation()}
      >
        Start Building
        <AirplaneIcon ref={airplaneRef} size={15} />
      </a>
    </header>
  );
}
