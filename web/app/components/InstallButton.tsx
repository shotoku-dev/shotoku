"use client";

import { useRef, useCallback } from "react";
import { DownloadIcon, type DownloadIconHandle } from "./icons/DownloadIcon";

export default function InstallButton() {
  const iconRef = useRef<DownloadIconHandle>(null);

  const handleMouseEnter = useCallback(() => iconRef.current?.startAnimation(), []);
  const handleMouseLeave = useCallback(() => iconRef.current?.stopAnimation(), []);

  return (
    <a
      href="#install"
      className="px-4 py-2 text-[13px] font-medium text-white rounded-[10px] flex items-center gap-1.5 transition-[background-color,scale] duration-150 ease-out hover:bg-[var(--brand-red-deep)] active:scale-[0.96]"
      style={{ background: "var(--brand-red)" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      Install Shotoku
      <DownloadIcon ref={iconRef} size={14} style={{ display: "flex", alignItems: "center" }} />
    </a>
  );
}
