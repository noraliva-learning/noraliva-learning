/**
 * Phase 4: Work Mat — simple validation (zones, trace completion, marks, connections).
 * No handwriting OCR.
 */

import type { TargetZone, Stroke, PlacedObject, Connection, TracePath } from './workmat-schema';

/** Hit test: point (x,y) inside zone */
export function pointInZone(x: number, y: number, zone: TargetZone): boolean {
  return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;
}

/** Stroke overlaps zone if any point is inside */
export function strokeOverlapsZone(points: number[], zone: TargetZone): boolean {
  for (let i = 0; i < points.length; i += 2) {
    if (pointInZone(points[i], points[i + 1], zone)) return true;
  }
  return false;
}

/** Object center in zone */
export function objectInZone(
  placed: PlacedObject,
  zone: TargetZone,
  objectWidth: number = 40,
  objectHeight: number = 40
): boolean {
  const cx = placed.x + objectWidth / 2;
  const cy = placed.y + objectHeight / 2;
  return pointInZone(cx, cy, zone);
}

/** Trace completion: compare stroke points to trace path (simplified — overlap / path length) */
export function traceCompletionPercent(
  strokePoints: number[],
  tracePath: TracePath,
  tolerance: number = 15
): number {
  if (tracePath.points.length < 2) return 0;
  const pathPts = tracePath.points;
  let matched = 0;
  const step = 4;
  for (let i = 0; i < pathPts.length - 1; i += step) {
    const px = pathPts[i];
    const py = pathPts[i + 1];
    const hasNear = strokePoints.some((_, j) => {
      if (j % 2 !== 0) return false;
      const sx = strokePoints[j];
      const sy = strokePoints[j + 1];
      return Math.hypot(sx - px, sy - py) <= tolerance;
    });
    if (hasNear) matched++;
  }
  const total = Math.ceil((pathPts.length / 2 - 1) / (step / 2)) || 1;
  return Math.min(100, Math.round((matched / total) * 100));
}

/** Count stroke points (or circle/line count) inside a zone */
export function countMarksInZone(
  strokes: Stroke[],
  zone: TargetZone,
  options: { countCirclesOnly?: boolean } = {}
): number {
  let count = 0;
  for (const s of strokes) {
    if (options.countCirclesOnly && s.tool !== 'circle') continue;
    if (s.points.length < 2) continue;
    for (let i = 0; i < s.points.length; i += 2) {
      if (pointInZone(s.points[i], s.points[i + 1], zone)) {
        count++;
        break;
      }
    }
  }
  return count;
}

/** Connection match: expected pairs (fromId, toId) match connection list */
export function connectionMatch(
  connections: Connection[],
  expectedPairs: { fromId: string; toId: string }[]
): boolean {
  if (expectedPairs.length === 0) return true;
  const normalized = (c: Connection) =>
    [c.fromId, c.toId].sort().join(':');
  const have = new Set(connections.map(normalized));
  for (const p of expectedPairs) {
    const key = [p.fromId, p.toId].sort().join(':');
    if (!have.has(key)) return false;
  }
  return true;
}

/** Run validation by type; returns summary */
export function runValidation(
  config: {
    validation_type?: string;
    target_zones: TargetZone[];
    trace_paths: TracePath[];
    expected_marks?: { zone_id?: string; min_count?: number }[];
  },
  state: { strokes: Stroke[]; placed_objects: PlacedObject[]; connections: Connection[] }
): { valid: boolean; trace_completion_percent?: number; zones_hit?: string[]; marks_in_region?: number } {
  const zones = config.target_zones;
  const zonesHit: string[] = [];

  switch (config.validation_type) {
    case 'target_hit':
    case 'zone_overlap': {
      for (const z of zones) {
        for (const s of state.strokes) {
          if (strokeOverlapsZone(s.points, z)) {
            zonesHit.push(z.id);
            break;
          }
        }
      }
      const valid = zones.length === 0 || zonesHit.length >= Math.min(1, zones.length);
      return { valid, zones_hit: zonesHit };
    }
    case 'object_in_zone': {
      for (const z of zones) {
        for (const obj of state.placed_objects) {
          if (objectInZone(obj, z)) {
            zonesHit.push(z.id);
            break;
          }
        }
      }
      const valid = zones.length === 0 || zonesHit.length >= zones.length;
      return { valid, zones_hit: zonesHit };
    }
    case 'trace_completion': {
      const path = config.trace_paths[0];
      if (!path) return { valid: true };
      const allPoints = state.strokes.flatMap((s) => s.points);
      const pct = traceCompletionPercent(allPoints, path);
      return { valid: pct >= 70, trace_completion_percent: pct };
    }
    case 'marks_in_region': {
      const expected = config.expected_marks?.[0];
      const zone = zones.find((z) => z.id === expected?.zone_id) ?? zones[0];
      const count = zone ? countMarksInZone(state.strokes, zone) : 0;
      const min = expected?.min_count ?? 1;
      return { valid: count >= min, marks_in_region: count };
    }
    case 'connection_match': {
      const valid = state.connections.length > 0;
      return { valid };
    }
    default:
      return { valid: state.strokes.length > 0 || state.placed_objects.length > 0 };
  }
}
