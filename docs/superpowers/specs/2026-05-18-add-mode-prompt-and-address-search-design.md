# Add-mode prompt + address search — design

**Date:** 2026-05-18
**Topic:** Make the "suggest a new location" flow self-explanatory by showing a prompt that tells the user to click on the map, and let them search by address as an alternative to clicking.

## Problem

Today, when a user clicks **"+ Suggest a Location"** (`src/App.jsx:290-304`), three things change silently:

1. `addMode` flips to `true`.
2. The button label becomes **"✕ Cancel"**.
3. The map's click handler is wired to `handleMapClick` (`src/components/MapView.jsx:81-92`).

Nothing on screen tells the user *what to do next* — there's no prompt, no cursor change, no indication the map is now interactive. The form (`AddLocationForm`) is only mounted after `addCoords` is set, so until the user happens to click the map, the screen looks unchanged.

There is also no way to enter an address — the only way to drop a pin is to click the map at the right spot.

## Goals

- Make it immediately obvious that the next step is to click the map.
- Offer address search as an alternative way to drop the pin, biased to Seattle.
- Match the project's liquid-glass design language and zero-budget constraint (no paid APIs, no new heavy dependencies).

## Non-goals

- Reverse geocoding (filling in the form's `address` field from a clicked point) — out of scope.
- Geocoding as a standalone, always-on map feature — search only appears inside add mode.
- A typeahead autocomplete library — a plain input with a small custom dropdown is enough.

## User flow

1. User clicks **"+ Suggest a Location"** (top-right toggle).
2. A floating glass banner appears at the top-center of the map containing:
   - The line: **"Click anywhere on the map to drop a pin"**.
   - The line: **"or search for an address"**.
   - A search `<input>` styled with the existing glass tokens.
3. The map's cursor changes to `crosshair` so the map clearly looks clickable.
4. The user either:
   - **Clicks the map** → existing behavior: `setAddCoords({lat, lng})` → form mounts.
   - **Types an address** → debounced (~400 ms) Nominatim call → dropdown of up to 5 results → picking one calls the same `setAddCoords` handler and pans the map to the chosen point.
5. Once `addCoords` is set, the banner hides (form is now visible on the right).
6. **Cancel** in the top-right toggle clears `addMode` and `addCoords`, banner disappears, cursor returns to default.

## Components and files

### New: `src/components/AddModeBanner.jsx`

A self-contained floating panel rendered only when `addMode && !addCoords`. Props:

- `onPick({ lat, lng })` — called when the user picks a search result. App wires this to `setAddCoords` and clears `selectedLocation` / `editingLocation`.

Internals:

- Local state: `query`, `results`, `loading`, `error`, `highlightIndex`.
- Uses the geocoder util (below).
- Renders the prompt copy + an `<input>` + a results list. Result list collapses when `query.trim() === ''` or no results.
- Keyboard handling: `ArrowUp` / `ArrowDown` move highlight, `Enter` picks the highlighted (or first) result, `Escape` clears the query.
- Root element uses `glass-panel` per the project's design language.

### New: `src/components/AddModeBanner.css`

Positions the banner: `position: absolute; top: 16px; left: 50%; transform: translateX(-50%);` with a `z-index` greater than the Leaflet map panes (Leaflet uses `z-index: 400` on `.leaflet-pane`; using `z-index: 1000` matches the project's other floating panels).

Styles for the input and results list reuse `--glass-tint`, `--glass-border`, `--glass-radius` tokens. Result list items get a subtle highlight on hover / keyboard focus.

### New: `src/services/geocoder.js`

A small wrapper around Nominatim's free public endpoint.

- `geocode(query, { signal })` → Promise<Array<{ displayName, lat, lng }>>.
- Endpoint: `https://nominatim.openstreetmap.org/search`.
- Query parameters:
  - `format=json`
  - `q=<query>`
  - `limit=5`
  - `viewbox=-122.459696,47.734145,-122.224433,47.491912` (Seattle bounds)
  - `bounded=1` so out-of-Seattle hits don't show
  - `addressdetails=0`
- Headers: `Accept-Language: en`. (The browser sets `User-Agent` automatically; Nominatim's policy is met as long as we are not abusive.)
- Aborts in-flight calls when the caller passes a new `AbortSignal`.
- Returns `[]` on HTTP errors so the UI shows "no results" rather than crashing. Logs errors to console.

### Modified: `src/App.jsx`

- Import and render `<AddModeBanner />` when `addMode && !addCoords`.
- Wire `onPick={(coords) => { setAddCoords(coords); setSelectedLocation(null); setEditingLocation(null); }}`.
- Pass a `flyToCoords` prop (or similar) to `MapView` so the map pans to the geocoded point. Simplest: piggyback on the existing `MapController` flow by treating the dropped pin's coords as a fly-to target — see MapView change below.

### Modified: `src/components/MapView.jsx`

- Accept the existing `addMode` prop and apply a class like `map-container--add-mode` on the wrapping `MapContainer` element (or use a small `useEffect` inside a child of `MapContainer` to add a class to `map.getContainer()`). The class sets `cursor: crosshair`.
- Extend `MapController` so it also flies to `addCoords` when it changes (currently it only flies to `selectedLocation`). This ensures both map-clicks and geocoder picks pan the map.
- No change to the existing `addCoords` Marker / tooltip at the bottom of the file — keeps working.

### Modified: `src/App.css` (or `AddModeBanner.css`)

- Add `.map-container--add-mode .leaflet-grab { cursor: crosshair; }` (Leaflet sets a `.leaflet-grab` class on the map's container; targeting that overrides the default pan cursor).
- Banner styles can live in `AddModeBanner.css` to keep `App.css` from growing.

## Data flow

```
User clicks "+ Suggest a Location"
  └─ App: setAddMode(true)

AddModeBanner mounts (addMode && !addCoords)
  └─ user types  → debounce 400ms → geocoder.geocode()  → results dropdown
  └─ user picks  → onPick({lat, lng})

App: setAddCoords({lat, lng})
  ├─ AddModeBanner unmounts (addCoords is now set)
  ├─ MapView: MapController flies to addCoords
  └─ AddLocationForm mounts on the right
```

Clicking the map directly bypasses the geocoder and goes straight to `setAddCoords` via the existing `MapClickHandler`.

## Error handling

- Network error / non-2xx from Nominatim: show **"Could not search right now"** under the input. The user can still click the map.
- Empty result set: show **"No matches in Seattle. Try a more specific address."**
- Query under 3 characters: don't call the API.
- AbortController cancels stale calls when the user keeps typing.

## Testing

- Manual: confirm the banner appears on add-mode toggle, disappears on cancel / after a pin is dropped, that the cursor becomes a crosshair, that picking a search result drops a pin and opens the form, and that the map flies to the picked point.
- Unit (optional, low value here): `geocoder.js` is a thin wrapper; a single test that it builds the right query string and parses the response shape is enough.
- No new automated coverage required for the banner — the surface area is small and the existing add-suggestion flow is exercised end-to-end by the user.

## Risks

- **Nominatim rate limit (1 req/sec public).** Debouncing to 400 ms + AbortController for stale calls makes this effectively impossible to hit from a single browser. If we ever wanted heavier use, we'd move to Photon or self-host.
- **Cursor styling on touch devices.** Touch users don't see cursors; the banner copy ("Click anywhere on the map…") covers them. Acceptable.
- **Search bias to Seattle (`bounded=1`).** SHARE's coverage area is Seattle west of Lake Washington, so bounding to a Seattle viewbox matches scope. If a future use case requires King County, we drop `bounded=1`.

## Out of scope / follow-ups

- Reverse geocoding to auto-fill the `address` field in `AddLocationForm` — could be a small follow-up once this lands.
- Replacing the public Nominatim endpoint with a self-hosted one — only relevant if traffic grows.
