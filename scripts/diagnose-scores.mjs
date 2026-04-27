// Diagnostic: fetch real Seattle resources, score a grid of points across Seattle,
// and print the score distribution + per-category breakdown so we can see why
// no locations are scoring "great".

import * as turf from '@turf/turf';

const BBOX = '47.49,-122.44,47.74,-122.24';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const BUFFER_OUTER_M = 1200;

const RESOURCE_CATEGORIES = {
  transit:   { resources: ['bus_stop', 'light_rail'] },
  food:      { resources: ['food_bank', 'grocery'] },
  education: { resources: ['school', 'library'] },
  health:    { resources: ['hospital', 'pharmacy'] },
  community: { resources: ['community_center'] },
  daily:     { resources: ['laundromat'] },
};

const SATURATION_POINTS = {
  bus_stop: 4, light_rail: 1, food_bank: 2, grocery: 2,
  school: 2, hospital: 1, library: 1,
  community_center: 1, laundromat: 1, pharmacy: 1,
};

const DEFAULT_PRIORITIES = {
  transit: 'high', food: 'high', education: 'medium',
  health: 'medium', community: 'low', daily: 'low',
};

const PRIORITY_MULTIPLIERS = { high: 3, medium: 2, low: 1 };

async function overpass(ql, attempt = 1) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(ql)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'User-Agent': 'GEOG469-diagnostic/1.0',
    },
  });
  if (!res.ok) {
    if ((res.status === 429 || res.status === 504) && attempt < 4) {
      const wait = 5000 * attempt;
      console.error(`Overpass ${res.status}, retrying in ${wait}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, wait));
      return overpass(ql, attempt + 1);
    }
    throw new Error(`Overpass ${res.status}`);
  }
  const json = await res.json();
  return json.elements || [];
}

async function arcgisGeojson(url, where = '1=1') {
  const params = new URLSearchParams({ where, outFields: '*', f: 'geojson', outSR: '4326' });
  const res = await fetch(`${url}/query?${params}`);
  if (!res.ok) throw new Error(`ArcGIS ${res.status} for ${url}`);
  return (await res.json()).features || [];
}

function coords(el) { return { lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon }; }

async function fetchTransit() {
  const ql = `
    [out:json][timeout:60];
    (
      node["highway"="bus_stop"](${BBOX});
      node["railway"="station"](${BBOX});
      way["railway"="station"](${BBOX});
      node["railway"="halt"](${BBOX});
      way["railway"="halt"](${BBOX});
    );
    out center;
  `;
  const els = await overpass(ql);
  return els.map((el) => {
    const { lat, lng } = coords(el);
    if (!lat || !lng) return null;
    const t = el.tags || {};
    const resourceType = t.highway === 'bus_stop' ? 'bus_stop' : 'light_rail';
    return { lat, lng, resourceType };
  }).filter(Boolean);
}

async function fetchOsmResources() {
  const ql = `
    [out:json][timeout:60];
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
  const els = await overpass(ql);
  return els.map((el) => {
    const { lat, lng } = coords(el);
    if (!lat || !lng) return null;
    const t = el.tags || {};
    let resourceType;
    if (t.shop === 'supermarket') resourceType = 'grocery';
    else if (t.shop === 'laundry' || t.amenity === 'laundry') resourceType = 'laundromat';
    else if (t.amenity === 'pharmacy') resourceType = 'pharmacy';
    else return null;
    return { lat, lng, resourceType };
  }).filter(Boolean);
}

async function fetchCommunityCentersAsResources() {
  const ql = `
    [out:json][timeout:60];
    (
      node["amenity"="community_centre"](${BBOX});
      way["amenity"="community_centre"](${BBOX});
    );
    out center;
  `;
  const osm = (await overpass(ql)).map((el) => {
    const { lat, lng } = coords(el);
    return lat && lng ? { lat, lng, resourceType: 'community_center' } : null;
  }).filter(Boolean);

  const url = 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Community_Centers/FeatureServer/0';
  const fs = await arcgisGeojson(url);
  const arc = fs.map((f) => { const c = geom(f); return c ? { ...c, resourceType: 'community_center' } : null; }).filter(Boolean);

  return [...osm, ...arc];
}

function geom(f) {
  const g = f.geometry; if (!g) return null;
  if (g.type === 'Point') return { lat: g.coordinates[1], lng: g.coordinates[0] };
  if (g.type === 'Polygon') {
    const ring = g.coordinates[0];
    let sLat = 0, sLng = 0;
    for (const [lng, lat] of ring) { sLat += lat; sLng += lng; }
    return { lat: sLat / ring.length, lng: sLng / ring.length };
  }
  return null;
}

async function fetchHospitals() {
  const url = 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Hospital/FeatureServer/0';
  const fs = await arcgisGeojson(url);
  return fs.map((f) => { const c = geom(f); return c ? { ...c, resourceType: 'hospital' } : null; }).filter(Boolean);
}

async function fetchSchools() {
  const url = 'https://services2.arcgis.com/I7NQBinfvOmxQbXs/arcgis/rest/services/vw_schools_2023/FeatureServer/0';
  const fs = await arcgisGeojson(url);
  return fs.map((f) => { const c = geom(f); return c ? { ...c, resourceType: 'school' } : null; }).filter(Boolean);
}

async function fetchLibraries() {
  const url = 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Seattle_Public_Library/FeatureServer/0';
  const fs = await arcgisGeojson(url);
  return fs.map((f) => { const c = geom(f); return c ? { ...c, resourceType: 'library' } : null; }).filter(Boolean);
}

async function fetchFoodBanks() {
  const url = 'https://data.seattle.gov/resource/kkzf-ntnu.json?$limit=5000';
  const rows = await (await fetch(url)).json();
  return rows.filter((r) => r.latitude && r.longitude).map((r) => ({
    lat: parseFloat(r.latitude), lng: parseFloat(r.longitude), resourceType: 'food_bank',
  }));
}

function countResourcesInBuffer(lat, lng, radiusMeters, resources) {
  const origin = turf.point([lng, lat]);
  const counts = {};
  for (const r of resources) {
    const d = turf.distance(origin, turf.point([r.lng, r.lat]), { units: 'meters' });
    if (d <= radiusMeters) counts[r.resourceType] = (counts[r.resourceType] || 0) + 1;
  }
  return counts;
}

function computeCategoryScore(count, sat) {
  if (sat <= 0) return 0;
  return Math.min(count / sat, 1.0) * 100;
}

function computeOverallScore(rc, priorities) {
  let totalW = 0, totalWeighted = 0;
  const breakdown = {};
  for (const [key, cat] of Object.entries(RESOURCE_CATEGORIES)) {
    const lvl = priorities[key]; if (!lvl) continue;
    const w = PRIORITY_MULTIPLIERS[lvl] || 0; if (!w) continue;
    const types = cat.resources;
    const perType = {};
    let max = 0;
    for (const t of types) {
      const c = rc[t] || 0;
      const s = computeCategoryScore(c, SATURATION_POINTS[t] || 1);
      perType[t] = { count: c, score: s };
      if (s > max) max = s;
    }
    breakdown[key] = { max, weight: w, perType };
    totalWeighted += max * w;
    totalW += w;
  }
  return { score: totalW ? Math.round(totalWeighted / totalW) : 0, breakdown };
}

function colorFor(score) {
  if (score >= 75) return 'GREEN';
  if (score >= 50) return 'YELLOW';
  return 'RED';
}

console.log('Fetching all resources from real APIs...');
// Serialize Overpass calls to avoid hammering the public endpoint
const transit = await fetchTransit();
const osm = await fetchOsmResources();
const communityCenters = await fetchCommunityCentersAsResources();
const [hospitals, schools, libraries, foodBanks] = await Promise.all([
  fetchHospitals(), fetchSchools(), fetchLibraries(), fetchFoodBanks(),
]);

const all = [...transit, ...osm, ...hospitals, ...schools, ...libraries, ...foodBanks, ...communityCenters];

// Counts per resource type (citywide totals)
const totals = {};
for (const r of all) totals[r.resourceType] = (totals[r.resourceType] || 0) + 1;
console.log('\n=== Citywide resource totals ===');
console.table(totals);

// Sample 4 well-known Seattle locations
const samples = [
  { name: 'Downtown (3rd & Pike)',     lat: 47.6097, lng: -122.3422 },
  { name: 'Capitol Hill (Broadway/Pine)', lat: 47.6147, lng: -122.3211 },
  { name: 'University District',       lat: 47.6587, lng: -122.3138 },
  { name: 'Ballard',                   lat: 47.6685, lng: -122.3845 },
  { name: 'West Seattle Junction',     lat: 47.5613, lng: -122.3866 },
  { name: 'Magnolia (residential)',    lat: 47.6440, lng: -122.4000 },
  { name: 'Beacon Hill',               lat: 47.5790, lng: -122.3110 },
];

console.log('\n=== Sample location scores ===');
for (const s of samples) {
  const counts = countResourcesInBuffer(s.lat, s.lng, BUFFER_OUTER_M, all);
  const { score, breakdown } = computeOverallScore(counts, DEFAULT_PRIORITIES);
  console.log(`\n${s.name}  -> ${score}  ${colorFor(score)}`);
  for (const [cat, b] of Object.entries(breakdown)) {
    const types = Object.entries(b.perType).map(([t, v]) => `${t}=${v.count}(${v.score.toFixed(0)})`).join(' ');
    console.log(`  ${cat.padEnd(10)} max=${b.max.toFixed(0).padStart(3)} w=${b.weight}   ${types}`);
  }
}

// Distribution: 200 random points within Seattle bbox
console.log('\n=== Distribution across 200 random Seattle points ===');
const dist = { GREEN: 0, YELLOW: 0, RED: 0 };
for (let i = 0; i < 200; i++) {
  const lat = 47.49 + Math.random() * (47.74 - 47.49);
  const lng = -122.44 + Math.random() * (-122.24 - -122.44);
  const counts = countResourcesInBuffer(lat, lng, BUFFER_OUTER_M, all);
  const { score } = computeOverallScore(counts, DEFAULT_PRIORITIES);
  dist[colorFor(score)]++;
}
console.table(dist);
