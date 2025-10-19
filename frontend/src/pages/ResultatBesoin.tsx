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
  DollarSign,
  Filter,
  MapPin
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Composants modulaires
import { GlobalChat } from '@/components/chat/GlobalChat';
import ContactModal from '@/components/contact/ContactModal';
import GalleryModal from '@/components/gallery/GalleryModal';
import ProductCard from '@/components/products/ProductCard';
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
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { toast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<any[]>([]); // Tous les produits extraits
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'products' | 'services'>('products'); // Mode d'affichage

  // États pour le filtre par prix
  const [priceFilter, setPriceFilter] = useState<{
    min: number | null;
    max: number | null;
    currency: string;
  }>({ min: null, max: null, currency: 'XAF' });
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'distance'>('relevance');
  const [showPriceFilter, setShowPriceFilter] = useState(false);

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

  // Extraire les produits des services
  useEffect(() => {
    if (services.length > 0) {
      const extractedProducts: any[] = [];
      const userGPS = (location.state as any)?.userLocation;

      // Fonction helper pour calculer la distance
      const calculateDistance = (gps1: string, gps2: string): number => {
        if (!gps1 || !gps2) return 0;

        const [lat1, lon1] = gps1.split(',').map(Number);
        const [lat2, lon2] = gps2.split(',').map(Number);

        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;

        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      services.forEach((service) => {
        const serviceProduits = service.data?.produits || [];
        if (Array.isArray(serviceProduits)) {
          serviceProduits.forEach((product: any) => {
            // GPS prioritaire : produit > service gps_fixe > service gps
            const productGPS = product.gps || product.gpsFixe;
            const serviceGPSFixe = service.data?.gps_fixe?.valeur || service.data?.gps_fixe;
            const serviceGPSRealtime = service.gps;
            const bestGPS = productGPS || serviceGPSFixe || serviceGPSRealtime;

            // Calculer la distance si GPS disponible
            let distance = undefined;
            if (userGPS && bestGPS) {
              distance = calculateDistance(userGPS, bestGPS);
            }

            extractedProducts.push({
              ...product,
              _serviceId: service.id,
              _service: service,
              _prestataire: prestataires.get(service.user_id),
              _gps: bestGPS,
              _gpsSource: productGPS ? 'product' : (serviceGPSFixe ? 'service_fixe' : 'service_realtime'),
              distance: distance,
              score: service.score || 0
            });
          });
        }
      });

      console.log(`📦 [ResultatBesoin] ${extractedProducts.length} produits extraits de ${services.length} services`);
      setProducts(extractedProducts);
    }
  }, [services, prestataires, location.state]);

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

  // Fonction pour extraire le prix d'un service
  const getServicePrice = (service: Service): number | null => {
    // Chercher dans les produits
    const produitsField = service.data?.produits;
    if (produitsField) {
      let produits = [];
      if (Array.isArray(produitsField)) {
        produits = produitsField;
      } else if (produitsField.valeur && Array.isArray(produitsField.valeur)) {
        produits = produitsField.valeur;
      }

      if (produits.length > 0) {
        // Retourner le prix du premier produit
        const firstProduct = produits[0];
        if (firstProduct.price) {
          return parseFloat(firstProduct.price);
        }
      }
    }

    // Chercher dans les champs de prix directs
    const priceField = service.data?.prix || service.data?.price;
    if (priceField) {
      if (typeof priceField === 'number') return priceField;
      if (typeof priceField === 'string') {
        const parsed = parseFloat(priceField);
        return isNaN(parsed) ? null : parsed;
      }
    }

    return null;
  };

  // Fonction pour filtrer et trier les services
  const filterAndSortServices = (servicesList: Service[]): Service[] => {
    let filteredServices = [...servicesList];

    // Appliquer le filtre par prix
    if (priceFilter.min !== null || priceFilter.max !== null) {
      filteredServices = filteredServices.filter(service => {
        const price = getServicePrice(service);
        if (price === null) return false;

        if (priceFilter.min !== null && price < priceFilter.min) return false;
        if (priceFilter.max !== null && price > priceFilter.max) return false;

        return true;
      });
    }

    // Appliquer le tri
    filteredServices.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc': {
          const priceA = getServicePrice(a) || Infinity;
          const priceB = getServicePrice(b) || Infinity;
          return priceA - priceB;
        }
        case 'price_desc': {
          const priceA = getServicePrice(a) || 0;
          const priceB = getServicePrice(b) || 0;
          return priceB - priceA;
        }
        case 'distance': {
          // Tri par distance (si disponible)
          const distanceA = a.distance || Infinity;
          const distanceB = b.distance || Infinity;
          return distanceA - distanceB;
        }
        case 'relevance':
        default: {
          // Tri par pertinence (score)
          const scoreA = a.score || 0;
          const scoreB = b.score || 0;
          return scoreB - scoreA;
        }
      }
    });

    return filteredServices;
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
      navigate('/login', { state: { from: `/resultat-besoin` } });
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
      navigate('/login', { state: { from: `/resultat-besoin` } });
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
              Retour à l'accueil
            </Button>
          </div>
        </div>

        {/* Header avec statistiques et géolocalisation */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Services correspondants à votre besoin
          </h1>

          {/* ?? NOUVEAU : Avertissement GPS si des services utilisent le GPS en temps réel */}
          {services.some(service => !service.data?.gps_fixe && service.data?.gps_fixe_coords) && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg max-w-2xl mx-auto">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  ⚠️ Certains services utilisent la position GPS en temps réel du créateur
                </span>
              </div>
              <p className="text-xs text-yellow-700 mt-1">
                Cela peut expliquer pourquoi des coordonnées du Nigeria s'affichent si le créateur est actuellement là-bas
              </p>
            </div>
          )}

          <div className="flex justify-center items-center gap-8 text-gray-600 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>
                {(() => {
                  const filteredServices = filterAndSortServices(services);
                  return `${filteredServices.length} service${filteredServices.length > 1 ? 's' : ''} trouvé${filteredServices.length > 1 ? 's' : ''}`;
                })()}
                {(() => {
                  const filteredServices = filterAndSortServices(services);
                  if (filteredServices.length !== services.length) {
                    return ` (${services.length} au total)`;
                  }
                  return '';
                })()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span>Résultats en temps réel</span>
            </div>
          </div>

          {/* Filtres et tri */}
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Button
              onClick={handleGeolocation}
              variant="outline"
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 hover:from-blue-600 hover:to-purple-700"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Activer la géolocalisation pour trier par proximité
            </Button>

            <Button
              onClick={() => setShowPriceFilter(!showPriceFilter)}
              variant="outline"
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 hover:from-green-600 hover:to-emerald-700"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Filtre par prix
            </Button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="relevance">Trier par pertinence</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
              <option value="distance">Distance</option>
            </select>
          </div>

          {/* Filtre par prix */}
          {showPriceFilter && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filtre par prix
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix minimum
                  </label>
                  <input
                    type="number"
                    value={priceFilter.min || ''}
                    onChange={(e) => setPriceFilter(prev => ({ ...prev, min: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix maximum
                  </label>
                  <input
                    type="number"
                    value={priceFilter.max || ''}
                    onChange={(e) => setPriceFilter(prev => ({ ...prev, max: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="100000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Devise
                  </label>
                  <select
                    value={priceFilter.currency}
                    onChange={(e) => setPriceFilter(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="XAF">FCFA (XAF)</option>
                    <option value="USD">Dollar US (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="GBP">Livre Sterling (GBP)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  onClick={() => setPriceFilter({ min: null, max: null, currency: 'XAF' })}
                  variant="outline"
                  size="sm"
                >
                  Réinitialiser
                </Button>
                <Button
                  onClick={() => setShowPriceFilter(false)}
                  size="sm"
                >
                  Appliquer
                </Button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Erreur de chargement</h3>
              <p className="text-gray-600 mb-6">{error}</p>
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
              <h3 className="text-xl font-semibold mb-2">Aucun service trouvé</h3>
              <p className="text-gray-600 mb-6">
                Aucun prestataire ne correspond à vos critères pour le moment.
              </p>
              <Button onClick={() => navigate('/besoins')} className="px-6">
                Retour aux besoins
              </Button>
            </CardContent>
          </Card>
        ) : !prestatairesLoaded ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold mb-2">Chargement des informations prestataire</h3>
              <p className="text-gray-600 mb-6">
                Récupération des données GPS et des informations des prestataires...
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex justify-center">
            <div className={`grid gap-6 ${(() => {
              const filteredServices = filterAndSortServices(services);
              const count = displayMode === 'products' ? products.length : filteredServices.length;
              return count === 1 ? 'grid-cols-1 max-w-md' :
                count === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-4xl' :
                  count <= 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-5xl' :
                    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl';
            })()}`}>

              {/* Toggle mode d'affichage */}
              <div className="col-span-full mb-6">
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => setDisplayMode('products')}
                    variant={displayMode === 'products' ? 'default' : 'outline'}
                    className="flex items-center gap-2"
                  >
                    📦 Produits ({products.length})
                  </Button>
                  <Button
                    onClick={() => setDisplayMode('services')}
                    variant={displayMode === 'services' ? 'default' : 'outline'}
                    className="flex items-center gap-2"
                  >
                    💼 Services ({services.length})
                  </Button>
                </div>
              </div>

              {/* Affichage conditionnel */}
              {displayMode === 'products' ? (
                products.length > 0 ? (
                  products.map((product, index) => (
                    <ProductCard
                      key={`product-${index}-${product.nom}`}
                      product={product}
                      service={product._service}
                      prestataire={product._prestataire}
                      onChatPress={() => handleChat(product._service)}
                      onCallPress={() => handleContact(product._service)}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <div className="inline-flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-4xl">
                        📦
                      </div>
                      <p className="text-gray-600 font-medium">Aucun produit trouvé</p>
                      <p className="text-sm text-gray-400">Essayez de basculer en mode Services</p>
                    </div>
                  </div>
                )
              ) : (
                Array.isArray(services) && filterAndSortServices(services).map((service) => (
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
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer informatif */}
        {services.length > 0 && (
          <div className="mt-12 text-center">
            <div className="max-w-2xl mx-auto p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Comment procéder ?
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
                  <span>Échangez et finalisez votre projet</span>
                </div>
              </div>
            </div>
          </div>
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
          <GlobalChat
            serviceId={selectedService.id}
            prestataireId={selectedService.user_id}
            isOpen={showChatModal}
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
      </div>
    </AppLayout>
  );
};

export default ResultatBesoin;
