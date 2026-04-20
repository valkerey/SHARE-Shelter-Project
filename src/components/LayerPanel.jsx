import { useState } from 'react';
import './LayerPanel.css';

const LOCATION_TYPES = [
  { key: 'church', label: 'Churches', icon: '⛪' },
  { key: 'community_center', label: 'Community Centers', icon: '🏛️' },
  { key: 'vacant_building', label: 'Vacant Buildings', icon: '🏚️' },
  { key: 'public_facility', label: 'Public Facilities', icon: '🏢' },
  { key: 'nonprofit', label: 'Nonprofits', icon: '🤝' },
  { key: 'user', label: 'My Locations', icon: '📍' },
];

export default function LayerPanel({ visibleTypes, onToggle }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="layer-open-btn" onClick={() => setOpen(true)}>
        🗂️ Layers
      </button>
    );
  }

  return (
    <div className="layer-panel">
      <div className="layer-title">Show on Map</div>
      {LOCATION_TYPES.map(({ key, label, icon }) => (
        <label className="layer-row" key={key}>
          <input
            type="checkbox"
            checked={visibleTypes[key] !== false}
            onChange={() => onToggle(key)}
          />
          <span className="layer-icon">{icon}</span>
          <span className="layer-label">{label}</span>
        </label>
      ))}
      <button className="layer-close-btn" onClick={() => setOpen(false)}>Done</button>
    </div>
  );
}
