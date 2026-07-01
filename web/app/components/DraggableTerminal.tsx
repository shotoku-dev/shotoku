"use client";

import { motion, useDragControls } from "motion/react";
import { useRef } from "react";

export default function DraggableTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[75vh] rounded-lg overflow-hidden"
      style={{ background: "#F5F0E8" }}
    >
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={containerRef}
        dragElastic={0}
        dragMomentum={false}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className="w-[520px] rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(0,0,0,0.08)" }}
        >
          {/* Header — drag handle */}
          <div
            className="relative flex items-center px-2 py-2 cursor-grab active:cursor-grabbing select-none"
            style={{ background: "#F2F1ED", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#CAC8C4" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#CAC8C4" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#CAC8C4" }} />
            </div>
            <span className="absolute left-1/2 -translate-x-1/2 text-[12px] font-normal" style={{ color: "rgba(0,0,0,0.45)" }}>
              Research Agent
            </span>
          </div>

          {/* Body */}
          <div className="h-72" style={{ background: "#F7F7F4" }} />
        </div>
      </motion.div>
    </div>
  );
}
