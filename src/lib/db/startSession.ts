'use server';

import { createClient } from '@/lib/supabase/server';

export async function startLearningSession(domain: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('learning_sessions')
    .insert({
      learner_id: user.id,
      domain,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  return { sessionId: data.id as string };
}