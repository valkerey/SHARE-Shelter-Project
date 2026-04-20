/**
 * Normalize raw API data into consistent location and resource shapes.
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
