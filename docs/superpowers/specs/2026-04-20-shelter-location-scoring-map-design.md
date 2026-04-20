# SHARE Shelter Location Scoring Map — Design Spec

**Date:** April 20, 2026
**Status:** Step 1 of the SHARE web map app
**Scope:** City-wide Seattle (west of Lake Washington)

## Overview

An interactive web map that displays potential shelter host locations across Seattle, scores each location based on surrounding resources (transit, food, education, health, community services), and lets users explore details by clicking pins. All data is live from public APIs — no pre-computed static layers or desktop GIS dependency.

In v1, all users have full access (no authentication). Auth and role-based permissions will be added in a later step.

## Coverage Area

All of Seattle, west of Lake Washington. Does not include Bellevue or the Eastside. The map opens zoomed out to show the full city with all potential location pins visible.

## Potential Shelter Location Types

Locations are sourced from live public APIs on app load.

| Location Type | Data Source | Identification Method |
|:--|:--|:--|
| Churches / places of worship | OSM Overpass | `amenity=place_of_worship` within Seattle bounds |
| Community centers | OSM Overpass + Seattle SODA | `amenity=community_centre` (OSM) + city facilities dataset |
| Vacant commercial buildings | Seattle SODA (building permits) + King County parcels | Parcels with commercial use code + permits expired/inactive for 12+ months |
| Underutilized public facilities | Seattle SODA | City-owned properties dataset, filtered by facility type |
| Nonprofit-owned properties | King County ArcGIS REST | Parcels with tax-exempt status |

## Resource Types

Resources are queried from live APIs on app load and cached in browser memory.

| Category | Resources | Data Source |
|:--|:--|:--|
| **Transit** | Bus stops, light rail stations | King County Metro GTFS, Sound Transit GTFS |
| **Food** | Food banks, grocery stores | Seattle SODA, OSM Overpass |
| **Education** | Schools, daycare | Seattle SODA |
| **Health** | Hospitals | Seattle SODA / King County ArcGIS REST |
| **Community** | Libraries, community centers | Seattle SODA, OSM Overpass |
| **Daily Needs** | Laundromats, pharmacies | OSM Overpass |

## Scoring System

### Priority Toggles (User-Configurable)

Each resource category has a 3-level priority toggle. Users tap one button per category.

| Priority | Meaning | Multiplier |
|:--|:--|:--|
| **High** | Very important | 3x |
| **Medium** | Somewhat important | 2x |
| **Low** | Not a priority | 1x |

Default priorities:

| Category | Default Priority |
|:--|:--|
| Transit | High |
| Food | High |
| Education | Medium |
| Health | Medium |
| Community | Low |
| Daily Needs | Low |

### Score Calculation

For each potential location, within the 15-min walk buffer (1.2km). The score uses only the outer buffer (1.2km) for calculation. The sidebar displays counts for both 400m and 1.2km for informational purposes, but only the 1.2km counts feed into the score.

```
category_score = min(resource_count / saturation_point, 1.0) × 100
overall_score = sum(category_score × multiplier) / sum(multipliers)
```

### Saturation Points

The count at which a category reaches its maximum score. More than this doesn't add extra points.

| Resource | Saturation Point (within 1.2km) |
|:--|:--|
| Bus stops | 4 |
| Light rail stations | 1 |
| Food banks | 2 |
| Grocery stores | 2 |
| Schools / daycare | 2 |
| Hospitals | 1 |
| Libraries | 1 |
| Community centers | 1 |
| Laundromats | 1 |
| Pharmacies | 1 |

### Score-to-Color Mapping

| Score Range | Pin Color | Label |
|:--|:--|:--|
| 75–100 | Green | Great Location |
| 50–74 | Yellow | Okay Location |
| 0–49 | Red | Limited Resources |

## Contact Information

Two-source approach: auto-populated from public data + user-editable.

### Auto-populated Sources

| Location Type | Contact Data Source |
|:--|:--|
| Churches | OSM tags (`phone`, `website`, `contact:email`) |
| Community centers | City dataset (phone, address) |
| Vacant buildings | King County parcels (taxpayer name on record) |
| Public facilities | City dataset (department contact) |
| Nonprofits | WA Secretary of State business lookup (registered agent) |

### User Edits

Any user (v1 — no auth) can edit contact info for any location. User edits are stored in Supabase and override auto-populated data. Fields: contact name, phone, email, website.

## Map Interaction Flow

### Default View
1. App opens → Seattle zoomed out, all potential locations as color-coded pins
2. User sees green clusters (resource-rich areas) vs. red pins (limited resources)

