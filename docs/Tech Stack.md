# SHARE Web Map App — Tech Stack

**Last updated:** April 15, 2026

## Overview

This document outlines the technology choices for the SHARE shelter mapping web application. The stack is designed around a **zero-budget constraint** — all services must be free or have a sufficient free tier.

Two key changes from the original plan (static GeoJSON only):
1. **Supabase** for authentication, database, and file storage — required for role-based access and user-contributed content (shelter locations, notes, photos).
2. **Live open data APIs** for resource/amenity layers — keeps data fresh without manual re-exports, at zero cost.

## Tech Stack

| Component | Choice | Why |
|:--|:--|:--|
| **Mapping library** | Leaflet | Open-source, no usage limits, solid community |
| **Basemap tiles** | OpenStreetMap / Carto / Stadia Maps | All free tier, no API key hassles |
| **Frontend framework** | React | Component-based, avoids styling inconsistency issues from last year's team |
| **Hosting** | GitHub Pages (or Vercel free tier) | Free, deploys from GitHub, no maintenance. GitHub Pages has no commercial-use restriction (Vercel Hobby is non-commercial only) |
| **Live data** | SODA API / ArcGIS REST / GTFS / Overpass API | Potential locations + resources queried at runtime — always current |
| **Dynamic data** | Supabase Postgres + PostGIS | Admin-added shelter locations, notes, photos. PostGIS enables native geographic queries |
| **Auth** | Supabase Auth | Email/password login, role-based access via JWT custom claims + Row Level Security (RLS) |
| **File storage** | Supabase Storage | Shelter photographs per location, with bucket-level MIME type and size restrictions |
| **Client-side spatial ops** | Turf.js | Buffers, point-in-polygon resource counting, score calculation — all in browser |

## Architecture

```
+--------------------+     +-------------------------+
|   Supabase         |     |   Live Open Data APIs   |
|  - Postgres+PostGIS|     |  - Seattle SODA API     |
|  - Auth (RLS)      |     |  - King County ArcGIS   |
|  - Storage (photos)|     |  - KC Metro GTFS        |
+--------+-----------+     |  - OSM Overpass API     |
         |                 +------------+------------+
         |                              |
         v                              v
+------------------------------------------------------------------------+
|                    React Frontend (Leaflet + Turf.js)                   |
|                                                                        |
|  Dynamic layers:              Live layers:                             |
|  - Admin-added locations      - Churches (Overpass)                    |
|  - Notes per location         - Vacant buildings (SODA + permits)     |
|  - Photos per location        - Food banks (SODA)                     |
|  (from Supabase)              - Schools (SODA)                        |
|                               - Transit stops (GTFS)                  |
|  Client-side analysis:        - Hospitals (ArcGIS REST)               |
|  - Buffer generation          - Community centers (Overpass)           |
|  - Resource counting          - Grocery stores (Overpass)              |
|  - Score calculation          - Libraries (SODA)                      |
|  (Turf.js)                    - Building permits (SODA)               |
+------------------------------------------------------------------------+
|                Hosted on GitHub Pages / Vercel                          |
+------------------------------------------------------------------------+
```

## Data Strategy: Two-Layer Approach

All spatial analysis (buffers, resource counting, scoring) is done client-side with Turf.js. No desktop GIS or pre-computed static layers needed — all data comes from live APIs or Supabase.

### Layer 1: Live APIs (queried at runtime)

Resource and amenity data that benefits from always being current. Queried from the browser via free public APIs.

| Dataset | API Source | Endpoint Type | Cost |
|:--|:--|:--|:--|
| Hospitals | Seattle Open Data (SODA) | `data.seattle.gov/resource/<id>.geojson` | Free, no key |
| Schools / daycare | Seattle Open Data (SODA) | `data.seattle.gov/resource/<id>.geojson` | Free, no key |
| Food banks | Seattle Open Data (SODA) | `data.seattle.gov/resource/<id>.geojson` | Free, no key |
| Bus stops / transit routes | King County Metro GTFS | `metro.kingcounty.gov/GTFS/` | Free |
| Light rail / Sound Transit | Sound Transit GTFS | `soundtransit.org/.../google_transit.zip` | Free |
| Churches / places of worship | OpenStreetMap Overpass | `overpass-api.de/api/interpreter` | Free, no key |
| Community centers | OpenStreetMap Overpass | `overpass-api.de/api/interpreter` | Free, no key |
| Public facilities | King County / Seattle ArcGIS REST | `gisdata.kingcounty.gov/arcgis/rest/...` | Free |

**API Details:**

