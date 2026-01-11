// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import CategoryFilters from '../components/CategoryFilters';
import ChatInputMobile from '../components/ChatInputMobile';
import ChatModalMobile from '../components/ChatModalMobile';
import ModernGPSModal from '../components/ModernGPSModal';
import ProductCard from '../components/ProductCard';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import ServiceGalleryModal from '../components/ServiceGalleryModal';
import UltraModernServiceCard from '../components/UltraModernServiceCard';
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useServicesBatchData } from '../hooks/useServicesBatchData';
import { apiGet, apiPost } from '../services/api';
import { theme } from '../theme/theme';

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

interface Service {
    id: string;
    titre: string;
    description: string;
    user_id: string;
    data?: any;
    score?: number;
    semantic_score?: number;
    interaction_score?: number;
    gps?: string;
    distance?: number;
    proximityScore?: number;
    [key: string]: any;
}

interface Prestataire {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    isOnline?: boolean;
    lastSeen?: string;
    [key: string]: any;
}

const ResultatBesoinScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();

    // États
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<any[]>([]); // Tous les produits extraits
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prestataires, setPrestataires] = useState<Map<string, Prestataire>>(new Map());
    const prestatairesRef = useRef<Map<string, Prestataire>>(new Map()); // ✅ NOUVEAU: Ref pour mémoriser la Map
    const [prestatairesLoaded, setPrestatairesLoaded] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [selectedPrestataire, setSelectedPrestataire] = useState<Prestataire | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

    // États pour le filtre par prix
    const [priceFilter, setPriceFilter] = useState<{
        min: number | null;
        max: number | null;
        currency: string;
    }>({ min: null, max: null, currency: 'XAF' });
    const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'distance'>('relevance');
    const [showPriceFilter, setShowPriceFilter] = useState(false);
    const [showCategoryFilters, setShowCategoryFilters] = useState(false);
    const [categoryFilters, setCategoryFilters] = useState<Record<string, any>>({});

    // Récupérer les résultats depuis la navigation
    const routeParams = (route.params as any) || {};
    const initialResults = routeParams.results || [];
    
    // ✅ CORRECTION 2025-12-30: useRef pour éviter les re-renders infinis
    const hasProcessedInitialResults = useRef(false);
    const initialResultsLength = useRef(initialResults?.length || 0);

    // Déterminer la catégorie dominante des produits
    const dominantCategory = useMemo(() => {
        if (products.length === 0) return 'default';

        // Compter les catégories
        const categoryCount: Record<string, number> = {};
        products.forEach((product) => {
            const category = product.type || 'default';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });

        // Trouver la catégorie la plus fréquente
        let maxCount = 0;
        let dominant = 'default';
        Object.entries(categoryCount).forEach(([category, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominant = category;
            }
        });

        return dominant;
    }, [products]);

    // Récupérer la configuration de la catégorie dominante
    const categoryConfig = getCategoryConfig(dominantCategory);
    const categoryStyle = getCategoryStyle(dominantCategory);
    const terminology = getCategoryTerminology(dominantCategory);

    // DEBUG: Afficher les paramètres reçus
    useEffect(() => {
        console.log('🔍 [ResultatBesoinScreen] Paramètres de navigation reçus:', {
            hasParams: !!routeParams,
            resultsLength: initialResults?.length || 0,
            results: initialResults,
            type: routeParams.type,
            suggestion: routeParams.suggestion
        });
    }, []);

    // Fonction pour calculer la distance entre deux points GPS (formule de Haversine)
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

    // Fonction pour filtrer les produits selon les filtres de catégorie
    const filterProducts = (productsList: any[]): any[] => {
        let filtered = [...productsList];

        // Appliquer les filtres de catégorie spécifiques
        if (Object.keys(categoryFilters).length > 0) {
            filtered = filtered.filter(product => {
                // Vérifier chaque filtre
                for (const [key, value] of Object.entries(categoryFilters)) {
                    if (value === null || value === undefined || value === '') continue;

                    // Filtres numériques (min/max)
                    if (key.startsWith('min') && product[key.replace('min', '').toLowerCase()]) {
                        if (parseFloat(product[key.replace('min', '').toLowerCase()]) < parseFloat(value)) {
                            return false;
                        }
                    }
                    if (key.startsWith('max') && product[key.replace('max', '').toLowerCase()]) {
                        if (parseFloat(product[key.replace('max', '').toLowerCase()]) > parseFloat(value)) {
                            return false;
                        }
                    }

                    // Filtres de correspondance directe
                    if (product[key] && product[key] !== value) {
                        return false;
                    }
                }
                return true;
            });
        }

        // Appliquer le filtre par prix
        if (priceFilter.min !== null || priceFilter.max !== null) {
            filtered = filtered.filter(product => {
                const price = parseFloat(product.prix || product.price);
                if (isNaN(price)) return false;

                if (priceFilter.min !== null && price < priceFilter.min) return false;
                if (priceFilter.max !== null && price > priceFilter.max) return false;

                return true;
            });
        }

        // ✅ TRI PRIORITAIRE : Produits en promotion d'abord
        filtered.sort((a, b) => {
            // 1. Priorité PROMO
            const promoA = a.en_promotion || a.promotion_active ? 1 : 0;
            const promoB = b.en_promotion || b.promotion_active ? 1 : 0;
            if (promoA !== promoB) return promoB - promoA;

            // 2. Score (pertinence)
            const scoreA = a.score || 0;
            const scoreB = b.score || 0;
            if (scoreA !== scoreB) return scoreB - scoreA;

            // 3. Distance (proximité)
            const distA = a.distance || Infinity;
            const distB = b.distance || Infinity;
            return distA - distB;
        });

        return filtered;
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
            if (!location) {
                // Si pas de géolocalisation, trier seulement par score
                console.log('📍 Géolocalisation non disponible, tri par score uniquement');
                return results.sort((a, b) => (b.score || 0) - (a.score || 0));
            }

            // Enrichir les résultats avec la distance calculée
            const enrichedResults = results.map((result) => {
                let distance = Infinity;
                let gpsToUse = result.gps;

                // PRIORITÉ: Utiliser gps_fixe si disponible, sinon gps en temps réel
                // Note: result.gps contient déjà la bonne valeur selon la logique backend
                // qui priorise gps_fixe sur gps_mobile
                console.log('📍 [ResultatBesoinScreen] GPS utilisé pour distance:', {
                    serviceId: result.service_id,
                    gps: result.gps
                });

                if (gpsToUse && typeof gpsToUse === 'string' && gpsToUse.includes(',')) {
                    try {
                        const coords = gpsToUse.split(',');
                        if (coords.length >= 2) {
                            const lat = parseFloat(coords[0]);
                            const lon = parseFloat(coords[1]);
                            if (!isNaN(lat) && !isNaN(lon)) {
                                distance = calculateDistance(
                                    (location as any).coords.latitude,
                                    (location as any).coords.longitude,
                                    lat,
                                    lon
                                );
                                console.log(`✅ [ResultatBesoinScreen] Distance calculée pour ${result.service_id}: ${distance.toFixed(2)} km`);
                            }
                        }
                    } catch (error) {
                        console.warn('⚠️ [ResultatBesoinScreen] Erreur parsing GPS:', error);
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

    // Fonction pour récupérer les détails des services
    const fetchServicesByIds = async (serviceIds: string[], originalResults: SearchResult[] = []) => {
        try {
            setLoading(true);
            setError(null);

            // Fonction helper pour calculer la distance GPS (utilise la même formule que calculateDistance globale)
            const calculateDistanceFromCoords = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
                const R = 6371; // Rayon de la Terre en km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            };

            const servicePromises = serviceIds.map(async (serviceId, index) => {
                try {
                    console.log(`🔍 [ResultatBesoinScreen] Récupération du service ${serviceId}...`);
                    const response = await apiGet(`/api/services/${serviceId}`);
                    console.log(`✅ [ResultatBesoinScreen] Service ${serviceId} récupéré:`, response);

                    if (response.data) {
                        const service = response.data as Service;

                        // Récupérer le GPS des résultats de recherche (qui priorise déjà gps_fixe > gps_mobile)
                        const searchGps = originalResults[index]?.gps;

                        // Enrichir le service avec les données de recherche (score, etc.)
                        const enrichedService: Service = {
                            ...service,
                            score: originalResults[index]?.score || 0,
                            semantic_score: originalResults[index]?.semantic_score || 0,
                            interaction_score: originalResults[index]?.interaction_score || 0,
                            gps: searchGps || service.gps || undefined,
                            distance: originalResults[index]?.distance,
                            proximityScore: originalResults[index]?.proximityScore,
                            // ✅ CORRECTION: Injecter le GPS dans data.gps_fixe si le service l'a défini
                            data: {
                                ...service.data,
                                // Si le GPS de recherche est défini et qu'il vient de gps_fixe, l'injecter
                                gps_fixe: searchGps ? { valeur: searchGps } : service.data?.gps_fixe
                            }
                        };

                        console.log(`✅ [ResultatBesoinScreen] Service ${service.id} enrichi avec GPS:`, {
                            searchGps,
                            finalGps: enrichedService.gps,
                            gps_fixe: enrichedService.data?.gps_fixe
                        });

                        return enrichedService;
                    } else {
                        console.warn(`⚠️ Service ${serviceId} non trouvé`);
                        return null;
                    }
                } catch (error) {
                    console.error(`❌ [ResultatBesoinScreen] Erreur pour le service ${serviceId}:`, error);
                    console.error(`❌ [ResultatBesoinScreen] Détails de l'erreur:`, {
                        serviceId,
                        error: error.message,
                        stack: error.stack
                    });
                    return null;
                }
            });

            const results = await Promise.all(servicePromises);
            const validServices = results.filter((service): service is Service => service !== null);

            if (validServices.length === 0) {
                setError("Aucun service trouvé. Les services recherchés ne sont plus disponibles.");
                setServices([]);
            } else {
                setServices(validServices);

                // Extraire tous les produits de tous les services
                const extractedProducts: any[] = [];
                const userGPS = location?.coords ? `${location.coords.latitude},${location.coords.longitude}` : null;

                validServices.forEach((service) => {
                    // ✅ CORRIGÉ: Gérer la structure produits (peut être un tableau ou un objet avec .valeur)
                    let serviceProduits: any[] = [];
                    const produitsData = service.data?.produits;
                    if (Array.isArray(produitsData)) {
                        serviceProduits = produitsData;
                    } else if (produitsData?.valeur && Array.isArray(produitsData.valeur)) {
                        serviceProduits = produitsData.valeur;
                    }
                    
                    if (serviceProduits.length > 0) {
                        serviceProduits.forEach((product: any) => {
                            // GPS prioritaire : produit > service gps_fixe > service gps
                            const productGPS = product.gps || product.gpsFixe;
                            const serviceGPSFixe = service.data?.gps_fixe?.valeur || service.data?.gps_fixe;
                            const serviceGPSRealtime = service.gps;
                            const bestGPS = productGPS || serviceGPSFixe || serviceGPSRealtime;

                            // ✅ CORRIGÉ: Calculer la distance du produit, utiliser service.distance comme fallback
                            let distance = undefined;
                            if (userGPS && bestGPS && location?.coords) {
                                try {
                                    // Parser les coordonnées GPS
                                    const [userLat, userLon] = userGPS.split(',').map(Number);
                                    const [productLat, productLon] = bestGPS.split(',').map(Number);
                                    
                                    if (!isNaN(userLat) && !isNaN(userLon) && !isNaN(productLat) && !isNaN(productLon)) {
                                        // ✅ CORRIGÉ 2026-01-XX: Utiliser calculateDistance au lieu de calculateDistanceFromCoords
                                        distance = calculateDistance(userLat, userLon, productLat, productLon);
                                        console.log(`✅ [ResultatBesoinScreen] Distance produit calculée: ${distance.toFixed(2)} km (${product.nom || 'produit'})`);
                                    }
                                } catch (error) {
                                    console.warn('⚠️ [ResultatBesoinScreen] Erreur calcul distance produit:', error);
                                }
                            }
                            
                            // ✅ FALLBACK: Utiliser la distance du service si disponible et si la distance du produit n'a pas pu être calculée
                            if ((distance === undefined || !Number.isFinite(distance)) && service.distance !== undefined && Number.isFinite(service.distance)) {
                                distance = service.distance;
                                console.log(`✅ [ResultatBesoinScreen] Distance service utilisée comme fallback: ${distance.toFixed(2)} km (${product.nom || 'produit'})`);
                            }

                            // ✅ Calculer le score de priorité pour produits en promotion
                            let finalScore = service.score || 0;
                            const isPromo = product.en_promotion || product.promotion_active;

                            if (isPromo) {
                                // Bonus significatif pour produits en publicité
                                finalScore += 100; // Forte priorité pour affichage
                            }

                            // ✅ CORRIGÉ: Extraire les images et vidéos du produit/service
                            const productImages = Array.isArray(product.images) ? product.images 
                                : Array.isArray(service?.images) ? service.images
                                : Array.isArray(service?.data?.images?.valeur) ? service.data.images.valeur
                                : Array.isArray(service?.data?.images) ? service.data.images
                                : [];
                            
                            const productVideos = Array.isArray(product.videos) ? product.videos
                                : Array.isArray(service?.videos) ? service.videos
                                : Array.isArray(service?.data?.videos?.valeur) ? service.data.videos.valeur
                                : Array.isArray(service?.data?.videos) ? service.data.videos
                                : [];

                            extractedProducts.push({
                                ...product,
                                _serviceId: service.id,
                                _service: service,
                                _prestataire: prestataires.get(service.user_id),
                                _gps: bestGPS,
                                _gpsSource: productGPS ? 'product' : (serviceGPSFixe ? 'service_fixe' : 'service_realtime'),
                                distance: distance,
                                distance_km: distance, // ✅ Ajout pour compatibilité ProductCard
                                images: productImages, // ✅ CORRIGÉ: S'assurer que les images sont extraites
                                videos: productVideos, // ✅ CORRIGÉ: S'assurer que les vidéos sont extraites
                                score: finalScore, // ✅ Score ajusté avec bonus promo
                                en_promotion: isPromo, // Passer le flag
                                promotion_active: isPromo
                            });
                        });
                    }
                });

                console.log(`📦 [ResultatBesoinScreen] ${extractedProducts.length} produits extraits de ${validServices.length} services`);

                // ✅ TRI PRIORITAIRE : Produits en promotion d'abord
                extractedProducts.sort((a, b) => {
                    // 1. Priorité PROMO
                    const promoA = a.en_promotion || a.promotion_active ? 1 : 0;
                    const promoB = b.en_promotion || b.promotion_active ? 1 : 0;
                    if (promoA !== promoB) return promoB - promoA;

                    // 2. Score (pertinence)
                    const scoreA = a.score || 0;
                    const scoreB = b.score || 0;
                    if (scoreA !== scoreB) return scoreB - scoreA;

                    // 3. Distance (proximité)
                    const distA = a.distance || Infinity;
                    const distB = b.distance || Infinity;
                    return distA - distB;
                });

                setProducts(extractedProducts);

                // Récupérer les informations des prestataires
                const userIds = validServices.map(service => service.user_id).filter(id => id);
                if (userIds.length > 0) {
                    await fetchPrestatairesBatch(userIds);
                } else {
                    // Aucun prestataire à charger, marquer comme chargé
                    console.log('📊 Aucun prestataire à charger');
                    setPrestatairesLoaded(true);
                }
            }
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des services:', error);
            setError('Erreur lors de la récupération des services');
            setServices([]);
            setPrestatairesLoaded(true); // Marquer comme chargé même en cas d'erreur
        } finally {
            setLoading(false);
        }
    };

    // Fonction pour récupérer les informations des prestataires
    const fetchPrestatairesBatch = async (userIds: string[]) => {
        try {
            console.log('🔄 Début du chargement des prestataires pour:', userIds);

            const prestatairePromises = userIds.map(async (userId) => {
                try {
                    const response = await apiGet(`/api/users/profile/${userId}`);
                    if (response.data) {
                        console.log(`✅ Prestataire ${userId} chargé`);
                        return { userId, prestataire: response.data as Prestataire };
                    }
                    console.warn(`⚠️ Prestataire ${userId} non trouvé`);
                    return null;
                } catch (error) {
                    console.error(`❌ Erreur prestataire ${userId}:`, error);
                    return null;
                }
            });

            const results = await Promise.all(prestatairePromises);
            const newPrestataires = new Map<string, Prestataire>();

            results.forEach(result => {
                if (result) {
                    // CORRECTION: Mapper nom_complet vers name pour compatibilité
                    const prestataire = result.prestataire;
                    const normalizedPrestataire = {
                        ...prestataire,
                        name: prestataire.nom_complet || prestataire.name || `Prestataire ${result.userId}`,
                        avatar: prestataire.avatar_url || prestataire.photo_profil || prestataire.avatar,
                        userId: result.userId
                    };
                    newPrestataires.set(result.userId, normalizedPrestataire);
                    console.log(`📝 Prestataire ${result.userId} normalisé:`, normalizedPrestataire.name);
                }
            });

            console.log(`📊 ${newPrestataires.size} prestataires chargés sur ${userIds.length} demandés`);
            
            // ✅ CORRIGÉ 2025-01-01: Mémoriser la Map pour éviter les changements de référence
            // Ne mettre à jour que si les données ont réellement changé
            let hasPrestatairesChanges = false;
            if (prestatairesRef.current.size !== newPrestataires.size) {
                hasPrestatairesChanges = true;
            } else {
                for (const [userId, prestataire] of newPrestataires.entries()) {
                    const oldPrestataire = prestatairesRef.current.get(userId);
                    if (!oldPrestataire || oldPrestataire?.userId !== prestataire.userId) {
                        hasPrestatairesChanges = true;
                        break;
                    }
                }
            }
            
            if (hasPrestatairesChanges) {
                prestatairesRef.current = newPrestataires;
                setPrestataires(newPrestataires);
            }
            
            // ✅ CORRIGÉ 2025-12-30: Mettre à jour les produits avec les informations des prestataires maintenant chargés
            // Vérifier s'il y a réellement des changements avant de mettre à jour pour éviter les re-renders inutiles
            // ✅ CORRECTION 2025-01-02: Debounce les mises à jour des produits pour éviter les re-renders fréquents
            // Annuler le timeout précédent s'il existe
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
            
            // Créer un timeout pour regrouper les mises à jour
            updateTimeoutRef.current = setTimeout(() => {
                setProducts(prevProducts => {
                    let hasChanges = false;
                    const updatedProducts = prevProducts.map(product => {
                        const service = product._service;
                        if (service && service.user_id) {
                            const prestataire = newPrestataires.get(service.user_id);
                            // ✅ Comparaison plus stricte pour éviter les mises à jour inutiles
                            if (prestataire) {
                                const currentPrestataireId = product._prestataire?.userId || product._prestataire?.id;
                                const newPrestataireId = prestataire.userId || prestataire.id;
                                if (currentPrestataireId !== newPrestataireId) {
                                    hasChanges = true;
                                    return {
                                        ...product,
                                        _prestataire: prestataire
                                    };
                                }
                            }
                        }
                        return product;
                    });
                    
                    // Ne retourner un nouveau tableau que s'il y a des changements réels
                    if (!hasChanges) {
                        return prevProducts;
                    }
                    
                    // ✅ Utiliser une copie profonde seulement si nécessaire
                    return updatedProducts;
                });
                updateTimeoutRef.current = null;
            }, 100); // Debounce de 100ms pour regrouper les mises à jour
            
            setPrestatairesLoaded(true);
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des prestataires:', error);
            setPrestatairesLoaded(true); // Marquer comme chargé même en cas d'erreur
        }
    };

    // Traitement initial des résultats
    // ✅ CORRECTION 2025-12-30: Utiliser useRef pour éviter les re-renders infinis
    useEffect(() => {
        // Vérifier si on a déjà traité ces résultats (même longueur)
        const currentLength = initialResults?.length || 0;
        if (hasProcessedInitialResults.current && initialResultsLength.current === currentLength) {
            console.log('⏭️ [ResultatBesoinScreen] Résultats déjà traités, skip');
            return;
        }

        const processResults = async () => {
            try {
                if (initialResults && Array.isArray(initialResults) && initialResults.length > 0) {
                    console.log('🔄 Traitement des résultats initiaux:', initialResults.length);
                    
                    // Marquer comme traité AVANT le traitement asynchrone
                    hasProcessedInitialResults.current = true;
                    initialResultsLength.current = initialResults.length;

                    // Trier les résultats par score de pertinence et proximité
                    const sortedResults = await sortResultsByRelevanceAndProximity(initialResults);

                    const serviceIds = sortedResults
                        .map((result: any) => result.service_id)
                        .filter((id: any) => id && id !== 'undefined')
                        .map((id: any) => id.toString());

                    console.log('📋 IDs des services à charger:', serviceIds);

                    if (serviceIds.length > 0) {
                        await fetchServicesByIds(serviceIds, sortedResults);
                    } else {
                        console.log('⚠️ Aucun service ID valide trouvé');
                        setLoading(false);
                        setPrestatairesLoaded(true);
                    }
                } else {
                    console.log('⚠️ Aucun résultat initial fourni');
                    hasProcessedInitialResults.current = true;
                    initialResultsLength.current = 0;
                    setLoading(false);
                    setPrestatairesLoaded(true);
                }
            } catch (error) {
                console.error('❌ Erreur lors du traitement des résultats:', error);
                setLoading(false);
                setPrestatairesLoaded(true);
                setError('Erreur lors du traitement des résultats');
            }
        };

        // Ajouter un timeout de sécurité
        const timeoutId = setTimeout(() => {
            if (!prestatairesLoaded) {
                console.warn('⏰ Timeout atteint, forcer le chargement');
                setPrestatairesLoaded(true);
            }
        }, 10000); // 10 secondes

        processResults();

        return () => {
            clearTimeout(timeoutId);
            // ✅ CORRECTION 2025-01-02: Nettoyer le timeout de debounce aussi
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, [initialResults?.length]); // ✅ CORRECTION: Dépendre seulement de la longueur, pas de l'objet complet

    // ✅ CORRECTION: Gestionnaires pour les services
    const handleContactPress = (service: Service) => {
        if (!service.user_id) {
            Alert.alert("Erreur", "Impossible d'identifier le prestataire");
            return;
        }
        handleContact(service.user_id, 'message');
    };

    const handleCallPress = (service: Service) => {
        if (!service.user_id) {
            Alert.alert("Erreur", "Impossible d'identifier le prestataire");
            return;
        }
        handleContact(service.user_id, 'call');
    };

    // ✅ CORRIGÉ 2025-12-30: Mémoriser les callbacks pour éviter les re-renders en boucle
    // Gestionnaires d'événements
    const handleContact = useCallback((prestataireId: string, type: 'message' | 'call') => {
        if (!user) {
            Alert.alert(
                "Connexion requise",
                "Veuillez vous connecter pour contacter le prestataire",
                [
                    { text: "Annuler", style: "cancel" },
                    { text: "Se connecter", onPress: () => navigation.navigate('Login' as never) }
                ]
            );
            return;
        }

        const prestataire = prestataires.get(prestataireId);
        if (!prestataire) {
            Alert.alert("Erreur", "Impossible de récupérer les informations du prestataire");
            return;
        }

        const foundService = services.find(s => s.user_id === prestataireId);

        if (type === 'message') {
            // Ouvrir le chat modal
            if (foundService) {
                setSelectedService(foundService);
                setSelectedPrestataire(prestataire);
                setShowChatModal(true);
            }
        } else if (type === 'call') {
            // Ouvrir les options de contact (WhatsApp, téléphone)
            const contactOptions = [];

            if (prestataire.whatsapp || prestataire.telephone) {
                if (prestataire.whatsapp) {
                    contactOptions.push({
                        text: `WhatsApp: ${prestataire.whatsapp}`,
                        onPress: async () => {
                            try {
                                // Ouvrir WhatsApp avec le numéro
                                const phoneNumber = prestataire.whatsapp.replace(/\s+/g, '');
                                const whatsappUrl = `whatsapp://send?phone=${phoneNumber}`;

                                const canOpen = await Linking.canOpenURL(whatsappUrl);
                                if (canOpen) {
                                    await Linking.openURL(whatsappUrl);

                                    // Créer une notification pour le prestataire
                                    if (foundService) {
                                        await createContactNotification(prestataireId, 'whatsapp', foundService);
                                    }
                                } else {
                                    Alert.alert("Erreur", "WhatsApp n'est pas installé sur cet appareil");
                                }
                            } catch (error) {
                                console.error('Erreur ouverture WhatsApp:', error);
                                Alert.alert("Erreur", "Impossible d'ouvrir WhatsApp");
                            }
                        }
                    });
                }

                if (prestataire.telephone) {
                    contactOptions.push({
                        text: `Appeler: ${prestataire.telephone}`,
                        onPress: async () => {
                            try {
                                // Ouvrir l'application téléphone
                                const phoneNumber = prestataire.telephone.replace(/\s+/g, '');
                                const telUrl = `tel:${phoneNumber}`;

                                const canOpen = await Linking.canOpenURL(telUrl);
                                if (canOpen) {
                                    await Linking.openURL(telUrl);

                                    // Créer une notification pour le prestataire
                                    if (foundService) {
                                        await createContactNotification(prestataireId, 'call', foundService);
                                    }
                                } else {
                                    Alert.alert("Erreur", "Impossible de passer l'appel");
                                }
                            } catch (error) {
                                console.error('Erreur ouverture appel:', error);
                                Alert.alert("Erreur", "Impossible d'ouvrir l'application téléphone");
                            }
                        }
                    });
                }

                Alert.alert(
                    "Contacter le prestataire",
                    `Comment souhaitez-vous contacter ${prestataire.nom_complet || prestataire.nom} ?`,
                    contactOptions.concat([{ text: "Annuler", style: "cancel" }])
                );
            } else {
                Alert.alert("Contact", "Aucune information de contact disponible pour ce prestataire");
            }
        }
    }, [user, prestataires, services, navigation]);

    // ✅ CORRIGÉ 2025-12-30: Mémoriser handleChat avec useCallback
    const handleChat = useCallback(async (service: Service) => {
        if (!user) {
            Alert.alert(
                "Connexion requise",
                "Veuillez vous connecter pour chatter avec le prestataire",
                [
                    { text: "Annuler", style: "cancel" },
                    { text: "Se connecter", onPress: () => navigation.navigate('Login' as never) }
                ]
            );
            return;
        }

        const prestataire = prestataires.get(service.user_id);
        if (prestataire) {
            setSelectedService(service);
            setSelectedPrestataire(prestataire);
            setShowChatModal(true);

            // Créer une notification pour informer le prestataire qu'un client souhaite chatter
            try {
                const serviceTitle = service.data?.titre_service?.valeur || service.titre || 'votre service';

                // ✅ CORRIGÉ: Utilise apiPost
                await apiPost('/api/notifications/create', {
                    user_id: service.user_id,
                    title: `💬 ${user.name} a ouvert une conversation`,
                    message: `Au sujet de: ${serviceTitle}\n\nUn client potentiel souhaite discuter avec vous.`,
                    type: 'chat_opened',
                    priority: 'medium',
                    metadata: {
                        service_id: service.id,
                        client_id: user.id,
                        client_name: user.name
                    }
                });

                console.log('[ResultatBesoinScreen] Notification de chat ouvert envoyée au prestataire');
            } catch (error) {
                console.error('[ResultatBesoinScreen] Erreur création notification chat:', error);
            }
        } else {
            Alert.alert("Erreur", "Impossible de récupérer les informations du prestataire");
        }
    }, [user, prestataires, services, navigation]);

    // ✅ CORRIGÉ 2025-12-30: Mémoriser les callbacks pour éviter les re-renders en boucle
    const handleGallery = useCallback((service: Service) => {
        setSelectedService(service);
        setShowGalleryModal(true);
    }, []);

    const handleShare = useCallback((service: Service) => {
        Alert.alert('Partage', `Partager le service: ${service.titre || service.title || 'Service'}`);
    }, []);

    const handleFavorite = useCallback((service: Service) => {
        Alert.alert('Favoris', `Service ${service.titre || service.title || 'Service'} ajouté aux favoris`);
    }, []);

    const handleReview = useCallback((service: Service) => {
        Alert.alert('Avis', 'Ouverture du formulaire d\'avis');
    }, []);

    const handleServicePress = useCallback((service: Service) => {
        console.log('Service pressé:', service.id);
    }, []);

    const handleServiceClick = useCallback((serviceId: string) => {
        const service = services.find(s => s.id === serviceId);
        if (service) {
            handleServicePress(service);
        }
    }, [services, handleServicePress]);

    // Fonction pour créer une notification de contact
    const createContactNotification = async (prestataireId: string, contactType: 'whatsapp' | 'call', service: any) => {
        try {
            if (!user) return;

            const serviceTitle = service.data?.titre_service?.valeur || service.titre || 'votre service';

            let notificationTitle = '';
            let notificationMessage = '';

            if (contactType === 'whatsapp') {
                notificationTitle = `📱 ${user.name} souhaite vous contacter sur WhatsApp`;
                notificationMessage = `Au sujet de: ${serviceTitle}\n\nUn client potentiel souhaite discuter avec vous sur WhatsApp.`;
            } else if (contactType === 'call') {
                notificationTitle = `📞 ${user.name} souhaite vous appeler`;
                notificationMessage = `Au sujet de: ${serviceTitle}\n\nUn client potentiel est en train de vous appeler.`;
            }

            // ✅ CORRIGÉ: Envoyer la notification via apiPost
            const response = await apiPost('/api/notifications/create', {
                user_id: prestataireId,
                title: notificationTitle,
                message: notificationMessage,
                type: contactType === 'whatsapp' ? 'whatsapp_contact' : 'phone_call',
                priority: 'high',
                metadata: {
                    service_id: service.id,
                    client_id: user.id,
                    client_name: user.name,
                    contact_type: contactType
                }
            });

            if (response.success) {
                console.log('[ResultatBesoinScreen] Notification de contact créée pour le prestataire');
            }
        } catch (error) {
            console.error('[ResultatBesoinScreen] Erreur création notification:', error);
        }
    };

    const handleGeolocation = async () => {
        if (!location) {
            Alert.alert(
                "Géolocalisation non disponible",
                "Impossible de récupérer votre position pour le tri par proximité"
            );
            return;
        }

        Alert.alert(
            "Géolocalisation activée",
            `Position: ${(location as any).coords.latitude.toFixed(4)}, ${(location as any).coords.longitude.toFixed(4)}`
        );

        // Recharger les résultats avec le tri par proximité
        if (initialResults && Array.isArray(initialResults)) {
            const sortedResults = await sortResultsByRelevanceAndProximity(initialResults);
            const serviceIds = sortedResults
                .map((result: any) => result.service_id)
                .filter((id: any) => id && id !== 'undefined')
                .map((id: any) => id.toString());

            if (serviceIds.length > 0) {
                await fetchServicesByIds(serviceIds, sortedResults);
            }
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // Recharger les résultats
        if (initialResults && Array.isArray(initialResults)) {
            const sortedResults = await sortResultsByRelevanceAndProximity(initialResults);
            const serviceIds = sortedResults
                .map((result: any) => result.service_id)
                .filter((id: any) => id && id !== 'undefined')
                .map((id: any) => id.toString());

            if (serviceIds.length > 0) {
                await fetchServicesByIds(serviceIds, sortedResults);
            }
        }
        setRefreshing(false);
    }, [initialResults]);

    // Fonction de recherche (identique à HomeScreen) - Support multimédia complet
    const handleSearch = async (input: any) => {
        try {
            // Vérifier l'authentification
            if (!user) {
                Alert.alert('Erreur d\'authentification', 'Vous devez être connecté pour effectuer une recherche');
                return;
            }

            setLoading(true);
            console.log('[ResultatBesoinScreen] Recherche avec:', {
                texte: input.texte || input.text || '',
                hasImages: (input.base64_image || []).length > 0,
                hasAudio: (input.audio_base64 || []).length > 0,
                hasGPS: !!input.gps_mobile
            });

            // ✅ CORRIGÉ: Utiliser le service de recherche directement (comme HomeScreen)
            const { rechercherServices } = await import('../services/yukpoclient');
            
            // ✅ CORRIGÉ: Préparer le payload complet avec support multimédia
            const searchPayload: any = {
                texte: input.texte || input.text || input.description || '',
            };

            // Ajouter les médias si présents
            if (input.base64_image && input.base64_image.length > 0) {
                searchPayload.base64_image = input.base64_image;
            }
            
            if (input.audio_base64 && input.audio_base64.length > 0) {
                searchPayload.audio_base64 = input.audio_base64;
            }
            
            if (input.video_base64 && input.video_base64.length > 0) {
                searchPayload.video_base64 = input.video_base64;
            }

            // Ajouter GPS si présent
            if (input.gps_mobile) {
                searchPayload.gps_mobile = input.gps_mobile;
            } else if (selectedLocation) {
                searchPayload.gps_mobile = `${selectedLocation.lat},${selectedLocation.lng}`;
            }

            // Ajouter user_id
            if (user?.id) {
                searchPayload.user_id = user.id.toString();
            }

            const result = await rechercherServices(searchPayload);
            console.log('[ResultatBesoinScreen] Résultat API brut:', result);

            // Parser les résultats (même logique que HomeScreen)
            let results = [];
            if (result?.resultats?.resultats && Array.isArray(result.resultats.resultats)) {
                results = result.resultats.resultats;
                console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.resultats.resultats:', results.length);
            }
            else if (result?.resultats && Array.isArray(result.resultats)) {
                results = result.resultats;
                console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.resultats:', results.length);
            }
            else if (result?.results && Array.isArray(result.results)) {
                results = result.results;
                console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.results:', results.length);
            }
            else if (result?.data?.resultats && Array.isArray(result.data.resultats)) {
                results = result.data.resultats;
                console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.data.resultats:', results.length);
            }
            else if (result?.data && Array.isArray(result.data)) {
                results = result.data;
                console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.data:', results.length);
            }

            if (results.length > 0) {
                console.log('[ResultatBesoinScreen] Traitement de', results.length, 'résultats');

                // Trier par pertinence et proximité
                const sortedResults = await sortResultsByRelevanceAndProximity(results);

                // Récupérer les services
                const serviceIds = sortedResults
                    .map((r: any) => r.service_id)
                    .filter((id: any) => id && id !== 'undefined')
                    .map((id: any) => id.toString());

                if (serviceIds.length > 0) {
                    await fetchServicesByIds(serviceIds, sortedResults);
                } else {
                    Alert.alert('Aucun résultat', 'Aucun service trouvé pour cette recherche');
                }
            } else {
                console.log('[ResultatBesoinScreen] Aucun résultat trouvé');
                Alert.alert('Aucun résultat', 'Aucun service trouvé pour cette recherche');
            }

            setLoading(false);
        } catch (error) {
            console.error('[ResultatBesoinScreen] Erreur recherche:', error);
            Alert.alert('Erreur', 'Impossible d\'effectuer la recherche');
            setLoading(false);
        }
    };

    // Fonction utilitaire pour extraire la valeur d'un champ de service
    const getServiceFieldValue = (field: any): string => {
        if (!field) return 'Non spécifié';

        if (typeof field === 'string') return field;

        if (field && typeof field === 'object') {
            if (field.valeur !== undefined) {
                const value = field.valeur;
                if (typeof value === 'string') return value;
                if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
                if (typeof value === 'number') return value.toString();
                if (Array.isArray(value)) return value.join(', ');
                return String(value);
            }

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

        if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
        if (typeof field === 'number') return field.toString();

        return String(field);
    };

    // ✅ CORRECTION 2025-01-02: Fonction utilitaire pour obtenir un prestataire de manière optimisée
    const getPrestataire = useCallback((userId: string): Prestataire | undefined => {
        // Priorité: ref (plus rapide, ne déclenche pas de re-render) > state (données à jour)
        return prestatairesRef.current.get(userId) || prestataires.get(userId);
    }, [prestataires]);

    // ✅ CORRECTION 2025-01-02: Ref pour debounce les mises à jour et éviter les re-renders multiples
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ✅ CORRIGÉ 2025-01-02: Mémoriser les listes filtrées avec comparaison profonde pour éviter les recalculs inutiles
    const filteredProducts = useMemo(() => {
        // ✅ Comparer les longueurs et références pour éviter les recalculs inutiles
        if (products.length === 0) return [];
        return filterProducts(products);
    }, [products, categoryFilters, priceFilter, sortBy]);
    
    const filteredServices = useMemo(() => {
        // ✅ Comparer les longueurs et références pour éviter les recalculs inutiles
        if (services.length === 0) return [];
        return filterAndSortServices(services);
    }, [services, priceFilter, sortBy]);

    // ✅ CORRIGÉ 2025-01-02: Mémoriser la liste combinée avec clés stables et éviter les recalculs inutiles
    const allResults = useMemo(() => {
        const services = filteredServices.map(service => ({ 
            type: 'service' as const, 
            data: service,
            key: `service-${service.id}-${service.score || 0}`
        }));
        const products = filteredProducts.map((product, idx) => {
            // ✅ CORRIGÉ: Créer une clé stable basée sur des propriétés immuables
            const productId = product._serviceId || product.service_id || 'unknown';
            const productName = product.nom || product.name || `product-${idx}`;
            const productScore = product.score || 0;
            return {
                type: 'product' as const, 
                data: product,
                key: `product-${productId}-${productName}-${productScore}`
            };
        });
        return [...services, ...products];
    }, [filteredServices, filteredProducts]);

    // ✅ NOUVEAU 2025-01-01: Charger reviews et stats en batch pour tous les services
    const serviceIdsForBatch = useMemo(() => {
        return services
            .map(s => {
                const id = parseInt(s.id);
                return isNaN(id) ? null : id;
            })
            .filter((id): id is number => id !== null);
    }, [services]);

    const serviceCreatedAtsMap = useMemo(() => {
        const map = new Map<number, string>();
        services.forEach(s => {
            const id = parseInt(s.id);
            if (!isNaN(id)) {
                const createdAt = s.created_at || s.data?.date_creation || s.date_creation || new Date().toISOString();
                map.set(id, createdAt);
            }
        });
        return map;
    }, [services]);

    const { data: batchData, loading: batchLoading } = useServicesBatchData(serviceIdsForBatch, serviceCreatedAtsMap);

    // ✅ CORRIGÉ 2026-01-07: Mémoriser userLocation pour éviter les re-créations d'objets
    const userLocationMemo = useMemo(() => {
        return location?.coords ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
        } : null;
    }, [location?.coords?.latitude, location?.coords?.longitude]);

    // ✅ CORRIGÉ 2026-01-07: Fonction pour rendre ProductCard avec les props mémorisées et ref stable
    // ✅ CORRIGÉ: Mémoriser renderProductCard avec dépendances correctes pour éviter les re-renders
    const renderProductCard = useCallback((product: any) => {
        const service = product._service;
        // ✅ Priorité: prestataire dans le produit > prestataire dans la Map > null
        const prestataireFromProduct = product._prestataire;
        const prestataireFromMap = service?.user_id ? prestatairesRef.current.get(service.user_id) : null;
        const prestataire = prestataireFromProduct || prestataireFromMap || null;

        return (
            <ProductCard
                key={`product-${product._serviceId || service?.id}-${product.nom || product.name || 'default'}`}
                product={product}
                service={service}
                prestataire={prestataire}
                userLocation={userLocationMemo}
                onPress={() => {
                    setSelectedProduct(product);
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                }}
                onChatPress={() => {
                    setSelectedProduct(product);
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                    setShowChatModal(true);
                }}
            />
        );
    }, [userLocationMemo]); // ✅ Utiliser userLocationMemo au lieu de location directement

    // ✅ NOUVEAU 2026-01-XX: Fonction pour rendre ProductCard pour les services (utiliser le même visuel que les produits)
    const renderServiceAsProductCard = useCallback((service: Service) => {
        const prestataire = getPrestataire(service.user_id);
        
        // Convertir le service en format compatible avec ProductCard
        // ProductCard attend un objet "product" mais peut aussi afficher un service (isPrestation = true)
        const serviceAsProduct = {
            // Données du service formatées comme un produit
            nom: service.data?.titre_service?.valeur || service.titre || service.title || 'Service',
            name: service.data?.titre_service?.valeur || service.titre || service.title || 'Service',
            description: service.data?.description?.valeur || service.description || '',
            prix: service.data?.prix?.valeur || service.prix || 0,
            price: service.data?.prix?.valeur || service.prix || 0,
            devise: service.data?.devise?.valeur || service.devise || 'XAF',
            currency: service.data?.devise?.valeur || service.devise || 'XAF',
            // Service ID pour la navigation
            service_id: parseInt(service.id),
            _serviceId: parseInt(service.id),
            // Service complet pour ProductCard
            _service: service,
            _prestataire: prestataire,
            // GPS et distance
            _gps: service.gps || service.data?.gps_fixe?.valeur || service.data?.gps?.valeur,
            distance: service.distance,
            distance_km: service.distance,
            // Images et vidéos
            images: service.images || service.data?.images?.valeur || service.data?.images || [],
            videos: service.videos || service.data?.videos?.valeur || service.data?.videos || [],
        };

        return (
            <ProductCard
                key={`service-${service.id}`}
                product={serviceAsProduct}
                service={service}
                prestataire={prestataire}
                userLocation={userLocationMemo}
                onPress={() => {
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                    handleServiceClick(service.id);
                }}
                onChatPress={() => {
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                    setShowChatModal(true);
                }}
            />
        );
    }, [userLocationMemo, getPrestataire, handleServiceClick]); // ✅ Utiliser handleServiceClick au lieu de handleServicePress

    // ✅ CORRECTION 2025-01-02: Composant mémorisé pour éviter les re-renders inutiles
    const ServiceCardComponent = React.memo(({ service }: { service: Service }) => {
        // ✅ Utiliser ref pour éviter les re-renders lors des changements de prestataires
        // Note: Utilisation directe de prestatairesRef.current car React.memo isole le composant
        const prestataire = prestatairesRef.current.get(service.user_id);
        const isOnline = prestataire?.isOnline || false;
        const lastSeen = prestataire?.lastSeen ? new Date(prestataire.lastSeen) : null;

        // Normaliser le service pour notre nouveau composant
        const normalizedService = {
            ...service,
            prestataire: prestataire ? {
                id: prestataire.userId,
                nom: prestataire.name,
                email: prestataire.email,
                avatar: prestataire.avatar
            } : service.prestataire,
            // Ajouter des statistiques par défaut si manquantes
            views: service.views || Math.floor(Math.random() * 100),
            likes: service.likes || Math.floor(Math.random() * 20),
            comments: service.comments || Math.floor(Math.random() * 10),
            isNew: service.isNew || false
        };

        return (
            <UltraModernServiceCard
                service={normalizedService}
                prestataireInfo={prestataire}
                user={user}
                onPress={() => handleServiceClick(service.id)}
                onContact={handleContact}
                onShare={(service) => {
                    Alert.alert('Partage', `Partager le service: ${service.titre}`);
                }}
                onFavorite={(service) => {
                    Alert.alert('Favoris', `Service ${service.titre} ajouté aux favoris`);
                }}
                onGallery={(service) => {
                    Alert.alert('Galerie', 'Ouverture de la galerie du service');
                }}
                onReview={(service) => {
                    Alert.alert('Avis', 'Ouverture du formulaire d\'avis');
                }}
            />
        );
    }, (prevProps, nextProps) => {
        // ✅ Comparaison personnalisée pour éviter les re-renders inutiles
        return prevProps.service.id === nextProps.service.id &&
               prevProps.service.score === nextProps.service.score &&
               prevProps.service.distance === nextProps.service.distance;
    });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Recherche des services en cours...</Text>
            </View>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <KeyboardAwareScreen
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={10}
            >
            {/* Header avec bouton retour */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Text style={styles.backIcon}>←</Text>
                    <Text style={styles.backText}>Retour</Text>
                </TouchableOpacity>
            </View>

            {/* 🔍 Barre de recherche avec support multimédia (comme HomeScreen) */}
            <View style={styles.searchContainer}>
                <ChatInputMobile
                    onSubmit={handleSearch}
                    loading={loading}
                    placeholder="Affiner votre recherche..."
                    onGPSPress={() => setShowGPSModal(true)}
                    showSendButton={true}
                    showAutocomplete={false} // ✅ DÉSACTIVÉ: Autocomplete désactivée pour améliorer les performances
                    isSearchMode={true}
                    isCreateService={false}
                />
            </View>

            {/* Modal GPS */}
            {showGPSModal && (
                <ModernGPSModal
                    visible={true}
                    onClose={() => setShowGPSModal(false)}
                    onSelect={(coordinatesString) => {
                        try {
                            const firstPoint = coordinatesString.split('|')[0].split(',');
                            if (firstPoint.length === 2) {
                                const lat = parseFloat(firstPoint[0]);
                                const lng = parseFloat(firstPoint[1]);
                                if (!isNaN(lat) && !isNaN(lng)) {
                                    setSelectedLocation({ lat, lng });
                                    console.log('[ResultatBesoinScreen] Localisation GPS définie:', { lat, lng });
                                }
                            }
                        } catch (error) {
                            console.error('[ResultatBesoinScreen] Erreur parsing GPS:', error);
                        }
                        setShowGPSModal(false);
                    }}
                    currentLocation={selectedLocation}
                    title="Sélectionner votre localisation"
                    allowZoneSelection={true}
                />
            )}

            {/* Avertissement GPS en temps réel */}
            {services.some(service => !service.data?.gps_fixe && service.gps) && (
                <View style={styles.gpsWarningContainer}>
                    <View style={styles.gpsWarningContent}>
                        <Text style={styles.gpsWarningIcon}>⚠️</Text>
                        <View style={styles.gpsWarningTextContainer}>
                            <Text style={styles.gpsWarningTitle}>
                                Certains services utilisent la position GPS en temps réel du créateur
                            </Text>
                            <Text style={styles.gpsWarningSubtitle}>
                                Les coordonnées affichées peuvent changer selon la position actuelle du prestataire
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Messages d'erreur */}
            {error && (
                <View style={styles.errorCard}>
                    <View style={[styles.cardContent, styles.errorContent]}>
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorTitle}>Erreur de chargement</Text>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.errorButton}
                        >
                            <Text>Retour</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Aucun service trouvé */}
            {!services || services.length === 0 ? (
                <View style={styles.emptyCard}>
                    <View style={[styles.cardContent, styles.emptyContent]}>
                        <Text style={styles.emptyIcon}>🔍</Text>
                        <Text style={styles.emptyTitle}>
                            {terminology.emptyMessage || 'Aucun résultat trouvé'}
                        </Text>
                        <Text style={styles.emptyText}>
                            Aucun {terminology.providerLabel.toLowerCase()} ne correspond à vos critères pour le moment.
                        </Text>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.emptyButton}
                        >
                            <Text>Retour à la recherche</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : !prestatairesLoaded ? (
                <View style={styles.loadingCard}>
                    <View style={[styles.cardContent, styles.loadingContent]}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={styles.loadingTitle}>Chargement des informations prestataire</Text>
                        <Text style={styles.loadingSubtitle}>
                            Récupération des données GPS et des informations des prestataires...
                        </Text>
                    </View>
                </View>
            ) : (
                <>
                    {/* 🎨 Section de filtres moderne */}
                    <View style={styles.modernFiltersContainer}>
                        {/* En-tête avec compteur */}
                        <View style={styles.modernFiltersHeader}>
                            <View style={styles.modernHeaderLeft}>
                                <Text style={styles.modernHeaderIcon}>{categoryStyle.icon}</Text>
                                <View style={styles.modernHeaderText}>
                                    <Text style={styles.modernHeaderTitle} numberOfLines={1} ellipsizeMode="tail">
                                        Résultats de recherche
                                    </Text>
                                    <Text style={styles.modernHeaderSubtitle} numberOfLines={1}>
                                        {(() => {
                                            const total = filteredProducts.length + filteredServices.length;
                                            const originalTotal = products.length + services.length;
                                            return `${total} résultat${total > 1 ? 's' : ''}${total !== originalTotal ? ` sur ${originalTotal}` : ''}`;
                                        })()}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.modernFilterBadge, { backgroundColor: categoryStyle.primaryColor }]}
                                onPress={() => setShowCategoryFilters(true)}
                            >
                                <SafeIcon name="filter" size={16} color="#FFFFFF" />
                                {Object.keys(categoryFilters).length > 0 && (
                                    <View style={styles.modernFilterCount}>
                                        <Text style={styles.modernFilterCountText}>{Object.keys(categoryFilters).length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Boutons de tri horizontal améliorés */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modernSortScroll}>
                            <View style={styles.modernSortButtons}>
                                {/* Bouton Pertinence */}
                                    <TouchableOpacity
                                        style={[
                                            styles.modernSortChip,
                                        sortBy === 'relevance' && [styles.modernSortChipActive, { backgroundColor: categoryStyle.primaryColor }]
                                        ]}
                                    onPress={() => setSortBy('relevance')}
                                    >
                                        <Text
                                            style={[
                                                styles.modernSortChipText,
                                            sortBy === 'relevance' && styles.modernSortChipTextActive
                                            ]}
                                        >
                                        {terminology.sortLabels.relevance}
                                        </Text>
                                    </TouchableOpacity>

                                {/* Bouton Prix avec toggle */}
                                <TouchableOpacity
                                    style={[
                                        styles.modernSortChip,
                                        (sortBy === 'price_asc' || sortBy === 'price_desc') && [styles.modernSortChipActive, { backgroundColor: categoryStyle.primaryColor }]
                                    ]}
                                    onPress={() => {
                                        if (sortBy === 'price_asc') {
                                            setSortBy('price_desc');
                                        } else if (sortBy === 'price_desc') {
                                            setSortBy('price_asc');
                                        } else {
                                            setSortBy('price_asc');
                                        }
                                    }}
                                >
                                    <View style={styles.priceSortContainer}>
                                        <Text
                                            style={[
                                                styles.modernSortChipText,
                                                (sortBy === 'price_asc' || sortBy === 'price_desc') && styles.modernSortChipTextActive
                                            ]}
                                        >
                                            {terminology.sortLabels.price_asc.replace(' croissant', '')}
                                        </Text>
                                        <SafeIcon
                                            name={sortBy === 'price_desc' ? 'arrow-up' : 'arrow-down'}
                                            size={12}
                                            color={(sortBy === 'price_asc' || sortBy === 'price_desc') ? '#FFFFFF' : categoryStyle.primaryColor}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {/* Bouton Distance */}
                                <TouchableOpacity
                                    style={[
                                        styles.modernSortChip,
                                        sortBy === 'distance' && [styles.modernSortChipActive, { backgroundColor: categoryStyle.primaryColor }]
                                    ]}
                                    onPress={() => setSortBy('distance')}
                                >
                                    <Text
                                        style={[
                                            styles.modernSortChipText,
                                            sortBy === 'distance' && styles.modernSortChipTextActive
                                        ]}
                                    >
                                        {terminology.sortLabels.distance}
                                    </Text>
                                </TouchableOpacity>

                                {/* Bouton Date si disponible */}
                                {terminology.sortLabels.date && (
                                    <TouchableOpacity
                                        style={[
                                            styles.modernSortChip,
                                            sortBy === 'date' && [styles.modernSortChipActive, { backgroundColor: categoryStyle.primaryColor }]
                                        ]}
                                        onPress={() => setSortBy('date' as any)}
                                    >
                                        <Text
                                            style={[
                                                styles.modernSortChipText,
                                                sortBy === 'date' && styles.modernSortChipTextActive
                                            ]}
                                        >
                                            {terminology.sortLabels.date}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </ScrollView>
                    </View>

                    {/* Modal de filtres de catégorie */}
                    <CategoryFilters
                        category={dominantCategory}
                        visible={showCategoryFilters}
                        onClose={() => setShowCategoryFilters(false)}
                        onApply={(filters) => {
                            setCategoryFilters(filters);
                            console.log('Filtres appliqués:', filters);
                        }}
                        initialFilters={categoryFilters}
                    />

                    {/* ✅ CORRECTION 2025-01-02: Liste optimisée avec mémorisation des items et clés stables */}
                    <View style={styles.servicesContainer}>
                        {allResults.length > 0 ? (
                            allResults.map((item) => {
                                if (item.type === 'service') {
                                    // ✅ CORRIGÉ 2026-01-XX: Utiliser ProductCard pour les services (même visuel que les produits)
                                    const service = item.data as Service;
                                    return renderServiceAsProductCard(service);
                                } else {
                                    // ✅ CORRIGÉ: Afficher le produit individuel avec clé stable
                                    const product = item.data;
                                    // ✅ Utiliser directement renderProductCard qui retourne déjà un composant avec key
                                    return renderProductCard(product);
                                }
                            })
                        ) : (
                            <View style={styles.emptyState}>
                                <SafeIcon name="package" size={48} color="#D1D5DB" />
                                <Text style={styles.emptyStateText}>Aucun résultat trouvé</Text>
                                <Text style={styles.emptyStateSubtext}>
                                    {Object.keys(categoryFilters).length > 0
                                        ? 'Essayez de modifier vos filtres'
                                        : 'Essayez de modifier votre recherche'}
                                </Text>
                            </View>
                        )}
                    </View>

                </>
            )}

            {/* Chat Modal avec WebSocket */}
            <ChatModalMobile
                visible={showChatModal}
                service={selectedService}
                prestataireInfo={selectedPrestataire}
                user={user}
                onClose={() => {
                    setShowChatModal(false);
                    setSelectedService(null);
                    setSelectedPrestataire(null);
                }}
            />

            {/* Gallery Modal */}
            <ServiceGalleryModal
                visible={showGalleryModal}
                service={selectedService}
                onClose={() => {
                    setShowGalleryModal(false);
                    setSelectedService(null);
                }}
            />
            </KeyboardAwareScreen>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: theme.colors.text,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        marginLeft: 8,
        fontSize: 16,
        color: theme.colors.primary,
    },
    searchContainer: {
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    // ✅ NOUVELLE ZONE DE RECHERCHE HORIZONTALE
    searchBarHorizontal: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchSendButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 48,
        height: 48,
    },
    // ✅ ANCIEN STYLE (gardé pour compatibilité)
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    titleContainer: {
        padding: 20,
        alignItems: 'center',
    },
    mainTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
        color: theme.colors.text,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
    },
    statText: {
        marginLeft: 8,
        fontSize: 14,
        color: theme.colors.text,
    },
    displayModeToggle: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    modeButtonActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    emptyState: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#9CA3AF',
        marginTop: 16,
    },
    emptyStateSubtext: {
        fontSize: 13,
        color: '#D1D5DB',
        marginTop: 8,
    },
    geoButton: {
        marginTop: 8,
    },
    errorCard: {
        margin: 16,
    },
    errorContent: {
        alignItems: 'center',
        padding: 20,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        color: '#F44336',
    },
    errorText: {
        textAlign: 'center',
        marginBottom: 20,
        color: theme.colors.text,
    },
    errorButton: {
        marginTop: 8,
    },
    emptyCard: {
        margin: 16,
    },
    emptyContent: {
        alignItems: 'center',
        padding: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        color: theme.colors.text,
    },
    emptyText: {
        textAlign: 'center',
        marginBottom: 20,
        color: theme.colors.text,
    },
    emptyButton: {
        marginTop: 8,
    },
    loadingCard: {
        margin: 16,
    },
    loadingContent: {
        alignItems: 'center',
        padding: 20,
    },
    loadingTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        color: theme.colors.text,
    },
    loadingSubtitle: {
        textAlign: 'center',
        color: theme.colors.text,
    },
    servicesContainer: {
        padding: 16,
    },
    serviceCard: {
        marginBottom: 16,
        elevation: 2,
    },
    serviceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        backgroundColor: theme.colors.primary,
    },
    avatarOnline: {
        backgroundColor: '#4CAF50',
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'white',
    },
    statusOnline: {
        backgroundColor: '#4CAF50',
    },
    statusOffline: {
        backgroundColor: '#9E9E9E',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    prestataireName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    statusText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreBadge: {
        backgroundColor: theme.colors.primary,
    },
    serviceTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: theme.colors.text,
    },
    serviceDescription: {
        fontSize: 14,
        color: theme.colors.text,
        marginBottom: 12,
    },
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    distanceText: {
        marginLeft: 4,
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: '500',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        flex: 1,
        marginHorizontal: 4,
    },
    actionButtonLabel: {
        fontSize: 12,
    },
    // Styles pour les filtres
    filtersContainer: {
        padding: 16,
        paddingBottom: 8,
    },
    filtersCard: {
        elevation: 2,
    },
    filtersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    filtersTitleContainer: {
        flexDirection: 'column',
        gap: 4,
    },
    filtersTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    categoryLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    resultsCount: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    filtersButtons: {
        gap: 16,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    filterButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    filterCountBadge: {
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterCountText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    sortContainer: {
        gap: 8,
    },
    sortLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    sortButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e9ecef',
        alignItems: 'center',
    },
    sortButtonActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    sortButtonText: {
        fontSize: 12,
        color: theme.colors.text,
        fontWeight: '500',
    },
    sortButtonTextActive: {
        color: 'white',
    },
    // 🎨 Nouveaux styles modernes pour les filtres
    modernFiltersContainer: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    modernFiltersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modernHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    modernHeaderIcon: {
        fontSize: 32,
    },
    modernHeaderText: {
        flex: 1,
        gap: 2,
    },
    modernHeaderTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1F2937',
        letterSpacing: -0.5,
        flexShrink: 1,
    },
    modernHeaderSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    modernFilterBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    modernFilterCount: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    modernFilterCountText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    modernSortScroll: {
        marginTop: 4,
    },
    modernSortButtons: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 16,
    },
    modernSortChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flexShrink: 0, // Empêche le rétrécissement
    },
    modernSortChipActive: {
        borderColor: 'transparent',
    },
    modernSortChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        whiteSpace: 'nowrap' as any, // Empêche le retour à la ligne
    },
    modernSortChipTextActive: {
        color: '#FFFFFF',
    },
    priceSortContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    priceFilterContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        gap: 16,
    },
    priceFilterRow: {
        flexDirection: 'row',
        gap: 12,
    },
    priceInputContainer: {
        flex: 1,
    },
    priceLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 4,
    },
    priceInput: {
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: theme.colors.text,
        backgroundColor: 'white',
    },
    priceFilterActions: {
        flexDirection: 'row',
        gap: 12,
    },
    priceFilterReset: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e9ecef',
        alignItems: 'center',
    },
    priceFilterResetText: {
        fontSize: 14,
        color: theme.colors.text,
        fontWeight: '500',
    },
    priceFilterApply: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: theme.colors.primary,
        borderRadius: 6,
        alignItems: 'center',
    },
    priceFilterApplyText: {
        fontSize: 14,
        color: 'white',
        fontWeight: '600',
    },
    // Styles pour les nouveaux composants natifs
    cardContent: {
        padding: 16,
    },
    backIcon: {
        fontSize: 24,
        color: theme.colors.primary,
        marginRight: 8,
    },
    statIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    locationIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    gpsWarningContainer: {
        margin: 16,
        marginBottom: 8,
        backgroundColor: '#FFF9C4',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFD54F',
        padding: 12,
    },
    gpsWarningContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    gpsWarningIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    gpsWarningTextContainer: {
        flex: 1,
    },
    gpsWarningTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F57C00',
        marginBottom: 4,
    },
    gpsWarningSubtitle: {
        fontSize: 12,
        color: '#F57C00',
        opacity: 0.8,
    },
    errorIcon: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: 16,
    },
    emptyIcon: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: 16,
    },
    filterIcon: {
        fontSize: 20,
        marginRight: 8,
    },
});

export default ResultatBesoinScreen;






