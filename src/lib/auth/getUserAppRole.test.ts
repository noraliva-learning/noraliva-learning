import { describe, expect, it } from 'vitest';
import { getDashboardPath } from './getUserAppRole';

describe('getDashboardPath', () => {
  it('returns /v2/parent for parent role', () => {
    expect(getDashboardPath({ role: 'parent' })).toBe('/v2/parent');
  });

  it('returns /v2/learners/liv for liv learner', () => {
    expect(getDashboardPath({ role: 'learner', learnerSlug: 'liv' })).toBe('/v2/learners/liv');
  });

  it('returns /v2/learners/elle for elle learner', () => {
    expect(getDashboardPath({ role: 'learner', learnerSlug: 'elle' })).toBe('/v2/learners/elle');
  });
});
