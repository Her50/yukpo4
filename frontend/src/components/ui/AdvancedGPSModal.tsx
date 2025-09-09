import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useJsApiLoader, GoogleMap, Marker, DrawingManager } from '@react-google-maps/api';
import { Crosshair, Search, X, MapPin, Navigation, Globe, Layers, Settings, Brain, Zap } from 'lucide-react';
import { useOptimizedApi } from '@/hooks/useOptimizedApi';

// Définir les libraries en dehors du composant pour éviter les rechargements
const GOOGLE_MAPS_LIBRARIES: ("drawing" | "places" | "geometry")[] = ['drawing', 'places', 'geometry'];

const containerStyle = {
  width: '100%',
  height: '500px'
};

const center = {
  lat: 4.05, // Coordonnées approximatives du Cameroun
  lng: 9.7
};

interface AdvancedGPSModalProps {
  onClose: () => void;
  onSelect: (path: { lat: number; lng: number }[], previewUrl: string, metadata: any) => void;
  initialLocation?: { lat: number; lng: number };
}

interface LocationMetadata {
  address: string;
  city: string;
  country: string;
  postalCode: string;
  neighborhood: string;
  poi?: string; // Point of Interest
  confidence: number;
  aiSuggestions: string[];
  securityScore: number;
  accessibilityInfo: string[];
  businessOpportunities: string[];
  demographicData: any;
  trafficPatterns: string[];
  environmentalFactors: string[];
}

