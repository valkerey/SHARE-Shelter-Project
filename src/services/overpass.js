/**
 * Overpass API service — fetches POI data from OpenStreetMap.
 */

import { normalizeLocation, normalizeResource } from '../utils/normalize';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = '47.49,-122.44,47.74,-122.24';

/**
 * Execute an Overpass QL query and return the elements array.
 */
async function query(ql) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(ql)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  const json = await res.json();
  return json.elements || [];
}

/**
 * Extract lat/lng from an Overpass element (node or way with center).
 */
function coords(el) {
  return {
    lat: el.lat ?? el.center?.lat,
    lng: el.lon ?? el.center?.lon,
  };
}

// ── Churches / Places of Worship ────────────────────────────────────────────

export async function fetchChurches() {
  const ql = `
    [out:json][timeout:30];
    (
      node["amenity"="place_of_worship"](${BBOX});
      way["amenity"="place_of_worship"](${BBOX});
    );
    out center;
  `;
  const elements = await query(ql);

  return elements
    .filter((el) => coords(el).lat && coords(el).lng)
    .map((el) => {
      const { lat, lng } = coords(el);
      const t = el.tags || {};
      return normalizeLocation({
        id: `osm-${el.id}`,
        lat,
        lng,
        name: t.name,
        address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
        type: 'church',
        source: 'osm',
        contact: {
          phone: t.phone || t['contact:phone'] || '',
          website: t.website || t['contact:website'] || '',
          email: t.email || t['contact:email'] || '',
        },
        raw: t,
      });
    });
}

// ── Community Centers ───────────────────────────────────────────────────────

export async function fetchCommunityFromOSM() {
  const ql = `
    [out:json][timeout:30];
    (
      node["amenity"="community_centre"](${BBOX});
      way["amenity"="community_centre"](${BBOX});
    );
    out center;
  `;
  const elements = await query(ql);

  return elements
    .filter((el) => coords(el).lat && coords(el).lng)
    .map((el) => {
      const { lat, lng } = coords(el);
      const t = el.tags || {};
      return normalizeLocation({
        id: `osm-${el.id}`,
        lat,
        lng,
        name: t.name,
        address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
        type: 'community_center',
        source: 'osm',
        contact: {
          phone: t.phone || t['contact:phone'] || '',
          website: t.website || t['contact:website'] || '',
          email: t.email || t['contact:email'] || '',
        },
        raw: t,
      });
    });
}

// ── Resources (grocery, laundromat, pharmacy) ───────────────────────────────

export async function fetchResourcesFromOSM() {
  const ql = `
    [out:json][timeout:30];
    (
      node["shop"="supermarket"](${BBOX});
      way["shop"="supermarket"](${BBOX});
      node["shop"="laundry"](${BBOX});
      way["shop"="laundry"](${BBOX});
      node["amenity"="laundry"](${BBOX});
      way["amenity"="laundry"](${BBOX});
      node["amenity"="pharmacy"](${BBOX});
      way["amenity"="pharmacy"](${BBOX});
    );
    out center;
  `;
  const elements = await query(ql);

  const typeMap = (tags) => {
    if (tags.shop === 'supermarket') return 'grocery';
    if (tags.shop === 'laundry' || tags.amenity === 'laundry') return 'laundromat';
    if (tags.amenity === 'pharmacy') return 'pharmacy';
    return 'unknown';
  };

  return elements
    .filter((el) => coords(el).lat && coords(el).lng)
    .map((el) => {
      const { lat, lng } = coords(el);
      const t = el.tags || {};
      return normalizeResource({
        id: `osm-${el.id}`,
        lat,
        lng,
        name: t.name,
        resourceType: typeMap(t),
        source: 'osm',
      });
    });
}

// ── Transit (bus stops, light rail) ─────────────────────────────────────────

export async function fetchTransitFromOSM() {
  const ql = `
    [out:json][timeout:30];
    (
      node["highway"="bus_stop"](${BBOX});
      node["railway"="station"](${BBOX});
      way["railway"="station"](${BBOX});
      node["railway"="halt"](${BBOX});
      way["railway"="halt"](${BBOX});
    );
    out center;
  `;
  const elements = await query(ql);

  const typeMap = (tags) => {
    if (tags.highway === 'bus_stop') return 'bus_stop';
    if (tags.railway === 'station' || tags.railway === 'halt') return 'light_rail';
    return 'bus_stop';
  };

  return elements
    .filter((el) => coords(el).lat && coords(el).lng)
    .map((el) => {
      const { lat, lng } = coords(el);
      const t = el.tags || {};
      return normalizeResource({
        id: `osm-${el.id}`,
        lat,
        lng,
        name: t.name,
        resourceType: typeMap(t),
        source: 'osm',
      });
    });
}
