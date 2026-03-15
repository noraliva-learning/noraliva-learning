/**
 * Phase 3: Deterministic lesson plan builder (fallback when AI unavailable).
 * Math domain: counting, addition, subtraction, equal groups.
 * Produces valid LessonPlan + scene sequence.
 */

import type { InstructionEngineInput } from './engine-types';
import type { LessonPlan, SupportLevel, Modality } from './lesson-plan-schema';
import type { LessonScene } from './scene-schema';
import type { LessonPlanningContext } from './planning-context';
import { getLearnerInstructionDefaults } from './learner-defaults';
import { buildWhyThisLessonSummary } from './planning-context';
import { getVisualTeachingTemplateForSkill, getVisualTeachingTemplateForReadingSkill } from './visual-teaching-templates';
import {
  READING_SKILL_PATTERNS,
  getReadingSkillBySlug,
  getFirstReadingSkill,
  type ReadingSkillSlug,
} from '@/lib/curriculum/reading-skill-map';
import type { WorkmatModality } from '@/lib/workmat/workmat-schema';
import { lessonPlanSchema } from './lesson-plan-schema';

const MATH_SKILL_PATTERNS = [
  { slug: 'counting', name: 'Counting', why: 'Building number sense from the start.' },
  { slug: 'addition', name: 'Addition', why: 'Adding groups together is your next step.' },
  { slug: 'subtraction', name: 'Subtraction', why: 'Taking away and finding what is left.' },
  { slug: 'equal-groups', name: 'Equal groups', why: 'Getting ready to see groups that match.' },
] as const;

function pickCandidateSkill(input: InstructionEngineInput): (typeof MATH_SKILL_PATTERNS)[number] {
  const name = (input.candidate_skill_name || '').toLowerCase();
  const slug = (input.candidate_skill_id ? undefined : name) || 'counting';
  for (const p of MATH_SKILL_PATTERNS) {
    if (slug === p.slug || name.includes(p.slug) || name.includes(p.name.toLowerCase())) return p;
  }
  return MATH_SKILL_PATTERNS[0];
}

function pickReadingSkill(input: InstructionEngineInput): (typeof READING_SKILL_PATTERNS)[number] {
  const name = (input.candidate_skill_name || '').toLowerCase();
  const slug = (input.candidate_skill_id ? undefined : name) || READING_SKILL_PATTERNS[0].slug;
  const found = getReadingSkillBySlug(slug) ?? getReadingSkillBySlug(name);
  return found ?? getFirstReadingSkill();
}

