/**
 * ArcGIS REST service — fetches feature layers from ArcGIS Online and King County.
 */

import { normalizeLocation, normalizeResource } from '../utils/normalize';

/**
 * Extract [lat, lng] from a GeoJSON feature (Point or Polygon centroid).
 */
function extractCoords(feature) {
  const geom = feature.geometry;
  if (!geom) return null;

  if (geom.type === 'Point') {
    return { lat: geom.coordinates[1], lng: geom.coordinates[0] };
  }

  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    const ring =
      geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
    let sumLat = 0;
    let sumLng = 0;
    for (const [lng, lat] of ring) {
      sumLat += lat;
      sumLng += lng;
    }
    return { lat: sumLat / ring.length, lng: sumLng / ring.length };
  }

  return null;
}

/**
 * Fetch a GeoJSON FeatureServer layer with a given where clause.
 */
async function fetchLayer(url, where = '1=1') {
  const params = new URLSearchParams({
    where,
    outFields: '*',
    f: 'geojson',
    outSR: '4326',
  });
  const res = await fetch(`${url}/query?${params}`);
  if (!res.ok) throw new Error(`ArcGIS error ${res.status} for ${url}`);
  const geojson = await res.json();
  return geojson.features || [];
}

/**
 * Paginated fetch for layers that cap results (e.g. 1000 per request).
 */
async function fetchLayerPaginated(url, where = '1=1', pageSize = 1000) {
  let all = [];
  let offset = 0;
  let keepGoing = true;

  while (keepGoing) {
    const params = new URLSearchParams({
      where,
      outFields: '*',
      f: 'geojson',
      outSR: '4326',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });
    const res = await fetch(`${url}/query?${params}`);
    if (!res.ok) throw new Error(`ArcGIS error ${res.status} for ${url}`);
    const geojson = await res.json();
    const features = geojson.features || [];
    all = all.concat(features);

    if (features.length < pageSize) {
      keepGoing = false;
    } else {
      offset += pageSize;
    }
  }

  return all;
}

// ── Hospitals ───────────────────────────────────────────────────────────────

export async function fetchHospitals() {
  const url =
    'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Hospital/FeatureServer/0';
  const features = await fetchLayer(url);

  return features
    .map((f) => {
      const c = extractCoords(f);
      if (!c) return null;
      const p = f.properties || {};
      return normalizeResource({
        id: `arcgis-hosp-${p.OBJECTID || p.FID || Math.random().toString(36).slice(2)}`,
        lat: c.lat,
        lng: c.lng,
        name: p.NAME || p.FACILITY || '',
        resourceType: 'hospital',
        source: 'arcgis',
        contact: {
          phone: p.TELEPHONE || '',
          website: p.URL || p.WEBSITE || '',
        },
      });
    })
    .filter(Boolean);
}

// ── Schools (public + private, merged) ──────────────────────────────────────

export async function fetchSchools() {
  const publicUrl =
    'https://services2.arcgis.com/I7NQBinfvOmxQbXs/arcgis/rest/services/vw_schools_2023/FeatureServer/0';
  const privateUrl =
    'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Private_School/FeatureServer/0';

  const [pubFeatures, privFeatures] = await Promise.all([
    fetchLayer(publicUrl),
    fetchLayer(privateUrl),
  ]);

  const normalize = (f, prefix) => {
    const c = extractCoords(f);
    if (!c) return null;
    const p = f.properties || {};
    return normalizeResource({
      id: `arcgis-school-${prefix}-${p.OBJECTID || p.FID || Math.random().toString(36).slice(2)}`,
      lat: c.lat,
      lng: c.lng,
      name: p.NAME || p.SCHOOL || p.SchoolName || '',
      resourceType: 'school',
      source: 'arcgis',
    });
  };

  return [
    ...pubFeatures.map((f) => normalize(f, 'pub')).filter(Boolean),
    ...privFeatures.map((f) => normalize(f, 'priv')).filter(Boolean),
  ];
}

// ── Libraries ───────────────────────────────────────────────────────────────

export async function fetchLibraries() {
  const url =
    'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Seattle_Public_Library/FeatureServer/0';
  const features = await fetchLayer(url);

  return features
    .map((f) => {
      const c = extractCoords(f);
      if (!c) return null;
      const p = f.properties || {};
      return normalizeResource({
        id: `arcgis-lib-${p.OBJECTID || p.FID || Math.random().toString(36).slice(2)}`,
        lat: c.lat,
        lng: c.lng,
        name: p.NAME || p.BRANCH || '',
        resourceType: 'library',
        source: 'arcgis',
      });
    })
    .filter(Boolean);
}

// ── Community Centers (ArcGIS) ──────────────────────────────────────────────

export async function fetchCommunityCentersArcGIS() {
  const url =
    'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Community_Centers/FeatureServer/0';
  const features = await fetchLayer(url);

  return features
    .map((f) => {
      const c = extractCoords(f);
      if (!c) return null;
      const p = f.properties || {};
      return normalizeLocation({
        id: `arcgis-cc-${p.OBJECTID || p.FID || Math.random().toString(36).slice(2)}`,
        lat: c.lat,
        lng: c.lng,
        name: p.NAME || p.FACILITY || '',
        address: p.ADDRESS || '',
        type: 'community_center',
        source: 'arcgis',
        contact: {
          phone: p.PHONE || '',
          website: p.URL || p.WEBSITE || '',
        },
        raw: p,
      });
    })
    .filter(Boolean);
}

// ── City-Owned Property ─────────────────────────────────────────────────────

export async function fetchCityProperty() {
  const url =
    'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/City_Property_Primary_Jurisdiction/FeatureServer/2';
  const features = await fetchLayer(url, "CITY_OWNED = 'Y' AND STATUS = 'Active'");

  return features
    .map((f) => {
      const c = extractCoords(f);
      if (!c) return null;
      const p = f.properties || {};
      return normalizeLocation({
        id: `arcgis-city-${p.OBJECTID || p.FID || Math.random().toString(36).slice(2)}`,
        lat: c.lat,
        lng: c.lng,
        name: p.NAME || p.DESCRIPTION || 'City Property',
        address: p.ADDRESS || '',
        type: 'public_facility',
        source: 'arcgis',
        raw: p,
      });
    })
    .filter(Boolean);
}

// ── Nonprofit Parcels (King County — paginated) ─────────────────────────────

export async function fetchNonprofitParcels() {
  const url =
    'https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2';
  const features = await fetchLayerPaginated(
    url,
    "CTYNAME='SEATTLE' AND PREUSE_CODE=165",
    1000,
  );

  return features
    .map((f) => {
      const c = extractCoords(f);
      if (!c) return null;
      const p = f.properties || {};
      return normalizeLocation({
        id: `arcgis-np-${p.OBJECTID || p.FID || Math.random().toString(36).slice(2)}`,
        lat: c.lat,
        lng: c.lng,
        name: p.TAXPAYER_NAME || p.NAME || 'Nonprofit Parcel',
        address: p.ADDR_FULL || p.SITE_ADDR || '',
        type: 'nonprofit',
        source: 'arcgis_kingcounty',
        raw: p,
      });
    })
    .filter(Boolean);
}