### Pin Click
3. User clicks a pin → map zooms in to the location
4. Two buffer circles appear: 5-min walk (400m, inner) and 15-min walk (1.2km, outer)
5. Resource icons appear within the buffers on the map
6. Sidebar slides open with location details

### Sidebar Content (on pin click)
- Location name and type icon
- Address
- Contact info (phone, email, website — if available)
- Score circle with plain-English label (e.g., "82 — Great Location")
- Resource list: each row shows icon + name + bold count (5 min) / gray count (15 min)
- Counts color-coded: green (has resources), yellow (few), red (none)

### Priority Settings
7. User clicks "Set Priorities" button
8. Priority panel shows 6 categories, each with Low / Med / High toggle buttons
9. User taps to set priorities, hits "Update Map"
10. All pin colors recalculate instantly (client-side)

### Navigation Between Pins
11. Click another pin → previous buffers disappear, new ones appear, sidebar updates
12. Click empty map area → sidebar closes, buffers disappear, zoom resets

## User Actions (v1 — Everyone Has Full Access)

### View & Explore
- Pan/zoom the map
- Click pins to see details and buffers
- Set priority toggles to reweight scores

### Add a Location
- Click "Add Location" button (always visible, v1 has no auth)
- Click on the map to place a pin
- Fill sidebar form: name, type (dropdown), notes, photo (upload), contact info
- Hit "Save" → stored in Supabase, pin appears, score auto-calculated

### Edit a Location
- Click any user-added pin → "Edit" button in sidebar
- Opens same form pre-filled with current data
- Save updates Supabase

### Delete a Location
- Click any user-added pin → "Delete" button in sidebar
- Confirmation prompt: "Are you sure?"
- Removes from Supabase and map

### Edit Contact Info
- Available on ALL locations (including API-sourced)
- "Edit Contact" button in sidebar
- Fields: contact name, phone, email, website
- Stored in Supabase as overlay on auto-populated data

Note: Only user-added locations can be fully edited/deleted. API-sourced locations (from OSM, SODA, etc.) can only have their contact info edited.

## Data Architecture

### Layer 1: Live APIs (queried on app load, cached in browser)

All potential locations and resources are fetched once from public APIs when the app loads, then held in browser memory. No per-click API calls.

**APIs Used:**
- **Socrata SODA API** (data.seattle.gov) — hospitals, schools, food banks, building permits, public facilities. Supports spatial filtering. Free, no key.
- **ArcGIS REST API** (King County / Seattle GeoData) — parcels, zoning, tax-exempt properties. Free, no key.
- **Overpass API** (OpenStreetMap) — churches, community centers, grocery stores, laundromats, pharmacies. Free, no key.
- **GTFS** (King County Metro / Sound Transit) — bus stops, light rail stations. Static feed downloads. Free.

### Layer 2: Supabase (dynamic, user-contributed)

- User-added locations (PostGIS POINT geometry + metadata)
- Notes per location
- Photos per location (Supabase Storage)
- Contact info overrides

### Client-Side Spatial Analysis (Turf.js)

All spatial operations run in the browser:
- Buffer generation (400m, 1.2km circles around each location)
- Point-in-polygon (count resources within each buffer)
- Score calculation (weighted sum based on priority toggles)

## Tech Stack

| Component | Technology |
|:--|:--|
| Frontend | React |
| Map | Leaflet |
| Basemap tiles | OpenStreetMap / Carto / Stadia Maps (free) |
| Spatial analysis | Turf.js (client-side) |
| Database | Supabase Postgres + PostGIS |
| File storage | Supabase Storage |
| Auth | None in v1 (everyone has full access) |
| Hosting | GitHub Pages |

## UI Design Principles

- **Target users are not tech-savvy.** SHARE staff are the primary users.
- Everything important visible at a glance — no interaction required to see data
- No tabs, no multi-step wizards, no hidden states
- Icons + numbers + color as primary communication
- One map, one sidebar, one priority panel — that's the whole app
- Plain-English labels ("Great Location" not "Convenience Score: 82")

## What's NOT in Step 1

These are deferred to future steps:
- Authentication and role-based access (admin vs. viewer)
- User management
- Saved priority presets
- Data export (CSV, PDF report)
- Neighborhood filtering / search
- Mobile-optimized layout
- Notes/photos displayed in sidebar (stored but display is future work)

## Cost

$0/month — all free tiers:
- Supabase free (500 MB DB, 1 GB storage)
- GitHub Pages (free, no commercial restriction)
- All APIs (free, no keys)
- Leaflet + Turf.js (open-source)

Caveat: Supabase free tier auto-pauses after 7 days of inactivity. Mitigate with a GitHub Actions cron job to ping the project.
