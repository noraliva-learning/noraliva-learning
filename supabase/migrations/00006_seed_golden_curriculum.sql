-- Golden Curriculum seed: one unit per domain, at least one skill/lesson/exercise per domain.
-- Idempotent: fixed UUIDs with ON CONFLICT DO NOTHING. Run after 00005.

-- =============================================================================
-- UNITS (one per domain)
-- =============================================================================
INSERT INTO public.units (id, domain_id, slug, name, sort_order)
SELECT
  u.id,
  d.id,
  u.slug,
  u.name,
  0
FROM public.domains d
CROSS JOIN (VALUES
  ('math', 'd0000001-0001-4000-8000-000000000001'::uuid, 'foundations', 'Foundations'),
  ('reading', 'd0000002-0001-4000-8000-000000000002'::uuid, 'foundations', 'Foundations'),
  ('writing', 'd0000003-0001-4000-8000-000000000003'::uuid, 'foundations', 'Foundations'),
  ('architecture', 'd0000004-0001-4000-8000-000000000004'::uuid, 'foundations', 'Foundations'),
  ('spanish', 'd0000005-0001-4000-8000-000000000005'::uuid, 'foundations', 'Foundations')
) AS u(domain_slug, id, slug, name)
WHERE d.slug = u.domain_slug
ON CONFLICT (id) DO NOTHING;

-- Backfill math skill with unit_id (from 00004)
UPDATE public.skills
SET unit_id = (SELECT id FROM public.units WHERE domain_id = (SELECT id FROM public.domains WHERE slug = 'math' LIMIT 1) LIMIT 1),
    sort_order = 0
WHERE slug = 'addition-basic'
  AND domain_id = (SELECT id FROM public.domains WHERE slug = 'math' LIMIT 1)
  AND unit_id IS NULL;

-- Ensure math lesson and exercise have sort_order (00004 already created them)
UPDATE public.lessons SET sort_order = 0 WHERE title = 'Add numbers';
UPDATE public.exercises SET sort_order = 0 WHERE prompt = 'What is 2 + 2?';

-- =============================================================================
-- READING: 1 skill, 1 lesson, 1 exercise
-- =============================================================================
INSERT INTO public.skills (id, domain_id, unit_id, slug, name, sort_order)
SELECT
  'a0000002-0001-4000-8000-000000000002'::uuid,
  d.id,
  u.id,
  'sight-words-basic',
  'Sight words'
FROM public.domains d
JOIN public.units u ON u.domain_id = d.id AND u.slug = 'foundations'
WHERE d.slug = 'reading'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, skill_id, title, sort_order)
SELECT
  'b0000002-0001-4000-8000-000000000002'::uuid,
  s.id,
  'Recognize sight words',
  0
FROM public.skills s
WHERE s.slug = 'sight-words-basic'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exercises (id, lesson_id, prompt, sort_order)
SELECT
  'c0000002-0001-4000-8000-000000000002'::uuid,
  l.id,
  'Which word is "the"?'
FROM public.lessons l
WHERE l.title = 'Recognize sight words'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- WRITING: 1 skill, 1 lesson, 1 exercise
-- =============================================================================
INSERT INTO public.skills (id, domain_id, unit_id, slug, name, sort_order)
SELECT
  'a0000003-0001-4000-8000-000000000003'::uuid,
  d.id,
  u.id,
  'sentences-basic',
  'Simple sentences'
FROM public.domains d
JOIN public.units u ON u.domain_id = d.id AND u.slug = 'foundations'
WHERE d.slug = 'writing'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, skill_id, title, sort_order)
SELECT
  'b0000003-0001-4000-8000-000000000003'::uuid,
  s.id,
  'Write a simple sentence',
  0
FROM public.skills s
WHERE s.slug = 'sentences-basic'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exercises (id, lesson_id, prompt, sort_order)
SELECT
  'c0000003-0001-4000-8000-000000000003'::uuid,
  l.id,
  'Choose the correct end mark: "I like cats"',
  0
FROM public.lessons l
WHERE l.title = 'Write a simple sentence'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ARCHITECTURE: 1 skill, 1 lesson, 1 exercise
-- =============================================================================
INSERT INTO public.skills (id, domain_id, unit_id, slug, name, sort_order)
SELECT
  'a0000004-0001-4000-8000-000000000004'::uuid,
  d.id,
  u.id,
  'shapes-basic',
  'Basic shapes'
FROM public.domains d
JOIN public.units u ON u.domain_id = d.id AND u.slug = 'foundations'
WHERE d.slug = 'architecture'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, skill_id, title, sort_order)
SELECT
  'b0000004-0001-4000-8000-000000000004'::uuid,
  s.id,
  'Identify shapes',
  0
FROM public.skills s
WHERE s.slug = 'shapes-basic'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exercises (id, lesson_id, prompt, sort_order)
SELECT
  'c0000004-0001-4000-8000-000000000004'::uuid,
  l.id,
  'How many sides does a square have?',
  0
FROM public.lessons l
WHERE l.title = 'Identify shapes'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SPANISH: 1 skill, 1 lesson, 1 exercise
-- =============================================================================
INSERT INTO public.skills (id, domain_id, unit_id, slug, name, sort_order)
SELECT
  'a0000005-0001-4000-8000-000000000005'::uuid,
  d.id,
  u.id,
  'greetings-basic',
  'Greetings'
FROM public.domains d
JOIN public.units u ON u.domain_id = d.id AND u.slug = 'foundations'
WHERE d.slug = 'spanish'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, skill_id, title, sort_order)
SELECT
  'b0000005-0001-4000-8000-000000000005'::uuid,
  s.id,
  'Say hello',
  0
FROM public.skills s
WHERE s.slug = 'greetings-basic'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exercises (id, lesson_id, prompt, sort_order)
SELECT
  'c0000005-0001-4000-8000-000000000005'::uuid,
  l.id,
  'How do you say "Hello" in Spanish?',
  0
FROM public.lessons l
WHERE l.title = 'Say hello'
LIMIT 1
ON CONFLICT (id) DO NOTHING;
