import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Crosshair, Search, X, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

// Définir les libraries en dehors du composant pour éviter les rechargements
const GOOGLE_MAPS_LIBRARIES: ("drawing" | "places")[] = ['drawing', 'places'];

const containerStyle = {
  width: '100%',
  height: '400px'
};

const center = {
  lat: 4.05, // Coordonnées approximatives du Cameroun
  lng: 9.7
};

interface MapModalProps {
  onClose: () => void;
  onSelect: (coords: string) => void;
}

const MapModal: React.FC<MapModalProps> = ({ onClose, onSelect }) => {
  const [selectedPath, setSelectedPath] = useState<{ lat: number; lng: number }[] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCoordinates, setShowCoordinates] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const onPolygonComplete = useCallback((polygon: google.maps.Polygon) => {
    console.log('[MapModal] Polygon completé!', polygon);
    const path = polygon.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
    console.log('[MapModal] Points du polygone:', path);
    setSelectedPath(path);
    setShowCoordinates(true);
    setIsDrawing(false);
    polygon.setMap(null); // Hide the drawn polygon, we'll show our own
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
  }, []);

  const handleConfirm = () => {
    if (selectedPath) {
      if (selectedPath.length === 1) {
        // Point marker - format: "lat,lng"
        const { lat, lng } = selectedPath[0];
        const coordsString = `${lat},${lng}`;
        console.log('[MapModal] Coordonnées sélectionnées (point):', coordsString);
        onSelect(coordsString);
        onClose();
      } else if (selectedPath.length > 1) {
        // Polygon path - format: "lat1,lng1|lat2,lng2|..."
        const coordsString = selectedPath.map(p => `${p.lat},${p.lng}`).join('|');
        console.log('[MapModal] Coordonnées sélectionnées (zone):', coordsString);
        onSelect(coordsString);
        onClose();
      }
    }
  };

  const handleClear = () => {
    setSelectedPath(null);
    setShowCoordinates(false);
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    }
  };

  const handleGoToCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          if (mapInstance.current) {
            mapInstance.current.setCenter(newCenter);
            mapInstance.current.setZoom(15); // Zoom in closer for current location
            setSelectedPath([newCenter]); // Select the current location
            setShowCoordinates(true);
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
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && searchBoxRef.current) {
      // Trigger search
      const event = new Event('input', { bubbles: true });
      searchInputRef.current?.dispatchEvent(event);
    }
  };

  const apiKey = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY;
  console.log('[DEBUG] Clé Google Maps lue depuis .env :', apiKey);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  console.log('[MapModal] Bibliothèques chargées:', GOOGLE_MAPS_LIBRARIES);
  console.log('[MapModal] isLoaded:', isLoaded);
  console.log('[MapModal] loadError:', loadError);

  const handlePlacesChanged = useCallback(() => {
    const places = searchBoxRef.current?.getPlaces();
    if (places && places.length > 0 && places[0].geometry) {
      const { location } = places[0].geometry;
      if (location) {
        const newCenter = { lat: location.lat(), lng: location.lng() };
        mapInstance.current?.setCenter(newCenter);
        mapInstance.current?.setZoom(15);
        setSelectedPath([newCenter]);
        setShowCoordinates(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isLoaded && mapRef.current && !mapInstance.current) {
      // Create Map instance
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 10,
        mapTypeId: 'hybrid', // Modern style with satellite and labels
        mapTypeControl: false, // Hide the map type selector
        streetViewControl: false,
        gestureHandling: 'greedy', // Allow scrolling without holding Ctrl
        zoomControl: true,
        clickableIcons: true, // Make map icons clickable
      });

      // Add click listener for easy point selection
      if (mapInstance.current) {
        mapInstance.current.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            const clickedPoint = {
              lat: event.latLng.lat(),
              lng: event.latLng.lng()
            };
            setSelectedPath([clickedPoint]);
            setShowCoordinates(true);
            
            // Show a temporary marker to indicate selection
            if (markerRef.current) {
              markerRef.current.setMap(null);
            }
            markerRef.current = new window.google.maps.Marker({
              position: clickedPoint,
              map: mapInstance.current,
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="12" fill="#2196F3" stroke="white" stroke-width="2"/>
                    <circle cx="16" cy="16" r="4" fill="white"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32),
                anchor: new window.google.maps.Point(16, 16)
              }
            });
          }
        });
      }

      // Create SearchBox
      if (searchInputRef.current) {
        searchBoxRef.current = new window.google.maps.places.SearchBox(searchInputRef.current);
        // Bias the SearchBox results towards current map's viewport.
        if (mapInstance.current) {
          mapInstance.current.addListener('bounds_changed', () => {
            const bounds = mapInstance.current?.getBounds();
            if (bounds) {
              searchBoxRef.current?.setBounds(bounds);
            }
          });
        }
        if (searchBoxRef.current) {
          searchBoxRef.current.addListener('places_changed', handlePlacesChanged);
        }
      }

      // Create DrawingManager
      console.log('[MapModal] Création du DrawingManager...');
      const drawingManager = new window.google.maps.drawing.DrawingManager({
        drawingControl: true,
        drawingControlOptions: {
          position: window.google.maps.ControlPosition.TOP_CENTER, // Centré en haut pour éviter les conflits
          drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
        },
        polygonOptions: {
          fillColor: '#10B981', // Couleur verte cohérente avec le design
          fillOpacity: 0.5,
          strokeWeight: 2,
          clickable: false,
          editable: true,
          zIndex: 1,
        },
      });
      console.log('[MapModal] DrawingManager créé:', drawingManager);
      drawingManager.setMap(mapInstance.current);
      drawingManager.addListener('polygoncomplete', onPolygonComplete);
      console.log('[MapModal] Listener polygoncomplete ajouté');
      drawingManagerRef.current = drawingManager;
      console.log('[MapModal] DrawingManager configuré et assigné');
    }
  }, [isLoaded, onPolygonComplete, handlePlacesChanged]);

  useEffect(() => {
    // Manage the displayed polygon or marker
    if (mapInstance.current) {
      // Clear existing polygon
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      // Clear existing marker
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      if (selectedPath) {
        if (selectedPath.length === 1) {
          // If it's a single point, show a marker
          markerRef.current = new window.google.maps.Marker({
            position: selectedPath[0],
            map: mapInstance.current,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="12" fill="#10B981" stroke="white" stroke-width="2"/>
                  <circle cx="16" cy="16" r="4" fill="white"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(32, 32),
              anchor: new window.google.maps.Point(16, 16)
            }
          });
        } else if (selectedPath.length > 1) {
          // If it's a polygon, draw it
          polygonRef.current = new window.google.maps.Polygon({
            paths: selectedPath,
            fillColor: '#10B981',
            fillOpacity: 0.5,
            strokeWeight: 2,
            clickable: false,
            editable: true,
            zIndex: 1,
          });
          if (polygonRef.current) {
            polygonRef.current.setMap(mapInstance.current);
          }
        }
      }
    }
  }, [selectedPath]);

  if (!apiKey || apiKey === "your_google_maps_api_key_here") {
      console.error("Clé API Google Maps manquante ou incorrecte. Veuillez la configurer dans frontend/.env sous VITE_APP_GOOGLE_MAPS_API_KEY.");
      // Afficher un message à l'utilisateur dans le modal
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999]">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
                <h2 className="text-lg font-bold mb-4 text-red-600">⚠️ Configuration requise</h2>
                <p className="text-gray-700 mb-3">La fonctionnalité de carte est désactivée car la clé API Google Maps n'a pas été configurée ou est incorrecte.</p>
                <p className="text-sm text-gray-600 mb-3">Veuillez ajouter votre clé dans le fichier <code className="bg-gray-100 px-1 rounded">.env</code> à la racine du dossier <code className="bg-gray-100 px-1 rounded">frontend/</code> sous la variable <code className="bg-gray-100 px-1 rounded">VITE_APP_GOOGLE_MAPS_API_KEY</code>.</p>
                <p className="text-sm text-gray-600 mb-4">Clé actuellement lue : <code className="bg-gray-100 px-1 rounded">{String(apiKey)}</code></p>
                <button onClick={onClose} className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors">Fermer</button>
            </div>
        </div>
      )
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999]">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
          <h2 className="text-lg font-bold mb-4 text-red-600">❌ Erreur de chargement</h2>
          <p className="text-gray-700 mb-4">Impossible de charger Google Maps. Veuillez vérifier votre connexion Internet et votre clé API.</p>
          <button onClick={onClose} className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors">Fermer</button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999]">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <h2 className="text-lg font-bold mb-2 text-blue-600">🗺️ Chargement de la carte...</h2>
          <p className="text-gray-600 text-center">Initialisation de Google Maps en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999]">
      <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-green-600" />
            🗺️ Sélection de localisation GPS
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[70vh]">
          {/* Panneau de gauche - Instructions et contrôles */}
          <div className="lg:col-span-1 space-y-4 overflow-y-auto">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                📋 Instructions
              </h3>
              <ul className="text-sm text-blue-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Cliquez</strong> sur la carte pour sélectionner un point</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Dessinez</strong> une zone avec l'outil polygone (icône crayon)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Recherchez</strong> une adresse dans la barre de recherche</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Utilisez</strong> "Ma Position" pour votre GPS actuel</span>
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={handleGoToCurrentLocation}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors shadow-md hover:shadow-lg"
              >
                <Crosshair size={18} />
                📍 Ma Position GPS
              </button>
              
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Rechercher une adresse..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                >
                  OK
                </button>
              </form>
            </div>
            
            {/* Affichage des coordonnées sélectionnées - TOUJOURS VISIBLE */}
            <div className={`bg-gray-50 p-4 rounded-lg border transition-all duration-300 ${
              selectedPath ? 'border-green-300 bg-green-50' : 'border-gray-200'
            }`}>
              <h3 className={`font-semibold mb-2 flex items-center gap-2 ${
                selectedPath ? 'text-green-800' : 'text-gray-600'
              }`}>
                {selectedPath ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    ✅ Coordonnées sélectionnées
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-gray-500" />
                    📍 Aucune position sélectionnée
                  </>
                )}
              </h3>
              
              {selectedPath ? (
                <div className="text-sm space-y-2">
                  {selectedPath.length === 1 ? (
                    <div>
                      <div className="font-medium text-green-700 mb-2">📍 Point unique :</div>
                      <div className="bg-white p-3 rounded border-2 border-green-200 font-mono text-xs bg-green-50">
                        <div className="font-semibold text-green-800">Latitude:</div>
                        <div className="text-green-700">{selectedPath[0].lat.toFixed(6)}</div>
                        <div className="font-semibold text-green-800 mt-2">Longitude:</div>
                        <div className="text-green-700">{selectedPath[0].lng.toFixed(6)}</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-green-700 mb-2">🎯 Zone avec {selectedPath.length} points :</div>
                      <div className="bg-white p-3 rounded border-2 border-green-200 max-h-32 overflow-y-auto bg-green-50">
                        {selectedPath.map((point, index) => (
                          <div key={index} className="font-mono text-xs mb-2 p-2 bg-white rounded border">
                            <div className="font-semibold text-green-800">Point {index + 1}:</div>
                            <div className="text-green-700">Lat: {point.lat.toFixed(6)}</div>
                            <div className="text-green-700">Lng: {point.lng.toFixed(6)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600 bg-white p-3 rounded border">
                  Cliquez sur la carte ou utilisez la recherche pour sélectionner une position
                </div>
              )}
            </div>
            
            {/* Boutons d'action - TOUJOURS VISIBLES */}
            <div className="flex gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <button 
                onClick={handleClear}
                disabled={!selectedPath}
                className="flex-1 px-4 py-3 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                🗑️ Effacer
              </button>
              <button 
                onClick={handleConfirm} 
                disabled={!selectedPath}
                className="flex-1 px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                <CheckCircle className="w-5 h-5" />
                ✅ Confirmer
              </button>
            </div>
          </div>
          
          {/* Carte - Panneau de droite */}
          <div className="lg:col-span-2 relative">
            <div ref={mapRef} style={{ ...containerStyle, height: '100%' }} className="rounded-lg border-2 border-gray-200 shadow-lg" />
            
            {/* Indicateur de mode de dessin - Déplacé pour éviter le conflit avec les contrôles Google Maps */}
            <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200">
              <div className="text-sm font-medium text-gray-700">
                {selectedPath && selectedPath.length > 1 ? (
                  <span className="text-blue-600 flex items-center gap-2">
                    🎯 Mode: Zone
                  </span>
                ) : (
                  <span className="text-green-600 flex items-center gap-2">
                    📍 Mode: Point
                  </span>
                )}
              </div>
            </div>

            {/* Indicateur de statut de sélection */}
            {selectedPath && (
              <div className="absolute bottom-4 left-4 bg-green-500 text-white p-3 rounded-lg shadow-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {selectedPath.length === 1 ? 'Point sélectionné' : 'Zone sélectionnée'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapModal;
