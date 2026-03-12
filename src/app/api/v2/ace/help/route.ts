/**
 * DEPRECATED (MVP): Canonical Ask Ace tutor is POST /api/v2/dan/help.
 * That route uses OpenAI Responses API + gpt-5-mini + streaming and transcript logging.
 * This route remains for backward compatibility only; learner UI uses /api/v2/dan/help only.
 */
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getLearnerContextForGeneration } from '@/lib/ai/getLearnerContextForAI';
import { insertTutorTranscriptRow } from '@/lib/db/tutorTranscript';

const LOG_PREFIX = '[ace/help]';

const MAX_TOKENS = 512;
const TEMPERATURE = 0.6;

/** Minimal system prompt: Ace as direct conversational companion. */
const ACE_SYSTEM_PROMPT = `You are Ace, a warm, intelligent conversational learning companion for children.
Respond naturally to what the learner actually says.
Be clear, kind, and age-appropriate.
If there is lesson context, use it only if it is relevant to the learner’s question.
Do not ask for school, address, or location.`;

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

/** Plain response shape: message + shouldSpeak only. */
type AceHelpResponse = {
  message: string;
  shouldSpeak: boolean;
};

/** Parse model output: JSON { message, shouldSpeak } or plain text as message. */
function parseReply(raw: string): AceHelpResponse {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const message =
        typeof parsed.message === 'string'
          ? String(parsed.message).slice(0, 2000).trim()
          : '';
      if (message) {
        const shouldSpeak = typeof parsed.shouldSpeak === 'boolean' ? parsed.shouldSpeak : true;
        return { message, shouldSpeak };
      }
    } catch {
      /* fall through to plain text */
    }
  }
  return {
    message: trimmed.slice(0, 2000).trim() || "I'm here to help. What would you like to try?",
    shouldSpeak: true,
  };
}

function minimalFallback(): AceHelpResponse {
  return {
    message: "I'm here to help with this question. What would you like to try first?",
    shouldSpeak: true,
  };
}

async function respondWithTranscript(
  supabase: Awaited<ReturnType<typeof createClient>> | null,
  learnerId: string | null,
  sessionId: string | null,
  helperName: string,
  response: AceHelpResponse,
  metadata?: Record<string, unknown>
): Promise<NextResponse> {
  if (supabase && learnerId) {
    await insertTutorTranscriptRow(supabase, {
      learnerId,
      sessionId,
      helperName,
      role: 'tutor',
      content: response.message.slice(0, 10000),
      metadata: metadata ?? {},
    });
  }
  return NextResponse.json(response, { status: 200 });
}

/** Build compact lesson context: question, learner answer, domain, skill. */
function buildLessonContext(p: {
  prompt: string;
  learnerAnswer?: string;
  domain?: string;
  skillName?: string;
}): string {
  const parts: string[] = [];
  if (p.prompt) parts.push(`Current question: ${p.prompt.slice(0, 400)}`);
  if (p.learnerAnswer?.trim()) parts.push(`Learner answer so far: ${p.learnerAnswer.slice(0, 200)}`);
  if (p.domain) parts.push(`Domain: ${p.domain}`);
  if (p.skillName) parts.push(`Skill: ${p.skillName}`);
  return parts.join('\n');
}

