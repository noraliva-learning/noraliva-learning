"use client";

import { motion } from "framer-motion";

type Props = {
  className?: string;
  size?: number;
};

/** Small stylized prehistoric leaf/explorer accent for Liv's world. Original, non-brand. */
export function CompanionLiv({ className = "", size = 32 }: Props) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Stylized fern / prehistoric leaf */}
        <motion.path
          d="M20 6c-4 4-8 10-8 16 0 4 2 8 6 10 2-6 4-12 4-18 0 6 2 12 4 18 4-2 6-6 6-10 0-6-4-12-8-16z"
          fill="rgb(100 150 110)"
          stroke="rgb(80 120 90)"
          strokeWidth="1"
          strokeLinejoin="round"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 2.5 }}
        />
        {/* Small explorer dot */}
        <motion.circle
          cx="20"
          cy="12"
          r="3"
          fill="rgb(160 180 120)"
          initial={{ y: 0 }}
          animate={{ y: [0, 2, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      </motion.svg>
    </motion.div>
  );
}
