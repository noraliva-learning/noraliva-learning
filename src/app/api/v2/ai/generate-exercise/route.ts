import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getLearnerContextForGeneration, getOrCreateLessonForSkill } from '@/lib/ai/getLearnerContextForAI';

const MAX_TOKENS = 1024;
const TEMPERATURE = 0.6;

const SYSTEM_PROMPT = `You are an elite adaptive tutor for a child learner.
Generate ONE learning exercise that sits at the edge of this specific learner's ability.

Rules:
- Use the learner's age and grade to set difficulty and wording (e.g. age 5 / Grade 1 = simpler numbers and language; age 7 / Grade 2 = slightly harder).
- Concise, single clear objective, child-safe content only.
- ADAPT based on the "Last attempt" and "Adaptation" instructions in the user message: if last was correct → slightly harder or next step; if last was incorrect → easier or same skill with more scaffolding; if misconception noted → target that misconception.
- Do NOT repeat any prompt listed in "Do not repeat these exact prompts".
- Encourage reasoning. No violence or inappropriate topics.

Return JSON only, no markdown or explanation outside the JSON:
{
  "prompt": "string",
  "answer_type": "number" | "short_answer" | "multiple_choice",
  "correct_answer": "string",
  "hints": ["string"],
  "skill_focus": "string",
  "difficulty_estimate": number
}`;

type GeneratedExercise = {
  prompt: string;
  answer_type: 'number' | 'short_answer' | 'multiple_choice';
  correct_answer: string;
  hints: string[];
  skill_focus: string;
  difficulty_estimate: number;
};

