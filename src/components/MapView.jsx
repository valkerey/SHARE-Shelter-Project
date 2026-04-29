import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Marker,
  Popup,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { SEATTLE_CENTER, SEATTLE_ZOOM, BUFFER_INNER_M, BUFFER_OUTER_M } from '../config/constants';
import 'leaflet/dist/leaflet.css';

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

function formatWalkTime(meters) {
  const min = Math.max(1, Math.round(meters / 80));
  return `${min} min walk`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function createEmojiIcon(emoji) {
  return L.divIcon({
    html: `<span style="font-size:18px">${emoji}</span>`,
    className: 'emoji-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapController({ selectedLocation }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLocation) {
      map.flyTo([selectedLocation.lat, selectedLocation.lng], 15, { duration: 0.8 });
    }
  }, [selectedLocation, map]);
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

export default function MapView({
  scoredLocations = [],
  onPinClick,
  selectedLocation,
  resources = [],
  onMapClick,
  addMode = false,
  addCoords = null,
}) {
  // Filter nearby resources within 1.2km of selected location
  const nearbyResources = selectedLocation
    ? resources.filter((r) => {
        const from = turf.point([selectedLocation.lng, selectedLocation.lat]);
        const to = turf.point([r.lng, r.lat]);
        const dist = turf.distance(from, to, { units: 'meters' });
        return dist <= BUFFER_OUTER_M;
      })
    : [];

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

      <MapController selectedLocation={selectedLocation} />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} addMode={addMode} />}

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
                {formatDistance(dist)} away · {formatWalkTime(dist)}
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
    </MapContainer>
  );
}
