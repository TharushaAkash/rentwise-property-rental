import React, { useEffect, useState } from 'react';

const pending = new Map();
let lookupQueue = Promise.resolve();
let lastLookup = 0;
function locate(address) {
  if (pending.has(address)) return pending.get(address);
  const request = lookupQueue.then(async () => {
    const key = `rentwise_map_address:${address}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Date.now() - cached.savedAt < 86400000) return cached.point;
    } catch { /* Storage is optional. */ }
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastLookup))));
    lastLookup = Date.now();
    const base = import.meta.env.VITE_MAP_GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
    const url = new URL(base);
    url.search = new URLSearchParams({ q: address, format: 'jsonv2', countrycodes: 'lk', limit: '2' }).toString();
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Map lookup is temporarily unavailable.');
    const results = await response.json();
    if (!Array.isArray(results) || !results.length) throw new Error('No map match was found for this address.');
    const point = { lat: Number(results[0].lat), lon: Number(results[0].lon) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) throw new Error('Invalid map location.');
    try { localStorage.setItem(key, JSON.stringify({ point, savedAt: Date.now() })); } catch { /* Storage is optional. */ }
    return point;
  });
  lookupQueue = request.catch(() => {});
  pending.set(address, request);
  request.finally(() => pending.delete(address)).catch(() => {});
  return request;
}

export function PropertyLocationCard({ property, address }) {
  const [state, setState] = useState({ point: null, loading: true, error: '', approximate: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ point: null, loading: true, error: '', approximate: true });
    const rawLat = property?.latitude ?? property?.Latitude;
    const rawLon = property?.longitude ?? property?.Longitude;
    const lat = Number(rawLat), lon = Number(rawLon);
    if (rawLat != null && rawLon != null && rawLat !== '' && rawLon !== '' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      setState({ point: { lat, lon }, loading: false, error: '', approximate: false });
    } else if (!address || address === 'Address not specified') {
      setState({ point: null, loading: false, error: 'No property address is available.', approximate: true });
    } else {
      locate(address).then(point => { if (active) setState({ point, loading: false, error: '', approximate: true }); })
        .catch(() => { if (active) setState({ point: null, loading: false, error: 'Map location is unavailable. Use Google Maps to check the address.', approximate: true }); });
    }
    return () => { active = false; };
  }, [address, property?.latitude, property?.Latitude, property?.longitude, property?.Longitude, retry]);
  const point = state.point;
  const embed = point ? `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({ bbox: `${point.lon - .006},${point.lat - .004},${point.lon + .006},${point.lat + .004}`, layer: 'mapnik', marker: `${point.lat},${point.lon}` })}` : '';
  return <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs">
    <h3 className="text-lg font-bold text-gray-900">Location</h3>
    <p className="mt-1 mb-4 text-sm text-gray-500">{address}</p>
    {point ? <iframe key={embed} title="Property location on OpenStreetMap" src={embed} className="h-64 w-full rounded-xl border border-gray-200" referrerPolicy="strict-origin-when-cross-origin" />
      : <div role="status" className="flex h-64 items-center justify-center rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-600">{state.loading ? 'Loading map...' : state.error}</div>}
    {point && <p className="mt-2 text-xs text-gray-500">{state.approximate ? 'Top address match; confirm the exact property location with the landlord.' : 'Property location'}</p>}
    <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
      {point && <a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=16/${point.lat}/${point.lon}`} target="_blank" rel="noopener noreferrer">Expand map</a>}
      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`} target="_blank" rel="noopener noreferrer">View location on Google Maps</a>
      {!state.loading && state.error && <button type="button" onClick={() => setRetry(value => value + 1)}>Retry map</button>}
    </div>
    <a className="mt-3 block text-xs text-gray-500" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>
  </section>;
}
