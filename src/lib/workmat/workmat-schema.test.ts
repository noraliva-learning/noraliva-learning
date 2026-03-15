import { describe, it, expect } from 'vitest';
import {
  sceneWorkmatConfigSchema,
  workmatStateSchema,
  workmatValidationResultSchema,
  strokeSchema,
  workmatModeSchema,
  workmatModalitySchema,
} from './workmat-schema';

describe('workmat-schema', () => {
  describe('sceneWorkmatConfigSchema', () => {
    it('parses minimal config with workmat_enabled', () => {
      const config = sceneWorkmatConfigSchema.parse({
        workmat_enabled: true,
      });
      expect(config.workmat_enabled).toBe(true);
      expect(config.workmat_mode).toBe('free_sketch');
      expect(config.target_zones).toEqual([]);
      expect(config.trace_paths).toEqual([]);
      expect(config.draggable_objects).toEqual([]);
    });

    it('parses structured_worksheet with zones and trace_paths', () => {
      const config = sceneWorkmatConfigSchema.parse({
        workmat_enabled: true,
        workmat_mode: 'structured_worksheet',
        workmat_modality: 'trace_number',
        target_zones: [{ id: 'z1', x: 10, y: 20, width: 80, height: 40 }],
        trace_paths: [{ id: 't1', points: [50, 50, 100, 100] }],
        validation_type: 'trace_completion',
      });
      expect(config.workmat_mode).toBe('structured_worksheet');
      expect(config.workmat_modality).toBe('trace_number');
      expect(config.target_zones).toHaveLength(1);
      expect(config.target_zones[0].id).toBe('z1');
      expect(config.trace_paths[0].id).toBe('t1');
      expect(config.validation_type).toBe('trace_completion');
    });

    it('accepts demo_overlays', () => {
      const config = sceneWorkmatConfigSchema.parse({
        workmat_enabled: true,
        demo_overlays: [
          { type: 'trace_path', trace_path_id: 't1', duration_ms: 2000 },
          { type: 'highlight_zone', zone_id: 'z1' },
        ],
      });
      expect(config.demo_overlays).toHaveLength(2);
      expect(config.demo_overlays![0].type).toBe('trace_path');
      expect(config.demo_overlays![1].type).toBe('highlight_zone');
    });
  });

  describe('workmatModeSchema', () => {
    it('accepts structured_worksheet and free_sketch', () => {
      expect(workmatModeSchema.parse('structured_worksheet')).toBe('structured_worksheet');
      expect(workmatModeSchema.parse('free_sketch')).toBe('free_sketch');
    });
  });

  describe('workmatModalitySchema', () => {
    it('accepts math-first modalities', () => {
      expect(workmatModalitySchema.parse('build_array')).toBe('build_array');
      expect(workmatModalitySchema.parse('trace_number')).toBe('trace_number');
      expect(workmatModalitySchema.parse('circle_answer')).toBe('circle_answer');
      expect(workmatModalitySchema.parse('connect_matches')).toBe('connect_matches');
    });
  });

  describe('strokeSchema', () => {
    it('parses pen stroke', () => {
      const s = strokeSchema.parse({
        tool: 'pen',
        points: [10, 20, 30, 40],
        strokeWidth: 3,
        color: '#1a1a2e',
      });
      expect(s.tool).toBe('pen');
      expect(s.points).toEqual([10, 20, 30, 40]);
    });

    it('parses circle stroke', () => {
      const s = strokeSchema.parse({
        tool: 'circle',
        points: [50, 50, 25],
        strokeWidth: 2,
        color: '#1a1a2e',
      });
      expect(s.tool).toBe('circle');
      expect(s.points).toEqual([50, 50, 25]);
    });
  });

  describe('workmatStateSchema', () => {
    it('parses full state', () => {
      const state = workmatStateSchema.parse({
        strokes: [
          { tool: 'pen', points: [0, 0, 10, 10], strokeWidth: 3, color: '#000' },
        ],
        placed_objects: [{ id: 'obj1', x: 100, y: 100 }],
        connections: [{ fromId: 'a', toId: 'b', points: [0, 0, 50, 50] }],
      });
      expect(state.strokes).toHaveLength(1);
      expect(state.placed_objects).toHaveLength(1);
      expect(state.connections).toHaveLength(1);
    });

    it('defaults empty arrays', () => {
      const state = workmatStateSchema.parse({});
      expect(state.strokes).toEqual([]);
      expect(state.placed_objects).toEqual([]);
      expect(state.connections).toEqual([]);
    });
  });

  describe('workmatValidationResultSchema', () => {
    it('parses result with valid and optional fields', () => {
      const r = workmatValidationResultSchema.parse({
        valid: true,
        validation_type: 'zone_overlap',
        zones_hit: ['z1'],
        trace_completion_percent: 85,
      });
      expect(r.valid).toBe(true);
      expect(r.zones_hit).toEqual(['z1']);
      expect(r.trace_completion_percent).toBe(85);
    });
  });
});
