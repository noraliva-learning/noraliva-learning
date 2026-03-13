"use client";

import { motion } from "framer-motion";

type Props = {
  className?: string;
};

/** Small sparkle burst for success states. Original, minimal. */
export function SuccessSparkle({ className = "" }: Props) {
  return (
    <span className={`pointer-events-none inline-block ${className}`} aria-hidden>
      <motion.span
        className="absolute inline-block text-lg"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        ✨
      </motion.span>
      <motion.span
        className="absolute inline-block text-sm"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
      >
        ☆
      </motion.span>
    </span>
  );
}
