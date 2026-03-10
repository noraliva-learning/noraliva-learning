import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getLearnerContextForGeneration } from '@/lib/ai/getLearnerContextForAI';

const MAX_TOKENS = 512;
const TEMPERATURE = 0.5;

const BASE_RULES = `Safety and style rules:
- Use kid-friendly language (simple, clear, encouraging).
- Do NOT ask personal questions (no questions about family, friends, feelings, address, online accounts, or anything outside the lesson).
- Stay focused only on the lesson content (the domain and skill provided).
- Be brief and concrete. Avoid long speeches.
- Use second person ("you") and short sentences.
- Never mention that you are an AI model.

Your job: explain the concept, give 1-3 hints, and offer another example that matches the domain and skill.

Return JSON only, no markdown or explanation outside the JSON:
{
  "explanation": "short paragraph for a kid",
  "hints": ["short hint 1", "short hint 2"],
  "example": "another simple example problem with answer explained"
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
    const explanation = String(parsed.explanation).slice(0, 1000);
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
  const explanation = `Let’s think about ${baseTopic} together. The question is: "${prompt}". Try to picture what the question is really asking before you jump to an answer.`;

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
    hints.push('Ask yourself: “Why does this answer make sense?” and explain it in your own words.');
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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<AceHelpPayload>;
    const sessionId = body.sessionId;
    const exerciseId = body.exerciseId;
    const question = body.question;
    const learnerAnswer = typeof body.learnerAnswer === 'string' ? body.learnerAnswer : undefined;
    const clientPrompt = typeof body.prompt === 'string' ? body.prompt : undefined;
    const clientDomain = typeof body.domain === 'string' ? body.domain : undefined;
    const preferredSkillId = typeof body.skillId === 'string' ? body.skillId : undefined;
    const helperNameFromClient = typeof body.helperName === 'string' ? body.helperName : undefined;
    const learnerNameFromClient = typeof body.learnerName === 'string' ? body.learnerName : undefined;

    if (
      !sessionId ||
      typeof sessionId !== 'string' ||
      !exerciseId ||
      typeof exerciseId !== 'string' ||
      !question ||
      typeof question !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid: sessionId, exerciseId, question' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('id, learner_id, domain')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError || !session)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.learner_id !== user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: exercise, error: exError } = await supabase
      .from('exercises')
      .select('id, prompt, correct_answer, lesson_id')
      .eq('id', exerciseId)
      .single();
    if (exError || !exercise)
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });

    const correctAnswer = (exercise as { correct_answer?: string | null }).correct_answer ?? '';
    const prompt = clientPrompt || (exercise as { prompt?: string }).prompt || '';

    const { data: lesson } = await supabase
      .from('lessons')
      .select('skill_id')
      .eq('id', exercise.lesson_id)
      .single();
    const skillId = (lesson as { skill_id?: string } | null)?.skill_id ?? preferredSkillId;

    let skillName: string | undefined;
    let domainSlug: string | undefined;
    try {
      if (skillId) {
        const ctx = await getLearnerContextForGeneration(supabase, sessionId, skillId);
        if (ctx) {
          skillName = ctx.skillName;
          domainSlug = ctx.domain;
        }
      }
    } catch {
      // If context loading fails, we still provide basic help.
    }

    const effectiveDomain = clientDomain || domainSlug || (session as { domain?: string }).domain;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      const fallback = fallbackAceHelp({
        prompt,
        learnerAnswer,
        correctAnswer,
        domain: effectiveDomain,
        skillName,
      });
      return NextResponse.json({
        ...fallback,
        model: 'fallback',
        fallback: true,
      });
    }

    const openai = new OpenAI({ apiKey });

    const resolvedHelperName = helperNameFromClient || 'Ace';
    const resolvedLearnerName = learnerNameFromClient || 'the learner';
    const systemPrompt = `You are a friendly robot named ${resolvedHelperName} who helps ${resolvedLearnerName} learn.

${BASE_RULES}`;
    const userMessage = [
      effectiveDomain ? `Domain: ${effectiveDomain}.` : null,
      skillName ? `Skill: ${skillName}.` : null,
      `Session question/prompt: ${prompt.slice(0, 500) || '(unknown prompt)'}.`,
      `Correct answer (do not reveal directly; only use to guide hints and explanations): ${String(
        correctAnswer
      ).slice(0, 300) || '(unknown)'}.`,
      `Learner's current answer: ${
        learnerAnswer && learnerAnswer.trim()
          ? learnerAnswer.slice(0, 300)
          : '(has not answered yet or answer not provided)'
      }.`,
      `Learner's question for Ace: ${question.slice(0, 400)}.`,
    ]
      .filter(Boolean)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      const fallback = fallbackAceHelp({
        prompt,
        learnerAnswer,
        correctAnswer,
        domain: effectiveDomain,
        skillName,
      });
      return NextResponse.json({
        ...fallback,
        model: 'fallback',
        fallback: true,
      });
    }

    const parsed = parseAceHelp(raw);
    if (!parsed) {
      const fallback = fallbackAceHelp({
        prompt,
        learnerAnswer,
        correctAnswer,
        domain: effectiveDomain,
        skillName,
      });
      return NextResponse.json({
        ...fallback,
        model: 'fallback',
        fallback: true,
      });
    }

    return NextResponse.json({
      ...parsed,
      model: 'openai',
      fallback: false,
    });
  } catch (e) {
    const body = (await request.clone().json().catch(() => ({}))) as Partial<AceHelpPayload>;
    const clientPrompt = typeof body.prompt === 'string' ? body.prompt : '';
    const learnerAnswer = typeof body.learnerAnswer === 'string' ? body.learnerAnswer : undefined;
    const fallback = fallbackAceHelp({
      prompt: clientPrompt,
      learnerAnswer,
      correctAnswer: undefined,
      domain: typeof body.domain === 'string' ? body.domain : undefined,
      skillName: undefined,
    });
    return NextResponse.json({
      ...fallback,
      model: 'fallback',
      fallback: true,
      error: e instanceof Error ? e.message : 'Server error',
    });
  }
}

