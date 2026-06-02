import { useState, useEffect, useRef } from 'react';
import { ExternalLink, ChevronDown, ChevronRight, Paperclip, X, Printer, Bike, Bus, Library, HeartPulse, ShoppingBasket, TreePine } from 'lucide-react';
import { downsizeImage } from '../utils/downsizeImage';
import { printSiteCard } from '../utils/printSiteCard';
import './HostSiteSidebar.css';

const STATUSES = [
  { key: 'unreviewed',  label: 'Unreviewed',  color: '#6B7280' },
  { key: 'in-progress', label: 'In Progress', color: '#F59E0B' },
  { key: 'promising',   label: 'Promising',   color: '#22C55E' },
  { key: 'not-viable',  label: 'Not Viable',  color: '#EF4444' },
];

const BUILDING_TYPE_COLORS = {
  residential: '#3B82F6',
  commercial:  '#F59E0B',
  mixed:       '#8B5CF6',
};

function buildingColor(type) {
  if (!type) return '#6B7280';
  return BUILDING_TYPE_COLORS[type.toLowerCase()] || '#6B7280';
}

// For each resource _type, define the subcategories and how to classify a point
const RESOURCE_TYPES = [
  {
    key: 'bike',
    label: 'Bike Infrastructure',
    Icon: Bike,
    color: '#FCA5A5',
    subcategories: [
      { key: 'locker', label: 'Bike Lockers', match: (r) => !!r.BICYCLE_STORAGE_TYPE },
      { key: 'rack',   label: 'Bike Racks',   match: (r) => !r.BICYCLE_STORAGE_TYPE },
    ],
  },
  {
    key: 'transit',
    label: 'Transit',
    Icon: Bus,
    color: '#3B82F6',
    subcategories: [
      { key: 'bus',  label: 'Bus Stops',      match: (r) => r._subtype !== 'rail' },
      { key: 'rail', label: 'Link Stations',  match: (r) => r._subtype === 'rail' },
    ],
  },
  {
    key: 'libraries',
    label: 'Libraries',
    Icon: Library,
    color: '#A78BFA',
    subcategories: [
      { key: 'library', label: 'Libraries', match: () => true },
    ],
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    Icon: HeartPulse,
    color: '#D95319',
    subcategories: [
      { key: 'facility', label: 'Healthcare Facilities', match: () => true },
    ],
  },
  {
    key: 'foodSocial',
    label: 'Food & Social Services',
    Icon: ShoppingBasket,
    color: '#FBBF24',
    subcategories: [
      { key: 'food',      label: 'Food Banks',        match: (r) => !!(r.Food_Resource_Type || r.Agency) },
      { key: 'community', label: 'Community Centers', match: (r) => !(r.Food_Resource_Type || r.Agency) },
    ],
  },
  {
    key: 'parks',
    label: 'Parks',
    Icon: TreePine,
    color: '#34D399',
    subcategories: [],
  },
];