function buildScenesForSkill(
  skill: (typeof MATH_SKILL_PATTERNS)[number],
  domain: string,
  supportLevel: string,
  preferShortChunks: boolean,
  includeVisualTeaching: boolean
): LessonScene[] {
  const id = (t: string, i: number) => `scene-${t}-${i}`;
  const voice = (text: string) => (preferShortChunks ? text.split(/[.!]/)[0] + '.' : text);
  const template = includeVisualTeaching ? getVisualTeachingTemplateForSkill(skill.slug) : null;
  const hasVisual = Boolean(template);

  const focus: LessonScene = {
    id: id('focus', 0),
    type: 'focus_scene',
    domain,
    skill: skill.name,
    display_text: `Let's learn ${skill.name}!`,
    voiceover_text: voice(`Let's learn ${skill.name} together. Get ready to focus.`),
    animation_type: 'fade_in',
    interaction_type: 'tap_continue',
    objects: [],
    metadata: {},
  };

  const visualTeaching: LessonScene | null = hasVisual && template
    ? {
        id: id('visual', 1),
        type: 'visual_teaching_sequence',
        domain,
        skill: skill.name,
        display_text: undefined,
        voiceover_text: voice(template.default_voiceover),
        steps: template.steps,
        animation_type: 'fade_in',
        interaction_type: 'tap_continue',
        objects: [],
        metadata: { template_id: template.id },
      }
    : null;

  const conceptIdx = hasVisual ? 2 : 1;
  const concept: LessonScene = {
    id: id('concept', conceptIdx),
    type: 'concept_card',
    domain,
    skill: skill.name,
    display_text: getConceptDisplayText(skill.slug),
    voiceover_text: voice(getConceptVoiceover(skill.slug)),
    animation_type: 'slide_up',
    interaction_type: 'tap_continue',
    objects: [],
    metadata: {},
  };

  const workedIdx = hasVisual ? 3 : 2;
  const worked: LessonScene = {
    id: id('worked', workedIdx),
    type: 'worked_example',
    domain,
    skill: skill.name,
    display_text: getWorkedExampleDisplay(skill.slug),
    voiceover_text: voice(getWorkedExampleVoice(skill.slug)),
    animation_type: 'stagger',
    steps: getWorkedSteps(skill.slug),
    interaction_type: 'tap_continue',
    objects: [],
    metadata: {},
  };

  const manipulativeIdx = hasVisual ? 4 : 3;
  const manipulative: LessonScene = {
    id: id('manipulative', manipulativeIdx),
    type: 'manipulative',
    domain,
    skill: skill.name,
    display_text: 'Move the pieces.',
    voiceover_text: voice('Move the pieces to see how it works.'),
    animation_type: 'scale_in',
    objects: getManipulativeObjects(skill.slug),
    interaction_type: 'tap_object',
    metadata: {},
    workmat: {
      workmat_enabled: true,
      workmat_mode: 'free_sketch',
      workmat_modality: 'build_array',
      target_zones: [],
      trace_paths: [],
      draggable_objects: [],
      expected_marks: [],
      demo_overlays: [],
    },
  };

  const guidedIdx = hasVisual ? 5 : 4;
  const guided: LessonScene = {
    id: id('guided', guidedIdx),
    type: 'guided_try',
    domain,
    skill: skill.name,
    display_text: getGuidedTryPrompt(skill.slug),
    voiceover_text: voice(getGuidedTryVoice(skill.slug)),
    animation_type: 'fade_in',
    interaction_type: 'type_answer',
    expected_answer: getGuidedExpectedAnswer(skill.slug),
    validation_rule: 'numeric_match',
    hints: getHints(skill.slug),
    objects: [],
    metadata: {},
  };

  const independentIdx = hasVisual ? 6 : 5;
  const independent: LessonScene = {
    id: id('independent', independentIdx),
    type: 'independent_try',
    domain,
    skill: skill.name,
    display_text: getIndependentTryPrompt(skill.slug),
    voiceover_text: voice(getIndependentTryVoice(skill.slug)),
    animation_type: 'fade_in',
    interaction_type: 'type_answer',
    expected_answer: getIndependentExpectedAnswer(skill.slug),
    validation_rule: 'numeric_match',
    hints: getHints(skill.slug),
    objects: [],
    metadata: {},
  };

  const hintIdx = hasVisual ? 7 : 6;
  const hintStep: LessonScene = {
    id: id('hint', hintIdx),
    type: 'hint_step',
    domain,
    skill: skill.name,
    display_text: 'Need a hint?',
    voiceover_text: 'You can ask for a hint anytime.',
    hint_index: 0,
    hint_text: getHints(skill.slug)[0],
    animation_type: 'fade_in',
    interaction_type: 'tap_continue',
    objects: [],
    metadata: {},
  };

  const celebrationIdx = hasVisual ? 8 : 7;
  const celebration: LessonScene = {
    id: id('celebration', celebrationIdx),
    type: 'celebration',
    domain,
    skill: skill.name,
    display_text: "You did it!",
    voiceover_text: 'You did it! Great job learning today.',
    animation_type: 'scale_in',
    interaction_type: 'tap_continue',
    xp: 25,
    objects: [],
    metadata: {},
  };

  const base: LessonScene[] = [focus, concept, worked, manipulative, guided, independent, hintStep, celebration];
  if (visualTeaching) base.splice(1, 0, visualTeaching);
  return base;
}

