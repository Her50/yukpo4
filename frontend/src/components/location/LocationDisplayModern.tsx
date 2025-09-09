import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, ExternalLink, Home, User, Globe } from 'lucide-react';
import { Button } from '@/components/ui/buttons/Button';

interface LocationDisplayModernProps {
  service: any;
  serviceCreatorInfo?: any;
  className?: string;
  compact?: boolean;
}

interface LocationData {
  location: string;
  country: string;
  coordinates: { lat: number; lng: number } | null;
  source: 'service' | 'user' | 'creator';
  isRealTime: boolean;
}

const LocationDisplayModern: React.FC<LocationDisplayModernProps> = ({ 
  service, 
  serviceCreatorInfo,
  className = '',
  compact = false
}) => {
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  const getFieldValue = useCallback((field: any): string => {
    if (!field) return '';
    
    if (typeof field === 'object' && field.valeur !== undefined) {
      const value = field.valeur;
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return value.toString();
      return String(value);
    }
    
    if (typeof field === 'string') return field;
    if (typeof field === 'number') return field.toString();
    
    return '';
  }, []);

  const convertGpsToLocation = useCallback(async (gpsString: string): Promise<string> => {
    try {
      console.log('🔍 [LocationDisplayModern] Conversion GPS:', gpsString);
      
      const [lat, lng] = gpsString.split(',').map(coord => parseFloat(coord.trim()));
      
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('⚠️ [LocationDisplayModern] Coordonnées invalides:', gpsString);
        return 'Position non valide';
      }

      console.log('📍 [LocationDisplayModern] Coordonnées parsées:', { lat, lng });

      // Essayer d'abord l'API interne
      try {
        const response = await fetch(`/api/geocoding/reverse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: lat, longitude: lng })
        });

        console.log('🔗 [LocationDisplayModern] Statut API interne:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('📍 [LocationDisplayModern] Réponse API interne:', data);
          
          // L'API backend retourne déjà une localisation formatée
          if (data.formatted_address && data.formatted_address !== 'Lieu inconnu') {
            console.log('✅ [LocationDisplayModern] Localisation depuis API interne:', data.formatted_address);
            return data.formatted_address;
          }
          
          // Si pas de formatted_address, essayer d'extraire depuis les composants
          if (data.address_components && Array.isArray(data.address_components)) {
            return extractLocationFromGoogleData(data, lat, lng);
          }
        } else {
          console.warn('⚠️ [LocationDisplayModern] API interne échouée (status:', response.status, ')');
        }
      } catch (apiError) {
        console.warn('⚠️ [LocationDisplayModern] Erreur API interne:', apiError);
      }

      // Fallback : Utiliser Google Maps API directement
      console.log('🌍 [LocationDisplayModern] Utilisation Google Maps API directe');
      try {
        const googleResponse = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=fr&key=YOUR_GOOGLE_MAPS_API_KEY`
        );

        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          console.log('🗺️ [LocationDisplayModern] Réponse Google Maps:', googleData);
          
          if (googleData.results && googleData.results.length > 0) {
            return extractLocationFromGoogleData(googleData.results[0], lat, lng);
          }
        }
      } catch (googleError) {
        console.warn('⚠️ [LocationDisplayModern] Google Maps API échouée:', googleError);
      }

      // Fallback intelligent si toutes les APIs échouent
      console.log('🔧 [LocationDisplayModern] Utilisation fallback intelligent');
      return generateIntelligentFallback(lat, lng);
      
    } catch (error) {
      console.error('❌ [LocationDisplayModern] Erreur géocodage:', error);
      
      // Fallback basé sur les coordonnées
      const coords = gpsString.split(',');
      if (coords.length === 2) {
        const lat = parseFloat(coords[0]);
        const lng = parseFloat(coords[1]);
        return generateIntelligentFallback(lat, lng);
      }
      return 'Position mobile';
    }
  }, []);

  // Fonction pour extraire la localisation depuis les données Google Maps
  const extractLocationFromGoogleData = (data: any, lat: number, lng: number): string => {
    console.log('🔍 [LocationDisplayModern] Extraction depuis données Google:', data);
    
    let locationParts = [];
    
    if (data.address_components && Array.isArray(data.address_components)) {
      // Extraire le quartier/sous-localité
      const sublocality = data.address_components.find((c: any) => 
        c.types.includes('sublocality') || 
        c.types.includes('sublocality_level_1') ||
        c.types.includes('neighborhood') ||
        c.types.includes('route')
      );
      
      // Extraire la ville/localité
      const locality = data.address_components.find((c: any) => 
        c.types.includes('locality') ||
        c.types.includes('administrative_area_level_2')
      );
      
      // Extraire la région
      const region = data.address_components.find((c: any) => 
        c.types.includes('administrative_area_level_1')
      );
      
      console.log('🏘️ [LocationDisplayModern] Composants trouvés:', {
        quartier: sublocality?.long_name,
        ville: locality?.long_name,
        region: region?.long_name
      });
      
      // Construire la localisation hiérarchique
      if (sublocality && sublocality.long_name) {
        locationParts.push(sublocality.long_name);
      }
      
      if (locality && locality.long_name && locality.long_name !== sublocality?.long_name) {
        locationParts.push(locality.long_name);
      }
      
      if (region && region.long_name && region.long_name !== locality?.long_name) {
        locationParts.push(region.long_name);
      }
    }
    
    // Si aucune partie trouvée, utiliser formatted_address
    if (locationParts.length === 0 && data.formatted_address) {
      console.log('📮 [LocationDisplayModern] Utilisation formatted_address:', data.formatted_address);
      const addressParts = data.formatted_address.split(',').slice(0, 3);
      locationParts = addressParts.map((part: string) => part.trim()).filter((part: string) => part.length > 0);
    }
    
    // Construire la localisation finale
    if (locationParts.length > 0) {
      const finalLocation = locationParts.join(', ');
      console.log('✅ [LocationDisplayModern] Localisation construite:', finalLocation);
      return finalLocation;
    }
    
    // Si toujours rien, utiliser le fallback intelligent
    return generateIntelligentFallback(lat, lng);
  };

  // Fonction pour générer un fallback intelligent basé sur les coordonnées
  const generateIntelligentFallback = (lat: number, lng: number): string => {
    console.log('🔧 [LocationDisplayModern] Génération fallback pour:', { lat, lng });
    
    // Zones géographiques du Cameroun
    if (lat >= 3.5 && lat <= 13 && lng >= 8 && lng <= 16) {
      // Régions spécifiques du Cameroun
      if (lat >= 10 && lng >= 13) return 'Extrême-Nord, Cameroun';
      if (lat >= 8.5 && lng >= 13) return 'Nord, Cameroun';
      if (lat >= 6.5 && lng >= 11) return 'Adamaoua, Cameroun';
      if (lat >= 5.5 && lng >= 10) return 'Centre, Cameroun';
      if (lat >= 4 && lng >= 9.5) return 'Sud, Cameroun';
      if (lat >= 4.5 && lng <= 10) return 'Littoral, Cameroun';
      if (lat >= 5 && lng <= 11) return 'Ouest, Cameroun';
      if (lat >= 6 && lng <= 12) return 'Nord-Ouest, Cameroun';
      if (lat >= 5.5 && lng <= 12.5) return 'Sud-Ouest, Cameroun';
      if (lat >= 3.5 && lng >= 11) return 'Est, Cameroun';
      
      return 'Cameroun';
    }
    
    // Autres zones géographiques
    if (lat >= -5 && lat <= 5 && lng >= -5 && lng <= 20) return 'Afrique Centrale';
    if (lat >= 30 && lat <= 50 && lng >= -5 && lng <= 10) return 'Europe du Sud';
    if (lat >= 40 && lat <= 60 && lng >= -10 && lng <= 30) return 'Europe';
    
    return `Position ${lat.toFixed(1)}°, ${lng.toFixed(1)}°`;
  };

  useEffect(() => {
    const loadLocationData = async () => {
      try {
        setLoading(true);
        console.log('🔍 [LocationDisplayModern] === DÉBUT DEBUG GPS ===');
        console.log('📊 [LocationDisplayModern] Service ID:', service?.id);
        console.log('📊 [LocationDisplayModern] Service data complet:', service?.data);
        console.log('📊 [LocationDisplayModern] ServiceCreatorInfo:', serviceCreatorInfo);

        // Priorité 1: GPS fixe du service
        const gpsFixe = getFieldValue(service?.data?.gps_fixe);
        console.log('📍 [LocationDisplayModern] GPS fixe service brut:', service?.data?.gps_fixe);
        console.log('📍 [LocationDisplayModern] GPS fixe service traité:', gpsFixe);
        
        if (gpsFixe && gpsFixe.includes(',')) {
          const coords = gpsFixe.split(',').map((coord: string) => parseFloat(coord.trim()));
          console.log('📊 [LocationDisplayModern] Coordonnées service parsées:', coords);
          
          if (coords.length === 2 && !coords.some(isNaN)) {
            console.log('✅ [LocationDisplayModern] Utilisation GPS fixe service');
            const location = await convertGpsToLocation(gpsFixe);
            console.log('🏙️ [LocationDisplayModern] Lieu résolu:', location);
            
            setLocationData({
              location,
              country: 'Cameroun', // Par défaut
              coordinates: { lat: coords[0], lng: coords[1] },
              source: 'service',
              isRealTime: false
            });
            return;
          }
        }

        // Priorité 2: GPS du créateur depuis serviceCreatorInfo
        console.log('👤 [LocationDisplayModern] GPS créateur brut:', serviceCreatorInfo?.gps);
        
        if (serviceCreatorInfo?.gps && serviceCreatorInfo.gps.includes(',')) {
          const coords = serviceCreatorInfo.gps.split(',').map((coord: string) => parseFloat(coord.trim()));
          console.log('📊 [LocationDisplayModern] Coordonnées créateur parsées:', coords);
          
          if (coords.length === 2 && !coords.some(isNaN)) {
            console.log('✅ [LocationDisplayModern] Utilisation GPS créateur');
            const location = await convertGpsToLocation(serviceCreatorInfo.gps);
            console.log('🏙️ [LocationDisplayModern] Lieu créateur résolu:', location);
            
            setLocationData({
              location,
              country: 'Cameroun',
              coordinates: { lat: coords[0], lng: coords[1] },
              source: 'creator',
              isRealTime: false
            });
            return;
          }
        }

        // Priorité 3: Récupérer les vraies données GPS depuis la base via API
        console.log('🔍 [LocationDisplayModern] Récupération GPS depuis API...');
        try {
          const token = localStorage.getItem('token');
          const userGpsResponse = await fetch(`/api/users/${service.user_id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          
          if (userGpsResponse.ok) {
            const userData = await userGpsResponse.json();
            console.log('👤 [LocationDisplayModern] Données utilisateur API:', userData);
            
            if (userData.gps && userData.gps.includes(',')) {
              const coords = userData.gps.split(',').map((coord: string) => parseFloat(coord.trim()));
              console.log('📊 [LocationDisplayModern] Coordonnées API parsées:', coords);
              
              if (coords.length === 2 && !coords.some(isNaN)) {
                console.log('✅ [LocationDisplayModern] Utilisation GPS API');
                const location = await convertGpsToLocation(userData.gps);
                console.log('🏙️ [LocationDisplayModern] Lieu API résolu:', location);
                
                setLocationData({
                  location,
                  country: 'Cameroun',
                  coordinates: { lat: coords[0], lng: coords[1] },
                  source: 'creator',
                  isRealTime: false
                });
                return;
              }
            }
          }
        } catch (apiError) {
          console.warn('⚠️ [LocationDisplayModern] Erreur API utilisateur:', apiError);
        }

        // Priorité 4: Position temps réel de l'utilisateur connecté
        console.log('📱 [LocationDisplayModern] Récupération position temps réel...');
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            });
          });
          
          const realTimeCoords = `${position.coords.latitude},${position.coords.longitude}`;
          console.log('📍 [LocationDisplayModern] Position temps réel:', realTimeCoords);
          
          const location = await convertGpsToLocation(realTimeCoords);
          console.log('🏙️ [LocationDisplayModern] Lieu temps réel résolu:', location);
          
          setLocationData({
            location,
            country: 'Cameroun',
            coordinates: { lat: position.coords.latitude, lng: position.coords.longitude },
            source: 'user',
            isRealTime: true
          });
          return;
        } catch (error) {
          console.warn('⚠️ [LocationDisplayModern] Géolocalisation échouée:', error);
        }

        // Fallback final: Service mobile
        console.log('🔧 [LocationDisplayModern] Fallback service mobile');
        setLocationData({
          location: 'Service mobile',
          country: 'Cameroun',
          coordinates: null,
          source: 'creator',
          isRealTime: false
        });

      } catch (error) {
        console.error('❌ [LocationDisplayModern] Erreur:', error);
        
        // Même en cas d'erreur, toujours fournir une localisation
        setLocationData({
          location: 'Service disponible',
          country: 'Cameroun',
          coordinates: null,
          source: 'service',
          isRealTime: false
        });
      } finally {
        setLoading(false);
        console.log('🔍 [LocationDisplayModern] === FIN DEBUG GPS ===');
      }
    };

    loadLocationData();
  }, [service, serviceCreatorInfo]);

  const openGoogleMaps = () => {
    if (locationData?.coordinates) {
      const { lat, lng } = locationData.coordinates;
      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}&z=16&hl=fr`;
      window.open(mapUrl, '_blank');
    } else if (locationData?.location) {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(locationData.location)}?z=15&hl=fr`;
      window.open(searchUrl, '_blank');
    }
  };

  const getSourceIcon = () => {
    if (!locationData) return <MapPin className="w-4 h-4 text-blue-600" />;
    
    switch (locationData.source) {
      case 'service':
        return <Home className="w-4 h-4 text-blue-600" />;
      case 'user':
      case 'creator':
        return <User className="w-4 h-4 text-green-600" />;
      default:
        return <MapPin className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className={`text-center ${className}`}>
        <div className="animate-pulse p-2">
          <MapPin className="w-4 h-4 mx-auto text-gray-400" />
          <span className="text-xs text-gray-500">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!locationData) {
    return null; // Ne rien afficher si pas de données
  }

  if (compact) {
    return (
      <div className={`text-center space-y-1 p-2 ${className}`}>
        {/* Lieu principal simple */}
        <div className="flex items-center justify-center gap-2">
          {getSourceIcon()}
          <span className="font-semibold text-sm text-gray-800">
            {locationData.location}
          </span>
          {locationData.isRealTime && (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          )}
        </div>

        {/* Pays simple */}
        {locationData.country && (
          <div className="text-xs text-gray-600 font-medium">
            {locationData.country}
          </div>
        )}

        {/* Bouton carte simple */}
        <Button
          variant="outline"
          size="sm"
          onClick={openGoogleMaps}
          className="bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-700 transition-all rounded-lg px-3 py-1 text-xs font-medium"
        >
          <Navigation className="w-3 h-3 mr-1" />
          Carte
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl p-4 border border-gray-100 shadow-sm ${className}`}>
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h4 className="text-lg font-semibold text-gray-800">Localisation</h4>
        </div>

        <div className="flex items-center justify-center gap-3">
          {getSourceIcon()}
          <span className="font-bold text-xl text-gray-900">
            {locationData.location}
          </span>
          {locationData.isRealTime && (
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          )}
        </div>

        {locationData.country && (
          <div className="flex items-center justify-center gap-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              {locationData.country}
            </span>
          </div>
        )}

        <Button
          onClick={openGoogleMaps}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg transition-all"
        >
          <Navigation className="w-4 h-4 mr-2" />
          Ouvrir dans Google Maps
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>

        <div className="text-xs bg-gray-100 text-gray-600 rounded-lg px-3 py-2 font-medium">
          {locationData.source === 'service' && 'Position fixe du service'}
          {locationData.source === 'user' && 'Votre position actuelle'}
          {locationData.source === 'creator' && (locationData.isRealTime ? 'Position temps réel du créateur' : 'Position du créateur')}
        </div>
      </div>
    </div>
  );
};

export default LocationDisplayModern; 