import './ReviewQueuePanel.css';

const MODE_LABEL = {
  owner: '🏠 Owner',
  third_party: '📍 Third-party',
};

export default function ReviewQueuePanel({
  pending,
  onView,
  onApprove,
  onReject,
  onEditApprove,
  onClose,
}) {
  return (
    <div className="review-queue-panel">
      <button className="review-close" onClick={onClose} aria-label="Close review queue">
        &times;
      </button>
      <h3>Pending Suggestions</h3>

      {pending.length === 0 && (
        <div className="review-empty">No pending suggestions. 🎉</div>
      )}

      {pending.map((row) => (
        <div className="review-card" key={row.id}>
          <div className="review-card-header">
            <span className="review-card-name">{row.name}</span>
            <span className="review-mode-badge">
              {MODE_LABEL[row.suggestion_mode] || row.suggestion_mode}
            </span>
          </div>

          <div className="review-card-meta">
            <div>{row.type.replace(/_/g, ' ')}</div>
            {row.address && <div>{row.address}</div>}
          </div>

          {row.notes && <div className="review-card-notes">{row.notes}</div>}

          {row.photo_url && (
            <a href={row.photo_url} target="_blank" rel="noopener noreferrer">
              <img className="review-card-photo" src={row.photo_url} alt="" />
            </a>
          )}

          <div className="review-card-submitter">
            <div className="review-section-label">Submitter</div>
            <div>{row.submitter?.name}</div>
            <div>{row.submitter?.phone}</div>
            <div>{row.submitter?.email}</div>
          </div>

          <div className="review-card-actions">
            <button onClick={() => onView(row)}>View on map</button>
            <button className="review-approve" onClick={() => onApprove(row)}>Approve</button>
            <button className="review-reject" onClick={() => onReject(row)}>Reject</button>
            <button onClick={() => onEditApprove(row)}>Edit &amp; Approve</button>
          </div>
        </div>
      ))}
    </div>
  );
}