function parseGeneratedExercise(text: string): GeneratedExercise | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (
      typeof parsed?.prompt === 'string' &&
      typeof parsed?.correct_answer === 'string' &&
      Array.isArray(parsed?.hints)
    ) {
      return {
        prompt: String(parsed.prompt).slice(0, 2000),
        answer_type:
          parsed.answer_type === 'multiple_choice' || parsed.answer_type === 'short_answer'
            ? parsed.answer_type
            : 'number',
        correct_answer: String(parsed.correct_answer).slice(0, 500),
        hints: (parsed.hints as unknown[]).slice(0, 5).map((h) => String(h).slice(0, 200)),
        skill_focus: typeof parsed.skill_focus === 'string' ? parsed.skill_focus.slice(0, 100) : '',
        difficulty_estimate:
          typeof parsed.difficulty_estimate === 'number'
            ? Math.max(0, Math.min(1, parsed.difficulty_estimate))
            : 0.5,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Learner-aware fallback: number range by age; avoid repeating prompts from this session. */
function getFallbackMathExercise(ctx?: {
  age?: number;
  recentPromptsInSession?: string[];
}): GeneratedExercise {
  const age = ctx?.age ?? 6;
  const maxN = age <= 5 ? 5 : age <= 7 ? 8 : 12;
  const seen = new Set((ctx?.recentPromptsInSession ?? []).map((p) => p.trim()));
  let a: number, b: number;
  let tries = 0;
  const maxTries = 25;
  do {
    a = Math.floor(Math.random() * maxN) + 1;
    b = Math.floor(Math.random() * maxN) + 1;
    const prompt = `What is ${a} + ${b}?`;
    if (!seen.has(prompt)) break;
    tries++;
  } while (tries < maxTries);
  return {
    prompt: `What is ${a} + ${b}?`,
    answer_type: 'number',
    correct_answer: String(a + b),
    hints: ['Count on your fingers.', 'Add the first number, then count up.'],
    skill_focus: 'addition',
    difficulty_estimate: age <= 5 ? 0.25 : age <= 7 ? 0.35 : 0.45,
  };
}

export async function POST(request: Request) {
  let body: { sessionId?: string; skillId?: string } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { sessionId?: string; skillId?: string };
    if (!body?.sessionId || typeof body.sessionId !== 'string')
      return NextResponse.json({ error: 'Invalid or missing sessionId' }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: session } = await supabase
      .from('learning_sessions')
      .select('id, learner_id')
      .eq('id', body.sessionId)
      .maybeSingle();
    if (!session || session.learner_id !== user.id)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const ctx = await getLearnerContextForGeneration(
      supabase,
      body.sessionId as string,
      body.skillId as string | undefined
    );
    if (!ctx) {
      const msg = '[generate-exercise] getLearnerContextForGeneration returned null (session/domain/skills)';
      console.error(msg);
      const fallback = getFallbackMathExercise();
      return NextResponse.json({
        ...fallback,
        exerciseId: null,
        skillId: null,
        fallback: true,
        debugReason: 'ctx_null',
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      const fallback = getFallbackMathExercise({ age: ctx.age, recentPromptsInSession: ctx.recentPromptsInSession });
      const lessonId = await getOrCreateLessonForSkill(supabase, ctx.skillId);
      if (lessonId) {
        const { data: ex } = await supabase
          .from('exercises')
          .insert({
            lesson_id: lessonId,
            prompt: fallback.prompt,
            correct_answer: fallback.correct_answer,
            answer_type: fallback.answer_type,
            sort_order: 0,
          })
          .select('id')
          .single();
        if (ex?.id)
          return NextResponse.json({
            ...fallback,
            exerciseId: ex.id,
            skillId: ctx.skillId,
            fallback: true,
          });
      }
      const msg = `[generate-exercise] no OPENAI_API_KEY: getOrCreateLessonForSkill returned ${lessonId ? 'lessonId' : 'null'}${lessonId ? '; exercises insert failed or missing' : ''}`;
      console.error(msg);
      return NextResponse.json({
        ...fallback,
        exerciseId: null,
        skillId: ctx.skillId,
        fallback: true,
        debugReason: lessonId ? 'exercises_insert_failed' : 'lesson_insert_failed',
      });
    }

    const openai = new OpenAI({ apiKey });
    const adaptation =
      ctx.lastAttemptInSession == null
        ? 'This is the first question in this session; choose difficulty appropriate to the learner\'s age and mastery.'
        : ctx.lastAttemptInSession.correct
          ? 'Last attempt was CORRECT. Generate a slightly harder or next-step exercise (same or adjacent skill).'
          : 'Last attempt was INCORRECT. Generate an easier exercise or the same skill with more scaffolding. If the learner has repeated misconceptions listed below, target remediation for that misconception.';
    const noRepeat =
      ctx.recentPromptsInSession.length > 0
        ? `Do not repeat these exact prompts: ${ctx.recentPromptsInSession.slice(0, 15).join(' | ')}`
        : '';
    const userMessage = [
      `Learner: age ${ctx.age}, ${ctx.gradeLabel}.`,
      `Domain: ${ctx.domain}. Skill: ${ctx.skillName} (${ctx.skillSlug}).`,
      `Mastery level (0-5): ${ctx.masteryLevel}. Mastery probability: ${ctx.masteryProbability}.`,
      `Recent performance (last ${ctx.recentPerformance.length}): ${ctx.recentPerformance.map((p) => (p.correct ? 'correct' : 'incorrect')).join(', ') || 'none'}.`,
      `Recent misconceptions: ${ctx.misconceptions.join(', ') || 'none'}.`,
      `Adaptation: ${adaptation}`,
      noRepeat,
      'Generate one exercise.',
    ]
      .filter(Boolean)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      const fallback = getFallbackMathExercise({ age: ctx.age, recentPromptsInSession: ctx.recentPromptsInSession });
      const lessonId = await getOrCreateLessonForSkill(supabase, ctx.skillId);
      let exerciseId: string | null = null;
      if (lessonId) {
        const { data: ex } = await supabase
          .from('exercises')
          .insert({
            lesson_id: lessonId,
            prompt: fallback.prompt,
            correct_answer: fallback.correct_answer,
            answer_type: fallback.answer_type,
            sort_order: 0,
          })
          .select('id')
          .single();
        exerciseId = ex?.id ?? null;
      }
      return NextResponse.json({
        ...fallback,
        exerciseId,
        skillId: ctx.skillId,
        fallback: true,
      });
    }

    const exercise = parseGeneratedExercise(raw);
    if (!exercise) {
      const fallback = getFallbackMathExercise({ age: ctx.age, recentPromptsInSession: ctx.recentPromptsInSession });
      const lessonId = await getOrCreateLessonForSkill(supabase, ctx.skillId);
      let exerciseId: string | null = null;
      if (lessonId) {
        const { data: ex } = await supabase
          .from('exercises')
          .insert({
            lesson_id: lessonId,
            prompt: fallback.prompt,
            correct_answer: fallback.correct_answer,
            answer_type: fallback.answer_type,
            sort_order: 0,
          })
          .select('id')
          .single();
        exerciseId = ex?.id ?? null;
      }
      return NextResponse.json({
        ...fallback,
        exerciseId,
        skillId: ctx.skillId,
        fallback: true,
      });
    }

    const lessonId = await getOrCreateLessonForSkill(supabase, ctx.skillId);
    if (!lessonId)
      return NextResponse.json(
        { error: 'No lesson found for skill' },
        { status: 500 }
      );

    const { data: ex, error: insertError } = await supabase
      .from('exercises')
      .insert({
        lesson_id: lessonId,
        prompt: exercise.prompt,
        correct_answer: exercise.correct_answer,
        answer_type: exercise.answer_type,
        sort_order: 0,
      })
      .select('id')
      .single();

    if (insertError || !ex?.id) {
      const msg = `[generate-exercise] exercises insert failed: ${insertError?.message ?? insertError} code: ${insertError?.code ?? 'n/a'}`;
      console.error(msg);
      const fallback = getFallbackMathExercise({ age: ctx.age, recentPromptsInSession: ctx.recentPromptsInSession });
      return NextResponse.json({
        ...fallback,
        exerciseId: null,
        skillId: ctx.skillId,
        fallback: true,
        debugReason: 'exercises_insert_failed',
        debugMessage: insertError?.message ?? String(insertError),
        debugCode: insertError?.code ?? null,
      });
    }

    return NextResponse.json({
      prompt: exercise.prompt,
      answer_type: exercise.answer_type,
      correct_answer: exercise.correct_answer,
      hints: exercise.hints,
      skill_focus: exercise.skill_focus,
      difficulty_estimate: exercise.difficulty_estimate,
      exerciseId: ex.id,
      skillId: ctx.skillId,
      fallback: false,
    });
  } catch (e) {
    const sessionId = body?.sessionId && typeof body.sessionId === 'string' ? body.sessionId : null;
    let fallback = getFallbackMathExercise();
    if (sessionId) {
      try {
        const supabase = await createClient();
        const ctx = await getLearnerContextForGeneration(supabase, sessionId);
        if (ctx) {
          fallback = getFallbackMathExercise({ age: ctx.age, recentPromptsInSession: ctx.recentPromptsInSession });
          const lessonId = await getOrCreateLessonForSkill(supabase, ctx.skillId);
          if (lessonId) {
            const { data: ex } = await supabase
              .from('exercises')
              .insert({
                lesson_id: lessonId,
                prompt: fallback.prompt,
                correct_answer: fallback.correct_answer,
                answer_type: fallback.answer_type,
                sort_order: 0,
              })
              .select('id')
              .single();
            if (ex?.id)
              return NextResponse.json({
                ...fallback,
                exerciseId: ex.id,
                skillId: ctx.skillId,
                fallback: true,
              });
          }
        }
      } catch {
        /* ignore; fall through to exception response */
      }
    }
    return NextResponse.json({
      ...fallback,
      exerciseId: null,
      skillId: null,
      fallback: true,
      debugReason: 'exception',
      debugMessage: e instanceof Error ? e.message : String(e),
    });
  }
}
