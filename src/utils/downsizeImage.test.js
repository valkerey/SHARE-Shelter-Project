import { describe, it, expect } from 'vitest';
import { calcResizedDimensions, MAX_EDGE_PX } from './downsizeImage';

describe('calcResizedDimensions', () => {
  it('returns original dimensions when smaller than max edge', () => {
    expect(calcResizedDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('scales down landscape image so width = MAX_EDGE_PX', () => {
    const r = calcResizedDimensions(3200, 2400);
    expect(r.width).toBe(MAX_EDGE_PX);
    expect(r.height).toBe(Math.round(MAX_EDGE_PX * (2400 / 3200)));
  });

  it('scales down portrait image so height = MAX_EDGE_PX', () => {
    const r = calcResizedDimensions(2400, 3200);
    expect(r.height).toBe(MAX_EDGE_PX);
    expect(r.width).toBe(Math.round(MAX_EDGE_PX * (2400 / 3200)));
  });

  it('keeps square image square at MAX_EDGE_PX', () => {
    const r = calcResizedDimensions(3000, 3000);
    expect(r.width).toBe(MAX_EDGE_PX);
    expect(r.height).toBe(MAX_EDGE_PX);
  });

  it('exposes MAX_EDGE_PX = 1600', () => {
    expect(MAX_EDGE_PX).toBe(1600);
  });

  it('throws on zero or negative dimensions', () => {
    expect(() => calcResizedDimensions(0, 0)).toThrow();
    expect(() => calcResizedDimensions(0, 100)).toThrow();
    expect(() => calcResizedDimensions(100, -1)).toThrow();
  });
});
