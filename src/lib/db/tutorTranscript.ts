/**
 * Tutor transcript: insert a single message row for ACE (Dan/Lila) conversations.
 * Used by the ACE help route; RLS ensures only the learner's own rows can be inserted.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type TutorTranscriptMetadata = {
  domain?: string;
  skill_id?: string;
  exercise_id?: string;
  current_question?: string;
  learner_answer_at_time?: string;
};

export type InsertTutorTranscriptParams = {
  learnerId: string;
  sessionId: string | null;
  helperName: string;
  role: 'learner' | 'tutor' | 'system';
  content: string;
  inputSource?: 'text' | 'voice' | null;
  metadata?: TutorTranscriptMetadata;
};

export async function insertTutorTranscriptRow(
  supabase: SupabaseClient,
  params: InsertTutorTranscriptParams
): Promise<{ error: Error | null }> {
  const { learnerId, sessionId, helperName, role, content, inputSource, metadata } = params;
  const { error } = await supabase.from('tutor_transcript').insert({
    learner_id: learnerId,
    session_id: sessionId || null,
    helper_name: helperName,
    role,
    content: content.slice(0, 10000),
    input_source: role === 'learner' ? (inputSource ?? 'text') : null,
    metadata: metadata ?? {},
  });
  if (error) {
    console.error('[tutorTranscript] insert failed', error.message, error.code);
    return { error };
  }
  return { error: null };
}