- **Socrata SODA API** (Seattle Open Data): Supports spatial filtering (`$where=within_circle(...)`) and returns GeoJSON directly. No API key required. Docs: [dev.socrata.com](https://dev.socrata.com/)
- **ArcGIS REST API** (King County / Seattle GeoData): Standard Esri feature service endpoints with spatial query support. Returns GeoJSON. No key required.
- **Overpass API** (OpenStreetMap): Query language for OSM data. Returns POIs like churches, community centers, etc. Free, no key, no ToS restrictions on caching. Docs: [wiki.openstreetmap.org/wiki/Overpass_API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- **GTFS** (King County Metro / Sound Transit): Static feeds for stops and routes. GTFS-RT available for real-time arrival data. Download at [metro.kingcounty.gov/GTFS/](https://metro.kingcounty.gov/GTFS/) and [soundtransit.org OTD](https://www.soundtransit.org/help-contacts/business-information/open-transit-data-otd/otd-downloads).

### Layer 2: Dynamic (Supabase)

User-contributed content managed through the app with role-based access.

| Dataset | Storage | Who Can Write |
|:--|:--|:--|
| Shelter locations (lat/lng + metadata) | Supabase Postgres (PostGIS POINT geometry) | Admin only |
| Notes per location | Supabase Postgres | Admin only |
| Photos per location | Supabase Storage (image bucket) | Admin only |

## Auth & Roles

| Role | Permissions |
|:--|:--|
| **Viewer** (unauthenticated or logged-in) | View all map layers, filter, search |
| **Admin** (authenticated + admin role) | Add/edit/delete shelter locations, add notes, upload photos |

Implemented via:
- Supabase Auth for login
- `user_roles` table mapping `user_id` to `app_role` (admin / viewer)
- Row Level Security (RLS) policies on all tables:
  - `SELECT` open to all
  - `INSERT / UPDATE / DELETE` restricted to admin role

## Why Not Apple Maps or Google Maps?

We evaluated Apple MapKit JS and Google Maps Places API as alternatives for basemap tiles and live resource data. Both were rejected:

| Concern | Apple MapKit JS | Google Maps Places API | Our Stack (Open Data) |
|:--|:--|:--|:--|
| **Cost** | $99/year (Apple Developer Program required) | Free tier exists but requires billing account (credit card) | $0, no keys or accounts needed |
| **Spatial analysis** | ToS prohibits caching/storing data | ToS prohibits caching/storing data | No restrictions — query freely, analyze client-side with Turf.js |
| **Churches / places of worship** | Not in POI categories | Supported | Supported (OSM Overpass) |
| **Food banks** | Not in POI categories | Supported | Supported (Seattle SODA) |
| **Data freshness** | Always current | Always current | Always current (live API queries) |
| **Zero-budget compliant** | No | Risky (overage charges possible) | Yes |

**Bottom line:** Open data APIs provide the same freshness benefit as Apple/Google, without the cost, ToS restrictions, or POI category gaps. All spatial analysis runs client-side with Turf.js — no desktop GIS needed.

## Cost Estimation

### Scenario A: All Free Tiers — $0/month

| Service | Free Tier Limit | Expected Usage | Fits? |
|:--|:--|:--|:--|
| Supabase (DB + Auth + Storage) | 500 MB database, 1 GB file storage, 50K MAU, 5 GB egress/mo | ~50 MB data, ~200 MB photos, <100 users | Yes |
| GitHub Pages / Vercel Hobby | Unlimited (Pages) / 100 GB transfer (Vercel) | Low traffic | Yes |
| OpenStreetMap / Carto tiles | Free (usage policy) | Low volume | Yes |
| Open Data APIs (SODA, ArcGIS REST, Overpass, GTFS) | Free, no key required | Low-moderate query volume | Yes |
| Turf.js / Leaflet | Open-source | N/A | Yes |

**Caveats:**
- Supabase free tier **auto-pauses after 7 days of inactivity**. Workaround: a cron job (GitHub Actions) can ping the project to keep it alive.
- Vercel Hobby plan is restricted to **non-commercial use only**. GitHub Pages has no such restriction.
- Overpass API has no hard rate limit but requests heavy use to be throttled. For a small app this is a non-issue.

### Scenario B: Full Production — $45/month ($540/year)

| Service | Plan | Cost |
|:--|:--|:--|
| Supabase Pro (no auto-pause, daily backups) | Pro | $25/month |
| Vercel Pro (commercial use allowed) | Pro | $20/month |
| Everything else | Free / open-source | $0 |

### Scenario C: Budget Production — $25/month ($300/year)

| Service | Plan | Cost |
|:--|:--|:--|
| Supabase Pro | Pro | $25/month |
| GitHub Pages | Free | $0 |
| Everything else | Free / open-source | $0 |

### Recommendation

- **Now through June 2026** (class deliverable): Scenario A ($0) — free tiers are sufficient for development and presentation.
- **Post-handoff to SHARE**: Scenario A or C depending on usage. If SHARE uses it regularly, $25/month for Supabase Pro (no auto-pause + backups) is the one upgrade worth making.

## Changes from Prior Year's Stack (Spring 2025)

| Aspect | Last Year | This Year | Reason |
|:--|:--|:--|:--|
| Map library | Mapbox GL JS | Leaflet | Mapbox has usage limits; Leaflet is fully free |
| Backend | Flask + Render.com | Supabase (BaaS) | No custom server to maintain; auth + DB + storage in one |
| Database | None (form submissions) | Supabase Postgres + PostGIS | Native spatial data, RLS for role-based access |
| Auth | None | Supabase Auth | Admin role needed for adding locations |
| Data freshness | Static only | Fully live (APIs + Supabase) | Two-layer approach — no stale data |
| Scope | City-wide Seattle | City-wide Seattle (west of Lake Washington) | Same city-wide coverage, but with richer data layers and scoring |
| Frontend | Plain HTML/CSS/JS | React | Component-based, consistent styling |

## References

- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)
- [Vercel Pricing](https://vercel.com/pricing)
- [Leaflet](https://leafletjs.com/)
- [Turf.js](https://turfjs.org/)
- [Seattle Open Data Portal](https://data.seattle.gov/)
- [Seattle GeoData (ArcGIS)](https://data-seattlecitygis.opendata.arcgis.com/)
- [King County GIS Open Data](https://gis-kingcounty.opendata.arcgis.com/)
- [King County Metro GTFS](https://metro.kingcounty.gov/GTFS/)
- [Sound Transit GTFS Downloads](https://www.soundtransit.org/help-contacts/business-information/open-transit-data-otd/otd-downloads)
- [Socrata SODA API Docs](https://dev.socrata.com/)
- [Overpass API (OSM)](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Apple MapKit JS](https://developer.apple.com/maps/web/) (evaluated, not used)
- [Google Maps Platform Pricing](https://developers.google.com/maps/billing-and-pricing/pricing) (evaluated, not used)
