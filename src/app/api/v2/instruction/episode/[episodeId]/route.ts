import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLessonEpisode, updateLessonEpisodeProgress } from '@/lib/db/lessonEpisode';
import { lessonPlanSchema } from '@/lib/instruction/lesson-plan-schema';
import { z } from 'zod';

type Params = { params: Promise<{ episodeId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { episodeId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const episode = await getLessonEpisode(supabase, episodeId, user.id);
    if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

    const plan = lessonPlanSchema.safeParse(episode.lesson_plan_json);
    if (!plan.success) {
      return NextResponse.json({ error: 'Invalid lesson plan data' }, { status: 500 });
    }

    return NextResponse.json({
      episodeId: episode.id,
      plan: plan.data,
      currentSceneIndex: episode.current_scene_index,
      completionStatus: episode.completion_status,
      workmatOutput: episode.workmat_output ?? undefined,
    });
  } catch (e) {
    console.error('[instruction/episode] GET', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

const patchBodySchema = z.object({
  current_scene_index: z.number().int().min(0).optional(),
  completion_status: z.enum(['in_progress', 'completed']).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { episodeId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const episode = await getLessonEpisode(supabase, episodeId, user.id);
    if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const ok = await updateLessonEpisodeProgress(supabase, episodeId, user.id, {
      current_scene_index: parsed.data.current_scene_index ?? episode.current_scene_index,
      completion_status: parsed.data.completion_status,
    });
    if (!ok) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[instruction/episode] PATCH', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
