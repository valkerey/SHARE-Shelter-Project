import { useState } from 'react';
import { ChevronDown, ChevronUp, Bike, Bus, Library, HeartPulse, ShoppingBasket, TreePine } from 'lucide-react';
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

const RESOURCE_TYPES = [
  { Icon: Bike,           color: '#FCA5A5', label: 'Bike Infrastructure', dot: false },
  { Icon: Bus,            color: '#3B82F6', label: 'Transit',             dot: false },
  { Icon: Library,        color: '#A78BFA', label: 'Libraries',           dot: false },
  { Icon: HeartPulse,     color: '#D95319', label: 'Healthcare',          dot: false },
  { Icon: ShoppingBasket, color: '#FBBF24', label: 'Food & Social',       dot: false },
  { Icon: TreePine,       color: '#34D399', label: 'Parks',               dot: false },
];

function Circle({ fill, border, star }) {
  return (
    <span
      className="lgd-circle"
      style={{ background: fill, border: `2.5px solid ${border}` }}
    >
      {star && <span className="lgd-star">★</span>}
    </span>
  );
}

function ResourcesLegend() {
  return (
    <section className="lgd-section lgd-section--last">
      <div className="lgd-section-title">Resource Types</div>
      {RESOURCE_TYPES.map(({ color, label }) => (
        <div key={label} className="lgd-row">
          <Circle fill={color} border="rgba(255,255,255,0.7)" star={false} />
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}

function VacantLegend() {
  return (
    <>
      <section className="lgd-section">
        <div className="lgd-section-title">Vetting Status</div>
        {STATUSES.map(({ border, star, label }) => (
          <div key={label} className="lgd-row">
            <Circle fill="#4B5563" border={border} star={star} />
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section className="lgd-section lgd-section--last">
        <div className="lgd-section-title">Building Type</div>
        {BUILDING_TYPES.map(({ color, label }) => (
          <div key={label} className="lgd-row">
            <Circle fill={color} border="rgba(255,255,255,0.7)" star={false} />
            <span>{label}</span>
          </div>
        ))}
      </section>
    </>
  );
}

function ChurchesLegend() {
  return (
    <>
      <section className="lgd-section">
        <div className="lgd-section-title">Vetting Status</div>
        {STATUSES.map(({ border, star, label }) => (
          <div key={label} className="lgd-row">
            <Circle fill="#4B5563" border={border} star={star} />
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section className="lgd-section lgd-section--last">
        <div className="lgd-section-title">Churches</div>
        <div className="lgd-row">
          <Circle fill="#8B5CF6" border="rgba(255,255,255,0.7)" star={false} />
          <span>Church / Religious Site</span>
        </div>
      </section>
    </>
  );
}

function SuggestedLegend() {
  return (
    <>
      <section className="lgd-section">
        <div className="lgd-section-title">Vetting Status</div>
        {STATUSES.map(({ border, star, label }) => (
          <div key={label} className="lgd-row">
            <Circle fill="#4B5563" border={border} star={star} />
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section className="lgd-section lgd-section--last">
        <div className="lgd-section-title">Suggested Locations</div>
        <div className="lgd-row">
          <Circle fill="#22C55E" border="rgba(255,255,255,0.7)" star={false} />
          <span>Approved Suggestion</span>
        </div>
      </section>
    </>
  );
}

export default function Legend({ activeLayer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lgd-wrap">
      {open && (
        <div className="lgd-panel glass-panel-strong">
          {activeLayer === 'resources'  && <ResourcesLegend />}
          {activeLayer === 'vacant'     && <VacantLegend />}
          {activeLayer === 'churches'   && <ChurchesLegend />}
          {activeLayer === 'suggested'  && <SuggestedLegend />}
          {!activeLayer && <VacantLegend />}
        </div>
      )}

      <button className="lgd-toggle" onClick={() => setOpen(o => !o)}>
        Legend {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>
    </div>
  );
}
