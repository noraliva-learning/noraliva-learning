import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getLearnerContextForGeneration } from '@/lib/ai/getLearnerContextForAI';
import { insertTutorTranscriptRow } from '@/lib/db/tutorTranscript';
import { classifyIntent, type Intent } from '@/lib/ace/intentRouter';

const LOG_PREFIX = '[ace/help]';

const MAX_TOKENS = 512;
const TEMPERATURE = 0.5;

/** Ace: one tutor identity. Warm, conversational, lesson-aware but not lesson-bound. */
const ACE_PROMPT = `You are Ace, a warm and intelligent learning companion. The learner is talking to you directly.

Respond in natural language. You're a real conversation partner, not a hint generator.
- Reply in JSON only, no markdown. Use "message" for your main reply. Add "hints" or "example" only when they naturally fit (often leave them empty).
- If the learner says hello, thanks, their name, or something off-topic: respond with a short, warm conversational reply. No lesson block.
- If they're confused or ask "what next?" or for help: respond with one clear next step or one guiding question. Build on the conversation; don't restart the lesson.
- If they ask about the content: give a short explanation through dialogue. Optional hints/example only when helpful.

Rules:
- Kid-safe. No personal questions (family, school, location). Warm redirect if off-topic.
- Stay warm. Never say you are an AI.
- Lesson context (question, domain, skill) is provided when relevant—use it to help through dialogue, not as a script.

JSON shape:
{
  "message": "your reply",
  "mode": "social | guide | explain",
  "hints": [],
  "example": "",
  "shouldSpeak": true
}`;

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
  message: string;
  mode: 'social' | 'guide' | 'explain';
  hints: string[];
  example: string;
  shouldSpeak: boolean;
};

const VALID_MODES: AceHelpResponse['mode'][] = ['social', 'guide', 'explain'];

function normalizeMode(raw: unknown): AceHelpResponse['mode'] {
  if (raw === 'social' || raw === 'guide' || raw === 'explain') return raw;
  if (raw === 'greeting' || raw === 'redirect' || raw === 'encouragement') return 'social';
  if (raw === 'hint' || raw === 'follow_up') return 'guide';
  return 'explain';
}

function parseAceHelp(text: string): AceHelpResponse | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const message = typeof parsed.message === 'string'
      ? String(parsed.message).slice(0, 1200).trim()
      : typeof parsed.explanation === 'string'
        ? String(parsed.explanation).slice(0, 1200).trim()
        : '';
    if (!message) return null;
    const mode = normalizeMode(parsed.mode);
    const hintsSource = Array.isArray(parsed.hints) ? (parsed.hints as unknown[]) : [];
    const hints = hintsSource
      .slice(0, 4)
      .map((h) => String(h).slice(0, 200))
      .filter((h) => h.length > 0);
    const example =
      typeof parsed.example === 'string'
        ? String(parsed.example).slice(0, 600).trim()
        : '';
    const shouldSpeak = typeof parsed.shouldSpeak === 'boolean' ? parsed.shouldSpeak : true;
    return {
      message,
      mode,
      hints,
      example,
      shouldSpeak,
    };
  } catch {
    return null;
  }
}

/** Safe reply when we have no context (e.g. auth/session failed). */
function minimalFallback(helperName: string): AceHelpResponse {
  return {
    message: "I'm here to help with this question. What would you like to try first?",
    mode: 'guide',
    hints: [],
    example: '',
    shouldSpeak: true,
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
  const message = `Let's think about ${baseTopic} together. The question is: "${prompt}". Try to picture what the question is really asking before you jump to an answer.`;

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
    message,
    mode: 'explain',
    hints,
    example,
    shouldSpeak: true,
  };
}

function safeJson(response: AceHelpResponse, meta: { fallback: boolean; reason?: string }) {
  return NextResponse.json(
    { ...response, fallback: meta.fallback, ...(meta.reason ? { _debug: meta.reason } : {}) },
    { status: 200 }
  );
}

