/**
 * Phase 5: Persist and load derived learner insights.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type LearnerInsightRow = {
  id: string;
  learner_id: string;
  domain: string;
  insight_type: string;
  summary_plain_english: string;
  evidence_summary: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
};

export async function getLearnerInsights(
  supabase: SupabaseClient,
  learnerId: string,
  domain: string
): Promise<LearnerInsightRow[]> {
  const { data, error } = await supabase
    .from('learner_insights')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('domain', domain)
    .order('updated_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as LearnerInsightRow[];
}

export async function upsertLearnerInsight(
  supabase: SupabaseClient,
  payload: {
    learner_id: string;
    domain: string;
    insight_type: string;
    summary_plain_english: string;
    evidence_summary?: Record<string, unknown>;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('learner_insights')
    .upsert(
      {
        learner_id: payload.learner_id,
        domain: payload.domain,
        insight_type: payload.insight_type,
        summary_plain_english: payload.summary_plain_english,
        evidence_summary: payload.evidence_summary ?? {},
        updated_at: new Date().toISOString(),
        version: 1,
      },
      {
        onConflict: 'learner_id,domain,insight_type',
        ignoreDuplicates: false,
      }
    )
    .select('id');
  if (error) {
    console.error('[learnerInsights] upsert error', error);
    return false;
  }
  return true;
}
