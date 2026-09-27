import { describe, expect, it } from 'vitest';

import { normalizeGameLanguage } from '../src/app/language';

describe('normalizeGameLanguage', () => {
  it('keeps the baseline language set explicit', () => {
    expect(normalizeGameLanguage('ru-RU')).toBe('ru');
    expect(normalizeGameLanguage('en-US')).toBe('en');
    expect(normalizeGameLanguage(undefined)).toBe('en');
  });
});
