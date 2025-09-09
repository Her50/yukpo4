import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import { useNotifications } from '@/hooks/useNotifications';
import { usePrestataireStatus, useNotificationsWebSocket } from '@/hooks/useWebSocket';
import AppLayout from '@/components/layout/AppLayout';
import { API_KEYS } from '@/config/api-keys';

import NotificationBell from '@/components/notifications/NotificationBell';

import { usePrestataireInfo, PrestataireInfo } from '@/hooks/usePrestataireInfo';
import { PushNotificationManager } from '@/components/notifications/PushNotificationManager';
import { gpsTrackingService } from '@/services/gpsTrackingService';
import { geocodingService } from '@/services/geocodingService';

import ServiceMediaGallery from '@/components/ui/ServiceMediaGallery';
import { 
  AlertCircle,
  MessageCircle,
  Calendar,
  User,
  CheckCircle,
  MapPin, 
  Tag,
  Star, 
  Phone, 
  Mail,
  Video,
  Share2,
  Heart,
  Clock,
  ArrowLeft,
  MessageSquare,
  Wifi,
  WifiOff,
  Bell,
  Eye,
  EyeOff,
  ChevronDown,
  Globe,
  Mic,
  Image
} from 'lucide-react';
import { Service, Review } from '@/types/service';
import { ServiceRating } from '@/components/ui/ServiceRating';
import MessageEditor from '@/components/chat/MessageEditor';


// Fonction utilitaire pour extraire la valeur d'un champ de service
const getServiceFieldValue = (field: any): string => {
  if (!field) return 'Non spÃ©cifiÃ©';
  
  // Cas 1: String simple (anciens services)
  if (typeof field === 'string') return field;
  
  // Cas 2: Objet complexe (nouveaux services)
  if (field && typeof field === 'object' && field.valeur !== undefined) {
    return String(field.valeur);
  }
  
  // Cas 3: Autres types
  if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
  if (typeof field === 'number') return field.toString();
  
  return 'Non spÃ©cifiÃ©';
};

// Fonction utilitaire pour vÃ©rifier si un champ mÃ©dia existe rÃ©ellement
const hasValidMediaField = (field: any): boolean => {
  if (!field) return false;
  if (typeof field === 'string') return field.trim() !== '' && field !== 'Non spÃ©cifiÃ©';
  if (field.valeur !== undefined) {
    const value = field.valeur;
    if (typeof value === 'string') return value.trim() !== '' && value !== 'Non spÃ©cifiÃ©';
    if (Array.isArray(value)) return value.length > 0;
  }
  return false;
};

// Fonction utilitaire pour extraire les valeurs des champs mÃ©dia
const getServiceMediaValue = (field: any): string[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (field.valeur !== undefined) {
    if (Array.isArray(field.valeur)) return field.valeur;
    if (typeof field.valeur === 'string') return [field.valeur];
  }
  return [];
};

// Fonction pour convertir les coordonnÃ©es GPS en lieu lisible (100% automatique)
const convertGpsToLocation = async (gpsString: string): Promise<string> => {
  if (!gpsString || !gpsString.includes(',')) return gpsString;
  
  try {
    const coords = gpsString.split(',').map(coord => parseFloat(coord.trim()));
    if (coords.length !== 2 || coords.some(isNaN)) return gpsString;
    
    // DÃ©tecter automatiquement le format: longitude,latitude ou latitude,longitude
    let lat, lng;
    if (coords[0] >= -90 && coords[0] <= 90) {
      // Premier nombre est latitude (valide)
      lat = coords[0];
      lng = coords[1];
    } else if (coords[1] >= -90 && coords[1] <= 90) {
      // DeuxiÃ¨me nombre est latitude (valide)
      lat = coords[1];
      lng = coords[0];
    } else {
      // Format inconnu, utiliser l'ordre original
      lat = coords[0];
      lng = coords[1];
    }
    
    // Utiliser le service de gÃ©ocodage automatique
    const locationName = await geocodingService.getLocationFromCoordinates(lat, lng);
    
    // Optimiser le nom du lieu pour l'affichage
    const optimizedName = optimizeLocationName(locationName);
    
    return optimizedName;
    
  } catch (error) {
    console.error('âŒ [convertGpsToLocation] Erreur:', error);
    // Fallback: coordonnÃ©es formatÃ©es
    const coords = gpsString.split(',').map(coord => parseFloat(coord.trim()));
    if (coords.length === 2) {
      const lat = coords[0];
      const lng = coords[1];
      const latFormatted = Math.abs(lat) < 10 ? lat.toFixed(3) : lat.toFixed(2);
      const lngFormatted = Math.abs(lng) < 10 ? lng.toFixed(3) : lng.toFixed(2);
      return `${latFormatted}, ${lngFormatted}`;
    }
    return gpsString;
  }
};

