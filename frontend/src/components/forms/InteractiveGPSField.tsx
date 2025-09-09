import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/buttons';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Globe, X } from 'lucide-react';

interface InteractiveGPSFieldProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

const InteractiveGPSField: React.FC<InteractiveGPSFieldProps> = ({
  value,
  onChange,
  label = "Coordonnées GPS",
  placeholder = "Ex: 4.0511, 9.7679",
  required = false
}) => {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [manualInput, setManualInput] = useState(value || '');

  // Fonction pour formater la valeur d'affichage
  const formatDisplayValue = (val: any): string => {
    if (!val) return '';
    
    // Si c'est déjà une chaîne, on la retourne
    if (typeof val === 'string') return val;
    
    // Si c'est un objet avec lat/lon ou lat/lng
    if (typeof val === 'object' && val !== null) {
      if (val.lat !== undefined && val.lon !== undefined) {
        return `${val.lat},${val.lon}`;
      }
      if (val.lat !== undefined && val.lng !== undefined) {
        return `${val.lat},${val.lng}`;
      }
    }
    
    return String(val);
  };

  // Utiliser la valeur formatée
  const displayValue = formatDisplayValue(value);

  useEffect(() => {
    if (value && !manualInput) {
      setManualInput(displayValue);
    }
  }, [value, displayValue, manualInput]);

  // Fonction pour obtenir la position actuelle
  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
          setCurrentLocation(coords);
          setManualInput(coords);
          onChange(coords);
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error('Erreur GPS:', error);
          setIsLoadingLocation(false);
          alert('Impossible d\'obtenir votre position. Veuillez saisir manuellement.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      setIsLoadingLocation(false);
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
    }
  };

  // Fonction pour valider le format GPS
  const validateGPSFormat = (input: string): boolean => {
    if (!input || typeof input !== 'string') return false;
    const gpsRegex = /^-?\d+\.\d+,\s*-?\d+\.\d+$/;
    return gpsRegex.test(input.trim());
  };

  // Fonction pour appliquer les coordonnées
  const applyCoordinates = () => {
    const trimmed = manualInput.trim();
    if (validateGPSFormat(trimmed)) {
      onChange(trimmed);
      setIsMapOpen(false);
    } else {
      alert('Format invalide. Utilisez le format: latitude,longitude (ex: 4.0511, 9.7679)');
    }
  };
  // Fonction pour ouvrir Google Maps
  const openGoogleMaps = () => {
    if (displayValue) {
      const [lat, lng] = displayValue.split(',').map(coord => coord.trim());
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    } else {
      window.open('https://www.google.com/maps', '_blank');
    }
  };

  // Fonction pour ouvrir une carte simple
  const openSimpleMap = () => {
    setIsMapOpen(true);
  };

  // Fonction pour fermer la carte
  const closeMap = () => {
    setIsMapOpen(false);
  };

  // Fonction pour sélectionner un point sur la carte
  const selectPointOnMap = (lat: number, lng: number) => {
    const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    setManualInput(coords);
    setCurrentLocation(coords);
  };

  // Simuler une carte simple (en attendant une vraie intégration)
  const SimpleMap = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Sélection GPS</h3>
          <Button size="icon" variant="ghost" onClick={closeMap}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="bg-gray-100 h-64 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Globe className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">Carte interactive</p>
              <p className="text-xs text-gray-500">Cliquez pour sélectionner un point</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Latitude, Longitude"
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button 
                onClick={applyCoordinates}
                className="flex-1"
                disabled={!validateGPSFormat(manualInput)}
              >
                Appliquer
              </Button>
              <Button 
                onClick={getCurrentLocation}
                variant="outline"
                disabled={isLoadingLocation}
              >
                {isLoadingLocation ? '⏳' : <Navigation className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="space-y-2">        {/* Affichage de la valeur actuelle */}
        {displayValue && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Position actuelle: {displayValue}
              </span>
            </div>
          </div>
        )}
        
        {/* Contrôles GPS */}
        <div className="flex gap-2">
          <Button
            onClick={getCurrentLocation}
            variant="outline"
            disabled={isLoadingLocation}
            className="flex-1"
          >
            {isLoadingLocation ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Localisation...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 mr-2" />
                Ma position
              </>
            )}
          </Button>
          
          <Button
            onClick={openSimpleMap}
            variant="outline"
            className="flex-1"
          >
            <Globe className="w-4 h-4 mr-2" />
            Carte
          </Button>
          
          <Button
            onClick={openGoogleMaps}
            variant="outline"
            className="flex-1"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Google Maps
          </Button>
        </div>
        
        {/* Input manuel */}
        <div className="space-y-2">
          <Input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={placeholder}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={applyCoordinates}
              size="sm"
              disabled={!validateGPSFormat(manualInput)}
              className="flex-1"
            >
              Appliquer les coordonnées
            </Button>            {displayValue && (
              <Button
                onClick={() => {
                  setManualInput('');
                  onChange('');
                }}
                size="sm"
                variant="outline"
              >
                Effacer
              </Button>
            )}
          </div>
        </div>
        
        {/* Aide */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Format: latitude,longitude (ex: 4.0511, 9.7679)
        </p>
      </div>
      
      {/* Modal carte */}
      {isMapOpen && <SimpleMap />}
    </div>
  );
};

export default InteractiveGPSField; 