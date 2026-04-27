# Vacant Building Permit Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SoQL filter in `fetchBuildingPermits` so the "vacant buildings" map layer surfaces commercial parcels with active demolition/conversion permits removing housing units — a sharper signal for SHARE shelter site candidates than the current "recently expired commercial permit" heuristic.

**Architecture:** Single-file edit in `src/services/soda.js`. The function name, return shape, and downstream consumers (`useDataLoader`, scoring engine, marker styling) stay unchanged. Only the SoQL `$where` clause, popup `name` formatting, and section comment change. No new tests — this is a query-string adjustment, verified by running the app and inspecting markers.

**Tech Stack:** React + Vite (existing), Socrata Open Data API (`data.seattle.gov`), dataset `76t5-zqzr` (Building Permits).

**Spec:** `docs/superpowers/specs/2026-04-27-vacant-building-permit-filter-design.md`

---

## File Structure

- Modify: `src/services/soda.js` (lines 35–65, the `fetchBuildingPermits` function and its section comment)

No files created. No files deleted. No other consumers touched.

---

### Task 1: Update the building permits query and popup label

**Files:**
- Modify: `src/services/soda.js:35-65`

- [ ] **Step 1: Read the current function to confirm line numbers**

Run: `sed -n '35,65p' src/services/soda.js`
Expected: prints the existing `// ── Building Permits ...` comment block and the current `fetchBuildingPermits` function with the `expiresdate < cutoffStr` filter.

- [ ] **Step 2: Replace the function**

Replace the existing block from line 35 (the section comment) through line 65 (closing brace of `fetchBuildingPermits`) with:

```javascript
// ── Building Permits (active commercial permits removing housing — potential vacant buildings) ───

export async function fetchBuildingPermits() {
  const where = encodeURIComponent(
    `permitclass = 'Commercial' ` +
      `AND housingunitsremoved > 0 ` +
      `AND statuscurrent NOT IN ('Completed', 'Expired', 'Closed', 'Canceled', 'Withdrawn') ` +
      `AND latitude IS NOT NULL`,
  );
  const url = `${BASE}/76t5-zqzr.json?$where=${where}&$limit=5000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SODA permits error ${res.status}`);
  const rows = await res.json();

  return rows
    .filter((r) => r.latitude && r.longitude)
    .map((r) =>
      normalizeLocation({
        id: `soda-permit-${r.applieddate || ''}-${r.permitnum || Math.random().toString(36).slice(2)}`,
        lat: parseFloat(r.latitude),
        lng: parseFloat(r.longitude),
        name: `${r.housingunitsremoved} units removed — ${r.statuscurrent || 'unknown status'}`,
        address: r.originaladdress || r.address || '',
        type: 'vacant_building',
        source: 'seattle_open_data',
        raw: r,
      }),
    );
}
```

Key differences from the old code:
- The `cutoff` / `cutoffStr` lines are gone.
- The `$where` clause uses the three new filters from the spec.
- `name` now reports `housingunitsremoved` and `statuscurrent` instead of the generic `description`.
- Section comment reflects the new intent.

- [ ] **Step 3: Lint the file**

Run: `npm run lint -- src/services/soda.js`
Expected: no errors. (If ESLint complains about the multi-line template concatenation, switch to a single backtick template literal — semantics are identical.)

- [ ] **Step 4: Manually exercise the query in a browser**

Open this URL in any browser (no key needed — SODA is public):

```
https://data.seattle.gov/resource/76t5-zqzr.json?$where=permitclass%20%3D%20%27Commercial%27%20AND%20housingunitsremoved%20%3E%200%20AND%20statuscurrent%20NOT%20IN%20(%27Completed%27%2C%20%27Expired%27%2C%20%27Closed%27%2C%20%27Canceled%27%2C%20%27Withdrawn%27)%20AND%20latitude%20IS%20NOT%20NULL&$limit=5
```

Expected: a JSON array of up to 5 permits. Each row should have:
- `permitclass: "Commercial"`
- `housingunitsremoved` as a string representing a positive integer (e.g. `"3"`)
- `statuscurrent` not in the exclusion list
- non-null `latitude` / `longitude`

If the response is empty or returns a 400, the SoQL syntax is wrong — fix the `$where` string before moving on.

- [ ] **Step 5: Run the dev server and smoke-test the layer**

Run: `npm run dev`
Then open the printed local URL (typically `http://localhost:5173`).

Verification checklist:
1. Open DevTools console — no red errors mentioning `soda` or `permits`.
2. Open the data-source status panel — `Vacant buildings (Seattle SODA)` shows `ok` with a non-zero count (expect tens to low hundreds).
3. Click a vacant-building marker — popup should read like `"3 units removed — Application Accepted"` and an address.
4. Confirm at least one popup's `statuscurrent` is *not* in `Completed / Expired / Closed / Canceled / Withdrawn`.

If any check fails, stop and diagnose before committing. Common causes: dataset field name casing, `$where` URL-encoding, or `housingunitsremoved` arriving as a string that the comparison rejects (Socrata coerces numbers in SoQL, so `> 0` should work — if not, try `housingunitsremoved IS NOT NULL`).

- [ ] **Step 6: Stop the dev server and commit**

Stop the dev server (Ctrl-C).

```bash
git add src/services/soda.js docs/superpowers/specs/2026-04-27-vacant-building-permit-filter-design.md docs/superpowers/plans/2026-04-27-vacant-building-permit-filter.md
git commit -m "feat: filter building permits by active commercial demolitions removing housing"
```

(If the spec or plan files are already committed from an earlier step, just `git add src/services/soda.js` and commit the code alone.)

---

## Self-Review

**Spec coverage:**
- Filter clause (permitclass, housingunitsremoved, statuscurrent NOT IN, latitude) → Task 1, Step 2.
- Drop unused cutoff lines → Task 1, Step 2 (removed in the replacement block).
- Popup `name` change → Task 1, Step 2.
- Section comment update → Task 1, Step 2.
- "No new unit tests needed" → reflected in plan; verification is via the browser smoke test in Steps 4–5.
- Out-of-scope items (marker recolor, status filter UI, % removed stat) → not in plan. ✓

**Placeholder scan:** No "TBD", "TODO", or "fill in" markers. All commands and code are concrete. ✓

**Type consistency:** Function signature unchanged (`fetchBuildingPermits()` returning `Promise<Location[]>` via `normalizeLocation`). The `type: 'vacant_building'` value matches the existing convention used in the rest of the codebase. ✓

No fixes needed.
