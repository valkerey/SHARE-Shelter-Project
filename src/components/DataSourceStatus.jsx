import { useState } from 'react';
import './DataSourceStatus.css';

export default function DataSourceStatus({ sources }) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  const okCount = sources.filter((s) => s.ok).length;
  const total = sources.length;
  const allOk = okCount === total;

  return (
    <div className="data-source-status">
      {open && (
        <div className="data-source-popup glass-panel">
          <div className="data-source-popup-header">
            <span>Data sources</span>
            <span className="data-source-summary">
              {okCount} / {total} loaded
            </span>
          </div>
          <ul className="data-source-list">
            {sources.map((s, i) => (
              <li key={i} className={s.ok ? 'ok' : 'fail'}>
                <span className="status-dot" aria-hidden="true">
                  {s.ok ? '●' : '○'}
                </span>
                <span className="source-label">{s.label}</span>
                <span className="source-count">
                  {s.ok ? s.count.toLocaleString() : 'failed'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        className={`data-source-toggle glass-button ${allOk ? 'all-ok' : 'has-fail'}`}
        onClick={() => setOpen((v) => !v)}
        title="Data source status"
      >
        <span className="data-source-toggle-dot" />
        {okCount}/{total}
      </button>
    </div>
  );
}
