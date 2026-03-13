"use client";

import { motion } from "framer-motion";

type Props = {
  className?: string;
  size?: number;
};

/** Small magical cloud + star friend for Elle's world. Original, non-brand. */
export function CompanionElle({ className = "", size = 32 }: Props) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Soft cloud puff */}
        <motion.ellipse
          cx="20"
          cy="24"
          rx="12"
          ry="6"
          fill="rgb(255 250 255)"
          stroke="rgb(220 200 230)"
          strokeWidth="1"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 2 }}
        />
        <motion.ellipse
          cx="14"
          cy="22"
          rx="6"
          ry="5"
          fill="rgb(255 253 255)"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 2.2 }}
        />
        <motion.ellipse
          cx="26"
          cy="22"
          rx="6"
          ry="5"
          fill="rgb(255 253 255)"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 2.1 }}
        />
        {/* Tiny star sparkle */}
        <motion.path
          d="M20 8l1.5 4.5L26 14l-4.5 1.5L20 20l-1.5-4.5L14 14l4.5-1.5L20 8z"
          fill="rgb(255 218 235)"
          initial={{ opacity: 0.6, rotate: 0 }}
          animate={{ opacity: 1, rotate: 360 }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
        />
      </motion.svg>
    </motion.div>
  );
}
