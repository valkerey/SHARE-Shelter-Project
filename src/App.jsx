import { useEffect } from 'react';
import MapView from './components/MapView';
import useDataLoader from './hooks/useDataLoader';
import './App.css';

function App() {
  const { locations, resources, loading, error } = useDataLoader();

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
      <MapView />
    </div>
  );
}

export default App;
