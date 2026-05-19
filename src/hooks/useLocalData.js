import { useState, useEffect } from 'react';

function geoJsonToPoints(geojson) {
  if (!geojson?.features) return [];
  return geojson.features
    .filter((f) => f.geometry?.type === 'Point' && f.geometry.coordinates?.length >= 2)
    .map((f) => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { values.push(cur); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
  });
}

const ok = (r) => (r.status === 'fulfilled' ? r.value : null);

export default function useLocalData() {
  const [localData, setLocalData] = useState({
    bikeInfra: [],
    transit: [],
    libraries: [],
    healthcare: [],
    foodSocial: [],
    parksGeoJSON: null,
    vacantBuildings: [],
    churches: [],
  });
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        fetch('/data/resources/bike_lockers.json').then((r) => r.json()),   // 0
        fetch('/data/resources/bike_racks.json').then((r) => r.json()),     // 1
        fetch('/data/resources/bus_stops.geojson').then((r) => r.json()),   // 2
        fetch('/data/resources/link_stations.json').then((r) => r.json()),  // 3
        fetch('/data/resources/libraries.geojson').then((r) => r.json()),   // 4
        fetch('/data/resources/healthcare.geojson').then((r) => r.json()),  // 5
        fetch('/data/resources/food_banks.json').then((r) => r.json()),     // 6
        fetch('/data/resources/community_centers.json').then((r) => r.json()), // 7
        fetch('/data/resources/parks_polygons.geojson').then((r) => r.json()), // 8
        fetch('/data/host-sites/churches.geojson').then((r) => r.json()),   // 9
        fetch('/data/host-sites/vacant_buildings.csv').then((r) => r.text()), // 10
      ]);

      const bikeLockers = ok(results[0]) ? geoJsonToPoints(ok(results[0])) : [];
      const bikeRacks = ok(results[1]) ? geoJsonToPoints(ok(results[1])) : [];
      const busStops = ok(results[2]) ? geoJsonToPoints(ok(results[2])) : [];
      const linkStations = ok(results[3]) ? geoJsonToPoints(ok(results[3])) : [];
      const libraries = ok(results[4]) ? geoJsonToPoints(ok(results[4])) : [];
      const healthcare = ok(results[5]) ? geoJsonToPoints(ok(results[5])) : [];
      const foodBanks = ok(results[6]) ? geoJsonToPoints(ok(results[6])) : [];
      const commCenters = ok(results[7]) ? geoJsonToPoints(ok(results[7])) : [];
      const parksGeoJSON = ok(results[8]) || null;
      const churches = ok(results[9]) ? geoJsonToPoints(ok(results[9])) : [];

      let vacantBuildings = [];
      if (ok(results[10])) {
        vacantBuildings = parseCSV(ok(results[10]))
          .filter((r) => r.Lat && r.Long && !isNaN(parseFloat(r.Lat)))
          .map((r) => ({ ...r, lat: parseFloat(r.Lat), lng: parseFloat(r.Long) }));
      }

      setLocalData({
        bikeInfra: [...bikeLockers.map((p) => ({ ...p, _type: 'bike' })),
                    ...bikeRacks.map((p) => ({ ...p, _type: 'bike' }))],
        transit:   [...busStops.map((p) => ({ ...p, _type: 'transit', _subtype: 'bus' })),
                    ...linkStations.map((p) => ({ ...p, _type: 'transit', _subtype: 'rail' }))],
        libraries:  libraries.map((p) => ({ ...p, _type: 'libraries' })),
        healthcare: healthcare.map((p) => ({ ...p, _type: 'healthcare' })),
        foodSocial: [...foodBanks.map((p) => ({ ...p, _type: 'foodSocial' })),
                     ...commCenters.map((p) => ({ ...p, _type: 'foodSocial' }))],
        parksGeoJSON,
        vacantBuildings,
        churches,
      });
      setLocalLoading(false);
    }
    load();
  }, []);

  return { localData, localLoading };
}
