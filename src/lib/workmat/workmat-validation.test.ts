import { describe, it, expect } from 'vitest';
import {
  pointInZone,
  strokeOverlapsZone,
  objectInZone,
  traceCompletionPercent,
  countMarksInZone,
  connectionMatch,
  runValidation,
} from './workmat-validation';

describe('workmat-validation', () => {
  const zone = { id: 'z1', x: 10, y: 10, width: 80, height: 40 };

  describe('pointInZone', () => {
    it('returns true when point is inside zone', () => {
      expect(pointInZone(50, 30, zone)).toBe(true);
      expect(pointInZone(10, 10, zone)).toBe(true);
      expect(pointInZone(90, 50, zone)).toBe(true);
    });
    it('returns false when point is outside', () => {
      expect(pointInZone(5, 30, zone)).toBe(false);
      expect(pointInZone(100, 30, zone)).toBe(false);
    });
  });

  describe('strokeOverlapsZone', () => {
    it('returns true if any stroke point is inside zone', () => {
      expect(strokeOverlapsZone([0, 0, 50, 25], zone)).toBe(true);
      expect(strokeOverlapsZone([50, 25, 100, 100], zone)).toBe(true);
    });
    it('returns false if no point is inside', () => {
      expect(strokeOverlapsZone([0, 0, 5, 5], zone)).toBe(false);
    });
  });

  describe('objectInZone', () => {
    it('returns true when object center (with default size) is in zone', () => {
      // placed at 10,10 -> center 30,30
      expect(objectInZone({ id: 'a', x: 10, y: 10 }, zone)).toBe(true);
    });
    it('returns false when center is outside', () => {
      expect(objectInZone({ id: 'a', x: -50, y: -50 }, zone)).toBe(false);
    });
  });

  describe('traceCompletionPercent', () => {
    it('returns 0 for empty stroke', () => {
      const path = { id: 't1', points: [0, 0, 100, 100] };
      expect(traceCompletionPercent([], path)).toBe(0);
    });
    it('returns high percent when stroke follows path', () => {
      const path = { id: 't1', points: [0, 0, 50, 50, 100, 100] };
      const stroke = [0, 0, 50, 50, 100, 100];
      expect(traceCompletionPercent(stroke, path, 20)).toBeGreaterThanOrEqual(50);
    });
  });

  describe('countMarksInZone', () => {
    it('counts strokes that have at least one point in zone', () => {
      const strokes = [
        { tool: 'pen', points: [50, 25, 60, 30], strokeWidth: 3, color: '#000' },
        { tool: 'pen', points: [0, 0, 5, 5], strokeWidth: 3, color: '#000' },
      ];
      expect(countMarksInZone(strokes as never, zone)).toBe(1);
    });
  });

  describe('connectionMatch', () => {
    it('returns true when expected pairs match', () => {
      const connections = [
        { fromId: 'a', toId: 'b', points: [0, 0, 1, 1] },
        { fromId: 'c', toId: 'd', points: [2, 2, 3, 3] },
      ];
      expect(
        connectionMatch(connections as never, [
          { fromId: 'a', toId: 'b' },
          { fromId: 'c', toId: 'd' },
        ])
      ).toBe(true);
    });
    it('returns false when pair is missing', () => {
      const connections = [{ fromId: 'a', toId: 'b', points: [0, 0, 1, 1] }];
      expect(
        connectionMatch(connections as never, [
          { fromId: 'a', toId: 'b' },
          { fromId: 'c', toId: 'd' },
        ])
      ).toBe(false);
    });
  });

  describe('runValidation', () => {
    it('target_hit / zone_overlap: valid when at least one stroke hits a zone', () => {
      const config = {
        validation_type: 'zone_overlap',
        target_zones: [zone],
        trace_paths: [],
      };
      const state = {
        strokes: [{ tool: 'pen', points: [50, 25], strokeWidth: 3, color: '#000' }] as never[],
        placed_objects: [],
        connections: [],
      };
      const result = runValidation(config, state);
      expect(result.valid).toBe(true);
      expect(result.zones_hit).toContain('z1');
    });

    it('object_in_zone: valid when all zones have an object', () => {
      const config = {
        validation_type: 'object_in_zone',
        target_zones: [zone],
        trace_paths: [],
      };
      const state = {
        strokes: [],
        placed_objects: [{ id: 'obj1', x: 20, y: 15 }],
        connections: [],
      };
      const result = runValidation(config, state);
      expect(result.valid).toBe(true);
    });

    it('trace_completion: valid when percent >= 70', () => {
      const path = { id: 't1', points: [0, 0, 50, 50, 100, 100] };
      const config = {
        validation_type: 'trace_completion',
        target_zones: [],
        trace_paths: [path],
      };
      const state = {
        strokes: [
          { tool: 'pen', points: [0, 0, 50, 50, 100, 100], strokeWidth: 3, color: '#000' },
        ] as never[],
        placed_objects: [],
        connections: [],
      };
      const result = runValidation(config, state);
      expect(result.trace_completion_percent).toBeDefined();
      expect(result.valid).toBe(result.trace_completion_percent! >= 70);
    });

    it('marks_in_region: valid when count >= min_count', () => {
      const config = {
        validation_type: 'marks_in_region',
        target_zones: [zone],
        trace_paths: [],
        expected_marks: [{ zone_id: 'z1', min_count: 1 }],
      };
      const state = {
        strokes: [
          { tool: 'pen', points: [50, 25, 51, 26], strokeWidth: 3, color: '#000' },
        ] as never[],
        placed_objects: [],
        connections: [],
      };
      const result = runValidation(config, state);
      expect(result.marks_in_region).toBe(1);
      expect(result.valid).toBe(true);
    });

    it('connection_match: valid when connections exist', () => {
      const config = {
        validation_type: 'connection_match',
        target_zones: [],
        trace_paths: [],
      };
      const state = {
        strokes: [],
        placed_objects: [],
        connections: [{ fromId: 'a', toId: 'b', points: [0, 0, 10, 10] }],
      };
      const result = runValidation(config, state);
      expect(result.valid).toBe(true);
    });

    it('default: valid when any strokes or placed_objects', () => {
      const config = { target_zones: [], trace_paths: [] };
      const state = {
        strokes: [{ tool: 'pen', points: [1, 2], strokeWidth: 3, color: '#000' }] as never[],
        placed_objects: [],
        connections: [],
      };
      const result = runValidation(config, state);
      expect(result.valid).toBe(true);
    });
  });
});