/** Phase 7: Reading domain — same scene flow with reading-specific content and templates. */
function buildScenesForReadingSkill(
  skill: (typeof READING_SKILL_PATTERNS)[number],
  domain: string,
  supportLevel: string,
  preferShortChunks: boolean,
  includeVisualTeaching: boolean
): LessonScene[] {
  const id = (t: string, i: number) => `scene-${t}-${i}`;
  const voice = (text: string) => (preferShortChunks ? text.split(/[.!]/)[0] + '.' : text);
  const template = includeVisualTeaching ? getVisualTeachingTemplateForReadingSkill(skill.slug) : null;
  const hasVisual = Boolean(template);

  const focus: LessonScene = {
    id: id('focus', 0),
    type: 'focus_scene',
    domain,
    skill: skill.name,
    display_text: `Let's practice ${skill.name}!`,
    voiceover_text: voice(`Let's practice ${skill.name} together. Get ready to listen and look.`),
    animation_type: 'fade_in',
    interaction_type: 'tap_continue',
    objects: [],
    metadata: {},
  };

  const visualTeaching: LessonScene | null =
    hasVisual && template
      ? {
          id: id('visual', 1),
          type: 'visual_teaching_sequence',
          domain,
          skill: skill.name,
          display_text: undefined,
          voiceover_text: voice(template.default_voiceover),
          steps: template.steps,
          animation_type: 'fade_in',
          interaction_type: 'tap_continue',
          objects: [],
          metadata: { template_id: template.id },
        }
      : null;

  const conceptIdx = hasVisual ? 2 : 1;
  const concept: LessonScene = {
    id: id('concept', conceptIdx),
    type: 'concept_card',
    domain,
    skill: skill.name,
    display_text: getReadingConceptDisplayText(skill.slug),
    voiceover_text: voice(getReadingConceptVoiceover(skill.slug)),
    animation_type: 'slide_up',
    interaction_type: 'tap_continue',
    objects: [],
    metadata: {},
  };

  const workedIdx = hasVisual ? 3 : 2;
  const worked: LessonScene = {
    id: id('worked', workedIdx),
    type: 'worked_example',
    domain,
    skill: skill.name,
    display_text: getReadingWorkedDisplay(skill.slug),
    voiceover_text: voice(getReadingWorkedVoiceover(skill.slug)),
    animation_type: 'stagger',
    steps: getReadingWorkedSteps(skill.slug),
    interaction_type: 'tap_continue',
    objects: [],
    metadata: {},
  };

  const manipulativeIdx = hasVisual ? 4 : 3;
  const manipulative: LessonScene = {
    id: id('manipulative', manipulativeIdx),
    type: 'manipulative',
    domain,
    skill: skill.name,
    display_text: 'Listen and point.',
    voiceover_text: voice('Listen. Then point to the letter or word.'),
    animation_type: 'scale_in',
    objects: getReadingManipulativeObjects(skill.slug),
    interaction_type: 'tap_object',
    metadata: {},
    workmat: {
      workmat_enabled: true,
      workmat_mode: 'free_sketch',
      workmat_modality: getReadingWorkmatModality(skill.slug),
      target_zones: [],
      trace_paths: [],
      draggable_objects: [],
      expected_marks: [],
      demo_overlays: [],
    },
  };

  const guidedIdx = hasVisual ? 5 : 4;
  const guided: LessonScene = {
    id: id('guided', guidedIdx),
    type: 'guided_try',
    domain,
    skill: skill.name,
    display_text: getReadingGuidedPrompt(skill.slug),
    voiceover_text: voice(getReadingGuidedVoiceover(skill.slug)),
    animation_type: 'fade_in',
    interaction_type: 'select_choice',
    expected_answer: getReadingGuidedExpectedAnswer(skill.slug),
    validation_rule: 'exact_match',
    hints: getHintsReading(skill.slug),
    objects: [],
    metadata: {},
  };

  const independentIdx = hasVisual ? 6 : 5;
  const independent: LessonScene = {
    id: id('independent', independentIdx),
    type: 'independent_try',
    domain,
    skill: skill.name,
    display_text: getReadingIndependentPrompt(skill.slug),
    voiceover_text: voice(getReadingIndependentVoiceover(skill.slug)),
    animation_type: 'fade_in',
    interaction_type: 'select_choice',
    expected_answer: getReadingIndependentExpectedAnswer(skill.slug),
    validation_rule: 'exact_match',
    hints: getHintsReading(skill.slug),
    objects: [],
    metadata: {},
  };

  const hintIdx = hasVisual ? 7 : 6;
  const hintStep: LessonScene = {
    id: id('hint', hintIdx),
    type: 'hint_step',
    domain,
    skill: skill.name,
    display_text: 'Need a hint?',
    voiceover_text: 'You can ask for a hint anytime.',
    hint_index: 0,
    hint_text: getHintsReading(skill.slug)[0],
    animation_type: 'fade_in',
    interaction_type: 'tap_continue',
    objects: [],
    metadata: {},
  };

  const celebrationIdx = hasVisual ? 8 : 7;
  const celebration: LessonScene = {
    id: id('celebration', celebrationIdx),
    type: 'celebration',
    domain,
    skill: skill.name,
    display_text: "You did it!",
    voiceover_text: 'You did it! Great reading today.',
    animation_type: 'scale_in',
    interaction_type: 'tap_continue',
    xp: 25,
    objects: [],
    metadata: {},
  };

  const base: LessonScene[] = [focus, concept, worked, manipulative, guided, independent, hintStep, celebration];
  if (visualTeaching) base.splice(1, 0, visualTeaching);
  return base;
}

