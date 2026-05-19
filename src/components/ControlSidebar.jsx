import { useState } from 'react';
import { RESOURCE_CATEGORIES } from '../config/constants';
import './ControlSidebar.css';

const LOCATION_TYPES = [
  { key: 'church', label: 'Churches', icon: '⛪' },
  { key: 'vacant_building', label: 'Vacant Buildings', icon: '🏚️' },
  { key: 'user', label: 'My Locations', icon: '📍' },
];

export const RESOURCE_TOGGLES = [
  { key: 'bike',       label: 'Bike Infrastructure',    icon: '🚲' },
  { key: 'transit',    label: 'Transit',                icon: '🚌' },
  { key: 'libraries',  label: 'Libraries',              icon: '📚' },
  { key: 'healthcare', label: 'Healthcare',             icon: '🏥' },
  { key: 'foodSocial', label: 'Food & Social Services', icon: '🍎' },
  { key: 'parks',      label: 'Parks',                  icon: '🌳' },
];

const LEVELS = ['low', 'medium', 'high'];
const LEVEL_LABELS = { low: 'Low', medium: 'Med', high: 'High' };
const LEVEL_COLORS = { low: '#3b82f6', medium: '#fbbf24', high: '#34d399' };

export default function ControlSidebar({
  visibleTypes,
  onToggleType,
  priorities,
  onUpdatePriorities,
  resourceToggles,
  onToggleResource,
  collapsed,
  onSetCollapsed,
  showHint = false,
}) {
  const [prioritiesOpen, setPrioritiesOpen] = useState(true);
  const [resourcesOpen, setResourcesOpen] = useState(true);

  if (collapsed) {
    return (
      <button
        className={`cs-expand-btn glass-panel${showHint ? ' cs-expand-hint' : ''}`}
        onClick={() => onSetCollapsed(false)}
        title="Show controls"
      >
        ▶
        {showHint && <span className="cs-hint-label">Controls</span>}
      </button>
    );
  }

  function setPriority(category, level) {
    onUpdatePriorities({ ...priorities, [category]: level });
  }

  return (
    <aside className="control-sidebar glass-panel">
      <button
        className="cs-collapse-btn"
        onClick={() => onSetCollapsed(true)}
        title="Hide controls"
      >
        ◀
      </button>
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

      {resourceToggles && onToggleResource && (
        <section className="cs-section">
          <button
            type="button"
            className="cs-section-title cs-section-toggle"
            aria-expanded={resourcesOpen}
            onClick={() => setResourcesOpen((open) => !open)}
          >
            <span>Resource Layers</span>
            <span className={`cs-chevron${resourcesOpen ? ' open' : ''}`} aria-hidden="true">▸</span>
          </button>
          {resourcesOpen && RESOURCE_TOGGLES.map(({ key, label, icon }) => (
            <label className="cs-filter-row" key={key}>
              <input
                type="checkbox"
                checked={resourceToggles[key] !== false}
                onChange={() => onToggleResource(key)}
              />
              <span className="cs-icon">{icon}</span>
              <span className="cs-label">{label}</span>
            </label>
          ))}
        </section>
      )}

      <section className="cs-section">
        <button
          type="button"
          className="cs-section-title cs-section-toggle"
          aria-expanded={prioritiesOpen}
          onClick={() => setPrioritiesOpen((open) => !open)}
        >
          <span>Score Priorities</span>
          <span className={`cs-chevron${prioritiesOpen ? ' open' : ''}`} aria-hidden="true">
            ▸
          </span>
        </button>
        {prioritiesOpen &&
          Object.entries(RESOURCE_CATEGORIES).map(([key, cat]) => (
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
