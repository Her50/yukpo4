// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ChatModalMobile from '../components/ChatModalMobile';
import ProductCard from '../components/ProductCard';
import ResultsHeader from '../components/ResultsHeader';
import SafeIcon from '../components/SafeIcon';
import ServiceGalleryModal from '../components/ServiceGalleryModal';
import UltraModernServiceCard from '../components/UltraModernServiceCard';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
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
    const [prestatairesLoaded, setPrestatairesLoaded] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [selectedPrestataire, setSelectedPrestataire] = useState<Prestataire | null>(null);
    const [displayMode, setDisplayMode] = useState<'products' | 'services'>('products'); // Mode d'affichage

    // États pour le filtre par prix
    const [priceFilter, setPriceFilter] = useState<{
        min: number | null;
        max: number | null;
        currency: string;
    }>({ min: null, max: null, currency: 'XAF' });
    const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'distance'>('relevance');
    const [showPriceFilter, setShowPriceFilter] = useState(false);

    // Récupérer les résultats depuis la navigation
    const routeParams = (route.params as any) || {};
    const initialResults = routeParams.results || [];

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

            // Fonction helper pour calculer la distance GPS
            const calculateDistance = (gps1: string, gps2: string): number => {
                if (!gps1 || !gps2) return 0;

                const [lat1, lon1] = gps1.split(',').map(Number);
                const [lat2, lon2] = gps2.split(',').map(Number);

                if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;

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

                console.log(`📦 [ResultatBesoinScreen] ${extractedProducts.length} produits extraits de ${validServices.length} services`);
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
            setPrestataires(newPrestataires);
            setPrestatairesLoaded(true);
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des prestataires:', error);
            setPrestatairesLoaded(true); // Marquer comme chargé même en cas d'erreur
        }
    };

    // Traitement initial des résultats
    useEffect(() => {
        const processResults = async () => {
            try {
                if (initialResults && Array.isArray(initialResults) && initialResults.length > 0) {
                    console.log('🔄 Traitement des résultats initiaux:', initialResults.length);

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

        return () => clearTimeout(timeoutId);
    }, [initialResults]);

    // Gestionnaires d'événements
    const handleContact = (prestataireId: string, type: 'message' | 'call') => {
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
    };

    const handleChat = async (service: Service) => {
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
    };

    const handleGallery = (service: Service) => {
        setSelectedService(service);
        setShowGalleryModal(true);
    };

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

    // Composant ServiceResultCard amélioré
    // Composant de rendu pour chaque produit
    const ProductCardComponent = ({ product }: { product: any }) => {
        const service = product._service;
        const prestataire = product._prestataire || prestataires.get(service.user_id) || null;

        return (
            <ProductCard
                product={product}
                service={service}
                prestataire={prestataire}
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
    };

    // Composant de rendu pour chaque service
    const ServiceCardComponent = ({ service }: { service: Service }) => {
        const prestataire = prestataires.get(service.user_id);
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
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Recherche des services en cours...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
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

            {/* En-tête avec statistiques */}
            <ResultsHeader
                title="Services correspondants à votre besoin"
                resultsCount={services.length}
                onGeolocationPress={handleGeolocation}
                onPriceFilterPress={() => {
                    setShowPriceFilter(!showPriceFilter);
                }}
                onSortPress={() => {
                    Alert.alert('Tri', 'Options de tri disponibles');
                }}
                sortBy={sortBy === 'relevance' ? 'pertinence' : sortBy}
            />

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
                        <Text style={styles.emptyTitle}>Aucun service trouvé</Text>
                        <Text style={styles.emptyText}>
                            Aucun prestataire ne correspond à vos critères pour le moment.
                        </Text>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.emptyButton}
                        >
                            <Text>Retour aux besoins</Text>
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
                    {/* Filtres et tri */}
                    <View style={styles.filtersContainer}>
                        <View style={styles.filtersCard}>
                            <View style={styles.cardContent}>
                                <View style={styles.filtersHeader}>
                                    <Text style={styles.filtersTitle}>Filtres et tri</Text>
                                    <Text style={styles.resultsCount}>
                                        {(() => {
                                            const filteredServices = filterAndSortServices(services);
                                            return `${filteredServices.length} service${filteredServices.length > 1 ? 's' : ''}`;
                                        })()}
                                        {(() => {
                                            const filteredServices = filterAndSortServices(services);
                                            if (filteredServices.length !== services.length) {
                                                return ` (${services.length} au total)`;
                                            }
                                            return '';
                                        })()}
                                    </Text>
                                </View>

                                <View style={styles.filtersButtons}>
                                    <TouchableOpacity
                                        style={styles.filterButton}
                                        onPress={() => setShowPriceFilter(!showPriceFilter)}
                                    >
                                        <Text style={styles.filterIcon}>💰</Text>
                                        <Text style={styles.filterButtonText}>Prix</Text>
                                    </TouchableOpacity>

                                    <View style={styles.sortContainer}>
                                        <Text style={styles.sortLabel}>Trier par:</Text>
                                        <View style={styles.sortButtons}>
                                            <TouchableOpacity
                                                style={[styles.sortButton, sortBy === 'relevance' && styles.sortButtonActive]}
                                                onPress={() => setSortBy('relevance')}
                                            >
                                                <Text style={[styles.sortButtonText, sortBy === 'relevance' && styles.sortButtonTextActive]}>
                                                    Pertinence
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.sortButton, sortBy === 'price_asc' && styles.sortButtonActive]}
                                                onPress={() => setSortBy('price_asc')}
                                            >
                                                <Text style={[styles.sortButtonText, sortBy === 'price_asc' && styles.sortButtonTextActive]}>
                                                    Prix ↑
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.sortButton, sortBy === 'price_desc' && styles.sortButtonActive]}
                                                onPress={() => setSortBy('price_desc')}
                                            >
                                                <Text style={[styles.sortButtonText, sortBy === 'price_desc' && styles.sortButtonTextActive]}>
                                                    Prix ↓
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Filtre par prix */}
                                {showPriceFilter && (
                                    <View style={styles.priceFilterContainer}>
                                        <View style={styles.priceFilterRow}>
                                            <View style={styles.priceInputContainer}>
                                                <Text style={styles.priceLabel}>Prix min</Text>
                                                <TextInput
                                                    style={styles.priceInput}
                                                    value={priceFilter.min?.toString() || ''}
                                                    onChangeText={(text) => setPriceFilter(prev => ({
                                                        ...prev,
                                                        min: text ? parseFloat(text) : null
                                                    }))}
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                            <View style={styles.priceInputContainer}>
                                                <Text style={styles.priceLabel}>Prix max</Text>
                                                <TextInput
                                                    style={styles.priceInput}
                                                    value={priceFilter.max?.toString() || ''}
                                                    onChangeText={(text) => setPriceFilter(prev => ({
                                                        ...prev,
                                                        max: text ? parseFloat(text) : null
                                                    }))}
                                                    placeholder="100000"
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>
                                        <View style={styles.priceFilterActions}>
                                            <TouchableOpacity
                                                style={styles.priceFilterReset}
                                                onPress={() => setPriceFilter({ min: null, max: null, currency: 'XAF' })}
                                            >
                                                <Text style={styles.priceFilterResetText}>Réinitialiser</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.priceFilterApply}
                                                onPress={() => setShowPriceFilter(false)}
                                            >
                                                <Text style={styles.priceFilterApplyText}>Appliquer</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Toggle mode d'affichage */}
                    <View style={styles.displayModeToggle}>
                        <TouchableOpacity
                            style={[styles.modeButton, displayMode === 'products' && styles.modeButtonActive]}
                            onPress={() => setDisplayMode('products')}
                        >
                            <SafeIcon name="package" size={18} color={displayMode === 'products' ? '#FFFFFF' : '#6B7280'} />
                            <Text style={[styles.modeButtonText, displayMode === 'products' && styles.modeButtonTextActive]}>
                                Produits ({products.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeButton, displayMode === 'services' && styles.modeButtonActive]}
                            onPress={() => setDisplayMode('services')}
                        >
                            <SafeIcon name="briefcase" size={18} color={displayMode === 'services' ? '#FFFFFF' : '#6B7280'} />
                            <Text style={[styles.modeButtonText, displayMode === 'services' && styles.modeButtonTextActive]}>
                                Services ({services.length})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Liste des produits ou services */}
                    <View style={styles.servicesContainer}>
                        {displayMode === 'products' ? (
                            products.length > 0 ? (
                                products.map((product, index) => (
                                    <ProductCardComponent key={`product-${index}-${product.nom}`} product={product} />
                                ))
                            ) : (
                                <View style={styles.emptyState}>
                                    <SafeIcon name="package" size={48} color="#D1D5DB" />
                                    <Text style={styles.emptyStateText}>Aucun produit trouvé</Text>
                                    <Text style={styles.emptyStateSubtext}>Essayez de basculer en mode Services</Text>
                                </View>
                            )
                        ) : (
                            filterAndSortServices(services).map((service) => (
                                <ServiceCardComponent key={service.id} service={service} />
                            ))
                        )}
                    </View>

                    {/* Footer informatif */}
                    <View style={styles.footerContainer}>
                        <View style={styles.footerCard}>
                            <View style={styles.cardContent}>
                                <Text style={styles.footerTitle}>Comment procéder ?</Text>
                                <View style={styles.stepsContainer}>
                                    <View style={styles.stepItem}>
                                        <View style={styles.stepNumber}>
                                            <Text style={styles.stepNumberText}>1</Text>
                                        </View>
                                        <Text style={styles.stepText}>Choisissez le service qui vous convient</Text>
                                    </View>
                                    <View style={styles.stepItem}>
                                        <View style={styles.stepNumber}>
                                            <Text style={styles.stepNumberText}>2</Text>
                                        </View>
                                        <Text style={styles.stepText}>Contactez le prestataire via le bouton</Text>
                                    </View>
                                    <View style={styles.stepItem}>
                                        <View style={styles.stepNumber}>
                                            <Text style={styles.stepNumberText}>3</Text>
                                        </View>
                                        <Text style={styles.stepText}>Échangez et finalisez votre projet</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
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
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
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
    footerContainer: {
        padding: 16,
    },
    footerCard: {
        backgroundColor: '#E3F2FD',
        borderColor: theme.colors.primary,
        borderWidth: 1,
    },
    footerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
        color: theme.colors.primary,
    },
    stepsContainer: {
        flexDirection: 'column',
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    stepNumberText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.primary,
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
    filtersTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
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
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    filterButtonText: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: '600',
        marginLeft: 8,
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






