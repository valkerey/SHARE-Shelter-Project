import { useEffect, useState, useRef, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  GeoJSON,
  Marker,
  Popup,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import {
  Bus, TrainFront, Library, HeartPulse, Scale, HandHeart,
  ShoppingBasket, Landmark, Bike, TreePine, House,
} from 'lucide-react';
import { SEATTLE_CENTER, SEATTLE_ZOOM, BUFFER_INNER_M, BUFFER_OUTER_M } from '../config/constants';
import 'leaflet/dist/leaflet.css';

// ── Local resource icon helpers ──────────────────────────────────────────────

function lucideCircle(LucideComponent, bg, iconSize = 13, circleSize = 26) {
  const svg = renderToStaticMarkup(
    <LucideComponent size={iconSize} color="white" strokeWidth={2.5} />
  );
  const half = circleSize / 2;
  const html = `<div style="background:${bg};border-radius:50%;width:${circleSize}px;height:${circleSize}px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.28);border:2px solid rgba(255,255,255,0.85)">${svg}</div>`;
  return L.divIcon({ html, className: '', iconSize: [circleSize, circleSize], iconAnchor: [half, half] });
}


function lucideSquare(LucideComponent, bg, iconSize = 10) {
  const svg = renderToStaticMarkup(
    <LucideComponent size={iconSize} color="white" strokeWidth={2.5} />
  );
  const html = `<div style="background:${bg};border-radius:4px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.28);border:2px solid rgba(255,255,255,0.85)">${svg}</div>`;
  return L.divIcon({ html, className: '', iconSize: [18, 18], iconAnchor: [9, 9] });
}

const DOT_ICON = L.divIcon({
  html: '<div style="background:#3B82F6;border-radius:50%;width:8px;height:8px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>',
  className: '',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

const BIKE_RACK_DOT = L.divIcon({
  html: '<div style="background:#FCA5A5;border-radius:50%;width:8px;height:8px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>',
  className: '',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

// Created once at module level so Leaflet doesn't rebuild on every render
const ICONS = {
  transit_rail:    lucideCircle(TrainFront,    '#3B82F6', 13, 24),
  hc_clinic:       lucideCircle(HeartPulse,    '#D95319', 13, 24),
  hc_courts:       lucideCircle(Scale,         '#D95319', 13, 24),
  hc_social:       lucideCircle(HandHeart,     '#D95319', 13, 24),
  foodBank:        lucideCircle(ShoppingBasket,'#FBBF24', 13, 24),
  communityCenter: lucideCircle(Landmark,      '#FBBF24', 13, 24),
  libraries:       lucideCircle(Library,       '#A78BFA', 13, 24),
  bikeLocker:      lucideSquare(Bike,          '#FCA5A5', 10),
  parks:           lucideCircle(TreePine,      '#34D399', 13, 24),
};

const STATUS_BORDER = {
  'unreviewed':  null,
  'in-progress': '#F59E0B',
  'promising':   '#22C55E',
  'not-viable':  '#EF4444',
};

function hostSiteIcon(color, isSelected, status = 'unreviewed') {
  const size        = isSelected ? 22 : 16;
  const bg          = isSelected ? '#f59e0b' : color;
  const borderColor = isSelected ? 'rgba(0,0,0,0.55)' : (STATUS_BORDER[status] || 'rgba(255,255,255,0.85)');
  const borderWidth = (!isSelected && STATUS_BORDER[status]) ? '2.5px' : (isSelected ? '2.5px' : '1.5px');
  const star        = status === 'unreviewed' ? '<span style="color:rgba(255,255,255,0.88);font-size:8px;line-height:1;display:block">★</span>' : '';
  const html        = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${borderWidth} solid ${borderColor};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 5px rgba(0,0,0,0.32)">${star}</div>`;
  const half        = size / 2;
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [half, half] });
}

function healthcareIcon(pt) {
  const cat = pt.SiteCategory || '';
  if (cat === 'Clinics and Health Care Settings' || cat.includes('Public Health')) return ICONS.hc_clinic;
  if (cat === 'Courts and Criminal Justice Facilities') return ICONS.hc_courts;
  return ICONS.hc_social;
}

function healthcareColor() { return '#D95319'; }

function getMarkerIcon(pt) {
  if (pt._type === 'transit') {
    return pt._subtype === 'rail' ? ICONS.transit_rail : DOT_ICON;
  }
  if (pt._type === 'bike') {
    return pt.BICYCLE_STORAGE_TYPE ? ICONS.bikeLocker : BIKE_RACK_DOT;
  }
  if (pt._type === 'libraries')  return ICONS.libraries;
  if (pt._type === 'healthcare') return healthcareIcon(pt);
  if (pt._type === 'foodSocial') {
    return (pt.Food_Resource_Type || pt.Agency) ? ICONS.foodBank : ICONS.communityCenter;
  }
  if (pt._type === 'parks') return ICONS.parks;
  return DOT_ICON;
}

function getPopupIcon(pt) {
  const p = { size: 14, strokeWidth: 2.5 };
  if (pt._type === 'transit')    return pt._subtype === 'rail' ? <TrainFront {...p} color="#3B82F6" /> : <Bus {...p} color="#3B82F6" />;
  if (pt._type === 'libraries')  return <Library {...p} color="#A78BFA" />;
  if (pt._type === 'healthcare') {
    const c = '#D95319';
    const cat = pt.SiteCategory || '';
    if (cat === 'Clinics and Health Care Settings' || cat.includes('Public Health')) return <HeartPulse {...p} color={c} />;
    if (cat === 'Courts and Criminal Justice Facilities') return <Scale {...p} color={c} />;
    return <HandHeart {...p} color={c} />;
  }
  if (pt._type === 'foodSocial') return (pt.Food_Resource_Type || pt.Agency) ? <ShoppingBasket {...p} color="#FBBF24" /> : <Landmark {...p} color="#FBBF24" />;
  if (pt._type === 'bike')       return <Bike      {...p} color="#FCA5A5" />;
  if (pt._type === 'parks')      return <TreePine  {...p} color="#34D399" />;
  return null;
}

const QUARTER_MILE_M = 402;
const HALF_MILE_M = 804;

function getResourceInfo(pt) {
  switch (pt._type) {
    case 'bike': {
      const isBikeLocker = !!pt.BICYCLE_STORAGE_TYPE;
      const typeLabel = isBikeLocker ? (pt.BICYCLE_STORAGE_TYPE || 'Bike Locker') : 'Bike Rack';
      const name = isBikeLocker ? (pt.NAME || pt.FACILITY_NAME || typeLabel) : 'Bike Rack';
      const address = pt.ADDRESS || pt.UNITDESC || '';
      return { typeLabel, name, address };
    }
    case 'transit': {
      if (pt._subtype === 'rail') {
        return {
          typeLabel: 'Link Light Rail',
          name: pt.NAME || pt.STATION || 'Rail Station',
          address: '',
        };
      }
      const street = [pt.ON_STREET_NAME, pt.HASTUS_CROSS_STREET_NAME].filter(Boolean).join(' & ');
      return {
        typeLabel: 'Bus Stop',
        name: street || 'Bus Stop',
        address: pt.ROUTE_LIST != null && String(pt.ROUTE_LIST).trim()
          ? `Route(s): ${pt.ROUTE_LIST}`
          : '',
      };
    }
    case 'libraries':
      return {
        typeLabel: 'Library',
        name: (pt.LABEL || '').trim() || (pt.NAME || '').trim() || 'Library',
        address: pt.ADDRESS || '',
      };
    case 'healthcare':
      return {
        typeLabel: pt.SiteCategory || 'Healthcare',
        name: pt.Site || pt.NAME || 'Healthcare Facility',
        address: pt.Address || pt.ADDRESS || '',
      };
    case 'foodSocial': {
      const isFoodBank = !!pt.Food_Resource_Type || !!pt.Agency;
      if (isFoodBank) {
        return {
          typeLabel: pt.Food_Resource_Type || 'Food Bank',
          name: pt.Location || pt.Agency || 'Food Resource',
          address: pt.Address || pt.ADDRESS || '',
        };
      }
      return {
        typeLabel: 'Community Center',
        name: pt.NAME || 'Community Center',
        address: pt.ADDRESS || '',
      };
    }
    case 'parks':
      return {
        typeLabel: 'Park',
        name: pt.NAME || 'Park',
        address: '',
      };
    default:
      return {
        typeLabel: pt._type || 'Resource',
        name: pt.NAME || pt.name || 'Unknown',
        address: pt.ADDRESS || pt.address || '',
      };
  }
}

function HomeButton() {
  const map = useMap();
  return (
    <button
      onClick={() => map.flyTo(SEATTLE_CENTER, SEATTLE_ZOOM, { duration: 0.8 })}
      title="Reset view"
      style={{
        position: 'absolute',
        bottom: 90,
        right: 10,
        zIndex: 1000,
        width: 34,
        height: 34,
        background: 'white',
        border: '2px solid rgba(0,0,0,0.2)',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 5px rgba(0,0,0,0.15)',
      }}
    >
      <House size={16} strokeWidth={2} color="#333" />
    </button>
  );
}

function getActiveLocalResources(localData, resourceToggles) {
  const groups = ['bikeInfra', 'transit', 'libraries', 'healthcare', 'foodSocial'];
  const toggleMap = { bikeInfra: 'bike', transit: 'transit', libraries: 'libraries',
    healthcare: 'healthcare', foodSocial: 'foodSocial' };
  return groups
    .filter((g) => resourceToggles[toggleMap[g]] !== false)
    .flatMap((g) => localData[g] || []);
}

const RESOURCE_ICONS = {
  bus_stop: '\u{1F68C}',
  light_rail: '\u{1F687}',
  food_bank: '\u{1F34E}',
  grocery: '\u{1F6D2}',
  school: '\u{1F3EB}',
  hospital: '\u{1F3E5}',
  library: '\u{1F4DA}',
  community_center: '\u{1F3DB}\uFE0F',
  laundromat: '\u{1F455}',
  pharmacy: '\u{1F48A}',
};

const RESOURCE_LABELS = {
  bus_stop: 'Bus Stop',
  light_rail: 'Light Rail Station',
  food_bank: 'Food Bank',
  grocery: 'Grocery Store',
  school: 'School',
  hospital: 'Hospital',
  library: 'Library',
  community_center: 'Community Center',
  laundromat: 'Laundromat',
  pharmacy: 'Pharmacy',
};

const SOURCE_LABELS = {
  osm: 'OpenStreetMap',
  arcgis: 'ArcGIS',
  arcgis_kingcounty: 'King County GIS',
  seattle_open_data: 'Seattle Open Data',
};

function formatDistance(meters) {
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.28084);
    return `${feet} ft`;
  }
  return `${miles.toFixed(2)} mi`;
}

function createEmojiIcon(emoji) {
  return L.divIcon({
    html: `<span style="font-size:18px">${emoji}</span>`,
    className: 'emoji-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapController({ selectedLocation, addCoords }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLocation) {
      map.flyTo([selectedLocation.lat, selectedLocation.lng], 15, { duration: 0.8 });
    }
  }, [selectedLocation, map]);
  useEffect(() => {
    if (addCoords) {
      map.flyTo([addCoords.lat, addCoords.lng], 17, { duration: 0.8 });
    }
  }, [addCoords, map]);
  return null;
}

