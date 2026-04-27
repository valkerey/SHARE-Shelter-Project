import * as turf from '@turf/turf';
import {
  SATURATION_POINTS,
  RESOURCE_CATEGORIES,
  PRIORITY_MULTIPLIERS,
  SCORE_COLORS,
  BUFFER_INNER_M,
  BUFFER_OUTER_M,
} from '../config/constants';

/**
 * Count resources within a given radius (meters) of a point.
 * Returns an object keyed by resourceType with counts, e.g. { bus_stop: 2, food_bank: 1 }
 */
export function countResourcesInBuffer(lat, lng, radiusMeters, resources) {
  const origin = turf.point([lng, lat]);
  const counts = {};

  for (const resource of resources) {
    const target = turf.point([resource.lng, resource.lat]);
    const dist = turf.distance(origin, target, { units: 'meters' });

    if (dist <= radiusMeters) {
      const type = resource.resourceType;
      counts[type] = (counts[type] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Compute a 0-100 score for a single resource type based on count vs saturation point.
 * Caps at 100.
 */
export function computeCategoryScore(count, saturationPoint) {
  if (saturationPoint <= 0) return 0;
  return Math.min(count / saturationPoint, 1.0) * 100;
}

/**
 * Compute a weighted overall score (0-100) from resource counts and priority settings.
 *
 * For each category in RESOURCE_CATEGORIES:
 *   1. Take the MAX score across resource types in the category (best-of-type)
 *   2. Multiply by the priority weight
 *   3. Accumulate into totalWeighted / totalWeight
 *
 * Why max instead of average: the question SHARE asks is "is there X nearby?"
 * — having a saturated bus network shouldn't be penalized just because there's
 * no light rail. A category is well-served if any of its resources is well-served.
 *
 * Returns Math.round(totalWeighted / totalWeight), or 0 if totalWeight is 0.
 */
export function computeOverallScore(resourceCounts, priorities) {
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const [categoryKey, category] of Object.entries(RESOURCE_CATEGORIES)) {
    const priorityLevel = priorities[categoryKey];
    if (!priorityLevel) continue;

    const weight = PRIORITY_MULTIPLIERS[priorityLevel] || 0;
    if (weight === 0) continue;

    let categoryMax = 0;
    for (const resType of category.resources) {
      const count = resourceCounts[resType] || 0;
      const saturation = SATURATION_POINTS[resType] || 1;
      const score = computeCategoryScore(count, saturation);
      if (score > categoryMax) categoryMax = score;
    }

    totalWeighted += categoryMax * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(totalWeighted / totalWeight);
}

/**
 * Return { color, label } for a given score based on SCORE_COLORS thresholds.
 */
export function getScoreColor(score) {
  if (score >= SCORE_COLORS.great.min) {
    return { color: SCORE_COLORS.great.color, label: SCORE_COLORS.great.label };
  }
  if (score >= SCORE_COLORS.okay.min) {
    return { color: SCORE_COLORS.okay.color, label: SCORE_COLORS.okay.label };
  }
  return { color: SCORE_COLORS.limited.color, label: SCORE_COLORS.limited.label };
}

/**
 * Convenience function: score a single location against all resources.
 * Returns { score, color, label, innerCounts, outerCounts }
 */
export function scoreLocation(lat, lng, resources, priorities) {
  const innerCounts = countResourcesInBuffer(lat, lng, BUFFER_INNER_M, resources);
  const outerCounts = countResourcesInBuffer(lat, lng, BUFFER_OUTER_M, resources);

  const score = computeOverallScore(outerCounts, priorities);
  const { color, label } = getScoreColor(score);

  return { score, color, label, innerCounts, outerCounts };
}
