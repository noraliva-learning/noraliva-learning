import { describe, it, expect } from 'vitest';
import {
  VISUAL_TEACHING_TEMPLATES,
  getVisualTeachingTemplateForSkill,
  getVisualTeachingTemplateForReadingSkill,
  type VisualTeachingTemplateId,
} from './visual-teaching-templates';

describe('visual-teaching-templates', () => {
  it('exports templates for equal_groups, arrays, counting_groups, addition_combine, subtraction_take_away, number_line_jump', () => {
    const ids: VisualTeachingTemplateId[] = [
      'equal_groups',
      'arrays',
      'counting_groups',
      'number_line_jump',
      'addition_combine',
      'subtraction_take_away',
    ];
    for (const id of ids) {
      const t = VISUAL_TEACHING_TEMPLATES[id];
      expect(t).toBeDefined();
      expect(t.id).toBe(id);
      expect(t.default_voiceover).toBeDefined();
      expect(Array.isArray(t.steps)).toBe(true);
      expect(t.steps.length).toBeGreaterThanOrEqual(1);
      for (const step of t.steps) {
        expect(step.animation).toBeDefined();
      }
    }
  });

  it('getVisualTeachingTemplateForSkill maps skill slug to template', () => {
    expect(getVisualTeachingTemplateForSkill('equal-groups')?.id).toBe('equal_groups');
    expect(getVisualTeachingTemplateForSkill('counting')?.id).toBe('counting_groups');
    expect(getVisualTeachingTemplateForSkill('addition')?.id).toBe('addition_combine');
    expect(getVisualTeachingTemplateForSkill('subtraction')?.id).toBe('subtraction_take_away');
  });

  it('getVisualTeachingTemplateForSkill returns null for unknown skill', () => {
    expect(getVisualTeachingTemplateForSkill('unknown')).toBeNull();
    expect(getVisualTeachingTemplateForSkill('')).toBeNull();
  });

  it('equal_groups template has groups_appear, dots_fill_groups, highlight_rows, rotate_to_array', () => {
    const t = VISUAL_TEACHING_TEMPLATES.equal_groups;
    const anims = t.steps.map((s) => s.animation);
    expect(anims).toContain('groups_appear');
    expect(anims).toContain('dots_fill_groups');
    expect(anims).toContain('highlight_rows');
    expect(anims).toContain('rotate_to_array');
  });

  it('Phase 7: getVisualTeachingTemplateForReadingSkill maps reading slugs', () => {
    expect(getVisualTeachingTemplateForReadingSkill('letter-sounds')?.id).toBe('sound_to_letter_reveal');
    expect(getVisualTeachingTemplateForReadingSkill('blending-cvc')?.id).toBe('blend_sound_sequence');
    expect(getVisualTeachingTemplateForReadingSkill('segmenting')?.id).toBe('segment_into_phonemes');
  });
});