function HostSiteController({ selectedHostSite }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedHostSite) return;
    const circle = turf.circle(
      [selectedHostSite.lng, selectedHostSite.lat],
      HALF_MILE_M / 1000,
      { units: 'kilometers' },
    );
    const bbox = turf.bbox(circle);
    const bounds = [[bbox[1], bbox[0]], [bbox[3], bbox[2]]];
    // Delay until sidebar collapse transition finishes (~300ms), then fly smoothly
    const t = setTimeout(() => {
      map.flyToBounds(bounds, {
        paddingTopLeft: [20, 20],
        paddingBottomRight: [380, 80],
        duration: 1.2,
        easeLinearity: 0.1,
      });
    }, 320);
    return () => clearTimeout(t);
  }, [selectedHostSite, map]);
  return null;
}

function ZoomTracker({ onTierChange }) {
  const lastTier = useRef(null);
  useMapEvents({
    zoomend(e) {
      const tier = zoomToTier(e.target.getZoom());
      if (tier !== lastTier.current) {
        lastTier.current = tier;
        onTierChange(tier);
      }
    },
  });
  return null;
}

function MapClickHandler({ onMapClick, addMode }) {
  useMapEvents({
    click(e) {
      if (addMode) {
        onMapClick(e.latlng);
      } else {
        onMapClick(null);
      }
    },
  });
  return null;
}

