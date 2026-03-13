"use client";

import { type LearnerSlug, isLearnerSlug } from "@/lib/learner-theme";

type Props = {
  learnerSlug: LearnerSlug | string | undefined;
  children: React.ReactNode;
  className?: string;
};

/**
 * Wraps learner-facing UI so CSS variables for that learner's theme apply.
 * Use on learner dashboard and session page. Parent dashboard does not use this.
 */
export function LearnerTheme({ learnerSlug, children, className = "" }: Props) {
  const slug = isLearnerSlug(learnerSlug) ? learnerSlug : "liv";
  return (
    <div
      data-learner={slug}
      className={className}
      style={{
        backgroundColor: "rgb(var(--learner-bg))",
        color: "rgb(var(--learner-text))",
      }}
    >
      {children}
    </div>
  );
}
