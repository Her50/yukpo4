import React, { useState } from 'react';

const GPSTestComponent: React.FC = () => {
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
        
        // Envoyer au backend avec token
        updateBackendGPS(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
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

  const updateBackendGPS = async (latitude: number, longitude: number, accuracy?: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ Pas de token, impossible de mettre à jour le backend');
        setError('Pas de token d\'authentification');
        return;
      }

      console.log('🔐 Envoi position GPS avec token:', token.substring(0, 20) + '...');

      const response = await fetch('/api/user/me/gps_location', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy: accuracy || 10,
        }),
      });

      if (response.ok) {
        console.log('✅ Position GPS mise à jour dans le backend');
        setError('');
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Erreur backend:', response.status, errorText);
        setError(`Erreur backend: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Erreur réseau:', error);
      setError('Erreur réseau');
    }
  };

  return (
    <View style="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 max-w-sm z-50">
      <h3 style="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        📍 Test GPS Simple
      </h3>
      
      <View style="space-y-2 text-xs mb-3">
        {location && (
          <View>
            <Text style="text-gray-600 dark:text-gray-400">Position:</Text>
            <Text style="ml-2 font-mono text-gray-900 dark:text-white">
              {location}
            </Text>
          </View>
        )}
        
        {error && (
          <View style="text-red-500">
            ❌ {error}
          </View>
        )}
      </View>
      
      <TouchableOpacity
        onClick={getLocation}
        style="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
      >
        Obtenir ma position
      </TouchableOpacity>
    </View>
  );
};

export default GPSTestComponent; 
