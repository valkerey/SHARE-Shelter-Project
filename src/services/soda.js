/**
 * Socrata Open Data API (SODA) service — fetches datasets from data.seattle.gov.
 */

import { normalizeLocation, normalizeResource } from '../utils/normalize';

const BASE = 'https://data.seattle.gov/resource';

// ── Food Banks ──────────────────────────────────────────────────────────────

export async function fetchFoodBanks() {
  const url = `${BASE}/kkzf-ntnu.json?$limit=5000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SODA food banks error ${res.status}`);
  const rows = await res.json();

  return rows
    .filter((r) => r.latitude && r.longitude)
    .map((r) =>
      normalizeResource({
        id: `soda-fb-${r.objectid || r._id || Math.random().toString(36).slice(2)}`,
        lat: parseFloat(r.latitude),
        lng: parseFloat(r.longitude),
        name: r.common_name || r.name || '',
        resourceType: 'food_bank',
        source: 'seattle_open_data',
        contact: {
          phone: r.phone_number || '',
          website: r.website || '',
        },
      }),
    );
}

// ── Building Permits (expired commercial — potential vacant buildings) ───────

export async function fetchBuildingPermits() {
  // Permits that expired within the last 12 months
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const where = encodeURIComponent(
    `expiresdate < '${cutoffStr}' AND permitclass = 'Commercial' AND latitude IS NOT NULL`,
  );
  const url = `${BASE}/76t5-zqzr.json?$where=${where}&$limit=5000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SODA permits error ${res.status}`);
  const rows = await res.json();

  return rows
    .filter((r) => r.latitude && r.longitude)
    .map((r) =>
      normalizeLocation({
        id: `soda-permit-${r.applieddate || ''}-${r.permitnum || Math.random().toString(36).slice(2)}`,
        lat: parseFloat(r.latitude),
        lng: parseFloat(r.longitude),
        name: r.description || 'Expired Commercial Permit',
        address: r.originaladdress || r.address || '',
        type: 'vacant_building',
        source: 'seattle_open_data',
        raw: r,
      }),
    );
}
