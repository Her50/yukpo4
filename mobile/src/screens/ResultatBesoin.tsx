import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import { useNotificationsWebSocket, usePrestataireStatus } from '@/hooks/useWebSocket';
import { gpsTrackingService } from '@/services/gpsTrackingService';
import { Service } from '@/types/service';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigation } from 'react-router-dom';

// Composants modulaires
import ChatModal from '@/components/chat/ChatModal';
import ContactModal from '@/components/contact/ContactModal';
import GalleryModal from '@/components/gallery/GalleryModal';
import ServiceCard from '@/components/services/ServiceCard';

// Hooks et services
import { usePrestataireInfo } from '@/hooks/usePrestataireInfo';

// Types
interface SearchResult {
  service_id: string;
  score: number;
  semantic_score: number;
  interaction_score: number;
  gps: string;
  distance?: number;
  proximityScore?: number;
}

export const ResultatBesoin: React.FC = () => {
  const navigate = useNavigation();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket et statut
  const userId = user?.id ? parseInt(user.id, 10) : 0;
  const { isConnected: wsConnected, checkUserStatus, userStatus } = usePrestataireStatus(
    isNaN(userId) ? 0 : userId
  );
  const { isConnected: notificationsConnected, notifications } = useNotificationsWebSocket(
    isNaN(userId) ? 0 : userId
  );
  const { prestataires, fetchPrestatairesBatch, loading: prestatairesLoading } = usePrestataireInfo();
  const [prestatairesLoaded, setPrestatairesLoaded] = useState(false);

  // Marquer les prestataires comme chargés quand ils arrivent
  useEffect(() => {
    if (prestataires.size > 0 && !prestatairesLoading) {
      console.log('✅ [ResultatBesoin] Prestataires chargés, mise à jour de l\'état');
      setPrestatairesLoaded(true);
    }
  }, [prestataires.size, prestatairesLoading]);

  // Initialiser le suivi GPS automatique
  useEffect(() => {
    if (user?.id) {
      console.log('🚀 Initialisation du suivi GPS pour l\'utilisateur:', user.id);
      gpsTrackingService.startTracking();

      return () => {
        gpsTrackingService.stopTracking();
      };
    }
    return undefined;
  }, [user?.id]);

  // Récupérer les informations des prestataires quand les services sont chargés
  useEffect(() => {
    console.log('🔄 [ResultatBesoin] useEffect prestataires déclenché:', {
      servicesLength: services.length,
      services: services.map(s => ({
        id: s.id,
        userId: s.user_id,
        // ?? NOUVEAU : Log des données GPS pour déboguer
        gpsData: s.data?.gps_fixe,
        rawGps: s.data?.gps_fixe_coords
      }))
    });

    // ?? NOUVEAU : Log détaillé des coordonnées GPS pour identifier le problème
    services.forEach((service, index) => {
      console.log(`📍 [ResultatBesoin] Service ${index + 1} GPS:`, {
        serviceId: service.id,
        gpsFixe: service.data?.gps_fixe,
        gpsCoords: service.data?.gps_fixe_coords,
        hasGpsData: !!service.data?.gps_fixe,
        hasGpsCoords: !!service.data?.gps_fixe_coords,
        // ?? NOUVEAU : Vérifier si on utilise le GPS en temps réel
        usesRealtimeGPS: !service.data?.gps_fixe && !!service.data?.gps_fixe_coords
      });

      // ?? NOUVEAU : Avertissement si on utilise le GPS en temps réel
      if (!service.data?.gps_fixe && service.data?.gps_fixe_coords) {
        console.warn(`⚠️ [ResultatBesoin] Service ${service.id} utilise le GPS en temps réel au lieu du GPS fixe`);
      }
    });

    if (services.length > 0) {
      const userIds = services.map(service => service.user_id).filter(id => id !== undefined);
      console.log('👥 [ResultatBesoin] UserIDs extraits:', userIds);

      if (userIds.length > 0) {
        console.log('🚀 [ResultatBesoin] Appel fetchPrestatairesBatch avec:', userIds);
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

        // Trier les résultats par score de pertinence et proximité
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

  // Fonction pour récupérer la position de l'utilisateur
  const getUserLocation = (): Promise<{ lat: number, lon: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Géolocalisation non supportée');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lon } = position.coords;
          console.log(`📍 Position utilisateur: ${lat}, ${lon}`);
          resolve({ lat, lon });
        },
        (error) => {
          console.warn('Erreur géolocalisation:', error.message);
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

  // Fonction pour calculer la distance entre deux points GPS
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fonction pour trier les résultats par pertinence et proximité
  const sortResultsByRelevanceAndProximity = async (results: SearchResult[]): Promise<SearchResult[]> => {
    try {
      // Récupérer la position de l'utilisateur
      const userLocation = await getUserLocation();

      if (!userLocation) {
        // Si pas de géolocalisation, trier seulement par score
        console.log('📍 Géolocalisation non disponible, tri par score uniquement');
        return results.sort((a, b) => (b.score || 0) - (a.score || 0));
      }

      // Enrichir les résultats avec la distance calculée
      const enrichedResults = results.map((result) => {
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

      // Trier par score combiné (pertinence + proximité)
      return enrichedResults.sort((a, b) => {
        const scoreA = (a.score || 0) * 0.7 + (a.proximityScore || 0) * 0.3;
        const scoreB = (b.score || 0) * 0.7 + (b.proximityScore || 0) * 0.3;
        return scoreB - scoreA;
      });
    } catch (error) {
      console.error('❌ Erreur lors du tri des résultats:', error);
      // Fallback: tri par score uniquement
      return results.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
  };

  const fetchServicesByIds = async (serviceIds: string[], originalResults: SearchResult[] = []) => {
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

            // Enrichir le service avec les données de recherche (score, etc.)
            const enrichedService = {
              ...service,
              score: originalResults[index]?.score || 0,
              semantic_score: originalResults[index]?.semantic_score || 0,
              interaction_score: originalResults[index]?.interaction_score || 0,
              gps: originalResults[index]?.gps || null,
              distance: originalResults[index]?.distance,
              proximityScore: originalResults[index]?.proximityScore
            };

            return enrichedService;
          } else if (response.status === 404) {
            console.warn(`⚠️ Service ${serviceId} non trouvé (404)`);
            return null;
          } else {
            console.error(`❌ Erreur ${response.status} pour le service ${serviceId}`);
            return null;
          }
        } catch (error) {
          console.error(`❌ Erreur réseau pour le service ${serviceId}:`, error);
          return null;
        }
      });

      const results = await Promise.all(servicePromises);
      const validServices = results.filter(service => service !== null);

      if (validServices.length === 0) {
        setError("Aucun service trouvé. Les services recherchés ne sont plus disponibles.");
        setServices([]);
      } else if (validServices.length < serviceIds.length) {
        const missingCount = serviceIds.length - validServices.length;
        console.warn(`⚠️ ${missingCount} services manquants sur ${serviceIds.length} demandés`);

        toast({
          title: "Services partiellement trouvés",
          description: `${validServices.length} sur ${serviceIds.length} services trouvés`,
          type: "default"
        });

        setServices(validServices);
      } else {
        setServices(validServices);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des services:', error);
      setError('Erreur lors de la récupération des services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  // Gestionnaires d'événements
  const handleContact = (service: Service) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour contacter le prestataire",
        type: "error"
      });
      navigation.navigate('Login', { state: { from: `/resultat-besoin` } });
      return;
    }

    setSelectedService(service);
    setShowContactModal(true);
  };

  const handleChat = (service: Service) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour chatter avec le prestataire",
        type: "error"
      });
      navigation.navigate('Login', { state: { from: `/resultat-besoin` } });
      return;
    }

    setSelectedService(service);
    setShowChatModal(true);
  };

  const handleGallery = (service: Service) => {
    setSelectedService(service);
    setShowGalleryModal(true);
  };

  const handleGeolocation = async () => {
    const userLocation = await getUserLocation();
    if (userLocation) {
      toast({
        title: "Géolocalisation activée",
        description: `Position: ${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`,
        type: "default"
      });
      // Recharger les résultats avec le tri par proximité
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
        title: "Géolocalisation échouée",
        description: "Impossible de récupérer votre position",
        type: "error"
      });
    }
  };

  if (loading) {
    return (
      <View style="container mx-auto px-4 py-8">
        <View style="text-center">
          <View style="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></View>
          <p style="mt-4 text-gray-600">Recherche des services en cours...</Text>
        </View>
      </View>
    );
  }

  return (
    <AppLayout padding={false}>
      <View style="container mx-auto px-4 py-8">
        {/* Header avec bouton retour */}
        <View style="mb-6">
          <View style="flex justify-between items-center">
            <TouchableOpacity
              onClick={() => navigation.navigate('Home')}
              variant="ghost"
              style="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft style="w-4 h-4 mr-2" />
              Retour à l'accueil
            </TouchableOpacity>
          </View>
        </View>

        {/* Header avec statistiques et géolocalisation */}
        <View style="mb-8 text-center">
          <h1 style="text-3xl font-bold text-gray-900 mb-4">
            Services correspondants à votre besoin
          </h1>

          {/* ?? NOUVEAU : Avertissement GPS si des services utilisent le GPS en temps réel */}
          {services.some(service => !service.data?.gps_fixe && service.data?.gps_fixe_coords) && (
            <View style="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg max-w-2xl mx-auto">
              <View style="flex items-center gap-2 text-yellow-800">
                <AlertCircle style="w-5 h-5" />
                <Text style="text-sm font-medium">
                  ⚠️ Certains services utilisent la position GPS en temps réel du créateur
                </Text>
              </View>
              <p style="text-xs text-yellow-700 mt-1">
                Cela peut expliquer pourquoi des coordonnées du Nigeria s'affichent si le créateur est actuellement là-bas
              </Text>
            </View>
          )}

          <View style="flex justify-center items-center gap-8 text-gray-600 mb-4">
            <View style="flex items-center gap-2">
              <CheckCircle style="w-5 h-5 text-green-500" />
              <Text>{services.length} service{services.length > 1 ? 's' : ''} trouvé{services.length > 1 ? 's' : ''}</Text>
            </View>
            <View style="flex items-center gap-2">
              <Clock style="w-5 h-5 text-blue-500" />
              <Text>Résultats en temps réel</Text>
            </View>
          </View>

          {/* Bouton de géolocalisation */}
          <View style="flex justify-center">
            <TouchableOpacity
              onClick={handleGeolocation}
              variant="outline"
              style="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 hover:from-blue-600 hover:to-purple-700"
            >
              <MapPin style="w-4 h-4 mr-2" />
              Activer la géolocalisation pour trier par proximité
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <Card style="max-w-2xl mx-auto">
            <CardContent style="p-8 text-center">
              <AlertCircle style="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 style="text-xl font-semibold mb-2">Erreur de chargement</h3>
              <p style="text-gray-600 mb-6">{error}</Text>
              <TouchableOpacity onClick={() => navigation.navigate('/besoins')} style="px-6">
                Retour aux besoins
              </TouchableOpacity>
            </CardContent>
          </Card>
        )}

        {(!services || services.length === 0) ? (
          <Card style="max-w-2xl mx-auto">
            <CardContent style="p-8 text-center">
              <AlertCircle style="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 style="text-xl font-semibold mb-2">Aucun service trouvé</h3>
              <p style="text-gray-600 mb-6">
                Aucun prestataire ne correspond à vos critères pour le moment.
              </Text>
              <TouchableOpacity onClick={() => navigation.navigate('/besoins')} style="px-6">
                Retour aux besoins
              </TouchableOpacity>
            </CardContent>
          </Card>
        ) : !prestatairesLoaded ? (
          <Card style="max-w-2xl mx-auto">
            <CardContent style="p-8 text-center">
              <View style="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></View>
              <h3 style="text-xl font-semibold mb-2">Chargement des informations prestataire</h3>
              <p style="text-gray-600 mb-6">
                Récupération des données GPS et des informations des prestataires...
              </Text>
            </CardContent>
          </Card>
        ) : (
          <View style="flex justify-center">
            <View style={`grid gap-6 ${services.length === 1 ? 'grid-cols-1 max-w-md' :
                services.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-4xl' :
                  services.length <= 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-5xl' :
                    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl'
              }`}>
              {Array.isArray(services) && services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  prestataires={prestataires}
                  user={user}
                  wsConnected={wsConnected}
                  userStatus={userStatus}
                  onContact={handleContact}
                  onChat={handleChat}
                  onGallery={handleGallery}
                />
              ))}
            </View>
          </View>
        )}

        {/* Footer informatif */}
        {services.length > 0 && (
          <View style="mt-12 text-center">
            <View style="max-w-2xl mx-auto p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 style="text-lg font-semibold text-blue-800 mb-2">
                Comment procéder ?
              </h3>
              <View style="grid md:grid-cols-3 gap-4 text-sm text-blue-700">
                <View style="flex items-center gap-2">
                  <View style="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">1</View>
                  <Text>Choisissez le service qui vous convient</Text>
                </View>
                <View style="flex items-center gap-2">
                  <View style="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">2</View>
                  <Text>Contactez le prestataire via le bouton</Text>
                </View>
                <View style="flex items-center gap-2">
                  <View style="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">3</View>
                  <Text>Échangez et finalisez votre projet</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Modals */}
        {selectedService && showContactModal && (
          <ContactModal
            service={selectedService}
            prestataires={prestataires}
            user={user}
            onClose={() => setShowContactModal(false)}
          />
        )}

        {selectedService && showChatModal && (
          <ChatModal
            service={selectedService}
            prestataires={prestataires}
            user={user}
            wsConnected={wsConnected}
            onClose={() => setShowChatModal(false)}
          />
        )}

        {selectedService && showGalleryModal && (
          <GalleryModal
            service={selectedService}
            prestataires={prestataires}
            user={user}
            onClose={() => setShowGalleryModal(false)}
          />
        )}
      </View>
    </AppLayout>
  );
};

export default ResultatBesoin;