function getReadingConceptDisplayText(slug: ReadingSkillSlug): string {
  const m: Record<ReadingSkillSlug, string> = {
    'letter-recognition': 'Letters have names and shapes.',
    'letter-sounds': 'Each letter has a sound.',
    'phoneme-matching': 'Match the sound to the letter.',
    'blending-cvc': 'Blend sounds to read the word.',
    'segmenting': 'Break the word into sounds.',
    'sight-words-basic': 'Some words we know by sight.',
    'simple-sentence-reading': 'Read the sentence.',
  };
  return m[slug] ?? 'Listen and look.';
}

function getReadingConceptVoiceover(slug: ReadingSkillSlug): string {
  const m: Record<ReadingSkillSlug, string> = {
    'letter-recognition': 'Letters have names. We say them when we see them.',
    'letter-sounds': 'Each letter makes a sound. Say the sound when you see the letter.',
    'phoneme-matching': 'Listen to the sound. Find the letter that makes that sound.',
    'blending-cvc': 'Say each sound. Then say them fast. That is the word.',
    'segmenting': 'Say the word. Now say it slowly. One sound at a time.',
    'sight-words-basic': 'Some words we learn by heart. We see them and say them.',
    'simple-sentence-reading': 'Read each word. Put them together. That is the sentence.',
  };
  return m[slug] ?? 'Listen and try.';
}

function getReadingWorkedDisplay(slug: ReadingSkillSlug): string {
  const m: Record<ReadingSkillSlug, string> = {
    'letter-recognition': 'This is the letter A.',
    'letter-sounds': 'A says /ă/.',
    'phoneme-matching': '/ă/ → A.',
    'blending-cvc': 'c - a - t → cat.',
    'segmenting': 'cat → c, a, t.',
    'sight-words-basic': 'the',
    'simple-sentence-reading': 'The cat sat.',
  };
  return m[slug] ?? 'Watch.';
}

function getReadingWorkedVoiceover(slug: ReadingSkillSlug): string {
  const m: Record<ReadingSkillSlug, string> = {
    'letter-recognition': 'This is the letter A. Say A.',
    'letter-sounds': 'A says ah. Say ah.',
    'phoneme-matching': 'That sound is ah. The letter A makes that sound.',
    'blending-cvc': 'C, a, t. Say it fast. Cat.',
    'segmenting': 'Cat. Say it slowly. C, a, t.',
    'sight-words-basic': 'This word is the. We see it and say the.',
    'simple-sentence-reading': 'The. Cat. Sat. The cat sat.',
  };
  return m[slug] ?? 'Watch and listen.';
}

