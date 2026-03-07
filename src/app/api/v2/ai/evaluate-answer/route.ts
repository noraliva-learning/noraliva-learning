import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateAnswer } from '@/lib/ai/evaluateAnswer';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const learnerAnswer = body?.learnerAnswer;
    const correctAnswer = body?.correctAnswer;
    const prompt = body?.prompt;
    const skillId = body?.skillId;
    const learnerId = body?.learnerId;
    if (
      typeof learnerAnswer !== 'string' ||
      typeof correctAnswer !== 'string' ||
      typeof prompt !== 'string' ||
      !skillId ||
      !learnerId
    )
      return NextResponse.json(
        { error: 'Missing or invalid: learnerAnswer, correctAnswer, prompt, skillId, learnerId' },
        { status: 400 }
      );

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.id !== learnerId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await evaluateAnswer({ learnerAnswer, correctAnswer, prompt });
    return NextResponse.json(result);
  } catch (e) {
    const body = await request.clone().json().catch(() => ({}));
    const learnerAnswer = (body as { learnerAnswer?: string })?.learnerAnswer;
    const correctAnswer = (body as { correctAnswer?: string })?.correctAnswer;
    const exactMatch =
      typeof learnerAnswer === 'string' &&
      typeof correctAnswer === 'string' &&
      String(learnerAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
    return NextResponse.json({
      correct: exactMatch,
      reasoning_quality: exactMatch ? 0.8 : 0.3,
      misconception_tag: exactMatch ? '' : 'possible_misconception',
      mastery_delta: exactMatch ? 0.05 : -0.05,
      encouragement_message: exactMatch ? 'Well done!' : 'Not quite. Try again.',
    });
  }
}
