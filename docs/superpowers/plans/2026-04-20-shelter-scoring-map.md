# Shelter Location Scoring Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive web map that displays potential shelter locations across Seattle, scores them based on nearby resources, and lets users explore details and add their own locations.

**Architecture:** React SPA with Leaflet map. All location and resource data fetched from live public APIs (Overpass, SODA, ArcGIS REST) on app load and cached in browser memory. Scoring computed client-side with Turf.js. User-added locations and contact info overrides stored in Supabase Postgres + Storage. No auth in v1 — everyone has full access.

**Tech Stack:** React (Vite), Leaflet + react-leaflet, Turf.js, Supabase JS client, Vercel

**Design Spec:** `docs/superpowers/specs/2026-04-20-shelter-location-scoring-map-design.md`

---

## File Structure

```
src/
├── main.jsx                    # App entry point
├── App.jsx                     # Root component — map + sidebar + priority panel
├── config/
│   ├── constants.js            # Seattle bounds, buffer distances, saturation points, default priorities
│   └── supabase.js             # Supabase client initialization
├── services/
│   ├── overpass.js             # Fetch churches, grocery, laundry, pharmacy, community centers, transit
│   ├── soda.js                 # Fetch food banks, building permits
│   ├── arcgis.js               # Fetch hospitals, schools, libraries, city property, KC parcels
│   └── supabase-locations.js   # CRUD for user-added locations + contact overrides
├── engine/
│   ├── scoring.js              # Score calculation: buffers, resource counting, weighted scoring
│   └── scoring.test.js         # Unit tests for scoring engine
├── components/
│   ├── MapView.jsx             # Leaflet map with pins, buffers, resource markers
│   ├── Sidebar.jsx             # Location detail sidebar (score, resources, contact)
│   ├── PriorityPanel.jsx       # Priority toggle buttons (Low/Med/High per category)
│   ├── AddLocationForm.jsx     # Form for adding/editing a location
│   └── LoadingOverlay.jsx      # Loading spinner during initial data fetch
├── hooks/
│   ├── useDataLoader.js        # Orchestrates all API fetches on app load, caches results
│   └── useScoring.js           # Manages priorities state + score recalculation
└── utils/
    └── normalize.js            # Normalize API responses into common GeoJSON format
index.html
vite.config.js
package.json
```

---

## API Endpoints Reference

**Overpass API** (POST to `https://overpass-api.de/api/interpreter`):
- Seattle bounding box: `(47.49,-122.44,47.74,-122.24)`
- Churches: `amenity=place_of_worship`
- Community centers: `amenity=community_centre`
- Grocery stores: `shop=supermarket`
- Laundromats: `shop=laundry`
- Pharmacies: `amenity=pharmacy`
- Bus stops: `highway=bus_stop` (using Overpass instead of GTFS to avoid zip parsing)
- Light rail: `railway=station` within Seattle bounds

**Seattle SODA API** (GET, returns JSON/GeoJSON):
- Food banks: `https://data.seattle.gov/resource/kkzf-ntnu.json`
- Building permits: `https://data.seattle.gov/resource/76t5-zqzr.json`

**Seattle GeoData / ArcGIS REST** (GET with `?where=...&outFields=*&f=geojson`):
- Hospitals: `https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Hospital/FeatureServer/0/query`
- Public schools: `https://services2.arcgis.com/I7NQBinfvOmxQbXs/arcgis/rest/services/vw_schools_2023/FeatureServer/0/query`
- Private schools: `https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Private_School/FeatureServer/0/query`
- Libraries: `https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Seattle_Public_Library/FeatureServer/0/query`
- Community centers: `https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Community_Centers/FeatureServer/0/query`
- City property: `https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/City_Property_Primary_Jurisdiction/FeatureServer/2/query`

**King County GIS** (GET with `?where=...&outFields=...&f=geojson&outSR=4326`):
- Parcels with property info: `https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query`
- Tax-exempt/nonprofit: filter by `PREUSE_CODE` (165 = Church/Welfare/Religious Service)
- Max 1000 records per query — use `resultOffset` for pagination

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`

- [ ] **Step 1: Initialize Vite React project**

```bash
cd /Users/schuman/GEOG469
npm create vite@latest . -- --template react
```

Select: React, JavaScript

- [ ] **Step 2: Install dependencies**

```bash
npm install leaflet react-leaflet @turf/turf @supabase/supabase-js
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vite for GitHub Pages**

Replace `vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/SHARE-Shelter-Project/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
});
```

Create `src/test-setup.js`:

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add test script to package.json**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create constants file**

Create `src/config/constants.js`:

```js
export const SEATTLE_CENTER = [47.608, -122.335];
export const SEATTLE_ZOOM = 12;
export const SEATTLE_BOUNDS = {
  south: 47.49,
  west: -122.44,
  north: 47.74,
  east: -122.24,
};

export const BUFFER_INNER_M = 400;   // 5-min walk
export const BUFFER_OUTER_M = 1200;  // 15-min walk

export const RESOURCE_CATEGORIES = {
  transit: { label: 'Transit', icon: '🚌', resources: ['bus_stop', 'light_rail'] },
  food: { label: 'Food Access', icon: '🍎', resources: ['food_bank', 'grocery'] },
  education: { label: 'Schools', icon: '🏫', resources: ['school'] },
  health: { label: 'Hospitals', icon: '🏥', resources: ['hospital'] },
  community: { label: 'Libraries & Community', icon: '📚', resources: ['library', 'community_center'] },
  daily: { label: 'Daily Needs', icon: '💊', resources: ['laundromat', 'pharmacy'] },
};

export const SATURATION_POINTS = {
  bus_stop: 4,
  light_rail: 1,
  food_bank: 2,
  grocery: 2,
  school: 2,
  hospital: 1,
  library: 1,
  community_center: 1,
  laundromat: 1,
  pharmacy: 1,
};

export const DEFAULT_PRIORITIES = {
  transit: 'high',
  food: 'high',
  education: 'medium',
  health: 'medium',
  community: 'low',
  daily: 'low',
};

export const PRIORITY_MULTIPLIERS = {
  high: 3,
  medium: 2,
  low: 1,
};

export const SCORE_COLORS = {
  great: { min: 75, color: '#22c55e', label: 'Great Location' },
  okay: { min: 50, color: '#eab308', label: 'Okay Location' },
  limited: { min: 0, color: '#ef4444', label: 'Limited Resources' },
};
```

- [ ] **Step 6: Create minimal App shell**

Replace `src/App.jsx`:

```jsx
import './App.css';

function App() {
  return (
    <div className="app">
      <h1>SHARE Shelter Map</h1>
      <p>Loading...</p>
    </div>
  );
}

export default App;
```

Replace `src/App.css`:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  position: relative;
}
```

- [ ] **Step 7: Verify dev server runs**

```bash
npm run dev
```

Expected: App opens at localhost:5173 with "SHARE Shelter Map" text.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "scaffold: Vite React project with dependencies and config"
```

---

## Task 2: Base Map Component

**Files:**
- Create: `src/components/MapView.jsx`
- Modify: `src/App.jsx`, `src/App.css`

- [ ] **Step 1: Create MapView component**

Create `src/components/MapView.jsx`:

```jsx
import { MapContainer, TileLayer } from 'react-leaflet';
import { SEATTLE_CENTER, SEATTLE_ZOOM } from '../config/constants';
import 'leaflet/dist/leaflet.css';

export default function MapView() {
  return (
    <MapContainer
      center={SEATTLE_CENTER}
      zoom={SEATTLE_ZOOM}
      className="map-container"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
    </MapContainer>
  );
}
```

- [ ] **Step 2: Wire MapView into App**

Replace `src/App.jsx`:

```jsx
import MapView from './components/MapView';
import './App.css';

function App() {
  return (
    <div className="app">
      <MapView />
    </div>
  );
}

export default App;
```

Add to `src/App.css`:

```css
.map-container {
  flex: 1;
  height: 100vh;
}
```

- [ ] **Step 3: Fix Leaflet default marker icons**

Add to top of `src/main.jsx` (after React imports):

```jsx
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
```

- [ ] **Step 4: Verify map renders**

```bash
npm run dev
```

