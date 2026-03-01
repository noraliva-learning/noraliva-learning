"use client";

import { motion, AnimatePresence } from "framer-motion";

export type AceFaceMood =
  | "idle"
  | "thinking"
  | "happy"
  | "celebrating"
  | "encouraging";

const MOOD_CONFIG: Record<
  AceFaceMood,
  { emoji: string; label: string; className?: string }
> = {
  idle: { emoji: "😊", label: "Ace is ready" },
  thinking: { emoji: "🤔", label: "Ace is thinking" },
  happy: { emoji: "😄", label: "Ace is happy" },
  celebrating: { emoji: "🎉", label: "Great job!" },
  encouraging: { emoji: "💛", label: "You can try again" },
};

export interface AceFaceProps {
  mood?: AceFaceMood;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "text-4xl min-w-[3rem] min-h-[3rem]",
  md: "text-6xl min-w-[4.5rem] min-h-[4.5rem]",
  lg: "text-8xl min-w-[6rem] min-h-[6rem]",
};

export default function AceFace({
  mood = "idle",
  size = "lg",
  className = "",
}: AceFaceProps) {
  const config = MOOD_CONFIG[mood];
  const isCelebrating = mood === "celebrating";
  const isHappy = mood === "happy";
  const isThinking = mood === "thinking";
  const isEncouraging = mood === "encouraging";

  return (
    <div
      className={`flex flex-col items-center justify-center ${sizeClasses[size]} ${className}`}
      role="img"
      aria-label={config.label}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={mood}
          initial={{ scale: 0.8, opacity: 0.6 }}
          animate={{
            scale: 1,
            opacity: 1,
            ...(isHappy || isCelebrating
              ? {
                  y: [0, -8, 0],
                  transition: {
                    y: {
                      repeat: Infinity,
                      duration: 0.8,
                      ease: "easeInOut",
                    },
                  },
                }
              : {}),
          }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative flex items-center justify-center"
        >
          {/* Sparkles for celebrating */}
          {isCelebrating && (
            <>
              <motion.span
                className="absolute -top-2 -right-2 text-2xl"
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
              >
                ✨
              </motion.span>
              <motion.span
                className="absolute -top-2 -left-2 text-2xl"
                animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }}
              >
                ✨
              </motion.span>
              <motion.span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xl"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }}
              >
                🌟
              </motion.span>
            </>
          )}

          {/* Gentle pulse for encouraging */}
          {isEncouraging && (
            <motion.span
              className="absolute inset-0 rounded-full bg-amber-200/40"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
            />
          )}

          <motion.span
            className="relative block select-none"
            animate={
              isThinking
                ? {
                    rotate: [0, -5, 5, 0],
                    transition: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                  }
                : {}
            }
          >
            {config.emoji}
          </motion.span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
