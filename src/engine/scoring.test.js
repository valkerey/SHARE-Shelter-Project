import { describe, it, expect } from 'vitest';
import { countResourcesInBuffer, computeCategoryScore, computeOverallScore, getScoreColor } from './scoring';

describe('countResourcesInBuffer', () => {
  const resources = [
    { lat: 47.608, lng: -122.335, resourceType: 'bus_stop' },
    { lat: 47.609, lng: -122.336, resourceType: 'bus_stop' },
    { lat: 47.610, lng: -122.337, resourceType: 'food_bank' },
    { lat: 47.700, lng: -122.400, resourceType: 'bus_stop' }, // far away
  ];

  it('counts resources within the buffer radius', () => {
    const counts = countResourcesInBuffer(47.608, -122.335, 1200, resources);
    expect(counts.bus_stop).toBe(2);
    expect(counts.food_bank).toBe(1);
  });

  it('excludes resources outside the buffer', () => {
    const counts = countResourcesInBuffer(47.608, -122.335, 1200, resources);
    expect(counts.bus_stop).toBeLessThan(3);
  });

  it('returns 0 for resource types not present', () => {
    const counts = countResourcesInBuffer(47.608, -122.335, 1200, resources);
    expect(counts.hospital || 0).toBe(0);
  });
});

describe('computeCategoryScore', () => {
  it('returns 100 when at saturation point', () => {
    expect(computeCategoryScore(4, 4)).toBe(100);
  });
  it('caps at 100 when over saturation', () => {
    expect(computeCategoryScore(10, 4)).toBe(100);
  });
  it('returns 50 when at half saturation', () => {
    expect(computeCategoryScore(1, 2)).toBe(50);
  });
  it('returns 0 when count is 0', () => {
    expect(computeCategoryScore(0, 2)).toBe(0);
  });
});

describe('computeOverallScore', () => {
  it('computes weighted score correctly', () => {
    const resourceCounts = { bus_stop: 4, food_bank: 2, school: 0 };
    const priorities = { transit: 'high', food: 'high', education: 'low' };
    const score = computeOverallScore(resourceCounts, priorities);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
  it('returns 0 when no resources nearby', () => {
    const resourceCounts = {};
    const priorities = { transit: 'high', food: 'high' };
    const score = computeOverallScore(resourceCounts, priorities);
    expect(score).toBe(0);
  });
  it('uses max-of-type within a category (rare resource does not drag others down)', () => {
    // Saturated bus_stop, no light_rail -> transit category should still be 100
    const counts = { bus_stop: 10, light_rail: 0 };
    const priorities = { transit: 'high' };
    expect(computeOverallScore(counts, priorities)).toBe(100);
  });
  it('credits a category if any resource type is present', () => {
    // pharmacy present, hospital absent -> health category = 100
    const counts = { pharmacy: 5 };
    const priorities = { health: 'high' };
    expect(computeOverallScore(counts, priorities)).toBe(100);
  });
});

describe('getScoreColor', () => {
  it('returns green for score >= 75', () => {
    expect(getScoreColor(82)).toEqual({ color: '#22c55e', label: 'Great Location' });
  });
  it('returns yellow for score 50-74', () => {
    expect(getScoreColor(60)).toEqual({ color: '#eab308', label: 'Okay Location' });
  });
  it('returns red for score < 50', () => {
    expect(getScoreColor(30)).toEqual({ color: '#ef4444', label: 'Limited Resources' });
  });
});
