-- Seed one Math skill, one lesson, and one exercise for the vertical slice (Start Mission → 1 answer → mastery).
-- Idempotent: fixed UUIDs with ON CONFLICT DO NOTHING.

INSERT INTO public.skills (id, domain_id, slug, name)
SELECT
  'a0000001-0001-4000-8000-000000000001'::uuid,
  d.id,
  'addition-basic',
  'Basic addition'
FROM public.domains d
WHERE d.slug = 'math'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, skill_id, title)
SELECT
  'b0000001-0001-4000-8000-000000000001'::uuid,
  s.id,
  'Add numbers'
FROM public.skills s
WHERE s.slug = 'addition-basic'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exercises (id, lesson_id, prompt)
SELECT
  'c0000001-0001-4000-8000-000000000001'::uuid,
  l.id,
  'What is 2 + 2?'
FROM public.lessons l
WHERE l.title = 'Add numbers'
LIMIT 1
ON CONFLICT (id) DO NOTHING;
