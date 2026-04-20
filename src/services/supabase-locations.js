import { supabase } from '../config/supabase';

/**
 * Fetch all user-added locations from Supabase.
 * Maps each row to the normalized location format used by the app.
 */
export async function fetchUserLocations() {
  const { data, error } = await supabase.from('locations').select('*');

  if (error) {
    console.warn('Failed to fetch user locations:', error.message);
    return [];
  }

  return (data || []).map((d) => ({
    id: `user-${d.id}`,
    supabaseId: d.id,
    source: 'user',
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
 * Returns the public URL of the uploaded file.
 */
export async function uploadPhoto(locationId, file) {
  const path = `${locationId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('location-photos')
    .upload(path, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('location-photos')
    .getPublicUrl(path);

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