function getReadingWorkedSteps(slug: ReadingSkillSlug): { text: string; voiceover?: string }[] {
  const steps: Record<ReadingSkillSlug, { text: string; voiceover?: string }[]> = {
    'letter-recognition': [
      { text: 'See the letter.', voiceover: 'See the letter.' },
      { text: 'Say its name.', voiceover: 'Say its name.' },
    ],
    'letter-sounds': [
      { text: 'See the letter.', voiceover: 'See the letter.' },
      { text: 'Say its sound.', voiceover: 'Say its sound.' },
    ],
    'phoneme-matching': [
      { text: 'Listen to the sound.', voiceover: 'Listen.' },
      { text: 'Point to the letter.', voiceover: 'Point to the letter.' },
    ],
    'blending-cvc': [
      { text: 'Say each sound.', voiceover: 'Say each sound.' },
      { text: 'Blend them.', voiceover: 'Now say it fast.' },
    ],
    'segmenting': [
      { text: 'Say the word.', voiceover: 'Say the word.' },
      { text: 'Say it slowly.', voiceover: 'One sound at a time.' },
    ],
    'sight-words-basic': [
      { text: 'Look at the word.', voiceover: 'Look at the word.' },
      { text: 'Say the word.', voiceover: 'Say the word.' },
    ],
    'simple-sentence-reading': [
      { text: 'Read each word.', voiceover: 'Read each word.' },
      { text: 'Read the sentence.', voiceover: 'Read the whole sentence.' },
    ],
  };
  return steps[slug] ?? [{ text: 'Watch.', voiceover: 'Watch.' }];
}

function getReadingManipulativeObjects(slug: ReadingSkillSlug): { id: string; type: 'text'; label?: string }[] {
  if (slug === 'letter-recognition' || slug === 'letter-sounds') return [{ id: 'letter', type: 'text', label: 'A' }];
  if (slug === 'blending-cvc' || slug === 'segmenting') return [{ id: 'word', type: 'text', label: 'cat' }];
  return [{ id: 'obj1', type: 'text', label: '—' }];
}

function getReadingWorkmatModality(slug: ReadingSkillSlug): WorkmatModality {
  const m: Record<ReadingSkillSlug, WorkmatModality> = {
    'letter-recognition': 'trace_letter',
    'letter-sounds': 'connect_sound_letter',
    'phoneme-matching': 'circle_first_sound',
    'blending-cvc': 'phoneme_tiles_order',
    'segmenting': 'highlight_match',
    'sight-words-basic': 'highlight_match',
    'simple-sentence-reading': 'underline_word_part',
  };
  return m[slug] ?? ('circle_first_sound' as WorkmatModality);
}

function getReadingGuidedPrompt(slug: ReadingSkillSlug): string {
  const m: Record<ReadingSkillSlug, string> = {
    'letter-recognition': 'Which letter is this?',
    'letter-sounds': 'What sound does this letter make?',
    'phoneme-matching': 'Point to the letter that says /ă/.',
    'blending-cvc': 'Blend: c - a - t. What word?',
    'segmenting': 'What sounds do you hear in "cat"?',
    'sight-words-basic': 'Which word is "the"?',
    'simple-sentence-reading': 'Read the sentence.',
  };
  return m[slug] ?? 'Your turn.';
}

function getReadingGuidedVoiceover(slug: ReadingSkillSlug): string {
  return getReadingGuidedPrompt(slug);
}