const VACANT_TYPE_COLORS = {
  'residential': '#3B82F6',
  'commercial':  '#F59E0B',
  'mixed use':   '#8B5CF6',
};

// Single canvas renderer shared across all dot markers — avoids thousands of SVG nodes
const canvasRenderer = L.canvas({ padding: 0.5 });

function zoomToTier(zoom) {
  if (zoom >= 15) return 'high';
  if (zoom >= 14) return 'mid';
  return 'low';
}

function filterByTier(resources, tier) {
  if (tier === 'high') return resources;
  if (tier === 'mid') {
    return resources.filter(r =>
      !(r._type === 'bike' && !r.BICYCLE_STORAGE_TYPE) &&
      !(r._type === 'transit' && r._subtype !== 'rail')
    );
  }
  return resources.filter(r =>
    r._type === 'libraries' || r._type === 'healthcare' || r._type === 'foodSocial'
  );
}

export default function MapView({
  scoredLocations = [],
  onPinClick,
  selectedLocation,
  resources = [],
  onMapClick,
  addMode = false,
  addCoords = null,
  activeLayer = null,
  localData = {},
  resourceToggles = {},
  selectedHostSite = null,
  onHostSiteClick = null,
  hostSiteNearby = null,
  showUnreviewedOnly = false,
  siteStatusVersion = 0,
}) {
  // Filter nearby resources within 1.2km of selected location (existing shelter scoring layer)
  const nearbyResources = selectedLocation
    ? resources.filter((r) => {
        const from = turf.point([selectedLocation.lng, selectedLocation.lat]);
        const to = turf.point([r.lng, r.lat]);
        const dist = turf.distance(from, to, { units: 'meters' });
        return dist <= BUFFER_OUTER_M;
      })
    : [];

  const [zoomTier, setZoomTier] = useState(zoomToTier(SEATTLE_ZOOM));

  // Only recompute when toggles or zoom tier changes — not on every zoom frame
  const activeLocalResources = useMemo(
    () => filterByTier(getActiveLocalResources(localData, resourceToggles), zoomTier),
    [localData, resourceToggles, zoomTier],
  );

  // Parks that intersect the half-mile buffer around selected host site
  const nearbyParksGeoJSON = selectedHostSite && localData.parksGeoJSON
    ? (() => {
        const buffer = turf.circle(
          [selectedHostSite.lng, selectedHostSite.lat],
          HALF_MILE_M / 1000,
          { units: 'kilometers' },
        );
        return {
          type: 'FeatureCollection',
          features: (localData.parksGeoJSON.features || []).filter((f) => {
            try { return turf.booleanIntersects(f, buffer); } catch { return false; }
          }),
        };
      })()
    : null;

  return (
    <MapContainer
      center={SEATTLE_CENTER}
      zoom={SEATTLE_ZOOM}
      className="map-container"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <ZoomControl position="bottomright" />
      <HomeButton />

      <MapController selectedLocation={selectedLocation} addCoords={addCoords} />
      <HostSiteController selectedHostSite={selectedHostSite} />
      <ZoomTracker onTierChange={setZoomTier} />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} addMode={addMode} />}

      {/* ── Park polygons — always visible on all layers ── */}
      {localData.parksGeoJSON && resourceToggles.parks !== false && (() => {
        const iconSvg = renderToStaticMarkup(<TreePine size={14} color="#34D399" strokeWidth={2.5} />);
        return (
          <GeoJSON
            key="parks-base"
            data={localData.parksGeoJSON}
            style={{ fillColor: '#34D399', fillOpacity: 0.2, color: '#34D399', weight: 0 }}
            onEachFeature={(feature, layer) => {
              const name = feature.properties?.NAME || 'Park';
              layer.bindPopup(`
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
                  ${iconSvg}
                  <span style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px">Park</span>
                </div>
                <div style="font-weight:600;font-size:14px">${name}</div>
                <div style="font-size:12px;color:#555;margin-top:2px">Seattle Parks & Recreation</div>
              `);
            }}
          />
        );
      })()}

      {/* Highlighted parks within ½ mi of selected host site */}
      {nearbyParksGeoJSON && nearbyParksGeoJSON.features.length > 0 && resourceToggles.parks !== false && (() => {
        const iconSvg = renderToStaticMarkup(<TreePine size={14} color="#34D399" strokeWidth={2.5} />);
        return (
          <GeoJSON
            key={`parks-hl-${selectedHostSite?._id}`}
            data={nearbyParksGeoJSON}
            style={{ fillColor: '#34D399', fillOpacity: 0.55, color: '#34D399', weight: 0.5 }}
            onEachFeature={(feature, layer) => {
              const name = feature.properties?.NAME || 'Park';
              layer.bindPopup(`
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
                  ${iconSvg}
                  <span style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px">Park</span>
                </div>
                <div style="font-weight:600;font-size:14px">${name}</div>
                <div style="font-size:12px;color:#555;margin-top:2px">Seattle Parks & Recreation</div>
                <div style="font-size:11px;color:#059669;font-weight:600;margin-top:4px">Within ½ mile</div>
              `);
            }}
          />
        );
      })()}

      {/* Buffer circles when a location is selected */}
      {selectedLocation && (
        <>
          <Circle
            center={[selectedLocation.lat, selectedLocation.lng]}
            radius={BUFFER_OUTER_M}
            pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '6 4', fillOpacity: 0.05 }}
          />
          <Circle
            center={[selectedLocation.lat, selectedLocation.lng]}
            radius={BUFFER_INNER_M}
            pathOptions={{ color: '#22c55e', weight: 2, fillOpacity: 0.08 }}
          />
        </>
      )}

      {/* Scored location pins */}
      {scoredLocations.map((loc) => {
        const isSelected = selectedLocation && selectedLocation.id === loc.id;
        const isPending = loc.status === 'pending';
        return (
          <CircleMarker
            key={loc.id}
            center={[loc.lat, loc.lng]}
            radius={8}
            fillColor={loc.color}
            fillOpacity={isPending ? 0.35 : isSelected ? 1 : 0.8}
            color={isSelected ? '#000' : '#fff'}
            weight={isSelected ? 3 : 2}
            dashArray={isPending ? '4 3' : null}
            bubblingMouseEvents={false}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (onPinClick) onPinClick(loc);
              },
            }}
          >
            <Tooltip>
              {loc.name} — {loc.score}
              {isPending ? ' (pending)' : ''}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Nearby resource markers */}
      {nearbyResources.map((r, i) => {
        const emoji = RESOURCE_ICONS[r.resourceType] || '\u{1F4CD}';
        const typeLabel = RESOURCE_LABELS[r.resourceType] || r.resourceType;
        const displayName = r.name || `Unnamed ${typeLabel}`;
        const sourceLabel = SOURCE_LABELS[r.source] || r.source;
        const dist = turf.distance(
          turf.point([selectedLocation.lng, selectedLocation.lat]),
          turf.point([r.lng, r.lat]),
          { units: 'meters' },
        );
        const websiteHref =
          r.contact?.website && /^https?:\/\//.test(r.contact.website)
            ? r.contact.website
            : r.contact?.website
              ? `https://${r.contact.website}`
              : null;
        const gmapsQuery = r.name
          ? `${r.name} ${r.lat},${r.lng}`
          : `${r.lat},${r.lng}`;
        const gmapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gmapsQuery)}`;
        return (
          <Marker
            key={`resource-${r.resourceType}-${i}`}
            position={[r.lat, r.lng]}
            icon={createEmojiIcon(emoji)}
          >
            <Popup className="resource-popup" maxWidth={260} minWidth={220}>
              <div className="resource-popup-header">
                <span className="resource-popup-emoji">{emoji}</span>
                <span className="resource-popup-type">{typeLabel}</span>
              </div>
              <div className="resource-popup-name">{displayName}</div>
              {r.address && <div className="resource-popup-row">{r.address}</div>}
              <div className="resource-popup-distance">
                {formatDistance(dist)} away
              </div>
              <div className="resource-popup-contact">
                {r.contact?.phone && (
                  <a href={`tel:${r.contact.phone}`}>{r.contact.phone}</a>
                )}
                {websiteHref && (
                  <a href={websiteHref} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                )}
                {r.contact?.email && (
                  <a href={`mailto:${r.contact.email}`}>{r.contact.email}</a>
                )}
                <a href={gmapsHref} target="_blank" rel="noopener noreferrer">
                  Open in Google Maps
                </a>
              </div>
              {sourceLabel && (
                <div className="resource-popup-source">Source: {sourceLabel}</div>
              )}
            </Popup>
          </Marker>
        );
      })}

      {/* Temporary marker when adding a new location */}
      {addCoords && (
        <Marker position={[addCoords.lat, addCoords.lng]}>
          <Tooltip permanent>New location — fill in the form →</Tooltip>
        </Marker>
      )}

      {/* ── Layer 1: All Seattle resources ── */}
      {activeLayer === 'resources' && (() => {
        const isDot = (pt) =>
          (pt._type === 'transit' && pt._subtype !== 'rail') ||
          (pt._type === 'bike' && !pt.BICYCLE_STORAGE_TYPE);

        const popupContent = (pt) => {
          const { typeLabel, name, address } = getResourceInfo(pt);
          const popupIcon = getPopupIcon(pt);
          const mapsHref = address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ', Seattle, WA')}`
            : null;
          return (
            <Popup maxWidth={240}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                {popupIcon}
                <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{typeLabel}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{name}</div>
              {address && (
                mapsHref
                  ? <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#3B82F6', textDecoration: 'none' }}>{address}</a>
                  : <div style={{ fontSize: 12, color: '#555' }}>{address}</div>
              )}
            </Popup>
          );
        };

        const dots  = activeLocalResources.filter(isDot);
        const icons = activeLocalResources.filter(pt => !isDot(pt));

        return (
          <>
            {/* High-density dots on canvas — no clustering needed */}
            {dots.map((pt, i) => {
              const isBusStop = pt._type === 'transit';
              const dotColor  = isBusStop ? '#3B82F6' : '#FCA5A5';
              return (
                <CircleMarker
                  key={`dot-${pt._type}-${i}`}
                  center={[pt.lat, pt.lng]}
                  radius={4}
                  renderer={canvasRenderer}
                  pathOptions={{ fillColor: dotColor, fillOpacity: 0.85, color: 'white', weight: 1 }}
                >
                  {popupContent(pt)}
                </CircleMarker>
              );
            })}

            {/* Icon markers */}
            {icons.map((pt, i) => (
              <Marker key={`icon-${pt._type}-${i}`} position={[pt.lat, pt.lng]} icon={getMarkerIcon(pt)}>
                {popupContent(pt)}
              </Marker>
            ))}
          </>
        );
      })()}

      {/* ── Layer 2: Viable Vacant Buildings ── */}
      {activeLayer === 'vacant' && (localData.vacantBuildings || []).map((bld, i) => {
        const id = `vacant-${i}`;
        const isSelected = selectedHostSite && selectedHostSite._id === id;
        const typeColor = VACANT_TYPE_COLORS[(bld.Building_Type || '').trim().toLowerCase()] || '#6366f1';
        const status = localStorage.getItem(`host-status-${id}`) || 'unreviewed';
        if (showUnreviewedOnly && status !== 'unreviewed') return null;
        return (
          <Marker
            key={id}
            position={[bld.lat, bld.lng]}
            icon={hostSiteIcon(typeColor, isSelected, status)}
            bubblingMouseEvents={false}
            eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); onHostSiteClick && onHostSiteClick({ ...bld, _id: id }); } }}
          >
            <Tooltip>{bld.Address || 'Vacant Building'} {bld.Building_Type ? `(${bld.Building_Type})` : ''}</Tooltip>
          </Marker>
        );
      })}

      {/* ── Layer 3: Churches ── */}
      {activeLayer === 'churches' && (localData.churches || []).map((ch, i) => {
        const id = `church-${i}`;
        const isSelected = selectedHostSite && selectedHostSite._id === id;
        const name = ch.PROP_NAME || ch.name || ch.NAME || 'Church';
        const status = localStorage.getItem(`host-status-${id}`) || 'unreviewed';
        if (showUnreviewedOnly && status !== 'unreviewed') return null;
        return (
          <Marker
            key={id}
            position={[ch.lat, ch.lng]}
            icon={hostSiteIcon('#8B5CF6', isSelected, status)}
            eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); onHostSiteClick && onHostSiteClick({ ...ch, _id: id }); } }}
          >
            <Tooltip>{name}</Tooltip>
          </Marker>
        );
      })}

      {/* ── Buffer circles + nearby resources for layers 2 & 3 ── */}
      {selectedHostSite && hostSiteNearby && (
        <>
          <Circle
            center={[selectedHostSite.lat, selectedHostSite.lng]}
            radius={HALF_MILE_M}
            interactive={false}
            pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '6 4', fillOpacity: 0.05 }}
          />
          <Circle
            center={[selectedHostSite.lat, selectedHostSite.lng]}
            radius={QUARTER_MILE_M}
            interactive={false}
            pathOptions={{ color: '#22c55e', weight: 2, fillOpacity: 0.08 }}
          />
          {hostSiteNearby.quarter.map((r, i) => {
            const { typeLabel, name, address } = getResourceInfo(r);
            const popupIcon = getPopupIcon(r);
            return (
              <Marker key={`hs-q-${i}`} position={[r.lat, r.lng]} icon={getMarkerIcon(r)}>
                <Popup maxWidth={220}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    {popupIcon}
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{typeLabel}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{name}</div>
                  {address && ['libraries', 'healthcare', 'foodSocial'].includes(r._type)
                    ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ', Seattle, WA')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#3B82F6', textDecoration: 'none', display: 'block', marginBottom: 3 }}>{address}</a>
                    : address && <div style={{ fontSize: 12, color: '#555', marginBottom: 3 }}>{address}</div>}
                  <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Within ¼ mile</div>
                </Popup>
              </Marker>
            );
          })}
          {hostSiteNearby.half.map((r, i) => {
            const { typeLabel, name, address } = getResourceInfo(r);
            const popupIcon = getPopupIcon(r);
            return (
              <Marker key={`hs-h-${i}`} position={[r.lat, r.lng]} icon={getMarkerIcon(r)}>
                <Popup maxWidth={220}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    {popupIcon}
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{typeLabel}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{name}</div>
                  {address && ['libraries', 'healthcare', 'foodSocial'].includes(r._type)
                    ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ', Seattle, WA')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#3B82F6', textDecoration: 'none', display: 'block', marginBottom: 3 }}>{address}</a>
                    : address && <div style={{ fontSize: 12, color: '#555', marginBottom: 3 }}>{address}</div>}
                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Within ½ mile</div>
                </Popup>
              </Marker>
            );
          })}
        </>
      )}
    </MapContainer>
  );
}
