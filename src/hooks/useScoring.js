import { useState, useMemo } from 'react';
import { DEFAULT_PRIORITIES } from '../config/constants';
import { scoreLocation } from '../engine/scoring';

export function useScoring(locations, resources) {
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);

  const scoredLocations = useMemo(() => {
    return locations.map((loc) => {
      const result = scoreLocation(loc.lat, loc.lng, resources, priorities);
      return { ...loc, ...result };
    });
  }, [locations, resources, priorities]);

  return { scoredLocations, priorities, setPriorities };
}
