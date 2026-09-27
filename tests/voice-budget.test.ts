import { describe, expect, it } from 'vitest';

import { VoiceBudget } from '../src/audio/VoiceBudget';

describe('VoiceBudget', () => {
  it('drops excess voices and permits a new voice after release', () => {
    const budget = new VoiceBudget(2);

    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(true);
    expect(budget.tryAcquire()).toBe(false);
    expect(budget.getActiveCount()).toBe(2);

    budget.release();

    expect(budget.getActiveCount()).toBe(1);
    expect(budget.tryAcquire()).toBe(true);
    expect(budget.getActiveCount()).toBe(2);
  });

  it('never releases below zero', () => {
    const budget = new VoiceBudget(1);
    budget.release();
    expect(budget.getActiveCount()).toBe(0);
  });
});
