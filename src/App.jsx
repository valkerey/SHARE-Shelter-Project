import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import PriorityPanel from './components/PriorityPanel';
import LayerPanel from './components/LayerPanel';
import Sidebar from './components/Sidebar';
import AddLocationForm from './components/AddLocationForm';
import useAuth from './hooks/useAuth';
import SignInButton from './components/SignInButton';
import SignInModal from './components/SignInModal';
import useDataLoader from './hooks/useDataLoader';
import { useScoring } from './hooks/useScoring';
import {
  addLocation,
  addSuggestion,
  updateLocation,
  deleteLocation,
  uploadPhoto,
} from './services/supabase-locations';
import { downsizeImage } from './utils/downsizeImage';
import { hasExceededLimit, recordSubmission } from './utils/rateLimit';
import './App.css';

function App() {
  const { locations, resources, loading, error, refetchUserLocations } = useDataLoader();
  const { scoredLocations, priorities, setPriorities } = useScoring(locations, resources);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Add/Edit mode state
  const [addMode, setAddMode] = useState(false);
  const [addCoords, setAddCoords] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);

  // Auth state
  const { user, isAdmin, loading: authLoading, signIn, signOut } = useAuth();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSuggestionSuccess, setShowSuggestionSuccess] = useState(false);

  // Control panel state
  const [openPanel, setOpenPanel] = useState(null); // 'layers' | 'priorities' | null

  // Layer visibility
  const [visibleTypes, setVisibleTypes] = useState({
    church: true,
    community_center: true,
    vacant_building: true,
    public_facility: true,
    nonprofit: true,
    user: true,
  });

  function handleToggleType(key) {
    setVisibleTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Filter locations by visible types
  const filteredLocations = scoredLocations.filter((loc) => {
    if (loc.source === 'user') return visibleTypes.user !== false;
    return visibleTypes[loc.type] !== false;
  });

  useEffect(() => {
    if (!loading && locations.length > 0) {
      console.log(`Loaded ${locations.length} locations, ${resources.length} resources`);
    }
  }, [loading, locations, resources]);

  // Map click handler
  function handleMapClick(latlng) {
    if (latlng) {
      setAddCoords({ lat: latlng.lat, lng: latlng.lng });
      setSelectedLocation(null);
    } else {
      setSelectedLocation(null);
    }
  }

  async function handleSaveNew(data) {
    try {
      if (isAdmin) {
        const row = {
          name: data.name,
          type: data.type,
          lat: data.lat,
          lng: data.lng,
          address: data.address || '',
          notes: data.notes || '',
          contact_name: data.contact_name || '',
          contact_phone: data.contact_phone || '',
          contact_email: data.contact_email || '',
          contact_website: data.contact_website || '',
        };
        const result = await addLocation(row);
        const newId = result?.[0]?.id;
        if (data.photo && newId) {
          const photoUrl = await uploadPhoto(newId, data.photo, 'approved');
          await updateLocation(newId, { photo_url: photoUrl });
        }
        await refetchUserLocations();
        setAddCoords(null);
        setAddMode(false);
        return;
      }

      // Public path: suggestion
      if (hasExceededLimit()) {
        alert('You have submitted several suggestions recently. Please try again later.');
        return;
      }

      // Upload photo BEFORE the row insert (RLS forbids public UPDATE, so we can't
      // attach photo_url after the row exists — must include it in the INSERT payload).
      let photoUrl = null;
      if (data.photo) {
        try {
          const compressed = await downsizeImage(data.photo);
          const compressedFile = new File(
            [compressed],
            data.photo.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' }
          );
          const tempId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
          photoUrl = await uploadPhoto(tempId, compressedFile, 'pending');
        } catch (err) {
          console.warn('Photo upload failed (continuing without photo):', err);
        }
      }

      const payload = {
        name: data.name,
        type: data.type,
        lat: data.lat,
        lng: data.lng,
        address: data.address || '',
        notes: data.notes || '',
        contact_name: data.contact_name || '',
        contact_phone: data.contact_phone || '',
        contact_email: data.contact_email || '',
        contact_website: data.contact_website || '',
        submitter_name: data.submitter_name,
        submitter_phone: data.submitter_phone,
        submitter_email: data.submitter_email,
        suggestion_mode: data.suggestion_mode,
        photo_url: photoUrl,
      };
      await addSuggestion(payload);
      recordSubmission();
      setAddCoords(null);
      setAddMode(false);
      setShowSuggestionSuccess(true);
    } catch (err) {
      console.error('Failed to save location:', err);
      alert('Could not save. Please try again.');
    }
  }

  async function handleUpdate(data) {
    if (!editingLocation) return;
    try {
      const supabaseId = editingLocation.supabaseId;
      const updates = {
        name: data.name,
        type: data.type,
        address: data.address || '',
        notes: data.notes || '',
        contact_name: data.contact_name || '',
        contact_phone: data.contact_phone || '',
        contact_email: data.contact_email || '',
        contact_website: data.contact_website || '',
      };
      if (data.photo) {
        const photoUrl = await uploadPhoto(supabaseId, data.photo);
        updates.photo_url = photoUrl;
      }
      await updateLocation(supabaseId, updates);
      await refetchUserLocations();
      setEditingLocation(null);
      setSelectedLocation(null);
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  }

  async function handleDelete(loc) {
    const confirmed = window.confirm(`Delete "${loc.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteLocation(loc.supabaseId);
      await refetchUserLocations();
      setSelectedLocation(null);
    } catch (err) {
      console.error('Failed to delete location:', err);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="app loading-screen">
        <div className="loading-spinner" />
        <h1>SHARE Shelter Map</h1>
        <p>Loading Seattle data...</p>
      </div>
    );
  }

  const showSidebar = selectedLocation && !editingLocation && !addCoords;
  const showAddForm = addCoords && !editingLocation;
  const showEditForm = !!editingLocation;

  return (
    <div className="app">
      <MapView
        scoredLocations={filteredLocations}
        onPinClick={(loc) => { setSelectedLocation(loc); setAddCoords(null); setEditingLocation(null); setOpenPanel(null); }}
        selectedLocation={selectedLocation}
        resources={resources}
        onMapClick={handleMapClick}
        addMode={addMode}
        addCoords={addCoords}
      />

      {/* ─── Top-left control bar ─── */}
      <div className="map-controls">
        <button
          className="map-ctrl-btn"
          onClick={() => setOpenPanel(openPanel === 'layers' ? null : 'layers')}
          style={openPanel === 'layers' ? { background: 'var(--panel-bg-raised)', color: 'var(--text-primary)' } : undefined}
        >
          <span>🗂️</span> Layers
        </button>
        <button
          className="map-ctrl-btn"
          onClick={() => setOpenPanel(openPanel === 'priorities' ? null : 'priorities')}
          style={openPanel === 'priorities' ? { background: 'var(--panel-bg-raised)', color: 'var(--text-primary)' } : undefined}
        >
          <span>⚙️</span> Priorities
        </button>
      </div>

      {openPanel === 'layers' && (
        <LayerPanel
          visibleTypes={visibleTypes}
          onToggle={handleToggleType}
          onClose={() => setOpenPanel(null)}
        />
      )}

      {openPanel === 'priorities' && (
        <PriorityPanel
          priorities={priorities}
          onUpdate={setPriorities}
          onClose={() => setOpenPanel(null)}
        />
      )}

      {/* ─── Top-right add button ─── */}
      <button
        className={`add-location-toggle ${addMode ? 'active' : ''}`}
        onClick={() => {
          if (addMode) {
            setAddMode(false);
            setAddCoords(null);
          } else {
            setAddMode(true);
            setSelectedLocation(null);
            setEditingLocation(null);
            setOpenPanel(null);
          }
        }}
      >
        {addMode ? '✕ Cancel' : isAdmin ? '+ Add Location' : '+ Suggest a Location'}
      </button>

      {/* ─── Right panels ─── */}
      {showSidebar && (
        <Sidebar
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onEdit={selectedLocation.source === 'user' ? () => setEditingLocation(selectedLocation) : undefined}
          onDelete={selectedLocation.source === 'user' ? () => handleDelete(selectedLocation) : undefined}
        />
      )}

      {showAddForm && (
        <AddLocationForm
          lat={addCoords.lat}
          lng={addCoords.lng}
          isAdmin={isAdmin}
          onSave={handleSaveNew}
          onCancel={() => { setAddCoords(null); setAddMode(false); }}
        />
      )}

      {showEditForm && (
        <AddLocationForm
          lat={editingLocation.lat}
          lng={editingLocation.lng}
          initialData={editingLocation}
          isAdmin={isAdmin}
          onSave={handleUpdate}
          onCancel={() => setEditingLocation(null)}
        />
      )}

      <SignInButton
        user={user}
        onSignInClick={() => setShowSignInModal(true)}
        onSignOutClick={signOut}
      />

      {showSuggestionSuccess && (
        <div className="signin-overlay" role="dialog" aria-modal="true">
          <div className="signin-modal">
            <h3>Thanks!</h3>
            <p>Your suggestion has been sent. SHARE will review it and reach out by email.</p>
            <div className="form-actions">
              <button
                type="button"
                className="signin-submit-btn"
                onClick={() => setShowSuggestionSuccess(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignInModal && (
        <SignInModal
          open={true}
          onSubmit={async (email, password) => {
            const result = await signIn(email, password);
            if (!result.error) setShowSignInModal(false);
            return result;
          }}
          onClose={() => setShowSignInModal(false)}
        />
      )}
    </div>
  );
}

export default App;
