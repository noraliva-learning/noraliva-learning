import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getLearnerContextForGeneration } from '@/lib/ai/getLearnerContextForAI';
import { insertTutorTranscriptRow } from '@/lib/db/tutorTranscript';

const LOG_PREFIX = '[ace/help]';

const MAX_TOKENS = 512;
const TEMPERATURE = 0.5;

const BASE_RULES = `Safety and style rules:
- Use kid-friendly language. Do NOT ask personal questions (no family, friends, feelings, address, school name, or location).
- If the learner asks something off-topic or personal (e.g. "how old are you?"), respond with a warm, playful redirect to the lesson—e.g. "I'm a robot who loves helping with this question! Let's focus on that." Do not refuse or scold. Then optionally add one short hint about the current question.
- Stay emotionally warm. Never mention that you are an AI model.

Conversational intent — respond first to what the learner means, then help with the lesson if needed:
- Greeting (e.g. "hi", "hey") → short warm greeting back. No full explanation.
- Gratitude (e.g. "thank you", "thanks Lila") → warm social reply only, e.g. "You're welcome! You're doing great." Do NOT repeat your previous explanation or hints.
- Help or hint request → give explanation and/or hints and an example as needed. Avoid repeating the exact same explanation you already gave in the conversation; build on it or shorten.
- Confusion ("I don't get it", "I'm confused") → simpler, shorter explanation and one or two clear hints.
- Frustration → acknowledge briefly, encourage, then offer one simple next step.
- Off-topic curiosity → playful redirect, then one hint for the current question if it fits.
- Follow-up (e.g. "and then?", "what about the next step?") → use the conversation history; answer the follow-up without repeating the full prior explanation.

Return JSON only, no markdown:
{
  "explanation": "your main reply (can be social-only or include lesson help)",
  "hints": ["optional hint 1", "optional hint 2"],
  "example": "optional short example or empty string"
}
For social-only replies (e.g. thank you), put your reply in "explanation" and use "hints": [] and "example": "".`;

type AceHelpPayload = {
  sessionId: string;
  exerciseId: string;
  learnerAnswer?: string;
  prompt?: string;
  domain?: string;
  skillId?: string;
  question: string;
  helperName?: string;
  learnerName?: string;
  learnerSlug?: string;
  inputSource?: 'text' | 'voice';
  history?: { role: 'user' | 'assistant'; content: string }[];
};

type AceHelpResponse = {
  explanation: string;
  hints: string[];
  example: string;
};

function parseAceHelp(text: string): AceHelpResponse | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (typeof parsed.explanation !== 'string') return null;
    const explanation = String(parsed.explanation).slice(0, 1200);
    const hintsSource = Array.isArray(parsed.hints) ? (parsed.hints as unknown[]) : [];
    const hints = hintsSource
      .slice(0, 4)
      .map((h) => String(h).slice(0, 200))
      .filter((h) => h.length > 0);
    const example =
      typeof parsed.example === 'string'
        ? String(parsed.example).slice(0, 600)
        : '';
    return {
      explanation,
      hints,
      example,
    };
  } catch {
    return null;
  }
}

/** Safe reply when we have no context (e.g. auth/session failed). */
function minimalFallback(helperName: string): AceHelpResponse {
  return {
    explanation: "I'm here to help with this question. What would you like to try first?",
    hints: ['Read the question again slowly.', 'Try one small step at a time.'],
    example: "Let's work on the question together. If you tell me what you've tried, I can give you a hint.",
  };
}

