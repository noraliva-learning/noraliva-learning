import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateAnswer } from '@/lib/ai/evaluateAnswer';
import { submitAttemptForSession } from '@/lib/db/submitAttemptForSession';

/**
 * AI session flow: submit learner's answer (text).
 * Server loads correct_answer from exercise, evaluates via OpenAI, updates mastery, returns feedback.
 * Client never sees correct_answer.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = body?.sessionId;
    const exerciseId = body?.exerciseId;
    const learnerAnswer = body?.learnerAnswer;
    if (!sessionId || !exerciseId || typeof learnerAnswer !== 'string')
      return NextResponse.json(
        { error: 'Missing or invalid: sessionId, exerciseId, learnerAnswer' },
        { status: 400 }
      );

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('id, learner_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.learner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: exercise, error: exError } = await supabase
      .from('exercises')
      .select('id, prompt, correct_answer, lesson_id')
      .eq('id', exerciseId)
      .single();
    if (exError || !exercise) return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });

    const correctAnswer = (exercise as { correct_answer?: string | null }).correct_answer ?? '';
    const prompt = exercise.prompt;

    const { data: lesson } = await supabase
      .from('lessons')
      .select('skill_id')
      .eq('id', exercise.lesson_id)
      .single();
    const skillId = (lesson as { skill_id?: string } | null)?.skill_id;
    if (!skillId) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

    const evaluation = await evaluateAnswer({
      learnerAnswer,
      correctAnswer,
      prompt,
    });

    const result = await submitAttemptForSession(sessionId, exerciseId, evaluation.correct, {
      masteryDelta: evaluation.mastery_delta,
      misconceptionTag: evaluation.misconception_tag || undefined,
    });

    const dueRows = await supabase
      .from('review_schedule')
      .select('skill_id')
      .eq('learner_id', user.id)
      .lte('next_review_at', new Date().toISOString());
    const dueReviewsCount = dueRows.data?.length ?? 0;

    return NextResponse.json({
      nextStep: 'next' as const,
      masteryLevel: result.masteryLevel,
      microLesson: result.microLesson,
      dueReviewsCount: dueReviewsCount > 0 ? dueReviewsCount : undefined,
      correct: evaluation.correct,
      encouragementMessage: evaluation.encouragement_message,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
