# Vacant Building Permit Filter — Design

**Date:** 2026-04-27
**Scope:** Replace the SoQL filter in `fetchBuildingPermits` so the "vacant buildings" layer surfaces commercial properties with active demolition/conversion permits — the most plausible candidate sites for SHARE shelter hosting.

## Background

The current implementation in `src/services/soda.js` filters Seattle Building Permits (`76t5-zqzr`) by `expiresdate < (12 months ago) AND permitclass = 'Commercial'`. Recently expired commercial permits were used as a weak proxy for "something might be vacant here." This conflates two different signals: a permit expiring is not the same as a building being empty, and many expired permits are for unrelated work (signage, mechanical, etc.) on occupied buildings.

The new filter targets a sharper signal: commercial parcels where the owner has filed a permit that would remove existing housing units, and where the permit process is still active. The window between filing and groundbreaking can be months to years, during which the building often sits vacant — exactly the situation where SHARE could ask to host a shelter.

## Filter Specification

Replace the `$where` clause with:

```sql
permitclass = 'Commercial'
AND housingunitsremoved > 0
AND statuscurrent NOT IN ('Completed', 'Expired', 'Closed', 'Canceled', 'Withdrawn')
AND latitude IS NOT NULL
```

**Rationale per clause:**

| Clause | Why |
|---|---|
| `permitclass = 'Commercial'` | Commercial owners are more likely to negotiate a temporary use agreement than residential owners, and their redevelopment timelines are longer. |
| `housingunitsremoved > 0` | Proves the parcel currently has habitable units that will be demolished — i.e., units that may be sitting empty right now. |
| `statuscurrent NOT IN (...)` | Removes dead leads (work finished, permit dropped). Anything else — `Application Accepted`, `Plan Review`, `Permit Issued`, etc. — passes through as "ongoing." |
| `latitude IS NOT NULL` | Required for mapping; carried over from existing query. |

## Implementation Changes

Single file: `src/services/soda.js`.

1. Remove the now-unused `cutoff` / `cutoffStr` lines.
2. Update the `$where` clause as above.
3. Update the popup `name` to `"${r.housingunitsremoved} units removed — ${r.statuscurrent}"` so the sidebar conveys *why* the site is a candidate. Address still comes from `r.originaladdress`.
4. Update the section comment from "expired commercial — potential vacant buildings" to "active commercial permits removing housing — potential vacant buildings."

No changes to: `useDataLoader.js` (the function name and shape stay the same), the scoring engine, the marker styling, or any UI component.

## Out of Scope

- New marker color or category for vacant buildings.
- Sidebar filter UI to let users toggle by status.
- Fetching `housingunits` (units before demolition) for a "% removed" stat.
- Backfill or caching strategy — the dataset is small and the existing live-fetch model is sufficient.

## Testing

Manual smoke test in the browser:
- Verify the layer loads without console errors.
- Spot-check 2–3 markers on the map: their popups should show a non-zero `units removed` count and a `statuscurrent` value not in the exclusion list.
- Confirm the count in the data-source status panel is plausible (likely tens to low hundreds across Seattle, not thousands).

No new unit tests needed — the change is a query-string adjustment, not new logic.
