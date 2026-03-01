export type MissionQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  skill: string;
};

export type MissionNode = {
  id: string;
  title: string;
  subtitle: string;
  predictedStruggle?: boolean;
};

export type Mission = {
  id: string;
  title: string;
  nodes: MissionNode[];
  questions: MissionQuestion[];
};

function baseNodes(): MissionNode[] {
  return [
    { id: "warmup", title: "Warm-up", subtitle: "Easy start" },
    { id: "skill", title: "Skill", subtitle: "Today’s focus" },
    {
      id: "practice",
      title: "Practice",
      subtitle: "A few tries",
      predictedStruggle: true,
    },
    { id: "miniBoss", title: "Mini Boss", subtitle: "Show what you know" },
    { id: "celebrate", title: "Celebrate", subtitle: "Victory!" },
  ];
}

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(input: string): () => number {
  let seed = hashSeed(input) || 1;
  return () => {
    // xorshift32
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return (seed & 0xffffffff) / 0x100000000;
  };
}

function pickInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildMathMission(
  learnerId: string,
  domainId: string,
  dateKey: string
): Mission {
  const seedKey = `${learnerId}:${domainId}:${dateKey}:math`;
  const rng = createRng(seedKey);

  const isElle = learnerId === "elle";

  const questions: MissionQuestion[] = [];

  for (let i = 0; i < 3; i++) {
    const within = isElle ? 10 : 20;
    const addNotSub = rng() < 0.6;

    let a = pickInt(rng, 1, within - 1);
    let b = pickInt(rng, 1, within - 1);

    if (addNotSub) {
      // Ensure sum stays within the band
      const maxB = Math.max(1, within - a);
      b = pickInt(rng, 1, maxB);
      const correct = a + b;
      const skill = isElle ? "Adding within 10" : "Adding within 20";

      const correctStr = `${correct}`;
      const distractors = Array.from({ length: 4 }, () =>
        Math.max(0, correct + pickInt(rng, -3, 3))
      )
        .filter((n) => n !== correct)
        .slice(0, 2)
        .map((n) => `${n}`);

      const withCorrect = shuffle(rng, [correctStr, ...distractors]);
      const correctIndex = withCorrect.indexOf(correctStr);

      questions.push({
        id: `q${i + 1}`,
        prompt: `${a} + ${b} = ?`,
        options: withCorrect,
        correctIndex,
        skill,
      });
    } else {
      // Subtraction: keep result non-negative and within band
      const bigger = pickInt(rng, Math.max(2, a + 1), within);
      const smaller = pickInt(rng, 1, bigger - 1);
      const correct = bigger - smaller;
      const skill = isElle ? "Subtracting within 10" : "Subtracting within 20";

      const correctStr = `${correct}`;
      const distractors = Array.from({ length: 4 }, () =>
        Math.max(0, correct + pickInt(rng, -3, 3))
      )
        .filter((n) => n !== correct)
        .slice(0, 2)
        .map((n) => `${n}`);

      const withCorrect = shuffle(rng, [correctStr, ...distractors]);
      const correctIndex = withCorrect.indexOf(correctStr);

      questions.push({
        id: `q${i + 1}`,
        prompt: `${bigger} − ${smaller} = ?`,
        options: withCorrect,
        correctIndex,
        skill,
      });
    }
  }

  return {
    id: `${learnerId}:${domainId}:${dateKey}`,
    title: isElle ? "7-Day Star Trail" : "7-Day Math Quest",
    nodes: baseNodes(),
    questions,
  };
}

function buildReadingMission(
  learnerId: string,
  domainId: string,
  dateKey: string
): Mission {
  const seedKey = `${learnerId}:${domainId}:${dateKey}:reading`;
  const rng = createRng(seedKey);

  const bank: MissionQuestion[] = [
    {
      id: "sight-1",
      prompt: "Which word is 'the'?",
      options: ["ta", "the", "tho"],
      correctIndex: 1,
      skill: "Sight word recognition",
    },
    {
      id: "rhyme-1",
      prompt: "Which word rhymes with “cat”?",
      options: ["dog", "sun", "hat"],
      correctIndex: 2,
      skill: "Rhyming",
    },
    {
      id: "sound-1",
      prompt: "Which word starts with the same sound as “ball”?",
      options: ["cat", "bag", "sun"],
      correctIndex: 1,
      skill: "Initial sound",
    },
  ];

  const shuffled = shuffle(rng, bank);
  const questions = shuffled.slice(0, 3);

  return {
    id: `${learnerId}:${domainId}:${dateKey}`,
    title: "Reading Mission",
    nodes: baseNodes(),
    questions,
  };
}

function buildPlaceholderMission(
  learnerId: string,
  domainId: string,
  dateKey: string
): Mission {
  const seedKey = `${learnerId}:${domainId}:${dateKey}:placeholder`;
  const rng = createRng(seedKey);
  // Use rng just to keep deterministic shape if extended later
  const plusTwo = 1 + pickInt(rng, 1, 3);

  const correct = 2;
  const opts = shuffle(rng, ["1", "2", `${plusTwo}`]);
  const correctIndex = opts.indexOf("2");

  return {
    id: `${learnerId}:${domainId}:${dateKey}`,
    title: "Daily Mission",
    nodes: baseNodes(),
    questions: [
      {
        id: "placeholder-1",
        prompt: "This is a practice question. What is 1 + 1?",
        options: opts,
        correctIndex,
        skill: "Getting started",
      },
    ],
  };
}

export function getDailyMission(
  learnerId: string,
  domainId: string,
  dateKey: string
): Mission {
  const key = domainId.toLowerCase();

  if (key === "math") {
    return buildMathMission(learnerId, domainId, dateKey);
  }
  if (key === "reading") {
    return buildReadingMission(learnerId, domainId, dateKey);
  }

  return buildPlaceholderMission(learnerId, domainId, dateKey);
}

