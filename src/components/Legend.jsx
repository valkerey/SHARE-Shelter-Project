import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './Legend.css';

const BUILDING_TYPES = [
  { color: '#3B82F6', label: 'Residential' },
  { color: '#F59E0B', label: 'Commercial'  },
  { color: '#8B5CF6', label: 'Mixed Use'   },
  { color: '#6366f1', label: 'Other / Unknown' },
];

const STATUSES = [
  { border: 'rgba(255,255,255,0.6)', star: true,  label: 'Unreviewed'  },
  { border: '#F59E0B',               star: false, label: 'In Progress' },
  { border: '#22C55E',               star: false, label: 'Promising'   },
  { border: '#EF4444',               star: false, label: 'Not Viable'  },
];

function Circle({ fill, border, star }) {
  return (
    <span
      className="lgd-circle"
      style={{
        background: fill,
        border: `2.5px solid ${border}`,
      }}
    >
      {star && <span className="lgd-star">★</span>}
    </span>
  );
}

export default function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lgd-wrap">
      {open && (
        <div className="lgd-panel glass-panel-strong">
          <section className="lgd-section">
            <div className="lgd-section-title">Vetting Status</div>
            {STATUSES.map(({ border, star, label }) => (
              <div key={label} className="lgd-row">
                <Circle fill="#4B5563" border={border} star={star} />
                <span>{label}</span>
              </div>
            ))}
          </section>

          <section className="lgd-section">
            <div className="lgd-section-title">Vacant Building Type</div>
            {BUILDING_TYPES.map(({ color, label }) => (
              <div key={label} className="lgd-row">
                <Circle fill={color} border="rgba(255,255,255,0.7)" star={false} />
                <span>{label}</span>
              </div>
            ))}
          </section>

          <section className="lgd-section">
            <div className="lgd-section-title">Churches</div>
            <div className="lgd-row">
              <Circle fill="#8B5CF6" border="rgba(255,255,255,0.7)" star={false} />
              <span>Church / Religious Site</span>
            </div>
          </section>

          <section className="lgd-section lgd-section--last">
            <div className="lgd-section-title">Nearby Resources</div>
            <div className="lgd-row">
              <span className="lgd-dot" style={{ background: '#22c55e' }} />
              <span>Within ¼ mile</span>
            </div>
            <div className="lgd-row">
              <span className="lgd-dot" style={{ background: '#f59e0b' }} />
              <span>Within ½ mile</span>
            </div>
          </section>
        </div>
      )}

      <button className="lgd-toggle" onClick={() => setOpen(o => !o)}>
        Legend {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>
    </div>
  );
}