function fallbackAceHelp(args: {
  prompt: string;
  learnerAnswer?: string;
  correctAnswer?: string;
  domain?: string;
  skillName?: string;
}): AceHelpResponse {
  const { prompt, learnerAnswer, correctAnswer, domain, skillName } = args;
  const baseTopic =
    skillName ||
    (domain ? `${domain} skill` : 'this idea');
  const explanation = `Let's think about ${baseTopic} together. The question is: "${prompt}". Try to picture what the question is really asking before you jump to an answer.`;

  const cleanedLearner = (learnerAnswer ?? '').trim();
  const cleanedCorrect = (correctAnswer ?? '').trim();
  const same =
    cleanedLearner &&
    cleanedCorrect &&
    cleanedLearner.toLowerCase() === cleanedCorrect.toLowerCase();

  const hints: string[] = [];
  hints.push('Read the question slowly and underline (in your mind) the key words.');
  if (!same) {
    hints.push('Try the problem step by step instead of all at once.');
    hints.push('If you get stuck, explain out loud what you know so far and what you are trying to find.');
  } else {
    hints.push('Ask yourself: "Why does this answer make sense?" and explain it in your own words.');
  }

  let example: string;
  if (domain === 'math') {
    example =
      'Imagine a question like: "What is 3 + 4?" You could think: I start at 3, then count 4 more (4, 5, 6, 7). That lands on 7. So the answer is 7, and I can explain it as: I added 4 to 3 by counting up.';
  } else {
    example =
      'Imagine a question that asks you to explain something in your own words. First, say the idea in one short sentence. Then add one example that shows the idea in real life. Keep your words simple, like you are teaching a friend.';
  }

  return {
    explanation,
    hints,
    example,
  };
}

function safeJson(response: AceHelpResponse, meta: { fallback: boolean; reason?: string }) {
  return NextResponse.json(
    { ...response, fallback: meta.fallback, ...(meta.reason ? { _debug: meta.reason } : {}) },
    { status: 200 }
  );
}

/** Format tutor reply for transcript (single string). */
function formatTutorContent(r: AceHelpResponse): string {
  const parts: string[] = [r.explanation];
  if (r.hints?.length) parts.push('Hints: ' + r.hints.join(' '));
  if (r.example?.trim()) parts.push('Example: ' + r.example.trim());
  return parts.join('\n\n').slice(0, 10000);
}

async function respondWithTranscript(
  supabase: Awaited<ReturnType<typeof createClient>> | null,
  learnerId: string | null,
  sessionId: string | null,
  helperName: string,
  response: AceHelpResponse,
  meta: { fallback: boolean; reason?: string },
  metadata?: Record<string, unknown>
): Promise<NextResponse> {
  if (supabase && learnerId) {
    await insertTutorTranscriptRow(supabase, {
      learnerId,
      sessionId,
      helperName,
      role: 'tutor',
      content: formatTutorContent(response),
      metadata: metadata ?? {},
    });
  }
  return safeJson(response, meta);
}

type Intent =
  | 'gratitude'
  | 'greeting'
  | 'confusion'
  | 'follow_up'
  | 'hint_request'
  | 'off_topic'
  | 'lesson_help';

/**
 * Deterministic intent classifier for the learner's latest message.
 * Order matters: more specific intents are checked first.
 */
