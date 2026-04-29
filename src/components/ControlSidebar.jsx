import { RESOURCE_CATEGORIES } from '../config/constants';
import './ControlSidebar.css';

const LOCATION_TYPES = [
  { key: 'church', label: 'Churches', icon: '⛪' },
  { key: 'community_center', label: 'Community Centers', icon: '🏛️' },
  { key: 'vacant_building', label: 'Vacant Buildings', icon: '🏚️' },
  { key: 'public_facility', label: 'Public Facilities', icon: '🏢' },
  { key: 'nonprofit', label: 'Nonprofits', icon: '🤝' },
  { key: 'user', label: 'My Locations', icon: '📍' },
];

const LEVELS = ['low', 'medium', 'high'];
const LEVEL_LABELS = { low: 'Low', medium: 'Med', high: 'High' };
const LEVEL_COLORS = { low: '#3b82f6', medium: '#fbbf24', high: '#34d399' };

export default function ControlSidebar({
  visibleTypes,
  onToggleType,
  priorities,
  onUpdatePriorities,
}) {
  function setPriority(category, level) {
    onUpdatePriorities({ ...priorities, [category]: level });
  }

  return (
    <aside className="control-sidebar glass-panel">
      <section className="cs-section">
        <h3 className="cs-section-title">Show on Map</h3>
        {LOCATION_TYPES.map(({ key, label, icon }) => (
          <label className="cs-filter-row" key={key}>
            <input
              type="checkbox"
              checked={visibleTypes[key] !== false}
              onChange={() => onToggleType(key)}
            />
            <span className="cs-icon">{icon}</span>
            <span className="cs-label">{label}</span>
          </label>
        ))}
      </section>

      <section className="cs-section">
        <h3 className="cs-section-title">Score Priorities</h3>
        {Object.entries(RESOURCE_CATEGORIES).map(([key, cat]) => (
          <div className="cs-priority-row" key={key}>
            <span className="cs-icon">{cat.icon}</span>
            <span className="cs-label">{cat.label}</span>
            <div className="cs-btn-group">
              {LEVELS.map((level) => {
                const active = priorities[key] === level;
                return (
                  <button
                    key={level}
                    className={`cs-btn${active ? ' active' : ''}`}
                    style={active ? { background: LEVEL_COLORS[level] } : undefined}
                    onClick={() => setPriority(key, level)}
                  >
                    {LEVEL_LABELS[level]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </aside>
  );
}
