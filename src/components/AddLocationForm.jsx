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

export default function AddLocationForm({ lat, lng, initialData, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'church',
    address: initialData?.address || '',
    notes: initialData?.notes || '',
    contact_name: initialData?.contact?.name || '',
    contact_phone: initialData?.contact?.phone || '',
    contact_email: initialData?.contact?.email || '',
    contact_website: initialData?.contact?.website || '',
  });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...form, photo, lat, lng });
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  const title = initialData ? 'Edit Location' : 'Add New Location';

  return (
    <form className="add-location-form" onSubmit={handleSubmit}>
      <h3>{title}</h3>

      <div className="form-section-label">Location Details</div>

      <div className="form-field">
        <label htmlFor="loc-name">Name *</label>
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
        <label htmlFor="loc-address">Address</label>
        <input
          id="loc-address"
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="e.g. 123 Main St, Seattle"
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-notes">Notes</label>
        <textarea
          id="loc-notes"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Additional details..."
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

      <div className="form-section-label">Contact Information</div>

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

      <div className="form-actions">
        <button type="submit" className="form-save-btn" disabled={saving || !form.name.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="form-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
