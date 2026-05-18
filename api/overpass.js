export const config = { runtime: 'edge' };

const UPSTREAM = 'https://overpass-api.de/api/interpreter';

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await request.text();

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await upstream.text();

  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': upstream.ok
        ? 'public, s-maxage=600, stale-while-revalidate=3600'
        : 'no-store',
    },
  });
}
