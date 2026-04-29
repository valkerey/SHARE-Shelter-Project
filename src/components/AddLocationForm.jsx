import { useState } from 'react';
import './AddLocationForm.css';

const LOCATION_TYPES = [
  { value: 'church', label: 'Church' },
  { value: 'community_center', label: 'Community Center' },
  { value: 'vacant_building', label: 'Vacant Building' },
  { value: 'public_facility', label: 'Public Facility' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
];

const COPY = {
  owner: {
    nameLabel: 'Name of your property',
    addressLabel: 'Address of your property',
    notesLabel: 'Anything SHARE should know — availability, capacity, restrictions',
    contactSection: 'Property contact (you)',
    contactHelp: "Your contact info goes below — we'll use this since you ARE the property.",
  },
  third_party: {
    nameLabel: 'Name of the property (if known)',
    addressLabel: "Address (or rough description if you don't know exactly)",
    notesLabel: 'Why do you think this place would work? Have you spoken to the owner?',
    contactSection: 'Property contact (if known)',
    contactHelp: 'If you know who owns or runs the place, fill this in. Leave blank if not.',
  },
};

export default function AddLocationForm({
  lat,
  lng,
  initialData,
  onSave,
  onCancel,
  isAdmin = false,
}) {
  const [mode, setMode] = useState(isAdmin ? 'admin' : initialData?.suggestion_mode || null);

  const [form, setForm] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'church',
    address: initialData?.address || '',
    notes: initialData?.notes || '',
    contact_name: initialData?.contact?.name || '',
    contact_phone: initialData?.contact?.phone || '',
    contact_email: initialData?.contact?.email || '',
    contact_website: initialData?.contact?.website || '',
    submitter_name: '',
    submitter_phone: '',
    submitter_email: '',
    honeypot: '', // bot trap, must remain empty
  });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function copySubmitterToContact() {
    setForm((prev) => ({
      ...prev,
      contact_name: prev.submitter_name,
      contact_phone: prev.submitter_phone,
      contact_email: prev.submitter_email,
    }));
  }

  const isPublic = !isAdmin;
  const submitterFilled =
    form.submitter_name.trim() &&
    form.submitter_phone.trim() &&
    form.submitter_email.trim();

  const canSubmit = form.name.trim() && (!isPublic || (mode && submitterFilled));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    if (form.honeypot) return; // bot
    setSaving(true);
    try {
      const payload = { ...form, photo, lat, lng };
      if (isPublic) payload.suggestion_mode = mode;
      delete payload.honeypot;
      await onSave(payload);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  // Public mode: show mode picker until selected
  if (isPublic && !mode) {
    return (
      <div className="add-location-form mode-picker">
        <h3>Suggest a Location</h3>
        <p className="mode-picker-prompt">What kind of suggestion is this?</p>
        <button
          type="button"
          className="mode-picker-btn"
          onClick={() => setMode('owner')}
        >
          🏠 I&apos;m offering my own property
          <span className="mode-picker-sub">Church, building owner, etc.</span>
        </button>
        <button
          type="button"
          className="mode-picker-btn"
          onClick={() => setMode('third_party')}
        >
          📍 I want to suggest a property I know about
          <span className="mode-picker-sub">Place I drove past, vacant lot, etc.</span>
        </button>
        <button type="button" className="form-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  const copy = isPublic ? COPY[mode] : null;
  const title = isAdmin
    ? initialData
      ? 'Edit Location'
      : 'Add New Location'
    : mode === 'owner'
      ? 'Offer Your Property'
      : 'Suggest a Property';
  const submitLabel = isAdmin ? 'Save' : 'Send suggestion';

  return (
    <form className="add-location-form glass-panel-strong" onSubmit={handleSubmit}>
      <h3>{title}</h3>

      {/* Honeypot: hidden from users, visible to dumb bots */}
      <input
        type="text"
        name="honeypot"
        value={form.honeypot}
        onChange={handleChange}
        tabIndex={-1}
        autoComplete="off"
        style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      <div className="form-section-label">Location Details</div>

      <div className="form-field">
        <label htmlFor="loc-name">{isAdmin ? 'Name *' : `${copy.nameLabel} *`}</label>
        <input
          id="loc-name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. First Baptist Church"
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-type">Type</label>
        <select id="loc-type" name="type" value={form.type} onChange={handleChange}>
          {LOCATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="loc-address">{isAdmin ? 'Address' : copy.addressLabel}</label>
        <input
          id="loc-address"
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="e.g. 123 Main St, Seattle"
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-notes">{isAdmin ? 'Notes' : copy.notesLabel}</label>
        <textarea
          id="loc-notes"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder=""
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-photo">Photo</label>
        <input
          id="loc-photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files[0] || null)}
        />
      </div>

      <div className="form-section-label">
        {isAdmin ? 'Contact Information' : copy.contactSection}
      </div>
      {!isAdmin && <p className="form-help">{copy.contactHelp}</p>}

      {!isAdmin && mode === 'owner' && (
        <button
          type="button"
          className="copy-from-submitter-btn"
          onClick={copySubmitterToContact}
        >
          Same as your contact above? Copy
        </button>
      )}

      <div className="form-field">
        <label htmlFor="loc-contact-name">Contact Name</label>
        <input
          id="loc-contact-name"
          name="contact_name"
          value={form.contact_name}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-contact-phone">Phone</label>
        <input
          id="loc-contact-phone"
          name="contact_phone"
          value={form.contact_phone}
          onChange={handleChange}
          placeholder="(206) 555-0123"
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-contact-email">Email</label>
        <input
          id="loc-contact-email"
          name="contact_email"
          type="email"
          value={form.contact_email}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-contact-website">Website</label>
        <input
          id="loc-contact-website"
          name="contact_website"
          value={form.contact_website}
          onChange={handleChange}
          placeholder="https://"
        />
      </div>

      {isPublic && (
        <>
          <div className="form-section-label">Your Contact (required)</div>
          <p className="form-help">
            SHARE will reach out at your email to follow up on your suggestion.
          </p>

          <div className="form-field">
            <label htmlFor="sub-name">Your name *</label>
            <input
              id="sub-name"
              name="submitter_name"
              value={form.submitter_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="sub-phone">Your phone *</label>
            <input
              id="sub-phone"
              name="submitter_phone"
              value={form.submitter_phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="sub-email">Your email *</label>
            <input
              id="sub-email"
              name="submitter_email"
              type="email"
              value={form.submitter_email}
              onChange={handleChange}
              required
            />
          </div>
        </>
      )}

      <div className="form-actions">
        <button type="submit" className="form-save-btn" disabled={saving || !canSubmit}>
          {saving ? (isAdmin ? 'Saving...' : 'Sending...') : submitLabel}
        </button>
        <button type="button" className="form-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
