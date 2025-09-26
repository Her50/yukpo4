import * as React from "react";
import { useState } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';

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
    <View style="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 max-w-sm z-50">
      <Text style="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        📍 Test GPS Simple
      </Text>
      
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
        onPress={getLocation}
        style="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
      >
        Obtenir ma position
      </TouchableOpacity>
    </View>
  );
};

export default SimpleGPSTest; 