/** Format tutor reply for transcript: one coherent string (message + optional hints + optional example). */
function formatTutorContent(r: AceHelpResponse): string {
  const parts: string[] = [r.message];
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

function responseForGratitude(learnerName: string): AceHelpResponse {
  const name = learnerName || 'you';
  return {
    message: `You're welcome, ${name}! I'm happy to help.`,
    mode: 'social',
    hints: [],
    example: '',
    shouldSpeak: true,
  };
}

function responseForGreeting(learnerName: string): AceHelpResponse {
  const name = learnerName || 'there';
  return {
    message: `Hi ${name}! I'm Ace. Ask me if you want help with the question.`,
    mode: 'social',
    hints: [],
    example: '',
    shouldSpeak: true,
  };
}

function responseForOffTopic(): AceHelpResponse {
  return {
    message: "I'm here to help with this question—let's focus on that!",
    mode: 'social',
    hints: [],
    example: '',
    shouldSpeak: true,
  };
}

function responseForSelfIntro(learnerName: string, rawMessage: string): AceHelpResponse {
  const name = learnerName || extractNameFromIntro(rawMessage) || 'you';
  return {
    message: `Nice to meet you, ${name}! I'm Ace. Ask me if you want help.`,
    mode: 'social',
    hints: [],
    example: '',
    shouldSpeak: true,
  };
}

function extractNameFromIntro(m: string): string {
  const match = m.match(/(?:my name is|i'?m|i am|call me)\s+([a-z]+)/i);
  return match ? match[1].trim() : '';
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

    if (intent === 'greeting') {
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        responseForGreeting(resolvedLearnerName),
        { fallback: true, reason: 'intent_greeting' },
        transcriptMeta
      );
    }
    if (intent === 'gratitude') {
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        responseForGratitude(resolvedLearnerName),
        { fallback: true, reason: 'intent_gratitude' },
        transcriptMeta
      );
    }
    if (intent === 'self_intro') {
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        responseForSelfIntro(resolvedLearnerName, question),
        { fallback: true, reason: 'intent_self_intro' },
        transcriptMeta
      );
    }
    if (intent === 'meta_question') {
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        responseForOffTopic(),
        { fallback: true, reason: 'intent_meta_question' },
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
        ? 'Answer from the conversation. One next step or one guiding question is enough.'
        : intent === 'confusion'
          ? 'The learner is confused. One simple next step or one short hint.'
          : intent === 'help_request'
            ? 'One hint or one guiding question.'
            : '';

    const systemPrompt = ACE_PROMPT;

    const isGuideIntent = intent === 'confusion' || intent === 'follow_up' || intent === 'help_request';
    const isExplainIntent = intent === 'content_question';

    const minimalContextBlock =
      prompt || learnerAnswer
        ? [
            prompt ? `Current question: ${prompt.slice(0, 400)}.` : null,
            learnerAnswer?.trim() ? `Learner's answer so far: ${learnerAnswer.slice(0, 200)}.` : null,
            intentInstruction,
          ]
            .filter(Boolean)
            .join('\n')
        : intentInstruction || '';

    const fullContextBlock = [
      effectiveDomain ? `Domain: ${effectiveDomain}.` : null,
      skillName ? `Skill: ${skillName}.` : null,
      `Current question: ${prompt.slice(0, 400) || '(unknown)'}.`,
      `Correct answer (do not reveal): ${String(correctAnswer).slice(0, 200) || '(unknown)'}.`,
      learnerAnswer?.trim() ? `Learner's current answer: ${learnerAnswer.slice(0, 200)}.` : null,
      'Respond in natural language; add hints or example only if they fit.',
    ]
      .filter(Boolean)
      .join('\n');

    const latestUserContent = isExplainIntent
      ? `Learner: ${question.slice(0, 500)}\n\n[Lesson context]\n${fullContextBlock}`
      : isGuideIntent
        ? `Learner: ${question.slice(0, 500)}${minimalContextBlock ? `\n\n${minimalContextBlock}` : ''}`
        : `Learner: ${question.slice(0, 500)}`;

    const openAIMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: latestUserContent },
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