// Fonction pour optimiser le nom du lieu pour l'affichage (MONDIALE) - VERSION AMÃ‰LIORÃ‰E
const optimizeLocationName = (locationName: string): string => {
  if (!locationName) return locationName;
  
  // Nettoyer le nom du lieu
  let optimized = locationName.trim();
  
  // Supprimer les noms de pays redondants (approche mondiale)
  const countryPatterns = [
    /, Cameroon$/i,
    /, Cameroun$/i,
    /, Nigeria$/i,
    /, BÃ©nin$/i,
    /, Togo$/i,
    /, Ghana$/i,
    /, RÃ©publique du Cameroun$/i,
    /, Federal Republic of Nigeria$/i,
    /, United States$/i,
    /, USA$/i,
    /, United Kingdom$/i,
    /, UK$/i,
    /, France$/i,
    /, Germany$/i,
    /, Canada$/i,
    /, Australia$/i,
    /, China$/i,
    /, Japan$/i,
    /, India$/i,
    /, Brazil$/i,
    /, Mexico$/i,
    /, Argentina$/i,
    /, South Africa$/i,
    /, Egypt$/i,
    /, Morocco$/i,
    /, Algeria$/i,
    /, Tunisia$/i,
    /, Senegal$/i,
    /, Ivory Coast$/i,
    /, Mali$/i,
    /, Burkina Faso$/i,
    /, Niger$/i,
    /, Chad$/i,
    /, Central African Republic$/i,
    /, Democratic Republic of the Congo$/i,
    /, Republic of the Congo$/i,
    /, Gabon$/i,
    /, Equatorial Guinea$/i,
    /, SÃ£o TomÃ© and PrÃ­ncipe$/i,
    /, Angola$/i,
    /, Zambia$/i,
    /, Zimbabwe$/i,
    /, Botswana$/i,
    /, Namibia$/i,
    /, Mozambique$/i,
    /, Malawi$/i,
    /, Tanzania$/i,
    /, Kenya$/i,
    /, Uganda$/i,
    /, Rwanda$/i,
    /, Burundi$/i,
    /, Ethiopia$/i,
    /, Somalia$/i,
    /, Djibouti$/i,
    /, Eritrea$/i,
    /, Sudan$/i,
    /, South Sudan$/i,
    /, Libya$/i,
    /, Mauritania$/i,
    /, Western Sahara$/i,
    /, Cape Verde$/i,
    /, Guinea-Bissau$/i,
    /, Guinea$/i,
    /, Sierra Leone$/i,
    /, Liberia$/i,
    /, Gambia$/i,
    /, Guinea$/i,
    /, Equatorial Guinea$/i,
    /, SÃ£o TomÃ© and PrÃ­ncipe$/i,
    /, Gabon$/i,
    /, Republic of the Congo$/i,
    /, Democratic Republic of the Congo$/i,
    /, Central African Republic$/i,
    /, Chad$/i,
    /, Niger$/i,
    /, Burkina Faso$/i,
    /, Mali$/i,
    /, Ivory Coast$/i,
    /, Senegal$/i,
    /, Tunisia$/i,
    /, Algeria$/i,
    /, Morocco$/i,
    /, Egypt$/i,
    /, South Africa$/i,
    /, Argentina$/i,
    /, Mexico$/i,
    /, Brazil$/i,
    /, India$/i,
    /, Japan$/i,
    /, China$/i,
    /, Australia$/i,
    /, Canada$/i,
    /, Germany$/i,
    /, France$/i,
    /, UK$/i,
    /, United Kingdom$/i,
    /, USA$/i,
    /, United States$/i
  ];
  
  // Supprimer les noms de pays
  for (const pattern of countryPatterns) {
    optimized = optimized.replace(pattern, '');
  }
  
  // Nettoyer les virgules multiples et espaces
  optimized = optimized.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '').trim();
  
  // Assurer une cohÃ©rence : ville + quartier/rÃ©gion
  const parts = optimized.split(',').map(part => part.trim()).filter(part => part.length > 0);
  
  if (parts.length >= 2) {
    // Prendre les 2 premiÃ¨res parties (ville + quartier/rÃ©gion)
    optimized = parts.slice(0, 2).join(', ');
  } else if (parts.length === 1) {
    // Si une seule partie, la garder
    optimized = parts[0];
  }
  
  // Limiter la longueur totale - AUGMENTÃ‰E pour plus de lisibilitÃ©
  if (optimized.length > 40) {
    // Essayer de garder ville + quartier mÃªme si tronquÃ©
    const truncated = optimized.substring(0, 37) + '...';
    return truncated;
  }
  
  return optimized;
};

        // Fonction pour formater la localisation avec hiÃ©rarchie intelligente
        const formatLocation = async (service: any, prestatairesMap: Map<number, any>, currentUser: any): Promise<string> => {
          
          // 1. PrioritÃ©: gps_fixe (lieu fixe du service)
          if (service?.data?.gps_fixe) {
            const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
            if (gpsFixe && gpsFixe !== 'Non spÃ©cifiÃ©') {
              // VÃ©rifier si gps_fixe contient des coordonnÃ©es GPS
              if (typeof gpsFixe === 'string' && gpsFixe.includes(',')) {
                // GÃ©ocoder les coordonnÃ©es GPS
                const location = await convertGpsToLocation(gpsFixe);
                return location;
              }
              // Si ce n'est pas des coordonnÃ©es, retourner directement
              return gpsFixe;
            }
          }
          
          // 2. PrioritÃ©: adresse textuelle
          if (service?.data?.adresse) {
            const adresse = getServiceFieldValue(service.data.adresse);
            if (adresse && adresse !== 'Non spÃ©cifiÃ©') {
              return adresse;
            }
          }
          
          // 3. PrioritÃ©: extraire la localisation du titre du service
          if (service?.data?.titre) {
            const titre = getServiceFieldValue(service.data.titre);
            if (titre && titre !== 'Non spÃ©cifiÃ©') {
              // Chercher des patterns de localisation dans le titre
              const localisationPatterns = [
                /à\s+([A-Za-z\s]+)/,           // "Restaurant à Edea"
                /dans\s+([A-Za-z\s]+)/,        // "Restaurant dans Douala"
                /sur\s+([A-Za-z\s]+)/,         // "Restaurant sur la route"
                /près\s+de\s+([A-Za-z\s]+)/,   // "Restaurant près de Yaoundé"
                /zone\s+([A-Za-z\s]+)/,        // "Restaurant zone Akwa"
                /quartier\s+([A-Za-z\s]+)/     // "Restaurant quartier Bali"
              ];
              
              for (const pattern of localisationPatterns) {
                const match = titre.match(pattern);
                if (match && match[1]) {
                  const location = match[1].trim();
                  if (location.length > 2) { // Ã‰viter les mots trop courts
                    return location;
                  }
                }
              }
            }
          }
          
          // 4. PrioritÃ©: chercher dans tous les champs du service.data
          if (service?.data) {
            // Afficher tous les champs disponibles pour debug
            const allFields = Object.keys(service.data);
            
            for (const [fieldName, fieldValue] of Object.entries(service.data)) {
              if (typeof fieldValue === 'string' && fieldValue.length > 5) {
                const localisationPatterns = [
                  /à\s+([A-Za-z\s]+)/,           // "Restaurant à Edea"
                  /dans\s+([A-Za-z\s]+)/,        // "Restaurant dans Douala"
                  /sur\s+([A-Za-z\s]+)/,         // "Restaurant sur la route"
                  /près\s+de\s+([A-Za-z\s]+)/,   // "Restaurant près de Yaoundé"
                  /zone\s+([A-Za-z\s]+)/,        // "Restaurant zone Akwa"
                  /quartier\s+([A-Za-z\s]+)/     // "Restaurant quartier Bali"
                ];
                
                for (const pattern of localisationPatterns) {
                  const match = fieldValue.match(pattern);
                  if (match && match[1]) {
                    const location = match[1].trim();
                    if (location.length > 2) {
                      return location;
                    }
                  }
                }
              }
            }
          }
          
          // 5. PrioritÃ©: gps du prestataire (coordonnÃ©es)
          if (service?.gps) {
            const gps = service.gps;
            if (gps && gps !== 'Non spÃ©cifiÃ©') {
              if (typeof gps === 'string' && gps.includes(',')) {
                // Convertir les coordonnÃ©es GPS en lieu lisible
                const location = await convertGpsToLocation(gps);
                return location;
              }
              return gps;
            }
          }
          
          // 6. PrioritÃ©: gps du prestataire depuis la map
          if (service?.user_id && prestatairesMap.has(service.user_id)) {
            const prestataire = prestatairesMap.get(service.user_id);
            if (prestataire?.gps && prestataire.gps !== 'Non spÃ©cifiÃ©') {
              if (typeof prestataire.gps === 'string' && prestataire.gps.includes(',')) {
                // Convertir les coordonnÃ©es GPS en lieu lisible
                const location = await convertGpsToLocation(prestataire.gps);
                return location;
              }
              return prestataire.gps;
            }
          }
          
          // 7. Fallback: localisation par dÃ©faut
          return 'Localisation non disponible';
        };

  // Fonction pour calculer le padding top optimal du CardHeader
  const calculateHeaderPadding = (hasLogo: boolean, wsConnected: boolean): string => {
    if (hasLogo) return 'pt-16'; // Logo prÃ©sent = grand padding
    if (wsConnected) return 'pt-8'; // WebSocket connectÃ© = padding moyen pour crÃ©er un espace avec le Live centrÃ©
    return 'pt-2'; // Aucun Ã©lÃ©ment = petit padding
  };

  // Fonction pour formater la date de maniÃ¨re complÃ¨te
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Date non disponible';
    try {
      const date = new Date(dateString);
      
      // Version complÃ¨te avec mois en franÃ§ais
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();
      
      // Mois complets en franÃ§ais
      const monthNames = [
        'janvier', 'fÃ©vrier', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'aoÃ»t', 'septembre', 'octobre', 'novembre', 'dÃ©cembre'
      ];
      
      return `${day} ${monthNames[month]} ${year}`;
    } catch {
      return 'Date invalide';
    }
  };

  // Fonction pour calculer la distance entre deux points GPS
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

        // Fonction pour obtenir les informations du pays Ã  partir des coordonnÃ©es GPS - VERSION MONDIALE
        const getCountryInfo = async (lat: number, lng: number): Promise<{ flag: string; code: string }> => {
          try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEYS.GOOGLE_MAPS_API_KEY}&language=fr`);
            
            if (response.ok) {
              const data = await response.json();
              if (data.results && data.results.length > 0) {
                const addressComponents = data.results[0].address_components;
                const countryComponent = addressComponents.find((component: any) => 
                  component.types.includes('country')
                );
                
                if (countryComponent) {
                  const countryCode = countryComponent.short_name;
                  const flag = getFlagEmoji(countryCode);
                  return {
                    flag: flag,
                    code: countryCode
                  };
                }
              }
            }
          } catch (error) {
            console.error('âŒ [getCountryInfo] Erreur Google Maps:', error);
          }
          
          // Fallback : essayer de dÃ©terminer le pays par les coordonnÃ©es
          try {
            const countryCode = getCountryFromCoordinates(lat, lng);
            console.log('ðŸ—ºï¸ [getCountryInfo] Code pays fallback:', countryCode);
            const flag = getFlagEmoji(countryCode);
            return { flag, code: countryCode };
          } catch (error) {
            console.error('âŒ [getCountryInfo] Erreur fallback:', error);
          }
          
          return { flag: 'ðŸŒ', code: 'XX' }; // Valeurs par dÃ©faut
        };

        // Fonction de fallback pour dÃ©terminer le pays par coordonnÃ©es
        const getCountryFromCoordinates = (lat: number, lng: number): string => {
          // Zones gÃ©ographiques approximatives pour les pays principaux
          const countryZones = [
            // Afrique
            { code: 'DZ', bounds: [19, 36, -9, 12] }, // AlgÃ©rie
            { code: 'AO', bounds: [-18, -5, 11, 24] }, // Angola
            { code: 'BJ', bounds: [6, 12, 1, 4] }, // BÃ©nin
            { code: 'BW', bounds: [-27, -18, 19, 29] }, // Botswana
            { code: 'BF', bounds: [9, 15, -6, 2] }, // Burkina Faso
            { code: 'BI', bounds: [-4, -2, 29, 31] }, // Burundi
            { code: 'CM', bounds: [2, 13, 8, 16] }, // Cameroun
            { code: 'CV', bounds: [14, 17, -25, -22] }, // Cap-Vert
            { code: 'CF', bounds: [2, 11, 14, 27] }, // RÃ©publique centrafricaine
            { code: 'TD', bounds: [8, 24, 14, 24] }, // Tchad
            { code: 'KM', bounds: [-13, -11, 43, 45] }, // Comores
            { code: 'CG', bounds: [-5, 4, 11, 19] }, // Congo
            { code: 'CD', bounds: [-14, 6, 12, 32] }, // RDC
            { code: 'DJ', bounds: [10, 13, 41, 44] }, // Djibouti
            { code: 'EG', bounds: [22, 32, 25, 37] }, // Ã‰gypte
            { code: 'GQ', bounds: [1, 2, 5, 12] }, // GuinÃ©e Ã©quatoriale
            { code: 'ER', bounds: [12, 18, 36, 43] }, // Ã‰rythrÃ©e
            { code: 'ET', bounds: [3, 15, 33, 48] }, // Ã‰thiopie
            { code: 'GA', bounds: [-4, 2, 8, 15] }, // Gabon
            { code: 'GM', bounds: [13, 14, -17, -13] }, // Gambie
            { code: 'GH', bounds: [5, 11, -4, 2] }, // Ghana
            { code: 'GN', bounds: [7, 13, -15, -7] }, // GuinÃ©e
            { code: 'GW', bounds: [11, 12, -17, -13] }, // GuinÃ©e-Bissau
            { code: 'CI', bounds: [4, 11, -8, -2] }, // CÃ´te d'Ivoire
            { code: 'KE', bounds: [-5, 5, 34, 42] }, // Kenya
            { code: 'LS', bounds: [-31, -28, 27, 30] }, // Lesotho
            { code: 'LR', bounds: [4, 8, -12, -7] }, // LibÃ©ria
            { code: 'LY', bounds: [20, 33, 9, 26] }, // Libye
            { code: 'MG', bounds: [-26, -11, 43, 51] }, // Madagascar
            { code: 'MW', bounds: [-17, -9, 32, 36] }, // Malawi
            { code: 'ML', bounds: [10, 25, -12, 4] }, // Mali
            { code: 'MR', bounds: [15, 27, -17, -4] }, // Mauritanie
            { code: 'MU', bounds: [-21, -19, 56, 58] }, // Maurice
            { code: 'YT', bounds: [-13, -12, 45, 45] }, // Mayotte
            { code: 'MA', bounds: [28, 36, -14, -1] }, // Maroc
            { code: 'MZ', bounds: [-27, -10, 30, 41] }, // Mozambique
            { code: 'NA', bounds: [-29, -17, 11, 26] }, // Namibie
            { code: 'NE', bounds: [12, 24, 0, 16] }, // Niger
            { code: 'NG', bounds: [4, 14, 3, 15] }, // Nigeria
            { code: 'RW', bounds: [-3, -1, 29, 31] }, // Rwanda
            { code: 'ST', bounds: [0, 2, 6, 8] }, // Sao TomÃ©-et-Principe
            { code: 'SN', bounds: [12, 17, -18, -11] }, // SÃ©nÃ©gal
            { code: 'SC', bounds: [-10, -4, 46, 56] }, // Seychelles
            { code: 'SL', bounds: [7, 10, -14, -10] }, // Sierra Leone
            { code: 'SO', bounds: [-2, 12, 41, 52] }, // Somalie
            { code: 'ZA', bounds: [-35, -22, 16, 33] }, // Afrique du Sud
            { code: 'SS', bounds: [3, 13, 24, 36] }, // Soudan du Sud
            { code: 'SD', bounds: [4, 23, 22, 39] }, // Soudan
            { code: 'SZ', bounds: [-28, -25, 30, 32] }, // Eswatini
            { code: 'TZ', bounds: [-12, -1, 29, 41] }, // Tanzanie
            { code: 'TG', bounds: [6, 11, 0, 2] }, // Togo
            { code: 'TN', bounds: [30, 37, 7, 12] }, // Tunisie
            { code: 'UG', bounds: [-2, 5, 29, 35] }, // Ouganda
            { code: 'EH', bounds: [21, 28, -18, -8] }, // Sahara occidental
            { code: 'ZM', bounds: [-18, -8, 22, 34] }, // Zambie
            { code: 'ZW', bounds: [-23, -15, 25, 33] }, // Zimbabwe
            
            // AmÃ©rique
            { code: 'AR', bounds: [-56, -21, -74, -53] }, // Argentine
            { code: 'BO', bounds: [-23, -9, -70, -57] }, // Bolivie
            { code: 'BR', bounds: [-34, 6, -74, -34] }, // BrÃ©sil
            { code: 'CL', bounds: [-56, -17, -76, -66] }, // Chili
            { code: 'CO', bounds: [-5, 13, -82, -66] }, // Colombie
            { code: 'EC', bounds: [-5, 2, -82, -75] }, // Ã‰quateur
            { code: 'GY', bounds: [1, 9, -62, -56] }, // Guyana
            { code: 'PY', bounds: [-28, -19, -63, -54] }, // Paraguay
            { code: 'PE', bounds: [-20, -1, -84, -68] }, // PÃ©rou
            { code: 'SR', bounds: [2, 6, -58, -54] }, // Suriname
            { code: 'UY', bounds: [-35, -30, -58, -53] }, // Uruguay
            { code: 'VE', bounds: [1, 13, -74, -59] }, // Venezuela
            { code: 'CA', bounds: [41, 84, -141, -52] }, // Canada
            { code: 'US', bounds: [18, 72, -180, -66] }, // Ã‰tats-Unis
            { code: 'MX', bounds: [14, 33, -118, -86] }, // Mexique
            
            // Asie
            { code: 'CN', bounds: [18, 54, 73, 135] }, // Chine
            { code: 'IN', bounds: [6, 37, 68, 97] }, // Inde
            { code: 'JP', bounds: [24, 46, 129, 146] }, // Japon
            { code: 'KR', bounds: [33, 39, 124, 132] }, // CorÃ©e du Sud
            { code: 'KP', bounds: [37, 43, 124, 131] }, // CorÃ©e du Nord
            { code: 'TH', bounds: [6, 21, 97, 106] }, // ThaÃ¯lande
            { code: 'VN', bounds: [8, 23, 102, 110] }, // Vietnam
            { code: 'MY', bounds: [1, 7, 100, 119] }, // Malaisie
            { code: 'ID', bounds: [-11, 6, 95, 141] }, // IndonÃ©sie
            { code: 'PH', bounds: [5, 21, 116, 127] }, // Philippines
            { code: 'SG', bounds: [1, 2, 103, 105] }, // Singapour
            { code: 'BD', bounds: [21, 27, 88, 93] }, // Bangladesh
            { code: 'PK', bounds: [24, 37, 61, 75] }, // Pakistan
            { code: 'AF', bounds: [29, 39, 60, 75] }, // Afghanistan
            { code: 'IR', bounds: [25, 40, 44, 64] }, // Iran
            { code: 'IQ', bounds: [29, 38, 39, 49] }, // Irak
            { code: 'SA', bounds: [16, 33, 35, 56] }, // Arabie saoudite
            { code: 'TR', bounds: [36, 42, 26, 45] }, // Turquie
            { code: 'RU', bounds: [41, 82, 26, 191] }, // Russie
            { code: 'KZ', bounds: [41, 56, 46, 87] }, // Kazakhstan
            { code: 'UZ', bounds: [37, 46, 56, 75] }, // OuzbÃ©kistan
            { code: 'KG', bounds: [39, 43, 69, 80] }, // Kirghizistan
            { code: 'TJ', bounds: [36, 41, 67, 75] }, // Tadjikistan
            { code: 'TM', bounds: [35, 43, 52, 67] }, // TurkmÃ©nistan
            { code: 'AZ', bounds: [39, 42, 44, 51] }, // AzerbaÃ¯djan
            { code: 'GE', bounds: [41, 44, 40, 47] }, // GÃ©orgie
            { code: 'AM', bounds: [39, 41, 43, 47] }, // ArmÃ©nie
            { code: 'IL', bounds: [29, 34, 34, 36] }, // IsraÃ«l
            { code: 'JO', bounds: [29, 33, 35, 39] }, // Jordanie
            { code: 'LB', bounds: [33, 35, 35, 37] }, // Liban
            { code: 'SY', bounds: [32, 37, 35, 42] }, // Syrie
            { code: 'CY', bounds: [34, 36, 32, 35] }, // Chypre
            { code: 'KW', bounds: [28, 31, 46, 49] }, // KoweÃ¯t
            { code: 'QA', bounds: [24, 27, 50, 52] }, // Qatar
            { code: 'AE', bounds: [22, 26, 51, 57] }, // Ã‰mirats arabes unis
            { code: 'OM', bounds: [16, 27, 52, 60] }, // Oman
            { code: 'YE', bounds: [12, 19, 42, 55] }, // YÃ©men
            { code: 'BH', bounds: [26, 27, 50, 51] }, // BahreÃ¯n
            { code: 'MV', bounds: [-1, 7, 72, 74] }, // Maldives
            { code: 'LK', bounds: [6, 10, 79, 82] }, // Sri Lanka
            { code: 'NP', bounds: [26, 31, 80, 88] }, // NÃ©pal
            { code: 'BT', bounds: [27, 29, 88, 92] }, // Bhoutan
            { code: 'MM', bounds: [10, 28, 92, 101] }, // Myanmar
            { code: 'LA', bounds: [14, 23, 100, 108] }, // Laos
            { code: 'KH', bounds: [10, 15, 102, 108] }, // Cambodge
            { code: 'BN', bounds: [4, 5, 114, 116] }, // Brunei
            { code: 'TW', bounds: [21, 26, 119, 122] }, // TaÃ¯wan
            { code: 'HK', bounds: [22, 23, 113, 115] }, // Hong Kong
            { code: 'MO', bounds: [22, 23, 113, 114] }, // Macao
            { code: 'MN', bounds: [42, 52, 87, 120] }, // Mongolie
            
            // Europe
            { code: 'FR', bounds: [41, 51, -5, 10] }, // France
            { code: 'DE', bounds: [47, 55, 6, 15] }, // Allemagne
            { code: 'IT', bounds: [36, 47, 6, 19] }, // Italie
            { code: 'ES', bounds: [27, 44, -10, 5] }, // Espagne
            { code: 'PT', bounds: [32, 42, -10, -6] }, // Portugal
            { code: 'GB', bounds: [49, 61, -8, 2] }, // Royaume-Uni
            { code: 'NL', bounds: [50, 54, 3, 8] }, // Pays-Bas
            { code: 'BE', bounds: [49, 51, 2, 6] }, // Belgique
            { code: 'CH', bounds: [45, 48, 6, 11] }, // Suisse
            { code: 'AT', bounds: [46, 49, 9, 18] }, // Autriche
            { code: 'PL', bounds: [49, 55, 14, 24] }, // Pologne
            { code: 'CZ', bounds: [48, 51, 12, 19] }, // RÃ©publique tchÃ¨que
            { code: 'SK', bounds: [47, 50, 16, 23] }, // Slovaquie
            { code: 'HU', bounds: [45, 49, 16, 23] }, // Hongrie
            { code: 'RO', bounds: [43, 48, 20, 30] }, // Roumanie
            { code: 'BG', bounds: [41, 44, 22, 29] }, // Bulgarie
            { code: 'GR', bounds: [35, 42, 20, 28] }, // GrÃ¨ce
            { code: 'HR', bounds: [42, 47, 13, 20] }, // Croatie
            { code: 'SI', bounds: [45, 47, 13, 17] }, // SlovÃ©nie
            { code: 'BA', bounds: [42, 45, 15, 20] }, // Bosnie-HerzÃ©govine
            { code: 'RS', bounds: [42, 46, 18, 23] }, // Serbie
            { code: 'ME', bounds: [41, 43, 18, 20] }, // MontÃ©nÃ©gro
            { code: 'MK', bounds: [40, 43, 20, 23] }, // MacÃ©doine du Nord
            { code: 'AL', bounds: [39, 43, 19, 21] }, // Albanie
            { code: 'UA', bounds: [44, 53, 22, 41] }, // Ukraine
            { code: 'BY', bounds: [51, 56, 23, 33] }, // BiÃ©lorussie
            { code: 'LT', bounds: [53, 56, 21, 27] }, // Lituanie
            { code: 'LV', bounds: [55, 58, 21, 28] }, // Lettonie
            { code: 'EE', bounds: [57, 60, 22, 28] }, // Estonie
            { code: 'FI', bounds: [60, 71, 20, 32] }, // Finlande
            { code: 'SE', bounds: [55, 69, 11, 24] }, // SuÃ¨de
            { code: 'NO', bounds: [58, 71, 4, 31] }, // NorvÃ¨ge
            { code: 'DK', bounds: [54, 58, 8, 16] }, // Danemark
            { code: 'IS', bounds: [63, 67, -25, -13] }, // Islande
            { code: 'IE', bounds: [51, 55, -11, -5] }, // Irlande
            { code: 'LU', bounds: [49, 50, 5, 6] }, // Luxembourg
            { code: 'LI', bounds: [47, 47, 9, 10] }, // Liechtenstein
            { code: 'MC', bounds: [43, 44, 7, 8] }, // Monaco
            { code: 'SM', bounds: [43, 44, 12, 13] }, // Saint-Marin
            { code: 'VA', bounds: [41, 42, 12, 13] }, // Vatican
            { code: 'AD', bounds: [42, 43, 1, 2] }, // Andorre
            { code: 'MT', bounds: [35, 36, 14, 15] }, // Malte
            { code: 'CY', bounds: [34, 36, 32, 35] }, // Chypre
            
            // OcÃ©anie
            { code: 'AU', bounds: [-44, -10, 113, 154] }, // Australie
            { code: 'NZ', bounds: [-48, -34, 166, 179] }, // Nouvelle-ZÃ©lande
            { code: 'FJ', bounds: [-21, -15, 177, -178] }, // Fidji
            { code: 'PG', bounds: [-12, -1, 141, 156] }, // Papouasie-Nouvelle-GuinÃ©e
            { code: 'SB', bounds: [-12, -5, 155, 170] }, // ÃŽles Salomon
            { code: 'VU', bounds: [-21, -13, 166, 170] }, // Vanuatu
            { code: 'NC', bounds: [-23, -19, 163, 168] }, // Nouvelle-CalÃ©donie
            { code: 'PF', bounds: [-28, -7, -155, -134] }, // PolynÃ©sie franÃ§aise
            { code: 'WS', bounds: [-14, -13, -173, -171] }, // Samoa
            { code: 'TO', bounds: [-24, -15, -176, -173] }, // Tonga
            { code: 'KI', bounds: [-5, 3, -175, -169] }, // Kiribati
            { code: 'MH', bounds: [4, 11, 160, 172] }, // ÃŽles Marshall
            { code: 'FM', bounds: [1, 10, 137, 164] }, // MicronÃ©sie
            { code: 'PW', bounds: [2, 8, 131, 135] }, // Palaos
            { code: 'NR', bounds: [-1, -0, 166, 167] }, // Nauru
            { code: 'TV', bounds: [-10, -5, 176, 180] }, // Tuvalu
            { code: 'GU', bounds: [13, 14, 144, 145] }, // Guam
            { code: 'MP', bounds: [14, 20, 144, 146] }, // ÃŽles Mariannes du Nord
            { code: 'AS', bounds: [-15, -13, -171, -168] }, // Samoa amÃ©ricaines
          ];
          
          // Chercher le pays correspondant aux coordonnÃ©es
          for (const zone of countryZones) {
            const [minLat, maxLat, minLng, maxLng] = zone.bounds;
            if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
              return zone.code;
            }
          }
          
          return 'XX'; // Code par dÃ©faut si aucun pays trouvÃ©
        };

        // Fonction pour obtenir l'URL de l'image du drapeau
        const getFlagImageUrl = (countryCode: string): string => {
          // Essayer plusieurs sources de drapeaux
          const sources = [
            `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`,
            `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`,
            `https://flagcdn.com/${countryCode.toLowerCase()}.svg`,
            `https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${countryCode.toLowerCase()}.svg`
          ];
          
          return sources[0]; // Retourner la premiÃ¨re source par dÃ©faut
        };

        // Fonction pour convertir le code pays en emoji drapeau - VERSION MONDIALE
        const getFlagEmoji = (countryCode: string): string => {
          if (!countryCode || countryCode.length !== 2) {
            return 'ðŸŒ';
          }
          
          // MÃ©thode principale : utiliser les caractÃ¨res rÃ©gionaux Unicode
          try {
            const codePoints = countryCode
              .toUpperCase()
              .split('')
              .map(char => 0x1F1E6 + char.charCodeAt(0) - 65);
            
            if (codePoints.length === 2 && codePoints.every(cp => cp >= 0x1F1E6 && cp <= 0x1F1FF)) {
              return String.fromCodePoint(...codePoints);
            }
          } catch (error) {
            console.error('âŒ [getFlagEmoji] Erreur gÃ©nÃ©ration drapeau:', error);
          }
          
          // Fallback : drapeaux connus pour les cas problÃ©matiques
          const knownFlags: { [key: string]: string } = {
            // Afrique
            'DZ': 'ðŸ‡©ðŸ‡¿', 'AO': 'ðŸ‡¦ðŸ‡´', 'BJ': 'ðŸ‡§ðŸ‡¯', 'BW': 'ðŸ‡§ðŸ‡¼', 'BF': 'ðŸ‡§ðŸ‡«', 'BI': 'ðŸ‡§ðŸ‡®', 'CM': 'ðŸ‡¨ðŸ‡²', 'CV': 'ðŸ‡¨ðŸ‡»', 'CF': 'ðŸ‡¨ðŸ‡«', 'TD': 'ðŸ‡¹ðŸ‡©',
            'KM': 'ðŸ‡°ðŸ‡²', 'CG': 'ðŸ‡¨ðŸ‡¬', 'CD': 'ðŸ‡¨ðŸ‡©', 'DJ': 'ðŸ‡©ðŸ‡¯', 'EG': 'ðŸ‡ªðŸ‡¬', 'GQ': 'ðŸ‡¬ðŸ‡¶', 'ER': 'ðŸ‡ªðŸ‡·', 'ET': 'ðŸ‡ªðŸ‡¹', 'GA': 'ðŸ‡¬ðŸ‡¦', 'GM': 'ðŸ‡¬ðŸ‡²',
            'GH': 'ðŸ‡¬ðŸ‡­', 'GN': 'ðŸ‡¬ðŸ‡³', 'GW': 'ðŸ‡¬ðŸ‡¼', 'CI': 'ðŸ‡¨ðŸ‡®', 'KE': 'ðŸ‡°ðŸ‡ª', 'LS': 'ðŸ‡±ðŸ‡¸', 'LR': 'ðŸ‡±ðŸ‡·', 'LY': 'ðŸ‡±ðŸ‡¾', 'MG': 'ðŸ‡²ðŸ‡¬', 'MW': 'ðŸ‡²ðŸ‡¼',
            'ML': 'ðŸ‡²ðŸ‡±', 'MR': 'ðŸ‡²ðŸ‡·', 'MU': 'ðŸ‡²ðŸ‡º', 'YT': 'ðŸ‡¾ðŸ‡¹', 'MA': 'ðŸ‡²ðŸ‡¦', 'MZ': 'ðŸ‡²ðŸ‡¿', 'NA': 'ðŸ‡³ðŸ‡¦', 'NE': 'ðŸ‡³ðŸ‡ª', 'NG': 'ðŸ‡³ðŸ‡¬', 'RW': 'ðŸ‡·ðŸ‡¼',
            'ST': 'ðŸ‡¸ðŸ‡¹', 'SN': 'ðŸ‡¸ðŸ‡³', 'SC': 'ðŸ‡¸ðŸ‡¨', 'SL': 'ðŸ‡¸ðŸ‡±', 'SO': 'ðŸ‡¸ðŸ‡´', 'ZA': 'ðŸ‡¿ðŸ‡¦', 'SS': 'ðŸ‡¸ðŸ‡¸', 'SD': 'ðŸ‡¸ðŸ‡©', 'SZ': 'ðŸ‡¸ðŸ‡¿', 'TZ': 'ðŸ‡¹ðŸ‡¿',
            'TG': 'ðŸ‡¹ðŸ‡¬', 'TN': 'ðŸ‡¹ðŸ‡³', 'UG': 'ðŸ‡ºðŸ‡¬', 'EH': 'ðŸ‡ªðŸ‡­', 'ZM': 'ðŸ‡¿ðŸ‡²', 'ZW': 'ðŸ‡¿ðŸ‡¼',
            
            // AmÃ©rique
            'AR': 'ðŸ‡¦ðŸ‡·', 'BO': 'ðŸ‡§ðŸ‡´', 'BR': 'ðŸ‡§ðŸ‡·', 'CL': 'ðŸ‡¨ðŸ‡±', 'CO': 'ðŸ‡¨ðŸ‡´', 'EC': 'ðŸ‡ªðŸ‡¨', 'GY': 'ðŸ‡¬ðŸ‡¾', 'PY': 'ðŸ‡µðŸ‡¾', 'PE': 'ðŸ‡µðŸ‡ª', 'SR': 'ðŸ‡¸ðŸ‡·',
            'UY': 'ðŸ‡ºðŸ‡¾', 'VE': 'ðŸ‡»ðŸ‡ª', 'CA': 'ðŸ‡¨ðŸ‡¦', 'US': 'ðŸ‡ºðŸ‡¸', 'MX': 'ðŸ‡²ðŸ‡½', 'GT': 'ðŸ‡¬ðŸ‡¹', 'BZ': 'ðŸ‡§ðŸ‡¿', 'SV': 'ðŸ‡¸ðŸ‡»', 'HN': 'ðŸ‡­ðŸ‡³', 'NI': 'ðŸ‡³ðŸ‡®',
            'CR': 'ðŸ‡¨ðŸ‡·', 'PA': 'ðŸ‡µðŸ‡¦', 'CU': 'ðŸ‡¨ðŸ‡º', 'JM': 'ðŸ‡¯ðŸ‡²', 'HT': 'ðŸ‡­ðŸ‡¹', 'DO': 'ðŸ‡©ðŸ‡´', 'PR': 'ðŸ‡µðŸ‡·', 'TT': 'ðŸ‡¹ðŸ‡¹', 'BB': 'ðŸ‡§ðŸ‡§', 'GD': 'ðŸ‡¬ðŸ‡©',
            'LC': 'ðŸ‡±ðŸ‡¨', 'VC': 'ðŸ‡»ðŸ‡¨', 'AG': 'ðŸ‡¦ðŸ‡¬', 'KN': 'ðŸ‡°ðŸ‡³', 'DM': 'ðŸ‡©ðŸ‡²', 'BS': 'ðŸ‡§ðŸ‡¸', 'AI': 'ðŸ‡¦ðŸ‡®', 'TC': 'ðŸ‡¹ðŸ‡¨', 'VG': 'ðŸ‡»ðŸ‡¬', 'VI': 'ðŸ‡»ðŸ‡®',
            'AW': 'ðŸ‡¦ðŸ‡¼', 'CW': 'ðŸ‡¨ðŸ‡¼', 'SX': 'ðŸ‡¸ðŸ‡½', 'BQ': 'ðŸ‡§ðŸ‡¶', 'FK': 'ðŸ‡«ðŸ‡°', 'GF': 'ðŸ‡¬ðŸ‡«', 'PF': 'ðŸ‡µðŸ‡«', 'NC': 'ðŸ‡³ðŸ‡¨', 'GP': 'ðŸ‡¬ðŸ‡µ', 'MQ': 'ðŸ‡²ðŸ‡¶',
            'RE': 'ðŸ‡·ðŸ‡ª', 'YT': 'ðŸ‡¾ðŸ‡¹', 'BL': 'ðŸ‡§ðŸ‡±', 'MF': 'ðŸ‡²ðŸ‡«', 'PM': 'ðŸ‡µðŸ‡²', 'WF': 'ðŸ‡¼ðŸ‡«',
            
            // Asie
            'AF': 'ðŸ‡¦ðŸ‡«', 'AM': 'ðŸ‡¦ðŸ‡²', 'AZ': 'ðŸ‡¦ðŸ‡¿', 'BH': 'ðŸ‡§ðŸ‡­', 'BD': 'ðŸ‡§ðŸ‡©', 'BT': 'ðŸ‡§ðŸ‡¹', 'BN': 'ðŸ‡§ðŸ‡³', 'KH': 'ðŸ‡°ðŸ‡­', 'CN': 'ðŸ‡¨ðŸ‡³', 'CY': 'ðŸ‡¨ðŸ‡¾',
            'GE': 'ðŸ‡¬ðŸ‡ª', 'HK': 'ðŸ‡­ðŸ‡°', 'IN': 'ðŸ‡®ðŸ‡³', 'ID': 'ðŸ‡®ðŸ‡©', 'IR': 'ðŸ‡®ðŸ‡·', 'IQ': 'ðŸ‡®ðŸ‡¶', 'IL': 'ðŸ‡®ðŸ‡±', 'JP': 'ðŸ‡¯ðŸ‡µ', 'JO': 'ðŸ‡¯ðŸ‡´', 'KZ': 'ðŸ‡°ðŸ‡¿',
            'KW': 'ðŸ‡°ðŸ‡¼', 'KG': 'ðŸ‡°ðŸ‡¬', 'LA': 'ðŸ‡±ðŸ‡¦', 'LB': 'ðŸ‡±ðŸ‡§', 'MO': 'ðŸ‡²ðŸ‡´', 'MY': 'ðŸ‡²ðŸ‡¾', 'MV': 'ðŸ‡²ðŸ‡»', 'MN': 'ðŸ‡²ðŸ‡³', 'MM': 'ðŸ‡²ðŸ‡²', 'NP': 'ðŸ‡³ðŸ‡µ',
            'OM': 'ðŸ‡´ðŸ‡²', 'PK': 'ðŸ‡µðŸ‡°', 'PS': 'ðŸ‡µðŸ‡¸', 'PH': 'ðŸ‡µðŸ‡­', 'QA': 'ðŸ‡¶ðŸ‡¦', 'SA': 'ðŸ‡¸ðŸ‡¦', 'SG': 'ðŸ‡¸ðŸ‡¬', 'LK': 'ðŸ‡±ðŸ‡°', 'SY': 'ðŸ‡¸ðŸ‡¾', 'TW': 'ðŸ‡¹ðŸ‡¼',
            'TJ': 'ðŸ‡¹ðŸ‡¯', 'TH': 'ðŸ‡¹ðŸ‡­', 'TL': 'ðŸ‡¹ðŸ‡±', 'TR': 'ðŸ‡¹ðŸ‡·', 'TM': 'ðŸ‡¹ðŸ‡²', 'AE': 'ðŸ‡¦ðŸ‡ª', 'UZ': 'ðŸ‡ºðŸ‡¿', 'VN': 'ðŸ‡»ðŸ‡³', 'YE': 'ðŸ‡¾ðŸ‡ª', 'KR': 'ðŸ‡°ðŸ‡·',
            'KP': 'ðŸ‡°ðŸ‡µ', 'MN': 'ðŸ‡²ðŸ‡³', 'KG': 'ðŸ‡°ðŸ‡¬', 'TJ': 'ðŸ‡¹ðŸ‡¯', 'TM': 'ðŸ‡¹ðŸ‡²', 'UZ': 'ðŸ‡ºðŸ‡¿',
            
            // Europe
            'AL': 'ðŸ‡¦ðŸ‡±', 'AD': 'ðŸ‡¦ðŸ‡©', 'AT': 'ðŸ‡¦ðŸ‡¹', 'BY': 'ðŸ‡§ðŸ‡¾', 'BE': 'ðŸ‡§ðŸ‡ª', 'BA': 'ðŸ‡§ðŸ‡¦', 'BG': 'ðŸ‡§ðŸ‡¬', 'HR': 'ðŸ‡­ðŸ‡·', 'CZ': 'ðŸ‡¨ðŸ‡¿', 'DK': 'ðŸ‡©ðŸ‡°',
            'EE': 'ðŸ‡ªðŸ‡ª', 'FI': 'ðŸ‡«ðŸ‡®', 'FR': 'ðŸ‡«ðŸ‡·', 'DE': 'ðŸ‡©ðŸ‡ª', 'GR': 'ðŸ‡¬ðŸ‡·', 'HU': 'ðŸ‡­ðŸ‡º', 'IS': 'ðŸ‡®ðŸ‡¸', 'IE': 'ðŸ‡®ðŸ‡ª', 'IT': 'ðŸ‡®ðŸ‡¹', 'LV': 'ðŸ‡±ðŸ‡»',
            'LI': 'ðŸ‡±ðŸ‡®', 'LT': 'ðŸ‡±ðŸ‡¹', 'LU': 'ðŸ‡±ðŸ‡º', 'MT': 'ðŸ‡²ðŸ‡¹', 'MD': 'ðŸ‡²ðŸ‡©', 'MC': 'ðŸ‡²ðŸ‡¨', 'ME': 'ðŸ‡²ðŸ‡ª', 'NL': 'ðŸ‡³ðŸ‡±', 'MK': 'ðŸ‡²ðŸ‡°', 'NO': 'ðŸ‡³ðŸ‡´',
            'PL': 'ðŸ‡µðŸ‡±', 'PT': 'ðŸ‡µðŸ‡¹', 'RO': 'ðŸ‡·ðŸ‡´', 'RU': 'ðŸ‡·ðŸ‡º', 'SM': 'ðŸ‡¸ðŸ‡²', 'RS': 'ðŸ‡·ðŸ‡¸', 'SK': 'ðŸ‡¸ðŸ‡°', 'SI': 'ðŸ‡¸ðŸ‡®', 'ES': 'ðŸ‡ªðŸ‡¸', 'SE': 'ðŸ‡¸ðŸ‡ª',
            'CH': 'ðŸ‡¨ðŸ‡­', 'UA': 'ðŸ‡ºðŸ‡¦', 'GB': 'ðŸ‡¬ðŸ‡§', 'VA': 'ðŸ‡»ðŸ‡¦', 'XK': 'ðŸ‡½ðŸ‡°',
            
            // OcÃ©anie
            'AU': 'ðŸ‡¦ðŸ‡º', 'FJ': 'ðŸ‡«ðŸ‡¯', 'KI': 'ðŸ‡°ðŸ‡®', 'MH': 'ðŸ‡²ðŸ‡­', 'FM': 'ðŸ‡«ðŸ‡²', 'NR': 'ðŸ‡³ðŸ‡·', 'NZ': 'ðŸ‡³ðŸ‡¿', 'PW': 'ðŸ‡µðŸ‡¼', 'PG': 'ðŸ‡µðŸ‡¬', 'WS': 'ðŸ‡¼ðŸ‡¸',
            'SB': 'ðŸ‡¸ðŸ‡§', 'TO': 'ðŸ‡¹ðŸ‡´', 'TV': 'ðŸ‡¹ðŸ‡»', 'VU': 'ðŸ‡»ðŸ‡º', 'GU': 'ðŸ‡¬ðŸ‡º', 'MP': 'ðŸ‡²ðŸ‡µ', 'AS': 'ðŸ‡¦ðŸ‡¸', 'CK': 'ðŸ‡¨ðŸ‡°', 'NU': 'ðŸ‡³ðŸ‡º', 'TK': 'ðŸ‡¹ðŸ‡°',
            'NC': 'ðŸ‡³ðŸ‡¨', 'PF': 'ðŸ‡µðŸ‡«', 'WF': 'ðŸ‡¼ðŸ‡«', 'PN': 'ðŸ‡µðŸ‡³', 'NF': 'ðŸ‡³ðŸ‡«',
            
            // Territoires et dÃ©pendances
            'AQ': 'ðŸ‡¦ðŸ‡¶', 'BV': 'ðŸ‡§ðŸ‡»', 'IO': 'ðŸ‡®ðŸ‡´', 'CX': 'ðŸ‡¨ðŸ‡½', 'CC': 'ðŸ‡¨ðŸ‡¨', 'HM': 'ðŸ‡­ðŸ‡²', 'GS': 'ðŸ‡¬ðŸ‡¸', 'TF': 'ðŸ‡¹ðŸ‡«', 'SH': 'ðŸ‡¸ðŸ‡­', 'SJ': 'ðŸ‡¸ðŸ‡¯',
            'UM': 'ðŸ‡ºðŸ‡²', 'AX': 'ðŸ‡¦ðŸ‡½', 'FO': 'ðŸ‡«ðŸ‡´', 'GL': 'ðŸ‡¬ðŸ‡±', 'GI': 'ðŸ‡¬ðŸ‡®', 'JE': 'ðŸ‡¯ðŸ‡ª', 'IM': 'ðŸ‡®ðŸ‡²', 'GG': 'ðŸ‡¬ðŸ‡¬', 'AD': 'ðŸ‡¦ðŸ‡©', 'MC': 'ðŸ‡²ðŸ‡¨',
            'SM': 'ðŸ‡¸ðŸ‡²', 'VA': 'ðŸ‡»ðŸ‡¦', 'LI': 'ðŸ‡±ðŸ‡®', 'MT': 'ðŸ‡²ðŸ‡¹', 'CY': 'ðŸ‡¨ðŸ‡¾'
          };
          
          return knownFlags[countryCode] || 'ðŸŒ';
        };

