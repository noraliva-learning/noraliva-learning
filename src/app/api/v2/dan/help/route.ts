import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';
import OpenAI from 'openai';
import { insertTutorTranscriptRow, type TutorTranscriptMetadata } from '@/lib/db/tutorTranscript';

const LOG_PREFIX = '[dan/help]';

const USER_FACING_ERROR = "Sorry, I had trouble answering that. Please try again.";

/** Return 200 text/plain so the client displays this as Dan's message instead of raw JSON. */
function textPlainError(message: string = USER_FACING_ERROR): Response {
  return new Response(message, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** Build learner-specific system prompt. Tutor name: Liv → Dan, Elle → Lila. */
function buildTutorSystemPrompt(helperName: string, learnerName: string): string {
  return `You are the learning guide for Liv and Elle.
Your name for this learner is ${helperName}. The learner you are talking to is ${learnerName}.

Personality: warm, wise, calm, encouraging, and brief. You help children think through problems step by step. You do not shame mistakes. You do not rush. You help the learner discover the answer rather than just giving it away. You focus on the question on screen and the current skill. When the learner is confused, help step by step. When the learner goes off-topic, respond warmly but guide them back to the lesson. Keep replies short, clear, and age-appropriate.

Hint ladder (use conversation history to choose the right level):
- Level 1 — Gentle nudge: orient attention to the problem; remind the learner what they are trying to do.
- Level 2 — Strategy prompt: suggest a method or next step (e.g. "start at 7 and count on").
- Level 3 — Guided walkthrough: partially walk through the reasoning (e.g. "after 7 comes 8, then 9…").
- Level 4 — Answer explanation: if the learner remains stuck after earlier hints, provide the answer briefly and explain why.

Use the ladder gradually: if the learner says "I'm confused" once, start with Level 1 or 2. If they keep asking or signal repeated confusion, escalate to the next level. Do not jump to the full answer on first confusion.

Off-topic (e.g. "How are you?", "My name is Liv/Elle", chatter): respond briefly and warmly, then redirect to the problem. Example: "I'm doing well, ${learnerName}. Let's solve this together — what do you get when you add 7 and 5?" Do not be cold or robotic; do not allow long off-topic conversations during the lesson.

Correct answers: if the learner shares that they got it right or you can tell they succeeded, give a short celebration: "Nice work, ${learnerName}!" or "You got it!" or "Yes — that's right!" Keep it to one short line.

You will receive: the learner's latest message, recent chat history, and lesson context (question, learner answer so far, domain, skill, learner level). Always use that context. Stay anchored to the actual lesson on screen.

Safety: Do not ask for or store personal information (full name, school, address, phone, email, location). Never ask where the child lives. Never ask the child to keep secrets from a parent or trusted adult. If something unsafe comes up, respond briefly and redirect safely.`;
}

type DanHelpHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

type DanHelpPayload = {
  sessionId: string;
  exerciseId: string;
  learnerAnswer?: string | null;
  prompt?: string | null;
  domain?: string | null;
  skillId?: string | null;
  question: string;
  helperName?: string | null;
  learnerName?: string | null;
  learnerSlug?: string | null;
  learnerLevel?: string | null;
  inputSource?: 'text' | 'voice';
  history?: DanHelpHistoryItem[];
};

function buildLessonContextLines(input: {
  prompt?: string | null;
  learnerAnswer?: string | null;
  domain?: string | null;
  skillName?: string | null;
  learnerLevel?: string | null;
}) {
  const lines: string[] = [];
  if (input.prompt) {
    lines.push(`- Question: ${input.prompt.slice(0, 400)}`);
  }
  if (input.learnerAnswer && input.learnerAnswer.trim().length > 0) {
    lines.push(`- Learner answer so far: ${input.learnerAnswer.slice(0, 200)}`);
  }
  if (input.domain) {
    lines.push(`- Domain: ${input.domain}`);
  }
  if (input.skillName) {
    lines.push(`- Skill: ${input.skillName}`);
  }
  if (input.learnerLevel) {
    lines.push(`- Learner level: ${input.learnerLevel}`);
  }
  return lines;
}

function buildHistorySummary(history: DanHelpHistoryItem[], helperName: string): string | null {
  if (!history.length) return null;
  const trimmed = history.slice(-8);
  const parts = trimmed.map((m) => {
    const speaker = m.role === 'user' ? 'Learner' : helperName;
    return `${speaker}: ${m.content.slice(0, 400)}`;
  });
  return parts.join('\n');
}

export async function POST(request: Request) {
  console.log(LOG_PREFIX, 'route hit');
  let body: Partial<DanHelpPayload> = {};

  try {
    body = (await request.json().catch((e) => {
      console.error(LOG_PREFIX, 'request.json catch', e);
      return {};
    })) as Partial<DanHelpPayload>;
  } catch (err) {
    console.error(LOG_PREFIX, 'failed to parse body', err);
    return textPlainError(USER_FACING_ERROR);
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const exerciseId = typeof body.exerciseId === 'string' ? body.exerciseId : '';
  const learnerUtterance = typeof body.question === 'string' ? body.question.trim() : '';

  console.log(LOG_PREFIX, 'body check', {
    hasSessionId: !!sessionId,
    hasExerciseId: !!exerciseId,
    hasQuestion: !!learnerUtterance,
    questionLen: learnerUtterance.length,
  });

  if (!sessionId || !exerciseId || !learnerUtterance) {
    console.error(LOG_PREFIX, 'missing required fields', {
      hasSessionId: !!sessionId,
      hasExerciseId: !!exerciseId,
      hasQuestion: !!learnerUtterance,
    });
    return textPlainError(USER_FACING_ERROR);
  }

  const learnerName = (typeof body.learnerName === 'string' && body.learnerName.trim()) ? body.learnerName.trim() : 'Learner';
  const helperName = body.helperName || (body.learnerSlug === 'elle' ? 'Lila' : 'Dan');
  const learnerAnswer = body.learnerAnswer ?? null;
  const prompt = body.prompt ?? null;
  const domain = body.domain ?? null;
  const learnerLevel = body.learnerLevel ?? null;
  const preferredSkillId = body.skillId ?? null;
  const inputSource = body.inputSource === 'voice' ? 'voice' : 'text';
  const history = Array.isArray(body.history)
    ? body.history
        .slice(-10)
        .filter(
          (m): m is DanHelpHistoryItem =>
            (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string'
        )
        .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }))
    : [];

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error(LOG_PREFIX, 'auth failure', authError?.message);
    return textPlainError(USER_FACING_ERROR);
  }
  console.log(LOG_PREFIX, 'auth ok', { userId: user.id });

  let learnerId: string | null = null;
  let sessionIdForLog: string | null = null;
  let effectiveDomain: string | null = domain;
  let skillName: string | null = null;

  const transcriptMeta: TutorTranscriptMetadata = {};

  try {
    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('id, learner_id, domain')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      console.error(LOG_PREFIX, 'session lookup failed', sessionError?.message);
      return textPlainError(USER_FACING_ERROR);
    }

    if (session.learner_id !== user.id) {
      console.error(LOG_PREFIX, 'forbidden: learner does not own session');
      return textPlainError(USER_FACING_ERROR);
    }

    learnerId = session.learner_id;
    sessionIdForLog = session.id;
    effectiveDomain = effectiveDomain ?? (session as { domain?: string | null }).domain ?? null;

    const { data: exercise, error: exerciseError } = await supabase
      .from('exercises')
      .select('id, prompt, lesson_id')
      .eq('id', exerciseId)
      .maybeSingle();

    if (exerciseError || !exercise) {
      console.error(LOG_PREFIX, 'exercise lookup failed', exerciseError?.message);
      return textPlainError(USER_FACING_ERROR);
    }

    const effectivePrompt = prompt ?? (exercise as { prompt?: string | null }).prompt ?? null;

    const { data: lesson } = await supabase
      .from('lessons')
      .select('skill_id')
      .eq('id', (exercise as { lesson_id?: string | null }).lesson_id)
      .maybeSingle();

    const skillId = (lesson as { skill_id?: string | null } | null)?.skill_id ?? preferredSkillId ?? null;

    transcriptMeta.domain = effectiveDomain ?? undefined;
    transcriptMeta.skill_id = skillId ?? undefined;
    transcriptMeta.exercise_id = exerciseId;
    transcriptMeta.current_question = effectivePrompt ? effectivePrompt.slice(0, 500) : undefined;
    transcriptMeta.learner_answer_at_time = learnerAnswer ?? undefined;

    if (learnerId && sessionIdForLog) {
      try {
        const insertResult = await insertTutorTranscriptRow(supabase, {
          learnerId,
          sessionId: sessionIdForLog,
          helperName,
          role: 'learner',
          content: learnerUtterance.slice(0, 1000),
          inputSource,
          metadata: transcriptMeta,
        });
        if (insertResult.error) {
          console.error(LOG_PREFIX, 'transcript learner insert failed', insertResult.error.message);
        } else {
          console.log(LOG_PREFIX, 'transcript learner insert ok');
        }
      } catch (transcriptErr) {
        console.error(LOG_PREFIX, 'transcript learner insert threw', transcriptErr);
        // Continue; do not block Dan from answering.
      }
    }

    // For now, we keep skillName simple; future versions can enrich this from a dedicated context helper.
    if (skillId) {
      skillName = String(skillId);
    }

    const lessonContextLines = buildLessonContextLines({
      prompt: effectivePrompt,
      learnerAnswer,
      domain: effectiveDomain,
      skillName,
      learnerLevel,
    });

    const historySummary = buildHistorySummary(history, helperName);

    const learnerLine = `Learner says: "${learnerUtterance.slice(0, 500)}"`;

    const sections: string[] = [learnerLine];

    if (lessonContextLines.length > 0) {
      sections.push(`\nLesson context:\n${lessonContextLines.join('\n')}`);
    }

    if (historySummary) {
      sections.push(`\nRecent chat history:\n${historySummary}`);
    }

    const finalUserMessage = sections.join('\n\n');

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      console.error(LOG_PREFIX, 'missing OPENAI_API_KEY');
      return textPlainError(USER_FACING_ERROR);
    }
    console.log(LOG_PREFIX, 'OPENAI_API_KEY present');

    let client: OpenAI;
    try {
      client = getOpenAIClient();
    } catch (clientErr) {
      const msg = clientErr instanceof Error ? clientErr.message : String(clientErr);
      console.error(LOG_PREFIX, 'getOpenAIClient failed', msg, clientErr);
      return textPlainError(USER_FACING_ERROR);
    }

    const model = process.env.OPENAI_DAN_MODEL?.trim() || 'gpt-4o-mini';
    console.log(LOG_PREFIX, 'OpenAI call start (non-streaming)', { model });

    const systemPrompt = buildTutorSystemPrompt(helperName, learnerName);

    let tutorText: string;
    try {
      const response = await client.responses.create({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: finalUserMessage }] },
        ],
        max_output_tokens: 512,
      });
      tutorText = typeof (response as { output_text?: string }).output_text === 'string'
        ? (response as { output_text: string }).output_text
        : '';
    } catch (responsesErr) {
      const errMsg = responsesErr instanceof Error ? responsesErr.message : String(responsesErr);
      console.error(LOG_PREFIX, 'responses.create failed', errMsg, responsesErr);
      return textPlainError(USER_FACING_ERROR);
    }

    const trimmed = (tutorText ?? '').trim();
    const finalText = trimmed || USER_FACING_ERROR;

    if (trimmed && learnerId && sessionIdForLog) {
      try {
        const insertResult = await insertTutorTranscriptRow(supabase, {
          learnerId,
          sessionId: sessionIdForLog,
          helperName,
          role: 'tutor',
          content: trimmed.slice(0, 10000),
          metadata: transcriptMeta,
        });
        if (insertResult.error) {
          console.error(LOG_PREFIX, 'transcript tutor insert failed', insertResult.error.message);
        } else {
          console.log(LOG_PREFIX, 'transcript tutor insert ok');
        }
      } catch (transcriptErr) {
        console.error(LOG_PREFIX, 'transcript tutor insert threw', transcriptErr);
      }
    }

    return new Response(finalText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'unexpected error', err instanceof Error ? err.message : String(err), err);
    return textPlainError(USER_FACING_ERROR);
  }
}

