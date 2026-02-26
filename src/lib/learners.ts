export type LearnerId = "liv" | "elle";

export type LearnerProfile = {
  id: LearnerId;
  displayName: string;
  age: number;
  gradeLabel: string;
  challengeStyle: "strict" | "gentle";
};

export const LEARNERS: Record<LearnerId, LearnerProfile> = {
  liv: {
    id: "liv",
    displayName: "Liv",
    age: 7,
    gradeLabel: "Grade 2",
    challengeStyle: "strict", // resets on miss (kind tone)
  },
  elle: {
    id: "elle",
    displayName: "Elle",
    age: 5,
    gradeLabel: "Grade 1",
    challengeStyle: "gentle", // softer if miss
  },
};

export function getLearnerProfile(raw: string): LearnerProfile {
  const key = raw?.toLowerCase() as LearnerId;
  return LEARNERS[key] ?? {
    id: "liv",
    displayName: raw ? raw[0].toUpperCase() + raw.slice(1) : "Learner",
    age: 0,
    gradeLabel: "Learner",
    challengeStyle: "gentle",
  };
}
