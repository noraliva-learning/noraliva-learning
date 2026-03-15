import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateLessonPlan } from '@/lib/instruction/instruction-engine';
import { loadInstructionEngineInput } from '@/lib/instruction/load-context';
import { getNextBestSkillForLearner } from '@/lib/instruction/next-skill-engine';
import { createLessonEpisode } from '@/lib/db/lessonEpisode';
import { lessonPlanSchema } from '@/lib/instruction/lesson-plan-schema';
import { z } from 'zod';

const bodySchema = z.object({
  learnerId: z.string().uuid().optional(),
  domain: z.string().min(1).max(50),
  learnerSlug: z.enum(['liv', 'elle']).optional(),
  candidateSkillId: z.string().uuid().optional(),
  candidateSkillName: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    }
    let { domain, learnerSlug, candidateSkillId, candidateSkillName } = parsed.data;
    const learnerId = parsed.data.learnerId ?? user.id;

    if (learnerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (domain !== 'math' && domain !== 'reading') {
      return NextResponse.json({ error: 'Only math and reading domains are supported' }, { status: 400 });
    }

    if (!candidateSkillId) {
      const nextSkill = await getNextBestSkillForLearner(supabase, learnerId, domain);
      if (nextSkill) {
        candidateSkillId = nextSkill.skill_id;
        candidateSkillName = nextSkill.skill_name;
      }
    }

    const input = await loadInstructionEngineInput(
      supabase,
      learnerId,
      domain,
      learnerSlug,
      candidateSkillId,
      candidateSkillName
    );
    if (!input) {
      return NextResponse.json({ error: 'Could not load learner context for domain' }, { status: 400 });
    }

    const { plan, scenes } = await generateLessonPlan(input);
    const validated = lessonPlanSchema.parse({
      ...plan,
      scene_sequence: scenes,
      skill_id: plan.skill_id ?? candidateSkillId ?? undefined,
    });

    const episode = await createLessonEpisode(supabase, {
      learner_id: learnerId,
      domain,
      skill: validated.skill,
      skill_id: validated.skill_id ?? candidateSkillId ?? null,
      lesson_plan: validated,
      generated_by: validated.generated_by,
    });

    return NextResponse.json({
      plan: validated,
      episodeId: episode?.id ?? null,
    });
  } catch (e) {
    console.error('[instruction/generate-plan]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
