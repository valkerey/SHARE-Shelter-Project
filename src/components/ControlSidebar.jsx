import { useState } from 'react';
import { Bike, Bus, Library, HeartPulse, ShoppingBasket, TreePine, Church, Building2, MapPin } from 'lucide-react';
import { RESOURCE_CATEGORIES } from '../config/constants';
import './ControlSidebar.css';

const LOCATION_TYPES = [
  { key: 'user', label: 'My Locations', Icon: MapPin },
];

export const RESOURCE_TOGGLES = [
  { key: 'bike',       label: 'Bike Infrastructure',    Icon: Bike,           color: '#FCA5A5', subcategories: [{ key: 'bike_locker', label: 'Bike Lockers' }, { key: 'bike_rack', label: 'Bike Racks' }] },
  { key: 'transit',    label: 'Transit',                Icon: Bus,            color: '#3B82F6', subcategories: [{ key: 'bus', label: 'Bus Stops' }, { key: 'rail', label: 'Link Stations' }] },
  { key: 'libraries',  label: 'Libraries',              Icon: Library,        color: '#A78BFA', subcategories: [{ key: 'library', label: 'Libraries' }] },
  { key: 'healthcare', label: 'Healthcare',             Icon: HeartPulse,     color: '#D95319', subcategories: [{ key: 'healthcare_facility', label: 'Healthcare Facilities' }] },
  { key: 'foodSocial', label: 'Food & Social Services', Icon: ShoppingBasket, color: '#FBBF24', subcategories: [{ key: 'food_bank', label: 'Food Banks' }, { key: 'community_center', label: 'Community Centers' }] },
  { key: 'parks',      label: 'Parks',                  Icon: TreePine,       color: '#34D399', subcategories: [] },
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
      {resourceToggles && onToggleResource && (
        <section className="cs-section">
          <h3 className="cs-section-title">Resource Layers</h3>
          {RESOURCE_TOGGLES.map(({ key, label, Icon, color, subcategories }) => (
            <div key={key}>
              <label className="cs-filter-row">
                <input
                  type="checkbox"
                  checked={resourceToggles[key] !== false}
                  onChange={() => onToggleResource(key)}
                />
                <span className="cs-icon"><Icon size={15} strokeWidth={2} color={color} /></span>
                <span className="cs-label">{label}</span>
              </label>
              {subcategories.length > 0 && (
                <div className="cs-subcategories">
                  {subcategories.map((sub) => (
                    <label key={sub.key} className="cs-sub-row">
                      <input
                        type="checkbox"
                        checked={resourceToggles[sub.key] !== false}
                        onChange={() => onToggleResource(sub.key)}
                      />
                      <span className="cs-sub-label">{sub.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Score Priorities section — temporarily hidden, restore by uncommenting below */}
      {/* <section className="cs-section">
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
      </section> */}
    </aside>
  );
}
