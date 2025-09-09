import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Navigation, ExternalLink, User, Home } from 'lucide-react';
import { Button } from '@/components/ui/buttons/Button';
import { useUser } from '@/hooks/useUser';

interface LocationDisplayProps {
  service: any;
  serviceCreatorInfo?: any; // Renommé de prestataireInfo pour plus de clarté
  className?: string;
  compact?: boolean;
  showMap?: boolean;
}

export const LocationDisplay: React.FC<LocationDisplayProps> = ({ 
  service, 
  serviceCreatorInfo, // Renommé pour plus de clarté
  className = '',
  compact = false,
  showMap = false
}) => {
  // État pour la localisation
  const [location, setLocation] = useState<string>('Chargement...');
  const [detailedLocation, setDetailedLocation] = useState<string>('');
  const [countryInfo, setCountryInfo] = useState<{ flag: string; code: string; countryName: string }>({ flag: '', code: '', countryName: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSource, setLocationSource] = useState<'service' | 'user' | 'creator' | 'adresse' | 'titre'>('service');
  const hasLoadedRef = useRef(false);
  const { user } = useUser();

  const getFieldValue = useCallback((field: any): string => {
    if (!field) return '';
    
    // ?? CORRECTION : Gérer la structure { type_donnee, valeur, origine_champs }
    if (typeof field === 'object') {
      // Structure du service : { type_donnee, valeur, origine_champs }
      if (field.valeur !== undefined) {
        const value = field.valeur;
        if (typeof value === 'string') return value;
        if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
        if (typeof value === 'number') return value.toString();
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
      }
      
      // Fallback pour d'autres structures
      if (field.value !== undefined) return field.value;
      if (field.content !== undefined) return field.content;
      if (field.text !== undefined) return field.text;
      if (field.data !== undefined) return field.data;
      
      // Si c'est un objet avec des clés, essayer de trouver une valeur
      if (Object.keys(field).length > 0) {
        const possibleValues = ['value', 'content', 'text', 'data', 'info'];
        for (const key of possibleValues) {
          if (field[key] !== undefined) {
            const value = field[key];
            if (typeof value === 'string') return value;
            if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
            if (typeof value === 'number') return value.toString();
          }
        }
      }
    }
    
    // Valeur directe
    if (typeof field === 'string') return field;
    if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
    if (typeof field === 'number') return field.toString();
    
    return '';
  }, []);

  // Fonction pour obtenir la position GPS actuelle de l'utilisateur connecté
  const getCurrentUserLocation = useCallback(async (): Promise<string | null> => {
    // Cette fonction n'est plus utilisée - supprimée
    return null;
  }, []);

  // Fonction simplifiée pour extraire le pays depuis la réponse Google Maps
  const extractCountryInfo = useCallback((data: any): { flag: string; code: string; countryName: string } => {
    console.log('🏳️ [extractCountryInfo] Données reçues:', data);
    console.log('🏳️ [extractCountryInfo] Type de données:', typeof data);
    console.log('🏳️ [extractCountryInfo] Clés disponibles:', Object.keys(data));
    
    // Priorité 1: Extraire depuis address_components
    if (data.address_components && Array.isArray(data.address_components)) {
      console.log('🏳️ [extractCountryInfo] address_components trouvé, longueur:', data.address_components.length);
      console.log('🏳️ [extractCountryInfo] address_components:', data.address_components);
      
      const country = data.address_components.find((c: any) => c.types.includes('country'));
      if (country) {
        const countryCode = country.short_name;
        const countryName = country.long_name;
        console.log('🏳️ [extractCountryInfo] Pays trouvé dans address_components:', { code: countryCode, name: countryName });
        
        return { 
          flag: '', 
          code: countryCode,
          countryName: countryName
        };
      } else {
        console.log('🏳️ [extractCountryInfo] Aucun pays trouvé dans address_components');
      }
    } else {
      console.log('🏳️ [extractCountryInfo] address_components non trouvé ou invalide');
      console.log('🏳️ [extractCountryInfo] Type de address_components:', typeof data.address_components);
    }
    
    // Priorité 2: Extraire depuis formatted_address
    if (data.formatted_address) {
      const address = data.formatted_address.toLowerCase();
      console.log('🏳️ [extractCountryInfo] Tentative extraction depuis formatted_address:', address);
      
      // Détection par mots-clés dans l'adresse
      if (address.includes('douala') || address.includes('littoral') || address.includes('cameroun')) {
        console.log('🏳️ [extractCountryInfo] Cameroun détecté dans l\'adresse');
        return { flag: '', code: 'CM', countryName: 'Cameroun' };
      }
      if (address.includes('nigeria') || address.includes('lagos') || address.includes('abuja') || address.includes('kwara') || address.includes('worumokato')) {
        console.log('🏳️ [extractCountryInfo] Nigeria détecté dans l\'adresse');
        return { flag: '', code: 'NG', countryName: 'Nigeria' };
      }
      if (address.includes('senegal') || address.includes('dakar')) {
        console.log('🏳️ [extractCountryInfo] Sénégal détecté dans l\'adresse');
        return { flag: '', code: 'SN', countryName: 'Sénégal' };
      }
      if (address.includes('cote d\'ivoire') || address.includes('abidjan')) {
        console.log('🏳️ [extractCountryInfo] Côte d\'Ivoire détecté dans l\'adresse');
        return { flag: '', code: 'CI', countryName: 'Côte d\'Ivoire' };
      }
      if (address.includes('ghana') || address.includes('accra')) {
        console.log('🏳️ [extractCountryInfo] Ghana détecté dans l\'adresse');
        return { flag: '', code: 'GH', countryName: 'Ghana' };
      }
      if (address.includes('france') || address.includes('paris')) {
        console.log('🏳️ [extractCountryInfo] France détecté dans l\'adresse');
        return { flag: '', code: 'FR', countryName: 'France' };
      }
      if (address.includes('united states') || address.includes('usa') || address.includes('new york')) {
        console.log('🏳️ [extractCountryInfo] États-Unis détecté dans l\'adresse');
        return { flag: '', code: 'US', countryName: 'États-Unis' };
      }
      if (address.includes('canada') || address.includes('toronto')) {
        console.log('🏳️ [extractCountryInfo] Canada détecté dans l\'adresse');
        return { flag: '', code: 'CA', countryName: 'Canada' };
      }
      if (address.includes('united kingdom') || address.includes('uk') || address.includes('london')) {
        console.log('🏳️ [extractCountryInfo] Royaume-Uni détecté dans l\'adresse');
        return { flag: '', code: 'GB', countryName: 'Royaume-Uni' };
      }
      if (address.includes('germany') || address.includes('berlin')) {
        console.log('🏳️ [extractCountryInfo] Allemagne détecté dans l\'adresse');
        return { flag: '', code: 'DE', countryName: 'Allemagne' };
      }
      if (address.includes('italy') || address.includes('rome')) {
        console.log('🏳️ [extractCountryInfo] Italie détecté dans l\'adresse');
        return { flag: '', code: 'IT', countryName: 'Italie' };
      }
      if (address.includes('spain') || address.includes('madrid')) {
        console.log('🏳️ [extractCountryInfo] Espagne détecté dans l\'adresse');
        return { flag: '', code: 'ES', countryName: 'Espagne' };
      }
      if (address.includes('japan') || address.includes('tokyo')) {
        console.log('🏳️ [extractCountryInfo] Japon détecté dans l\'adresse');
        return { flag: '', code: 'JP', countryName: 'Japon' };
      }
      if (address.includes('china') || address.includes('beijing')) {
        console.log('🏳️ [extractCountryInfo] Chine détecté dans l\'adresse');
        return { flag: '', code: 'CN', countryName: 'Chine' };
      }
      if (address.includes('india') || address.includes('new delhi')) {
        console.log('🏳️ [extractCountryInfo] Inde détecté dans l\'adresse');
        return { flag: '', code: 'IN', countryName: 'Inde' };
      }
      if (address.includes('brazil') || address.includes('brasil') || address.includes('sao paulo')) {
        console.log('🏳️ [extractCountryInfo] Brésil détecté dans l\'adresse');
        return { flag: '', code: 'BR', countryName: 'Brésil' };
      }
      if (address.includes('australia') || address.includes('sydney')) {
        console.log('🏳️ [extractCountryInfo] Australie détecté dans l\'adresse');
        return { flag: '', code: 'AU', countryName: 'Australie' };
      }
      if (address.includes('south africa') || address.includes('johannesburg')) {
        console.log('🏳️ [extractCountryInfo] Afrique du Sud détecté dans l\'adresse');
        return { flag: '', code: 'ZA', countryName: 'Afrique du Sud' };
      }
      
      console.log('🏳️ [extractCountryInfo] Aucun pays reconnu dans formatted_address');
    } else {
      console.log('🏳️ [extractCountryInfo] formatted_address non trouvé');
    }
    
    // Priorité 3: Vérifier s'il y a d'autres champs utiles
    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      console.log('🏳️ [extractCountryInfo] Tentative depuis data.results[0]');
      return extractCountryInfo(data.results[0]);
    }
    
    console.log('🏳️ [extractCountryInfo] Retour des valeurs par défaut');
    return { flag: '', code: 'XX', countryName: 'Pays inconnu' };
  }, []);

  const convertGpsToLocation = useCallback(async (gpsString: string): Promise<string> => {
    if (!gpsString || !gpsString.includes(',')) return gpsString;
    
    try {
      const coords = gpsString.split(',').map((coord: string) => parseFloat(coord.trim()));
      if (coords.length !== 2 || coords.some(isNaN)) return gpsString;
      
      let lat, lng;
      if (coords[0] >= -90 && coords[0] <= 90) { lat = coords[0]; lng = coords[1]; }
      else if (coords[1] >= -90 && coords[1] <= 90) { lat = coords[1]; lng = coords[0]; }
      else { lat = coords[0]; lng = coords[1]; }

      // Utiliser uniquement l'API backend Google Maps
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes de timeout
        
        console.log('🌐 [LocationDisplay] Tentative API backend Google Maps pour:', { lat, lng });
        
        const response = await fetch('/api/geocoding/reverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: lat, longitude: lng, detail_level: 'high' }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ [LocationDisplay] API Google Maps réussie:', data);
          console.log('🔍 [LocationDisplay] Structure complète des données:', JSON.stringify(data, null, 2));
          
          if (data.formatted_address) {
            let locationName = data.formatted_address;
            
            // Extraire les informations de pays
            const countryInfo = extractCountryInfo(data);
            setCountryInfo(countryInfo);
            
            // Créer un nom de lieu plus précis
            if (data.address_components) {
              const components = data.address_components;
              const neighbourhood = components.find((c: any) => c.types.includes('neighbourhood'));
              const sublocality = components.find((c: any) => c.types.includes('sublocality'));
              const locality = components.find((c: any) => c.types.includes('locality'));
              
              if (neighbourhood && locality) { 
                locationName = `${neighbourhood.long_name}, ${locality.long_name}`; 
              } else if (sublocality && locality) { 
                locationName = `${sublocality.long_name}, ${locality.long_name}`; 
              } else if (locality) { 
                locationName = locality.long_name; 
              }
            }
            
            return locationName;
          }
        } else {
          console.log('⚠️ [LocationDisplay] API Google Maps erreur:', response.status, response.statusText);
          const errorText = await response.text();
          console.log('⚠️ [LocationDisplay] Détails de l\'erreur:', errorText);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('⏰ [LocationDisplay] API Google Maps timeout après 10s');
        } else {
          console.log('❌ [LocationDisplay] API Google Maps erreur:', error);
        }
      }

      // Si l'API échoue, afficher simplement les coordonnées
      console.log('🔄 [LocationDisplay] API échouée, affichage des coordonnées');
      const latFormatted = Math.abs(lat) < 10 ? lat.toFixed(3) : lat.toFixed(2);
      const lngFormatted = Math.abs(lng) < 10 ? lng.toFixed(3) : lng.toFixed(2);
      
      return `Coordonnées GPS (${latFormatted}, ${lngFormatted})`;
      
    } catch (error) {
      console.error('❌ [convertGpsToLocation] Erreur:', error);
      return gpsString;
    }
  }, [extractCountryInfo]);

  const formatLocation = useCallback(async (): Promise<string> => {
    console.log('🔍 [LocationDisplay] Début formatLocation');
    console.log('📦 [LocationDisplay] Service reçu:', service);
    console.log('👤 [LocationDisplay] Info créateur du service reçu:', serviceCreatorInfo);
    console.log('🔑 [LocationDisplay] User hook:', user);

    try {
      // Priorité 1: GPS fixe du service (priorité absolue)
      const gpsFixe = getFieldValue(service?.data?.gps_fixe);
      console.log('📍 [LocationDisplay] GPS fixe du service:', gpsFixe);
      
      if (gpsFixe && gpsFixe.includes(',')) {
        const result = await convertGpsToLocation(gpsFixe);
        if (result && result !== 'Localisation non disponible') {
          console.log('✅ [LocationDisplay] Utilisation GPS fixe du service:', result);
          setLocationSource('service'); // GPS fixe du service = symbole maison
          const coords = gpsFixe.split(',').map((coord: string) => parseFloat(coord.trim()));
          if (coords.length === 2 && !coords.some(isNaN)) {
            let lat, lng;
            if (coords[0] >= -90 && coords[0] <= 90) { lat = coords[0]; lng = coords[1]; }
            else { lat = coords[1]; lng = coords[0]; }
            setCoordinates({ lat, lng });
          }
          return result;
        }
      } else {
        console.log('❌ [LocationDisplay] GPS fixe non valide ou absent');
      }

      // Priorité 2: GPS de l'utilisateur qui a créé le service (dans la table users)
      console.log('🔍 [LocationDisplay] Recherche GPS du créateur du service...');
      
      if (serviceCreatorInfo?.gps && serviceCreatorInfo.gps.includes(',')) {
        console.log('✅ [LocationDisplay] GPS créateur du service trouvé:', serviceCreatorInfo.gps);
        
        // ?? NOUVEAU : Vérifier si le GPS du créateur est "suspicieux" (Nigeria par défaut)
        const coords = serviceCreatorInfo.gps.split(',').map((coord: string) => parseFloat(coord.trim()));
        if (coords.length === 2 && !coords.some(isNaN)) {
          let lat, lng;
          if (coords[0] >= -90 && coords[0] <= 90) { lat = coords[0]; lng = coords[1]; }
          else { lat = coords[1]; lng = coords[0]; }
          
          // ?? NOUVEAU : Détecter les coordonnées suspectes (Nigeria par défaut)
          const isSuspiciousLocation = (
            (lat >= 6.0 && lat <= 7.0 && lng >= 3.0 && lng <= 4.0) || // Lagos, Nigeria
            (lat >= 8.0 && lat <= 9.0 && lng >= 4.0 && lng <= 5.0) || // Abuja, Nigeria
            (lat >= 9.0 && lat <= 10.0 && lng >= 4.0 && lng <= 5.0)   // Kwara, Nigeria
          );
          
          if (isSuspiciousLocation) {
            console.log('⚠️ [LocationDisplay] GPS créateur suspect (Nigeria par défaut), récupération position temps réel');
            // Au lieu d'afficher les coordonnées suspectes, récupérer la position en temps réel
            try {
              if (navigator.geolocation) {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                  });
                });
                
                const realTimeCoords = `${position.coords.latitude},${position.coords.longitude}`;
                console.log('📍 [LocationDisplay] Position temps réel récupérée:', realTimeCoords);
                
                const result = await convertGpsToLocation(realTimeCoords);
                if (result && result !== 'Localisation non disponible') {
                  setLocationSource('user');
                  setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
                  return result;
                }
              }
            } catch (error) {
              console.warn('⚠️ [LocationDisplay] Impossible de récupérer la position temps réel:', error);
            }
            
            // Fallback si la géolocalisation échoue
            setLocationSource('creator');
            setCoordinates({ lat, lng });
            return 'Position du créateur du service';
          }
          
          // ?? NOUVEAU : GPS créateur valide, l'utiliser avec avertissement
          console.log('✅ [LocationDisplay] GPS créateur valide, utilisation avec avertissement');
          const result = await convertGpsToLocation(serviceCreatorInfo.gps);
          if (result && result !== 'Localisation non disponible') {
            console.log('✅ [LocationDisplay] Résultat GPS créateur du service:', result);
            setLocationSource('creator'); // GPS créateur = symbole personne (temps réel)
            setCoordinates({ lat, lng });
            return `${result} 📍 (Position actuelle du créateur)`;
          }
        }
      } else {
        console.log('❌ [LocationDisplay] GPS créateur du service non trouvé ou invalide');
      }

      // Priorité 3: Adresse du service
      const adresse = getFieldValue(service?.data?.adresse);
      console.log('🏠 [LocationDisplay] Adresse du service:', adresse);
      if (adresse) {
        console.log('✅ [LocationDisplay] Utilisation de l\'adresse:', adresse);
        setLocationSource('adresse'); // Adresse = symbole maison
        return adresse;
      }

      // Priorité 4: Titre du service
      const titre = getFieldValue(service?.data?.titre);
      console.log('📝 [LocationDisplay] Titre du service:', titre);
      if (titre) {
        console.log('✅ [LocationDisplay] Utilisation du titre:', titre);
        setLocationSource('titre'); // Titre = symbole maison
        return titre;
      }

      console.log('❌ [LocationDisplay] Aucune localisation trouvée');
      return 'Localisation non disponible';
    } catch (error) {
      console.error('❌ [formatLocation] Erreur:', error);
      return 'Erreur de chargement';
    }
  }, [service, serviceCreatorInfo, user, getFieldValue, convertGpsToLocation]);

  useEffect(() => {
    // Éviter les re-renders multiples et la boucle infinie
    if (hasLoadedRef.current) return;
    
    console.log('🚀 [LocationDisplay] useEffect déclenché');
    console.log('📦 [LocationDisplay] Props reçues:', { service, serviceCreatorInfo, compact, showMap });
    
    const loadLocation = async () => {
      try {
        setIsLoading(true);
        const result = await formatLocation();
        console.log('✅ [LocationDisplay] Résultat final:', result);
        setLocation(result);
        
        if (result && result !== 'Localisation non disponible' && result !== 'Erreur de chargement' && !result.includes('Chargement')) {
          let detailed = result;
          if (countryInfo.code !== 'XX') {
            // Utiliser le nom du pays au lieu du drapeau
            detailed += ` ${countryInfo.countryName || 'Pays inconnu'}`;
          }
          setDetailedLocation(detailed);
        }
        
        hasLoadedRef.current = true;
      } catch (error) {
        console.error('❌ [LocationDisplay] Erreur:', error);
        setLocation('Erreur de chargement');
        hasLoadedRef.current = true;
      } finally {
        setIsLoading(false);
      }
    };
    
    loadLocation();
  }, []); // Dépendances vides pour éviter la boucle infinie

  const openGoogleMaps = useCallback(() => {
    if (coordinates) {
      const mapUrl = `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}&z=16&hl=fr`;
      console.log('🗺️ [LocationDisplay] Ouverture Google Maps avec coordonnées:', coordinates);
      window.open(mapUrl, '_blank');
      return;
    }
    if (location && location !== 'Localisation non disponible' && location !== 'Erreur de chargement') {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(location)}?z=15&hl=fr`;
      console.log('🗺️ [LocationDisplay] Ouverture Google Maps avec recherche:', location);
      window.open(searchUrl, '_blank');
    }
  }, [coordinates, location]);

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-gray-800 text-sm">Chargement...</span>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {/* Affichage principal de la localisation avec nom du lieu et bouton carte sur la même ligne */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Nom du lieu */}
            <span className="text-gray-800 font-medium truncate max-w-[200px]" title={location}>
              {location}
            </span>
            
            {/* Nom du pays sur la même ligne */}
            {countryInfo?.countryName && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded flex-shrink-0">
                {countryInfo.countryName}
              </span>
            )}
            
            {/* Symbole conditionnel pour indiquer la source de la position GPS */}
            <span className="ml-auto text-lg flex-shrink-0">
              {locationSource === 'user' && (
                <span title="Position GPS en temps réel de l'utilisateur connecté">
                  👤
                </span>
              )}
              {(locationSource === 'service' || locationSource === 'creator' || locationSource === 'adresse' || locationSource === 'titre') && (
                <span title="Position GPS fixe du service ou information du service">
                  🏠
                </span>
              )}
            </span>
            
            {/* Bouton carte sur la même ligne si showMap est activé */}
            {showMap && location !== 'Localisation non disponible' && location !== 'Erreur de chargement' && (
              <Button
                variant="outline"
                size="sm"
                onClick={openGoogleMaps}
                className="h-8 px-3 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-200 hover:border-blue-300 transition-all duration-200 flex-shrink-0"
              >
                <Navigation className="w-3 h-3 mr-1.5" />
                <span className="mr-1">Voir sur la carte</span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          {/* Informations détaillées en dessous seulement si pas compact */}
          {!compact && detailedLocation && detailedLocation !== location && (
            <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
              {detailedLocation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationDisplay; 