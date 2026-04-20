import './LayerPanel.css';

const LOCATION_TYPES = [
  { key: 'church', label: 'Churches', icon: '⛪' },
  { key: 'community_center', label: 'Community Centers', icon: '🏛️' },
  { key: 'vacant_building', label: 'Vacant Buildings', icon: '🏚️' },
  { key: 'public_facility', label: 'Public Facilities', icon: '🏢' },
  { key: 'nonprofit', label: 'Nonprofits', icon: '🤝' },
  { key: 'user', label: 'My Locations', icon: '📍' },
];

export default function LayerPanel({ visibleTypes, onToggle, onClose }) {
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
      <button className="layer-close-btn" onClick={onClose}>Done</button>
    </div>
  );
}
