-- Phase 7: Reading domain — gold-standard skill progression and prerequisites.
-- Order: letter_recognition -> letter_sounds -> phoneme_matching -> blending_cvc -> segmenting -> sight_words -> simple_sentence_reading.
-- Idempotent: fixed UUIDs with ON CONFLICT DO NOTHING / DO UPDATE.

-- =============================================================================
-- READING SKILLS (insert only if not present; update sort_order for existing)
-- =============================================================================
INSERT INTO public.skills (id, domain_id, unit_id, slug, name, sort_order)
SELECT v.id, d.id, u.id, v.slug, v.name, v.sort_order
FROM public.domains d
JOIN public.units u ON u.domain_id = d.id AND u.slug = 'foundations'
CROSS JOIN (VALUES
  ('e0000001-0001-4000-8000-000000000001'::uuid, 'letter-recognition', 'Letter recognition', 0),
  ('e0000002-0001-4000-8000-000000000002'::uuid, 'letter-sounds', 'Letter sounds', 1),
  ('e0000003-0001-4000-8000-000000000003'::uuid, 'phoneme-matching', 'Phoneme matching', 2),
  ('e0000004-0001-4000-8000-000000000004'::uuid, 'blending-cvc', 'Blending CVC words', 3),
  ('e0000005-0001-4000-8000-000000000005'::uuid, 'segmenting', 'Segmenting simple words', 4),
  ('a0000002-0001-4000-8000-000000000002'::uuid, 'sight-words-basic', 'Sight words', 5),
  ('e0000006-0001-4000-8000-000000000006'::uuid, 'simple-sentence-reading', 'Simple sentence reading', 6)
) AS v(id, slug, name, sort_order)
WHERE d.slug = 'reading'
ON CONFLICT (id) DO UPDATE SET sort_order = EXCLUDED.sort_order, name = EXCLUDED.name, unit_id = EXCLUDED.unit_id;

-- Ensure sight-words-basic has correct unit_id and sort_order (from 00006 it may exist without unit)
UPDATE public.skills s
SET unit_id = (SELECT u.id FROM public.units u JOIN public.domains d ON d.id = u.domain_id WHERE d.slug = 'reading' AND u.slug = 'foundations' LIMIT 1),
    sort_order = 5
WHERE s.slug = 'sight-words-basic' AND s.domain_id = (SELECT id FROM public.domains WHERE slug = 'reading' LIMIT 1);

-- =============================================================================
-- SKILL PREREQUISITES (reading chain)
-- =============================================================================
INSERT INTO public.skill_prerequisites (skill_id, prerequisite_skill_id)
SELECT skill_id, prerequisite_skill_id
FROM (VALUES
  ('e0000002-0001-4000-8000-000000000002'::uuid, 'e0000001-0001-4000-8000-000000000001'::uuid),
  ('e0000003-0001-4000-8000-000000000003'::uuid, 'e0000002-0001-4000-8000-000000000002'::uuid),
  ('e0000004-0001-4000-8000-000000000004'::uuid, 'e0000003-0001-4000-8000-000000000003'::uuid),
  ('e0000005-0001-4000-8000-000000000005'::uuid, 'e0000004-0001-4000-8000-000000000004'::uuid),
  ('a0000002-0001-4000-8000-000000000002'::uuid, 'e0000005-0001-4000-8000-000000000005'::uuid),
  ('e0000006-0001-4000-8000-000000000006'::uuid, 'a0000002-0001-4000-8000-000000000002'::uuid)
) AS v(skill_id, prerequisite_skill_id)
ON CONFLICT (skill_id, prerequisite_skill_id) DO NOTHING;

COMMENT ON TABLE public.skill_prerequisites IS 'Phase 7: Reading chain letter_recognition -> ... -> simple_sentence_reading.';
