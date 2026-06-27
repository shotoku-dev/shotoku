"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { AirplaneIcon, type AirplaneIconHandle } from "./AirplaneIcon";

export default function NavbarRW() {
  const airplaneRef = useRef<AirplaneIconHandle>(null);

  return (
    <header className="fixed top-24 left-1/2 -translate-x-1/2 z-100 flex items-center gap-5 py-0 pl-0 pr-2 bg-black rounded-[18px] whitespace-nowrap overflow-hidden">
      <Link href="/">
        <Image
          src="/assets/brand/shotoku-logo-rw.svg"
          alt="Shotoku"
          width={52}
          height={52}
        />
      </Link>

      <nav className="flex items-center gap-0.5">
        <a href="/docs" className="px-2.5 py-2.5 text-[13px] font-medium text-white rounded-lg transition-colors duration-150 hover:bg-white/10">Docs</a>
        <a href="https://github.com/shotoku-dev/shotoku" target="_blank" rel="noopener noreferrer" className="px-2.5 py-2.5 text-[13px] font-medium text-white rounded-lg transition-colors duration-150 hover:bg-white/10">GitHub</a>
      </nav>

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
