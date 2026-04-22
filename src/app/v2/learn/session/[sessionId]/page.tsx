import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SessionFlow } from './SessionFlow';
import { LearnerTheme } from '@/components/learner-theme/LearnerTheme';
import { WorldBackground } from '@/components/phase8/WorldBackground';
import { getLearnerProfile } from '@/lib/learners';
import type { BuddySlug } from '@/lib/supabase/types';
import { isBuddySlug } from '@/lib/buddy/buddyTypes';

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params;
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
    .select('display_name, role, buddy_slug, grade_label')
    .eq('id', user.id)
    .single();

  const learnerName = profile?.display_name || (profile?.role === 'liv' ? 'Liv' : profile?.role === 'elle' ? 'Elle' : 'Learner');
  const learnerSlug = profile?.role === 'liv' || profile?.role === 'elle' ? profile.role : 'liv';
  const domainSlug = session.domain;
  const domainLabel = domainSlug.charAt(0).toUpperCase() + domainSlug.slice(1);
  const fb = getLearnerProfile(learnerSlug);
  const gradeLabel = (profile as { grade_label?: string | null })?.grade_label?.trim() || fb.gradeLabel;
  const rawBuddy = (profile as { buddy_slug?: string | null })?.buddy_slug ?? null;
  const buddySlug: BuddySlug | null = isBuddySlug(rawBuddy) ? rawBuddy : null;

  return (
    <WorldBackground learnerSlug={learnerSlug}>
      <LearnerTheme learnerSlug={learnerSlug} transparentSurface>
        <main className="min-h-screen p-6">
          <header className="mx-auto flex max-w-4xl items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[rgb(var(--learner-text))]">{domainLabel} practice</h1>
              <p className="text-sm text-[rgb(var(--learner-text-muted))]" data-testid="session-grade-line">
                {gradeLabel} · Your buddy is here to help.
              </p>
            </div>
            <Link
              href={`/v2/learners/${learnerSlug}`}
              className="rounded-lg border border-[rgb(var(--learner-border))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]"
            >
              ← Back to my arcade
            </Link>
          </header>

          <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))]/95 p-6 shadow-sm backdrop-blur-sm">
            <p className="text-[rgb(var(--learner-text-muted))]">
              Hey {learnerName}, you&apos;re practicing <strong className="text-[rgb(var(--learner-text))]">{domainLabel}</strong>.
            </p>

            <SessionFlow
              sessionId={sessionId}
              learnerSlug={learnerSlug}
              learnerName={learnerName}
              domain={domainSlug}
              buddySlug={buddySlug}
              gradeLabel={gradeLabel}
            />
          </div>
        </main>
      </LearnerTheme>
    </WorldBackground>
  );
}
