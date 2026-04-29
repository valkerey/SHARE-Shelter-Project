import { useState } from 'react';
import { RESOURCE_CATEGORIES } from '../config/constants';
import { upsertContactOverride } from '../services/supabase-locations';
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
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({
    name: '',
    phone: '',
    email: '',
    website: '',
  });

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
    source,
  } = location;

  function startContactEdit() {
    setContactDraft({
      name: contact?.name || '',
      phone: contact?.phone || '',
      email: contact?.email || '',
      website: contact?.website || '',
    });
    setEditingContact(true);
  }

  async function saveContact() {
    try {
      await upsertContactOverride(location.id, contactDraft);
      setEditingContact(false);
    } catch (err) {
      console.error('Failed to save contact:', err);
    }
  }

  return (
    <div className="sidebar glass-panel-strong">
      {/* Close button */}
      <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
        &times;
      </button>

      {/* Header: name, address, contact */}
      <div className="sidebar-header">
        <div className="sidebar-name">{name}</div>
        {address && <div className="sidebar-address">{address}</div>}
        {contact && !editingContact && (
          <div className="sidebar-contact">
            {contact.name && <div>{contact.name}</div>}
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

        {/* Inline contact editing for API-sourced locations */}
        {source !== 'user' && !editingContact && (
          <button className="sidebar-contact-edit" onClick={startContactEdit}>
            Edit Contact
          </button>
        )}

        {editingContact && (
          <div className="contact-edit-form">
            <input
              type="text"
              placeholder="Contact name"
              value={contactDraft.name}
              onChange={(e) => setContactDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Phone"
              value={contactDraft.phone}
              onChange={(e) => setContactDraft((d) => ({ ...d, phone: e.target.value }))}
            />
            <input
              type="email"
              placeholder="Email"
              value={contactDraft.email}
              onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Website"
              value={contactDraft.website}
              onChange={(e) => setContactDraft((d) => ({ ...d, website: e.target.value }))}
            />
            <div className="contact-edit-actions">
              <button className="contact-save-btn" onClick={saveContact}>
                Save Contact
              </button>
              <button className="contact-cancel-btn" onClick={() => setEditingContact(false)}>
                Cancel
              </button>
            </div>
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
