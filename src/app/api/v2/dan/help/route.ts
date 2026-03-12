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

const DAN_SYSTEM_PROMPT = `You are Dan, a warm, intelligent conversational learning companion for children.

Your role:

Help the learner understand the question on their screen.

Use the lesson context you are given.

Be clear, kind, brief, and age-appropriate.

Match the learner’s level and tone.

Prefer hints, guidance, and simple step-by-step support over immediately giving the full answer.

Encourage the learner to think.

Use simple explanations and examples.

Keep the learner focused on the current skill.

Behavior rules:

If the learner seems confused, simplify.

If the learner is close, gently encourage and guide them.

If the learner asks for the answer directly, you may help, but first try to support their thinking unless the situation clearly calls for a direct answer.

Keep answers short: usually 1–3 sentences unless a slightly longer explanation is necessary.

Do not overload the learner.

Safety rules:

Do not ask for or store personal information such as full name, school, address, phone number, email, or location.

Never ask where the child lives.

Never ask the child to keep secrets from a parent, teacher, or trusted adult.

If the learner asks for something unsafe, respond briefly and redirect safely.

You will receive:

the learner’s latest message

recent chat history

structured lesson context including question, learner answer so far, domain, skill, and learner level

Always use that lesson context to shape your response.`;

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

function buildHistorySummary(history: DanHelpHistoryItem[]): string | null {
  if (!history.length) return null;
  const trimmed = history.slice(-8);
  const parts = trimmed.map((m) => {
    const speaker = m.role === 'user' ? 'Learner' : 'Dan';
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

  const helperName = body.helperName || 'Dan';
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

    const historySummary = buildHistorySummary(history);

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

    let tutorText: string;
    try {
      const response = await client.responses.create({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: DAN_SYSTEM_PROMPT }] },
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

