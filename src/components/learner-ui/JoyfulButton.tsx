"use client";

import { motion } from "framer-motion";

type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  id?: string;
};

/**
 * Learner-facing button with pulse, squish, and theme-aware colors.
 */
export function JoyfulButton({
  children,
  onClick,
  disabled = false,
  type = "button",
  variant = "primary",
  className = "",
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
  id,
}: Props) {
  const base =
    "rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary:
      "bg-[rgb(var(--learner-cta))] text-[rgb(var(--learner-cta-text))] hover:bg-[rgb(var(--learner-cta-hover))]",
    secondary:
      "border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-surface))] text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]",
    danger:
      "bg-rose-500 text-white hover:bg-rose-600",
  };

  return (
    <motion.button
      type={type}
      id={id}
      data-testid={dataTestId}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      aria-label={ariaLabel}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <motion.span
        className="inline-block"
        animate={variant === "primary" && !disabled ? { opacity: [1, 0.92, 1] } : {}}
        transition={{ repeat: Infinity, repeatDelay: 1.5, duration: 0.6 }}
      >
        {children}
      </motion.span>
    </motion.button>
  );
}