export default function HostSiteSidebar({ site, siteType, nearby, isAdmin, onClose, onStatusChange }) {
  const [notes, setNotes]               = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft]     = useState('');
  const [expanded, setExpanded]         = useState({});
  const [photos, setPhotos]             = useState([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [status, setStatus]             = useState('unreviewed');
  const fileInputRef                    = useRef(null);

  const siteKey = site?._id;

  useEffect(() => {
    if (!siteKey) return;
    setNotes(localStorage.getItem(`host-notes-${siteKey}`) || '');
    setStatus(localStorage.getItem(`host-status-${siteKey}`) || 'unreviewed');
    setEditingNotes(false);
    setExpanded({});
    try {
      setPhotos(JSON.parse(localStorage.getItem(`host-photos-${siteKey}`) || '[]'));
    } catch { setPhotos([]); }
  }, [siteKey]);

  function handleStatusChange(newStatus) {
    localStorage.setItem(`host-status-${siteKey}`, newStatus);
    setStatus(newStatus);
    onStatusChange?.();
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 6) { alert('Maximum 6 photos per site.'); return; }
    setPhotoLoading(true);
    try {
      const compressed = await downsizeImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const updated = [...photos, ev.target.result];
        localStorage.setItem(`host-photos-${siteKey}`, JSON.stringify(updated));
        setPhotos(updated);
        setPhotoLoading(false);
      };
      reader.readAsDataURL(compressed);
    } catch (err) {
      console.warn('Photo upload failed:', err);
      setPhotoLoading(false);
    }
    e.target.value = '';
  }

  function removePhoto(index) {
    const updated = photos.filter((_, i) => i !== index);
    localStorage.setItem(`host-photos-${siteKey}`, JSON.stringify(updated));
    setPhotos(updated);
  }

  if (!site) return null;

  const isVacant = siteType === 'vacant';
  const structureLink = site['Structure Info Link'];
  const permitLink    = site['Permit Info Link'];
  const bgColor       = buildingColor(site.Building_Type);

  const rawAddress = isVacant ? site.Address : site.ADDRESS;
  const mapsHref = rawAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress + ', Seattle, WA')}`
    : null;

  // Build subcategory counts for quarter and half mile buckets
  const counts = RESOURCE_TYPES.reduce((acc, rt) => {
    if (rt.key === 'parks') {
      acc.parks = { quarter: nearby?.parksQuarter || 0, half: nearby?.parksHalf || 0, subcategories: [] };
    } else {
      acc[rt.key] = {
        quarter: (nearby?.quarter || []).filter(r => r._type === rt.key).length,
        half:    (nearby?.half    || []).filter(r => r._type === rt.key).length,
        subcategories: rt.subcategories.map(sub => ({
          label: sub.label,
          quarter: (nearby?.quarter || []).filter(r => r._type === rt.key && sub.match(r)).length,
          half:    (nearby?.half    || []).filter(r => r._type === rt.key && sub.match(r)).length,
        })),
      };
    }
    return acc;
  }, {});

  function saveNotes() {
    localStorage.setItem(`host-notes-${siteKey}`, notesDraft);
    setNotes(notesDraft);
    setEditingNotes(false);
  }

  function toggleExpanded(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="sidebar glass-panel-strong hss">
      <button className="sidebar-close" onClick={onClose} aria-label="Close">×</button>

      {/* ── Header ── */}
      <div className="sidebar-header">
        {isVacant && site.Building_Type && (
          <div
            className="hss-badge"
            style={{ background: bgColor + '22', color: bgColor, borderColor: bgColor + '55' }}
          >
            {site.Building_Type}
          </div>
        )}

        <div className="sidebar-name">
          {isVacant && mapsHref
            ? <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="hss-addr-link">{site.Address || 'Vacant Building'}</a>
            : isVacant ? (site.Address || 'Vacant Building') : (site.PROP_NAME || 'Church')}
        </div>

        {/* Church details */}
        {!isVacant && (
          <div className="hss-details">
            {site.ADDRESS && (
              <div className="hss-row">
                <span className="hss-label">Address</span>
                {mapsHref
                  ? <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="hss-addr-link">{site.ADDRESS}</a>
                  : <span>{site.ADDRESS}</span>}
              </div>
            )}
            {site.LAND_SQFT  && <div className="hss-row"><span className="hss-label">Sq Ft</span><span>{Number(site.LAND_SQFT).toLocaleString()}</span></div>}
          </div>
        )}

        {/* Building details */}
        {isVacant && (
          <div className="hss-details">
            {site.detail              && <div className="hss-row"><span className="hss-label">Details</span><span>{site.detail}</span></div>}
            {site.Units               && <div className="hss-row"><span className="hss-label">Units</span><span>{site.Units}</span></div>}
            {site.sqft                && <div className="hss-row"><span className="hss-label">Sq Ft</span><span>{Number(site.sqft).toLocaleString()}</span></div>}
            {site.stories_total       && <div className="hss-row"><span className="hss-label">Stories (Total)</span><span>{site.stories_total}</span></div>}
            {site.stories_residential && <div className="hss-row"><span className="hss-label">Stories (Residential)</span><span>{site.stories_residential}</span></div>}
          </div>
        )}

        {/* External links */}
        {isVacant && (structureLink || permitLink) && (
          <div className="hss-links">
            {structureLink && (
              <a href={structureLink} target="_blank" rel="noopener noreferrer" className="hss-link">
                <ExternalLink size={11} /> King County Assessor
              </a>
            )}
            {permitLink && (
              <a href={permitLink} target="_blank" rel="noopener noreferrer" className="hss-link">
                <ExternalLink size={11} /> Permit Info
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Vetting status ── */}
      <div className="hss-status-bar">
        {STATUSES.map(s => {
          const active = status === s.key;
          return (
            <button
              key={s.key}
              className={`hss-status-btn${active ? ' active' : ''}${!isAdmin ? ' readonly' : ''}`}
              style={active ? { background: s.color + '28', color: s.color, borderColor: s.color + '99' } : {}}
              onClick={isAdmin ? () => handleStatusChange(s.key) : undefined}
              disabled={!isAdmin}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Resource counts ── */}
      <div className="sidebar-resources-title">Nearby Resources</div>
      <div className="hss-legend">
        <span><span className="hss-dot" style={{ background: '#22c55e' }} /> ¼ mile</span>
        <span><span className="hss-dot" style={{ background: '#f59e0b' }} /> ½ mile</span>
      </div>

      {RESOURCE_TYPES.map(({ key, label, Icon, color, subcategories }) => {
        const q = counts[key].quarter;
        const h = counts[key].half;
        const isOpen = !!expanded[key];
        const hasMultipleSubs = subcategories.length > 1;

        return (
          <div key={key}>
            <div
              className={`resource-row${hasMultipleSubs ? ' resource-row--clickable' : ''}`}
              onClick={hasMultipleSubs ? () => toggleExpanded(key) : undefined}
            >
              <Icon size={14} color={color} className="hss-type-icon" />
              <span className="resource-name">{label}</span>
              <span className="hss-count-pair">
                <span style={{ color: q > 0 ? '#22c55e' : 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{q}</span>
                <span className="hss-count-sep">/</span>
                <span style={{ color: h > 0 ? '#f59e0b' : 'rgba(255,255,255,0.25)' }}>{h}</span>
              </span>
              {hasMultipleSubs && (
                <span className="hss-chevron">
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
              )}
            </div>

            {isOpen && (
              <div className="hss-subcategories">
                {counts[key].subcategories.map((sub, i) => (
                  <div key={i} className="hss-sub-row">
                    <span className="hss-sub-label">{sub.label}</span>
                    <span className="hss-sub-counts">
                      <span style={{ color: sub.quarter > 0 ? '#22c55e' : 'rgba(255,255,255,0.2)', fontWeight: 600 }}>{sub.quarter}</span>
                      <span className="hss-count-sep">/</span>
                      <span style={{ color: sub.half > 0 ? '#f59e0b' : 'rgba(255,255,255,0.2)' }}>{sub.half}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Admin section ── */}
      {isAdmin && (
        <div className="hss-notes-section">
          <div className="sidebar-resources-title">Admin Notes</div>
          {!editingNotes ? (
            <>
              <p className="hss-notes-text">{notes || 'No notes yet.'}</p>
              <button
                className="sidebar-contact-edit"
                onClick={() => { setNotesDraft(notes); setEditingNotes(true); }}
              >
                {notes ? 'Edit Notes' : 'Add Notes'}
              </button>
            </>
          ) : (
            <>
              <textarea
                className="hss-notes-input"
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                placeholder="Add notes about this site…"
                rows={4}
              />
              <div className="contact-edit-actions">
                <button className="contact-save-btn" onClick={saveNotes}>Save</button>
                <button className="contact-cancel-btn" onClick={() => setEditingNotes(false)}>Cancel</button>
              </div>
            </>
          )}

          <div className="sidebar-resources-title" style={{ marginTop: 18 }}>Photos</div>

          {photos.length > 0 && (
            <div className="hss-photo-grid">
              {photos.map((src, i) => (
                <div key={i} className="hss-photo-thumb">
                  <img src={src} alt={`Site photo ${i + 1}`} />
                  <button
                    className="hss-photo-remove"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />
          <button
            className="sidebar-contact-edit hss-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoLoading || photos.length >= 6}
          >
            <Paperclip size={12} />
            {photoLoading ? 'Uploading…' : photos.length >= 6 ? 'Max photos reached' : 'Attach Photo'}
          </button>
        </div>
      )}

      {/* ── Footer: print + close ── */}
      <div className="hss-close-footer">
        <button
          className="hss-print-btn"
          onClick={() => printSiteCard({
            name: isVacant ? (site.Address || 'Vacant Building') : (site.PROP_NAME || 'Church'),
            address: rawAddress,
            buildingType: isVacant ? site.Building_Type : null,
            status,
            notes,
            photos,
            counts,
          })}
        >
          <Printer size={13} /> Print Summary
        </button>
        <button className="hss-close-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
