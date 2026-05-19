import { useState } from 'react';
import { X } from 'lucide-react';
import './TopBar.css';

function AboutModal({ onClose }) {
  return (
    <div className="topbar-modal-overlay" onClick={onClose}>
      <div className="topbar-modal" onClick={e => e.stopPropagation()}>
        <button className="topbar-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h2 className="topbar-modal-title">About This Tool</h2>
        <p>
          The <strong>SHARE Host Site Tool</strong> is built to help SHARE members identify
          and vet potential shelter host sites across Seattle — including vacant buildings
          and churches with available space.
        </p>
        <p>
          Each site shows nearby resources within a quarter and half mile, including
          transit, food services, healthcare, libraries, bike infrastructure, and parks —
          giving a picture of what residents would have access to.
        </p>
        <p>
          Use the vetting status buttons to track each site through the review process,
          attach photos and notes from site visits, and filter the map to focus on
          unreviewed sites. Print a site summary to bring to meetings or share with
          property contacts.
        </p>
        <div className="topbar-modal-footer">
          Built for SHARE — Seattle Housing and Resource Effort
        </div>
      </div>
    </div>
  );
}

export default function TopBar() {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">SHARE Host Site Tool</span>
        <div className="topbar-actions">
          <button className="topbar-btn" disabled title="Coming soon">
            Tutorial
          </button>
          <button className="topbar-btn" onClick={() => setShowAbout(true)}>
            About
          </button>
        </div>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </>
  );
}