Expected: Full-screen map of Seattle with Carto light basemap tiles.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapView.jsx src/App.jsx src/App.css src/main.jsx
git commit -m "feat: add Leaflet map component centered on Seattle"
```

---

## Task 3: Data Fetching Services

**Files:**
- Create: `src/services/overpass.js`, `src/services/soda.js`, `src/services/arcgis.js`, `src/utils/normalize.js`, `src/hooks/useDataLoader.js`

- [ ] **Step 1: Create normalizer utility**

All API responses get normalized into a common format so the rest of the app doesn't care about the source.

Create `src/utils/normalize.js`:

```js
/**
 * Normalize any data point to: { id, lat, lng, name, type, source, contact, raw }
 */
export function normalizeLocation(item) {
  return {
    id: item.id,
    lat: item.lat,
    lng: item.lng,
    name: item.name || 'Unknown',
    address: item.address || '',
    type: item.type,
    source: item.source,
    contact: item.contact || {},
    raw: item.raw || {},
  };
}

export function normalizeResource(item) {
  return {
    id: item.id,
    lat: item.lat,
    lng: item.lng,
    name: item.name || '',
    resourceType: item.resourceType,
    source: item.source,
  };
}
```

- [ ] **Step 2: Create Overpass service**

Create `src/services/overpass.js`:

```js
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEATTLE_BBOX = '47.49,-122.44,47.74,-122.24';

async function query(overpassQL) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(overpassQL)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const data = await res.json();
  return data.elements.filter((el) => el.lat && el.lon);
}

export async function fetchChurches() {
  const elements = await query(`
    [out:json][timeout:30];
    (
      node["amenity"="place_of_worship"](${SEATTLE_BBOX});
      way["amenity"="place_of_worship"](${SEATTLE_BBOX});
    );
    out center;
  `);
  return elements.map((el) => ({
    id: `osm-church-${el.id}`,
    lat: el.lat || el.center?.lat,
    lng: el.lon || el.center?.lon,
    name: el.tags?.name || 'Place of Worship',
    address: el.tags?.['addr:street']
      ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim()
      : '',
    type: 'church',
    source: 'osm',
    contact: {
      phone: el.tags?.phone || el.tags?.['contact:phone'] || '',
      website: el.tags?.website || el.tags?.['contact:website'] || '',
      email: el.tags?.email || el.tags?.['contact:email'] || '',
    },
    raw: el.tags || {},
  }));
}

export async function fetchCommunityFromOSM() {
  const elements = await query(`
    [out:json][timeout:30];
    (
      node["amenity"="community_centre"](${SEATTLE_BBOX});
      way["amenity"="community_centre"](${SEATTLE_BBOX});
    );
    out center;
  `);
  return elements.map((el) => ({
    id: `osm-cc-${el.id}`,
    lat: el.lat || el.center?.lat,
    lng: el.lon || el.center?.lon,
    name: el.tags?.name || 'Community Center',
    address: el.tags?.['addr:street']
      ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim()
      : '',
    type: 'community_center',
    source: 'osm',
    contact: {
      phone: el.tags?.phone || '',
      website: el.tags?.website || '',
    },
    raw: el.tags || {},
  }));
}

export async function fetchResourcesFromOSM() {
  const elements = await query(`
    [out:json][timeout:30];
    (
      node["shop"="supermarket"](${SEATTLE_BBOX});
      way["shop"="supermarket"](${SEATTLE_BBOX});
      node["shop"="laundry"](${SEATTLE_BBOX});
      way["shop"="laundry"](${SEATTLE_BBOX});
      node["amenity"="pharmacy"](${SEATTLE_BBOX});
      way["amenity"="pharmacy"](${SEATTLE_BBOX});
    );
    out center;
  `);

  return elements.map((el) => {
    const tags = el.tags || {};
    let resourceType = 'unknown';
    if (tags.shop === 'supermarket') resourceType = 'grocery';
    else if (tags.shop === 'laundry') resourceType = 'laundromat';
    else if (tags.amenity === 'pharmacy') resourceType = 'pharmacy';

    return {
      id: `osm-res-${el.id}`,
      lat: el.lat || el.center?.lat,
      lng: el.lon || el.center?.lon,
      name: tags.name || resourceType,
      resourceType,
      source: 'osm',
    };
  });
}

export async function fetchTransitFromOSM() {
  const elements = await query(`
    [out:json][timeout:30];
    (
      node["highway"="bus_stop"](${SEATTLE_BBOX});
      node["railway"="station"](${SEATTLE_BBOX});
      node["railway"="halt"](${SEATTLE_BBOX});
    );
    out center;
  `);

  return elements.map((el) => {
    const tags = el.tags || {};
    const resourceType = tags.railway ? 'light_rail' : 'bus_stop';
    return {
      id: `osm-transit-${el.id}`,
      lat: el.lat,
      lng: el.lon,
      name: tags.name || (resourceType === 'bus_stop' ? 'Bus Stop' : 'Station'),
      resourceType,
      source: 'osm',
    };
  });
}
```

- [ ] **Step 3: Create SODA service**

Create `src/services/soda.js`:

```js
const SODA_BASE = 'https://data.seattle.gov/resource';

