import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import useDataLoader from './hooks/useDataLoader';
import { useScoring } from './hooks/useScoring';
import './App.css';

function App() {
  const { locations, resources, loading, error } = useDataLoader();
  const { scoredLocations, priorities, setPriorities } = useScoring(locations, resources);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    if (!loading) {
      console.log(`Loaded ${locations.length} locations, ${resources.length} resources`);
      console.log('Locations:', locations);
      console.log('Resources:', resources);
      if (error) console.error('Data load error:', error);
    }
  }, [loading, locations, resources, error]);

  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading Seattle data...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <MapView
        scoredLocations={scoredLocations}
        onPinClick={setSelectedLocation}
        selectedLocation={selectedLocation}
        resources={resources}
        onMapClick={() => setSelectedLocation(null)}
      />
    </div>
  );
}

export default App;
