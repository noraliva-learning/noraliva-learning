'use server';

import { createClient } from '@/lib/supabase/server';

export async function endLearningSession(sessionId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('learning_sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('learner_id', user.id);

  if (error) throw new Error(error.message);

  return { ok: true };
}