async function querySODA(datasetId, params = {}) {
  const url = new URL(`${SODA_BASE}/${datasetId}.json`);
  url.searchParams.set('$limit', '5000');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SODA error: ${res.status}`);
  return res.json();
}

export async function fetchFoodBanks() {
  const data = await querySODA('kkzf-ntnu');
  return data
    .filter((d) => d.latitude && d.longitude)
    .map((d) => ({
      id: `soda-food-${d.objectid || d.latitude + d.longitude}`,
      lat: parseFloat(d.latitude),
      lng: parseFloat(d.longitude),
      name: d.agency || d.location || 'Food Resource',
      resourceType: 'food_bank',
      source: 'soda',
      contact: { phone: d.phone_number || '', website: d.website || '' },
    }));
}

export async function fetchBuildingPermits() {
  // Expired or inactive permits for 12+ months — potential vacant buildings
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const dateStr = twelveMonthsAgo.toISOString().split('T')[0];

  const data = await querySODA('76t5-zqzr', {
    $where: `expiresdate < '${dateStr}' AND latitude IS NOT NULL AND permitclass = 'Commercial'`,
    $select: 'permitnum,statuscurrent,expiresdate,originaladdress1,latitude,longitude,description',
  });

  return data
    .filter((d) => d.latitude && d.longitude)
    .map((d) => ({
      id: `soda-permit-${d.permitnum}`,
      lat: parseFloat(d.latitude),
      lng: parseFloat(d.longitude),
      name: d.originaladdress1 || 'Vacant Building',
      address: d.originaladdress1 || '',
      type: 'vacant_building',
      source: 'soda',
      contact: {},
      raw: { permitNum: d.permitnum, status: d.statuscurrent, expires: d.expiresdate, description: d.description },
    }));
}
```

- [ ] **Step 4: Create ArcGIS REST service**

Create `src/services/arcgis.js`:

```js
async function queryArcGIS(url, where = '1=1', outFields = '*') {
  const params = new URLSearchParams({
    where,
    outFields,
    f: 'geojson',
    outSR: '4326',
    resultRecordCount: '2000',
  });
  const res = await fetch(`${url}/query?${params}`);
  if (!res.ok) throw new Error(`ArcGIS error: ${res.status}`);
  const geojson = await res.json();
  return geojson.features || [];
}

const ENDPOINTS = {
  hospitals: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Hospital/FeatureServer/0',
  publicSchools: 'https://services2.arcgis.com/I7NQBinfvOmxQbXs/arcgis/rest/services/vw_schools_2023/FeatureServer/0',
  privateSchools: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Private_School/FeatureServer/0',
  libraries: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Seattle_Public_Library/FeatureServer/0',
  communityCenters: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Community_Centers/FeatureServer/0',
  cityProperty: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/City_Property_Primary_Jurisdiction/FeatureServer/2',
};

function extractCoords(feature) {
  const coords = feature.geometry?.coordinates;
  if (!coords) return null;
  // GeoJSON is [lng, lat]
  if (feature.geometry.type === 'Point') return { lat: coords[1], lng: coords[0] };
  if (feature.geometry.type === 'Polygon') {
    // Use centroid approximation (average of first ring)
    const ring = coords[0];
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    return { lat, lng };
  }
  return null;
}

export async function fetchHospitals() {
  const features = await queryArcGIS(ENDPOINTS.hospitals);
  return features.map((f) => {
    const p = f.properties;
    const c = extractCoords(f);
    return c && {
      id: `arc-hosp-${f.id || p.OBJECTID}`,
      ...c,
      name: p.FACILITY || 'Hospital',
      resourceType: 'hospital',
      source: 'arcgis',
      contact: { phone: p.TELEPHONE || '', website: p.URL || '' },
    };
  }).filter(Boolean);
}

export async function fetchSchools() {
  const [pub, priv] = await Promise.all([
    queryArcGIS(ENDPOINTS.publicSchools),
    queryArcGIS(ENDPOINTS.privateSchools),
  ]);

  const pubNorm = pub.map((f) => {
    const p = f.properties;
    const c = extractCoords(f);
    return c && {
      id: `arc-school-pub-${f.id || p.OBJECTID}`,
      ...c,
      name: p.school_name || p.mapLabel || 'Public School',
      resourceType: 'school',
      source: 'arcgis',
    };
  }).filter(Boolean);

  const privNorm = priv.map((f) => {
    const p = f.properties;
    const c = extractCoords(f);
    return c && {
      id: `arc-school-priv-${f.id || p.OBJECTID}`,
      ...c,
      name: p.NAME || 'Private School',
      resourceType: 'school',
      source: 'arcgis',
    };
  }).filter(Boolean);

  return [...pubNorm, ...privNorm];
}

export async function fetchLibraries() {
  const features = await queryArcGIS(ENDPOINTS.libraries);
  return features.map((f) => {
    const p = f.properties;
    const c = extractCoords(f);
    return c && {
      id: `arc-lib-${f.id || p.OBJECTID}`,
      ...c,
      name: p.NAME || 'Library',
      resourceType: 'library',
      source: 'arcgis',
      contact: { website: p.WEBSITE || '' },
    };
  }).filter(Boolean);
}

export async function fetchCommunityCentersArcGIS() {
  const features = await queryArcGIS(ENDPOINTS.communityCenters);
  return features.map((f) => {
    const p = f.properties;
    const c = extractCoords(f);
    return c && {
      id: `arc-cc-${f.id || p.OBJECTID}`,
      ...c,
      name: p.NAME || p.COMMON_NAM || 'Community Center',
      address: p.ADDRESS || '',
      type: 'community_center',
      source: 'arcgis',
      contact: { phone: p.PHONE || '' },
    };
  }).filter(Boolean);
}

export async function fetchCityProperty() {
  const features = await queryArcGIS(
    ENDPOINTS.cityProperty,
    "CITY_OWNED = 'Y' AND STATUS = 'Active'",
    'PMA_NAME,ADDRESS,JURIS_DEPT,USE_,USE_CLASS,NAME'
  );
  return features.map((f) => {
    const p = f.properties;
    const c = extractCoords(f);
    return c && {
      id: `arc-prop-${f.id || p.OBJECTID}`,
      ...c,
      name: p.PMA_NAME || p.NAME || 'Public Facility',
      address: p.ADDRESS || '',
      type: 'public_facility',
      source: 'arcgis',
      contact: {},
      raw: { department: p.JURIS_DEPT, use: p.USE_, useClass: p.USE_CLASS },
    };
  }).filter(Boolean);
}

export async function fetchNonprofitParcels() {
  const KC_PARCELS = 'https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2';
  // PREUSE_CODE 165 = Church/Welfare/Religious Service
  // Query in batches due to 1000 record limit
  const allFeatures = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const params = new URLSearchParams({
      where: "CTYNAME='SEATTLE' AND PREUSE_CODE=165",
      outFields: 'PIN,ADDR_FULL,PROP_NAME,PREUSE_DESC,PROPTYPE',
      f: 'geojson',
      outSR: '4326',
      resultRecordCount: String(batchSize),
      resultOffset: String(offset),
    });
    const res = await fetch(`${KC_PARCELS}/query?${params}`);
    if (!res.ok) break;
    const geojson = await res.json();
    const features = geojson.features || [];
    allFeatures.push(...features);
    if (features.length < batchSize) break;
    offset += batchSize;
  }

  return allFeatures.map((f) => {
    const p = f.properties;
    const c = extractCoords(f);
    return c && {
      id: `kc-np-${p.PIN}`,
      ...c,
      name: p.PROP_NAME || 'Nonprofit Property',
      address: p.ADDR_FULL || '',
      type: 'nonprofit',
      source: 'kingcounty',
      contact: {},
      raw: { pin: p.PIN, useDesc: p.PREUSE_DESC, propType: p.PROPTYPE },
    };
  }).filter(Boolean);
}
```

- [ ] **Step 5: Create data loader hook**

Create `src/hooks/useDataLoader.js`:

```js
import { useState, useEffect } from 'react';
import { fetchChurches, fetchCommunityFromOSM, fetchResourcesFromOSM, fetchTransitFromOSM } from '../services/overpass';
import { fetchFoodBanks, fetchBuildingPermits } from '../services/soda';
import { fetchHospitals, fetchSchools, fetchLibraries, fetchCommunityCentersArcGIS, fetchCityProperty, fetchNonprofitParcels } from '../services/arcgis';

export function useDataLoader() {
  const [locations, setLocations] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [
          churches, osmCommunity, buildingPermits, arcgisCommunity, cityProperty, nonprofits,
          osmResources, transit, foodBanks, hospitals, schools, libraries,
        ] = await Promise.allSettled([
          fetchChurches(),
          fetchCommunityFromOSM(),
          fetchBuildingPermits(),
          fetchCommunityCentersArcGIS(),
          fetchCityProperty(),
          fetchNonprofitParcels(),
          fetchResourcesFromOSM(),
          fetchTransitFromOSM(),
          fetchFoodBanks(),
          fetchHospitals(),
          fetchSchools(),
          fetchLibraries(),
        ]);

        const val = (result) => (result.status === 'fulfilled' ? result.value : []);

        // Deduplicate community centers (OSM + ArcGIS) by proximity
        const allCommunity = [...val(osmCommunity), ...val(arcgisCommunity)];

        setLocations([
          ...val(churches),
          ...allCommunity.filter((c) => c.type === 'community_center'),
          ...val(buildingPermits),
          ...val(cityProperty),
          ...val(nonprofits),
        ]);

        setResources([
          ...val(osmResources),
          ...val(transit),
          ...val(foodBanks),
          ...val(hospitals),
          ...val(schools),
          ...val(libraries),
          ...allCommunity.filter((c) => !c.type).map((c) => ({ ...c, resourceType: 'community_center' })),
        ]);

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  return { locations, resources, loading, error };
}
```

- [ ] **Step 6: Verify data loads in browser console**

Wire into `App.jsx` temporarily:

```jsx
import MapView from './components/MapView';
import { useDataLoader } from './hooks/useDataLoader';
import './App.css';

function App() {
  const { locations, resources, loading, error } = useDataLoader();

  if (loading) return <div className="app"><p>Loading data...</p></div>;
  if (error) return <div className="app"><p>Error: {error}</p></div>;

  console.log('Locations:', locations.length, locations.slice(0, 3));
  console.log('Resources:', resources.length, resources.slice(0, 3));

  return (
    <div className="app">
      <MapView />
    </div>
  );
}

export default App;
```

```bash
npm run dev
```

Expected: Browser console shows "Locations: [number]" and "Resources: [number]" with sample data.

- [ ] **Step 7: Commit**

```bash
git add src/services/ src/utils/ src/hooks/ src/App.jsx
git commit -m "feat: add data fetching services for Overpass, SODA, ArcGIS REST"
```

---

## Task 4: Scoring Engine (TDD)

**Files:**
- Create: `src/engine/scoring.js`, `src/engine/scoring.test.js`, `src/hooks/useScoring.js`

- [ ] **Step 1: Write failing tests for scoring functions**

Create `src/engine/scoring.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { countResourcesInBuffer, computeCategoryScore, computeOverallScore, getScoreColor } from './scoring';

describe('countResourcesInBuffer', () => {
  const resources = [
    { lat: 47.608, lng: -122.335, resourceType: 'bus_stop' },
    { lat: 47.609, lng: -122.336, resourceType: 'bus_stop' },
    { lat: 47.610, lng: -122.337, resourceType: 'food_bank' },
    { lat: 47.700, lng: -122.400, resourceType: 'bus_stop' }, // far away
  ];

  it('counts resources within the buffer radius', () => {
    const counts = countResourcesInBuffer(47.608, -122.335, 1200, resources);
    expect(counts.bus_stop).toBe(2);
    expect(counts.food_bank).toBe(1);
  });

  it('excludes resources outside the buffer', () => {
    const counts = countResourcesInBuffer(47.608, -122.335, 1200, resources);
    // The far-away bus stop should not be counted
    expect(counts.bus_stop).toBeLessThan(3);
  });

  it('returns 0 for resource types not present', () => {
    const counts = countResourcesInBuffer(47.608, -122.335, 1200, resources);
    expect(counts.hospital || 0).toBe(0);
  });
});

describe('computeCategoryScore', () => {
  it('returns 100 when at saturation point', () => {
    expect(computeCategoryScore(4, 4)).toBe(100);
  });

  it('caps at 100 when over saturation', () => {
    expect(computeCategoryScore(10, 4)).toBe(100);
  });

  it('returns 50 when at half saturation', () => {
    expect(computeCategoryScore(1, 2)).toBe(50);
  });

  it('returns 0 when count is 0', () => {
    expect(computeCategoryScore(0, 2)).toBe(0);
  });
});

describe('computeOverallScore', () => {
  it('computes weighted average correctly', () => {
    const resourceCounts = { bus_stop: 4, food_bank: 2, school: 0 };
    const priorities = { transit: 'high', food: 'high', education: 'low' };
    const score = computeOverallScore(resourceCounts, priorities);
    // transit: 100 * 3 = 300, food: 100 * 3 = 300, education: 0 * 1 = 0
    // total = 600 / (3+3+1+...) — depends on all categories
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 when no resources nearby', () => {
    const resourceCounts = {};
    const priorities = { transit: 'high', food: 'high' };
    const score = computeOverallScore(resourceCounts, priorities);
    expect(score).toBe(0);
  });
});

describe('getScoreColor', () => {
  it('returns green for score >= 75', () => {
    expect(getScoreColor(82)).toEqual({ color: '#22c55e', label: 'Great Location' });
  });

  it('returns yellow for score 50-74', () => {
    expect(getScoreColor(60)).toEqual({ color: '#eab308', label: 'Okay Location' });
  });

  it('returns red for score < 50', () => {
    expect(getScoreColor(30)).toEqual({ color: '#ef4444', label: 'Limited Resources' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `scoring.js` doesn't exist yet.

- [ ] **Step 3: Implement scoring engine**

Create `src/engine/scoring.js`:

```js
import * as turf from '@turf/turf';
import {
  SATURATION_POINTS,
  RESOURCE_CATEGORIES,
  PRIORITY_MULTIPLIERS,
  SCORE_COLORS,
  BUFFER_INNER_M,
  BUFFER_OUTER_M,
} from '../config/constants';

export function countResourcesInBuffer(lat, lng, radiusMeters, resources) {
  const center = turf.point([lng, lat]);
  const counts = {};

  for (const r of resources) {
    if (!r.lat || !r.lng) continue;
    const pt = turf.point([r.lng, r.lat]);
    const dist = turf.distance(center, pt, { units: 'meters' });
    if (dist <= radiusMeters) {
      const t = r.resourceType;
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  return counts;
}

export function computeCategoryScore(count, saturationPoint) {
  if (saturationPoint <= 0) return 0;
  return Math.min(count / saturationPoint, 1.0) * 100;
}

export function computeOverallScore(resourceCounts, priorities) {
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const [catKey, catConfig] of Object.entries(RESOURCE_CATEGORIES)) {
    const priority = priorities[catKey] || 'low';
    const multiplier = PRIORITY_MULTIPLIERS[priority];

    let catScore = 0;
    let catResources = 0;

    for (const resType of catConfig.resources) {
      const count = resourceCounts[resType] || 0;
      const sat = SATURATION_POINTS[resType] || 1;
      catScore += computeCategoryScore(count, sat);
      catResources++;
    }

    if (catResources > 0) {
      catScore = catScore / catResources; // average across resource types in category
    }

    totalWeighted += catScore * multiplier;
    totalWeight += multiplier;
  }

  if (totalWeight === 0) return 0;
  return Math.round(totalWeighted / totalWeight);
}

export function getScoreColor(score) {
  if (score >= SCORE_COLORS.great.min) {
    return { color: SCORE_COLORS.great.color, label: SCORE_COLORS.great.label };
  }
  if (score >= SCORE_COLORS.okay.min) {
    return { color: SCORE_COLORS.okay.color, label: SCORE_COLORS.okay.label };
  }
  return { color: SCORE_COLORS.limited.color, label: SCORE_COLORS.limited.label };
}

export function scoreLocation(lat, lng, resources, priorities) {
  const innerCounts = countResourcesInBuffer(lat, lng, BUFFER_INNER_M, resources);
  const outerCounts = countResourcesInBuffer(lat, lng, BUFFER_OUTER_M, resources);
  const score = computeOverallScore(outerCounts, priorities);
  const { color, label } = getScoreColor(score);

  return { score, color, label, innerCounts, outerCounts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test
```

Expected: All tests PASS.

- [ ] **Step 5: Create scoring hook**

Create `src/hooks/useScoring.js`:

```js
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
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/ src/hooks/useScoring.js
git commit -m "feat: scoring engine with TDD — buffers, resource counting, weighted scores"
```

---

## Task 5: Color-Coded Map Pins

**Files:**
- Modify: `src/components/MapView.jsx`, `src/App.jsx`

- [ ] **Step 1: Update MapView to accept and render scored locations**

Replace `src/components/MapView.jsx`:

```jsx
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { SEATTLE_CENTER, SEATTLE_ZOOM } from '../config/constants';
import 'leaflet/dist/leaflet.css';

export default function MapView({ scoredLocations, onPinClick }) {
  return (
    <MapContainer
      center={SEATTLE_CENTER}
      zoom={SEATTLE_ZOOM}
      className="map-container"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {scoredLocations.map((loc) => (
        <CircleMarker
          key={loc.id}
          center={[loc.lat, loc.lng]}
          radius={8}
          pathOptions={{
            fillColor: loc.color,
            fillOpacity: 0.8,
            color: '#fff',
            weight: 2,
          }}
          eventHandlers={{ click: () => onPinClick(loc) }}
        >
          <Tooltip>{loc.name} — {loc.score}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Wire everything into App**

Replace `src/App.jsx`:

```jsx
import { useState } from 'react';
import MapView from './components/MapView';
import { useDataLoader } from './hooks/useDataLoader';
import { useScoring } from './hooks/useScoring';
import './App.css';

function App() {
  const { locations, resources, loading, error } = useDataLoader();
  const { scoredLocations, priorities, setPriorities } = useScoring(locations, resources);
  const [selectedLocation, setSelectedLocation] = useState(null);

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <h1>SHARE Shelter Map</h1>
          <p>Loading Seattle data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <h1>SHARE Shelter Map</h1>
          <p>Error loading data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <MapView
        scoredLocations={scoredLocations}
        onPinClick={setSelectedLocation}
      />
    </div>
  );
}

export default App;
```

Add to `src/App.css`:

```css
.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content {
  text-align: center;
  font-family: system-ui, sans-serif;
}

.loading-content h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.loading-content p {
  color: #666;
}
```

- [ ] **Step 3: Verify pins render on map**

```bash
npm run dev
```

Expected: Seattle map with colored circle markers. Green, yellow, and red pins visible across the city.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView.jsx src/App.jsx src/App.css
git commit -m "feat: render color-coded scored pins on Seattle map"
```

---

## Task 6: Pin Click — Zoom, Buffers, Resource Markers

**Files:**
- Modify: `src/components/MapView.jsx`

- [ ] **Step 1: Add map ref and click interaction logic**

Replace `src/components/MapView.jsx`:

```jsx
import { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { SEATTLE_CENTER, SEATTLE_ZOOM, BUFFER_INNER_M, BUFFER_OUTER_M } from '../config/constants';
import { countResourcesInBuffer } from '../engine/scoring';
import 'leaflet/dist/leaflet.css';

const RESOURCE_ICONS = {
  bus_stop: '🚌', light_rail: '🚇', food_bank: '🍎', grocery: '🛒',
  school: '🏫', hospital: '🏥', library: '📚', community_center: '🏛️',
  laundromat: '👕', pharmacy: '💊',
};

function createEmojiIcon(emoji) {
  return L.divIcon({
    html: `<span style="font-size:18px">${emoji}</span>`,
    className: 'emoji-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapController({ selectedLocation }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLocation) {
      map.flyTo([selectedLocation.lat, selectedLocation.lng], 15, { duration: 0.8 });
    }
  }, [selectedLocation, map]);
  return null;
}

export default function MapView({ scoredLocations, selectedLocation, resources, onPinClick, onMapClick }) {
  const nearbyResources = selectedLocation
    ? resources.filter((r) => {
        const dx = r.lat - selectedLocation.lat;
        const dy = r.lng - selectedLocation.lng;
        // Quick rough filter before precise Turf check (approx 1.2km in degrees)
        return Math.abs(dx) < 0.015 && Math.abs(dy) < 0.02;
      }).filter((r) => {
        const turf = require('@turf/turf');
        const center = turf.point([selectedLocation.lng, selectedLocation.lat]);
        const pt = turf.point([r.lng, r.lat]);
        return turf.distance(center, pt, { units: 'meters' }) <= BUFFER_OUTER_M;
      })
    : [];

  return (
    <MapContainer
      center={SEATTLE_CENTER}
      zoom={SEATTLE_ZOOM}
      className="map-container"
      zoomControl={true}
      onClick={onMapClick}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <MapController selectedLocation={selectedLocation} />

      {/* Location pins */}
      {scoredLocations.map((loc) => (
        <CircleMarker
          key={loc.id}
          center={[loc.lat, loc.lng]}
          radius={8}
          pathOptions={{
            fillColor: loc.color,
            fillOpacity: loc.id === selectedLocation?.id ? 1 : 0.7,
            color: loc.id === selectedLocation?.id ? '#000' : '#fff',
            weight: loc.id === selectedLocation?.id ? 3 : 2,
          }}
          eventHandlers={{ click: () => onPinClick(loc) }}
        >
          <Tooltip>{loc.name} — {loc.score}</Tooltip>
        </CircleMarker>
      ))}

      {/* Buffer circles for selected location */}
      {selectedLocation && (
        <>
          <Circle
            center={[selectedLocation.lat, selectedLocation.lng]}
            radius={BUFFER_OUTER_M}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.05, weight: 1, dashArray: '6 4' }}
          />
          <Circle
            center={[selectedLocation.lat, selectedLocation.lng]}
            radius={BUFFER_INNER_M}
            pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.08, weight: 2 }}
          />
        </>
      )}

      {/* Resource markers within buffer */}
      {nearbyResources.map((r) => (
        <Marker
          key={r.id}
          position={[r.lat, r.lng]}
          icon={createEmojiIcon(RESOURCE_ICONS[r.resourceType] || '📍')}
        >
          <Tooltip>{r.name}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Fix the import (use static import instead of require)**

Replace the `require('@turf/turf')` in the filter with a proper import. At the top of `MapView.jsx`, add:

```js
import * as turf from '@turf/turf';
```

And replace the filter block:

```jsx
  const nearbyResources = selectedLocation
    ? resources.filter((r) => {
        if (!r.lat || !r.lng) return false;
        const center = turf.point([selectedLocation.lng, selectedLocation.lat]);
        const pt = turf.point([r.lng, r.lat]);
        return turf.distance(center, pt, { units: 'meters' }) <= BUFFER_OUTER_M;
      })
    : [];
```

- [ ] **Step 3: Update App to pass resources and selectedLocation to MapView**

In `src/App.jsx`, update the MapView usage:

```jsx
  return (
    <div className="app">
      <MapView
        scoredLocations={scoredLocations}
        selectedLocation={selectedLocation}
        resources={resources}
        onPinClick={setSelectedLocation}
        onMapClick={() => setSelectedLocation(null)}
      />
    </div>
  );
```

- [ ] **Step 4: Add emoji icon CSS**

Add to `src/App.css`:

```css
.emoji-icon {
  background: none;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 5: Verify click interaction works**

```bash
npm run dev
```

Expected: Click a pin → map zooms in, two buffer circles appear (green inner, blue outer dashed), resource emoji markers appear within the buffers.

- [ ] **Step 6: Commit**

```bash
git add src/components/MapView.jsx src/App.jsx src/App.css
git commit -m "feat: pin click zooms in with buffer circles and resource markers"
```

---

## Task 7: Sidebar Component

**Files:**
- Create: `src/components/Sidebar.jsx`, `src/components/Sidebar.css`
- Modify: `src/App.jsx`, `src/App.css`

- [ ] **Step 1: Create Sidebar component**

Create `src/components/Sidebar.jsx`:

```jsx
import { RESOURCE_CATEGORIES } from '../config/constants';
import './Sidebar.css';

function getCountColor(inner, outer) {
  if (inner > 0) return '#22c55e';
  if (outer > 0) return '#eab308';
  return '#ef4444';
}

export default function Sidebar({ location, onClose }) {
  if (!location) return null;

  const { name, address, type, contact, score, label, color, innerCounts, outerCounts } = location;

  return (
    <div className="sidebar">
      <button className="sidebar-close" onClick={onClose}>&times;</button>

      {/* Location header */}
      <div className="sidebar-header">
        <div className="sidebar-name">{name}</div>
        {address && <div className="sidebar-address">{address}</div>}
        {contact?.phone && <div className="sidebar-contact">📞 {contact.phone}</div>}
        {contact?.website && (
          <div className="sidebar-contact">
            🌐 <a href={contact.website} target="_blank" rel="noopener noreferrer">Website</a>
          </div>
        )}
        {contact?.email && <div className="sidebar-contact">📧 {contact.email}</div>}
      </div>

      {/* Score badge */}
      <div className="sidebar-score">
        <div className="score-circle" style={{ backgroundColor: color }}>
          {score}
        </div>
        <div className="score-info">
          <div className="score-label" style={{ color }}>{label}</div>
          <div className="score-sub">Based on nearby resources</div>
        </div>
      </div>

      {/* Resource list */}
      <div className="sidebar-resources-title">Nearby Resources</div>
      <div className="sidebar-resources">
        {Object.entries(RESOURCE_CATEGORIES).map(([key, cat]) => {
          return cat.resources.map((resType) => {
            const inner = innerCounts?.[resType] || 0;
            const outer = outerCounts?.[resType] || 0;
            return (
              <div className="resource-row" key={resType}>
                <span className="resource-icon">{cat.icon}</span>
                <span className="resource-name">{resType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                <span className="resource-count" style={{ color: getCountColor(inner, outer) }}>
                  {inner}
                </span>
                <span className="resource-count-outer">/ {outer}</span>
              </div>
            );
          });
        })}
      </div>

      {/* Legend */}
      <div className="sidebar-legend">
        <span className="legend-dot" style={{ background: '#22c55e' }}></span> 5 min walk
        <span className="legend-dot" style={{ background: '#999', marginLeft: 12 }}></span> 15 min walk
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Sidebar CSS**

Create `src/components/Sidebar.css`:

```css
.sidebar {
  position: absolute;
  top: 0;
  right: 0;
  width: 340px;
  height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
  overflow-y: auto;
  z-index: 1000;
  padding: 16px;
  font-family: system-ui, -apple-system, sans-serif;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
}

.sidebar-close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  color: #999;
  font-size: 24px;
  cursor: pointer;
}

.sidebar-close:hover { color: #fff; }

.sidebar-header {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}

.sidebar-name {
  font-size: 17px;
  font-weight: bold;
  color: #fff;
}

.sidebar-address {
  color: #aaa;
  font-size: 12px;
  margin-top: 3px;
}

.sidebar-contact {
  color: #aaa;
  font-size: 12px;
  margin-top: 2px;
}

.sidebar-contact a {
  color: #60a5fa;
  text-decoration: none;
}

.sidebar-score {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #252540;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 14px;
}

.score-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: bold;
  color: #000;
  flex-shrink: 0;
}

.score-info { flex: 1; }

.score-label {
  font-size: 15px;
  font-weight: bold;
}

.score-sub {
  color: #999;
  font-size: 11px;
  margin-top: 2px;
}

.sidebar-resources-title {
  font-size: 13px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8px;
}

.sidebar-resources {
  background: #252540;
  border-radius: 8px;
  overflow: hidden;
}

.resource-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #333;
}

.resource-row:last-child { border-bottom: none; }

.resource-icon {
  font-size: 18px;
  width: 30px;
}

.resource-name {
  flex: 1;
  font-size: 13px;
}

.resource-count {
  font-weight: bold;
  font-size: 14px;
}

.resource-count-outer {
  color: #666;
  font-size: 10px;
  margin-left: 4px;
  width: 30px;
}

.sidebar-legend {
  margin-top: 8px;
  font-size: 10px;
  color: #666;
  text-align: center;
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: middle;
}
```

- [ ] **Step 3: Wire Sidebar into App**

Update `src/App.jsx` return block:

```jsx
  return (
    <div className="app">
      <MapView
        scoredLocations={scoredLocations}
        selectedLocation={selectedLocation}
        resources={resources}
        onPinClick={setSelectedLocation}
        onMapClick={() => setSelectedLocation(null)}
      />
      <Sidebar
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />
    </div>
  );
```

Add import: `import Sidebar from './components/Sidebar';`

- [ ] **Step 4: Verify sidebar works**

```bash
npm run dev
```

Expected: Click a pin → sidebar slides in from right with location name, score circle, resource list. Click X or empty map to close.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.jsx src/components/Sidebar.css src/App.jsx
git commit -m "feat: sidebar with location details, score badge, resource counts"
```

---

## Task 8: Priority Toggle Panel

**Files:**
- Create: `src/components/PriorityPanel.jsx`, `src/components/PriorityPanel.css`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create PriorityPanel component**

Create `src/components/PriorityPanel.jsx`:

```jsx
import { useState } from 'react';
import { RESOURCE_CATEGORIES } from '../config/constants';
import './PriorityPanel.css';

const LEVELS = ['low', 'medium', 'high'];
const LEVEL_LABELS = { low: 'Low', medium: 'Med', high: 'High' };
const LEVEL_COLORS = { low: '#3b82f6', medium: '#eab308', high: '#22c55e' };

export default function PriorityPanel({ priorities, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...priorities });

  function handleToggle(category, level) {
    setDraft((prev) => ({ ...prev, [category]: level }));
  }

  function handleApply() {
    onUpdate(draft);
    setOpen(false);
  }

  if (!open) {
    return (
      <button className="priority-open-btn" onClick={() => setOpen(true)}>
        ⚙️ Set Priorities
      </button>
    );
  }

  return (
    <div className="priority-panel">
      <div className="priority-title">Set Your Priorities</div>
      <div className="priority-subtitle">What matters most for shelter locations?</div>

      {Object.entries(RESOURCE_CATEGORIES).map(([key, cat]) => (
        <div className="priority-row" key={key}>
          <span className="priority-icon">{cat.icon}</span>
          <span className="priority-label">{cat.label}</span>
          <div className="priority-buttons">
            {LEVELS.map((level) => (
              <button
                key={level}
                className={`priority-btn ${draft[key] === level ? 'active' : ''}`}
                style={draft[key] === level ? { backgroundColor: LEVEL_COLORS[level], color: level === 'medium' ? '#000' : '#fff' } : {}}
                onClick={() => handleToggle(key, level)}
              >
                {LEVEL_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="priority-actions">
        <button className="priority-apply" onClick={handleApply}>Update Map</button>
        <button className="priority-cancel" onClick={() => { setDraft({ ...priorities }); setOpen(false); }}>Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PriorityPanel CSS**

Create `src/components/PriorityPanel.css`:

```css
.priority-open-btn {
  position: absolute;
  top: 12px;
  left: 60px;
  z-index: 1000;
  background: #1a1a2e;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  font-family: system-ui, sans-serif;
}

.priority-open-btn:hover { background: #252540; }

.priority-panel {
  position: absolute;
  top: 12px;
  left: 60px;
  z-index: 1000;
  background: #1a1a2e;
  color: #e0e0e0;
  padding: 16px;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  font-family: system-ui, sans-serif;
  width: 320px;
}

.priority-title {
  font-size: 15px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 4px;
}

.priority-subtitle {
  color: #999;
  font-size: 11px;
  margin-bottom: 14px;
}

.priority-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.priority-icon { font-size: 16px; width: 24px; }
.priority-label { flex: 1; font-size: 13px; }

.priority-buttons { display: flex; gap: 3px; }

.priority-btn {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  border: none;
  cursor: pointer;
  background: #252540;
  color: #999;
  font-family: system-ui, sans-serif;
}

.priority-btn:hover { background: #333; }
.priority-btn.active { font-weight: bold; }

.priority-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #333;
}

.priority-apply {
  flex: 1;
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  font-family: system-ui, sans-serif;
}

.priority-apply:hover { background: #2563eb; }

.priority-cancel {
  background: #252540;
  color: #999;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 3: Wire into App**

Add to `src/App.jsx` imports:

```jsx
import PriorityPanel from './components/PriorityPanel';
```

Add inside the return, after `<MapView>`:

```jsx
      <PriorityPanel priorities={priorities} onUpdate={setPriorities} />
```

- [ ] **Step 4: Verify priorities update pin colors**

```bash
npm run dev
```

Expected: Click "Set Priorities" → panel appears → toggle categories → click "Update Map" → pin colors change across the map.

- [ ] **Step 5: Commit**

```bash
git add src/components/PriorityPanel.jsx src/components/PriorityPanel.css src/App.jsx
git commit -m "feat: priority toggle panel with live score recalculation"
```

---

## Task 9: Supabase Setup

**Files:**
- Create: `src/config/supabase.js`, `src/services/supabase-locations.js`
- Create: SQL migration (run in Supabase dashboard)

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com/dashboard and create a new project:
- Name: `share-shelter-map`
- Region: West US
- Generate a database password and save it

Copy the **Project URL** and **anon key** from Settings → API.

- [ ] **Step 2: Run SQL to create tables**

In Supabase SQL Editor, run:

```sql
-- Enable PostGIS
create extension if not exists postgis;

-- User-added locations
create table locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text default '',
  type text not null check (type in ('church', 'community_center', 'vacant_building', 'public_facility', 'nonprofit', 'other')),
  lat double precision not null,
  lng double precision not null,
  geom geometry(Point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  notes text default '',
  contact_name text default '',
  contact_phone text default '',
  contact_email text default '',
  contact_website text default '',
  created_at timestamptz default now()
);

-- Contact info overrides for API-sourced locations
create table contact_overrides (
  id uuid default gen_random_uuid() primary key,
  source_id text not null unique,
  contact_name text default '',
  contact_phone text default '',
  contact_email text default '',
  contact_website text default '',
  updated_at timestamptz default now()
);

-- Storage bucket for photos
insert into storage.buckets (id, name, public) values ('location-photos', 'location-photos', true);

-- Allow public access (no auth in v1)
alter table locations enable row level security;
create policy "Allow all access" on locations for all using (true) with check (true);

alter table contact_overrides enable row level security;
create policy "Allow all access" on contact_overrides for all using (true) with check (true);

create policy "Allow public photo uploads" on storage.objects for all using (bucket_id = 'location-photos') with check (bucket_id = 'location-photos');
```

- [ ] **Step 3: Create Supabase client config**

Create `src/config/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

Create `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

- [ ] **Step 4: Create Supabase locations service**

Create `src/services/supabase-locations.js`:

```js
import { supabase } from '../config/supabase';

export async function fetchUserLocations() {
  const { data, error } = await supabase.from('locations').select('*');
  if (error) throw error;
  return data.map((d) => ({
    id: `user-${d.id}`,
    supabaseId: d.id,
    lat: d.lat,
    lng: d.lng,
    name: d.name,
    address: d.address,
    type: d.type,
    source: 'user',
    contact: {
      name: d.contact_name,
      phone: d.contact_phone,
      email: d.contact_email,
      website: d.contact_website,
    },
    notes: d.notes,
  }));
}

export async function addLocation(location) {
  const { data, error } = await supabase.from('locations').insert({
    name: location.name,
    address: location.address || '',
    type: location.type,
    lat: location.lat,
    lng: location.lng,
    notes: location.notes || '',
    contact_name: location.contact?.name || '',
    contact_phone: location.contact?.phone || '',
    contact_email: location.contact?.email || '',
    contact_website: location.contact?.website || '',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateLocation(id, updates) {
  const { error } = await supabase.from('locations').update({
    name: updates.name,
    address: updates.address,
    type: updates.type,
    notes: updates.notes,
    contact_name: updates.contact?.name || '',
    contact_phone: updates.contact?.phone || '',
    contact_email: updates.contact?.email || '',
    contact_website: updates.contact?.website || '',
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteLocation(id) {
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadPhoto(locationId, file) {
  const filePath = `${locationId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('location-photos').upload(filePath, file);
  if (error) throw error;
  const { data } = supabase.storage.from('location-photos').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function fetchContactOverride(sourceId) {
  const { data } = await supabase.from('contact_overrides').select('*').eq('source_id', sourceId).single();
  return data;
}

export async function upsertContactOverride(sourceId, contact) {
  const { error } = await supabase.from('contact_overrides').upsert({
    source_id: sourceId,
    contact_name: contact.name || '',
    contact_phone: contact.phone || '',
    contact_email: contact.email || '',
    contact_website: contact.website || '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'source_id' });
  if (error) throw error;
}
```

- [ ] **Step 5: Add user locations to the data loader**

In `src/hooks/useDataLoader.js`, add import and integrate:

```js
import { fetchUserLocations } from '../services/supabase-locations';
```

Add to the `Promise.allSettled` array:

```js
fetchUserLocations(),
```

Add to the `setLocations` array:

```js
...val(userLocations),
```

- [ ] **Step 6: Verify Supabase connection**

```bash
npm run dev
```

Expected: App loads without errors. If Supabase env vars are set correctly, user locations (empty for now) are included in the data flow.

- [ ] **Step 7: Commit**

```bash
git add src/config/supabase.js src/services/supabase-locations.js src/hooks/useDataLoader.js .env.local
git commit -m "feat: Supabase integration — schema, client, CRUD service for user locations"
```

---

## Task 10: Add / Edit / Delete Location UI

**Files:**
- Create: `src/components/AddLocationForm.jsx`, `src/components/AddLocationForm.css`
- Modify: `src/App.jsx`, `src/components/MapView.jsx`, `src/components/Sidebar.jsx`

- [ ] **Step 1: Create AddLocationForm component**

Create `src/components/AddLocationForm.jsx`:

```jsx
import { useState } from 'react';
import './AddLocationForm.css';

const LOCATION_TYPES = [
  { value: 'church', label: 'Church / Place of Worship' },
  { value: 'community_center', label: 'Community Center' },
  { value: 'vacant_building', label: 'Vacant Building' },
  { value: 'public_facility', label: 'Public Facility' },
  { value: 'nonprofit', label: 'Nonprofit Property' },
  { value: 'other', label: 'Other' },
];

export default function AddLocationForm({ lat, lng, initialData, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'church',
    address: initialData?.address || '',
    notes: initialData?.notes || '',
    contactName: initialData?.contact?.name || '',
    contactPhone: initialData?.contact?.phone || '',
    contactEmail: initialData?.contact?.email || '',
    contactWebsite: initialData?.contact?.website || '',
  });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      lat,
      lng,
      name: form.name.trim(),
      type: form.type,
      address: form.address.trim(),
      notes: form.notes.trim(),
      contact: {
        name: form.contactName.trim(),
        phone: form.contactPhone.trim(),
        email: form.contactEmail.trim(),
        website: form.contactWebsite.trim(),
      },
      photo,
    });
    setSaving(false);
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <div className="add-form-title">{initialData ? 'Edit Location' : 'Add Location'}</div>
      <div className="add-form-coords">📍 {lat.toFixed(5)}, {lng.toFixed(5)}</div>

      <label>Name *</label>
      <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />

      <label>Type</label>
      <select value={form.type} onChange={(e) => handleChange('type', e.target.value)}>
        {LOCATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <label>Address</label>
      <input type="text" value={form.address} onChange={(e) => handleChange('address', e.target.value)} />

      <label>Notes</label>
      <textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} />

      <label>Photo</label>
      <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />

      <div className="add-form-section">Contact Info</div>
      <label>Contact Name</label>
      <input type="text" value={form.contactName} onChange={(e) => handleChange('contactName', e.target.value)} />
      <label>Phone</label>
      <input type="tel" value={form.contactPhone} onChange={(e) => handleChange('contactPhone', e.target.value)} />
      <label>Email</label>
      <input type="email" value={form.contactEmail} onChange={(e) => handleChange('contactEmail', e.target.value)} />
      <label>Website</label>
      <input type="url" value={form.contactWebsite} onChange={(e) => handleChange('contactWebsite', e.target.value)} />

      <div className="add-form-actions">
        <button type="submit" className="add-form-save" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="add-form-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create AddLocationForm CSS**

Create `src/components/AddLocationForm.css`:

```css
.add-form {
  padding: 16px;
  font-family: system-ui, sans-serif;
  color: #e0e0e0;
}

.add-form-title {
  font-size: 17px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 4px;
}

.add-form-coords {
  font-size: 11px;
  color: #999;
  margin-bottom: 14px;
}

.add-form label {
  display: block;
  font-size: 11px;
  color: #999;
  margin-bottom: 3px;
  margin-top: 8px;
}

.add-form input,
.add-form select,
.add-form textarea {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #333;
  background: #252540;
  color: #e0e0e0;
  font-size: 13px;
  font-family: system-ui, sans-serif;
}

.add-form-section {
  font-size: 13px;
  font-weight: bold;
  color: #fff;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #333;
}

.add-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.add-form-save {
  flex: 1;
  background: #22c55e;
  color: #000;
  border: none;
  padding: 10px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  font-size: 14px;
}

.add-form-save:disabled { opacity: 0.5; }

.add-form-cancel {
  background: #252540;
  color: #999;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
```

- [ ] **Step 3: Add "Add Location" mode to App**

Update `src/App.jsx` to handle add/edit/delete:

```jsx
import { useState, useCallback } from 'react';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import PriorityPanel from './components/PriorityPanel';
import AddLocationForm from './components/AddLocationForm';
import { useDataLoader } from './hooks/useDataLoader';
import { useScoring } from './hooks/useScoring';
import { addLocation, updateLocation, deleteLocation, uploadPhoto } from './services/supabase-locations';
import './App.css';

function App() {
  const { locations, resources, loading, error, refetchUserLocations } = useDataLoader();
  const { scoredLocations, priorities, setPriorities } = useScoring(locations, resources);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [addCoords, setAddCoords] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);

  const handleMapClick = useCallback((latlng) => {
    if (addMode && latlng) {
      setAddCoords({ lat: latlng.lat, lng: latlng.lng });
      setSelectedLocation(null);
    } else {
      setSelectedLocation(null);
      setAddCoords(null);
    }
  }, [addMode]);

  async function handleSaveNew(data) {
    const result = await addLocation(data);
    if (data.photo) {
      await uploadPhoto(result.id, data.photo);
    }
    await refetchUserLocations();
    setAddMode(false);
    setAddCoords(null);
  }

  async function handleUpdate(data) {
    await updateLocation(editingLocation.supabaseId, data);
    if (data.photo) {
      await uploadPhoto(editingLocation.supabaseId, data.photo);
    }
    await refetchUserLocations();
    setEditingLocation(null);
    setSelectedLocation(null);
  }

  async function handleDelete(loc) {
    if (!confirm('Are you sure you want to delete this location?')) return;
    await deleteLocation(loc.supabaseId);
    await refetchUserLocations();
    setSelectedLocation(null);
  }

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <h1>SHARE Shelter Map</h1>
          <p>Loading Seattle data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <h1>SHARE Shelter Map</h1>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  const showSidebar = selectedLocation && !editingLocation && !addCoords;
  const showAddForm = addCoords && !editingLocation;
  const showEditForm = editingLocation;

  return (
    <div className="app">
      <MapView
        scoredLocations={scoredLocations}
        selectedLocation={selectedLocation}
        resources={resources}
        addMode={addMode}
        addCoords={addCoords}
        onPinClick={(loc) => { setSelectedLocation(loc); setAddCoords(null); setEditingLocation(null); }}
        onMapClick={handleMapClick}
      />

      <PriorityPanel priorities={priorities} onUpdate={setPriorities} />

      <button
        className={`add-location-btn ${addMode ? 'active' : ''}`}
        onClick={() => { setAddMode(!addMode); setAddCoords(null); setSelectedLocation(null); }}
      >
        {addMode ? '✕ Cancel' : '+ Add Location'}
      </button>

      {showSidebar && (
        <div className="sidebar">
          <Sidebar
            location={selectedLocation}
            onClose={() => setSelectedLocation(null)}
            onEdit={selectedLocation.source === 'user' ? () => setEditingLocation(selectedLocation) : null}
            onDelete={selectedLocation.source === 'user' ? () => handleDelete(selectedLocation) : null}
          />
        </div>
      )}

      {showAddForm && (
        <div className="sidebar">
          <AddLocationForm
            lat={addCoords.lat}
            lng={addCoords.lng}
            onSave={handleSaveNew}
            onCancel={() => { setAddCoords(null); setAddMode(false); }}
          />
        </div>
      )}

      {showEditForm && (
        <div className="sidebar">
          <AddLocationForm
            lat={editingLocation.lat}
            lng={editingLocation.lng}
            initialData={editingLocation}
            onSave={handleUpdate}
            onCancel={() => setEditingLocation(null)}
          />
        </div>
      )}
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Add refetchUserLocations to useDataLoader**

Add a `refetchUserLocations` function to `src/hooks/useDataLoader.js` that re-fetches only user locations from Supabase and merges them into the existing locations state. Add it to the return:

```js
  const refetchUserLocations = useCallback(async () => {
    const userLocs = await fetchUserLocations();
    setLocations((prev) => [
      ...prev.filter((l) => l.source !== 'user'),
      ...userLocs,
    ]);
  }, []);

  return { locations, resources, loading, error, refetchUserLocations };
```

Add `useCallback` to the React import.

- [ ] **Step 5: Update MapView to handle add mode clicks**

In `MapView.jsx`, add click handler for add mode using `useMapEvents`:

```jsx
import { useMapEvents } from 'react-leaflet';

function MapClickHandler({ addMode, onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(addMode ? e.latlng : null);
    },
  });
  return null;
}
```

Add inside `<MapContainer>`:

```jsx
<MapClickHandler addMode={addMode} onMapClick={onMapClick} />
```

Remove the `onClick` prop from `<MapContainer>` (react-leaflet doesn't support it directly).

Also render a temporary marker at `addCoords` if present:

```jsx
{addCoords && (
  <Marker position={[addCoords.lat, addCoords.lng]}>
    <Tooltip permanent>New location — fill in the form →</Tooltip>
  </Marker>
)}
```

- [ ] **Step 6: Add button styles**

Add to `src/App.css`:

```css
.add-location-btn {
  position: absolute;
  top: 12px;
  left: 400px;
  z-index: 1000;
  background: #22c55e;
  color: #000;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  font-family: system-ui, sans-serif;
}

.add-location-btn.active {
  background: #ef4444;
  color: #fff;
}
```

- [ ] **Step 7: Add Edit/Delete buttons to Sidebar**

Update `src/components/Sidebar.jsx` to accept `onEdit` and `onDelete` props and render buttons:

After the `sidebar-legend` div, add:

```jsx
      {(onEdit || onDelete) && (
        <div className="sidebar-actions">
          {onEdit && <button className="sidebar-edit-btn" onClick={onEdit}>Edit</button>}
          {onDelete && <button className="sidebar-delete-btn" onClick={onDelete}>Delete</button>}
        </div>
      )}
```

Add to `Sidebar.css`:

```css
.sidebar-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #333;
}

.sidebar-edit-btn {
  flex: 1;
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 8px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.sidebar-delete-btn {
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
```

- [ ] **Step 8: Verify add/edit/delete flow**

```bash
npm run dev
```

Expected:
- Click "Add Location" → button turns red ("Cancel"), click map → marker + form appears
- Fill form, save → new pin appears with score
- Click user-added pin → sidebar shows Edit/Delete buttons
- Edit works, Delete shows confirmation then removes

- [ ] **Step 9: Commit**

```bash
git add src/components/AddLocationForm.jsx src/components/AddLocationForm.css src/components/Sidebar.jsx src/components/Sidebar.css src/components/MapView.jsx src/hooks/useDataLoader.js src/App.jsx src/App.css
git commit -m "feat: add, edit, delete user locations with Supabase persistence"
```

---

## Task 11: Contact Info Editing

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Add inline contact editing to Sidebar**

In `src/components/Sidebar.jsx`, add state for contact editing and a form:

```jsx
import { useState } from 'react';
import { upsertContactOverride } from '../services/supabase-locations';
```

Inside the component, add:

```jsx
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    website: contact?.website || '',
  });

  async function handleSaveContact() {
    await upsertContactOverride(location.id, contactDraft);
    setEditingContact(false);
    // Contact will show updated on next load
  }
```

After the contact info section in the header, add an "Edit Contact" button for API-sourced locations:

```jsx
  {location.source !== 'user' && (
    <button className="sidebar-contact-edit" onClick={() => setEditingContact(!editingContact)}>
      {editingContact ? 'Cancel' : '✏️ Edit Contact'}
    </button>
  )}

  {editingContact && (
    <div className="contact-edit-form">
      <input placeholder="Contact name" value={contactDraft.name} onChange={(e) => setContactDraft((p) => ({ ...p, name: e.target.value }))} />
      <input placeholder="Phone" value={contactDraft.phone} onChange={(e) => setContactDraft((p) => ({ ...p, phone: e.target.value }))} />
      <input placeholder="Email" value={contactDraft.email} onChange={(e) => setContactDraft((p) => ({ ...p, email: e.target.value }))} />
      <input placeholder="Website" value={contactDraft.website} onChange={(e) => setContactDraft((p) => ({ ...p, website: e.target.value }))} />
      <button className="contact-save-btn" onClick={handleSaveContact}>Save Contact</button>
    </div>
  )}
```

Add to `Sidebar.css`:

```css
.sidebar-contact-edit {
  background: none;
  border: none;
  color: #60a5fa;
  font-size: 11px;
  cursor: pointer;
  padding: 4px 0;
  margin-top: 4px;
}

.contact-edit-form {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contact-edit-form input {
  padding: 6px 8px;
  background: #252540;
  border: 1px solid #333;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
}

.contact-save-btn {
  background: #22c55e;
  color: #000;
  border: none;
  padding: 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 4px;
}
```

- [ ] **Step 2: Verify contact editing**

```bash
npm run dev
```

Expected: Click an API-sourced pin (e.g., a church from OSM) → sidebar shows "Edit Contact" link → click → form appears → fill in → Save → stored in Supabase.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx src/components/Sidebar.css
git commit -m "feat: contact info editing for all locations (API-sourced and user-added)"
```

---

## Task 12: Deploy to Vercel

**Files:**
- Modify: `vite.config.js`, `.gitignore`

- [ ] **Step 1: Remove GitHub Pages base path from Vite config**

Vercel serves from root, not a subdirectory. Update `vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
});
```

(Removed the `base: '/SHARE-Shelter-Project/'` line)

- [ ] **Step 2: Add build output to gitignore**

Add to `.gitignore`:

```
dist/
```

- [ ] **Step 3: Build locally to verify**

```bash
npm run build
```

Expected: `dist/` directory created with `index.html` and assets.

- [ ] **Step 4: Install Vercel CLI and login**

```bash
npm install -g vercel
vercel login
```

Login with the account that owns the project.

- [ ] **Step 5: Link project and add environment variables**

```bash
vercel link
```

Follow prompts to link to the `valkerey/SHARE-Shelter-Project` repo.

Then add Supabase env vars:

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

Paste the values when prompted. Add to all environments (Production, Preview, Development).

- [ ] **Step 6: Deploy preview to verify**

```bash
vercel
```

Expected: Builds and deploys to a preview URL. Open the URL — full app should load.

- [ ] **Step 7: Deploy to production**

```bash
vercel --prod
```

Expected: Live at your Vercel project URL (e.g., `share-shelter-project.vercel.app`).

- [ ] **Step 8: Enable auto-deploy from GitHub**

In Vercel dashboard → Project Settings → Git, connect the `valkerey/SHARE-Shelter-Project` repo. Every push to `main` auto-deploys to production.

- [ ] **Step 9: Commit config changes**

```bash
git add vite.config.js .gitignore
git commit -m "ci: configure for Vercel deployment"
git push origin main
```

Expected: Vercel auto-deploys from the push. Site live and functional.

---

## Post-Implementation Checklist

After all tasks are complete, verify:

- [ ] Map loads with all Seattle potential locations as colored pins
- [ ] Clicking a pin zooms in, shows 2 buffer circles, shows resource icons
- [ ] Sidebar displays location name, contact, score circle, resource counts
- [ ] Priority toggles recalculate all scores and recolor pins instantly
- [ ] "Add Location" flow works end-to-end (click map → form → save → pin appears)
- [ ] Edit and Delete work for user-added locations
- [ ] Contact editing works for API-sourced locations
- [ ] All tests pass (`npm run test`)
- [ ] Vercel deployment is live and functional
