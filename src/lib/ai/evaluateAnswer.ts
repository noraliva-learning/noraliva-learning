/**
 * Server-side answer evaluation (OpenAI or fallback).
 * Used by evaluate-answer API and submit-answer so correct_answer never goes to client.
 */

import OpenAI from 'openai';

const MAX_TOKENS = 512;
const TEMPERATURE = 0.6;

const SYSTEM_PROMPT = `You are an elite adaptive tutor evaluating a child learner's answer.

Rules:
- Be fair and encouraging.
- Consider partial credit and reasoning quality.
- Identify any misconception (tag) if the answer is wrong or partially wrong.
- Content must be child-safe. Do not produce any inappropriate content.

Return JSON only, no markdown or explanation outside the JSON:
{
  "correct": boolean,
  "reasoning_quality": number between 0 and 1,
  "misconception_tag": "string or empty if none",
  "mastery_delta": number between -0.2 and 0.2 (positive = improved, negative = needs work),
  "encouragement_message": "string"
}`;

export type EvaluationResult = {
  correct: boolean;
  reasoning_quality: number;
  misconception_tag: string;
  mastery_delta: number;
  encouragement_message: string;
};

function parseEvaluation(text: string): EvaluationResult | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (typeof parsed?.correct !== 'boolean') return null;
    const reasoning = typeof parsed.reasoning_quality === 'number' ? Math.max(0, Math.min(1, parsed.reasoning_quality)) : 0.5;
    const delta = typeof parsed.mastery_delta === 'number' ? Math.max(-0.2, Math.min(0.2, parsed.mastery_delta)) : (Boolean(parsed.correct) ? 0.05 : -0.05);
    return {
      correct: Boolean(parsed.correct),
      reasoning_quality: reasoning,
      misconception_tag: typeof parsed.misconception_tag === 'string' ? parsed.misconception_tag.slice(0, 100) : '',
      mastery_delta: delta,
      encouragement_message: typeof parsed.encouragement_message === 'string' ? parsed.encouragement_message.slice(0, 300) : (Boolean(parsed.correct) ? 'Well done!' : 'Keep trying!'),
    };
  } catch {
    return null;
  }
}

function fallbackEvaluation(learnerAnswer: string, correctAnswer: string): EvaluationResult {
  const exactMatch = String(learnerAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
  return {
    correct: exactMatch,
    reasoning_quality: exactMatch ? 0.8 : 0.3,
    misconception_tag: exactMatch ? '' : 'possible_misconception',
    mastery_delta: exactMatch ? 0.05 : -0.05,
    encouragement_message: exactMatch ? 'Well done!' : 'Not quite. Check the question and try again.',
  };
}

export async function evaluateAnswer(params: {
  learnerAnswer: string;
  correctAnswer: string;
  prompt: string;
}): Promise<EvaluationResult> {
  const { learnerAnswer, correctAnswer, prompt } = params;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallbackEvaluation(learnerAnswer, correctAnswer);

  try {
    const openai = new OpenAI({ apiKey });
    const userMessage = `Question: ${prompt.slice(0, 500)}\nCorrect answer: ${correctAnswer}\nLearner's answer: ${learnerAnswer.slice(0, 500)}\nEvaluate and return the JSON only.`;

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
    if (!raw) return fallbackEvaluation(learnerAnswer, correctAnswer);
    const result = parseEvaluation(raw);
    if (!result) return fallbackEvaluation(learnerAnswer, correctAnswer);
    return result;
  } catch {
    return fallbackEvaluation(learnerAnswer, correctAnswer);
  }
}
