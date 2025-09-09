import React, { useState } from 'react';

const SimpleGPSTest: React.FC = () => {
  const [location, setLocation] = useState<string>('');
  const [error, setError] = useState<string>('');

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée');
      return;
    }

    setError('');
    setLocation('Récupération...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
        setLocation(coords);
        console.log('📍 Position GPS:', coords);
      },
      (error) => {
        setError(`Erreur: ${error.message}`);
        setLocation('');
        console.error('❌ Erreur GPS:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 max-w-sm z-50">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        📍 Test GPS Simple
      </h3>
      
      <div className="space-y-2 text-xs mb-3">
        {location && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Position:</span>
            <span className="ml-2 font-mono text-gray-900 dark:text-white">
              {location}
            </span>
          </div>
        )}
        
        {error && (
          <div className="text-red-500">
            ❌ {error}
          </div>
        )}
      </div>
      
      <button
        onClick={getLocation}
        className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
      >
        Obtenir ma position
      </button>
    </div>
  );
};

export default SimpleGPSTest; 