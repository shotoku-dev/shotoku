"use client";

import { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ShineBorderProps {
  children: ReactNode;
  className?: string;
  shineColor?: string | string[];
  duration?: number;
  borderWidth?: number;
  borderRadius?: number;
}

export function ShineBorder({
  children,
  className,
  shineColor = "#ffffff",
  duration = 14,
  borderWidth = 1.5,
  borderRadius = 6,
}: ShineBorderProps) {
  const colors = Array.isArray(shineColor) ? shineColor.join(", ") : shineColor;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ padding: borderWidth, borderRadius: borderRadius + borderWidth } as CSSProperties}
    >
      {/* Rotating conic gradient — clipped to show only the border gap */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: "200%",
          height: "200%",
          top: "-50%",
          left: "-50%",
          background: `conic-gradient(from var(--border-angle), transparent 0%, transparent 70%, ${colors}, transparent 90%)`,
          animation: `shine-border ${duration}s linear infinite`,
        } as CSSProperties}
      />
      {/* Card content — sits above the gradient */}
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          borderRadius,
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
