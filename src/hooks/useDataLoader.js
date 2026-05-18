/**
 * useDataLoader — fetches all location and resource data on mount.
 *
 * Uses Promise.allSettled so a single failing API does not break the entire load.
 * Returns { locations, resources, loading, error }.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchAllFromOSM } from '../services/overpass';
import { fetchFoodBanks, fetchBuildingPermits } from '../services/soda';
import {
  fetchHospitals,
  fetchSchools,
  fetchLibraries,
  fetchCommunityCentersArcGIS,
} from '../services/arcgis';
import { fetchUserLocations } from '../services/supabase-locations';

/** Extract the fulfilled value from a Promise.allSettled result, or []. */
const val = (result) => (result.status === 'fulfilled' ? result.value : []);

// Labels for each data source — index-aligned with the Promise.allSettled call below.
// Community centers are fetched but contribute only to the resource layer
// (amenity scoring), not the host-site location layer.
const SOURCE_LABELS = [
  { label: 'Churches (OSM)', kind: 'location' },
  { label: 'Community centers (OSM)', kind: 'resource' },
  { label: 'Community centers (King C. ArcGIS)', kind: 'resource' },
  { label: 'Vacant buildings (Seattle SODA)', kind: 'location' },
  { label: 'User locations (Supabase)', kind: 'location' },
  { label: 'Amenities (OSM)', kind: 'resource' },
  { label: 'Transit stops (OSM)', kind: 'resource' },
  { label: 'Food banks (Seattle SODA)', kind: 'resource' },
  { label: 'Hospitals (King C. ArcGIS)', kind: 'resource' },
  { label: 'Schools (King C. ArcGIS)', kind: 'resource' },
  { label: 'Libraries (King C. ArcGIS)', kind: 'resource' },
];

export default function useDataLoader() {
  const [locations, setLocations] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        // One combined Overpass request (rate-limited host); fan out into the
        // four category slots below.
        const osm = fetchAllFromOSM();
        const results = await Promise.allSettled([
          // Host-site locations: churches + vacant buildings + user submissions.
          osm.then((r) => r.churches),          // 0
          // Community centers are amenities; they're fetched here only so the
          // "community" scoring category has data and so they render on the
          // resource layer.
          osm.then((r) => r.communityCenters),  // 1
          fetchCommunityCentersArcGIS(),        // 2
          fetchBuildingPermits(),               // 3
          fetchUserLocations(),                 // 4

          // Other resources (amenities + transit).
          osm.then((r) => r.resources),         // 5
          osm.then((r) => r.transit),           // 6
          fetchFoodBanks(),                     // 7
          fetchHospitals(),                     // 8
          fetchSchools(),                       // 9
          fetchLibraries(),                     // 10
        ]);

        if (cancelled) return;

        // Log any failures for debugging
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.warn(`Data fetch [${i}] failed:`, r.reason);
          }
        });

        const sourceStatus = results.map((r, i) => ({
          label: SOURCE_LABELS[i]?.label || `Source ${i}`,
          kind: SOURCE_LABELS[i]?.kind || 'unknown',
          ok: r.status === 'fulfilled',
          count: r.status === 'fulfilled' ? (r.value?.length ?? 0) : 0,
          error: r.status === 'rejected' ? String(r.reason?.message || r.reason) : null,
        }));
        setSources(sourceStatus);

        const osmCommunityCenters = val(results[1]);
        const arcgisCommunityCenters = val(results[2]);

        const allLocations = [
          ...val(results[0]),  // churches
          ...val(results[3]),  // vacant buildings (building permits)
          ...val(results[4]),  // user locations (Supabase)
        ];

        // Community centers feed the "community" scoring category and render
        // on the resource layer as amenities — never as host-site pins.
        const communityCenterResources = [...osmCommunityCenters, ...arcgisCommunityCenters].map((loc) => ({
          id: `${loc.id}-resource`,
          lat: loc.lat,
          lng: loc.lng,
          name: loc.name,
          resourceType: 'community_center',
          source: loc.source,
        }));

        const allResources = [
          ...val(results[5]),  // OSM resources (grocery, laundromat, pharmacy)
          ...val(results[6]),  // transit
          ...val(results[7]),  // food banks
          ...val(results[8]),  // hospitals
          ...val(results[9]),  // schools
          ...val(results[10]), // libraries
          ...communityCenterResources,
        ];

        setLocations(allLocations);
        setResources(allResources);

        // Set error if ALL fetches failed
        const allFailed = results.every((r) => r.status === 'rejected');
        if (allFailed) {
          setError('All data sources failed to load.');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, []);

  const refetchUserLocations = useCallback(async () => {
    try {
      const userLocs = await fetchUserLocations();
      setLocations((prev) => [
        ...prev.filter((loc) => loc.source !== 'user'),
        ...userLocs,
      ]);
    } catch (err) {
      console.warn('Failed to refetch user locations:', err);
    }
  }, []);

  return { locations, resources, loading, error, sources, refetchUserLocations };
}
