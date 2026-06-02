import { useMemo } from 'react';
import { X } from 'lucide-react';
import './AdminNotesPanel.css';

const STATUS_META = {
  'unreviewed':  { label: 'Unreviewed',  color: '#6B7280' },
  'in-progress': { label: 'In Progress', color: '#F59E0B' },
  'promising':   { label: 'Promising',   color: '#22C55E' },
  'not-viable':  { label: 'Not Viable',  color: '#EF4444' },
};

function getSiteInfo(id, localData) {
  if (!localData) return null;
  if (id.startsWith('vacant-')) {
    const idx = parseInt(id.slice('vacant-'.length), 10);
    const site = localData.vacantBuildings?.[idx];
    if (!site) return null;
    return {
      site,
      siteType: 'vacant',
      name: site.Address || 'Vacant Building',
      subtitle: site.Building_Type || '',
    };
  }
  if (id.startsWith('church-')) {
    const idx = parseInt(id.slice('church-'.length), 10);
    const site = localData.churches?.[idx];
    if (!site) return null;
    return {
      site,
      siteType: 'churches',
      name: site.PROP_NAME || 'Church',
      subtitle: site.ADDRESS || '',
    };
  }
  return null;
}

export default function AdminNotesPanel({ localData, onClose, onSelectSite }) {
  const totalSites = (localData?.vacantBuildings?.length || 0) + (localData?.churches?.length || 0);

  const entries = useMemo(() => {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('host-notes-')) continue;
      const notes = localStorage.getItem(key) || '';
      if (!notes.trim()) continue;
      const id = key.slice('host-notes-'.length);
      const info = getSiteInfo(id, localData);
      if (!info) continue;
      let photos = [];
      try { photos = JSON.parse(localStorage.getItem(`host-photos-${id}`) || '[]'); } catch { /* */ }
      const status = localStorage.getItem(`host-status-${id}`) || 'unreviewed';
      results.push({ id, notes, photos, status, ...info });
    }
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }, [localData]);

  return (
    <div className="anp-panel">
      <button className="anp-close" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>
      <div className="anp-header">
        <span className="anp-title">Admin Notes</span>
        <span className="anp-count">{entries.length} / {totalSites}</span>
      </div>

      {entries.length === 0 ? (
        <div className="anp-empty">No sites with notes yet.</div>
      ) : (
        <div className="anp-list">
          {entries.map(({ id, notes, photos, status, site, siteType, name, subtitle }) => {
            const sm = STATUS_META[status] || STATUS_META.unreviewed;
            return (
              <button
                key={id}
                className="anp-entry"
                onClick={() => onSelectSite(site, siteType, id)}
              >
                <div className="anp-entry-body">
                  <div className="anp-entry-left">
                    <div className="anp-entry-name">{name}</div>
                    {subtitle && <div className="anp-entry-sub">{subtitle}</div>}
                    <span className="anp-status" style={{ color: sm.color, borderColor: sm.color + '88', background: sm.color + '18' }}>{sm.label}</span>
                    {photos.length > 0 && (
                      <img className="anp-entry-photo" src={photos[0]} alt="Site" />
                    )}
                  </div>
                  <div className="anp-entry-notes">{notes}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