export const ResultatBesoin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contactMenuOpen, setContactMenuOpen] = useState<number | null>(null);
  const [showPrestataireGallery, setShowPrestataireGallery] = useState(false);

  // Ã‰tats pour la gestion des fichiers
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [prestataireGallery, setPrestataireGallery] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Ã‰tats pour l'enregistrement audio
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [holdStartTime, setHoldStartTime] = useState<number | null>(null);

  // Utiliser le hook WebSocket pour le statut en ligne des prestataires
  const userId = user?.id ? parseInt(user.id, 10) : 0;
  const { isConnected: wsConnected, checkUserStatus, userStatus } = usePrestataireStatus(
    isNaN(userId) ? 0 : userId
  );

  // WebSocket pour les notifications en temps rÃ©el
  const { isConnected: notificationsConnected, notifications } = useNotificationsWebSocket(
    isNaN(userId) ? 0 : userId
  );

  // Hook pour rÃ©cupÃ©rer les informations des prestataires
  const { prestataires, fetchPrestatairesBatch } = usePrestataireInfo();

  // Ã‰tat pour les indicateurs de frappe et mÃ©triques WebSocket
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [wsMetrics, setWsMetrics] = useState({
    connectionTime: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastPing: 0,
    latency: 0
  });

  // Initialiser le suivi GPS automatique
  useEffect(() => {
    if (user?.id) {
      console.log('ðŸš€ Initialisation du suivi GPS pour l\'utilisateur:', user.id);
      gpsTrackingService.startTracking();
      
      // Nettoyer Ã  la fermeture
      return () => {
        gpsTrackingService.stopTracking();
      };
    }
  }, [user?.id]);
  const [wsTypingStatus, setWsTypingStatus] = useState(false);

  // Fonction pour gÃ©rer les indicateurs de frappe WebSocket
  const handleTypingIndicator = (serviceId: number, isTyping: boolean) => {
    if (isTyping) {
      setTypingUsers(prev => new Set([...prev, serviceId]));
      // Auto-arrÃªt aprÃ¨s 3 secondes
      setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(serviceId);
          return newSet;
        });
      }, 3000);
    } else {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serviceId);
        return newSet;
      });
    }
  };

  // Fonction pour mettre Ã  jour les mÃ©triques WebSocket
  const updateWsMetrics = (type: 'sent' | 'received' | 'ping', value?: number) => {
    setWsMetrics(prev => {
      switch (type) {
        case 'sent':
          return { ...prev, messagesSent: prev.messagesSent + 1 };
        case 'received':
          return { ...prev, messagesReceived: prev.messagesReceived + 1 };
        case 'ping':
          return { 
            ...prev, 
            lastPing: Date.now(),
            latency: value || prev.latency 
          };
        default:
          return prev;
      }
    });
  };

  // Ã‰tat pour le mode hors ligne
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineMessages, setOfflineMessages] = useState<Array<{
    id: string;
    serviceId: number;
    content: string;
    timestamp: Date;
    type: 'text' | 'audio';
    audioBlob?: Blob;
  }>>([]);

  // Ã‰tat pour l'Ã©dition des messages
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);



  

  // RÃ©cupÃ©rer les informations des prestataires quand les services sont chargÃ©s
  useEffect(() => {
    if (services.length > 0) {
      const userIds = services.map(service => service.user_id).filter(id => id !== undefined);
      if (userIds.length > 0) {
        fetchPrestatairesBatch(userIds);
      }
    }
  }, [services, fetchPrestatairesBatch]);

  useEffect(() => {
    const processResults = async () => {
      if (location.state?.results) {
        const results = location.state.results;
        
        if (!Array.isArray(results)) {
          setLoading(false);
          return;
        }
        
        // Trier les rÃ©sultats par score de pertinence et proximitÃ©
        const sortedResults = await sortResultsByRelevanceAndProximity(results);
        
        const serviceIds = sortedResults
          .map((result: any) => result.service_id)
          .filter((id: any) => id && id !== 'undefined')
          .map((id: any) => id.toString());
        
        if (serviceIds.length > 0) {
          fetchServicesByIds(serviceIds, sortedResults);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    processResults();
  }, [location.state]);

  const fetchServicesByIds = async (serviceIds: string[], originalResults: any[] = []) => {
    try {
      setLoading(true);
      setError(null);
      
      const servicePromises = serviceIds.map(async (serviceId, index) => {
        try {
          const response = await fetch(`/api/services/${serviceId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (response.ok) {
            const service = await response.json();
            
            // Enrichir le service avec les donnÃ©es de recherche (score, etc.)
            const enrichedService = {
              ...service,
              score: originalResults[index]?.score || 0,
              semantic_score: originalResults[index]?.semantic_score || 0,
              interaction_score: originalResults[index]?.interaction_score || 0,
              gps: originalResults[index]?.gps || null
            };
            
            return enrichedService;
          } else if (response.status === 404) {
            console.warn(`âš ï¸ Service ${serviceId} non trouvÃ© (404)`);
            return null;
          } else {
            console.error(`âŒ Erreur ${response.status} pour le service ${serviceId}`);
            return null;
          }
        } catch (error) {
          console.error(`âŒ Erreur rÃ©seau pour le service ${serviceId}:`, error);
          return null;
        }
      });

      const results = await Promise.all(servicePromises);
      const validServices = results.filter(service => service !== null);

      if (validServices.length === 0) {
        setError("Aucun service trouvÃ©. Les services recherchÃ©s ne sont plus disponibles.");
        setServices([]);
      } else if (validServices.length < serviceIds.length) {
        const missingCount = serviceIds.length - validServices.length;
        console.warn(`âš ï¸ ${missingCount} services manquants sur ${serviceIds.length} demandÃ©s`);
        
        // Afficher un toast d'information
        toast({
          title: "Services partiellement trouvÃ©s",
          description: `${validServices.length} sur ${serviceIds.length} services trouvÃ©s`,
          type: "default"
        });
        
        setServices(validServices);
      } else {
        setServices(validServices);
      }
    } catch (error) {
      console.error('âŒ Erreur lors de la rÃ©cupÃ©ration des services:', error);
      setError('Erreur lors de la rÃ©cupÃ©ration des services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleContact = (service: Service) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour contacter le prestataire",
        type: "error"
      });
      navigate('/login', { state: { from: `/resultat-besoin` } });
      return;
    }
    
    // Enregistrer l'interaction avec le service
    logServiceInteraction(service, 'contact_modal_opened');
    
    setSelectedService(service);
    setShowContactModal(true);
  };

  // Fonction pour enregistrer les interactions avec les services
  const logServiceInteraction = async (service: Service, action: string) => {
    try {
      const response = await fetch(`/api/services/${service.id}/interaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          action: action,
          timestamp: new Date().toISOString(),
          service_id: service.id
        })
      });

      if (response.ok) {
        console.log(`âœ… Interaction ${action} enregistrÃ©e pour le service ${service.id}`);
      }
    } catch (error) {
      console.error('âŒ Erreur lors de l\'enregistrement de l\'interaction:', error);
    }
  };

  const handleChat = (service: Service) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour chatter avec le prestataire",
        type: "error"
      });
      navigate('/login', { state: { from: `/resultat-besoin` } });
      return;
    }

    // Enregistrer l'interaction de chat
    logServiceInteraction(service, 'chat_opened');
    
    setSelectedService(service);
    setShowChatModal(true);
    
    // Envoyer notification au prestataire via l'API existante
    sendNotificationToPrestataire(service, 'chat_request');
    
    // Initialiser le chat avec un message de bienvenue personnalisÃ©
    const prestataireInfo = prestataires.get(service.user_id);
    const nomPrestataire = prestataireInfo?.nom_complet || `Prestataire #${service.user_id}`;
    const titreService = getServiceFieldValue(service.data?.titre_service);
    const categorieService = getServiceFieldValue(service.data?.category);
    
    const welcomeMessage = {
      id: Date.now().toString(),
      from: 'prestataire',
      content: `Bonjour ðŸ'‹, je suis ${nomPrestataire} pour le service "${titreService || 'Service'}"${categorieService ? ` (${categorieService})` : ''}. Que puis-je faire pour vous ?`,
      timestamp: new Date(),
      status: 'read',
      type: 'text'
    };
    setChatMessages([welcomeMessage]);
    
    // Activer les WebSockets pour le chat en temps rÃ©el
    if (wsConnected) {
      // Envoyer un message de statut pour indiquer que l'utilisateur est en train de chatter
      checkUserStatus(service.user_id);
      
      // Simuler l'indicateur de frappe pour ce service
      handleTypingIndicator(service.id, true);
      
      // Mettre Ã  jour les mÃ©triques WebSocket
      updateWsMetrics('sent');
      
      // Notification WebSocket en temps rÃ©el
      toast({
        title: "Chat activÃ©",
        description: `Connexion WebSocket Ã©tablie avec ${getServiceFieldValue(service.data?.titre_service)}`,
        type: "success"
      });
    }

  };

  // Fonction pour rÃ©cupÃ©rer la position de l'utilisateur
  const getUserLocation = (): Promise<{lat: number, lon: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('GÃ©olocalisation non supportÃ©e');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lon } = position.coords;
          console.log(`ðŸ" Position utilisateur: ${lat}, ${lon}`);
          resolve({ lat, lon });
        },
        (error) => {
          console.warn('Erreur gÃ©olocalisation:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  // Fonction pour trier les rÃ©sultats par pertinence et proximitÃ©
  const sortResultsByRelevanceAndProximity = async (results: any[]): Promise<any[]> => {
    try {
      // RÃ©cupÃ©rer la position de l'utilisateur
      const userLocation = await getUserLocation();
      
      if (!userLocation) {
        // Si pas de gÃ©olocalisation, trier seulement par score
        console.log('ðŸ" GÃ©olocalisation non disponible, tri par score uniquement');
        return results.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      }

      // Enrichir les rÃ©sultats avec la distance calculÃ©e
      const enrichedResults = results.map((result: any) => {
        let distance = Infinity;
        
        if (result.gps && typeof result.gps === 'string' && result.gps.includes(',')) {
          try {
            const coords = result.gps.split(',');
            if (coords.length >= 2) {
              const lat = parseFloat(coords[0]);
              const lon = parseFloat(coords[1]);
              if (!isNaN(lat) && !isNaN(lon)) {
                distance = calculateDistance(userLocation.lat, userLocation.lon, lat, lon);
              }
            }
          } catch (error) {
            console.warn('Erreur parsing GPS:', error);
          }
        }
        
        return {
          ...result,
          distance,
          proximityScore: distance < 1 ? 1.0 : distance < 5 ? 0.8 : distance < 10 ? 0.6 : 0.4
        };
      });

      // Trier par score combinÃ© (pertinence + proximitÃ©)
      return enrichedResults.sort((a: any, b: any) => {
        const scoreA = (a.score || 0) * 0.7 + (a.proximityScore || 0) * 0.3;
        const scoreB = (b.score || 0) * 0.7 + (b.proximityScore || 0) * 0.3;
        return scoreB - scoreA;
      });
    } catch (error) {
      console.error('âŒ Erreur lors du tri des rÃ©sultats:', error);
      // Fallback: tri par score uniquement
      return results.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
    }
  };

  const handleWhatsApp = (service: Service) => {
    const phone = getServiceFieldValue(service.data?.telephone);
    if (phone && phone !== 'Non spÃ©cifiÃ©') {
      const message = `Bonjour ! Je suis intÃ©ressÃ© par votre service : ${getServiceFieldValue(service.data?.titre_service)}`;
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');
      
      // Envoyer notification au prestataire
      sendNotificationToPrestataire(service, 'whatsapp_contact');
    } else {
      toast({
        title: "TÃ©lÃ©phone non disponible",
        description: "Ce prestataire n'a pas encore renseignÃ© son numÃ©ro de tÃ©lÃ©phone pour WhatsApp",
        type: "default"
      });
    }
  };

  const sendNotificationToPrestataire = async (service: Service, type: string) => {
    try {
      // Utiliser l'API d'interaction existante
      const response = await fetch(`/api/services/${service.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          content: `Nouvelle demande de ${type} pour le service ${getServiceFieldValue(service.data?.titre_service)}`
        })
      });

      if (response.ok) {
        toast({
          title: "Notification envoyÃ©e",
          description: "Le prestataire a Ã©tÃ© notifiÃ© de votre intÃ©rÃªt",
          type: "default"
        });
        
        // Notification WebSocket en temps réel si connecté
        if (notificationsConnected) {
          toast({
            title: "🔔 Notification temps réel",
            description: "Le prestataire a été notifié via WebSocket en temps réel",
            type: "success"
          });
        }
      }
    } catch (error) {
      console.error('Erreur envoi notification:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'envoi de la notification",
        type: "error"
      });
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !selectedService) return;

    const message = {
      id: Date.now().toString(),
      from: 'client',
      content: newMessage,
      timestamp: new Date(),
      status: 'sent',
      type: 'text'
    };

    // Ajouter le message localement
    setChatMessages(prev => [...prev, message]);
    setNewMessage('');

    try {
      // Envoyer le message via l'API existante
      const response = await fetch(`/api/services/${selectedService.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          content: newMessage
        })
      });

      if (response.ok) {
        // Marquer comme livrÃ©
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === message.id ? { ...msg, status: 'delivered' } : msg
          )
        );
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'envoi du message",
        type: "error"
      });
    }
  };

  const handleCall = (service: Service) => {
    const phone = getServiceFieldValue(service.data?.telephone);
    if (phone && phone !== 'Non spÃ©cifiÃ©') {
      // Notifier le prestataire AVANT l'appel
      sendNotificationToPrestataire(service, 'appel_telephonique');
      
      // Attendre un peu pour que la notification soit envoyÃ©e
      setTimeout(() => {
        window.open(`tel:${phone}`, '_self');
      }, 500);
    } else {
      toast({
        title: "TÃ©lÃ©phone non disponible",
        description: "Ce prestataire n'a pas encore renseignÃ© son numÃ©ro de tÃ©lÃ©phone",
        type: "default"
      });
    }
  };

  const handleEmail = (service: Service) => {
    const email = getServiceFieldValue(service.data?.email);
    if (email && email !== 'Non spÃ©cifiÃ©') {
      window.open(`mailto:${email}?subject=Demande de service`, '_self');
    } else {
      toast({
        title: "Email non disponible",
        description: "Ce prestataire n'a pas encore renseignÃ© son email",
        type: "default"
      });
    }
  };

  const handleVideoCall = (service: Service) => {
    // VÃ©rifier si l'utilisateur a une camÃ©ra
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: "CamÃ©ra non disponible",
        description: "Votre navigateur ne supporte pas les appels vidÃ©o",
        type: "error"
      });
      return;
    }

    // DÃ©marrer l'appel vidÃ©o
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // CrÃ©er une nouvelle fenÃªtre pour l'appel vidÃ©o
        const videoWindow = window.open(
          `/video-call?service=${service.id}&user=${user?.id}`,
          'video-call',
          'width=800,height=600,scrollbars=no,resizable=yes'
        );
        
        if (videoWindow) {
          // Notifier le prestataire AVANT d'ouvrir la fenÃªtre
          sendNotificationToPrestataire(service, 'appel_video');
          
          toast({
            title: "Appel vidÃ©o dÃ©marrÃ©",
            description: "FenÃªtre d'appel vidÃ©o ouverte",
            type: "success"
          });
        } else {
          toast({
            title: "Erreur",
            description: "Impossible d'ouvrir la fenÃªtre d'appel vidÃ©o",
            type: "error"
          });
        }
      })
      .catch((error) => {
        console.error('Erreur accÃ¨s camÃ©ra:', error);
        toast({
          title: "Erreur camÃ©ra",
          description: "Impossible d'accÃ©der Ã  votre camÃ©ra. VÃ©rifiez les permissions.",
          type: "error"
        });
      });
  };

  // Fonction pour dÃ©marrer l'enregistrement audio avec dÃ©lai
  const startAudioRecording = () => {
    if (isRecording) return;
    
    // Enregistrer le moment oÃ¹ l'utilisateur commence Ã  maintenir
    setHoldStartTime(Date.now());
    
    // DÃ©marrer l'enregistrement aprÃ¨s un dÃ©lai de 300ms
    const timer = setTimeout(async () => {
      try {
        // RÃ©initialiser le compteur
        setRecordingSeconds(0);
        
        // Demander les permissions audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // CrÃ©er le MediaRecorder
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          // CrÃ©er et envoyer le message audio automatiquement
          const audioMessage = {
            id: Date.now().toString(),
            type: 'audio',
            content: 'ðŸŽµ Message audio',
            timestamp: new Date().toISOString(),
            sender: 'client',
            from: 'client',
            isLocal: true,
            audioBlob: audioBlob,
            audioUrl: audioUrl
          };
          
          // Ajouter le message au chat localement
          setChatMessages(prev => [...prev, audioMessage]);
          
          // Nettoyer les chunks audio
          setAudioChunks([]);
          
          // ArrÃªter tous les tracks audio
          stream.getTracks().forEach(track => track.stop());
          
          // ArrÃªter le compteur
          setRecordingSeconds(0);
          
          // Envoyer via l'API en arriÃ¨re-plan
          sendAudioMessageInBackground(audioBlob, audioMessage.id);
        };
        
        // DÃ©marrer l'enregistrement
        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        
        // DÃ©marrer le compteur de secondes
        const interval = setInterval(() => {
          setRecordingSeconds(prev => prev + 1);
        }, 1000);
        
        // ArrÃªter automatiquement aprÃ¨s 60 secondes
        setTimeout(() => {
          if (recorder.state === 'recording') {
            clearInterval(interval);
            stopAudioRecording();
          }
        }, 60000);
        
        // Stocker l'interval pour le nettoyer
        recorder.addEventListener('stop', () => clearInterval(interval));
        
      } catch (error) {
        console.error('Erreur accÃ¨s microphone:', error);
        toast({
          title: "Erreur microphone",
          description: "Impossible d'accÃ©der au microphone. VÃ©rifiez les permissions.",
          type: "error"
        });
      }
    }, 300); // DÃ©lai de 300ms avant de dÃ©marrer l'enregistrement
    
    setRecordingTimer(timer);
  };

  // Fonction pour arrÃªter l'enregistrement audio
  const stopAudioRecording = () => {
    // Annuler le timer si l'enregistrement n'a pas encore commencÃ©
    if (recordingTimer) {
      clearTimeout(recordingTimer);
      setRecordingTimer(null);
    }
    
    // RÃ©initialiser le temps de maintien
    setHoldStartTime(null);
    
    if (!isRecording || !mediaRecorder) return;
    
    try {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      setIsRecording(false);
      
      // L'enregistrement sera automatiquement envoyÃ© via l'Ã©vÃ©nement onstop
      // Pas besoin d'appeler sendAudioMessage ici
      
    } catch (error) {
      console.error('Erreur arrÃªt enregistrement:', error);
    }
  };

  // Fonction pour annuler l'enregistrement si l'utilisateur relÃ¢che trop tÃ´t
  const cancelRecording = () => {
    if (recordingTimer) {
      clearTimeout(recordingTimer);
      setRecordingTimer(null);
    }
    setHoldStartTime(null);
    
    if (isRecording && mediaRecorder) {
      try {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
        setIsRecording(false);
      } catch (error) {
        console.error('Erreur annulation enregistrement:', error);
      }
    }
  };

  // Fonction pour envoyer le message audio
  const sendAudioMessage = async () => {
    if (!audioChunks.length || !selectedService) return;
    
    try {
      // CrÃ©er un Blob Ã  partir des chunks audio
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      
      // CrÃ©er un message local immÃ©diatement
      const audioMessage = {
        id: Date.now().toString(),
        type: 'audio',
        content: 'ðŸŽµ Message audio',
        timestamp: new Date().toISOString(),
        sender: 'client',
        from: 'client',
        isLocal: true,
        audioBlob: audioBlob,
        audioUrl: URL.createObjectURL(audioBlob) // CrÃ©er l'URL pour l'affichage
      };
      
      // Ajouter le message au chat localement
      setChatMessages(prev => [...prev, audioMessage]);
      
      // Nettoyer les chunks audio
      setAudioChunks([]);
      
      // Envoyer via l'API - Correction de l'endpoint
      const formData = new FormData();
      formData.append('audio', audioBlob, 'message_audio.wav');
      formData.append('message_type', 'audio');
      formData.append('service_id', selectedService.id.toString());
      formData.append('user_id', user?.id?.toString() || '');
      
      const response = await fetch(`/api/services/${selectedService.id}/audio-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (response.ok) {
        // Marquer le message comme envoyÃ©
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === audioMessage.id 
              ? { ...msg, isLocal: false, status: 'sent' }
              : msg
          )
        );
        
        // Nettoyer les chunks audio aprÃ¨s envoi rÃ©ussi
        setAudioChunks([]);
        
        toast({
          title: "Message audio envoyÃ©",
          description: "Votre message audio a Ã©tÃ© envoyÃ© avec succÃ¨s",
          type: "success"
        });
      } else {
        throw new Error('Erreur envoi audio');
      }
      
    } catch (error) {
      console.error('Erreur envoi audio:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'envoi du message audio",
        type: "error"
      });
    }
  };

  // Fonction pour envoyer le message audio en arriÃ¨re-plan
  const sendAudioMessageInBackground = async (audioBlob: Blob, messageId: string) => {
    try {
      // Envoyer via l'API
      const formData = new FormData();
      formData.append('audio', audioBlob, 'message_audio.wav');
      formData.append('message_type', 'audio');
      formData.append('service_id', selectedService?.id?.toString() || '');
      formData.append('user_id', user?.id?.toString() || '');
      
      const response = await fetch(`/api/services/${selectedService?.id}/audio-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (response.ok) {
        // Marquer le message comme envoyÃ©
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, isLocal: false, status: 'sent' }
              : msg
          )
        );
        
        // Notification discrÃ¨te
        toast({
          title: "Audio envoyÃ©",
          description: "Message audio envoyÃ© avec succÃ¨s",
          type: "success"
        });
      } else {
        throw new Error('Erreur envoi audio');
      }
      
    } catch (error) {
      console.error('Erreur envoi audio en arriÃ¨re-plan:', error);
      
      // Marquer le message comme en erreur
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'error' }
            : msg
        )
      );
      
      // Notification d'erreur discrÃ¨te
      toast({
        title: "Erreur envoi",
        description: "Erreur lors de l'envoi du message audio",
        type: "error"
      });
    }
  };

  // Fonction pour gÃ©rer l'upload d'images et vidÃ©os
  const handleImageVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !selectedService) return;

    setUploadingFiles(true);
    
    try {
      for (const file of Array.from(files)) {
        // VÃ©rifier la taille du fichier (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "Fichier trop volumineux",
            description: `${file.name} dÃ©passe la limite de 10MB`,
            type: "error"
          });
          continue;
        }

        // CrÃ©er un message local
        const message = {
          id: Date.now().toString() + Math.random(),
          from: 'client',
          content: file.type.startsWith('image/') ? 'ðŸ¼ Image' : 'ðŸ¥ VidÃ©o',
          timestamp: new Date(),
          status: 'sent',
          type: file.type.startsWith('image/') ? 'image' : 'video',
          fileUrl: URL.createObjectURL(file),
          fileName: file.name,
          fileSize: file.size
        };

        // Ajouter le message localement
        setChatMessages(prev => [...prev, message]);

        // CrÃ©er un FormData pour envoyer le fichier
        const formData = new FormData();
        formData.append('file', file);
        formData.append('service_id', selectedService.id.toString());
        formData.append('user_id', user?.id?.toString() || '');
        formData.append('type', file.type.startsWith('image/') ? 'image' : 'video');

        // Envoyer le fichier via l'API
        const response = await fetch(`/api/services/${selectedService.id}/file-message`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (response.ok) {
          // Marquer comme livrÃ©
          setChatMessages(prev => 
            prev.map(msg => 
              msg.id === message.id ? { ...msg, status: 'delivered' } : msg
            )
          );
        }
      }

      toast({
        title: "Fichiers envoyÃ©s",
        description: "Vos fichiers ont Ã©tÃ© envoyÃ©s avec succÃ¨s",
        type: "success"
      });
    } catch (error) {
      console.error('Erreur envoi fichiers:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'envoi des fichiers",
        type: "error"
      });
    } finally {
      setUploadingFiles(false);
      // RÃ©initialiser l'input
      event.target.value = '';
    }
  };

  // Fonction pour gÃ©rer l'upload de documents
  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !selectedService) return;

    setUploadingFiles(true);
    
    try {
      for (const file of Array.from(files)) {
        // VÃ©rifier la taille du fichier (max 25MB)
        if (file.size > 25 * 1024 * 1024) {
          toast({
            title: "Document trop volumineux",
            description: `${file.name} dÃ©passe la limite de 25MB`,
            type: "error"
          });
          continue;
        }

        // CrÃ©er un message local
        const message = {
          id: Date.now().toString() + Math.random(),
          from: 'client',
          content: 'ðŸ" Document',
          timestamp: new Date(),
          status: 'sent',
          type: 'document',
          fileUrl: URL.createObjectURL(file),
          fileName: file.name,
          fileSize: file.size
        };

        // Ajouter le message localement
        setChatMessages(prev => [...prev, message]);

        // CrÃ©er un FormData pour envoyer le document
        const formData = new FormData();
        formData.append('file', file);
        formData.append('service_id', selectedService.id.toString());
        formData.append('user_id', user?.id?.toString() || '');
        formData.append('type', 'document');

        // Envoyer le document via l'API
        const response = await fetch(`/api/services/${selectedService.id}/file-message`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (response.ok) {
          // Marquer comme livrÃ©
          setChatMessages(prev => 
            prev.map(msg => 
              msg.id === message.id ? { ...msg, status: 'delivered' } : msg
            )
          );
        }
      }

      toast({
        title: "Documents envoyÃ©s",
        description: "Vos documents ont Ã©tÃ© envoyÃ©s avec succÃ¨s",
        type: "success"
      });
    } catch (error) {
      console.error('Erreur envoi documents:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'envoi des documents",
        type: "error"
      });
    } finally {
      setUploadingFiles(false);
      // RÃ©initialiser l'input
      event.target.value = '';
    }
  };

  // Fonction pour charger la galerie du prestataire
  const loadPrestataireGallery = async () => {
    if (!selectedService) return;

    setLoadingGallery(true);
    try {
      // RÃ©cupÃ©rer les mÃ©dias du service depuis l'API
      const response = await fetch(`/api/services/${selectedService.id}/media`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const media = await response.json();
        setPrestataireGallery(media);
      } else {
        // Fallback: utiliser les donnÃ©es du service
        const serviceMedia = [];
        
        // VÃ©rifier et traiter les rÃ©alisations
        if (selectedService.data?.realisations && Array.isArray(selectedService.data.realisations)) {
          serviceMedia.push(...selectedService.data.realisations);
        } else if (selectedService.data?.realisations && typeof selectedService.data.realisations === 'object') {
          // Si c'est un ServiceField, extraire la valeur
          const realisationsValue = getServiceFieldValue(selectedService.data.realisations);
          if (Array.isArray(realisationsValue)) {
            serviceMedia.push(...realisationsValue);
          }
        }
        
        // VÃ©rifier et traiter les vidÃ©os
        if (selectedService.data?.videos && Array.isArray(selectedService.data.videos)) {
          serviceMedia.push(...selectedService.data.videos);
        } else if (selectedService.data?.videos && typeof selectedService.data.videos === 'object') {
          // Si c'est un ServiceField, extraire la valeur
          const videosValue = getServiceFieldValue(selectedService.data.videos);
          if (Array.isArray(videosValue)) {
            serviceMedia.push(...videosValue);
          }
        }
        
        setPrestataireGallery(serviceMedia);
      }
    } catch (error) {
      console.error('Erreur chargement galerie:', error);
      // Fallback: utiliser les donnÃ©es du service
      const serviceMedia = [];
      
      // VÃ©rifier et traiter les rÃ©alisations
      if (selectedService.data?.realisations && Array.isArray(selectedService.data.realisations)) {
        serviceMedia.push(...selectedService.data.realisations);
      } else if (selectedService.data?.realisations && typeof selectedService.data.realisations === 'object') {
        // Si c'est un ServiceField, extraire la valeur
        const realisationsValue = getServiceFieldValue(selectedService.data.realisations);
        if (Array.isArray(realisationsValue)) {
          serviceMedia.push(...realisationsValue);
        }
      }
      
      // VÃ©rifier et traiter les vidÃ©os
      if (selectedService.data?.videos && Array.isArray(selectedService.data.videos)) {
        serviceMedia.push(...selectedService.data.videos);
      } else if (selectedService.data?.videos && typeof selectedService.data.videos === 'object') {
        // Si c'est un ServiceField, extraire la valeur
        const videosValue = getServiceFieldValue(selectedService.data.videos);
        if (Array.isArray(videosValue)) {
          serviceMedia.push(...videosValue);
        }
      }
      
      setPrestataireGallery(serviceMedia);
    } finally {
      setLoadingGallery(false);
    }
  };

  // Fonction pour envoyer un mÃ©dia de la galerie du prestataire
  const sendGalleryMedia = async (mediaItem: any) => {
    if (!selectedService) return;

    try {
      // CrÃ©er un message local
      const message = {
        id: Date.now().toString() + Math.random(),
        from: 'prestataire',
        content: mediaItem.type === 'image' ? 'ðŸ¼ RÃ©alisation' : 'ðŸ¥ VidÃ©o de prÃ©sentation',
        timestamp: new Date(),
        status: 'sent',
        type: mediaItem.type === 'image' ? 'image' : 'video',
        fileUrl: mediaItem.url || mediaItem.valeur,
        fileName: mediaItem.label || mediaItem.nom || 'MÃ©dia',
        fileSize: mediaItem.size || 0
      };

      // Ajouter le message localement
      setChatMessages(prev => [...prev, message]);

      // Envoyer une notification au prestataire
      await sendNotificationToPrestataire(selectedService, 'gallery_media_shared');

      toast({
        title: "MÃ©dia partagÃ©",
        description: "Le mÃ©dia a Ã©tÃ© partagÃ© dans le chat",
        type: "success"
      });

      // Fermer la galerie
      setShowPrestataireGallery(false);
    } catch (error) {
      console.error('Erreur partage mÃ©dia:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du partage du mÃ©dia",
        type: "error"
      });
    }
  };

  // Fonction pour soumettre un avis et une note
  const handleRatingSubmit = async (rating: number, comment: string) => {
    if (!selectedService || !user?.id) return;

    try {
      // CrÃ©er un avis local
      const review: Review = {
        id: Date.now(),
        service_id: selectedService.id,
        user_id: Number(user.id),
        user_name: user.name || `Utilisateur #${user.id}`,
        user_avatar: undefined, // Pas de propriÃ©tÃ© avatar_url dans User
        rating,
        comment,
        created_at: new Date().toISOString(),
        helpful_count: 0,
        reported: false
      };

      // Ajouter l'avis localement
      setServices(prev => 
        prev.map(service => 
          service.id === selectedService.id 
            ? {
                ...service,
                reviews: [...(service.reviews || []), review],
                user_rating: rating
              }
            : service
        )
      );

      // Envoyer l'avis via l'API
      const response = await fetch(`/api/services/${selectedService.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          rating,
          comment,
          user_id: user.id
        })
      });

      if (response.ok) {
        toast({
          title: "Avis envoyÃ©",
          description: "Votre avis a Ã©tÃ© enregistrÃ© avec succÃ¨s",
          type: "success"
        });

        // Notifier le prestataire
        await sendNotificationToPrestataire(selectedService, 'new_review');
      } else {
        throw new Error('Erreur lors de l\'envoi de l\'avis');
      }
    } catch (error) {
      console.error('Erreur envoi avis:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'envoi de l'avis",
        type: "error"
      });
    }
  };

  // Fonction pour marquer un avis comme utile
  const handleReviewHelpful = async (reviewId: number) => {
    if (!selectedService) return;

    try {
      // Mettre Ã  jour localement
      setServices(prev => 
        prev.map(service => 
          service.id === selectedService.id 
            ? {
                ...service,
                reviews: service.reviews?.map(review => 
                  review.id === reviewId 
                    ? { ...review, helpful_count: review.helpful_count + 1 }
                    : review
                )
              }
            : service
        )
      );

      // Envoyer la mise Ã  jour via l'API
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        console.warn('Erreur mise Ã  jour avis utile');
      }
    } catch (error) {
      console.error('Erreur avis utile:', error);
    }
  };

  // Fonction pour supprimer un message
  const deleteMessage = async (messageId: string) => {
    try {
      // Supprimer le message localement
      setChatMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Si le message a Ã©tÃ© envoyÃ© au serveur, l'effacer aussi
      if (selectedService) {
        const response = await fetch(`/api/services/${selectedService.id}/messages/${messageId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          toast({
            title: "Message supprimÃ©",
            description: "Le message a Ã©tÃ© supprimÃ© avec succÃ¨s",
            type: "success"
          });
        }
      }
    } catch (error) {
      console.error('Erreur suppression message:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le message",
        type: "error"
      });
    }
  };

  const handleShare = (service: Service) => {
    if (navigator.share) {
      navigator.share({
        title: getServiceFieldValue(service.data?.titre_service),
        text: getServiceFieldValue(service.data?.description),
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Lien copiÃ©",
        description: "Le lien du service a Ã©tÃ© copiÃ© dans le presse-papiers",
        type: "default"
      });
    }
  };

  const handleFavorite = (service: Service) => {
    toast({
      title: "Favori",
      description: "FonctionnalitÃ© de favoris en cours de dÃ©veloppement",
      type: "default"
    });
  };

  const formatMessageTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return '--:--';
      }
      return dateObj.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return '--:--';
    }
  };

  // Effet pour fermer le menu de contact quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contactMenuOpen !== null) {
        setContactMenuOpen(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contactMenuOpen]);

  // Gestion du mode hors ligne
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Synchroniser les messages hors ligne
      syncOfflineMessages();
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast({
        title: "Mode hors ligne",
        description: "Vous Ãªtes hors ligne. Les messages seront synchronisÃ©s Ã  la reconnexion.",
        type: "default"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Synchroniser les messages hors ligne
  const syncOfflineMessages = async () => {
    if (offlineMessages.length === 0) return;

    try {
      for (const offlineMsg of offlineMessages) {
        if (offlineMsg.type === 'text') {
          // Envoyer le message texte
          await fetch(`/api/services/${offlineMsg.serviceId}/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              user_id: user?.id,
              content: offlineMsg.content
            })
          });
        } else if (offlineMsg.type === 'audio' && offlineMsg.audioBlob) {
          // Envoyer le message audio
          const formData = new FormData();
          formData.append('audio', offlineMsg.audioBlob, 'message_audio.wav');
          formData.append('service_id', offlineMsg.serviceId.toString());
          formData.append('user_id', user?.id?.toString() || '');

          await fetch(`/api/services/${offlineMsg.serviceId}/audio-message`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
          });
        }
      }

      // Vider la liste des messages hors ligne
      setOfflineMessages([]);
      
      toast({
        title: "Synchronisation terminÃ©e",
        description: `${offlineMessages.length} messages ont Ã©tÃ© synchronisÃ©s`,
        type: "success"
      });
    } catch (error) {
      console.error('Erreur synchronisation:', error);
      toast({
        title: "Erreur synchronisation",
        description: "Certains messages n'ont pas pu Ãªtre synchronisÃ©s",
        type: "error"
      });
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Recherche des services en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout padding={false}>
      <div className="container mx-auto px-4 py-8">
        {/* Header avec bouton retour */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour Ã  l'accueil
            </Button>
          </div>
        </div>

      {/* Header avec statistiques et gÃ©olocalisation */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Services correspondants Ã  votre besoin
        </h1>
        <div className="flex justify-center items-center gap-8 text-gray-600 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>{services.length} service{services.length > 1 ? 's' : ''} trouvÃ©{services.length > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <span>RÃ©sultats en temps rÃ©el</span>
          </div>
          

        </div>
        
        {/* Bouton de gÃ©olocalisation */}
        <div className="flex justify-center">
          <Button
            onClick={async () => {
              const userLocation = await getUserLocation();
              if (userLocation) {
                toast({
                  title: "GÃ©olocalisation activÃ©e",
                  description: `Position: ${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`,
                  type: "default"
                });
                // Recharger les rÃ©sultats avec le tri par proximitÃ©
                if (location.state?.results) {
                  const sortedResults = await sortResultsByRelevanceAndProximity(location.state.results);
                  const serviceIds = sortedResults
                    .map((result: any) => result.service_id)
                    .filter((id: any) => id && id !== 'undefined')
                    .map((id: any) => id.toString());
                  if (serviceIds.length > 0) {
                    fetchServicesByIds(serviceIds, sortedResults);
                  }
                }
              } else {
                toast({
                  title: "GÃ©olocalisation Ã©chouÃ©e",
                  description: "Impossible de rÃ©cupÃ©rer votre position",
                  type: "error"
                });
              }
            }}
            variant="outline"
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 hover:from-blue-600 hover:to-purple-700"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Activer la gÃ©olocalisation pour trier par proximitÃ©
          </Button>
        </div>
      </div>

      {error && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Erreur de chargement</h3>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <Button onClick={() => navigate('/besoins')} className="px-6">
              Retour aux besoins
            </Button>
          </CardContent>
        </Card>
      )}

      {(!services || services.length === 0) ? (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Aucun service trouvÃ©</h3>
            <p className="text-gray-600 mb-6">
              Aucun prestataire ne correspond Ã  vos critÃ¨res pour le moment.
            </p>
            <Button onClick={() => navigate('/besoins')} className="px-6">
              Retour aux besoins
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-center">
          <div className={`grid gap-6 ${
            services.length === 1 ? 'grid-cols-1' : 
            services.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          } max-w-7xl`}>
            {Array.isArray(services) && services.map((service) => (
              <Card 
                key={service.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg border-2 border-gray-200 hover:border-blue-300 ${
                  service.is_active ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                {/* BanniÃ¨re en arriÃ¨re-plan */}
                {hasValidMediaField(service.data?.banniere) && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-15 transition-opacity duration-300 group-hover:opacity-25"
                    style={{ 
                      backgroundImage: `url(${getServiceFieldValue(service.data?.banniere)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                )}
                
                {/* Overlay pour maintenir la lisibilitÃ© */}
                <div className="relative bg-white/95 backdrop-blur-sm min-h-full">
                  {/* Logo avatar en haut Ã  droite - uniquement s'il existe */}
                  {hasValidMediaField(service.data?.logo) && (
                    <div className="absolute top-2 right-2 z-30">
                      <div className="w-14 h-14 rounded-full border-3 border-white shadow-lg overflow-hidden bg-white">
                        <img 
                          src={getServiceFieldValue(service.data?.logo)} 
                          className="w-full h-full object-cover"
                          alt="Logo du service"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Indicateur de proximitÃ© - position dynamique selon la prÃ©sence du logo et WebSocket */}
                  {service.distance !== undefined && service.distance < Infinity && (
                    <div className={`absolute left-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-medium z-20 shadow-md ${
                      hasValidMediaField(service.data?.logo) ? 'top-20' : (wsConnected ? 'top-8' : 'top-2')
                    }`}>
                      ðŸ" {service.distance < 1 ? '< 1km' : `${Math.round(service.distance)}km`}
                    </div>
                  )}
                  
                  {/* Indicateur de promotion - position dynamique selon la prÃ©sence du logo */}
                  {service.promotion && service.promotion.active && (
                    <div className={`absolute right-3 bg-gradient-to-r from-orange-400 to-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold z-20 shadow-lg ${
                      hasValidMediaField(service.data?.logo) ? 'top-20' : 'top-8'
                    }`}>
                      ðŸŽ‰ {service.promotion.type === 'reduction' ? service.promotion.valeur : 'Promo'}
                    </div>
                  )}
                  
                  {/* Indicateur de connectivitÃ© WebSocket - CentrÃ© horizontalement en haut avec ajustement automatique */}
                  {wsConnected && (
                    <div className={`absolute left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-medium z-20 shadow-md ${
                      hasValidMediaField(service.data?.logo) ? 'top-1' : 'top-0.5'
                    }`}>
                      ðŸ" Live
                    </div>
                  )}
                

                
                <CardHeader className={`pb-4 ${calculateHeaderPadding(hasValidMediaField(service.data?.logo), wsConnected)}`}>
                  {/* En-tÃªte avec titre et actions */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2">
                        {getServiceFieldValue(service.data?.titre_service)}
                      </CardTitle>
                    </div>
                    <div className="flex gap-2 ml-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFavorite(service)}
                        className="text-gray-400 hover:text-red-500"
                        title="Ajouter aux favoris"
                      >
                        <Heart className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShare(service)}
                        className="text-gray-400 hover:text-blue-500"
                        title="Partager"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Badges et mÃ©tadonnÃ©es optimisÃ©s */}
                  <div className="flex flex-wrap gap-2 mb-3 justify-between items-center">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        <Tag className="w-3 h-3 mr-1" />
                        {getServiceFieldValue(service.data?.category)}
                      </Badge>
                      {getServiceFieldValue(service.data?.is_tarissable) === 'Oui' && (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          ðŸ° Tarissable
                        </Badge>
                      )}
                      {/* Badge de promotion */}
                      {service.promotion && service.promotion.active && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                          ðŸŽ‰ {service.promotion.type === 'reduction' ? service.promotion.valeur : 'Promotion'}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Date de crÃ©ation en haut Ã  droite */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                      <Calendar className="w-3 h-3" />
                      {formatDate(service.created_at)}
                    </div>
                  </div>

                  {/* Informations de localisation optimisÃ©es */}
                  <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                    <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="font-medium text-gray-800 flex-1 min-w-0" title="Localisation du service">
                      <AsyncLocationDisplay service={service} prestataires={prestataires} user={user} />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Section prestataire avec nom et statut */}
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 mb-4 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 ring-2 ring-blue-200">
                        {prestataires.get(service.user_id)?.avatar_url ? (
                          <AvatarImage src={prestataires.get(service.user_id)?.avatar_url} />
                        ) : prestataires.get(service.user_id)?.photo_profil ? (
                          <AvatarImage src={prestataires.get(service.user_id)?.photo_profil} />
                        ) : null}
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                          {prestataires.get(service.user_id)?.nom_complet?.charAt(0).toUpperCase() || 
                           (service.user_id ? service.user_id.toString().charAt(0).toUpperCase() : '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {prestataires.get(service.user_id)?.nom_complet || 
                           getServiceFieldValue(service.data?.nom_prestataire) || 
                           `Prestataire #${service.user_id}`}
                        </h4>
                        <div className="flex items-center gap-1 mt-1">
                          {wsConnected ? (
                            userStatus?.status === 'online' ? (
                              <>
                                <Wifi className="w-3 h-3 text-green-500" />
                                <span className="text-green-600 text-sm font-medium">En ligne</span>
                              </>
                            ) : (
                              <>
                                <WifiOff className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-500 text-sm">Hors ligne</span>
                              </>
                            )
                          ) : (
                            <>
                              <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
                              <span className="text-gray-400 text-sm">VÃ©rification...</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description du service */}
                  <div className="mb-4">
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {getServiceFieldValue(service.data?.description)}
                    </p>
                  </div>

                  {/* Galerie mÃ©dia du service */}
                  <div className="mb-4">
                    <ServiceMediaGallery
                      logo={undefined}
                      banniere={undefined}
                      images_realisations={getServiceMediaValue(service.data?.images_realisations)}
                      videos={getServiceMediaValue(service.data?.videos)}
                      className="bg-gray-50 rounded-lg p-3"
                    />
                  </div>

                  {/* Action principale - Chat interne moderne et parlant */}
                  <div className="mb-4">
                    <Button
                      onClick={() => handleChat(service)}
                      className="w-full bg-white hover:bg-gray-50 text-gray-800 shadow-lg py-6 text-lg font-semibold rounded-2xl transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-0"
                      size="lg"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer">
                          <MessageSquare className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-wide text-center min-w-0 flex-1 truncate text-gray-800">
                          Contacter le prestataire
                        </span>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></div>
                      </div>
                    </Button>
                  </div>

                  {/* Autres contacts utiles */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">ðŸ" Autres contacts utiles</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {/* WhatsApp - Seulement si le tÃ©lÃ©phone existe */}
                      {getServiceFieldValue(service.data?.telephone) && getServiceFieldValue(service.data?.telephone) !== 'Non spÃ©cifiÃ©' && (
                        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 hover:shadow-md transition-all duration-200">
                          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.87 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">WhatsApp</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{getServiceFieldValue(service.data?.telephone)}</p>
                          </div>
                          <Button
                            onClick={() => handleWhatsApp(service)}
                            size="sm"
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 py-1.5 text-xs font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            Ouvrir
                          </Button>
                        </div>
                      )}
                      
                      {/* TÃ©lÃ©phone - Seulement si le tÃ©lÃ©phone existe */}
                      {getServiceFieldValue(service.data?.telephone) && getServiceFieldValue(service.data?.telephone) !== 'Non spÃ©cifiÃ©' && (
                        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:shadow-md transition-all duration-200">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                            <Phone className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">TÃ©lÃ©phone</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{getServiceFieldValue(service.data?.telephone)}</p>
                          </div>
                          <Button
                            onClick={() => handleCall(service)}
                            size="sm"
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-3 py-1.5 text-xs font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            Appeler
                          </Button>
                        </div>
                      )}
                      
                      {/* Email - Seulement si l'email existe */}
                      {getServiceFieldValue(service.data?.email) && getServiceFieldValue(service.data?.email) !== 'Non spÃ©cifiÃ©' && (
                        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 hover:shadow-md transition-all duration-200">
                          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
                            <Mail className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Email</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{getServiceFieldValue(service.data?.email)}</p>
                          </div>
                          <Button
                            onClick={() => handleEmail(service)}
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-3 py-1.5 text-xs font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            Envoyer
                          </Button>
                        </div>
                      )}
                      
                      {/* Site web - Seulement si le site web existe */}
                      {getServiceFieldValue(service.data?.website) && getServiceFieldValue(service.data?.website) !== 'Non spÃ©cifiÃ©' && (
                        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 hover:shadow-md transition-all duration-200">
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full flex items-center justify-center shadow-lg">
                            <Globe className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Site web</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{getServiceFieldValue(service.data?.website)}</p>
                          </div>
                          <Button
                            onClick={() => window.open(getServiceFieldValue(service.data?.website), '_blank')}
                            size="sm"
                            className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white px-3 py-1.5 text-xs font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            Visiter
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Section notation et avis */}
                  <div className="border-t pt-4">
                    <ServiceRating
                      service={service}
                      onRatingSubmit={handleRatingSubmit}
                      onReviewHelpful={handleReviewHelpful}
                      className="mb-3"
                    />
                  </div>
                </CardContent>
                </div> {/* Fermeture de l'overlay */}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Footer informatif */}
      {services.length > 0 && (
        <div className="mt-12 text-center">
          <div className="max-w-2xl mx-auto p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              Comment procÃ©der ?
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-700">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">1</div>
                <span>Choisissez le service qui vous convient</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">2</div>
                <span>Contactez le prestataire via le bouton</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">3</div>
                <span>Ã‰changez et finalisez votre projet</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de contact */}
      {selectedService && showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Contacter le prestataire</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowContactModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                âœ•
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                <strong>Service :</strong> {getServiceFieldValue(selectedService.data?.titre_service)}
              </p>
              <p className="text-gray-600 mb-2">
                <strong>Prestataire :</strong> {getServiceFieldValue(selectedService.data?.nom_prestataire) || `#${selectedService.user_id}`}
              </p>
              <p className="text-gray-600">
                <strong>Localisation :</strong> {getServiceFieldValue(selectedService.data?.gps_fixe)}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => handleCall(selectedService)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Phone className="w-4 h-4 mr-2" />
                Appeler
              </Button>
              
              <Button
                onClick={() => handleEmail(selectedService)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                Envoyer un email
              </Button>
              
              <Button
                onClick={() => handleVideoCall(selectedService)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Video className="w-4 h-4 mr-2" />
                Appel vidÃ©o
              </Button>
            </div>

            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => setShowContactModal(false)}
                className="w-full"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de chat intÃ©grÃ© */}
      {selectedService && showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl h-96 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-500 text-white text-sm">
                    {selectedService.user_id.toString().charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {getServiceFieldValue(selectedService.data?.nom_prestataire) || `Prestataire #${selectedService.user_id}`}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {/* Statut WebSocket */}
                    {wsConnected ? (
                      <>
                        <Wifi className="w-3 h-3 text-green-500" />
                        <span className="text-green-600">En ligne</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-500">Hors ligne</span>
                      </>
                    )}
                    <span>â€¢</span>
                    <span>{getServiceFieldValue(selectedService.data?.titre_service) || 'Service'}</span>
                    {getServiceFieldValue(selectedService.data?.category) && (
                      <>
                        <span>â€¢</span>
                        <span className="text-blue-600">{getServiceFieldValue(selectedService.data?.category)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Boutons d'action audio/vidÃ©o */}
              <div className="flex items-center gap-2">
                {/* Appel audio */}
                {getServiceFieldValue(selectedService.data?.telephone) && getServiceFieldValue(selectedService.data?.telephone) !== 'Non spÃ©cifiÃ©' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCall(selectedService)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    title="Appel audio"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                )}
                
                {/* Appel vidÃ©o */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVideoCall(selectedService)}
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  title="Appel vidÃ©o"
                >
                  <Video className="w-4 h-4" />
                </Button>
                
                {/* Fermer */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChatModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  âœ•
                </Button>
              </div>
            </div>
            
            <div className="flex-1 p-4 bg-gray-50 overflow-y-auto space-y-3">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.from === 'client' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg ${
                      message.from === 'client'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-800 border'
                    }`}
                  >
                    {/* Affichage selon le type de message */}
                    {message.type === 'audio' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">ðŸŽµ</span>
                        <audio 
                          controls 
                          className="max-w-full"
                          src={message.audioUrl || (message.audioBlob ? URL.createObjectURL(message.audioBlob) : '')}
                        >
                          Votre navigateur ne supporte pas l'Ã©lÃ©ment audio.
                        </audio>
                      </div>
                    ) : message.type === 'image' ? (
                      <div className="space-y-2">
                        <img 
                          src={message.fileUrl} 
                          alt={message.fileName || 'Image'}
                          className="max-w-full rounded-lg shadow-sm"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden text-xs opacity-70">
                          ðŸ¼ {message.fileName || 'Image'}
                        </div>
                      </div>
                    ) : message.type === 'video' ? (
                      <div className="space-y-2">
                        <video 
                          controls 
                          className="max-w-full rounded-lg shadow-sm"
                          src={message.fileUrl}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        >
                          Votre navigateur ne supporte pas l'Ã©lÃ©ment vidÃ©o.
                        </video>
                        <div className="hidden text-xs opacity-70">
                          ðŸ¥ {message.fileName || 'VidÃ©o'}
                        </div>
                      </div>
                    ) : message.type === 'document' ? (
                      <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{message.fileName || 'Document'}</p>
                          <p className="text-xs text-gray-500">
                            {message.fileSize ? `${(message.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Document'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(message.fileUrl, '_blank')}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Ouvrir
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                    
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs opacity-70">
                        {formatMessageTime(message.timestamp)}
                      </span>
                      {message.from === 'client' && (
                        <div className="flex items-center gap-1">
                          {message.status === 'sent' && <Eye className="w-3 h-3" />}
                          {message.status === 'delivered' && <Eye className="w-3 h-3" />}
                          {message.status === 'read' && <EyeOff className="w-3 h-3" />}
                          
                          {/* Bouton de suppression */}
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="text-red-500 hover:text-red-700 ml-2"
                            title="Supprimer le message"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                {/* Bouton audio intelligent unique - GÃ¨re tout automatiquement */}
                <Button
                  variant="ghost"
                  size="sm"
                  onMouseDown={startAudioRecording}
                  onMouseUp={stopAudioRecording}
                  onMouseLeave={cancelRecording}
                  onTouchStart={startAudioRecording}
                  onTouchEnd={stopAudioRecording}
                  onTouchCancel={cancelRecording}
                  className={`${
                    isRecording 
                      ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg scale-110' 
                      : holdStartTime && !isRecording
                      ? 'bg-yellow-400 text-white hover:bg-yellow-500 shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-0'
                  } transition-all duration-200 rounded-full w-12 h-12 p-0 flex items-center justify-center relative`}
                  title={
                    isRecording 
                      ? "ðŸŽ™ RelÃ¢chez pour arrÃªter et envoyer" 
                      : holdStartTime && !isRecording
                      ? "ðŸŽ™ Continuez Ã  maintenir pour enregistrer..."
                      : "ðŸŽ™ Maintenez enfoncÃ© pour enregistrer, relÃ¢chez pour envoyer"
                  }
                >
                  {isRecording ? (
                    <div className="flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    </div>
                  ) : holdStartTime && !isRecording ? (
                    <div className="flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
                    </div>
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                  
                  {/* Compteur de secondes */}
                  {isRecording && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                      {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                  
                  {/* Indicateur "Maintenez enfoncÃ©" */}
                  {!isRecording && !holdStartTime && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-600 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap opacity-80">
                      Maintenez
                    </div>
                  )}
                  
                  {/* Indicateur "Continuez Ã  maintenir" pendant le dÃ©lai */}
                  {holdStartTime && !isRecording && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                      Continuez...
                    </div>
                  )}
                </Button>

                {/* Bouton d'envoi d'images et vidÃ©os */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => document.getElementById('file-input-images')?.click()}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200"
                  title="Envoyer des images ou vidÃ©os"
                >
                  <Image className="w-5 h-5" />
                </Button>

                {/* Bouton d'envoi de fichiers (doc, pdf, excel, etc.) */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => document.getElementById('file-input-documents')?.click()}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200"
                  title="Envoyer des documents (PDF, Word, Excel, etc.)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </Button>

                {/* Bouton d'accÃ¨s Ã  la galerie du prestataire */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPrestataireGallery(true)}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200"
                  title="Voir la galerie du prestataire"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </Button>
                
                {/* Indicateur d'enregistrement en cours - Plus simple et moderne */}
                {isRecording && (
                  <div className="flex items-center gap-3 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-full border border-red-200">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                    <span className="font-medium">ðŸŽ™ Enregistrement...</span>
                  </div>
                )}
                
                {/* Zone de saisie de texte */}
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Tapez votre message..."
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                />
                
                {/* Bouton d'envoi */}
                <Button 
                  onClick={sendChatMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </Button>
              </div>

              {/* Inputs cachÃ©s pour la sÃ©lection de fichiers */}
              <input
                id="file-input-images"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleImageVideoUpload}
                className="hidden"
              />
              
              <input
                id="file-input-documents"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
                multiple
                onChange={handleDocumentUpload}
                className="hidden"
              />
              
              {/* Indicateur de frappe */}
              {isTyping && (
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span>Le prestataire est en train de taper...</span>
                </div>
              )}


            </div>
          </div>
        </div>
      )}

      {/* Modal de galerie du prestataire */}
      {showPrestataireGallery && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl h-96 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold">Galerie du prestataire</h3>
                  <p className="text-sm text-gray-600">
                    RÃ©alisations et vidÃ©os de {getServiceFieldValue(selectedService.data?.nom_prestataire) || `Prestataire #${selectedService.user_id}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (prestataireGallery.length === 0) {
                      loadPrestataireGallery();
                    }
                  }}
                  className="text-blue-600 hover:text-blue-800"
                  disabled={loadingGallery}
                >
                  {loadingGallery ? (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPrestataireGallery(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  âœ•
                </Button>
              </div>
            </div>
            
            <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
              {loadingGallery ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement de la galerie...</p>
                  </div>
                </div>
              ) : prestataireGallery.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h4 className="text-lg font-medium text-gray-600 mb-2">Aucun mÃ©dia disponible</h4>
                    <p className="text-gray-500 mb-4">
                      Ce prestataire n'a pas encore ajoutÃ© de rÃ©alisations ou de vidÃ©os Ã  sa galerie.
                    </p>
                    <Button
                      onClick={loadPrestataireGallery}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      ðŸ" Actualiser
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {prestataireGallery.map((mediaItem, index) => (
                    <div 
                      key={index}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
                      onClick={() => sendGalleryMedia(mediaItem)}
                    >
                      {mediaItem.type === 'image' || mediaItem.url?.includes('image') || mediaItem.valeur?.includes('image') ? (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center">
                          <img 
                            src={mediaItem.url || mediaItem.valeur} 
                            alt={mediaItem.label || mediaItem.nom || `Image ${index + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden w-full h-full bg-gray-200 flex items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center">
                          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      
                      <div className="p-3">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {mediaItem.label || mediaItem.nom || `MÃ©dia ${index + 1}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {mediaItem.type === 'image' ? 'ðŸ¼ Image' : 'ðŸ¥ VidÃ©o'}
                        </p>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendGalleryMedia(mediaItem);
                            }}
                          >
                            ðŸ" Partager dans le chat
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      </div>
    </AppLayout>
  );
};

// Composant pour afficher la localisation de maniÃ¨re asynchrone avec drapeau
        const AsyncLocationDisplay = ({ service, prestataires, user }: { service: any; prestataires: Map<number, any>; user: any }) => {
          const [location, setLocation] = useState<string>('Chargement...');
          const [countryInfo, setCountryInfo] = useState<{ flag: string; code: string }>({ flag: 'ðŸŒ', code: 'XX' });
          const [isLoading, setIsLoading] = useState(true);
        
          useEffect(() => {
            const loadLocation = async () => {
              try {
                setIsLoading(true);
                const result = await formatLocation(service, prestataires, user);
                setLocation(result);
                
                // Obtenir les informations du pays si on a des coordonnÃ©es GPS
                let coords = null;
                if (service?.data?.gps_fixe) {
                  const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
                  if (gpsFixe && gpsFixe.includes(',')) {
                    coords = gpsFixe.split(',').map(Number);
                  }
                }
                
                if (!coords && service?.user_id && prestataires.has(service.user_id)) {
                  const prestataire = prestataires.get(service.user_id);
                  if (prestataire?.gps && prestataire.gps.includes(',')) {
                    coords = prestataire.gps.split(',').map(Number);
                  }
                }
                
                if (coords && coords.length === 2) {
                  const countryData = await getCountryInfo(coords[0], coords[1]);
                  setCountryInfo(countryData);
                }
                
              } catch (error) {
                console.error('âŒ [AsyncLocationDisplay] Erreur:', error);
                setLocation('Erreur de chargement');
              } finally {
                setIsLoading(false);
              }
            };
        
            loadLocation();
          }, [service, prestataires, user]);
        
          // Fonction pour tronquer intelligemment le nom du lieu - VERSION AMÃ‰LIORÃ‰E
          const truncateLocation = (locationText: string, maxLength: number = 35) => {
            if (locationText.length <= maxLength) return locationText;
            
            // Essayer de tronquer Ã  un endroit logique (virgule, tiret, etc.)
            const truncatePoints = [',', ' - ', ' â€" ', ' | ', ' / ', ' â€¢ '];
            for (const point of truncatePoints) {
              const index = locationText.indexOf(point);
              if (index > 0 && index <= maxLength) {
                return locationText.substring(0, index).trim();
              }
            }
            
            // Si pas de point de troncature logique, essayer de garder au moins 2 parties
            const parts = locationText.split(',').map(part => part.trim());
            if (parts.length >= 2) {
              const firstTwo = parts.slice(0, 2).join(', ');
              if (firstTwo.length <= maxLength) {
                return firstTwo;
              }
            }
            
            // Sinon, tronquer simplement
            return locationText.substring(0, maxLength - 3) + '...';
          };
        
          return (
            <span className="inline-flex items-center gap-1 w-full overflow-hidden" title={location}>
              <span className={`${isLoading ? 'text-yellow-600' : 'text-gray-800'} font-medium truncate`}>
                {isLoading ? 'â³ ' : ''}{truncateLocation(location)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 flex-shrink-0">
                {countryInfo.code !== 'XX' && (
                  <span className="font-mono">{countryInfo.code}</span>
                )}
                {/* Affichage du drapeau avec image SVG garantie */}
                {countryInfo.code !== 'XX' && (
                  <img 
                    src={getFlagImageUrl(countryInfo.code)}
                    alt={`Drapeau ${countryInfo.code}`}
                    className="w-4 h-3 object-cover rounded-sm border border-gray-200"
                    title={`Drapeau: ${countryInfo.flag} (Code: ${countryInfo.code})`}
                    onError={(e) => {
                      console.log('âŒ [Drapeau] Erreur chargement:', countryInfo.code, 'URL:', e.currentTarget.src);
                      // Fallback vers emoji si l'image ne charge pas
                      e.currentTarget.style.display = 'none';
                      const emojiSpan = document.createElement('span');
                      emojiSpan.className = 'text-sm ml-1';
                      emojiSpan.textContent = countryInfo.flag;
                      e.currentTarget.parentNode?.appendChild(emojiSpan);
                    }}
                    onLoad={() => {
                      console.log('âœ… [Drapeau] ChargÃ© avec succÃ¨s:', countryInfo.code);
                    }}
                  />
                )}
              </span>
            </span>
          );
        };