function getReadingIndependentPrompt(slug: ReadingSkillSlug): string {
  const m: Record<ReadingSkillSlug, string> = {
    'letter-recognition': 'Find the letter A.',
    'letter-sounds': 'Say the sound for A.',
    'phoneme-matching': 'Match the sound to the letter.',
    'blending-cvc': 'Read this word: cat.',
    'segmenting': 'Say the sounds in "cat".',
    'sight-words-basic': 'Point to "the".',
    'simple-sentence-reading': 'Read the sentence aloud.',
  };
  return m[slug] ?? 'Try it yourself.';
}

function getReadingIndependentVoiceover(slug: ReadingSkillSlug): string {
  return getReadingIndependentPrompt(slug);
}

function getReadingGuidedExpectedAnswer(slug: ReadingSkillSlug): string | number {
  const m: Record<ReadingSkillSlug, string | number> = {
    'letter-recognition': 'A',
    'letter-sounds': 'ă',
    'phoneme-matching': 'A',
    'blending-cvc': 'cat',
    'segmenting': 'c,a,t',
    'sight-words-basic': 'the',
    'simple-sentence-reading': 'The cat sat.',
  };
  return m[slug] ?? '—';
}

function getReadingIndependentExpectedAnswer(slug: ReadingSkillSlug): string | number {
  return getReadingGuidedExpectedAnswer(slug);
}

function getHintsReading(slug: ReadingSkillSlug): string[] {
  const m: Record<ReadingSkillSlug, string[]> = {
    'letter-recognition': ['Look at the shape.', 'It is the first letter of the alphabet.'],
    'letter-sounds': ['Say the letter name slowly.', 'The sound is in the middle of "cat".'],
    'phoneme-matching': ['Listen again.', 'It is the sound at the start of "apple".'],
    'blending-cvc': ['Say c. Say a. Say t.', 'Now say them fast.'],
    'segmenting': ['Say "cat" slowly.', 'What is the first sound?'],
    'sight-words-basic': ['Look at the letters: t-h-e.', 'We say "the".'],
    'simple-sentence-reading': ['Read one word at a time.', 'The first word is "the".'],
  };
  return m[slug] ?? ['Take your time.', 'You can try again.'];
}

function getConceptDisplayText(slug: string): string {
  switch (slug) {
    case 'counting':
      return 'Counting means saying numbers in order: 1, 2, 3...';
    case 'addition':
      return 'Addition means putting groups together to find the total.';
    case 'subtraction':
      return 'Subtraction means taking away and seeing what is left.';
    case 'equal-groups':
      return 'Equal groups are groups that have the same number in each.';
    default:
      return 'We will practice this step by step.';
  }
}

function getConceptVoiceover(slug: string): string {
  switch (slug) {
    case 'counting':
      return 'Counting means we say numbers in order: one, two, three.';
    case 'addition':
      return 'When we add, we put groups together and find how many in all.';
    case 'subtraction':
      return 'When we subtract, we take some away and see how many are left.';
    case 'equal-groups':
      return 'Equal groups have the same number in each group.';
    default:
      return 'We will practice this together.';
  }
}

function getWorkedExampleDisplay(slug: string): string {
  switch (slug) {
    case 'counting':
      return 'Count the stars: ★ ★ ★ → 3';
    case 'addition':
      return '2 + 3 = 5. Two blocks and three blocks make five.';
    case 'subtraction':
      return '5 − 2 = 3. Five take away two leaves three.';
    case 'equal-groups':
      return '2 groups of 3 = 6. Two groups with three in each.';
    default:
      return 'Watch how we do one example.';
  }
}

function getWorkedExampleVoice(slug: string): string {
  switch (slug) {
    case 'counting':
      return 'Count the stars with me: one, two, three. So the answer is three.';
    case 'addition':
      return 'Two plus three: we count two, then three more. One two three four five. Five!';
    case 'subtraction':
      return 'Five take away two: we start with five and take two away. One, two, three left.';
    case 'equal-groups':
      return 'Two groups of three: count each group. Three and three makes six.';
    default:
      return 'Watch this example, then you can try.';
  }
}

