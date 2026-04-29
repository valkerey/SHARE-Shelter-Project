/**
 * useDataLoader — fetches all location and resource data on mount.
 *
 * Uses Promise.allSettled so a single failing API does not break the entire load.
 * Returns { locations, resources, loading, error }.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchChurches,
  fetchCommunityFromOSM,
  fetchResourcesFromOSM,
  fetchTransitFromOSM,
} from '../services/overpass';
import { fetchFoodBanks, fetchBuildingPermits } from '../services/soda';
import {
  fetchHospitals,
  fetchSchools,
  fetchLibraries,
  fetchCommunityCentersArcGIS,
  fetchCityProperty,
  fetchNonprofitParcels,
} from '../services/arcgis';
import { fetchUserLocations } from '../services/supabase-locations';

/** Extract the fulfilled value from a Promise.allSettled result, or []. */
const val = (result) => (result.status === 'fulfilled' ? result.value : []);

// Labels for each data source — index-aligned with the Promise.allSettled call below.
const SOURCE_LABELS = [
  { label: 'Churches (OSM)', kind: 'location' },
  { label: 'Community centers (OSM)', kind: 'location' },
  { label: 'Community centers (ArcGIS)', kind: 'location' },
  { label: 'Vacant buildings (Seattle SODA)', kind: 'location' },
  { label: 'City property (ArcGIS)', kind: 'location' },
  { label: 'Nonprofit parcels (ArcGIS)', kind: 'location' },
  { label: 'User locations (Supabase)', kind: 'location' },
  { label: 'Amenities (OSM)', kind: 'resource' },
  { label: 'Transit stops (OSM)', kind: 'resource' },
  { label: 'Food banks (Seattle SODA)', kind: 'resource' },
  { label: 'Hospitals (ArcGIS)', kind: 'resource' },
  { label: 'Schools (ArcGIS)', kind: 'resource' },
  { label: 'Libraries (ArcGIS)', kind: 'resource' },
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
        const results = await Promise.allSettled([
          // Locations (indices 0-6)
          fetchChurches(),              // 0
          fetchCommunityFromOSM(),      // 1
          fetchCommunityCentersArcGIS(),// 2
          fetchBuildingPermits(),       // 3
          fetchCityProperty(),          // 4
          fetchNonprofitParcels(),      // 5
          fetchUserLocations(),         // 6

          // Resources (indices 7-12)
          fetchResourcesFromOSM(),      // 7
          fetchTransitFromOSM(),        // 8
          fetchFoodBanks(),             // 9
          fetchHospitals(),             // 10
          fetchSchools(),               // 11
          fetchLibraries(),             // 12
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
          ...osmCommunityCenters,
          ...arcgisCommunityCenters,
          ...val(results[3]),  // building permits
          ...val(results[4]),  // city property
          ...val(results[5]),  // nonprofit parcels
          ...val(results[6]),  // user locations (Supabase)
        ];

        // Community centers are dual-purpose: candidate sites AND amenities.
        // Re-emit each one as a resource so the "community" scoring category has data.
        const communityCenterResources = [...osmCommunityCenters, ...arcgisCommunityCenters].map((loc) => ({
          id: `${loc.id}-resource`,
          lat: loc.lat,
          lng: loc.lng,
          name: loc.name,
          resourceType: 'community_center',
          source: loc.source,
        }));

        const allResources = [
          ...val(results[7]),  // OSM resources (grocery, laundromat, pharmacy)
          ...val(results[8]),  // transit
          ...val(results[9]),  // food banks
          ...val(results[10]), // hospitals
          ...val(results[11]), // schools
          ...val(results[12]), // libraries
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
