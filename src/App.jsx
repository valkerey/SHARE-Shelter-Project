import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import ControlSidebar from './components/ControlSidebar';
import Sidebar from './components/Sidebar';
import AddLocationForm from './components/AddLocationForm';
import DataSourceStatus from './components/DataSourceStatus';
import useDataLoader from './hooks/useDataLoader';
import { useScoring } from './hooks/useScoring';
import {
  addLocation,
  updateLocation,
  deleteLocation,
  uploadPhoto,
} from './services/supabase-locations';
import './App.css';

function App() {
  const { locations, resources, loading, error, sources, refetchUserLocations } = useDataLoader();
  const { scoredLocations, priorities, setPriorities } = useScoring(locations, resources);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Add/Edit mode state
  const [addMode, setAddMode] = useState(false);
  const [addCoords, setAddCoords] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);

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

  // Re-resolve the selected location against the freshly scored list so the
  // sidebar reflects the latest priority changes (not the snapshot taken at click time).
  const sidebarLocation = selectedLocation
    ? scoredLocations.find((l) => l.id === selectedLocation.id) || selectedLocation
    : null;

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
        const photoUrl = await uploadPhoto(newId, data.photo);
        await updateLocation(newId, { photo_url: photoUrl });
      }
      await refetchUserLocations();
      setAddCoords(null);
      setAddMode(false);
    } catch (err) {
      console.error('Failed to save location:', err);
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

  if (loading) {
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
        onPinClick={(loc) => { setSelectedLocation(loc); setAddCoords(null); setEditingLocation(null); }}
        selectedLocation={selectedLocation}
        resources={resources}
        onMapClick={handleMapClick}
        addMode={addMode}
        addCoords={addCoords}
      />

      <ControlSidebar
        visibleTypes={visibleTypes}
        onToggleType={handleToggleType}
        priorities={priorities}
        onUpdatePriorities={setPriorities}
      />

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
          }
        }}
      >
        {addMode ? '✕ Cancel' : '+ Add Location'}
      </button>

      {/* ─── Right panels ─── */}
      {showSidebar && (
        <Sidebar
          location={sidebarLocation}
          onClose={() => setSelectedLocation(null)}
          onEdit={sidebarLocation.source === 'user' ? () => setEditingLocation(sidebarLocation) : undefined}
          onDelete={sidebarLocation.source === 'user' ? () => handleDelete(sidebarLocation) : undefined}
        />
      )}

      {showAddForm && (
        <AddLocationForm
          lat={addCoords.lat}
          lng={addCoords.lng}
          onSave={handleSaveNew}
          onCancel={() => { setAddCoords(null); setAddMode(false); }}
        />
      )}

      {showEditForm && (
        <AddLocationForm
          lat={editingLocation.lat}
          lng={editingLocation.lng}
          initialData={editingLocation}
          onSave={handleUpdate}
          onCancel={() => setEditingLocation(null)}
        />
      )}

      <DataSourceStatus sources={sources} />
    </div>
  );
}

export default App;
