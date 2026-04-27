import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordSubmission, hasExceededLimit, MAX_PER_HOUR, STORAGE_KEY } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes MAX_PER_HOUR = 3', () => {
    expect(MAX_PER_HOUR).toBe(3);
  });

  it('returns false when no submissions recorded', () => {
    expect(hasExceededLimit()).toBe(false);
  });

  it('returns false until MAX_PER_HOUR is reached', () => {
    for (let i = 0; i < MAX_PER_HOUR; i++) {
      expect(hasExceededLimit()).toBe(false);
      recordSubmission();
    }
    expect(hasExceededLimit()).toBe(true);
  });

  it('drops timestamps older than 1 hour', () => {
    const now = Date.now();
    const oneHourAndOneMinAgo = now - (60 * 60 * 1000 + 60 * 1000);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([oneHourAndOneMinAgo, oneHourAndOneMinAgo, oneHourAndOneMinAgo])
    );
    expect(hasExceededLimit()).toBe(false);
  });

  it('survives malformed localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    expect(() => hasExceededLimit()).not.toThrow();
    expect(hasExceededLimit()).toBe(false);
  });
});
