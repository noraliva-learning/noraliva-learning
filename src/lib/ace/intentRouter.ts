/**
 * Deterministic intent router for ACE tutor.
 * Order matters: social intents first, then guide, then content_question.
 */

export type Intent =
  | 'greeting'
  | 'gratitude'
  | 'self_intro'
  | 'meta_question'
  | 'confusion'
  | 'follow_up'
  | 'help_request'
  | 'content_question';

/**
 * Classify the learner's latest message.
 * Social intents => no lesson context. Guide => minimal context. Content => full context.
 */
export function classifyIntent(message: string): Intent {
  const m = message.trim().toLowerCase();
  if (m.length === 0) return 'content_question';

  if (/^(hi|hey|hello|howdy|hiya|yo|hi there|hey there)[\s!.]*$/i.test(m) || (m.length <= 12 && /\b(hi|hey|hello)\b/i.test(m))) return 'greeting';
  if (/\b(thank|thanks|thx|ty|thank you|thanks so much|thank ya)\b/i.test(m) || /^tysm$/i.test(m)) return 'gratitude';
  if (/\b(my name is|call me)\s+[a-z]+/i.test(m) || /\b(i'?m|i am)\s+(elle|liv)\b/i.test(m)) return 'self_intro';
  if (/\b(how old are you|your favorite|what'?s your (favorite|name)\s*(again)?\s*$|where do you live|do you have (a )?family|are you (a )?real (robot|person)|what do you look like)\b/i.test(m)) return 'meta_question';
  if (/\b(confused|don'?t get it|don'?t understand|don'?t know|i'?m stuck|i'?m lost|what\?|huh\?|no idea|makes no sense)\b/i.test(m)) return 'confusion';
  if (/\b(and then|what next|next step|what do i do next|what else|tell me more|again\s*[.?]?$|what about|then what|so then|and after that|one more time|go on)\b/i.test(m)) return 'follow_up';
  if (/\b(hint|give me a hint|can you hint|need a hint|little hint|just a hint|one hint)\b/i.test(m) || (m.length <= 25 && /\bhelp\b/i.test(m))) return 'help_request';

  return 'content_question';
}
