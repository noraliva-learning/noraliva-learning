import { describe, expect, it } from 'vitest';
import { getSessionPlanIds } from './sessionPlanUtils';

describe('getSessionPlanIds', () => {
  it('returns empty array for null or undefined', () => {
    expect(getSessionPlanIds(null)).toEqual([]);
    expect(getSessionPlanIds(undefined)).toEqual([]);
  });

  it('returns empty array for non-array', () => {
    expect(getSessionPlanIds({})).toEqual([]);
    expect(getSessionPlanIds('a')).toEqual([]);
  });

  it('returns ids from string array', () => {
    expect(getSessionPlanIds(['id1', 'id2'])).toEqual(['id1', 'id2']);
  });

  it('returns ids from object array (with fallback metadata)', () => {
    expect(
      getSessionPlanIds([
        { id: 'a', fallback: true },
        { id: 'b', fallback: false },
      ])
    ).toEqual(['a', 'b']);
  });

  it('handles mixed format', () => {
    expect(
      getSessionPlanIds(['s1', { id: 's2', fallback: true }])
    ).toEqual(['s1', 's2']);
  });
});