function getWorkedSteps(slug: string): { text: string; voiceover?: string }[] {
  switch (slug) {
    case 'counting':
      return [
        { text: 'Point to each object.', voiceover: 'Point to each one.' },
        { text: 'Say the number as you go.', voiceover: 'Say the number as you go.' },
        { text: 'The last number is the count.', voiceover: 'The last number is how many.' },
      ];
    case 'addition':
      return [
        { text: 'Count the first group.', voiceover: 'Count the first group.' },
        { text: 'Count the second group.', voiceover: 'Count the second group.' },
        { text: 'Add them together.', voiceover: 'Add them together for the total.' },
      ];
    case 'subtraction':
      return [
        { text: 'Start with the whole amount.', voiceover: 'Start with the whole amount.' },
        { text: 'Take away the second number.', voiceover: 'Take that many away.' },
        { text: 'What is left is the answer.', voiceover: 'What is left is the answer.' },
      ];
    case 'equal-groups':
      return [
        { text: 'Count one group.', voiceover: 'Count how many in one group.' },
        { text: 'Count how many groups.', voiceover: 'Count how many groups.' },
        { text: 'Add or count all.', voiceover: 'Add or count all the objects.' },
      ];
    default:
      return [{ text: 'Step 1.', voiceover: 'Step one.' }, { text: 'Step 2.', voiceover: 'Step two.' }];
  }
}

function getManipulativeObjects(slug: string): { id: string; type: 'block' | 'group'; label?: string; value?: number }[] {
  switch (slug) {
    case 'counting':
      return [
        { id: 'obj-1', type: 'block', label: '1', value: 1 },
        { id: 'obj-2', type: 'block', label: '2', value: 2 },
        { id: 'obj-3', type: 'block', label: '3', value: 3 },
      ];
    case 'addition':
      return [
        { id: 'group-a', type: 'group', label: '2', value: 2 },
        { id: 'group-b', type: 'group', label: '3', value: 3 },
      ];
    case 'subtraction':
      return [
        { id: 'whole', type: 'group', label: '5', value: 5 },
        { id: 'take', type: 'group', label: '2', value: 2 },
      ];
    case 'equal-groups':
      return [
        { id: 'g1', type: 'group', label: '3', value: 3 },
        { id: 'g2', type: 'group', label: '3', value: 3 },
      ];
    default:
      return [{ id: 'obj-1', type: 'block', value: 1 }];
  }
}

function getGuidedTryPrompt(slug: string): string {
  switch (slug) {
    case 'counting':
      return 'How many apples? 🍎 🍎 🍎';
    case 'addition':
      return 'What is 2 + 2?';
    case 'subtraction':
      return 'What is 4 − 1?';
    case 'equal-groups':
      return '2 groups of 2. How many in all?';
    default:
      return 'Your turn. Type your answer.';
  }
}

function getGuidedTryVoice(slug: string): string {
  switch (slug) {
    case 'counting':
      return 'How many apples do you see? Count them and type the number.';
    case 'addition':
      return 'What is two plus two? Type the answer.';
    case 'subtraction':
      return 'What is four take away one? Type the answer.';
    case 'equal-groups':
      return 'Two groups of two. How many in all? Type the number.';
    default:
      return 'Your turn. Type your answer below.';
  }
}

function getGuidedExpectedAnswer(slug: string): string | number {
  switch (slug) {
    case 'counting':
      return 3;
    case 'addition':
      return 4;
    case 'subtraction':
      return 3;
    case 'equal-groups':
      return 4;
    default:
      return 1;
  }
}

function getIndependentTryPrompt(slug: string): string {
  switch (slug) {
    case 'counting':
      return 'Count the dots: ● ● ● ●';
    case 'addition':
      return 'What is 3 + 1?';
    case 'subtraction':
      return 'What is 5 − 2?';
    case 'equal-groups':
      return '3 groups of 2. How many?';
    default:
      return 'Try this one. Type your answer.';
  }
}