export async function POST(request: Request) {
  let body: Partial<AceHelpPayload> = {};
  try {
    body = (await request.json().catch(() => ({}))) as Partial<AceHelpPayload>;
  } catch (e) {
    console.error(LOG_PREFIX, 'body parse failed', e);
    return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
  }

  const sessionId = body.sessionId;
  const exerciseId = body.exerciseId;
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const learnerAnswer = typeof body.learnerAnswer === 'string' ? body.learnerAnswer : undefined;
  const clientPrompt = typeof body.prompt === 'string' ? body.prompt : undefined;
  const clientDomain = typeof body.domain === 'string' ? body.domain : undefined;
  const preferredSkillId = typeof body.skillId === 'string' ? body.skillId : undefined;
  const resolvedHelperName = typeof body.helperName === 'string' ? body.helperName : 'Ace';
  const inputSource = body.inputSource === 'voice' || body.inputSource === 'text' ? body.inputSource : 'text';

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
    return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
  }

  let prompt = clientPrompt ?? '';
  let effectiveDomain = clientDomain;
  let skillName: string | undefined;
  let learnerId: string | null = null;
  let sessionIdForLog: string | null = null;
  const transcriptMeta: Record<string, unknown> = {};
  let supabaseInstance: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      console.error(LOG_PREFIX, 'auth error', authError.message);
      return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
    }
    if (!user) {
      console.error(LOG_PREFIX, 'not authenticated');
      return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('id, learner_id, domain')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError) {
      console.error(LOG_PREFIX, 'session lookup error', sessionError.message);
      return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
    }
    if (!session) {
      console.error(LOG_PREFIX, 'session not found', sessionId);
      return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
    }
    if (session.learner_id !== user.id) {
      console.error(LOG_PREFIX, 'forbidden: session learner_id !== user.id');
      return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
    }

    learnerId = session.learner_id;
    sessionIdForLog = session.id;
    supabaseInstance = supabase;
    effectiveDomain = effectiveDomain ?? (session as { domain?: string }).domain;

    const { data: exercise, error: exError } = await supabase
      .from('exercises')
      .select('id, prompt, lesson_id')
      .eq('id', exerciseId)
      .single();
    if (exError) {
      console.error(LOG_PREFIX, 'exercise lookup error', exError.message);
      return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
    }
    if (!exercise) {
      console.error(LOG_PREFIX, 'exercise not found', exerciseId);
      return NextResponse.json({ ...minimalFallback(), fallback: true }, { status: 200 });
    }

    prompt = clientPrompt ?? (exercise as { prompt?: string }).prompt ?? '';

    const { data: lesson } = await supabase
      .from('lessons')
      .select('skill_id')
      .eq('id', (exercise as { lesson_id?: string }).lesson_id)
      .single();
    const skillId = (lesson as { skill_id?: string } | null)?.skill_id ?? preferredSkillId;

    Object.assign(transcriptMeta, {
      domain: effectiveDomain ?? undefined,
      skill_id: skillId ?? undefined,
      exercise_id: exerciseId,
      current_question: prompt ? prompt.slice(0, 500) : undefined,
      learner_answer_at_time: learnerAnswer?.slice(0, 300),
    });

    // Log learner turn (unchanged)
    if (learnerId && supabaseInstance) {
      await insertTutorTranscriptRow(supabaseInstance, {
        learnerId,
        sessionId: sessionIdForLog,
        helperName: resolvedHelperName,
        role: 'learner',
        content: question,
        inputSource,
        metadata: transcriptMeta as import('@/lib/db/tutorTranscript').TutorTranscriptMetadata,
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
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      const fallback = minimalFallback();
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        fallback,
        transcriptMeta as Record<string, unknown>
      );
    }

    const lessonContext = buildLessonContext({
      prompt,
      learnerAnswer,
      domain: effectiveDomain,
      skillName,
    });

    const learnerLine = `Learner says: "${question.slice(0, 500)}"`;

    const userContent =
      lessonContext.length > 0
        ? `${learnerLine}\n\nOptional context:\n${lessonContext}`
        : learnerLine;

    const openAIMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: ACE_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
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
      const fallback = minimalFallback();
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        fallback,
        transcriptMeta as Record<string, unknown>
      );
    }

    if (!raw) {
      const fallback = minimalFallback();
      return respondWithTranscript(
        supabaseInstance,
        learnerId,
        sessionIdForLog,
        resolvedHelperName,
        fallback,
        transcriptMeta as Record<string, unknown>
      );
    }

    const parsed = parseReply(raw);
    return respondWithTranscript(
      supabaseInstance,
      learnerId,
      sessionIdForLog,
      resolvedHelperName,
      parsed,
      transcriptMeta as Record<string, unknown>
    );
  } catch (e) {
    console.error(LOG_PREFIX, 'unexpected error', e);
    const fallback = minimalFallback();
    return respondWithTranscript(
      supabaseInstance ?? null,
      learnerId,
      sessionIdForLog,
      resolvedHelperName,
      fallback,
      transcriptMeta as Record<string, unknown>
    );
  }
}
