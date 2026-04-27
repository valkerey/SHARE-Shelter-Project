import { supabase } from '../config/supabase';

/**
 * Fetch all user-added locations from Supabase.
 * Maps each row to the normalized location format used by the app.
 */
export async function fetchUserLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.warn('Failed to fetch user locations:', error.message);
    return [];
  }

  return (data || []).map((d) => ({
    id: `user-${d.id}`,
    supabaseId: d.id,
    source: 'user',
    status: d.status || 'approved',
    name: d.name,
    type: d.type || 'other',
    lat: d.lat,
    lng: d.lng,
    address: d.address || '',
    notes: d.notes || '',
    photo_url: d.photo_url || null,
    contact: {
      name: d.contact_name || '',
      phone: d.contact_phone || '',
      email: d.contact_email || '',
      website: d.contact_website || '',
    },
    suggestion_mode: d.suggestion_mode || null,
    submitter: {
      name: d.submitter_name || '',
      phone: d.submitter_phone || '',
      email: d.submitter_email || '',
    },
    review_notes: d.review_notes || '',
  }));
}

/**
 * Insert a new location into the Supabase locations table.
 */
export async function addLocation(location) {
  const { data, error } = await supabase
    .from('locations')
    .insert([location])
    .select();

  if (error) throw error;
  return data;
}

/**
 * Update an existing location by its Supabase id.
 */
export async function updateLocation(id, updates) {
  const { data, error } = await supabase
    .from('locations')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Delete a location by its Supabase id.
 */
export async function deleteLocation(id) {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Upload a photo to the 'location-photos' storage bucket.
 * - prefix: 'pending' for public suggestions, 'approved' for admin adds.
 * Returns the public URL.
 */
export async function uploadPhoto(locationId, file, prefix = 'approved') {
  const path = `${prefix}/${locationId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('location-photos')
    .upload(path, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('location-photos').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Fetch a contact override for a given source-based location id.
 */
export async function fetchContactOverride(sourceId) {
  const { data, error } = await supabase
    .from('contact_overrides')
    .select('*')
    .eq('source_id', sourceId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to fetch contact override:', error.message);
    return null;
  }

  return data;
}

/**
 * Upsert (insert or update) a contact override for a source-based location.
 */
export async function upsertContactOverride(sourceId, contact) {
  const { data, error } = await supabase
    .from('contact_overrides')
    .upsert(
      {
        source_id: sourceId,
        contact_name: contact.name || '',
        contact_phone: contact.phone || '',
        contact_email: contact.email || '',
        contact_website: contact.website || '',
      },
      { onConflict: 'source_id' }
    )
    .select();

  if (error) throw error;
  return data;
}

/**
 * Insert a public suggestion. RLS enforces required submitter fields and status='pending'.
 */
export async function addSuggestion(payload) {
  const row = {
    name: payload.name,
    type: payload.type,
    lat: payload.lat,
    lng: payload.lng,
    address: payload.address || '',
    notes: payload.notes || '',
    contact_name: payload.contact_name || '',
    contact_phone: payload.contact_phone || '',
    contact_email: payload.contact_email || '',
    contact_website: payload.contact_website || '',
    submitter_name: payload.submitter_name,
    submitter_phone: payload.submitter_phone,
    submitter_email: payload.submitter_email,
    suggestion_mode: payload.suggestion_mode,
    photo_url: payload.photo_url || null,
    status: 'pending',
  };
  const { data, error } = await supabase.from('locations').insert([row]).select();
  if (error) throw error;
  return data;
}

/** Approve a pending suggestion: flip status to 'approved'. */
export async function approveSuggestion(id) {
  const { data, error } = await supabase
    .from('locations')
    .update({ status: 'approved' })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data;
}

/** Reject a pending suggestion with a reason. */
export async function rejectSuggestion(id, reason) {
  const { data, error } = await supabase
    .from('locations')
    .update({ status: 'rejected', review_notes: reason })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data;
}

/** Edit a pending suggestion's fields AND flip status to 'approved' in one update. */
export async function editAndApprove(id, updates) {
  const { data, error } = await supabase
    .from('locations')
    .update({ ...updates, status: 'approved' })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data;
}