function classifyIntent(message: string): Intent {
  const m = message.trim().toLowerCase();
  if (m.length === 0) return 'lesson_help';

  if (/\b(thank|thanks|thx|ty|thank you|thanks so much|thank ya)\b/i.test(m) || /^tysm$/i.test(m)) return 'gratitude';
  if (/^(hi|hey|hello|howdy|hiya|yo|hi there|hey there)[\s!.]*$/i.test(m) || (m.length <= 12 && /\b(hi|hey|hello)\b/i.test(m))) return 'greeting';
  if (/\b(how old are you|your favorite|what'?s your (favorite|name)\s*(again)?\s*$|where do you live|do you have (a )?family|are you (a )?real (robot|person)|what do you look like)\b/i.test(m)) return 'off_topic';
  if (/\b(confused|don'?t get it|don'?t understand|don'?t know|i'?m stuck|i'?m lost|what\?|huh\?|no idea|makes no sense)\b/i.test(m)) return 'confusion';
  if (/\b(and then|what next|next step|what else|tell me more|again\s*[.?]?$|what about|then what|so then|and after that|one more time|go on)\b/i.test(m)) return 'follow_up';
  if (/\b(hint|give me a hint|can you hint|need a hint|little hint|just a hint|one hint)\b/i.test(m) || (m.length <= 25 && /\bhelp\b/i.test(m))) return 'hint_request';

  return 'lesson_help';
}

function responseForGratitude(helperName: string, learnerName: string): AceHelpResponse {
  const name = learnerName || 'you';
  if (helperName === 'Lila') {
    return {
      explanation: `You're welcome, ${name}. I'm happy to help. Want to try it together?`,
      hints: [],
      example: '',
    };
  }
  if (helperName === 'Dan') {
    return {
      explanation: `You're welcome, ${name}! Glad that helped. Ready to try the next step when you are.`,
      hints: [],
      example: '',
    };
  }
  return {
    explanation: `You're welcome! I'm happy to help.`,
    hints: [],
    example: '',
  };
}

function responseForGreeting(helperName: string, learnerName: string): AceHelpResponse {
  const name = learnerName || 'there';
  if (helperName === 'Lila') {
    return {
      explanation: `Hi ${name}! I'm Lila. Ask me if you want a hint or help with the question.`,
      hints: [],
      example: '',
    };
  }
  if (helperName === 'Dan') {
    return {
      explanation: `Hey ${name}! Dan here. Need a hint or want to work through it together?`,
      hints: [],
      example: '',
    };
  }
  return {
    explanation: `Hi ${name}! Ask me if you want a hint.`,
    hints: [],
    example: '',
  };
}

function responseForOffTopic(helperName: string): AceHelpResponse {
  if (helperName === 'Lila') {
    return {
      explanation: "I'm a robot who loves helping with this question! Let's focus on that—you've got this.",
      hints: [],
      example: '',
    };
  }
  if (helperName === 'Dan') {
    return {
      explanation: "I'm here to help you with this question—let's get back to it!",
      hints: [],
      example: '',
    };
  }
  return {
    explanation: "I'm here to help with this question. Let's focus on that!",
    hints: [],
    example: '',
  };
}

export async function POST(request: Request) {
  let body: Partial<AceHelpPayload> = {};
  try {
    body = (await request.json().catch(() => ({}))) as Partial<AceHelpPayload>;
  } catch (e) {
    console.error(LOG_PREFIX, 'body parse failed', e);
    return safeJson(minimalFallback('Ace'), { fallback: true, reason: 'body_parse' });
  }

  const sessionId = body.sessionId;
  const exerciseId = body.exerciseId;
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const learnerAnswer = typeof body.learnerAnswer === 'string' ? body.learnerAnswer : undefined;
  const clientPrompt = typeof body.prompt === 'string' ? body.prompt : undefined;
  const clientDomain = typeof body.domain === 'string' ? body.domain : undefined;
  const preferredSkillId = typeof body.skillId === 'string' ? body.skillId : undefined;
  const helperNameFromClient = typeof body.helperName === 'string' ? body.helperName : undefined;
  const learnerNameFromClient = typeof body.learnerName === 'string' ? body.learnerName : undefined;
  const learnerSlugFromClient = typeof body.learnerSlug === 'string' ? body.learnerSlug : undefined;
  const inputSource = body.inputSource === 'voice' || body.inputSource === 'text' ? body.inputSource : 'text';
  const resolvedHelperName = helperNameFromClient || 'Ace';

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .slice(-10)
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string'
    )
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 500) }));

  if (!sessionId || typeof sessionId !== 'string' || !exerciseId || typeof exerciseId !== 'string' || !question) {
    console.error(LOG_PREFIX, 'validation failed', { sessionId: !!sessionId, exerciseId: !!exerciseId, question: !!question });
    return safeJson(minimalFallback(resolvedHelperName), { fallback: true, reason: 'validation' });
  }

  let prompt = clientPrompt ?? '';
  let correctAnswer = '';
  let effectiveDomain = clientDomain;
  let skillName: string | undefined;
  let learnerId: string | null = null;
  let sessionIdForLog: string | null = null;
  let transcriptMeta: { domain?: string; skill_id?: string; exercise_id?: string; current_question?: string; learner_answer_at_time?: string } = {};
  let supabaseInstance: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      console.error(LOG_PREFIX, 'auth error', authError.message);
      return safeJson(minimalFallback(resolvedHelperName), { fallback: true, reason: 'auth' });
    }
    if (!user) {
      console.error(LOG_PREFIX, 'not authenticated');
      return safeJson(minimalFallback(resolvedHelperName), { fallback: true, reason: 'auth' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('id, learner_id, domain')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError) {
      console.error(LOG_PREFIX, 'session lookup error', sessionError.message);
      return safeJson(minimalFallback(resolvedHelperName), { fallback: true, reason: 'session' });
    }
    if (!session) {
      console.error(LOG_PREFIX, 'session not found', sessionId);
      return safeJson(minimalFallback(resolvedHelperName), { fallback: true, reason: 'session' });
    }
    if (session.learner_id !== user.id) {
      console.error(LOG_PREFIX, 'forbidden: session learner_id !== user.id');
      return safeJson(minimalFallback(resolvedHelperName), { fallback: true, reason: 'forbidden' });
    }

    learnerId = session.learner_id;
    sessionIdForLog = session.id;
    supabaseInstance = supabase;
    effectiveDomain = effectiveDomain ?? (session as { domain?: string }).domain;

    let learnerAgeLevel: string | null = null;
    const { data: learnerProfile } = await supabase
      .from('profiles')
      .select('age, grade_label')
      .eq('id', session.learner_id)
      .maybeSingle();
    if (learnerProfile) {
      const a = (learnerProfile as { age?: number | null }).age;
      const g = (learnerProfile as { grade_label?: string | null }).grade_label;
      if (a != null) learnerAgeLevel = `age ${a}`;
      else if (g) learnerAgeLevel = g;
    }

    const { data: exercise, error: exError } = await supabase
      .from('exercises')
      .select('id, prompt, correct_answer, lesson_id')
      .eq('id', exerciseId)
      .single();
    if (exError) {
      console.error(LOG_PREFIX, 'exercise lookup error', exError.message);
      return safeJson(minimalFallback(resolvedHelperName), { fallback: true, reason: 'exercise' });
    }
    if (!exercise) {
      console.error(LOG_PREFIX, 'exercise not found', exerciseId);
      return safeJson(minimalFallback(resolvedHelperName), { fallback: true, reason: 'exercise' });
    }

    correctAnswer = (exercise as { correct_answer?: string | null }).correct_answer ?? '';
    prompt = clientPrompt ?? (exercise as { prompt?: string }).prompt ?? '';

    const { data: lesson } = await supabase
      .from('lessons')
      .select('skill_id')
      .eq('id', (exercise as { lesson_id?: string }).lesson_id)
      .single();
    const skillId = (lesson as { skill_id?: string } | null)?.skill_id ?? preferredSkillId;

    transcriptMeta = {
      domain: effectiveDomain ?? undefined,
      skill_id: skillId ?? undefined,
      exercise_id: exerciseId,
      current_question: prompt ? prompt.slice(0, 500) : undefined,
      learner_answer_at_time: learnerAnswer?.slice(0, 300),
    };
    if (learnerId && supabaseInstance) {
      await insertTutorTranscriptRow(supabaseInstance, {
        learnerId,
        sessionId: sessionIdForLog,
        helperName: resolvedHelperName,
        role: 'learner',
        content: question,
        inputSource,
        metadata: transcriptMeta,
      });
    }

    try {
      if (skillId) {
        const ctx = await getLearnerContextForGeneration(supabase, sessionId, skillId);
        if (ctx) {
          skillName = ctx.skillName;
          effectiveDomain = effectiveDomain ?? ctx.domain;
        }
      }
    } catch (ctxErr) {
      console.error(LOG_PREFIX, 'context load failed', ctxErr);
      // Continue with prompt/domain we have.
    }

    const intent = classifyIntent(question);
    const resolvedLearnerName = learnerNameFromClient || '';

    if (intent === 'gratitude') {
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        responseForGratitude(resolvedHelperName, resolvedLearnerName),
        { fallback: true, reason: 'intent_gratitude' },
        transcriptMeta
      );
    }
    if (intent === 'greeting') {
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        responseForGreeting(resolvedHelperName, resolvedLearnerName),
        { fallback: true, reason: 'intent_greeting' },
        transcriptMeta
      );
    }
    if (intent === 'off_topic') {
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        responseForOffTopic(resolvedHelperName),
        { fallback: true, reason: 'intent_off_topic' },
        transcriptMeta
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      const fallback = fallbackAceHelp({
        prompt,
        learnerAnswer,
        correctAnswer,
        domain: effectiveDomain,
        skillName,
      });
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        fallback,
        { fallback: true, reason: 'no_api_key' },
        transcriptMeta
      );
    }

    const intentInstruction =
      intent === 'follow_up'
        ? ' The learner is asking a follow-up. Answer from the conversation history only; do NOT repeat the full prior explanation or hint block.'
        : intent === 'confusion'
          ? ' The learner is confused. Give a simpler, shorter explanation and one or two clear hints.'
          : intent === 'hint_request'
            ? ' The learner wants a hint. Give a helpful hint (and optionally a short example) without repeating the full explanation unless needed.'
            : '';

    const resolvedLearnerNameForPrompt = resolvedLearnerName || 'the learner';

    const danSystem = `You are Dan, a warm, smart, playful, confident robot tutor for Liv (a bright 7-year-old). You can use slightly more advanced wording when it helps. You feel like a clever robot helper who's on her side.

${BASE_RULES}`;

    const lilaSystem = `You are Lila, a warm, gentle, simple, encouraging robot tutor for Elle (about 5). Use short sentences. Elle may use voice more than typing, so keep replies clear and easy to hear. You feel like a kind robot helper who's patient and cheering her on.

${BASE_RULES}`;

    const systemPrompt =
      resolvedHelperName === 'Lila'
        ? lilaSystem
        : resolvedHelperName === 'Dan'
          ? danSystem
          : `You are a friendly robot named ${resolvedHelperName} who helps ${resolvedLearnerNameForPrompt} learn.\n\n${BASE_RULES}`;

    const contextBlock = [
      `Learner: ${resolvedLearnerNameForPrompt}${learnerSlugFromClient ? ` (slug: ${learnerSlugFromClient})` : ''}${learnerAgeLevel ? `. ${learnerAgeLevel}.` : '.'}`,
      `Helper: ${resolvedHelperName}.`,
      effectiveDomain ? `Domain: ${effectiveDomain}.` : null,
      skillName ? `Skill: ${skillName}.` : null,
      `Current question on screen: ${prompt.slice(0, 500) || '(unknown)'}.`,
      `Correct answer (guide hints only; do not reveal): ${String(correctAnswer).slice(0, 300) || '(unknown)'}.`,
      `Learner's current answer: ${
        learnerAnswer?.trim() ? learnerAnswer.slice(0, 300) : '(not answered yet)'
      }.`,
      `Learner's latest message: ${question.slice(0, 400)}.`,
      intentInstruction ? `[Instruction]${intentInstruction}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const openAIMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: contextBlock },
    ];

    let raw: string | null = null;
    try {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: openAIMessages,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      });
      raw = completion.choices[0]?.message?.content ?? null;
    } catch (openaiErr) {
      console.error(LOG_PREFIX, 'OpenAI call failed', openaiErr);
      const fallback = fallbackAceHelp({
        prompt,
        learnerAnswer,
        correctAnswer,
        domain: effectiveDomain,
        skillName,
      });
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        fallback,
        { fallback: true, reason: 'openai_error' },
        transcriptMeta
      );
    }

    if (!raw) {
      const fallback = fallbackAceHelp({
        prompt,
        learnerAnswer,
        correctAnswer,
        domain: effectiveDomain,
        skillName,
      });
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        fallback,
        { fallback: true, reason: 'openai_empty' },
        transcriptMeta
      );
    }

    const parsed = parseAceHelp(raw);
    if (!parsed) {
      console.error(LOG_PREFIX, 'parse failed', raw.slice(0, 200));
      const fallback = fallbackAceHelp({
        prompt,
        learnerAnswer,
        correctAnswer,
        domain: effectiveDomain,
        skillName,
      });
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        fallback,
        { fallback: true, reason: 'parse' },
        transcriptMeta
      );
    }

    return respondWithTranscript(
      supabaseInstance,
      learnerId,
      sessionIdForLog,
      resolvedHelperName,
      parsed,
      { fallback: false },
      transcriptMeta
    );
  } catch (e) {
    console.error(LOG_PREFIX, 'unexpected error', e);
    const fallback = prompt
      ? fallbackAceHelp({
          prompt,
          learnerAnswer,
          correctAnswer,
          domain: effectiveDomain,
          skillName,
        })
      : minimalFallback(resolvedHelperName);
    return respondWithTranscript(
      supabaseInstance ?? null,
      learnerId,
      sessionIdForLog,
      resolvedHelperName,
      fallback,
      { fallback: true, reason: 'exception' },
      transcriptMeta
    );
  }
}
