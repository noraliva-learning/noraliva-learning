import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getNextExercise } from '@/lib/db/getNextExercise';
import { EndSessionButton } from './SessionActions';
import { SessionQuestion } from './SessionQuestion';

type Props = {
  params: { sessionId: string };
};

export default async function SessionPage({ params }: Props) {
  const { sessionId } = params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">Not authenticated.</p>
      </main>
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from('learning_sessions')
    .select('id, learner_id, domain, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">Session not found.</p>
      </main>
    );
  }

  if (session.learner_id !== user.id) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-700 font-medium">Not authorized.</p>
        <p className="mt-2 text-sm text-slate-600">You do not have access to this session.</p>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .single();

  const learnerName = profile?.display_name || (profile?.role === 'liv' ? 'Liv' : profile?.role === 'elle' ? 'Elle' : 'Learner');
  const learnerSlug = profile?.role === 'liv' || profile?.role === 'elle' ? profile.role : 'liv';
  const domainLabel = session.domain.charAt(0).toUpperCase() + session.domain.slice(1);

  const exercise = await getNextExercise(session.domain);

  return (
    <main className="min-h-screen p-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Learning Session</h1>
        <Link
          href={`/v2/learners/${learnerSlug}`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← Back to Dashboard
        </Link>
      </header>

      <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="space-y-2 text-slate-700">
          <div>
            <dt className="text-sm font-medium text-slate-500">Learner</dt>
            <dd>{learnerName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Domain</dt>
            <dd>{domainLabel}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Session ID</dt>
            <dd className="font-mono text-sm">{sessionId}</dd>
          </div>
        </dl>

        {exercise ? (
          <SessionQuestion exerciseId={exercise.id} prompt={exercise.prompt} />
        ) : (
          <p className="mt-6 text-slate-600">No exercises for this domain yet.</p>
        )}

        <div className="mt-8">
          <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
        </div>
      </div>
    </main>
  );
}
