import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { SEATTLE_CENTER, SEATTLE_ZOOM } from '../config/constants';
import 'leaflet/dist/leaflet.css';

export default function MapView({ scoredLocations = [], onPinClick }) {
  return (
    <MapContainer
      center={SEATTLE_CENTER}
      zoom={SEATTLE_ZOOM}
      className="map-container"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {scoredLocations.map((loc) => (
        <CircleMarker
          key={loc.id}
          center={[loc.lat, loc.lng]}
          radius={8}
          fillColor={loc.color}
          fillOpacity={0.8}
          color="#fff"
          weight={2}
          eventHandlers={{
            click: () => onPinClick && onPinClick(loc),
          }}
        >
          <Tooltip>{loc.name} — {loc.score}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