function getIndependentTryVoice(slug: string): string {
  switch (slug) {
    case 'counting':
      return 'Count the dots and type how many.';
    case 'addition':
      return 'What is three plus one? Type your answer.';
    case 'subtraction':
      return 'What is five take away two? Type your answer.';
    case 'equal-groups':
      return 'Three groups of two. How many in all? Type the number.';
    default:
      return 'Try this one on your own. Type your answer.';
  }
}

function getIndependentExpectedAnswer(slug: string): string | number {
  switch (slug) {
    case 'counting':
      return 4;
    case 'addition':
      return 4;
    case 'subtraction':
      return 3;
    case 'equal-groups':
      return 6;
    default:
      return 1;
  }
}

function getHints(slug: string): string[] {
  switch (slug) {
    case 'counting':
      return ['Point to each one and say the number.', 'The last number you say is the count.'];
    case 'addition':
      return ['Count the first number, then count on.', 'Put both groups together and count all.'];
    case 'subtraction':
      return ['Start with the first number.', 'Take away the second number. What is left?'];
    case 'equal-groups':
      return ['Count one group first.', 'Then add that number for each group.'];
    default:
      return ['Take your time.', 'You can count with your fingers.'];
  }
}

/**
 * Build a full lesson plan deterministically. Phase 7: math and reading.
 * Phase 5B: Accepts optional planning context; uses context for support_level, modality, and metadata.
 */
export function buildDeterministicLessonPlan(
  input: InstructionEngineInput,
  context?: LessonPlanningContext
): InstructionEngineOutput {
  const defaults = getLearnerInstructionDefaults(input.learner_slug ?? 'liv');
  const support_level = context?.recommended_support_level ?? defaults.support_level;
  const modality = context?.recommended_modality ?? defaults.modality;
  const includeVisualTeaching =
    modality === 'visual' ||
    (context?.insight_types?.some(
      (t) => t === 'workmat_visual_success' || t === 'prefers_narration_replay'
    ) ?? false) ||
    (context?.misconception_tags?.length ? context.misconception_tags.length > 0 : false);

  const isReading = input.domain === 'reading';
  const readingSkill = pickReadingSkill(input);
  const mathSkill = pickCandidateSkill(input);
  const skillName = isReading ? readingSkill.name : mathSkill.name;
  const skillWhy = isReading ? readingSkill.why : mathSkill.why;
  const scenes = isReading
    ? buildScenesForReadingSkill(
        readingSkill,
        input.domain,
        support_level,
        defaults.prefer_shorter_chunks,
        includeVisualTeaching
      )
    : buildScenesForSkill(
        mathSkill,
        input.domain,
        support_level,
        defaults.prefer_shorter_chunks,
        includeVisualTeaching
      );

  const whySummary =
    context &&
    buildWhyThisLessonSummary(context, skillName, support_level, modality, 'deterministic');
  const ace_planning_metadata = context?.buildMetadata({
    support_level_chosen: support_level,
    modality_chosen: modality,
    skill_name: skillName,
    why_advance_or_hold: whySummary,
  });

  const hintLadder = isReading ? getHintsReading(readingSkill.slug) : getHints(mathSkill.slug);
  const plan: LessonPlan = {
    learner_id: input.learner_id,
    domain: input.domain,
    skill: skillName,
    skill_id: input.candidate_skill_id ?? undefined,
    why_next: skillWhy,
    support_level,
    modality,
    scene_sequence: scenes,
    hint_ladder: hintLadder,
    promotion_criteria: {
      correct_independent_try: true,
      require_spaced_check: false,
    },
    promotion_decision: 'advance',
    fallback_retry_plan: { retry_scenes: ['guided_try', 'independent_try'] },
    generated_by: 'deterministic',
    version: '1.0',
    ace_planning_metadata,
  };

  const parsed = lessonPlanSchema.safeParse(plan);
  if (!parsed.success) {
    throw new Error(`Deterministic plan validation failed: ${parsed.error.message}`);
  }

  return { plan: parsed.data, scenes };
}

export interface InstructionEngineOutput {
  plan: LessonPlan;
  scenes: LessonScene[];
}
