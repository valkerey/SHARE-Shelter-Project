import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import PriorityPanel from './components/PriorityPanel';
import LayerPanel from './components/LayerPanel';
import Sidebar from './components/Sidebar';
import AddLocationForm from './components/AddLocationForm';
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
  const { locations, resources, loading, error, refetchUserLocations } = useDataLoader();
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

  useEffect(() => {
    if (!loading) {
      console.log(`Loaded ${locations.length} locations, ${resources.length} resources`);
      console.log('Locations:', locations);
      console.log('Resources:', resources);
      if (error) console.error('Data load error:', error);
    }
  }, [loading, locations, resources, error]);

  // Map click handler — either place a new pin (add mode) or deselect
  function handleMapClick(latlng) {
    if (latlng) {
      // Add mode click — place pin
      setAddCoords({ lat: latlng.lat, lng: latlng.lng });
      setSelectedLocation(null);
    } else {
      // Normal click — deselect
      setSelectedLocation(null);
    }
  }

  // Save a new user location
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

  // Update an existing user location
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

  // Delete a user location with confirmation
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
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading Seattle data...</p>
      </div>
    );
  }

  // Determine which panel to show on the right
  const showSidebar = selectedLocation && !editingLocation && !addCoords;
  const showAddForm = addCoords && !editingLocation;
  const showEditForm = !!editingLocation;

  return (
    <div className="app">
      <MapView
        scoredLocations={filteredLocations}
        onPinClick={setSelectedLocation}
        selectedLocation={selectedLocation}
        resources={resources}
        onMapClick={handleMapClick}
        addMode={addMode}
        addCoords={addCoords}
      />
      <LayerPanel visibleTypes={visibleTypes} onToggle={handleToggleType} />
      <PriorityPanel priorities={priorities} onUpdate={setPriorities} />

      {/* Add Location toggle button */}
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
        {addMode ? '\u2715 Cancel' : '+ Add Location'}
      </button>

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
          onSave={handleSaveNew}
          onCancel={() => {
            setAddCoords(null);
            setAddMode(false);
          }}
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
    </div>
  );
}

export default App;
