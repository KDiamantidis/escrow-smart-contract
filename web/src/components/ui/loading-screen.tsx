"use client";

import { AnimatePresence, motion } from "framer-motion";

interface LoadingScreenProps {
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative flex h-28 w-28 items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0%, rgba(180,190,205,0.35) 40%, transparent 80%)",
                maskImage: "radial-gradient(transparent 60%, black 61%)",
                WebkitMaskImage: "radial-gradient(transparent 60%, black 61%)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.07) 100%)",
                maskImage: "radial-gradient(transparent 60%, black 61%)",
                WebkitMaskImage: "radial-gradient(transparent 60%, black 61%)",
              }}
            />
            <motion.svg
              viewBox="0 0 40 40"
              className="h-12 w-12"
              animate={{ scale: [1, 1.04, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <polygon
                points="20,4 32,20 20,24"
                fill="rgba(255,255,255,0.22)"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
              <polygon
                points="8,20 20,24 20,36"
                fill="rgba(255,255,255,0.10)"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
              <polygon
                points="32,20 20,24 20,36"
                fill="rgba(255,255,255,0.16)"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
              <polygon
                points="8,20 20,4 20,24"
                fill="rgba(255,255,255,0.08)"
                stroke="rgba(255,255,255,0.30)"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
            </motion.svg>
          </div>

          <motion.p
            className="mt-8 font-mono text-[11px] uppercase tracking-[0.35em]"
            style={{ color: "rgba(255,255,255,0.28)" }}
            animate={{ opacity: [0.28, 0.55, 0.28] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            Loading
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
