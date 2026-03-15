import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getLessonEpisode } from '@/lib/db/lessonEpisode';
import { lessonPlanSchema } from '@/lib/instruction/lesson-plan-schema';
import { LearnerTheme } from '@/components/learner-theme/LearnerTheme';
import { LessonPageClient } from './LessonPageClient';

type Props = { params: Promise<{ episodeId: string }> };

export default async function LessonEpisodePage({ params }: Props) {
  const { episodeId } = await params;
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

  const episode = await getLessonEpisode(supabase, episodeId, user.id);
  if (!episode) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">Lesson not found.</p>
        <Link href="/v2/learners/liv" className="ml-4 text-blue-600 underline">Back to arcade</Link>
      </main>
    );
  }

  const planResult = lessonPlanSchema.safeParse(episode.lesson_plan_json);
  if (!planResult.success) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">Invalid lesson data.</p>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const learnerSlug = profile?.role === 'elle' ? 'elle' : 'liv';

  return (
    <LearnerTheme learnerSlug={learnerSlug}>
      <main className="min-h-screen p-6">
        <header className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-bold text-[rgb(var(--learner-text))]">
            {episode.skill} · {episode.domain}
          </h1>
          <Link
            href={`/v2/learners/${learnerSlug}`}
            className="rounded-lg border border-[rgb(var(--learner-border))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]"
          >
            ← Back to arcade
          </Link>
        </header>

        <div className="mx-auto mt-6 max-w-2xl">
          <LessonPageClient
            episodeId={episodeId}
            plan={planResult.data}
            initialSceneIndex={episode.current_scene_index}
            learnerSlug={learnerSlug}
          />
        </div>
      </main>
    </LearnerTheme>
  );
}
