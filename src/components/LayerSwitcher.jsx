import { Layers, Building2, Church, MapPin, Loader } from 'lucide-react';
import './LayerSwitcher.css';

const LAYERS = [
  { key: 'resources',  label: 'Resources',           Icon: Layers,    countKey: null        },
  { key: 'vacant',     label: 'Vacant Buildings',     Icon: Building2, countKey: 'vacant'    },
  { key: 'churches',   label: 'Churches',             Icon: Church,    countKey: 'churches'  },
  { key: 'suggested',  label: 'Suggested',  Icon: MapPin,    countKey: 'suggested' },
];

export default function LayerSwitcher({ activeLayer, onLayerChange, loading = false, counts = {} }) {
  return (
    <div className="layer-switcher">
      {LAYERS.map(({ key, label, Icon, countKey }) => {
        const active = activeLayer === key;
        const count = countKey != null ? counts[countKey] : null;
        return (
          <button
            key={key}
            className={`layer-tab${active ? ' active' : ''}`}
            onClick={() => onLayerChange(key)}
            disabled={loading}
            title={loading ? 'Loading data…' : label}
          >
            <span className="layer-tab-icon">
              {loading
                ? <Loader size={15} strokeWidth={2} />
                : <Icon size={15} strokeWidth={2} />}
            </span>
            <span className="layer-tab-label">{label}</span>
            {count != null && (
              <span className={`layer-tab-count${active ? ' active' : ''}`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
