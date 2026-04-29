/**
 * Overpass API service — fetches POI data from OpenStreetMap.
 *
 * All categories (churches, community centers, resources, transit) are fetched
 * in a single combined query because overpass-api.de enforces a 2-concurrent-
 * slot per-IP rate limit; parallel category fetches would return HTTP 429.
 */

import { normalizeLocation, normalizeResource } from '../utils/normalize';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = '47.49,-122.44,47.74,-122.24';

const COMBINED_QUERY = `
  [out:json][timeout:60];
  (
    node["amenity"="place_of_worship"](${BBOX});
    way["amenity"="place_of_worship"](${BBOX});
    node["amenity"="community_centre"](${BBOX});
    way["amenity"="community_centre"](${BBOX});
    node["shop"="supermarket"](${BBOX});
    way["shop"="supermarket"](${BBOX});
    node["shop"="laundry"](${BBOX});
    way["shop"="laundry"](${BBOX});
    node["amenity"="laundry"](${BBOX});
    way["amenity"="laundry"](${BBOX});
    node["amenity"="pharmacy"](${BBOX});
    way["amenity"="pharmacy"](${BBOX});
    node["highway"="bus_stop"](${BBOX});
    node["railway"="station"](${BBOX});
    way["railway"="station"](${BBOX});
    node["railway"="halt"](${BBOX});
    way["railway"="halt"](${BBOX});
  );
  out center;
`;

function coords(el) {
  return {
    lat: el.lat ?? el.center?.lat,
    lng: el.lon ?? el.center?.lon,
  };
}

function toLocation(el, type) {
  const { lat, lng } = coords(el);
  const t = el.tags || {};
  return normalizeLocation({
    id: `osm-${el.id}`,
    lat,
    lng,
    name: t.name,
    address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
    type,
    source: 'osm',
    contact: {
      phone: t.phone || t['contact:phone'] || '',
      website: t.website || t['contact:website'] || '',
      email: t.email || t['contact:email'] || '',
    },
    raw: t,
  });
}

function toResource(el, resourceType) {
  const { lat, lng } = coords(el);
  const t = el.tags || {};
  return normalizeResource({
    id: `osm-${el.id}`,
    lat,
    lng,
    name: t.name,
    address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
    resourceType,
    source: 'osm',
    contact: {
      phone: t.phone || t['contact:phone'] || '',
      website: t.website || t['contact:website'] || '',
      email: t.email || t['contact:email'] || '',
    },
    raw: t,
  });
}

/**
 * Fetch every OSM layer in one Overpass request and partition by tag.
 * Returns { churches, communityCenters, resources, transit }.
 */
export async function fetchAllFromOSM() {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(COMBINED_QUERY)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  const json = await res.json();

  const churches = [];
  const communityCenters = [];
  const resources = [];
  const transit = [];

  for (const el of json.elements || []) {
    const { lat, lng } = coords(el);
    if (!lat || !lng) continue;
    const t = el.tags || {};
    if (t.amenity === 'place_of_worship') {
      churches.push(toLocation(el, 'church'));
    } else if (t.amenity === 'community_centre') {
      communityCenters.push(toLocation(el, 'community_center'));
    } else if (t.shop === 'supermarket') {
      resources.push(toResource(el, 'grocery'));
    } else if (t.shop === 'laundry' || t.amenity === 'laundry') {
      resources.push(toResource(el, 'laundromat'));
    } else if (t.amenity === 'pharmacy') {
      resources.push(toResource(el, 'pharmacy'));
    } else if (t.highway === 'bus_stop') {
      transit.push(toResource(el, 'bus_stop'));
    } else if (t.railway === 'station' || t.railway === 'halt') {
      transit.push(toResource(el, 'light_rail'));
    }
  }

  return { churches, communityCenters, resources, transit };
}
