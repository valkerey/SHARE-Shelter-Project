// Nominatim wrapper biased to Seattle. Free, no API key.
// Usage policy: <= 1 req/sec — callers should debounce.
// https://operations.osmfoundation.org/policies/nominatim/

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

// Seattle viewbox: left, top, right, bottom (lon/lat).
const SEATTLE_VIEWBOX = '-122.459696,47.734145,-122.224433,47.491912';

export async function geocode(query, { signal } = {}) {
  const q = query?.trim();
  if (!q || q.length < 3) return [];

  const params = new URLSearchParams({
    format: 'json',
    q,
    limit: '5',
    viewbox: SEATTLE_VIEWBOX,
    bounded: '1',
    addressdetails: '0',
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      signal,
      headers: { 'Accept-Language': 'en' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.map((row) => ({
      displayName: row.display_name,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lon),
    }));
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('Geocoder error:', err);
    return [];
  }
}
