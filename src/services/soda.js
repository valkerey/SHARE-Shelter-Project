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

// ── Building Permits (active commercial permits removing housing — potential vacant buildings) ───

export async function fetchBuildingPermits() {
  const where = encodeURIComponent(
    `permitclass = 'Commercial' ` +
      `AND housingunitsremoved > 0 ` +
      `AND statuscurrent NOT IN ('Completed', 'Expired', 'Closed', 'Canceled', 'Withdrawn') ` +
      `AND latitude IS NOT NULL`,
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
        name: `${r.housingunitsremoved} units removed — ${r.statuscurrent || 'unknown status'}`,
        address: r.originaladdress || r.address || '',
        type: 'vacant_building',
        source: 'seattle_open_data',
        raw: r,
      }),
    );
}
