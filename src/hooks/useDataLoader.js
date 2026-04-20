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

export default function useDataLoader() {
  const [locations, setLocations] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        const allLocations = [
          ...val(results[0]),  // churches
          ...val(results[1]),  // OSM community centers
          ...val(results[2]),  // ArcGIS community centers
          ...val(results[3]),  // building permits
          ...val(results[4]),  // city property
          ...val(results[5]),  // nonprofit parcels
          ...val(results[6]),  // user locations (Supabase)
        ];

        const allResources = [
          ...val(results[7]),  // OSM resources (grocery, laundromat, pharmacy)
          ...val(results[8]),  // transit
          ...val(results[9]),  // food banks
          ...val(results[10]), // hospitals
          ...val(results[11]), // schools
          ...val(results[12]), // libraries
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

  return { locations, resources, loading, error, refetchUserLocations };
}
