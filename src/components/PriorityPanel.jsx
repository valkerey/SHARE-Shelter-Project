import { useState } from 'react';
import { RESOURCE_CATEGORIES } from '../config/constants';
import './PriorityPanel.css';

const LEVELS = ['low', 'medium', 'high'];
const LEVEL_LABELS = { low: 'Low', medium: 'Med', high: 'High' };
const LEVEL_COLORS = { low: '#3b82f6', medium: '#eab308', high: '#22c55e' };

export default function PriorityPanel({ priorities, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...priorities });

  function handleOpen() {
    setDraft({ ...priorities });
    setOpen(true);
  }

  function handleCancel() {
    setDraft({ ...priorities });
    setOpen(false);
  }

  function handleApply() {
    onUpdate(draft);
    setOpen(false);
  }

  function handleToggle(category, level) {
    setDraft((prev) => ({ ...prev, [category]: level }));
  }

  if (!open) {
    return (
      <button className="priority-open-btn" onClick={handleOpen}>
        ⚙️ Set Priorities
      </button>
    );
  }

  return (
    <div className="priority-panel">
      <div className="priority-panel-title">Set Your Priorities</div>
      <div className="priority-panel-subtitle">
        What matters most for shelter locations?
      </div>

      {Object.entries(RESOURCE_CATEGORIES).map(([key, cat]) => (
        <div className="priority-row" key={key}>
          <span className="priority-row-icon">{cat.icon}</span>
          <span className="priority-row-label">{cat.label}</span>
          <div className="priority-btn-group">
            {LEVELS.map((level) => {
              const isActive = draft[key] === level;
              return (
                <button
                  key={level}
                  className={`priority-btn${isActive ? ' active' : ''}`}
                  style={
                    isActive
                      ? { background: LEVEL_COLORS[level] }
                      : undefined
                  }
                  onClick={() => handleToggle(key, level)}
                >
                  {LEVEL_LABELS[level]}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="priority-actions">
        <button className="priority-apply" onClick={handleApply}>
          Update Map
        </button>
        <button className="priority-cancel" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
