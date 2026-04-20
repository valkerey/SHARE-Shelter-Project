import { RESOURCE_CATEGORIES } from '../config/constants';
import './Sidebar.css';

/**
 * Capitalize a string and replace underscores with spaces.
 * e.g. "food_bank" -> "Food Bank"
 */
function formatName(str) {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Sidebar({ location, onClose, onEdit, onDelete }) {
  if (!location) return null;

  const {
    name,
    address,
    type,
    contact,
    score,
    label,
    color,
    innerCounts,
    outerCounts,
  } = location;

  return (
    <div className="sidebar">
      {/* Close button */}
      <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
        &times;
      </button>

      {/* Header: name, address, contact */}
      <div className="sidebar-header">
        <div className="sidebar-name">{name}</div>
        {address && <div className="sidebar-address">{address}</div>}
        {contact && (
          <div className="sidebar-contact">
            {contact.phone && <div>{contact.phone}</div>}
            {contact.website && (
              <div>
                <a href={contact.website} target="_blank" rel="noopener noreferrer">
                  {contact.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {contact.email && (
              <div>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Score badge */}
      <div className="sidebar-score">
        <div className="score-circle" style={{ background: color }}>
          {score}
        </div>
        <div className="score-info">
          <span className="score-label" style={{ color }}>
            {label}
          </span>
          <span className="score-subtext">Based on nearby resources</span>
        </div>
      </div>

      {/* Resource list */}
      <div className="sidebar-resources-title">Nearby Resources</div>
      {Object.entries(RESOURCE_CATEGORIES).map(([catKey, cat]) => {
        // Sum inner and outer counts across all resource types in this category
        const innerTotal = cat.resources.reduce(
          (sum, r) => sum + ((innerCounts && innerCounts[r]) || 0),
          0
        );
        const outerTotal = cat.resources.reduce(
          (sum, r) => sum + ((outerCounts && outerCounts[r]) || 0),
          0
        );

        // Color-code: green if inner > 0, yellow if outer > 0 but inner == 0, red if both 0
        let countClass = 'count-red';
        if (innerTotal > 0) {
          countClass = 'count-green';
        } else if (outerTotal > 0) {
          countClass = 'count-yellow';
        }

        return (
          <div className="resource-row" key={catKey}>
            <span className="resource-icon">{cat.icon}</span>
            <span className="resource-name">{cat.label}</span>
            <span className={`resource-count ${countClass}`}>
              <span className="inner-count">{innerTotal}</span>
              <span className="outer-count"> / {outerTotal}</span>
            </span>
          </div>
        );
      })}

      {/* Legend */}
      <div className="sidebar-legend">
        <div className="legend-item">
          <span className="legend-dot green"></span>
          5 min walk
        </div>
        <div className="legend-item">
          <span className="legend-dot gray"></span>
          15 min walk
        </div>
      </div>

      {/* Edit/Delete actions for user-added locations */}
      {(onEdit || onDelete) && (
        <div className="sidebar-actions">
          {onEdit && (
            <button className="sidebar-edit-btn" onClick={onEdit}>
              Edit
            </button>
          )}
          {onDelete && (
            <button className="sidebar-delete-btn" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