const AdvancedGPSModal: React.FC<AdvancedGPSModalProps> = ({
  onClose,
  onSelect,
  initialLocation
}) => {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [drawingManager, setDrawingManager] = useState<google.maps.drawing.DrawingManager | null>(null);
  const [selectedPath, setSelectedPath] = useState<{ lat: number; lng: number }[] | null>(null);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const [searchInputRef] = useState(useRef<HTMLInputElement>(null));
  const [mapRef] = useState(useRef<HTMLDivElement>(null));
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(initialLocation || null);
  const [locationMetadata, setLocationMetadata] = useState<LocationMetadata | null>(null);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState<'default' | 'satellite' | 'terrain'>('default');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Hook IA pour l'analyse de localisation
  const { execute: analyzeLocation, loading: isAnalyzing } = useOptimizedApi({
    url: '/api/ia/analyze-location',
    method: 'POST',
    cache: { enabled: true, ttl: 300000 } // 5 minutes
  });

  const apiKey = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // 🧠 Analyse IA de la localisation
  const analyzeLocationWithAI = useCallback(async (lat: number, lng: number) => {
    try {
      const result = await analyzeLocation({
        data: {
          latitude: lat,
          longitude: lng,
          context: 'location_analysis'
        }
      });

      if (result) {
        setAiAnalysis(result);
        setShowAIInsights(true);
      }
    } catch (error) {
      console.warn('Erreur analyse IA localisation:', error);
    }
  }, [analyzeLocation]);

  // 🗺️ Styles de carte personnalisés
  const mapStyles = {
    default: [],
    satellite: [
      {
        featureType: 'all',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#ffffff' }]
      },
      {
        featureType: 'all',
        elementType: 'labels.text.stroke',
        stylers: [{ color: '#000000' }, { lightness: 13 }]
      }
    ],
    terrain: [
      {
        featureType: 'landscape',
        elementType: 'geometry',
        stylers: [{ color: '#f5f5f2' }]
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#c9c9c9' }]
      }
    ]
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map);

    // Initialiser le gestionnaire de dessin
    const drawingManagerInstance = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.MARKER,
          google.maps.drawing.OverlayType.POLYGON,
          google.maps.drawing.OverlayType.CIRCLE
        ],
      },
    });

    drawingManagerInstance.setMap(map);
    setDrawingManager(drawingManagerInstance);

    // Écouter les événements de dessin
    google.maps.event.addListener(drawingManagerInstance, 'polygoncomplete', (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      const coordinates: { lat: number; lng: number }[] = [];
      
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coordinates.push({ lat: point.lat(), lng: point.lng() });
      }
      
      setSelectedPath(coordinates);
      
      // Analyser avec IA
      if (coordinates.length > 0) {
        const center = coordinates[Math.floor(coordinates.length / 2)];
        analyzeLocationWithAI(center.lat, center.lng);
      }
    });

    // Centrer sur la localisation initiale
    if (initialLocation) {
      map.setCenter(initialLocation);
      map.setZoom(15);
      setCurrentLocation(initialLocation);
      analyzeLocationWithAI(initialLocation.lat, initialLocation.lng);
    }
  }, [initialLocation, analyzeLocationWithAI]);

  const onSearchBoxLoad = useCallback((ref: google.maps.places.SearchBox) => {
    setSearchBox(ref);
  }, []);

  const onPlacesChanged = useCallback(() => {
    if (searchBox) {
      const places = searchBox.getPlaces();
      if (places && places.length > 0 && places[0].geometry) {
        const { location } = places[0].geometry;
        if (location && mapInstance) {
          const newCenter = { lat: location.lat(), lng: location.lng() };
          mapInstance.setCenter(newCenter);
          mapInstance.setZoom(15);
          setCurrentLocation(newCenter);
          setSelectedPath([newCenter]);
          
          // Analyser avec IA
          analyzeLocationWithAI(newCenter.lat, newCenter.lng);
        }
      }
    }
  }, [searchBox, mapInstance, analyzeLocationWithAI]);

  const handleGoToCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          if (mapInstance) {
            mapInstance.setCenter(newCenter);
            mapInstance.setZoom(15);
            setCurrentLocation(newCenter);
            setSelectedPath([newCenter]);
            
            // Analyser avec IA
            analyzeLocationWithAI(newCenter.lat, newCenter.lng);
          }
        },
        (error) => {
          console.error("Erreur de géolocalisation:", error);
          alert("Impossible d'accéder à votre position. Veuillez vérifier les autorisations de votre navigateur.");
        }
      );
    } else {
      alert("La géolocalisation n'est pas supportée par ce navigateur.");
    }
  }, [mapInstance, analyzeLocationWithAI]);

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const clickedLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };
      setCurrentLocation(clickedLocation);
      setSelectedPath([clickedLocation]);
      
      // Analyser avec IA
      analyzeLocationWithAI(clickedLocation.lat, clickedLocation.lng);
    }
  }, [analyzeLocationWithAI]);

  const handleConfirm = useCallback(() => {
    if (selectedPath && currentLocation) {
      // Générer une URL de prévisualisation
      const previewUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${currentLocation.lat},${currentLocation.lng}&zoom=15&size=400x300&markers=color:red%7C${currentLocation.lat},${currentLocation.lng}&key=${apiKey}`;
      
      onSelect(selectedPath, previewUrl, {
        location: currentLocation,
        metadata: locationMetadata,
        aiAnalysis,
        timestamp: new Date().toISOString()
      });
      onClose();
    }
  }, [selectedPath, currentLocation, locationMetadata, aiAnalysis, onSelect, onClose, apiKey]);

  const handleMapStyleChange = useCallback((style: 'default' | 'satellite' | 'terrain') => {
    setMapStyle(style);
    if (mapInstance) {
      mapInstance.setOptions({
        styles: mapStyles[style]
      });
    }
  }, [mapInstance, mapStyles]);

  if (loadError) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
          <h2 className="text-lg font-bold mb-4 text-red-600">Erreur de chargement</h2>
          <p className="text-sm text-gray-600 mb-4">
            Impossible de charger Google Maps. Vérifiez votre connexion internet et votre clé API.
          </p>
          <button onClick={onClose} className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 🧠 En-tête avec IA */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold">Sélecteur GPS Avancé</h2>
            </div>
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Brain className="w-4 h-4 animate-pulse" />
                <span>Analyse IA...</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-gray-600 hover:text-red-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ⚙️ Options avancées */}
        {showAdvancedOptions && (
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Style de carte
                </label>
                <select
                  value={mapStyle}
                  onChange={(e) => handleMapStyleChange(e.target.value as any)}
                  className="w-full text-xs p-2 border rounded"
                >
                  <option value="default">Standard</option>
                  <option value="satellite">Satellite</option>
                  <option value="terrain">Terrain</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Précision GPS
                </label>
                <select className="w-full text-xs p-2 border rounded">
                  <option value="high">Haute (±5m)</option>
                  <option value="medium">Moyenne (±10m)</option>
                  <option value="low">Basse (±50m)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Mode IA
                </label>
                <select className="w-full text-xs p-2 border rounded">
                  <option value="auto">Auto</option>
                  <option value="conservative">Conservateur</option>
                  <option value="aggressive">Agressif</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 h-[500px]">
          {/* 🗺️ Carte principale */}
          <div className="flex-1 relative">
            {/* Barre de recherche */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 w-3/4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher un lieu, adresse, POI..."
                  className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Contrôles de carte */}
            <div className="absolute top-16 right-2 z-10 flex flex-col gap-2">
              <button
                onClick={handleGoToCurrentLocation}
                className="p-2 bg-white rounded-md shadow-md hover:bg-gray-50 transition-colors"
                title="Ma position actuelle"
              >
                <Crosshair className="w-4 h-4 text-blue-600" />
              </button>
              <button
                onClick={() => handleMapStyleChange('satellite')}
                className="p-2 bg-white rounded-md shadow-md hover:bg-gray-50 transition-colors"
                title="Vue satellite"
              >
                <Globe className="w-4 h-4 text-green-600" />
              </button>
              <button
                onClick={() => handleMapStyleChange('terrain')}
                className="p-2 bg-white rounded-md shadow-md hover:bg-gray-50 transition-colors"
                title="Vue terrain"
              >
                <Layers className="w-4 h-4 text-orange-600" />
              </button>
            </div>

            <div ref={mapRef} style={containerStyle} />
          </div>

          {/* 📊 Panneau d'informations */}
          <div className="w-80 bg-gray-50 rounded-lg p-4 overflow-y-auto">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              Informations de localisation
            </h3>

            {currentLocation && (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded border">
                  <h4 className="text-sm font-medium mb-2">Coordonnées GPS</h4>
                  <div className="text-xs space-y-1">
                    <div>Latitude: {currentLocation.lat.toFixed(6)}</div>
                    <div>Longitude: {currentLocation.lng.toFixed(6)}</div>
                  </div>
                </div>

                {/* 🧠 Analyse IA */}
                {aiAnalysis && showAIInsights && (
                  <div className="bg-blue-50 p-3 rounded border">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Analyse IA
                    </h4>
                    <div className="text-xs space-y-2">
                      {aiAnalysis.suggestions && (
                        <div>
                          <div className="font-medium text-blue-800">Suggestions:</div>
                          <ul className="list-disc list-inside text-blue-700">
                            {aiAnalysis.suggestions.slice(0, 3).map((suggestion: string, index: number) => (
                              <li key={index}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiAnalysis.confidence && (
                        <div>
                          <div className="font-medium text-blue-800">Confiance:</div>
                          <div className="text-blue-700">{Math.round(aiAnalysis.confidence * 100)}%</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 📍 Métadonnées de localisation */}
                {locationMetadata && (
                  <div className="bg-green-50 p-3 rounded border">
                    <h4 className="text-sm font-medium mb-2">Adresse</h4>
                    <div className="text-xs space-y-1 text-green-800">
                      <div>{locationMetadata.address}</div>
                      <div>{locationMetadata.city}, {locationMetadata.country}</div>
                      {locationMetadata.postalCode && <div>Code postal: {locationMetadata.postalCode}</div>}
                      {locationMetadata.neighborhood && <div>Quartier: {locationMetadata.neighborhood}</div>}
                      {locationMetadata.poi && <div>POI: {locationMetadata.poi}</div>}
                    </div>
                  </div>
                )}

                {/* 🎯 Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowAIInsights(!showAIInsights)}
                    className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Brain className="w-4 h-4" />
                    {showAIInsights ? 'Masquer IA' : 'Afficher IA'}
                  </button>
                  
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedPath}
                    className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Confirmer la sélection
                  </button>
                </div>
              </div>
            )}

            {!currentLocation && (
              <div className="text-center text-gray-500 py-8">
                <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Cliquez sur la carte ou recherchez un lieu pour commencer</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedGPSModal; 