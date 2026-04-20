/**
 * useDataLoader — fetches all location and resource data on mount.
 *
 * Uses Promise.allSettled so a single failing API does not break the entire load.
 * Returns { locations, resources, loading, error }.
 */

import { useState, useEffect } from 'react';
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
          // Locations (indices 0-5)
          fetchChurches(),              // 0
          fetchCommunityFromOSM(),      // 1
          fetchCommunityCentersArcGIS(),// 2
          fetchBuildingPermits(),       // 3
          fetchCityProperty(),          // 4
          fetchNonprofitParcels(),      // 5

          // Resources (indices 6-11)
          fetchResourcesFromOSM(),      // 6
          fetchTransitFromOSM(),        // 7
          fetchFoodBanks(),             // 8
          fetchHospitals(),             // 9
          fetchSchools(),               // 10
          fetchLibraries(),             // 11
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
          // user locations would go here (empty for now)
        ];

        const allResources = [
          ...val(results[6]),  // OSM resources (grocery, laundromat, pharmacy)
          ...val(results[7]),  // transit
          ...val(results[8]),  // food banks
          ...val(results[9]),  // hospitals
          ...val(results[10]), // schools
          ...val(results[11]), // libraries
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

  return { locations, resources, loading, error };
}
