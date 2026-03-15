import { describe, it, expect } from 'vitest';
import { validateScene, validateSceneSequence } from './scene-schema';

describe('scene-schema', () => {
  describe('lessonSceneSchema', () => {
    it('validates focus_scene', () => {
      const scene = {
        id: 'f1',
        type: 'focus_scene',
        display_text: 'Focus!',
        voiceover_text: 'Get ready.',
      };
      expect(validateScene(scene)).toEqual(
        expect.objectContaining({ id: 'f1', type: 'focus_scene', display_text: 'Focus!' })
      );
    });

    it('validates concept_card', () => {
      const scene = {
        id: 'c1',
        type: 'concept_card',
        domain: 'math',
        skill: 'Counting',
        display_text: 'Count in order.',
        voiceover_text: 'We count one, two, three.',
      };
      expect(validateScene(scene).type).toBe('concept_card');
    });

    it('validates guided_try with expected_answer and hints', () => {
      const scene = {
        id: 'g1',
        type: 'guided_try',
        display_text: 'How many?',
        expected_answer: 3,
        validation_rule: 'numeric_match',
        hints: ['Count them.'],
      };
      const out = validateScene(scene);
      expect(out.type).toBe('guided_try');
      expect((out as { expected_answer?: number }).expected_answer).toBe(3);
    });

    it('rejects invalid scene type', () => {
      expect(() =>
        validateScene({ id: 'x', type: 'invalid_type', display_text: 'Hi' })
      ).toThrow();
    });

    it('rejects missing id', () => {
      expect(() =>
        validateScene({ type: 'focus_scene', display_text: 'Hi' })
      ).toThrow();
    });

    it('Phase 6: validates visual_teaching_sequence with steps', () => {
      const scene = {
        id: 'vts1',
        type: 'visual_teaching_sequence',
        domain: 'math',
        skill: 'Equal groups',
        voiceover_text: 'Multiplication means equal groups.',
        steps: [
          { animation: 'groups_appear' },
          { animation: 'dots_fill_groups' },
          { animation: 'highlight_rows' },
          { animation: 'rotate_to_array' },
        ],
      };
      const out = validateScene(scene);
      expect(out.type).toBe('visual_teaching_sequence');
      expect((out as { steps?: { animation: string }[] }).steps).toHaveLength(4);
      expect((out as { steps: { animation: string }[] }).steps[0].animation).toBe('groups_appear');
    });

    it('validates manipulative scene with workmat config (Phase 4)', () => {
      const scene = {
        id: 'm1',
        type: 'manipulative',
        display_text: 'Move the pieces.',
        objects: [{ id: 'o1', label: '3' }],
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
      const out = validateScene(scene);
      expect(out.type).toBe('manipulative');
      expect((out as { workmat?: { workmat_enabled: boolean } }).workmat?.workmat_enabled).toBe(true);
    });
  });

  describe('sceneSequenceSchema', () => {
    it('validates array of scenes', () => {
      const seq = [
        { id: 'f1', type: 'focus_scene', display_text: 'Focus' },
        { id: 'c1', type: 'celebration', display_text: 'Done!' },
      ];
      expect(validateSceneSequence(seq)).toHaveLength(2);
    });

    it('rejects invalid scene in sequence', () => {
      expect(() =>
        validateSceneSequence([{ id: 'f1', type: 'focus_scene' }, { type: 'bad' }])
      ).toThrow();
    });
  });
});
