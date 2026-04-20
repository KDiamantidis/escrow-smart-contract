"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface SpotlightProps {
  className?: string;
  size?: number;
}

export function Spotlight({ className, size = 480 }: SpotlightProps) {
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseX = useSpring(-9999, { stiffness: 220, damping: 28, mass: 0.6 });
  const mouseY = useSpring(-9999, { stiffness: 220, damping: 28, mass: 0.6 });

  const x = useTransform(mouseX, (v) => v - size / 2);
  const y = useTransform(mouseY, (v) => v - size / 2);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-hidden
    >
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          x,
          y,
          background:
            "radial-gradient(circle, rgba(98,126,234,0.25) 0%, rgba(98,126,234,0.10) 35%, rgba(98,126,234,0.00) 70%)",
          filter: "blur(6px)",
        }}
        animate={{ opacity: hovered ? 0.9 : 0.65 }}
        transition={{ duration: 0.25 }}
      />
    </div>
  );
}
