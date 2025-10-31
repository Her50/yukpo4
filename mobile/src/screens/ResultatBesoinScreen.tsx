// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import BusSeatSelector from '../components/BusSeatSelector';
import CategoryFilters from '../components/CategoryFilters';
import ChatModalMobile from '../components/ChatModalMobile';
import ProductCard from '../components/ProductCard';
import ProductCardErrorBoundary from '../components/ProductCardErrorBoundary';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import SafeIcon from '../components/SafeIcon';
import SearchBar from '../components/SearchBar';
import ServiceGalleryModal from '../components/ServiceGalleryModal';
import UltraModernServiceCard from '../components/UltraModernServiceCard';
import { categorySupportsVariants, getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useNotifications } from '../hooks/useNotifications';
import { apiGet, apiPost } from '../services/api';
import { theme } from '../theme/theme';
import { generateAndDownloadTicket, shareTicketPDF } from '../utils/busTicketPdfGenerator';
import {
    getCurrentDayShort,
    isPharmacyOpenNow
} from '../utils/healthServiceHelpers';
import { normalizeProduct } from '../utils/productNormalizer';
import {
    detectDominantCategoryWeighted,
    generateSmartFilterSuggestions,
    getFilterHistory,
    saveFilterToHistory,
    SmartFilterSuggestion
} from '../utils/smartFilterSuggestions';
// ✅ OPTIMISATION 6: Analytics tracking
import {
    trackProductContact,
    trackProductView,
    trackSearch
} from '../utils/analytics';

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
    const { subscribeToReturnBusNotifications } = useNotifications(user?.id);

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
    const [showSeatSelector, setShowSeatSelector] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [selectedPrestataire, setSelectedPrestataire] = useState<Prestataire | null>(null);

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

    // ✅ NOUVEAUX ÉTATS: Suggestions intelligentes
    const [smartSuggestions, setSmartSuggestions] = useState<SmartFilterSuggestion[]>([]);
    const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
    const [filterHistory, setFilterHistory] = useState<any[]>([]);

    // Récupérer les résultats depuis la navigation
    const routeParams = (route.params as any) || {};
    const initialResults = routeParams.results || [];

    // ✅ AMÉLIORATION: Déterminer la catégorie dominante avec pondération intelligente
    const dominantCategory = useMemo(() => {
        if (products.length === 0) return 'default';

        // Utiliser la détection intelligente avec pondération
        const detected = detectDominantCategoryWeighted(products);

        console.log(`🎯 [ResultatBesoinScreen] Catégorie dominante détectée: ${detected} (${products.length} produits)`);

        return detected;
    }, [products]);

    // Récupérer la configuration de la catégorie dominante
    const categoryConfig = getCategoryConfig(dominantCategory);
    const categoryStyle = getCategoryStyle(dominantCategory);
    const terminology = getCategoryTerminology(dominantCategory);

    // ✅ AMÉLIORATION: Générer des suggestions intelligentes
    useEffect(() => {
        if (products.length > 0) {
            const userContext = {
                location: location ? {
                    latitude: location.latitude,
                    longitude: location.longitude
                } : undefined,
                budget: routeParams.budget,
                searchQuery: routeParams.searchQuery
            };

            const suggestions = generateSmartFilterSuggestions(
                products,
                dominantCategory,
                userContext
            );

            setSmartSuggestions(suggestions);

            console.log(`💡 [ResultatBesoinScreen] ${suggestions.length} suggestions intelligentes générées`);

            // ✅ OPTIMISATION 6: Track la recherche si query présente
            if (routeParams.searchQuery) {
                trackSearch(routeParams.searchQuery, dominantCategory, products.length);
            }
        }
    }, [products, dominantCategory, location, routeParams.budget]);

    // ✅ AMÉLIORATION: Charger l'historique des filtres
    useEffect(() => {
        const loadFilterHistory = async () => {
            const history = await getFilterHistory(dominantCategory);
            setFilterHistory(history);
            console.log(`📜 [ResultatBesoinScreen] ${history.length} filtres dans l'historique`);
        };

        if (dominantCategory !== 'default') {
            loadFilterHistory();
        }
    }, [dominantCategory]);

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

    // ✅ Vérifier s'il y a une réservation en attente après recharge
    useEffect(() => {
        const checkPendingReservation = async () => {
            try {
                const AsyncStorage = await import('@react-native-async-storage/async-storage').then(m => m.default);
                const pendingData = await AsyncStorage.getItem('@yukpomnang:pending_bus_reservation');

                if (pendingData && user) {
                    const context = JSON.parse(pendingData);
                    const ageMinutes = (Date.now() - context.timestamp) / (1000 * 60);

                    // Si moins de 10 minutes, proposer de continuer
                    if (ageMinutes < 10) {
                        Alert.alert(
                            '🎫 Reprendre votre réservation?',
                            `Vous aviez commencé une réservation:\n\n${context.productName}\n${context.reservations.length} place(s)\nMontant: ${context.totalAmount.toLocaleString()} FCFA\n\nVoulez-vous continuer?`,
                            [
                                {
                                    text: 'Continuer',
                                    onPress: () => {
                                        // Rouvrir le sélecteur pour la même réservation
                                        const product = products.find(p => p.id === context.productId);
                                        if (product) {
                                            setSelectedProduct(product);
                                            setShowSeatSelector(true);
                                        }
                                    }
                                },
                                {
                                    text: 'Annuler',
                                    style: 'cancel',
                                    onPress: () => AsyncStorage.removeItem('@yukpomnang:pending_bus_reservation')
                                }
                            ]
                        );
                    } else {
                        // Trop vieux, supprimer
                        await AsyncStorage.removeItem('@yukpomnang:pending_bus_reservation');
                    }
                }
            } catch (error) {
                console.error('Erreur vérification réservation en attente:', error);
            }
        };

        // Vérifier seulement si on vient de RechargeTokens
        if (routeParams.fromRecharge && user) {
            checkPendingReservation();
        }
    }, [user, routeParams.fromRecharge]);

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
    // ✅ NOUVEAU: Récupérer le prix avec gestion intelligente des variantes par catégorie
    const getServicePrice = (service: Service, mode: 'min' | 'max' | 'first' = 'first'): number | null => {
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
                const firstProduct = produits[0];
                const productType = firstProduct.type;

                // ✅ NOUVEAU: Vérifier si la catégorie de produit supporte les variantes
                const supportsVariants = productType && categorySupportsVariants(productType);

                // ✅ Gestion intelligente des variantes (uniquement pour les catégories supportées)
                if (supportsVariants && firstProduct.variants && Array.isArray(firstProduct.variants) && firstProduct.variants.length > 0) {
                    const variantPrices = firstProduct.variants
                        .map(v => parseFloat(v.prix))
                        .filter(p => !isNaN(p) && p > 0);

                    if (variantPrices.length > 0) {
                        if (mode === 'min') {
                            return Math.min(...variantPrices);
                        } else if (mode === 'max') {
                            return Math.max(...variantPrices);
                        } else {
                            // Par défaut, retourner le prix minimum
                            return Math.min(...variantPrices);
                        }
                    }
                }

                // Sinon, prix classique du produit
                if (firstProduct.price) {
                    return parseFloat(firstProduct.price);
                }
                if (firstProduct.prix) {
                    return parseFloat(firstProduct.prix);
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

    // ✅ OPTIMISATION 1: Mémoriser les produits filtrés avec useMemo
    const filteredProductsMemo = useMemo(() => {
        let filtered = [...products];

        // Appliquer les filtres de catégorie spécifiques
        if (Object.keys(categoryFilters).length > 0) {
            filtered = filtered.filter(product => {
                // ✅ FILTRES SPÉCIAUX POUR CLINIQUES/HÔPITAUX
                if (product.type === 'hopital_clinique') {
                    // Filtre "Ouvert maintenant" (même logique que pharmacies)
                    if (categoryFilters.ouvertMaintenant === true) {
                        const now = new Date();
                        const currentDay = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][now.getDay()];
                        const currentHour = now.getHours();
                        const currentMinutes = now.getMinutes();
                        const currentTimeInMinutes = currentHour * 60 + currentMinutes;

                        // Vérifier si ouvert aujourd'hui
                        const isOpenToday = product.joursOuverture?.includes(currentDay);
                        if (!isOpenToday && !product.urgencesDisponible) return false; // Sauf si urgences 24h/24

                        // Vérifier les horaires (si pas urgences 24h/24)
                        if (!product.urgencesDisponible && product.heuresOuverture && product.heuresFermeture) {
                            const [openHour, openMin] = product.heuresOuverture.split(':').map(Number);
                            const [closeHour, closeMin] = product.heuresFermeture.split(':').map(Number);
                            const openTimeInMinutes = openHour * 60 + openMin;
                            const closeTimeInMinutes = closeHour * 60 + closeMin;

                            if (currentTimeInMinutes < openTimeInMinutes || currentTimeInMinutes > closeTimeInMinutes) {
                                return false;
                            }
                        }
                    }

                    // Filtre par prestations médicales (multiselect)
                    if (categoryFilters.prestationsMedicales && Array.isArray(categoryFilters.prestationsMedicales) && categoryFilters.prestationsMedicales.length > 0) {
                        const hasPrestations = categoryFilters.prestationsMedicales.some((prestationRecherchee: string) =>
                            product.prestationsMedicales?.includes(prestationRecherchee)
                        );
                        if (!hasPrestations) return false;
                    }

                    // Filtre par jour de disponibilité
                    if (categoryFilters.jourDisponibilite) {
                        const jourRecherche = categoryFilters.jourDisponibilite;
                        const plannings = Object.values(product.planningHebdomadaire || {});
                        const hasJour = plannings.some((p: any) =>
                            p.jours && p.jours.includes(jourRecherche)
                        );
                        if (!hasJour) return false;
                    }

                    // Filtre par moment de disponibilité
                    if (categoryFilters.momentDisponibilite) {
                        const momentRecherche = categoryFilters.momentDisponibilite;
                        const plannings = Object.values(product.planningHebdomadaire || {});
                        const hasMoment = plannings.some((p: any) =>
                            p.moment === momentRecherche || p.moment === '24h/24'
                        );
                        if (!hasMoment) return false;
                    }

                    // Filtre banque de sang
                    if (categoryFilters.banqueSang === true) {
                        if (!product.banqueSang) return false;
                    }

                    // Filtre urgences disponibles
                    if (categoryFilters.urgencesDisponible === true) {
                        const hasUrgences = product.prestationsMedicales?.includes('Urgences 24h/24');
                        if (!hasUrgences) return false;
                    }

                    // Filtre RDV en ligne
                    if (categoryFilters.rdvEnLigne === true) {
                        if (!product.rdvEnLigne) return false;
                    }

                    // Filtre type d'établissement
                    if (categoryFilters.typeEtablissement) {
                        if (product.typeEtablissement !== categoryFilters.typeEtablissement) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PHARMACIES
                if (product.type === 'pharmacie') {
                    // Filtre "Ouvert maintenant"
                    if (categoryFilters.ouvertMaintenant === true) {
                        if (!isPharmacyOpenNow(product)) return false;
                    }

                    // Filtre "De garde aujourd'hui"
                    if (categoryFilters.deGarde === true) {
                        const currentDay = getCurrentDayShort();
                        const isGuardToday = product.joursGarde?.includes(currentDay) || product.typePharmacie === 'Permanence nuit';
                        if (!isGuardToday) return false;
                    }

                    // Filtre par jour de garde spécifique
                    if (categoryFilters.jourGarde) {
                        const jourRecherche = categoryFilters.jourGarde;
                        const hasJour = product.joursGarde?.includes(jourRecherche) || product.typePharmacie === 'Permanence nuit';
                        if (!hasJour) return false;
                    }

                    // Filtre type de pharmacie
                    if (categoryFilters.typePharmacie) {
                        if (product.typePharmacie !== categoryFilters.typePharmacie) return false;
                    }

                    // Filtre services (multiselect)
                    if (categoryFilters.services && Array.isArray(categoryFilters.services) && categoryFilters.services.length > 0) {
                        const hasServices = categoryFilters.services.some((serviceRecherche: string) =>
                            product.services?.includes(serviceRecherche)
                        );
                        if (!hasServices) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR LABORATOIRES
                if (product.type === 'laboratoire') {
                    // Filtre par examens laboratoire (multiselect)
                    if (categoryFilters.examensLaboratoire && Array.isArray(categoryFilters.examensLaboratoire) && categoryFilters.examensLaboratoire.length > 0) {
                        const hasExamens = categoryFilters.examensLaboratoire.some((examenRecherche: string) =>
                            product.examensLaboratoire?.includes(examenRecherche)
                        );
                        if (!hasExamens) return false;
                    }

                    // Filtre par jour de disponibilité
                    if (categoryFilters.jourDisponibilite) {
                        const jourRecherche = categoryFilters.jourDisponibilite;
                        const plannings = Object.values(product.planningExamens || {});
                        const hasJour = plannings.some((p: any) =>
                            p.jours && p.jours.includes(jourRecherche)
                        );
                        if (!hasJour) return false;
                    }

                    // Filtre par moment de disponibilité
                    if (categoryFilters.momentDisponibilite) {
                        const momentRecherche = categoryFilters.momentDisponibilite;
                        const plannings = Object.values(product.planningExamens || {});
                        const hasMoment = plannings.some((p: any) =>
                            p.moment === momentRecherche || p.moment === '24h/24'
                        );
                        if (!hasMoment) return false;
                    }

                    // Filtre prélèvement domicile
                    if (categoryFilters.prelevementDomicile === true) {
                        if (!product.prelevementDomicile) return false;
                    }

                    // Filtre résultats rapides
                    if (categoryFilters.resultatRapide === true) {
                        if (!product.resultatRapide) return false;
                    }

                    // Filtre RDV en ligne
                    if (categoryFilters.rdvEnLigne === true) {
                        if (!product.rdvEnLigne) return false;
                    }

                    // Filtre type de laboratoire
                    if (categoryFilters.typeLaboratoire) {
                        if (product.typeLaboratoire !== categoryFilters.typeLaboratoire) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR IMMOBILIER BÂTIMENT (incluant location courte)
                if (product.type === 'immobilier_batiment' || product.type === 'immobilier_location_courte') {
                    // Filtre statut immobilier
                    if (categoryFilters.statutImmobilier) {
                        if (product.statutImmobilier !== categoryFilters.statutImmobilier) return false;
                    }

                    // Filtre type immobilier
                    if (categoryFilters.typeImmobilier) {
                        if (product.typeImmobilier !== categoryFilters.typeImmobilier) return false;
                    }

                    // Filtre standing
                    if (categoryFilters.standing) {
                        if (product.standing !== categoryFilters.standing) return false;
                    }

                    // Filtre état général
                    if (categoryFilters.etatGeneral) {
                        if (product.etatGeneral !== categoryFilters.etatGeneral) return false;
                    }

                    // Filtre ameublement
                    if (categoryFilters.ameublement) {
                        if (product.ameublement !== categoryFilters.ameublement) return false;
                    }

                    // Filtre nombre de chambres (range)
                    if (categoryFilters.nbChambres) {
                        const nbChambres = parseInt(product.nbChambres || '0');
                        if (nbChambres < categoryFilters.nbChambres) return false;
                    }

                    // Filtre nombre de salles de bain (range)
                    if (categoryFilters.nbSallesBain) {
                        const nbSallesBain = parseInt(product.nbSallesBain || '0');
                        if (nbSallesBain < categoryFilters.nbSallesBain) return false;
                    }

                    // Filtre superficie (range)
                    if (categoryFilters.superficie) {
                        const superficie = parseFloat(product.superficie || '0');
                        if (superficie < categoryFilters.superficie) return false;
                    }

                    // Filtre équipements (multiselect)
                    if (categoryFilters.equipementsImmo && Array.isArray(categoryFilters.equipementsImmo) && categoryFilters.equipementsImmo.length > 0) {
                        const hasEquipements = categoryFilters.equipementsImmo.some((equipRecherche: string) =>
                            product.equipementsImmo?.includes(equipRecherche)
                        );
                        if (!hasEquipements) return false;
                    }

                    // Filtres toggles
                    if (categoryFilters.parking === true && !product.parking) return false;
                    if (categoryFilters.ascenseur === true && !product.ascenseur) return false;
                    if (categoryFilters.disponibleImmediatement === true && !product.disponibleImmediatement) return false;
                    if (categoryFilters.titreFoncier === true && !product.titreFoncier) return false;

                    // Filtres spécifiques LOCATION COURTE DURÉE
                    if (categoryFilters.nettoyageInclus === true && !product.nettoyageInclus) return false;
                    if (categoryFilters.lingeInclus === true && !product.lingeInclus) return false;
                    if (categoryFilters.reservationInstantanee === true && !product.reservationInstantanee) return false;

                    // Filtre capacité personnes (range) pour location courte
                    if (categoryFilters.capacitePersonnes_min !== undefined || categoryFilters.capacitePersonnes_max !== undefined) {
                        const capacite = product.capacitePersonnes ? parseInt(product.capacitePersonnes) : 0;
                        if (categoryFilters.capacitePersonnes_min !== undefined && capacite < categoryFilters.capacitePersonnes_min) return false;
                        if (categoryFilters.capacitePersonnes_max !== undefined && capacite > categoryFilters.capacitePersonnes_max) return false;
                    }

                    // ✅ NOUVEAU: Filtre Ville
                    if (categoryFilters.ville) {
                        const villeProduct = product.ville?.toLowerCase() || product.localisation?.toLowerCase() || '';
                        const villeFilter = categoryFilters.ville.toLowerCase();
                        if (!villeProduct.includes(villeFilter) && villeFilter !== villeProduct) return false;
                    }

                    // ✅ NOUVEAU: Filtre Quartier
                    if (categoryFilters.quartier) {
                        const quartierProduct = product.quartier?.toLowerCase() || product.localisation?.toLowerCase() || '';
                        const quartierFilter = categoryFilters.quartier.toLowerCase();
                        if (!quartierProduct.includes(quartierFilter)) return false;
                    }

                    // ✅ NOUVEAU: Filtre Accès routier
                    if (categoryFilters.acces_route) {
                        if (product.acces_route !== categoryFilters.acces_route) return false;
                    }

                    // ✅ NOUVEAU: Filtre Proximités (multiselect)
                    if (categoryFilters.proximites && Array.isArray(categoryFilters.proximites) && categoryFilters.proximites.length > 0) {
                        const hasProximites = categoryFilters.proximites.some((proxRecherche: string) =>
                            product.proximites?.includes(proxRecherche)
                        );
                        if (!hasProximites) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR AUTOMOBILE
                if (product.type === 'automobile') {
                    // Filtre type véhicule
                    if (categoryFilters.typeVehicule) {
                        if (product.typeVehicule !== categoryFilters.typeVehicule) return false;
                    }

                    // Filtre type carrosserie
                    if (categoryFilters.typeCarrosserie) {
                        if (product.typeCarrosserie !== categoryFilters.typeCarrosserie) return false;
                    }

                    // Filtre marque
                    if (categoryFilters.marqueAutomobile) {
                        if (product.marqueAutomobile !== categoryFilters.marqueAutomobile) return false;
                    }

                    // Filtre modèle
                    if (categoryFilters.modeleAutomobile) {
                        if (product.modeleAutomobile !== categoryFilters.modeleAutomobile) return false;
                    }

                    // Filtre état véhicule
                    if (categoryFilters.etatVehicule) {
                        if (product.etatVehicule !== categoryFilters.etatVehicule) return false;
                    }

                    // Filtre année (range)
                    if (categoryFilters.annee) {
                        const annee = parseInt(product.annee || '0');
                        if (annee < categoryFilters.annee) return false;
                    }

                    // Filtre kilométrage (range)
                    if (categoryFilters.kilometrage) {
                        const km = parseFloat(product.kilometrage || '0');
                        if (km > categoryFilters.kilometrage) return false;
                    }

                    // Filtre couleur
                    if (categoryFilters.couleurAutomobile) {
                        if (product.couleurAutomobile !== categoryFilters.couleurAutomobile) return false;
                    }

                    // Filtre type carburant
                    if (categoryFilters.typeCarburant) {
                        if (product.typeCarburant !== categoryFilters.typeCarburant) return false;
                    }

                    // Filtre transmission
                    if (categoryFilters.transmission) {
                        if (product.transmission !== categoryFilters.transmission) return false;
                    }

                    // Filtre nombre de portes
                    if (categoryFilters.nbPortes) {
                        const nbPortes = parseInt(product.nbPortes || '0');
                        if (nbPortes < categoryFilters.nbPortes) return false;
                    }

                    // Filtre nombre de places
                    if (categoryFilters.nbPlaces) {
                        const nbPlaces = parseInt(product.nbPlaces || '0');
                        if (nbPlaces < categoryFilters.nbPlaces) return false;
                    }

                    // Filtre puissance (range)
                    if (categoryFilters.puissance) {
                        const puissance = parseInt(product.puissance || '0');
                        if (puissance < categoryFilters.puissance) return false;
                    }

                    // Filtre cylindrée (range)
                    if (categoryFilters.cylindree) {
                        const cylindree = parseInt(product.cylindree || '0');
                        if (cylindree < categoryFilters.cylindree) return false;
                    }

                    // Filtre équipements auto (multiselect)
                    if (categoryFilters.equipementsAuto && Array.isArray(categoryFilters.equipementsAuto) && categoryFilters.equipementsAuto.length > 0) {
                        const hasEquipements = categoryFilters.equipementsAuto.some((equipRecherche: string) =>
                            product.equipementsAuto?.includes(equipRecherche)
                        );
                        if (!hasEquipements) return false;
                    }

                    // Filtres toggles
                    if (categoryFilters.premiereMain === true && !product.premiereMain) return false;
                    if (categoryFilters.historiqueEntretien === true && !product.historiqueEntretien) return false;
                    if (categoryFilters.contreTechnique === true && !product.contreTechnique) return false;
                    if (categoryFilters.garantie === true && !product.garantie) return false;
                    if (categoryFilters.papiers === true && !product.papiers) return false;

                    // ✅ NOUVEAU: Filtres de localisation (alignement LocationSelector)
                    if (categoryFilters.villeVehicule) {
                        const villeProduct = product.villeVehicule?.toLowerCase() || '';
                        const villeFilter = categoryFilters.villeVehicule.toLowerCase();
                        if (!villeProduct.includes(villeFilter) && villeFilter !== villeProduct) return false;
                    }
                    if (categoryFilters.quartierVehicule) {
                        const quartierProduct = product.quartierVehicule?.toLowerCase() || '';
                        const quartierFilter = categoryFilters.quartierVehicule.toLowerCase();
                        if (!quartierProduct.includes(quartierFilter) && quartierFilter !== quartierProduct) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR MOBILIER
                if (product.type === 'mobilier') {
                    if (categoryFilters.typeMobilier && product.typeMobilier !== categoryFilters.typeMobilier) return false;
                    if (categoryFilters.categorieMobilier && product.categorieMobilier !== categoryFilters.categorieMobilier) return false;
                    if (categoryFilters.styleMobilier && product.styleMobilier !== categoryFilters.styleMobilier) return false;
                    if (categoryFilters.materiauMobilier && product.materiauMobilier !== categoryFilters.materiauMobilier) return false;
                    if (categoryFilters.couleurMobilier && product.couleurMobilier !== categoryFilters.couleurMobilier) return false;
                    if (categoryFilters.etatMobilier && product.etatMobilier !== categoryFilters.etatMobilier) return false;

                    // Range: nombrePlaces
                    if (categoryFilters.nombrePlaces_min !== undefined || categoryFilters.nombrePlaces_max !== undefined) {
                        const places = product.nombrePlaces ? parseInt(product.nombrePlaces) : 0;
                        if (categoryFilters.nombrePlaces_min !== undefined && places < categoryFilters.nombrePlaces_min) return false;
                        if (categoryFilters.nombrePlaces_max !== undefined && places > categoryFilters.nombrePlaces_max) return false;
                    }

                    // Toggles
                    if (categoryFilters.livraison !== undefined && product.livraison !== categoryFilters.livraison) return false;
                    if (categoryFilters.demontable !== undefined && product.demontable !== categoryFilters.demontable) return false;
                    if (categoryFilters.montageRequis !== undefined && product.montageRequis !== categoryFilters.montageRequis) return false;
                }

                // ✅ FILTRES SPÉCIAUX POUR ÉLECTROMÉNAGER
                if (product.type === 'electromenager') {
                    if (categoryFilters.typeElectro && product.typeElectro !== categoryFilters.typeElectro) return false;
                    if (categoryFilters.categorieElectro && product.categorieElectro !== categoryFilters.categorieElectro) return false;
                    if (categoryFilters.marqueElectro && product.marqueElectro !== categoryFilters.marqueElectro) return false;
                    if (categoryFilters.etatElectro && product.etatElectro !== categoryFilters.etatElectro) return false;
                    if (categoryFilters.consommationEnergetique && product.consommationEnergetique !== categoryFilters.consommationEnergetique) return false;
                    if (categoryFilters.couleurElectro && product.couleurElectro !== categoryFilters.couleurElectro) return false;

                    // Range: anneeAchat
                    if (categoryFilters.anneeAchat_min !== undefined || categoryFilters.anneeAchat_max !== undefined) {
                        const annee = product.anneeAchat ? parseInt(product.anneeAchat) : 0;
                        if (categoryFilters.anneeAchat_min !== undefined && annee < categoryFilters.anneeAchat_min) return false;
                        if (categoryFilters.anneeAchat_max !== undefined && annee > categoryFilters.anneeAchat_max) return false;
                    }

                    // Range: capacite
                    if (categoryFilters.capacite_min !== undefined || categoryFilters.capacite_max !== undefined) {
                        const capacite = product.capacite ? parseFloat(product.capacite) : 0;
                        if (categoryFilters.capacite_min !== undefined && capacite < categoryFilters.capacite_min) return false;
                        if (categoryFilters.capacite_max !== undefined && capacite > categoryFilters.capacite_max) return false;
                    }

                    // Multiselect: fonctionnalites
                    if (categoryFilters.fonctionnalites && Array.isArray(categoryFilters.fonctionnalites) && categoryFilters.fonctionnalites.length > 0) {
                        if (!product.fonctionnalites || !categoryFilters.fonctionnalites.every((f: string) => product.fonctionnalites?.includes(f))) {
                            return false;
                        }
                    }

                    // Toggles
                    if (categoryFilters.garantieConstructeur !== undefined && product.garantieConstructeur !== categoryFilters.garantieConstructeur) return false;
                    if (categoryFilters.facture !== undefined && product.facture !== categoryFilters.facture) return false;
                    if (categoryFilters.manuel !== undefined && product.manuel !== categoryFilters.manuel) return false;
                }

                // ✅ FILTRES SPÉCIAUX POUR ALIMENTATION
                if (product.type === 'agroalimentaire' || product.type === 'aliments') { // ✅ FALLBACK: Support des 2 noms
                    // Filtres de base
                    if (categoryFilters.categorieAliment && product.categorieAliment !== categoryFilters.categorieAliment) return false;
                    if (categoryFilters.typeAliment && product.typeAliment !== categoryFilters.typeAliment) return false;
                    if (categoryFilters.marqueAliment && product.marqueAliment !== categoryFilters.marqueAliment) return false; // ✅ NOUVEAU
                    if (categoryFilters.origine && product.origine !== categoryFilters.origine) return false;
                    if (categoryFilters.conditionnement && product.conditionnement !== categoryFilters.conditionnement) return false;
                    if (categoryFilters.conservation && product.conservation !== categoryFilters.conservation) return false;
                    if (categoryFilters.uniteMesure && product.uniteMesure !== categoryFilters.uniteMesure) return false;

                    // Range: stockDisponible
                    if (categoryFilters.stockDisponible_min !== undefined || categoryFilters.stockDisponible_max !== undefined) {
                        const stock = product.stockDisponible || 0;
                        if (categoryFilters.stockDisponible_min !== undefined && stock < categoryFilters.stockDisponible_min) return false;
                        if (categoryFilters.stockDisponible_max !== undefined && stock > categoryFilters.stockDisponible_max) return false;
                    }

                    // Toggle: bio
                    if (categoryFilters.bio !== undefined && product.bio !== categoryFilters.bio) return false;

                    // Multiselect: labelQualite
                    if (categoryFilters.labelQualite && Array.isArray(categoryFilters.labelQualite) && categoryFilters.labelQualite.length > 0) {
                        if (!product.labelQualite || !categoryFilters.labelQualite.every((l: string) => product.labelQualite?.includes(l))) {
                            return false;
                        }
                    }

                    // Multiselect: certifications
                    if (categoryFilters.certifications && Array.isArray(categoryFilters.certifications) && categoryFilters.certifications.length > 0) {
                        if (!product.certifications || !categoryFilters.certifications.every((c: string) => product.certifications?.includes(c))) {
                            return false;
                        }
                    }

                    // ✅ NOUVEAU: Multiselect: allergènes (exclusion si le filtre est activé)
                    if (categoryFilters.allergenesArray && Array.isArray(categoryFilters.allergenesArray) && categoryFilters.allergenesArray.length > 0) {
                        // Exclure les produits contenant les allergènes sélectionnés
                        const productAllergenes = product.allergenesArray || (product.allergenes ? product.allergenes.split(',').map(a => a.trim()) : []);
                        const hasAllergene = categoryFilters.allergenesArray.some((allergen: string) =>
                            productAllergenes.some((pa: string) => pa.toLowerCase().includes(allergen.toLowerCase()))
                        );
                        if (hasAllergene) return false; // Exclure si contient un allergène filtré
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR MÉCANICIEN / GARAGE
                if (product.type === 'mecanicien') {
                    // Multiselect filters
                    if (categoryFilters.typeServiceMecanique && Array.isArray(categoryFilters.typeServiceMecanique) && categoryFilters.typeServiceMecanique.length > 0) {
                        if (!product.typeServiceMecanique || !categoryFilters.typeServiceMecanique.some((service: string) => product.typeServiceMecanique?.includes(service))) {
                            return false;
                        }
                    }
                    if (categoryFilters.specialitesGarage && Array.isArray(categoryFilters.specialitesGarage) && categoryFilters.specialitesGarage.length > 0) {
                        if (!product.specialitesGarage || !categoryFilters.specialitesGarage.some((spec: string) => product.specialitesGarage?.includes(spec))) {
                            return false;
                        }
                    }
                    if (categoryFilters.marquesVehicules && Array.isArray(categoryFilters.marquesVehicules) && categoryFilters.marquesVehicules.length > 0) {
                        if (!product.marquesVehicules || !categoryFilters.marquesVehicules.some((marque: string) => product.marquesVehicules?.includes(marque))) {
                            return false;
                        }
                    }
                    if (categoryFilters.certificationsMeca && Array.isArray(categoryFilters.certificationsMeca) && categoryFilters.certificationsMeca.length > 0) {
                        if (!product.certificationsMeca || !categoryFilters.certificationsMeca.some((cert: string) => product.certificationsMeca?.includes(cert))) {
                            return false;
                        }
                    }

                    // Select filters
                    if (categoryFilters.delaisIntervention && product.delaisIntervention !== categoryFilters.delaisIntervention) {
                        return false;
                    }
                    if (categoryFilters.urgenceMeca && product.urgenceMeca !== categoryFilters.urgenceMeca) {
                        return false;
                    }

                    // Toggle filters
                    if (categoryFilters.devisGratuit !== undefined && product.devisGratuit !== categoryFilters.devisGratuit) return false;
                    if (categoryFilters.garantieReparations !== undefined && product.garantieReparations !== categoryFilters.garantieReparations) return false;
                    if (categoryFilters.vehiculeCourtoisie !== undefined && product.vehiculeCourtoisie !== categoryFilters.vehiculeCourtoisie) return false;
                }

                // ✅ FILTRES SPÉCIAUX POUR SMARTPHONE (TELEPHONE)
                if (product.type === 'telephone') {
                    // Marque
                    if (categoryFilters.marqueTelephone && product.marqueTelephone !== categoryFilters.marqueTelephone) {
                        return false;
                    }

                    // État
                    if (categoryFilters.etatTelephone && product.etatTelephone !== categoryFilters.etatTelephone) {
                        return false;
                    }

                    // Stockage (select)
                    if (categoryFilters.stockage && product.stockage !== categoryFilters.stockage) {
                        return false;
                    }

                    // RAM (select)
                    if (categoryFilters.ram && product.ram !== categoryFilters.ram) {
                        return false;
                    }

                    // Couleur (select)
                    if (categoryFilters.couleurTelephone && product.couleurTelephone !== categoryFilters.couleurTelephone) {
                        return false;
                    }

                    // Opérateur
                    if (categoryFilters.operateur && product.operateur !== categoryFilters.operateur) {
                        return false;
                    }

                    // Taille écran
                    if (categoryFilters.tailleEcran && product.tailleEcran !== categoryFilters.tailleEcran) {
                        return false;
                    }

                    // Appareil photo (cameraPrincipale)
                    if (categoryFilters.cameraPrincipale && product.numeroCameraPrincipale) {
                        const productMP = parseInt(product.numeroCameraPrincipale.replace('MP', '')) || 0;
                        const filterMP = parseInt(categoryFilters.cameraPrincipale.replace('MP et plus', '').replace('MP', '')) || 0;
                        if (productMP < filterMP) {
                            return false;
                        }
                    }

                    // Capacité batterie
                    if (categoryFilters.batterie && product.batterie && product.batterie !== categoryFilters.batterie) {
                        return false;
                    }

                    // Charge rapide
                    if (categoryFilters.chargeRapide && product.chargeRapide && product.chargeRapide !== categoryFilters.chargeRapide) {
                        return false;
                    }

                    // Sécurité biométrique
                    if (categoryFilters.securiteBiometrique && product.securiteTelephone && product.securiteTelephone !== categoryFilters.securiteBiometrique) {
                        return false;
                    }

                    // Toggles
                    if (categoryFilters.connectivite5G === true && !product.connectivite5G) {
                        return false;
                    }

                    if (categoryFilters.dualSim === true && !product.dualSim) {
                        return false;
                    }

                    if (categoryFilters.boiteOriginale === true && !product.boiteOriginale) {
                        return false;
                    }

                    if (categoryFilters.factureTelephone === true && !product.factureTelephone) {
                        return false;
                    }

                    if (categoryFilters.ecranOriginal === true && !product.ecranOriginal) {
                        return false;
                    }

                    if (categoryFilters.imei === true && !product.imei) {
                        return false;
                    }

                    // Année d'achat (range)
                    if (categoryFilters.anneeAchatTelephone_min !== undefined || categoryFilters.anneeAchatTelephone_max !== undefined) {
                        const annee = product.anneeAchatTelephone ? parseInt(product.anneeAchatTelephone) : 0;
                        if (categoryFilters.anneeAchatTelephone_min !== undefined && annee < categoryFilters.anneeAchatTelephone_min) {
                            return false;
                        }
                        if (categoryFilters.anneeAchatTelephone_max !== undefined && annee > categoryFilters.anneeAchatTelephone_max) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ORDINATEUR
                if (product.type === 'ordinateur') {
                    // Type
                    if (categoryFilters.typeOrdinateur && product.typeOrdinateur !== categoryFilters.typeOrdinateur) {
                        return false;
                    }

                    // Marque
                    if (categoryFilters.marqueOrdinateur && product.marqueOrdinateur !== categoryFilters.marqueOrdinateur) {
                        return false;
                    }

                    // État
                    if (categoryFilters.etatOrdinateur && product.etatOrdinateur !== categoryFilters.etatOrdinateur) {
                        return false;
                    }

                    // Processeur (multiselect)
                    if (categoryFilters.processeur && Array.isArray(categoryFilters.processeur) && categoryFilters.processeur.length > 0) {
                        if (!categoryFilters.processeur.includes(product.processeur)) {
                            return false;
                        }
                    }

                    // RAM (multiselect)
                    if (categoryFilters.ramOrdinateur && Array.isArray(categoryFilters.ramOrdinateur) && categoryFilters.ramOrdinateur.length > 0) {
                        if (!categoryFilters.ramOrdinateur.includes(product.ramOrdinateur)) {
                            return false;
                        }
                    }

                    // Stockage (multiselect)
                    if (categoryFilters.stockageOrdinateur && Array.isArray(categoryFilters.stockageOrdinateur) && categoryFilters.stockageOrdinateur.length > 0) {
                        if (!categoryFilters.stockageOrdinateur.includes(product.stockageOrdinateur)) {
                            return false;
                        }
                    }

                    // Carte graphique
                    if (categoryFilters.carteGraphique && product.carteGraphique && !product.carteGraphique.includes(categoryFilters.carteGraphique)) {
                        return false;
                    }

                    // Usage (multiselect)
                    if (categoryFilters.usage && Array.isArray(categoryFilters.usage) && categoryFilters.usage.length > 0) {
                        if (!categoryFilters.usage.includes(product.usage)) {
                            return false;
                        }
                    }

                    // Système d'exploitation
                    if (categoryFilters.systemeExploitation && product.systemeExploitation && !product.systemeExploitation.includes(categoryFilters.systemeExploitation)) {
                        return false;
                    }

                    // Taille écran
                    if (categoryFilters.tailleEcranOrdinateur && product.tailleEcranOrdinateur !== categoryFilters.tailleEcranOrdinateur) {
                        return false;
                    }

                    // Toggles
                    if (categoryFilters.typeSSD === true && !product.typeSSD) {
                        return false;
                    }

                    if (categoryFilters.touchscreen === true && !product.touchscreen) {
                        return false;
                    }

                    if (categoryFilters.webcam === true && !product.webcam) {
                        return false;
                    }

                    if (categoryFilters.portUSBC === true && !product.portUSBC) {
                        return false;
                    }

                    if (categoryFilters.bluetooth === true && !product.bluetooth) {
                        return false;
                    }

                    if (categoryFilters.boiteOriginaleOrdinateur === true && !product.boiteOriginaleOrdinateur) {
                        return false;
                    }

                    if (categoryFilters.factureOrdinateur === true && !product.factureOrdinateur) {
                        return false;
                    }

                    // Année d'achat (range)
                    if (categoryFilters.anneeAchatOrdinateur_min !== undefined || categoryFilters.anneeAchatOrdinateur_max !== undefined) {
                        const annee = product.anneeAchatOrdinateur ? parseInt(product.anneeAchatOrdinateur) : 0;
                        if (categoryFilters.anneeAchatOrdinateur_min !== undefined && annee < categoryFilters.anneeAchatOrdinateur_min) {
                            return false;
                        }
                        if (categoryFilters.anneeAchatOrdinateur_max !== undefined && annee > categoryFilters.anneeAchatOrdinateur_max) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR HOTELLERIE
                if (product.type === 'hotellerie') {
                    // Select filters
                    if (categoryFilters.typeHebergement && product.typeHebergement !== categoryFilters.typeHebergement) {
                        return false;
                    }
                    if (categoryFilters.categorieHotel && product.categorieHotel !== categoryFilters.categorieHotel) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.equipementsHotel && Array.isArray(categoryFilters.equipementsHotel) && categoryFilters.equipementsHotel.length > 0) {
                        const hasAllEquipements = categoryFilters.equipementsHotel.every(eq =>
                            product.equipementsHotel && product.equipementsHotel.includes(eq)
                        );
                        if (!hasAllEquipements) {
                            return false;
                        }
                    }
                    if (categoryFilters.servicesHotel && Array.isArray(categoryFilters.servicesHotel) && categoryFilters.servicesHotel.length > 0) {
                        const hasAllServices = categoryFilters.servicesHotel.every(service =>
                            product.servicesHotel && product.servicesHotel.includes(service)
                        );
                        if (!hasAllServices) {
                            return false;
                        }
                    }

                    // Toggle filters
                    if (categoryFilters.petitDejeuner === true && !product.petitDejeuner) {
                        return false;
                    }
                    if (categoryFilters.wifi === true && !product.wifi) {
                        return false;
                    }
                    if (categoryFilters.parking === true && !product.parking) {
                        return false;
                    }
                    if (categoryFilters.piscine === true && !product.piscine) {
                        return false;
                    }
                    if (categoryFilters.spa === true && !product.spa) {
                        return false;
                    }

                    // Range filters
                    if (categoryFilters.nbChambresHotel_min !== undefined || categoryFilters.nbChambresHotel_max !== undefined) {
                        const nb = product.nbChambresHotel ? parseInt(product.nbChambresHotel) : 0;
                        if (categoryFilters.nbChambresHotel_min !== undefined && nb < categoryFilters.nbChambresHotel_min) {
                            return false;
                        }
                        if (categoryFilters.nbChambresHotel_max !== undefined && nb > categoryFilters.nbChambresHotel_max) {
                            return false;
                        }
                    }
                    if (categoryFilters.prixParNuit_min !== undefined || categoryFilters.prixParNuit_max !== undefined) {
                        const prix = product.prixParNuit ? parseFloat(product.prixParNuit) : 0;
                        if (categoryFilters.prixParNuit_min !== undefined && prix < categoryFilters.prixParNuit_min) {
                            return false;
                        }
                        if (categoryFilters.prixParNuit_max !== undefined && prix > categoryFilters.prixParNuit_max) {
                            return false;
                        }
                    }

                    // ✅ NOUVEAU: Filtre localisation (alignement LocationSelector)
                    if (categoryFilters.villeHotel) {
                        const villeProduct = product.villeHotel?.toLowerCase() || '';
                        const villeFilter = categoryFilters.villeHotel.toLowerCase();
                        if (!villeProduct.includes(villeFilter) && villeFilter !== villeProduct) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR SOUTIEN SCOLAIRE / RÉPÉTITEUR
                if (product.type === 'soutien_scolaire_repetiteur') {
                    // Select filters
                    if (categoryFilters.typeSoutien && product.typeSoutien !== categoryFilters.typeSoutien) {
                        return false;
                    }
                    if (categoryFilters.formatSoutien && product.formatSoutien !== categoryFilters.formatSoutien) {
                        return false;
                    }
                    if (categoryFilters.dureeSeance && product.dureeSeance !== categoryFilters.dureeSeance) {
                        return false;
                    }
                    if (categoryFilters.modaliteDeplacement && product.modaliteDeplacement !== categoryFilters.modaliteDeplacement) {
                        return false;
                    }
                    if (categoryFilters.modeTarification && product.modeTarification !== categoryFilters.modeTarification) {
                        return false;
                    }
                    if (categoryFilters.niveauExperience && product.niveauExperience !== categoryFilters.niveauExperience) {
                        return false;
                    }

                    // ✅ Filtre matières enseignées (multiselect)
                    if (categoryFilters.matieresEnseignees && Array.isArray(categoryFilters.matieresEnseignees) && categoryFilters.matieresEnseignees.length > 0) {
                        const hasMatieres = categoryFilters.matieresEnseignees.some((matiereRecherchee: string) =>
                            product.matieresEnseignees?.includes(matiereRecherchee)
                        );
                        if (!hasMatieres) return false;
                    }

                    // ✅ Filtre niveaux scolaires (multiselect)
                    if (categoryFilters.niveauxScolaires && Array.isArray(categoryFilters.niveauxScolaires) && categoryFilters.niveauxScolaires.length > 0) {
                        const hasNiveaux = categoryFilters.niveauxScolaires.some((niveauRecherche: string) =>
                            product.niveauxScolaires?.includes(niveauRecherche)
                        );
                        if (!hasNiveaux) return false;
                    }

                    // ✅ Filtre disponibilité (multiselect)
                    if (categoryFilters.disponibilite && Array.isArray(categoryFilters.disponibilite) && categoryFilters.disponibilite.length > 0) {
                        const hasDisponibilite = categoryFilters.disponibilite.some((dispoRecherche: string) =>
                            product.disponibilite?.includes(dispoRecherche) || product.disponibilites?.includes(dispoRecherche)
                        );
                        if (!hasDisponibilite) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR FORMATION
                if (product.type === 'formation_education') {
                    // Select filters
                    if (categoryFilters.domaineFormation && product.domaineFormation !== categoryFilters.domaineFormation) {
                        return false;
                    }
                    if (categoryFilters.typeFormation && product.typeFormation !== categoryFilters.typeFormation) {
                        return false;
                    }
                    if (categoryFilters.niveauFormation && product.niveauFormation !== categoryFilters.niveauFormation) {
                        return false;
                    }
                    if (categoryFilters.dureeFormation && product.dureeFormation !== categoryFilters.dureeFormation) {
                        return false;
                    }
                    if (categoryFilters.langueEnseignement && product.langueEnseignement !== categoryFilters.langueEnseignement) {
                        return false;
                    }

                    // ✅ NOUVEAU: Filtre matières enseignées (multiselect)
                    if (categoryFilters.matieresEnseignees && Array.isArray(categoryFilters.matieresEnseignees) && categoryFilters.matieresEnseignees.length > 0) {
                        const hasMatieres = categoryFilters.matieresEnseignees.some((matiereRecherchee: string) =>
                            product.matieresEnseignees?.includes(matiereRecherchee)
                        );
                        if (!hasMatieres) return false;
                    }

                    // ✅ NOUVEAU: Filtre niveaux scolaires (multiselect)
                    if (categoryFilters.niveauxScolaires && Array.isArray(categoryFilters.niveauxScolaires) && categoryFilters.niveauxScolaires.length > 0) {
                        const hasNiveaux = categoryFilters.niveauxScolaires.some((niveauRecherche: string) =>
                            product.niveauxScolaires?.includes(niveauRecherche)
                        );
                        if (!hasNiveaux) return false;
                    }

                    // ✅ NOUVEAU: Filtre niveau de compétence
                    if (categoryFilters.niveauCompetence && product.niveauCompetence !== categoryFilters.niveauCompetence) {
                        return false;
                    }

                    // ✅ NOUVEAU: Filtre format de formation (multiselect)
                    if (categoryFilters.formatFormation && Array.isArray(categoryFilters.formatFormation) && categoryFilters.formatFormation.length > 0) {
                        const hasFormat = categoryFilters.formatFormation.some((formatRecherche: string) =>
                            product.formatFormation?.includes(formatRecherche)
                        );
                        if (!hasFormat) return false;
                    }

                    // ✅ NOUVEAU: Filtre rythme de formation
                    if (categoryFilters.rythmeFormation && product.rythmeFormation !== categoryFilters.rythmeFormation) {
                        return false;
                    }

                    // ✅ NOUVEAU: Filtre horaires de formation (multiselect)
                    if (categoryFilters.horairesFormation && Array.isArray(categoryFilters.horairesFormation) && categoryFilters.horairesFormation.length > 0) {
                        const hasHoraires = categoryFilters.horairesFormation.some((horaireRecherche: string) =>
                            product.horairesFormation?.includes(horaireRecherche) || product.rythmes?.includes(horaireRecherche)
                        );
                        if (!hasHoraires) return false;
                    }

                    // ✅ NOUVEAU: Filtre langues d'enseignement (multiselect)
                    if (categoryFilters.languesEnseignement && Array.isArray(categoryFilters.languesEnseignement) && categoryFilters.languesEnseignement.length > 0) {
                        const hasLangues = categoryFilters.languesEnseignement.some((langueRecherchee: string) =>
                            product.languesEnseignement?.includes(langueRecherchee)
                        );
                        if (!hasLangues) return false;
                    }

                    // ✅ NOUVEAU: Filtre public cible (multiselect)
                    if (categoryFilters.publicCible && Array.isArray(categoryFilters.publicCible) && categoryFilters.publicCible.length > 0) {
                        const hasPublic = categoryFilters.publicCible.some((publicRecherche: string) =>
                            product.publicCible?.includes(publicRecherche)
                        );
                        if (!hasPublic) return false;
                    }

                    // ✅ NOUVEAU: Filtre certification obtenue
                    if (categoryFilters.certificationObtenue && product.certificationObtenue !== categoryFilters.certificationObtenue) {
                        return false;
                    }

                    // ✅ NOUVEAU: Filtre anciens sujets disponibles (multiselect)
                    if (categoryFilters.anciensSujetsDisponibles && Array.isArray(categoryFilters.anciensSujetsDisponibles) && categoryFilters.anciensSujetsDisponibles.length > 0) {
                        const hasAnciensSujets = categoryFilters.anciensSujetsDisponibles.some((sujetRecherche: string) =>
                            product.anciensSujetsDisponibles?.includes(sujetRecherche)
                        );
                        if (!hasAnciensSujets) return false;
                    }

                    // ✅ NOUVEAU: Filtre types de documents concours (multiselect)
                    if (categoryFilters.typesDocumentsConcours && Array.isArray(categoryFilters.typesDocumentsConcours) && categoryFilters.typesDocumentsConcours.length > 0) {
                        const hasDocuments = categoryFilters.typesDocumentsConcours.some((documentRecherche: string) =>
                            product.typesDocumentsConcours?.includes(documentRecherche)
                        );
                        if (!hasDocuments) return false;
                    }

                    // ✅ NOUVEAU: Filtre années de concours disponibles
                    if (categoryFilters.anneesConcoursDisponibles && product.anneesConcoursDisponibles !== categoryFilters.anneesConcoursDisponibles) {
                        return false;
                    }

                    // Multiselect filters (mode)
                    if (categoryFilters.modeFormation && Array.isArray(categoryFilters.modeFormation) && categoryFilters.modeFormation.length > 0) {
                        if (!categoryFilters.modeFormation.includes(product.modeFormation)) {
                            return false;
                        }
                    }

                    // Toggle filters
                    if (categoryFilters.certificationFormation === true && !product.certificationFormation) {
                        return false;
                    }

                    // Range filters (prix)
                    if (categoryFilters.prixFormation_min !== undefined || categoryFilters.prixFormation_max !== undefined) {
                        const prix = product.prixFormation ? parseInt(product.prixFormation) : product.prix ? parseFloat(product.prix.toString()) : 0;
                        if (categoryFilters.prixFormation_min !== undefined && prix < categoryFilters.prixFormation_min) {
                            return false;
                        }
                        if (categoryFilters.prixFormation_max !== undefined && prix > categoryFilters.prixFormation_max) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR EMPLOI
                if (product.type === 'emploi') {
                    // Select filters
                    if (categoryFilters.secteurActivite && product.secteurActivite !== categoryFilters.secteurActivite) {
                        return false;
                    }
                    if (categoryFilters.metierPoste && product.metierPoste !== categoryFilters.metierPoste) {
                        return false;
                    }
                    if (categoryFilters.typeContrat && product.typeContrat !== categoryFilters.typeContrat) {
                        return false;
                    }
                    if (categoryFilters.typeEmploi && product.typeEmploi !== categoryFilters.typeEmploi) {
                        return false;
                    }
                    if (categoryFilters.niveauExperience && product.niveauExperience !== categoryFilters.niveauExperience) {
                        return false;
                    }
                    if (categoryFilters.diplomeRequis && product.diplomeRequis !== categoryFilters.diplomeRequis) {
                        return false;
                    }
                    if (categoryFilters.lieuTravail && product.lieuTravail !== categoryFilters.lieuTravail) {
                        return false;
                    }
                    if (categoryFilters.secteurEntreprise && product.secteurEntreprise !== categoryFilters.secteurEntreprise) {
                        return false;
                    }
                    if (categoryFilters.datePublication && product.datePublication !== categoryFilters.datePublication) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.languesRequises && Array.isArray(categoryFilters.languesRequises) && categoryFilters.languesRequises.length > 0) {
                        const hasAllLangues = categoryFilters.languesRequises.every(langue =>
                            product.languesRequises && product.languesRequises.includes(langue)
                        );
                        if (!hasAllLangues) {
                            return false;
                        }
                    }
                    if (categoryFilters.avantagesSociaux && Array.isArray(categoryFilters.avantagesSociaux) && categoryFilters.avantagesSociaux.length > 0) {
                        const hasAllAvantages = categoryFilters.avantagesSociaux.every(avantage =>
                            product.avantagesSociaux && product.avantagesSociaux.includes(avantage)
                        );
                        if (!hasAllAvantages) {
                            return false;
                        }
                    }

                    // Toggle filters
                    if (categoryFilters.teletravail === true) {
                        const isTeletravail = product.typeEmploi?.includes('Télétravail') || product.typeEmploi?.includes('Hybride');
                        if (!isTeletravail) {
                            return false;
                        }
                    }

                    // Range filters (salaire)
                    if (categoryFilters.salaireMin_min !== undefined) {
                        const salaire = product.salaireMin ? parseInt(product.salaireMin) : 0;
                        if (salaire < categoryFilters.salaireMin_min) {
                            return false;
                        }
                    }
                    if (categoryFilters.salaireMax_max !== undefined) {
                        const salaire = product.salaireMax ? parseInt(product.salaireMax) : 0;
                        if (salaire > categoryFilters.salaireMax_max) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR TICKET VOYAGE
                if (product.type === 'ticket_voyage') {
                    // Select filters
                    if (categoryFilters.compagnieTransport && product.compagnieTransport !== categoryFilters.compagnieTransport) {
                        return false;
                    }
                    if (categoryFilters.typeVehiculeTransport && product.typeVehiculeTransport !== categoryFilters.typeVehiculeTransport) {
                        return false;
                    }
                    if (categoryFilters.classeVoyage && product.classeVoyage !== categoryFilters.classeVoyage) {
                        return false;
                    }
                    if (categoryFilters.bagage && product.bagage !== categoryFilters.bagage) {
                        return false;
                    }
                    if (categoryFilters.depart && product.depart !== categoryFilters.depart) {
                        return false;
                    }
                    if (categoryFilters.destination && product.destination !== categoryFilters.destination) {
                        return false;
                    }

                    // Toggle filters
                    if (categoryFilters.repas === true && !product.repas) {
                        return false;
                    }
                    if (categoryFilters.wifi === true && !product.wifi) {
                        return false;
                    }
                    if (categoryFilters.remboursable === true && !product.remboursable) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR IMMOBILIER TERRAIN
                if (product.type === 'immobilier_terrain') {
                    // Filtre statut immobilier
                    if (categoryFilters.statutImmobilier) {
                        if (product.statutImmobilier !== categoryFilters.statutImmobilier) return false;
                    }

                    // Filtre type de terrain
                    if (categoryFilters.typeTerrain) {
                        if (product.typeTerrain !== categoryFilters.typeTerrain) return false;
                    }

                    // Filtre viabilisation
                    if (categoryFilters.viabilisation) {
                        if (product.viabilisation !== categoryFilters.viabilisation) return false;
                    }

                    // Filtre topographie
                    if (categoryFilters.topographie) {
                        if (product.topographie !== categoryFilters.topographie) return false;
                    }

                    // Filtre accès terrain
                    if (categoryFilters.accesTerrain) {
                        if (product.accesTerrain !== categoryFilters.accesTerrain) return false;
                    }

                    // Filtre superficie (range)
                    if (categoryFilters.superficie_min !== undefined || categoryFilters.superficie_max !== undefined) {
                        const superficie = parseFloat(product.superficie || '0');
                        if (categoryFilters.superficie_min !== undefined && superficie < categoryFilters.superficie_min) return false;
                        if (categoryFilters.superficie_max !== undefined && superficie > categoryFilters.superficie_max) return false;
                    }

                    // Filtre zonage
                    if (categoryFilters.zonage) {
                        if (product.zonage !== categoryFilters.zonage) return false;
                    }

                    // Filtre forme terrain
                    if (categoryFilters.formeTerrain) {
                        if (product.formeTerrain !== categoryFilters.formeTerrain) return false;
                    }

                    // Filtre végétation
                    if (categoryFilters.vegetation) {
                        if (product.vegetation !== categoryFilters.vegetation) return false;
                    }

                    // Filtre usage actuel
                    if (categoryFilters.usageActuel) {
                        if (product.usageActuel !== categoryFilters.usageActuel) return false;
                    }

                    // Filtre réseaux (multiselect)
                    if (categoryFilters.reseauxTerrain && Array.isArray(categoryFilters.reseauxTerrain) && categoryFilters.reseauxTerrain.length > 0) {
                        const hasAllReseaux = categoryFilters.reseauxTerrain.every((reseau: string) =>
                            product.reseauxTerrain?.includes(reseau)
                        );
                        if (!hasAllReseaux) return false;
                    }

                    // Filtre nature du sol
                    if (categoryFilters.natureSol) {
                        if (product.natureSol !== categoryFilters.natureSol) return false;
                    }

                    // Filtres toggles
                    if (categoryFilters.titreFoncier === true && !product.titreFoncier) return false;
                    if (categoryFilters.bornage === true && !product.bornage) return false;
                    if (categoryFilters.constructibilite === true && !product.constructibilite) return false;
                    if (categoryFilters.cloture === true && !product.cloture) return false;

                    // ✅ NOUVEAU: Filtre Ville
                    if (categoryFilters.ville) {
                        const villeProduct = product.ville?.toLowerCase() || product.localisation?.toLowerCase() || '';
                        const villeFilter = categoryFilters.ville.toLowerCase();
                        if (!villeProduct.includes(villeFilter) && villeFilter !== villeProduct) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PRESTATION DE SERVICE
                if (product.type === 'prestation_service') {
                    // Select filters
                    if (categoryFilters.categoriePrestation && product.categoriePrestation !== categoryFilters.categoriePrestation) {
                        return false;
                    }
                    if (categoryFilters.typePrestation && product.typePrestation !== categoryFilters.typePrestation) {
                        return false;
                    }
                    if (categoryFilters.zoneIntervention && product.zoneIntervention !== categoryFilters.zoneIntervention) {
                        return false;
                    }
                    if (categoryFilters.niveauExperience && product.niveauExperience !== categoryFilters.niveauExperience) {
                        return false;
                    }
                    if (categoryFilters.disponibilitePrestation && product.disponibilitePrestation !== categoryFilters.disponibilitePrestation) {
                        return false;
                    }

                    // Toggle filters
                    if (categoryFilters.certification === true && !product.certification) {
                        return false;
                    }
                    if (categoryFilters.urgencesAcceptees === true && !product.urgencesAcceptees) {
                        return false;
                    }
                    if (categoryFilters.service24h === true && !product.service24h) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR RESTAURATION ULTRA-ENRICHIS
                if (product.type === 'restauration') {
                    // Select filters
                    if (categoryFilters.typeRestaurant && product.typeRestaurant !== categoryFilters.typeRestaurant) {
                        return false;
                    }
                    if (categoryFilters.gammePrix && product.gammePrix !== categoryFilters.gammePrix) {
                        return false;
                    }
                    if (categoryFilters.capaciteRestaurant && product.capaciteRestaurant !== categoryFilters.capaciteRestaurant) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.typeCuisine && Array.isArray(categoryFilters.typeCuisine) && categoryFilters.typeCuisine.length > 0) {
                        if (!categoryFilters.typeCuisine.includes(product.typeCuisine)) {
                            return false;
                        }
                    }
                    if (categoryFilters.servicesRestau && Array.isArray(categoryFilters.servicesRestau) && categoryFilters.servicesRestau.length > 0) {
                        const hasAllServices = categoryFilters.servicesRestau.every(service =>
                            product.servicesRestau && product.servicesRestau.includes(service)
                        );
                        if (!hasAllServices) {
                            return false;
                        }
                    }
                    if (categoryFilters.regimesSpeciaux && Array.isArray(categoryFilters.regimesSpeciaux) && categoryFilters.regimesSpeciaux.length > 0) {
                        const hasAllRegimes = categoryFilters.regimesSpeciaux.every(regime =>
                            product.regimesSpeciaux && product.regimesSpeciaux.includes(regime)
                        );
                        if (!hasAllRegimes) {
                            return false;
                        }
                    }
                    if (categoryFilters.horairesRestaurant && Array.isArray(categoryFilters.horairesRestaurant) && categoryFilters.horairesRestaurant.length > 0) {
                        const hasAllHoraires = categoryFilters.horairesRestaurant.every(horaire =>
                            product.horairesRestaurant && product.horairesRestaurant.includes(horaire)
                        );
                        if (!hasAllHoraires) {
                            return false;
                        }
                    }
                    if (categoryFilters.ambianceRestau && Array.isArray(categoryFilters.ambianceRestau) && categoryFilters.ambianceRestau.length > 0) {
                        const hasAllAmbiance = categoryFilters.ambianceRestau.every(ambiance =>
                            product.ambianceRestau && product.ambianceRestau.includes(ambiance)
                        );
                        if (!hasAllAmbiance) {
                            return false;
                        }
                    }
                    if (categoryFilters.certificationsRestau && Array.isArray(categoryFilters.certificationsRestau) && categoryFilters.certificationsRestau.length > 0) {
                        const hasAllCertifications = categoryFilters.certificationsRestau.every(cert =>
                            product.certificationsRestau && product.certificationsRestau.includes(cert)
                        );
                        if (!hasAllCertifications) {
                            return false;
                        }
                    }
                    if (categoryFilters.promotionsRestau && Array.isArray(categoryFilters.promotionsRestau) && categoryFilters.promotionsRestau.length > 0) {
                        const hasAllPromotions = categoryFilters.promotionsRestau.every(promo =>
                            product.promotionsRestau && product.promotionsRestau.includes(promo)
                        );
                        if (!hasAllPromotions) {
                            return false;
                        }
                    }

                    // ✅ NOUVEAU: Filtres pour plats populaires (recherche dans tous les champs de plats)
                    if (categoryFilters.platsPopulaires && Array.isArray(categoryFilters.platsPopulaires) && categoryFilters.platsPopulaires.length > 0) {
                        const allPlats = [
                            ...(product.platsCamerounais || []),
                            ...(product.platsIvoiriens || []),
                            ...(product.platsSenegalais || []),
                            ...(product.platsMaliens || []),
                            ...(product.platsGabonais || []),
                            ...(product.platsCongolais || []),
                            ...(product.platsBurkinabe || []),
                            ...(product.platsAutresPays || []),
                            ...(product.platsInternationaux || [])
                        ];
                        const hasAllPlats = categoryFilters.platsPopulaires.every(plat =>
                            allPlats.includes(plat)
                        );
                        if (!hasAllPlats) {
                            return false;
                        }
                    }

                    // Toggle filters (obsolètes mais conservés pour compatibilité)
                    if (categoryFilters.livraison === true && !product.livraison) {
                        return false;
                    }
                    if (categoryFilters.terrasse === true && !product.terrasse) {
                        return false;
                    }
                    if (categoryFilters.parking === true && !product.parking) {
                        return false;
                    }
                    if (categoryFilters.wifi === true && !product.wifi) {
                        return false;
                    }

                    // ✅ NOUVEAU: Toggle "Ouvert maintenant" (basé sur horairesRestaurant)
                    if (categoryFilters.ouvertMaintenant === true) {
                        const now = new Date();
                        const currentHour = now.getHours();
                        const isOpenNow = product.horairesRestaurant && product.horairesRestaurant.some(horaire => {
                            if (horaire.includes('24h/24')) return true;
                            if (horaire.includes('Service continu')) return true;
                            if (horaire.includes('Nocturne') && (currentHour >= 18 || currentHour <= 6)) return true;
                            if (horaire.includes('Déjeuner') && currentHour >= 11 && currentHour <= 15) return true;
                            if (horaire.includes('Dîner') && currentHour >= 18 && currentHour <= 23) return true;
                            if (horaire.includes('Petit-déjeuner') && currentHour >= 6 && currentHour <= 10) return true;
                            return false;
                        });
                        if (!isOpenNow) {
                            return false;
                        }
                    }

                    // Range filters (capacité) - obsolète mais conservé
                    if (categoryFilters.capaciteRestaurant_min !== undefined || categoryFilters.capaciteRestaurant_max !== undefined) {
                        const capacite = product.capaciteRestaurant ? parseInt(product.capaciteRestaurant) : 0;
                        if (categoryFilters.capaciteRestaurant_min !== undefined && capacite < categoryFilters.capaciteRestaurant_min) {
                            return false;
                        }
                        if (categoryFilters.capaciteRestaurant_max !== undefined && capacite > categoryFilters.capaciteRestaurant_max) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR MUSIQUE & INSTRUMENTS
                if (product.type === 'musique_instruments') {
                    // Select filters
                    if (categoryFilters.typeInstrument && product.typeInstrument !== categoryFilters.typeInstrument) {
                        return false;
                    }
                    if (categoryFilters.categorieInstrument && product.categorieInstrument !== categoryFilters.categorieInstrument) {
                        return false;
                    }
                    if (categoryFilters.marqueInstrument && product.marqueInstrument !== categoryFilters.marqueInstrument) {
                        return false;
                    }
                    if (categoryFilters.etatInstrument && product.etatInstrument !== categoryFilters.etatInstrument) {
                        return false;
                    }
                    if (categoryFilters.niveauInstrument && product.niveauInstrument !== categoryFilters.niveauInstrument) {
                        return false;
                    }
                    if (categoryFilters.utilisationInstrument && product.utilisationInstrument !== categoryFilters.utilisationInstrument) {
                        return false;
                    }
                    if (categoryFilters.genreMusical && product.genreMusical !== categoryFilters.genreMusical) {
                        return false;
                    }
                    if (categoryFilters.nombreCordes && product.nombreCordes !== categoryFilters.nombreCordes) {
                        return false;
                    }
                    if (categoryFilters.tailleInstrument && product.tailleInstrument !== categoryFilters.tailleInstrument) {
                        return false;
                    }
                    if (categoryFilters.garantieInstrument && product.garantieInstrument !== categoryFilters.garantieInstrument) {
                        return false;
                    }
                    if (categoryFilters.origineInstrument && product.origineInstrument !== categoryFilters.origineInstrument) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.materiauInstrument && Array.isArray(categoryFilters.materiauInstrument) && categoryFilters.materiauInstrument.length > 0) {
                        const materiauProduct = product.materiauInstrument;
                        if (!materiauProduct || !categoryFilters.materiauInstrument.some(mat => materiauProduct === mat || materiauProduct.includes(mat))) {
                            return false;
                        }
                    }

                    // Toggle filters
                    if (categoryFilters.facture === true && !product.facture) {
                        return false;
                    }
                    if (categoryFilters.revisionRecente === true && !product.revisionRecente) {
                        return false;
                    }

                    // Range filters (année)
                    if (categoryFilters.anneeInstrument_min !== undefined || categoryFilters.anneeInstrument_max !== undefined) {
                        const annee = product.anneeInstrument ? parseInt(product.anneeInstrument) : 0;
                        if (categoryFilters.anneeInstrument_min !== undefined && annee < categoryFilters.anneeInstrument_min) {
                            return false;
                        }
                        if (categoryFilters.anneeInstrument_max !== undefined && annee > categoryFilters.anneeInstrument_max) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR TEXTILE (VETEMENT)
                if (product.type === 'vetement') {
                    // Select filters
                    if (categoryFilters.typeVetement && product.typeVetement !== categoryFilters.typeVetement) {
                        return false;
                    }
                    if (categoryFilters.genreVetement && product.genreVetement !== categoryFilters.genreVetement) {
                        return false;
                    }
                    if (categoryFilters.marqueVetement && product.marqueVetement !== categoryFilters.marqueVetement) {
                        return false;
                    }
                    if (categoryFilters.etatVetement && product.etatVetement !== categoryFilters.etatVetement) {
                        return false;
                    }
                    if (categoryFilters.coupeVetement && product.coupeVetement !== categoryFilters.coupeVetement) {
                        return false;
                    }
                    if (categoryFilters.motifVetement && product.motifVetement !== categoryFilters.motifVetement) {
                        return false;
                    }
                    if (categoryFilters.occasionVetement && product.occasionVetement !== categoryFilters.occasionVetement) {
                        return false;
                    }
                    if (categoryFilters.origineVetement && product.origineVetement !== categoryFilters.origineVetement) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.taille && Array.isArray(categoryFilters.taille) && categoryFilters.taille.length > 0) {
                        if (!categoryFilters.taille.includes(product.taille)) {
                            return false;
                        }
                    }
                    if (categoryFilters.couleurVetement && Array.isArray(categoryFilters.couleurVetement) && categoryFilters.couleurVetement.length > 0) {
                        if (!categoryFilters.couleurVetement.includes(product.couleurVetement)) {
                            return false;
                        }
                    }
                    if (categoryFilters.matiereVetement && Array.isArray(categoryFilters.matiereVetement) && categoryFilters.matiereVetement.length > 0) {
                        if (!categoryFilters.matiereVetement.includes(product.matiereVetement)) {
                            return false;
                        }
                    }
                    if (categoryFilters.styleVetement && Array.isArray(categoryFilters.styleVetement) && categoryFilters.styleVetement.length > 0) {
                        if (!categoryFilters.styleVetement.includes(product.styleVetement)) {
                            return false;
                        }
                    }
                    if (categoryFilters.saisonVetement && Array.isArray(categoryFilters.saisonVetement) && categoryFilters.saisonVetement.length > 0) {
                        if (!categoryFilters.saisonVetement.includes(product.saisonVetement)) {
                            return false;
                        }
                    }
                    if (categoryFilters.patronVetement && Array.isArray(categoryFilters.patronVetement) && categoryFilters.patronVetement.length > 0) {
                        if (!categoryFilters.patronVetement.includes(product.patronVetement)) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR CHAUSSURE
                if (product.type === 'chaussure') {
                    // Select filters
                    if (categoryFilters.typeChaussure && product.typeChaussure !== categoryFilters.typeChaussure) {
                        return false;
                    }
                    if (categoryFilters.genreChaussure && product.genreChaussure !== categoryFilters.genreChaussure) {
                        return false;
                    }
                    if (categoryFilters.marqueChaussure && product.marqueChaussure !== categoryFilters.marqueChaussure) {
                        return false;
                    }
                    if (categoryFilters.etatChaussure && product.etatChaussure !== categoryFilters.etatChaussure) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.pointure && Array.isArray(categoryFilters.pointure) && categoryFilters.pointure.length > 0) {
                        if (!categoryFilters.pointure.includes(product.pointure)) {
                            return false;
                        }
                    }
                    if (categoryFilters.couleurChaussure && Array.isArray(categoryFilters.couleurChaussure) && categoryFilters.couleurChaussure.length > 0) {
                        if (!categoryFilters.couleurChaussure.includes(product.couleurChaussure)) {
                            return false;
                        }
                    }
                    if (categoryFilters.materiauChaussure && Array.isArray(categoryFilters.materiauChaussure) && categoryFilters.materiauChaussure.length > 0) {
                        if (!categoryFilters.materiauChaussure.includes(product.materiauChaussure)) {
                            return false;
                        }
                    }
                    if (categoryFilters.usageChaussure && Array.isArray(categoryFilters.usageChaussure) && categoryFilters.usageChaussure.length > 0) {
                        if (!categoryFilters.usageChaussure.includes(product.usageChaussure)) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR LIVRES & FOURNITURES
                if (product.type === 'livres_fournitures') {
                    // Select filters
                    if (categoryFilters.categorieLivre && product.categorieLivre !== categoryFilters.categorieLivre) {
                        return false;
                    }
                    if (categoryFilters.niveau && product.niveau !== categoryFilters.niveau) {
                        return false;
                    }
                    if (categoryFilters.matiereScolaire && product.matiereScolaire !== categoryFilters.matiereScolaire) {
                        return false;
                    }
                    if (categoryFilters.editeur && product.editeur !== categoryFilters.editeur) {
                        return false;
                    }
                    if (categoryFilters.etatLivre && product.etatLivre !== categoryFilters.etatLivre) {
                        return false;
                    }
                    if (categoryFilters.langue && product.langue !== categoryFilters.langue) {
                        return false;
                    }
                    if (categoryFilters.typeCalculatrice && product.typeCalculatrice !== categoryFilters.typeCalculatrice) {
                        return false;
                    }
                    if (categoryFilters.programmesMenesres && product.programmesMenesres !== categoryFilters.programmesMenesres) {
                        return false;
                    }
                    if (categoryFilters.formatsCahiers && product.formatsCahiers !== categoryFilters.formatsCahiers) {
                        return false;
                    }
                    if (categoryFilters.couleursFournitures && product.couleursFournitures !== categoryFilters.couleursFournitures) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR COVOITURAGE
                if (product.type === 'covoiturage') {
                    // Select filters
                    if (categoryFilters.pointDepart && product.pointDepart !== categoryFilters.pointDepart) {
                        return false;
                    }
                    if (categoryFilters.pointArrivee && product.pointArrivee !== categoryFilters.pointArrivee) {
                        return false;
                    }
                    if (categoryFilters.vehiculeInfo && product.vehiculeInfo !== categoryFilters.vehiculeInfo) {
                        return false;
                    }
                    if (categoryFilters.dateTrajet && product.dateTrajet !== categoryFilters.dateTrajet) {
                        return false;
                    }
                    if (categoryFilters.heureTrajet && product.heureTrajet !== categoryFilters.heureTrajet) {
                        return false;
                    }

                    // Range filter
                    if (categoryFilters.nbPlacesDisponibles_min || categoryFilters.nbPlacesDisponibles_max) {
                        const nbPlaces = parseInt(product.nbPlacesDisponibles || '0');
                        if (categoryFilters.nbPlacesDisponibles_min && nbPlaces < parseInt(categoryFilters.nbPlacesDisponibles_min)) {
                            return false;
                        }
                        if (categoryFilters.nbPlacesDisponibles_max && nbPlaces > parseInt(categoryFilters.nbPlacesDisponibles_max)) {
                            return false;
                        }
                    }

                    // Multiselect filter
                    if (categoryFilters.preferencesTrajet && Array.isArray(categoryFilters.preferencesTrajet) && categoryFilters.preferencesTrajet.length > 0) {
                        const productPrefs = product.preferencesTrajet?.split(',').map(p => p.trim()) || [];
                        if (!categoryFilters.preferencesTrajet.some(pref => productPrefs.includes(pref))) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR EVENEMENTIEL
                if (product.type === 'evenementiel') {
                    // Select filters
                    if (categoryFilters.typeEvenement && product.typeEvenement !== categoryFilters.typeEvenement) {
                        return false;
                    }
                    if (categoryFilters.capaciteEvenement && product.capaciteEvenement !== categoryFilters.capaciteEvenement) {
                        return false;
                    }
                    if (categoryFilters.dureeEvenement && product.dureeEvenement !== categoryFilters.dureeEvenement) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.servicesEvenement && Array.isArray(categoryFilters.servicesEvenement) && categoryFilters.servicesEvenement.length > 0) {
                        if (!Array.isArray(product.servicesEvenement)) {
                            return false;
                        }
                        if (!categoryFilters.servicesEvenement.some(service => product.servicesEvenement.includes(service))) {
                            return false;
                        }
                    }
                    if (categoryFilters.equipementsEvenement && Array.isArray(categoryFilters.equipementsEvenement) && categoryFilters.equipementsEvenement.length > 0) {
                        if (!Array.isArray(product.equipementsEvenement)) {
                            return false;
                        }
                        if (!categoryFilters.equipementsEvenement.some(equip => product.equipementsEvenement.includes(equip))) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR VOYAGE_TOURISME
                if (product.type === 'voyage_tourisme') {
                    if (categoryFilters.typeVoyage && product.typeVoyage !== categoryFilters.typeVoyage) {
                        return false;
                    }
                    if (categoryFilters.destinationVoyage && product.destinationVoyage !== categoryFilters.destinationVoyage) {
                        return false;
                    }
                    if (categoryFilters.dureeVoyage && product.dureeVoyage !== categoryFilters.dureeVoyage) {
                        return false;
                    }
                    if (categoryFilters.hebergementVoyage && product.hebergementVoyage !== categoryFilters.hebergementVoyage) {
                        return false;
                    }
                    if (categoryFilters.servicesVoyage && Array.isArray(categoryFilters.servicesVoyage) && categoryFilters.servicesVoyage.length > 0) {
                        if (!Array.isArray(product.servicesVoyage)) {
                            return false;
                        }
                        if (!categoryFilters.servicesVoyage.some(service => product.servicesVoyage.includes(service))) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR DEMENAGEMENT - ENRICHIS
                if (product.type === 'demenagement') {
                    if (categoryFilters.typeDemenagement && product.typeDemenagement !== categoryFilters.typeDemenagement) {
                        return false;
                    }
                    if (categoryFilters.volumeDemenagement && product.volumeDemenagement !== categoryFilters.volumeDemenagement) {
                        return false;
                    }
                    if (categoryFilters.typeVehiculeDemenagement && product.typeVehiculeDemenagement !== categoryFilters.typeVehiculeDemenagement) {
                        return false;
                    }
                    if (categoryFilters.distanceDemenagement && product.distanceDemenagement !== categoryFilters.distanceDemenagement) {
                        return false;
                    }
                    if (categoryFilters.villeDepartDemenagement && product.villeDepartDemenagement !== categoryFilters.villeDepartDemenagement) {
                        return false;
                    }
                    if (categoryFilters.villeArriveeDemenagement && product.villeArriveeDemenagement !== categoryFilters.villeArriveeDemenagement) {
                        return false;
                    }
                    if (categoryFilters.trajetDemenagement && product.trajetDemenagement !== categoryFilters.trajetDemenagement) {
                        return false;
                    }
                    if (categoryFilters.compagnieDemenagement && product.compagnieDemenagement !== categoryFilters.compagnieDemenagement) {
                        return false;
                    }
                    if (categoryFilters.dureeDemenagement && product.dureeDemenagement !== categoryFilters.dureeDemenagement) {
                        return false;
                    }
                    if (categoryFilters.disponibiliteDemenagement && product.disponibiliteDemenagement !== categoryFilters.disponibiliteDemenagement) {
                        return false;
                    }
                    if (categoryFilters.typeAssuranceDemenagement && product.typeAssuranceDemenagement !== categoryFilters.typeAssuranceDemenagement) {
                        return false;
                    }
                    if (categoryFilters.nbDemenageurs && product.nbDemenageurs !== categoryFilters.nbDemenageurs) {
                        return false;
                    }
                    if (categoryFilters.servicesDemenagement && Array.isArray(categoryFilters.servicesDemenagement) && categoryFilters.servicesDemenagement.length > 0) {
                        if (!Array.isArray(product.servicesDemenagement)) {
                            return false;
                        }
                        if (!categoryFilters.servicesDemenagement.some(service => product.servicesDemenagement.includes(service))) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR CRÈCHE & GARDERIE
                if (product.type === 'creche_garderie' || product.type === 'creche' || product.type === 'garderie') {
                    // Type d'établissement (multiselect)
                    if (categoryFilters.typeEtablissement && Array.isArray(categoryFilters.typeEtablissement) && categoryFilters.typeEtablissement.length > 0) {
                        const hasType = categoryFilters.typeEtablissement.some((typeRecherche: string) =>
                            product.typeEtablissement?.includes(typeRecherche)
                        );
                        if (!hasType) return false;
                    }

                    // Tranches d'âge (multiselect)
                    if (categoryFilters.tranchesAge && Array.isArray(categoryFilters.tranchesAge) && categoryFilters.tranchesAge.length > 0) {
                        const hasTranche = categoryFilters.tranchesAge.some((trancheRecherchee: string) =>
                            product.tranchesAge?.includes(trancheRecherchee)
                        );
                        if (!hasTranche) return false;
                    }

                    // Horaires de garde (multiselect)
                    if (categoryFilters.horairesGarde && Array.isArray(categoryFilters.horairesGarde) && categoryFilters.horairesGarde.length > 0) {
                        const hasHoraire = categoryFilters.horairesGarde.some((horaireRecherche: string) =>
                            product.horairesGarde?.includes(horaireRecherche)
                        );
                        if (!hasHoraire) return false;
                    }

                    // Jours de fonctionnement
                    if (categoryFilters.joursFonctionnement && product.joursFonctionnement !== categoryFilters.joursFonctionnement) {
                        return false;
                    }

                    // Capacité d'accueil
                    if (categoryFilters.capaciteAccueil && product.capaciteAccueil !== categoryFilters.capaciteAccueil) {
                        return false;
                    }

                    // Services proposés (multiselect)
                    if (categoryFilters.servicesProproses && Array.isArray(categoryFilters.servicesProproses) && categoryFilters.servicesProproses.length > 0) {
                        const hasServices = categoryFilters.servicesProproses.some((serviceRecherche: string) =>
                            product.servicesProproses?.includes(serviceRecherche)
                        );
                        if (!hasServices) return false;
                    }

                    // Langues parlées (multiselect)
                    if (categoryFilters.languesParlees && Array.isArray(categoryFilters.languesParlees) && categoryFilters.languesParlees.length > 0) {
                        const hasLangue = categoryFilters.languesParlees.some((langueRecherchee: string) =>
                            product.languesParlees?.includes(langueRecherchee)
                        );
                        if (!hasLangue) return false;
                    }

                    // Certifications & Agréments (multiselect)
                    if (categoryFilters.certificationsAgrements && Array.isArray(categoryFilters.certificationsAgrements) && categoryFilters.certificationsAgrements.length > 0) {
                        const hasCert = categoryFilters.certificationsAgrements.some((certRecherche: string) =>
                            product.certificationsAgrements?.includes(certRecherche)
                        );
                        if (!hasCert) return false;
                    }

                    // Gamme de prix
                    if (categoryFilters.gammePrix && product.gammePrix !== categoryFilters.gammePrix) {
                        return false;
                    }

                    // Prix mensuel (range)
                    if (categoryFilters.prixMensuel_min !== undefined || categoryFilters.prixMensuel_max !== undefined) {
                        const prix = product.prix ? parseFloat(product.prix) : 0;
                        if (categoryFilters.prixMensuel_min !== undefined && prix < categoryFilters.prixMensuel_min) return false;
                        if (categoryFilters.prixMensuel_max !== undefined && prix > categoryFilters.prixMensuel_max) return false;
                    }

                    // Places disponibles immédiatement (toggle)
                    if (categoryFilters.placesDisponibles === true && !product.placesDisponibles) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PLOMBERIE (SERVICE)
                if (product.type === 'plomberie' || product.type === 'plombier') {
                    // Filtre type de prestation
                    if (categoryFilters.typePrestation && product.typePrestation !== categoryFilters.typePrestation) {
                        return false;
                    }

                    // Filtre urgence
                    if (categoryFilters.urgence === true && !product.urgence && !product.urgence24h) {
                        return false;
                    }

                    // Filtre spécialités (multiselect)
                    if (categoryFilters.specialitesPlomberie && Array.isArray(categoryFilters.specialitesPlomberie) && categoryFilters.specialitesPlomberie.length > 0) {
                        if (!Array.isArray(product.specialitesPlomberie)) {
                            return false;
                        }
                        if (!categoryFilters.specialitesPlomberie.some(spec => product.specialitesPlomberie.includes(spec))) {
                            return false;
                        }
                    }

                    // ✅ Filtre équipements (multiselect)
                    if (categoryFilters.equipementsPlomberie && Array.isArray(categoryFilters.equipementsPlomberie) && categoryFilters.equipementsPlomberie.length > 0) {
                        if (!Array.isArray(product.equipementsPlomberie)) {
                            return false;
                        }
                        if (!categoryFilters.equipementsPlomberie.some(equip => product.equipementsPlomberie.includes(equip))) {
                            return false;
                        }
                    }

                    // ✅ Filtre disponibilité
                    if (categoryFilters.disponibilitePlomberie) {
                        const disponibilite = product.disponibilitePrestation || product.disponibilite;
                        if (disponibilite !== categoryFilters.disponibilitePlomberie) {
                            return false;
                        }
                    }

                    // ✅ Filtre garantie travaux
                    if (categoryFilters.garantieTravaux) {
                        const garantie = product.garantieTravaux || product.garantie;
                        if (garantie !== categoryFilters.garantieTravaux) {
                            return false;
                        }
                    }

                    // ✅ NOUVEAU: Filtre certifications (multiselect)
                    if (categoryFilters.certificationsPlombier && Array.isArray(categoryFilters.certificationsPlombier) && categoryFilters.certificationsPlombier.length > 0) {
                        const certif = product.certificationsPlombier || product.certifications || product.certification;
                        if (!Array.isArray(certif)) {
                            return false;
                        }
                        if (!categoryFilters.certificationsPlombier.some(cert => certif.includes(cert))) {
                            return false;
                        }
                    }

                    // ✅ NOUVEAU: Filtre expérience
                    if (categoryFilters.experiencePlombier) {
                        const experience = product.experiencePlombier || product.experience || product.anciennete;
                        if (experience !== categoryFilters.experiencePlombier) {
                            return false;
                        }
                    }

                    // ✅ Filtre devis gratuit (toggle)
                    if (categoryFilters.devisGratuit === true && !product.devisGratuit) {
                        return false;
                    }

                    // ✅ NOUVEAU: Filtre plombier certifié (toggle)
                    if (categoryFilters.certifie === true && !product.certifie && !product.certifications) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR CARRELEUR (SERVICE)
                if (product.type === 'carreleur' || product.type === 'prestation_carrelage') {
                    // Select filters
                    if (categoryFilters.typePrestation && product.types && !product.types.includes(categoryFilters.typePrestation)) {
                        return false;
                    }

                    if (categoryFilters.tarification && product.tarification && product.tarification !== categoryFilters.tarification) {
                        return false;
                    }

                    if (categoryFilters.experience && product.experience && product.experience !== categoryFilters.experience) {
                        return false;
                    }

                    if (categoryFilters.garantie && product.garanties && !product.garanties.includes(categoryFilters.garantie)) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.typesCarrelage && Array.isArray(categoryFilters.typesCarrelage) && categoryFilters.typesCarrelage.length > 0) {
                        if (!product.types_carrelage || !categoryFilters.typesCarrelage.some((type: string) => product.types_carrelage?.includes(type))) {
                            return false;
                        }
                    }

                    if (categoryFilters.surfaces && Array.isArray(categoryFilters.surfaces) && categoryFilters.surfaces.length > 0) {
                        if (!product.surfaces || !categoryFilters.surfaces.some((surface: string) => product.surfaces?.includes(surface))) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ÉLECTRICIEN (SERVICE)
                if (product.type === 'electricien') {
                    // Filtre type de prestation
                    if (categoryFilters.typePrestation && product.typeElectricien !== categoryFilters.typePrestation) {
                        return false;
                    }

                    // Filtre spécialités (multiselect)
                    if (categoryFilters.specialitesElectricien && Array.isArray(categoryFilters.specialitesElectricien) && categoryFilters.specialitesElectricien.length > 0) {
                        if (!Array.isArray(product.specialitesElectricien)) {
                            return false;
                        }
                        if (!categoryFilters.specialitesElectricien.some(spec => product.specialitesElectricien.includes(spec))) {
                            return false;
                        }
                    }

                    // Filtre équipements concernés (multiselect)
                    if (categoryFilters.equipementsElectricien && Array.isArray(categoryFilters.equipementsElectricien) && categoryFilters.equipementsElectricien.length > 0) {
                        if (!Array.isArray(product.equipementsElectricien)) {
                            return false;
                        }
                        if (!categoryFilters.equipementsElectricien.some(equip => product.equipementsElectricien.includes(equip))) {
                            return false;
                        }
                    }

                    // Filtre disponibilité
                    if (categoryFilters.disponibiliteElectricien && product.disponibiliteElectricien !== categoryFilters.disponibiliteElectricien) {
                        return false;
                    }

                    // Filtre garantie travaux
                    if (categoryFilters.garantieTravaux && product.garantieElectricien !== categoryFilters.garantieTravaux) {
                        return false;
                    }

                    // Filtre certifications (multiselect)
                    if (categoryFilters.certifications && Array.isArray(categoryFilters.certifications) && categoryFilters.certifications.length > 0) {
                        if (!Array.isArray(product.certificationsElectricien)) {
                            return false;
                        }
                        if (!categoryFilters.certifications.some(cert => product.certificationsElectricien.includes(cert))) {
                            return false;
                        }
                    }

                    // Filtres toggles
                    if (categoryFilters.urgence === true && !product.urgence24hElec) {
                        return false;
                    }

                    if (categoryFilters.devisGratuit === true && !product.devisGratuitElec) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR RÉPARATEUR CLIMATISEUR (SERVICE)
                if (product.type === 'reparateur_climatiseur') {
                    // Filtre type de service climatisation
                    if (categoryFilters.serviceClimatisation && product.serviceClimatisation !== categoryFilters.serviceClimatisation) {
                        return false;
                    }

                    // Filtre marque climatiseur
                    if (categoryFilters.marqueClimatiseur && product.marqueClimatiseur !== categoryFilters.marqueClimatiseur) {
                        return false;
                    }

                    // Filtre type climatiseur (multiselect)
                    if (categoryFilters.typeClimatiseur && Array.isArray(categoryFilters.typeClimatiseur) && categoryFilters.typeClimatiseur.length > 0) {
                        if (!categoryFilters.typeClimatiseur.includes(product.typeClimatiseur)) {
                            return false;
                        }
                    }

                    // Filtre puissance BTU
                    if (categoryFilters.puissanceBtu && product.puissanceBtu !== categoryFilters.puissanceBtu) {
                        return false;
                    }

                    // Filtre disponibilité
                    if (categoryFilters.disponibiliteClim && product.disponibiliteClim !== categoryFilters.disponibiliteClim) {
                        return false;
                    }

                    // Filtre certification
                    if (categoryFilters.certificationClim && product.certificationClim !== categoryFilters.certificationClim) {
                        return false;
                    }

                    // Filtre garantie
                    if (categoryFilters.garantieClim && product.garantieClim !== categoryFilters.garantieClim) {
                        return false;
                    }

                    // Filtre type de clientèle (multiselect)
                    if (categoryFilters.typeClientele && Array.isArray(categoryFilters.typeClientele) && categoryFilters.typeClientele.length > 0) {
                        if (!categoryFilters.typeClientele.includes(product.typeClientele)) {
                            return false;
                        }
                    }

                    // Filtre mode de paiement (multiselect)
                    if (categoryFilters.modePaiementClim && Array.isArray(categoryFilters.modePaiementClim) && categoryFilters.modePaiementClim.length > 0) {
                        if (!Array.isArray(product.modePaiementClim)) {
                            return false;
                        }
                        if (!categoryFilters.modePaiementClim.some(mode => product.modePaiementClim.includes(mode))) {
                            return false;
                        }
                    }

                    // Filtres toggles
                    if (categoryFilters.urgence24h === true && !product.urgence24h) {
                        return false;
                    }

                    if (categoryFilters.devisGratuitClim === true && !product.devisGratuitClim) {
                        return false;
                    }

                    if (categoryFilters.interventionDomicile === true && !product.interventionDomicile) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR MAÇON (SERVICE)
                if (product.type === 'macon') {
                    // Filtre type de prestation
                    if (categoryFilters.typePrestation && product.typeMacon !== categoryFilters.typePrestation) {
                        return false;
                    }

                    // Filtre spécialités (multiselect)
                    if (categoryFilters.specialitesMacon && Array.isArray(categoryFilters.specialitesMacon) && categoryFilters.specialitesMacon.length > 0) {
                        if (!Array.isArray(product.specialitesMacon)) {
                            return false;
                        }
                        if (!categoryFilters.specialitesMacon.some(spec => product.specialitesMacon.includes(spec))) {
                            return false;
                        }
                    }

                    // Filtre types de bâtiments (multiselect)
                    if (categoryFilters.typesBatiment && Array.isArray(categoryFilters.typesBatiment) && categoryFilters.typesBatiment.length > 0) {
                        if (!Array.isArray(product.typesBatimentMacon)) {
                            return false;
                        }
                        if (!categoryFilters.typesBatiment.some(type => product.typesBatimentMacon.includes(type))) {
                            return false;
                        }
                    }

                    // Filtre disponibilité
                    if (categoryFilters.disponibiliteMacon && product.disponibiliteMacon !== categoryFilters.disponibiliteMacon) {
                        return false;
                    }

                    // Filtre garantie travaux
                    if (categoryFilters.garantie && product.garantieMacon !== categoryFilters.garantie) {
                        return false;
                    }

                    // Filtres toggles
                    if (categoryFilters.assuranceDecennale === true && !product.assuranceDecennale) {
                        return false;
                    }

                    if (categoryFilters.devisGratuit === true && !product.devisGratuitMacon) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PLOMBERIE & SANITAIRE (PRODUITS - VENTE MATÉRIEL)
                if (product.type === 'plomberie_sanitaire') {
                    // Filtre catégorie de produit
                    if (categoryFilters.categorieProduit) {
                        const categorieProduit = product.categorieProduit || product.categorieProduitPlomberie;
                        if (categorieProduit !== categoryFilters.categorieProduit) {
                            return false;
                        }
                    }

                    // Filtre marque
                    if (categoryFilters.marque) {
                        const marque = product.marquePlomberie || product.marquePlomberieSanitaire;
                        if (marque !== categoryFilters.marque) {
                            return false;
                        }
                    }

                    // Filtre matériau (multiselect)
                    if (categoryFilters.materiau && Array.isArray(categoryFilters.materiau) && categoryFilters.materiau.length > 0) {
                        const materiau = product.materiauPlomberie || product.materiauPlomberieSanitaire;
                        if (!categoryFilters.materiau.includes(materiau)) {
                            return false;
                        }
                    }

                    // Filtre finition
                    if (categoryFilters.finition) {
                        const finition = product.finitionPlomberie || product.finitionPlomberieSanitaire;
                        if (finition !== categoryFilters.finition) {
                            return false;
                        }
                    }

                    // Filtre état
                    if (categoryFilters.etat) {
                        const etat = product.etatPlomberie || product.etatPlomberieSanitaire;
                        if (etat !== categoryFilters.etat) {
                            return false;
                        }
                    }

                    // Filtre garantie
                    if (categoryFilters.garantie) {
                        const garantie = product.garantiePlomberie || product.garantiePlomberieSanitaire;
                        if (garantie !== categoryFilters.garantie) {
                            return false;
                        }
                    }

                    // Filtre livraison
                    if (categoryFilters.livraison) {
                        const livraison = product.livraisonPlomberie || product.livraisonPlomberieSanitaire;
                        if (livraison !== categoryFilters.livraison) {
                            return false;
                        }
                    }

                    // Filtre installation
                    if (categoryFilters.installation) {
                        const installation = product.installationPlomberie || product.installationPlomberieSanitaire;
                        if (installation !== categoryFilters.installation) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR NETTOYAGE
                if (product.type === 'nettoyage') {
                    if (categoryFilters.typeNettoyage && product.typeNettoyage !== categoryFilters.typeNettoyage) {
                        return false;
                    }
                    if (categoryFilters.frequenceNettoyage && product.frequenceNettoyage !== categoryFilters.frequenceNettoyage) {
                        return false;
                    }
                    if (categoryFilters.produitsBio === true && !product.produitsBio) {
                        return false;
                    }
                    if (categoryFilters.servicesNettoyage && Array.isArray(categoryFilters.servicesNettoyage) && categoryFilters.servicesNettoyage.length > 0) {
                        if (!Array.isArray(product.servicesNettoyage)) {
                            return false;
                        }
                        if (!categoryFilters.servicesNettoyage.some(service => product.servicesNettoyage.includes(service))) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ASSURANCE (MIS À JOUR)
                if (product.type === 'assurance') {
                    // Type VIE / NON VIE
                    if (categoryFilters.typeAssuranceVie && product.typeAssuranceVie !== categoryFilters.typeAssuranceVie) {
                        return false;
                    }
                    // Produit d'assurance
                    if (categoryFilters.produitAssurance && product.produitAssurance !== categoryFilters.produitAssurance) {
                        return false;
                    }
                    // Compagnie
                    if (categoryFilters.compagnieAssurance && product.compagnieAssurance !== categoryFilters.compagnieAssurance) {
                        return false;
                    }
                    // Durée
                    if (categoryFilters.dureeContrat && product.dureeContrat !== categoryFilters.dureeContrat) {
                        return false;
                    }
                    // Mode de paiement
                    if (categoryFilters.modePaiementAssurance && product.modePaiementAssurance !== categoryFilters.modePaiementAssurance) {
                        return false;
                    }
                    // Couvertures (multi-select: au moins une en commun)
                    if (categoryFilters.couverturesArray && Array.isArray(categoryFilters.couverturesArray) && categoryFilters.couverturesArray.length > 0) {
                        const productCouvertures = product.couverturesArray || [];
                        const hasCommonCouverture = categoryFilters.couverturesArray.some(couv =>
                            productCouvertures.some(pc => pc.toLowerCase().includes(couv.toLowerCase()))
                        );
                        if (!hasCommonCouverture) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ELECTRICITE
                if (product.type === 'electricite') {
                    if (categoryFilters.typeElectrique && product.typeElectrique !== categoryFilters.typeElectrique) {
                        return false;
                    }
                    if (categoryFilters.marqueElectrique && product.marqueElectrique !== categoryFilters.marqueElectrique) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR IMAGE_SON (14 filtres complets)
                if (product.type === 'image_son') {
                    // Filtre 1: Catégorie
                    if (categoryFilters.categorieImageSon && product.categorieImageSon !== categoryFilters.categorieImageSon) {
                        return false;
                    }
                    // Filtre 2: Type
                    if (categoryFilters.typeImageSon && product.typeImageSon !== categoryFilters.typeImageSon) {
                        return false;
                    }
                    // Filtre 3: Marque
                    if (categoryFilters.marqueImageSon && product.marqueImageSon !== categoryFilters.marqueImageSon) {
                        return false;
                    }
                    // Filtre 4: Technologie écran
                    if (categoryFilters.technologieEcran && product.technologieEcran !== categoryFilters.technologieEcran) {
                        return false;
                    }
                    // Filtre 5: Résolution
                    if (categoryFilters.resolution && product.resolution !== categoryFilters.resolution) {
                        return false;
                    }
                    // Filtre 6: Diagonale écran (range)
                    if (categoryFilters.diagonaleEcran) {
                        const diagonale = parseFloat(product.diagonaleEcran);
                        const filterDiagonale = parseFloat(categoryFilters.diagonaleEcran);
                        if (!isNaN(diagonale) && !isNaN(filterDiagonale) && diagonale < filterDiagonale) {
                            return false;
                        }
                    }
                    // Filtre 7: Gamme/Modèle
                    if (categoryFilters.modeleImageSon && product.modeleImageSon !== categoryFilters.modeleImageSon) {
                        return false;
                    }
                    // Filtre 8: État
                    if (categoryFilters.etatImageSon && product.etatImageSon !== categoryFilters.etatImageSon) {
                        return false;
                    }
                    // Filtre 9: Garantie
                    if (categoryFilters.garantieImageSon && product.garantieImageSon !== categoryFilters.garantieImageSon) {
                        return false;
                    }
                    // Filtre 10: Connectivités (multiselect)
                    if (categoryFilters.connectivitesImageSon && Array.isArray(categoryFilters.connectivitesImageSon) && categoryFilters.connectivitesImageSon.length > 0) {
                        const hasAllConnectivites = categoryFilters.connectivitesImageSon.every(conn =>
                            product.connectivitesImageSon && product.connectivitesImageSon.includes(conn)
                        );
                        if (!hasAllConnectivites) {
                            return false;
                        }
                    }
                    // Filtre 11: Fonctionnalités (multiselect)
                    if (categoryFilters.fonctionnalitesImageSon && Array.isArray(categoryFilters.fonctionnalitesImageSon) && categoryFilters.fonctionnalitesImageSon.length > 0) {
                        const hasAllFonctionnalites = categoryFilters.fonctionnalitesImageSon.every(fonc =>
                            product.fonctionnalitesImageSon && product.fonctionnalitesImageSon.includes(fonc)
                        );
                        if (!hasAllFonctionnalites) {
                            return false;
                        }
                    }
                    // Filtre 12: Puissance audio (range)
                    if (categoryFilters.puissanceAudio) {
                        const puissance = parseFloat(product.puissanceAudio);
                        const filterPuissance = parseFloat(categoryFilters.puissanceAudio);
                        if (!isNaN(puissance) && !isNaN(filterPuissance) && puissance < filterPuissance) {
                            return false;
                        }
                    }
                    // Filtre 13: Année de sortie (range)
                    if (categoryFilters.anneeSortie) {
                        const annee = parseInt(product.anneeSortie);
                        const filterAnnee = parseInt(categoryFilters.anneeSortie);
                        if (!isNaN(annee) && !isNaN(filterAnnee) && annee < filterAnnee) {
                            return false;
                        }
                    }
                    // Filtre 14: Accessoires inclus (multiselect)
                    if (categoryFilters.accessoiresImageSon && Array.isArray(categoryFilters.accessoiresImageSon) && categoryFilters.accessoiresImageSon.length > 0) {
                        const hasAllAccessoires = categoryFilters.accessoiresImageSon.every(acc =>
                            product.accessoiresImageSon && product.accessoiresImageSon.includes(acc)
                        );
                        if (!hasAllAccessoires) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR SPORT_LOISIRS
                if (product.type === 'sport_loisirs') {
                    if (categoryFilters.typeSport && product.typeSport !== categoryFilters.typeSport) {
                        return false;
                    }
                    if (categoryFilters.categorieSport && product.categorieSport !== categoryFilters.categorieSport) {
                        return false;
                    }
                    if (categoryFilters.niveauSport && product.niveauSport !== categoryFilters.niveauSport) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR SPORT_FITNESS
                if (product.type === 'sport_fitness') {
                    if (categoryFilters.typeSport && product.typeSport !== categoryFilters.typeSport) {
                        return false;
                    }
                    if (categoryFilters.niveauSport && product.niveauSport !== categoryFilters.niveauSport) {
                        return false;
                    }
                    if (categoryFilters.dureeSport && product.dureeSport !== categoryFilters.dureeSport) {
                        return false;
                    }
                    if (categoryFilters.serviceSport && product.serviceSport !== categoryFilters.serviceSport) {
                        return false;
                    }
                    if (categoryFilters.objectifSport && product.objectifSport !== categoryFilters.objectifSport) {
                        return false;
                    }
                    if (categoryFilters.horairesSport && product.horairesSport !== categoryFilters.horairesSport) {
                        return false;
                    }
                    // Jours (multiselect - au moins un jour en commun)
                    if (categoryFilters.joursSport && categoryFilters.joursSport.length > 0 && product.joursSport) {
                        const hasCommonDay = categoryFilters.joursSport.some((jour: string) =>
                            product.joursSport.includes(jour)
                        );
                        if (!hasCommonDay) return false;
                    }
                    // Équipements (multiselect - au moins un équipement en commun)
                    if (categoryFilters.equipementsSport && categoryFilters.equipementsSport.length > 0 && product.equipementsSport) {
                        const hasCommonEquipment = categoryFilters.equipementsSport.some((equip: string) =>
                            product.equipementsSport.includes(equip)
                        );
                        if (!hasCommonEquipment) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR BRICOLAGE
                if (product.type === 'bricolage') {
                    if (categoryFilters.typeBricolage && product.typeBricolage !== categoryFilters.typeBricolage) {
                        return false;
                    }
                    if (categoryFilters.marqueBricolage && product.marqueBricolage !== categoryFilters.marqueBricolage) {
                        return false;
                    }
                    if (categoryFilters.etatBricolage && product.etatBricolage !== categoryFilters.etatBricolage) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ENFANTS_BEBES
                if (product.type === 'enfants_bebes') {
                    if (categoryFilters.categorieEnfant && product.categorieEnfant !== categoryFilters.categorieEnfant) {
                        return false;
                    }
                    if (categoryFilters.ageRecommande && product.ageRecommande !== categoryFilters.ageRecommande) {
                        return false;
                    }
                    if (categoryFilters.etatEnfant && product.etatEnfant !== categoryFilters.etatEnfant) {
                        return false;
                    }
                    if (categoryFilters.securiteNorme === true && !product.securiteNorme) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR DECORATION - COMPLET
                if (product.type === 'decoration') {
                    if (categoryFilters.categorieDecoration && product.categorieDecoration !== categoryFilters.categorieDecoration) {
                        return false;
                    }
                    if (categoryFilters.styleDecoration && product.styleDecoration !== categoryFilters.styleDecoration) {
                        return false;
                    }
                    if (categoryFilters.pieceDecoration && product.pieceDecoration !== categoryFilters.pieceDecoration) {
                        return false;
                    }
                    if (categoryFilters.matiereDecoration && product.matiereDecoration !== categoryFilters.matiereDecoration) {
                        return false;
                    }
                    if (categoryFilters.couleurDecoration && product.couleurDecoration !== categoryFilters.couleurDecoration) {
                        return false;
                    }
                    if (categoryFilters.tailleDecoration && product.tailleDecoration !== categoryFilters.tailleDecoration) {
                        return false;
                    }
                    if (categoryFilters.etatDecoration && product.etatDecoration !== categoryFilters.etatDecoration) {
                        return false;
                    }
                    if (categoryFilters.marqueDecoration && product.marqueDecoration !== categoryFilters.marqueDecoration) {
                        return false;
                    }
                    // Legacy pour compatibilité
                    if (categoryFilters.typeDecoration && product.typeDecoration !== categoryFilters.typeDecoration) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR JOUETS_ENFANTS
                if (product.type === 'jouets_enfants') {
                    if (categoryFilters.typeJouet && product.typeJouet !== categoryFilters.typeJouet) {
                        return false;
                    }
                    if (categoryFilters.ageRecommande && product.ageRecommande !== categoryFilters.ageRecommande) {
                        return false;
                    }
                    if (categoryFilters.marqueJouet && product.marqueJouet !== categoryFilters.marqueJouet) {
                        return false;
                    }
                    if (categoryFilters.etatJouet && product.etatJouet !== categoryFilters.etatJouet) {
                        return false;
                    }
                    if (categoryFilters.genreJouet && product.genreJouet !== categoryFilters.genreJouet) {
                        return false;
                    }
                    if (categoryFilters.materiauJouet && product.materiauJouet !== categoryFilters.materiauJouet) {
                        return false;
                    }
                    if (categoryFilters.normesSecurite && Array.isArray(categoryFilters.normesSecurite) && categoryFilters.normesSecurite.length > 0) {
                        const productNormes = Array.isArray(product.normesSecurite) ? product.normesSecurite : [];
                        const hasCommonNorme = categoryFilters.normesSecurite.some((norme: string) => productNormes.includes(norme));
                        if (!hasCommonNorme) {
                            return false;
                        }
                    }
                    if (categoryFilters.categoriesEducatives && Array.isArray(categoryFilters.categoriesEducatives) && categoryFilters.categoriesEducatives.length > 0) {
                        const productCategories = Array.isArray(product.categoriesEducatives) ? product.categoriesEducatives : [];
                        const hasCommonCategorie = categoryFilters.categoriesEducatives.some((cat: string) => productCategories.includes(cat));
                        if (!hasCommonCategorie) {
                            return false;
                        }
                    }
                    if (categoryFilters.alimentationJouet && product.alimentationJouet !== categoryFilters.alimentationJouet) {
                        return false;
                    }
                    if (categoryFilters.lieuUtilisation && product.lieuUtilisation !== categoryFilters.lieuUtilisation) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR USTENSILES_CUISINE
                if (product.type === 'ustensiles_cuisine') {
                    if (categoryFilters.categorieUstensile && product.categorieUstensile !== categoryFilters.categorieUstensile) {
                        return false;
                    }
                    if (categoryFilters.typeUstensile && product.typeUstensile !== categoryFilters.typeUstensile) {
                        return false;
                    }
                    if (categoryFilters.materiauUstensile && product.materiauUstensile !== categoryFilters.materiauUstensile) {
                        return false;
                    }
                    if (categoryFilters.marqueUstensile && product.marqueUstensile !== categoryFilters.marqueUstensile) {
                        return false;
                    }
                    if (categoryFilters.etatUstensile && product.etatUstensile !== categoryFilters.etatUstensile) {
                        return false;
                    }
                    if (categoryFilters.usageUstensile && product.usageUstensile !== categoryFilters.usageUstensile) {
                        return false;
                    }
                    if (categoryFilters.piecesDansSet && product.piecesDansSet !== categoryFilters.piecesDansSet) {
                        return false;
                    }
                    if (categoryFilters.capaciteUstensile && product.capaciteUstensile !== categoryFilters.capaciteUstensile) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR QUINCAILLERIE - COMPLET
                if (product.type === 'quincaillerie') {
                    // Catégorie de quincaillerie
                    if (categoryFilters.categorieQuincaillerie && product.categorieQuincaillerie !== categoryFilters.categorieQuincaillerie) {
                        return false;
                    }

                    // Type de produit
                    if (categoryFilters.typeQuincaillerie && product.typeQuincaillerie !== categoryFilters.typeQuincaillerie) {
                        return false;
                    }

                    // Marque
                    if (categoryFilters.marqueQuincaillerie && product.marqueQuincaillerie !== categoryFilters.marqueQuincaillerie) {
                        return false;
                    }

                    // Matériau
                    if (categoryFilters.materiauQuincaillerie && product.materiauQuincaillerie !== categoryFilters.materiauQuincaillerie) {
                        return false;
                    }

                    // Dimension
                    if (categoryFilters.dimensionQuincaillerie && product.dimensionQuincaillerie !== categoryFilters.dimensionQuincaillerie) {
                        return false;
                    }

                    // Finition
                    if (categoryFilters.finitionQuincaillerie && product.finitionQuincaillerie !== categoryFilters.finitionQuincaillerie) {
                        return false;
                    }

                    // Usage
                    if (categoryFilters.usageQuincaillerie && product.usageQuincaillerie !== categoryFilters.usageQuincaillerie) {
                        return false;
                    }

                    // État
                    if (categoryFilters.etatQuincaillerie && product.etatQuincaillerie !== categoryFilters.etatQuincaillerie) {
                        return false;
                    }

                    // Garantie
                    if (categoryFilters.garantieQuincaillerie && product.garantieQuincaillerie !== categoryFilters.garantieQuincaillerie) {
                        return false;
                    }

                    // Norme
                    if (categoryFilters.normeQuincaillerie && product.normeQuincaillerie !== categoryFilters.normeQuincaillerie) {
                        return false;
                    }

                    // Unité de vente
                    if (categoryFilters.uniteVente && product.uniteVente !== categoryFilters.uniteVente) {
                        return false;
                    }

                    // Type de fournisseur
                    if (categoryFilters.typeFournisseurQuincaillerie && product.typeFournisseurQuincaillerie !== categoryFilters.typeFournisseurQuincaillerie) {
                        return false;
                    }

                    // Ville
                    if (categoryFilters.ville) {
                        const villeProduct = product.ville?.toLowerCase() || product.localisation?.toLowerCase() || '';
                        const villeFilter = categoryFilters.ville.toLowerCase();
                        if (!villeProduct.includes(villeFilter) && villeFilter !== villeProduct) return false;
                    }

                    // Quartier
                    if (categoryFilters.quartier) {
                        const quartierProduct = product.quartier?.toLowerCase() || product.localisation?.toLowerCase() || '';
                        const quartierFilter = categoryFilters.quartier.toLowerCase();
                        if (!quartierProduct.includes(quartierFilter)) return false;
                    }

                    // Toggles
                    if (categoryFilters.enStock === true && (!product.stockDisponible || product.stockDisponible <= 0)) return false;
                    if (categoryFilters.livraisonDisponible === true && !product.livraisonDisponible) return false;
                }

                // ✅ FILTRES SPÉCIAUX POUR ÉLECTRICITÉ & ÉCLAIRAGE
                if (product.type === 'electricite') {
                    // Filtre catégorie électrique
                    if (categoryFilters.categorieElectrique && product.categorieElectrique !== categoryFilters.categorieElectrique) {
                        return false;
                    }

                    // Filtre type d'éclairage
                    if (categoryFilters.typeElectricite && product.typeElectricite !== categoryFilters.typeElectricite) {
                        return false;
                    }

                    // Filtre marque
                    if (categoryFilters.marqueElectricite && product.marqueElectricite !== categoryFilters.marqueElectricite) {
                        return false;
                    }

                    // Filtre tension
                    if (categoryFilters.tensionElectrique && product.tensionElectrique !== categoryFilters.tensionElectrique) {
                        return false;
                    }

                    // Filtre puissance
                    if (categoryFilters.puissanceElectrique && product.puissanceElectrique !== categoryFilters.puissanceElectrique) {
                        return false;
                    }

                    // Filtre culot ampoule
                    if (categoryFilters.culotAmpoule && product.culotAmpoule !== categoryFilters.culotAmpoule) {
                        return false;
                    }

                    // Filtre couleur lumière
                    if (categoryFilters.couleurLumiere && product.couleurLumiere !== categoryFilters.couleurLumiere) {
                        return false;
                    }

                    // Filtre normes (multiselect)
                    if (categoryFilters.normesElectrique && Array.isArray(categoryFilters.normesElectrique) && categoryFilters.normesElectrique.length > 0) {
                        const hasNormes = categoryFilters.normesElectrique.some((normeRecherchee: string) =>
                            product.normesElectrique?.includes(normeRecherchee)
                        );
                        if (!hasNormes) return false;
                    }

                    // Filtre état
                    if (categoryFilters.etatElectrique && product.etatElectrique !== categoryFilters.etatElectrique) {
                        return false;
                    }

                    // Filtre type d'utilisation
                    if (categoryFilters.utilisationElectrique && product.utilisationElectrique !== categoryFilters.utilisationElectrique) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR COSMETIQUE_PARFUM
                if (product.type === 'cosmetique_parfum') {
                    if (categoryFilters.typeCosmetique && product.typeCosmetique !== categoryFilters.typeCosmetique) {
                        return false;
                    }
                    if (categoryFilters.marqueCosmetique && product.marqueCosmetique !== categoryFilters.marqueCosmetique) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PIECES_AUTO - TOUS LES FILTRES
                if (product.type === 'pieces_auto') {
                    // Type de pièce
                    if (categoryFilters.typePieceAuto && product.typePieceAuto !== categoryFilters.typePieceAuto) {
                        return false;
                    }
                    // Catégorie principale
                    if (categoryFilters.categoriePieceAuto && product.categoriePieceAuto !== categoryFilters.categoriePieceAuto) {
                        return false;
                    }
                    // Marque de la pièce
                    if (categoryFilters.marquePieceAuto && product.marquePieceAuto !== categoryFilters.marquePieceAuto) {
                        return false;
                    }
                    // Marque véhicule compatible
                    if (categoryFilters.marqueVehiculeCompatible && product.marqueVehiculeCompatible !== categoryFilters.marqueVehiculeCompatible) {
                        return false;
                    }
                    // Modèle véhicule
                    if (categoryFilters.modeleVehicule && product.modeleVehicule !== categoryFilters.modeleVehicule) {
                        return false;
                    }
                    // État
                    if (categoryFilters.etatPieceAuto && product.etatPieceAuto !== categoryFilters.etatPieceAuto) {
                        return false;
                    }
                    // Origine
                    if (categoryFilters.originePiece && product.originePiece !== categoryFilters.originePiece) {
                        return false;
                    }
                    // Garantie
                    if (categoryFilters.garantiePiece && product.garantiePiece !== categoryFilters.garantiePiece) {
                        return false;
                    }
                    // Compatibilité
                    if (categoryFilters.niveauCompatibilite && product.niveauCompatibilite !== categoryFilters.niveauCompatibilite) {
                        return false;
                    }
                    // Matériau
                    if (categoryFilters.materiauPiece && product.materiauPiece !== categoryFilters.materiauPiece) {
                        return false;
                    }
                    // Type fournisseur
                    if (categoryFilters.typeFournisseur && product.typeFournisseur !== categoryFilters.typeFournisseur) {
                        return false;
                    }
                    // Avec référence (toggle)
                    if (categoryFilters.avecReference === true && product.avecReference !== true) {
                        return false;
                    }
                    // Livraison disponible (toggle)
                    if (categoryFilters.livraisonDisponible === true && product.livraisonDisponible !== true) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PIECES_INDUSTRIELLES
                if (product.type === 'pieces_industrielles') {
                    if (categoryFilters.typePieceIndustrielle && product.typePieceIndustrielle !== categoryFilters.typePieceIndustrielle) {
                        return false;
                    }
                    if (categoryFilters.marquePieceIndustrielle && product.marquePieceIndustrielle !== categoryFilters.marquePieceIndustrielle) {
                        return false;
                    }
                    if (categoryFilters.applicationIndustrielle) {
                        // Gérer les applications en multiselect
                        const productApps = Array.isArray(product.applicationIndustrielle)
                            ? product.applicationIndustrielle
                            : typeof product.applicationIndustrielle === 'string'
                                ? (product.applicationIndustrielle.includes(',')
                                    ? product.applicationIndustrielle.split(',').map(a => a.trim())
                                    : [product.applicationIndustrielle])
                                : [];

                        if (!productApps.includes(categoryFilters.applicationIndustrielle)) {
                            return false;
                        }
                    }
                    if (categoryFilters.materielPiece && product.materielPiece !== categoryFilters.materielPiece) {
                        return false;
                    }
                    if (categoryFilters.etatPieceIndustrielle && product.etatPieceIndustrielle !== categoryFilters.etatPieceIndustrielle) {
                        return false;
                    }
                    if (categoryFilters.garantiePieceIndustrielle && product.garantiePieceIndustrielle !== categoryFilters.garantiePieceIndustrielle) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ELECTRONIQUE (PRODUITS)
                if (product.type === 'electronique') {
                    if (categoryFilters.typeElectronique && product.typeElectronique !== categoryFilters.typeElectronique) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR RÉPARATEUR ÉLECTRONIQUE (TV, RADIO, AUDIO, VIDÉO)
                if (product.type === 'reparateur_electronique') {
                    // Filtre par type de service électronique (multiselect)
                    if (categoryFilters.serviceElectronique && Array.isArray(categoryFilters.serviceElectronique) && categoryFilters.serviceElectronique.length > 0) {
                        const hasService = categoryFilters.serviceElectronique.some((serviceRecherche: string) => {
                            const servicesProduct = product.typesServiceElectronique || [];
                            return servicesProduct.some((service: string) => service.includes(serviceRecherche) || serviceRecherche.includes(service));
                        });
                        if (!hasService) return false;
                    }

                    // Filtre par marque TV (multiselect)
                    if (categoryFilters.marqueTv && Array.isArray(categoryFilters.marqueTv) && categoryFilters.marqueTv.length > 0) {
                        const hasMarque = categoryFilters.marqueTv.some((marqueRecherchee: string) => {
                            const marquesProduct = product.marquesTv || [];
                            return marquesProduct.some((marque: string) => marque === marqueRecherchee || marqueRecherchee === 'Toutes marques TV');
                        });
                        if (!hasMarque) return false;
                    }

                    // Filtre par type d'appareil électronique (multiselect)
                    if (categoryFilters.typeAppareilElectronique && Array.isArray(categoryFilters.typeAppareilElectronique) && categoryFilters.typeAppareilElectronique.length > 0) {
                        const hasAppareil = categoryFilters.typeAppareilElectronique.some((appareilRecherche: string) => {
                            const appareilsProduct = product.typesAppareilsElectroniques || [];
                            return appareilsProduct.some((appareil: string) => appareil.includes(appareilRecherche) || appareilRecherche.includes(appareil));
                        });
                        if (!hasAppareil) return false;
                    }

                    // Filtre par type de panne (multiselect)
                    if (categoryFilters.typePanneElectronique && Array.isArray(categoryFilters.typePanneElectronique) && categoryFilters.typePanneElectronique.length > 0) {
                        const hasPanne = categoryFilters.typePanneElectronique.some((panneRecherchee: string) => {
                            const pannesProduct = product.typesPannesElectronique || [];
                            return pannesProduct.some((panne: string) => panne.includes(panneRecherchee) || panneRecherchee.includes(panne));
                        });
                        if (!hasPanne) return false;
                    }

                    // Filtre par taille écran TV (select)
                    if (categoryFilters.tailleEcranTv && product.taillesEcranTv !== categoryFilters.tailleEcranTv) {
                        return false;
                    }

                    // Filtre par disponibilité (select)
                    if (categoryFilters.disponibiliteElectronique && product.disponibilitesElectronique !== categoryFilters.disponibiliteElectronique) {
                        return false;
                    }

                    // Filtre par garantie (select)
                    if (categoryFilters.garantieElectronique && product.garantiesElectronique !== categoryFilters.garantieElectronique) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR MENUISERIE & ÉBÉNISTERIE
                if (product.type === 'menuiserie' || product.type === 'ebenisterie' || product.type === 'menuiserie_bois') {
                    // Filtre par type de service (multiselect)
                    if (categoryFilters.serviceMenuiserie && Array.isArray(categoryFilters.serviceMenuiserie) && categoryFilters.serviceMenuiserie.length > 0) {
                        const hasService = categoryFilters.serviceMenuiserie.some((serviceRecherche: string) => {
                            const servicesProduct = product.services || [];
                            return servicesProduct.some((service: string) => service === serviceRecherche);
                        });
                        if (!hasService) return false;
                    }

                    // Filtre par type de bois (multiselect)
                    if (categoryFilters.typeBois && Array.isArray(categoryFilters.typeBois) && categoryFilters.typeBois.length > 0) {
                        const hasBois = categoryFilters.typeBois.some((boisRecherche: string) => {
                            const boisProduct = product.bois || product.typeBois || [];
                            return boisProduct === boisRecherche || (Array.isArray(boisProduct) && boisProduct.includes(boisRecherche));
                        });
                        if (!hasBois) return false;
                    }

                    // Filtre par finitions (multiselect)
                    if (categoryFilters.finitionsMenuiserie && Array.isArray(categoryFilters.finitionsMenuiserie) && categoryFilters.finitionsMenuiserie.length > 0) {
                        const hasFinition = categoryFilters.finitionsMenuiserie.some((finitionRecherche: string) =>
                            product.finitions && product.finitions.includes(finitionRecherche)
                        );
                        if (!hasFinition) return false;
                    }

                    // Filtre par style
                    if (categoryFilters.styleMenuiserie && product.styles !== categoryFilters.styleMenuiserie && product.style !== categoryFilters.styleMenuiserie) {
                        return false;
                    }

                    // Filtre par expérience
                    if (categoryFilters.experienceMenuisier && product.niveaux_experience !== categoryFilters.experienceMenuisier && product.experience !== categoryFilters.experienceMenuisier) {
                        return false;
                    }

                    // Filtre par certification (multiselect)
                    if (categoryFilters.certificationMenuisier && Array.isArray(categoryFilters.certificationMenuisier) && categoryFilters.certificationMenuisier.length > 0) {
                        const hasCertification = categoryFilters.certificationMenuisier.some((certRecherche: string) =>
                            product.certifications && product.certifications.includes(certRecherche)
                        );
                        if (!hasCertification) return false;
                    }

                    // Filtre par délai
                    if (categoryFilters.delaiMenuiserie && product.delais !== categoryFilters.delaiMenuiserie && product.delais !== categoryFilters.delaiMenuiserie) {
                        return false;
                    }

                    // Filtre par atelier
                    if (categoryFilters.atelierMenuiserie && product.marques_ateliers !== categoryFilters.atelierMenuiserie) {
                        return false;
                    }

                    // Filtre par garantie
                    if (categoryFilters.garantieMenuiserie) {
                        const hasGarantie = product.garanties && product.garanties.includes(categoryFilters.garantieMenuiserie);
                        if (!hasGarantie) return false;
                    }

                    // Filtre par mode de paiement (multiselect)
                    if (categoryFilters.paiementMenuiserie && Array.isArray(categoryFilters.paiementMenuiserie) && categoryFilters.paiementMenuiserie.length > 0) {
                        const hasPaymentMode = categoryFilters.paiementMenuiserie.some((paymentRecherche: string) =>
                            product.modes_paiement && product.modes_paiement.includes(paymentRecherche)
                        );
                        if (!hasPaymentMode) return false;
                    }

                    // Filtre par équipement atelier
                    if (categoryFilters.equipementAtelier && product.outils_disponibles !== categoryFilters.equipementAtelier) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR AGRICULTURE
                if (product.type === 'agriculture') {
                    if (categoryFilters.typeAgricole && product.typeAgricole !== categoryFilters.typeAgricole) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR SECURITE_SURVEILLANCE - COMPLET (22 filtres)
                if (product.type === 'securite_surveillance') {
                    // Filtre 1: Type de service (multiselect)
                    if (categoryFilters.typeServiceSecurite && Array.isArray(categoryFilters.typeServiceSecurite) && categoryFilters.typeServiceSecurite.length > 0) {
                        const hasService = categoryFilters.typeServiceSecurite.some((serviceRecherche: string) =>
                            product.typeServiceSecurite === serviceRecherche
                        );
                        if (!hasService) return false;
                    }

                    // Filtre 2: Type de client (multiselect)
                    if (categoryFilters.typeClientSecurite && Array.isArray(categoryFilters.typeClientSecurite) && categoryFilters.typeClientSecurite.length > 0) {
                        const hasClient = categoryFilters.typeClientSecurite.some((clientRecherche: string) =>
                            product.typeClientSecurite === clientRecherche
                        );
                        if (!hasClient) return false;
                    }

                    // Filtre 3: Disponibilité (select)
                    if (categoryFilters.disponibiliteSecurite && product.disponibiliteSecurite !== categoryFilters.disponibiliteSecurite) {
                        return false;
                    }

                    // Filtre 4: Type de caméra (multiselect)
                    if (categoryFilters.typeCameraSecurite && Array.isArray(categoryFilters.typeCameraSecurite) && categoryFilters.typeCameraSecurite.length > 0) {
                        const hasCamera = categoryFilters.typeCameraSecurite.some((cameraRecherche: string) =>
                            product.typeCameraSecurite === cameraRecherche
                        );
                        if (!hasCamera) return false;
                    }

                    // Filtre 5: Résolution caméra (select)
                    if (categoryFilters.resolutionCamera && product.resolutionCamera !== categoryFilters.resolutionCamera) {
                        return false;
                    }

                    // Filtre 6: Stockage vidéo (select)
                    if (categoryFilters.stockageVideo && product.stockageVideo !== categoryFilters.stockageVideo) {
                        return false;
                    }

                    // Filtre 7: Type alarme (multiselect)
                    if (categoryFilters.typeAlarme && Array.isArray(categoryFilters.typeAlarme) && categoryFilters.typeAlarme.length > 0) {
                        const hasAlarme = categoryFilters.typeAlarme.some((alarmeRecherche: string) =>
                            product.typeAlarme === alarmeRecherche
                        );
                        if (!hasAlarme) return false;
                    }

                    // Filtre 8: Contrôle d'accès (multiselect)
                    if (categoryFilters.controleAcces && Array.isArray(categoryFilters.controleAcces) && categoryFilters.controleAcces.length > 0) {
                        const hasControle = categoryFilters.controleAcces.some((controleRecherche: string) =>
                            product.controleAcces === controleRecherche
                        );
                        if (!hasControle) return false;
                    }

                    // Filtre 9: Nombre d'agents (select)
                    if (categoryFilters.nombreAgents && product.nombreAgents !== categoryFilters.nombreAgents) {
                        return false;
                    }

                    // Filtre 10: Armement agents (select)
                    if (categoryFilters.armementAgents && product.armementAgents !== categoryFilters.armementAgents) {
                        return false;
                    }

                    // Filtre 11: Certifications (multiselect)
                    if (categoryFilters.certificationsSecurite && Array.isArray(categoryFilters.certificationsSecurite) && categoryFilters.certificationsSecurite.length > 0) {
                        const hasCertification = categoryFilters.certificationsSecurite.some((certifRecherche: string) =>
                            product.certificationsSecurite === certifRecherche
                        );
                        if (!hasCertification) return false;
                    }

                    // Filtre 12: Durée du contrat (select)
                    if (categoryFilters.dureeContratSecurite && product.dureeContratSecurite !== categoryFilters.dureeContratSecurite) {
                        return false;
                    }

                    // Filtre 13: Intervention rapide (toggle)
                    if (categoryFilters.interventionRapide === true && !product.interventionRapide) {
                        return false;
                    }

                    // Filtre 14: Service 24h/24 - 7j/7 (toggle)
                    if (categoryFilters.service24h7j === true && !product.service24h7j) {
                        return false;
                    }

                    // Filtre 15: Télésurveillance (toggle)
                    if (categoryFilters.telesurveillance === true && !product.telesurveillance) {
                        return false;
                    }

                    // Filtre 16: Installation incluse (toggle)
                    if (categoryFilters.installationIncluse === true && !product.installationIncluse) {
                        return false;
                    }

                    // Filtre 17: Maintenance incluse (toggle)
                    if (categoryFilters.maintenanceIncluse === true && !product.maintenanceIncluse) {
                        return false;
                    }

                    // Filtre 18: Devis gratuit (toggle)
                    if (categoryFilters.devisGratuit === true && !product.devisGratuit) {
                        return false;
                    }

                    // Filtre 19: Garantie équipement (select)
                    if (categoryFilters.garantieEquipement && product.garantieEquipement !== categoryFilters.garantieEquipement) {
                        return false;
                    }

                    // Filtre 20: Marques équipements (multiselect)
                    if (categoryFilters.marquesEquipements && Array.isArray(categoryFilters.marquesEquipements) && categoryFilters.marquesEquipements.length > 0) {
                        const hasMarque = categoryFilters.marquesEquipements.some((marqueRecherche: string) =>
                            product.marquesEquipements === marqueRecherche
                        );
                        if (!hasMarque) return false;
                    }

                    // Filtre 21: Alimentation électrique (multiselect)
                    if (categoryFilters.alimentationElectrique && Array.isArray(categoryFilters.alimentationElectrique) && categoryFilters.alimentationElectrique.length > 0) {
                        const hasAlimentation = categoryFilters.alimentationElectrique.some((alimRecherche: string) =>
                            product.alimentationElectrique === alimRecherche
                        );
                        if (!hasAlimentation) return false;
                    }

                    // Filtre 22: Application mobile (toggle)
                    if (categoryFilters.applicationMobile === true && !product.applicationMobile) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ANIMAUX_VETERINAIRE
                if (product.type === 'animaux_veterinaire') {
                    // Filtre 1: Type d'animal
                    if (categoryFilters.typeAnimal && product.typeAnimal !== categoryFilters.typeAnimal) {
                        return false;
                    }

                    // ✅ NOUVEAU Filtre 2: Services vétérinaires (multiselect)
                    if (categoryFilters.servicesVeterinaire && Array.isArray(categoryFilters.servicesVeterinaire) && categoryFilters.servicesVeterinaire.length > 0) {
                        const productServices = product.servicesVeterinaire || (product.services ? product.services.split(',').map(s => s.trim()) : []);
                        const hasService = categoryFilters.servicesVeterinaire.some((service: string) =>
                            productServices.some((ps: string) => ps.toLowerCase().includes(service.toLowerCase()))
                        );
                        if (!hasService) return false;
                    }

                    // ✅ NOUVEAU Filtre 3: Race de l'animal
                    if (categoryFilters.raceAnimal && product.raceAnimal !== categoryFilters.raceAnimal) {
                        return false;
                    }

                    // ✅ NOUVEAU Filtre 4: Âge de l'animal
                    if (categoryFilters.ageAnimal && product.ageAnimal !== categoryFilters.ageAnimal) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR SANTE_BEAUTE
                if (product.type === 'sante_beaute') {
                    if (categoryFilters.typeProduitBeaute && product.typeProduitBeaute !== categoryFilters.typeProduitBeaute) {
                        return false;
                    }
                    if (categoryFilters.marqueBeaute && product.marqueBeaute !== categoryFilters.marqueBeaute) {
                        return false;
                    }
                    if (categoryFilters.bio === true && !product.bio) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR BIEN_ETRE_SPA
                if (product.type === 'bien_etre_spa' || product.type === 'bien_etre' || product.type === 'bien-etre') {
                    // Type de soin
                    if (categoryFilters.typeBienEtre && product.typeBienEtre !== categoryFilters.typeBienEtre) {
                        return false;
                    }
                    // Durée du soin
                    if (categoryFilters.dureeBienEtre && product.dureeBienEtre !== categoryFilters.dureeBienEtre) {
                        return false;
                    }
                    // Services & équipements (multiselect)
                    if (categoryFilters.servicesBienEtre && Array.isArray(categoryFilters.servicesBienEtre) && categoryFilters.servicesBienEtre.length > 0) {
                        const hasServices = categoryFilters.servicesBienEtre.some((service: string) =>
                            product.servicesBienEtre?.includes(service)
                        );
                        if (!hasServices) return false;
                    }
                    // Type de clientèle (multiselect)
                    if (categoryFilters.clienteleBienEtre && Array.isArray(categoryFilters.clienteleBienEtre) && categoryFilters.clienteleBienEtre.length > 0) {
                        const hasClientele = categoryFilters.clienteleBienEtre.some((client: string) =>
                            product.clienteleBienEtre?.includes(client)
                        );
                        if (!hasClientele) return false;
                    }
                    // Fourchette tarifaire
                    if (categoryFilters.tarifsParCategorie && product.tarifsParCategorie !== categoryFilters.tarifsParCategorie) {
                        return false;
                    }
                    // Formules & forfaits (multiselect)
                    if (categoryFilters.formulesSpa && Array.isArray(categoryFilters.formulesSpa) && categoryFilters.formulesSpa.length > 0) {
                        const hasFormule = categoryFilters.formulesSpa.some((formule: string) =>
                            product.formulesSpa?.includes(formule)
                        );
                        if (!hasFormule) return false;
                    }
                    // Spécialités (multiselect)
                    if (categoryFilters.specialitesBienEtre && Array.isArray(categoryFilters.specialitesBienEtre) && categoryFilters.specialitesBienEtre.length > 0) {
                        const hasSpecialite = categoryFilters.specialitesBienEtre.some((specialite: string) =>
                            product.specialitesBienEtre?.includes(specialite)
                        );
                        if (!hasSpecialite) return false;
                    }
                    // Horaires
                    if (categoryFilters.horairesSpa && Array.isArray(categoryFilters.horairesSpa) && categoryFilters.horairesSpa.length > 0) {
                        const hasHoraire = categoryFilters.horairesSpa.some((horaire: string) =>
                            product.horairesSpa?.includes(horaire)
                        );
                        if (!hasHoraire) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR BIJOUX
                if (product.type === 'bijoux') {
                    if (categoryFilters.typeBijou && product.typeBijou !== categoryFilters.typeBijou) {
                        return false;
                    }
                    if (categoryFilters.materiauBijou && product.materiauBijou !== categoryFilters.materiauBijou) {
                        return false;
                    }
                    if (categoryFilters.certificat === true && !product.certificat) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR JURIDIQUE
                if (product.type === 'juridique') {
                    if (categoryFilters.typeServiceJuridique && product.typeServiceJuridique !== categoryFilters.typeServiceJuridique) {
                        return false;
                    }
                    if (categoryFilters.domaineJuridique && product.domaineJuridique !== categoryFilters.domaineJuridique) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR MUSIQUE (SERVICES)
                if (product.type === 'musique') {
                    if (categoryFilters.typeServiceMusical && product.typeServiceMusical !== categoryFilters.typeServiceMusical) {
                        return false;
                    }
                    if (categoryFilters.genreMusical && product.genreMusical !== categoryFilters.genreMusical) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PHOTOGRAPHIE
                if (product.type === 'photographie') {
                    if (categoryFilters.typePhotoService && product.typePhotoService !== categoryFilters.typePhotoService) {
                        return false;
                    }
                    if (categoryFilters.stylePhoto && product.stylePhoto !== categoryFilters.stylePhoto) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ENTREPRISE_INDUSTRIE
                if (product.type === 'entreprise_industrie') {
                    if (categoryFilters.typeEntreprise && product.typeEntreprise !== categoryFilters.typeEntreprise) {
                        return false;
                    }
                    if (categoryFilters.secteurActivite && product.secteurActivite !== categoryFilters.secteurActivite) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR REPARATION
                if (product.type === 'reparation') {
                    if (categoryFilters.typeReparation && product.typeReparation !== categoryFilters.typeReparation) {
                        return false;
                    }
                    if (categoryFilters.specialiteReparation && product.specialiteReparation !== categoryFilters.specialiteReparation) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR RÉPARATEUR TÉLÉPHONE/TABLETTE
                if (product.type === 'reparateur_telephone_tablette' || product.type === 'reparateur_telephone' || product.type === 'reparation_telephone') {
                    // Filtre type de réparation (multiselect)
                    if (categoryFilters.typeReparation && Array.isArray(categoryFilters.typeReparation) && categoryFilters.typeReparation.length > 0) {
                        let productTypesReparation = [];
                        if (Array.isArray(product.typeReparation)) {
                            productTypesReparation = product.typeReparation;
                        } else if (typeof product.typeReparation === 'string') {
                            try {
                                productTypesReparation = JSON.parse(product.typeReparation);
                            } catch {
                                productTypesReparation = [product.typeReparation];
                            }
                        }

                        const hasTypeReparation = categoryFilters.typeReparation.some((typeRecherche: string) =>
                            productTypesReparation.some((type: string) => type.includes(typeRecherche) || typeRecherche.includes(type))
                        );
                        if (!hasTypeReparation) return false;
                    }

                    // Filtre marques supportées (multiselect)
                    if (categoryFilters.marquesSuppoortees && Array.isArray(categoryFilters.marquesSuppoortees) && categoryFilters.marquesSuppoortees.length > 0) {
                        let productMarques = [];
                        if (Array.isArray(product.marquesSuppoortees)) {
                            productMarques = product.marquesSuppoortees;
                        } else if (typeof product.marquesSuppoortees === 'string') {
                            try {
                                productMarques = JSON.parse(product.marquesSuppoortees);
                            } catch {
                                productMarques = [product.marquesSuppoortees];
                            }
                        }

                        const hasMarque = categoryFilters.marquesSuppoortees.some((marqueRecherche: string) =>
                            productMarques.some((marque: string) => marque.includes(marqueRecherche) || marqueRecherche.includes(marque))
                        );
                        if (!hasMarque) return false;
                    }

                    // Filtre délai de réparation
                    if (categoryFilters.delaisReparation && product.delaisReparation) {
                        if (!product.delaisReparation.includes(categoryFilters.delaisReparation)) return false;
                    }

                    // Filtre garantie réparation
                    if (categoryFilters.garantieReparation && product.garantieReparation) {
                        if (!product.garantieReparation.includes(categoryFilters.garantieReparation)) return false;
                    }

                    // Filtre qualité des pièces
                    if (categoryFilters.qualitePieces && product.qualitePieces) {
                        if (!product.qualitePieces.includes(categoryFilters.qualitePieces)) return false;
                    }

                    // Filtre type d'intervention (multiselect)
                    if (categoryFilters.typeIntervention && Array.isArray(categoryFilters.typeIntervention) && categoryFilters.typeIntervention.length > 0) {
                        let productTypesIntervention = [];
                        if (Array.isArray(product.typeIntervention)) {
                            productTypesIntervention = product.typeIntervention;
                        } else if (typeof product.typeIntervention === 'string') {
                            try {
                                productTypesIntervention = JSON.parse(product.typeIntervention);
                            } catch {
                                productTypesIntervention = [product.typeIntervention];
                            }
                        }

                        const hasTypeIntervention = categoryFilters.typeIntervention.some((typeRecherche: string) =>
                            productTypesIntervention.some((type: string) => type.includes(typeRecherche) || typeRecherche.includes(type))
                        );
                        if (!hasTypeIntervention) return false;
                    }

                    // Filtre certifications (multiselect)
                    if (categoryFilters.certifications && Array.isArray(categoryFilters.certifications) && categoryFilters.certifications.length > 0) {
                        let productCertifications = [];
                        if (Array.isArray(product.certifications)) {
                            productCertifications = product.certifications;
                        } else if (typeof product.certifications === 'string') {
                            try {
                                productCertifications = JSON.parse(product.certifications);
                            } catch {
                                productCertifications = [product.certifications];
                            }
                        }

                        const hasCertification = categoryFilters.certifications.some((certifRecherche: string) =>
                            productCertifications.some((certif: string) => certif.includes(certifRecherche) || certifRecherche.includes(certif))
                        );
                        if (!hasCertification) return false;
                    }

                    // Filtre services additionnels (multiselect)
                    if (categoryFilters.servicesAdditionnels && Array.isArray(categoryFilters.servicesAdditionnels) && categoryFilters.servicesAdditionnels.length > 0) {
                        let productServices = [];
                        if (Array.isArray(product.servicesAdditionnels)) {
                            productServices = product.servicesAdditionnels;
                        } else if (typeof product.servicesAdditionnels === 'string') {
                            try {
                                productServices = JSON.parse(product.servicesAdditionnels);
                            } catch {
                                productServices = [product.servicesAdditionnels];
                            }
                        }

                        const hasService = categoryFilters.servicesAdditionnels.some((serviceRecherche: string) =>
                            productServices.some((service: string) => service.includes(serviceRecherche) || serviceRecherche.includes(service))
                        );
                        if (!hasService) return false;
                    }

                    // Filtre états appareils acceptés (multiselect)
                    if (categoryFilters.etatAppareilAccepte && Array.isArray(categoryFilters.etatAppareilAccepte) && categoryFilters.etatAppareilAccepte.length > 0) {
                        let productEtats = [];
                        if (Array.isArray(product.etatAppareilAccepte)) {
                            productEtats = product.etatAppareilAccepte;
                        } else if (typeof product.etatAppareilAccepte === 'string') {
                            try {
                                productEtats = JSON.parse(product.etatAppareilAccepte);
                            } catch {
                                productEtats = [product.etatAppareilAccepte];
                            }
                        }

                        const hasEtat = categoryFilters.etatAppareilAccepte.some((etatRecherche: string) =>
                            productEtats.some((etat: string) => etat.includes(etatRecherche) || etatRecherche.includes(etat))
                        );
                        if (!hasEtat) return false;
                    }

                    // Filtres toggles
                    if (categoryFilters.specialisteIPhone === true) {
                        const hasSpecIPhone = product.certifications?.some((c: string) =>
                            c.includes('iPhone') || c.includes('Apple') || c.includes('ACMT')
                        );
                        if (!hasSpecIPhone) return false;
                    }

                    if (categoryFilters.serviceADomicile === true) {
                        const hasServiceDomicile = product.typeIntervention?.some((t: string) =>
                            t.includes('domicile') || t.includes('Domicile')
                        );
                        if (!hasServiceDomicile) return false;
                    }

                    if (categoryFilters.microSoudure === true) {
                        const hasMicroSoudure = product.typeReparation?.some((t: string) =>
                            t.includes('soudure') || t.includes('Micro-soudure')
                        ) || product.certifications?.some((c: string) =>
                            c.includes('soudure') || c.includes('micro-soudure')
                        );
                        if (!hasMicroSoudure) return false;
                    }

                    if (categoryFilters.piecesOriginales === true) {
                        if (!product.qualitePieces?.includes('originales') && !product.qualitePieces?.includes('Originales')) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR RÉPARATEUR INFORMATIQUE (Ordinateurs, Imprimantes)
                if (product.type === 'reparateur_informatique' || product.type === 'reparateur_ordinateur' || product.type === 'reparation_informatique') {
                    // Filtre types de réparation (multiselect)
                    if (categoryFilters.typesReparationInfo && Array.isArray(categoryFilters.typesReparationInfo) && categoryFilters.typesReparationInfo.length > 0) {
                        let productTypesReparation = [];
                        if (Array.isArray(product.typesReparationInfo)) {
                            productTypesReparation = product.typesReparationInfo;
                        } else if (typeof product.typesReparationInfo === 'string') {
                            try {
                                productTypesReparation = JSON.parse(product.typesReparationInfo);
                            } catch {
                                productTypesReparation = [product.typesReparationInfo];
                            }
                        }

                        const hasTypeReparation = categoryFilters.typesReparationInfo.some((typeRecherche: string) =>
                            productTypesReparation.some((type: string) => type.includes(typeRecherche) || typeRecherche.includes(type))
                        );
                        if (!hasTypeReparation) return false;
                    }

                    // Filtre marques ordinateurs supportées (multiselect)
                    if (categoryFilters.marquesOrdinateursReparees && Array.isArray(categoryFilters.marquesOrdinateursReparees) && categoryFilters.marquesOrdinateursReparees.length > 0) {
                        let productMarquesOrdinateurs = [];
                        if (Array.isArray(product.marquesOrdinateursReparees)) {
                            productMarquesOrdinateurs = product.marquesOrdinateursReparees;
                        } else if (typeof product.marquesOrdinateursReparees === 'string') {
                            try {
                                productMarquesOrdinateurs = JSON.parse(product.marquesOrdinateursReparees);
                            } catch {
                                productMarquesOrdinateurs = [product.marquesOrdinateursReparees];
                            }
                        }

                        const hasMarqueOrdinateur = categoryFilters.marquesOrdinateursReparees.some((marqueRecherche: string) =>
                            productMarquesOrdinateurs.some((marque: string) => marque.includes(marqueRecherche) || marqueRecherche.includes(marque))
                        );
                        if (!hasMarqueOrdinateur) return false;
                    }

                    // Filtre marques imprimantes supportées (multiselect)
                    if (categoryFilters.marquesImprimantesReparees && Array.isArray(categoryFilters.marquesImprimantesReparees) && categoryFilters.marquesImprimantesReparees.length > 0) {
                        let productMarquesImprimantes = [];
                        if (Array.isArray(product.marquesImprimantesReparees)) {
                            productMarquesImprimantes = product.marquesImprimantesReparees;
                        } else if (typeof product.marquesImprimantesReparees === 'string') {
                            try {
                                productMarquesImprimantes = JSON.parse(product.marquesImprimantesReparees);
                            } catch {
                                productMarquesImprimantes = [product.marquesImprimantesReparees];
                            }
                        }

                        const hasMarqueImprimante = categoryFilters.marquesImprimantesReparees.some((marqueRecherche: string) =>
                            productMarquesImprimantes.some((marque: string) => marque.includes(marqueRecherche) || marqueRecherche.includes(marque))
                        );
                        if (!hasMarqueImprimante) return false;
                    }

                    // Filtre types de pannes (multiselect)
                    if (categoryFilters.typesPannesReparees && Array.isArray(categoryFilters.typesPannesReparees) && categoryFilters.typesPannesReparees.length > 0) {
                        let productTypesPannes = [];
                        if (Array.isArray(product.typesPannesReparees)) {
                            productTypesPannes = product.typesPannesReparees;
                        } else if (typeof product.typesPannesReparees === 'string') {
                            try {
                                productTypesPannes = JSON.parse(product.typesPannesReparees);
                            } catch {
                                productTypesPannes = [product.typesPannesReparees];
                            }
                        }

                        const hasTypePanne = categoryFilters.typesPannesReparees.some((panneRecherche: string) =>
                            productTypesPannes.some((panne: string) => panne.includes(panneRecherche) || panneRecherche.includes(panne))
                        );
                        if (!hasTypePanne) return false;
                    }

                    // Filtre délai de réparation
                    if (categoryFilters.delaiReparationInfo && product.delaiReparationInfo) {
                        if (!product.delaiReparationInfo.includes(categoryFilters.delaiReparationInfo)) return false;
                    }

                    // Filtre garantie réparation
                    if (categoryFilters.garantieReparation && product.garantieReparation) {
                        if (!product.garantieReparation.includes(categoryFilters.garantieReparation)) return false;
                    }

                    // Filtre certifications (multiselect)
                    if (categoryFilters.certificationsInfo && Array.isArray(categoryFilters.certificationsInfo) && categoryFilters.certificationsInfo.length > 0) {
                        let productCertifications = [];
                        if (Array.isArray(product.certificationsInfo)) {
                            productCertifications = product.certificationsInfo;
                        } else if (typeof product.certificationsInfo === 'string') {
                            try {
                                productCertifications = JSON.parse(product.certificationsInfo);
                            } catch {
                                productCertifications = [product.certificationsInfo];
                            }
                        }

                        const hasCertification = categoryFilters.certificationsInfo.some((certifRecherche: string) =>
                            productCertifications.some((certif: string) => certif.includes(certifRecherche) || certifRecherche.includes(certif))
                        );
                        if (!hasCertification) return false;
                    }

                    // Filtre services additionnels (multiselect)
                    if (categoryFilters.servicesAdditionnelsInfo && Array.isArray(categoryFilters.servicesAdditionnelsInfo) && categoryFilters.servicesAdditionnelsInfo.length > 0) {
                        let productServices = [];
                        if (Array.isArray(product.servicesAdditionnelsInfo)) {
                            productServices = product.servicesAdditionnelsInfo;
                        } else if (typeof product.servicesAdditionnelsInfo === 'string') {
                            try {
                                productServices = JSON.parse(product.servicesAdditionnelsInfo);
                            } catch {
                                productServices = [product.servicesAdditionnelsInfo];
                            }
                        }

                        const hasService = categoryFilters.servicesAdditionnelsInfo.some((serviceRecherche: string) =>
                            productServices.some((service: string) => service.includes(serviceRecherche) || serviceRecherche.includes(service))
                        );
                        if (!hasService) return false;
                    }

                    // Filtre équipements atelier (multiselect)
                    if (categoryFilters.equipementsAtelierInfo && Array.isArray(categoryFilters.equipementsAtelierInfo) && categoryFilters.equipementsAtelierInfo.length > 0) {
                        let productEquipements = [];
                        if (Array.isArray(product.equipementsAtelierInfo)) {
                            productEquipements = product.equipementsAtelierInfo;
                        } else if (typeof product.equipementsAtelierInfo === 'string') {
                            try {
                                productEquipements = JSON.parse(product.equipementsAtelierInfo);
                            } catch {
                                productEquipements = [product.equipementsAtelierInfo];
                            }
                        }

                        const hasEquipement = categoryFilters.equipementsAtelierInfo.some((equipRecherche: string) =>
                            productEquipements.some((equip: string) => equip.includes(equipRecherche) || equipRecherche.includes(equip))
                        );
                        if (!hasEquipement) return false;
                    }

                    // Filtre type d'intervention (multiselect)
                    if (categoryFilters.typeIntervention && Array.isArray(categoryFilters.typeIntervention) && categoryFilters.typeIntervention.length > 0) {
                        let productTypesIntervention = [];
                        if (Array.isArray(product.typeIntervention)) {
                            productTypesIntervention = product.typeIntervention;
                        } else if (typeof product.typeIntervention === 'string') {
                            try {
                                productTypesIntervention = JSON.parse(product.typeIntervention);
                            } catch {
                                productTypesIntervention = [product.typeIntervention];
                            }
                        }

                        const hasTypeIntervention = categoryFilters.typeIntervention.some((typeRecherche: string) =>
                            productTypesIntervention.some((type: string) => type.includes(typeRecherche) || typeRecherche.includes(type))
                        );
                        if (!hasTypeIntervention) return false;
                    }

                    // Filtres toggles
                    if (categoryFilters.specialisteApple === true) {
                        const hasSpecApple = product.certificationsInfo?.some((c: string) =>
                            c.includes('Apple') || c.includes('ACMT') || c.includes('MacBook') || c.includes('Mac')
                        ) || product.marquesOrdinateursReparees?.some((m: string) =>
                            m.includes('Apple') || m.includes('MacBook') || m.includes('iMac')
                        );
                        if (!hasSpecApple) return false;
                    }

                    if (categoryFilters.interventionDomicile === true) {
                        const hasInterventionDomicile = product.typeIntervention?.some((t: string) =>
                            t.includes('domicile') || t.includes('Domicile') || t.includes('À domicile')
                        ) || product.interventionDomicile === true;
                        if (!hasInterventionDomicile) return false;
                    }

                    if (categoryFilters.supportDistance === true) {
                        const hasSupportDistance = product.typeIntervention?.some((t: string) =>
                            t.includes('distance') || t.includes('Distance') || t.includes('À distance')
                        ) || product.supportDistance === true;
                        if (!hasSupportDistance) return false;
                    }

                    if (categoryFilters.microSoudure === true) {
                        const hasMicroSoudure = product.typesReparationInfo?.some((t: string) =>
                            t.includes('soudure') || t.includes('Micro-soudure') || t.includes('micro-soudure')
                        ) || product.certificationsInfo?.some((c: string) =>
                            c.includes('soudure') || c.includes('micro-soudure')
                        ) || product.microSoudure === true;
                        if (!hasMicroSoudure) return false;
                    }

                    if (categoryFilters.recuperationDonnees === true) {
                        const hasRecuperationDonnees = product.typesReparationInfo?.some((t: string) =>
                            t.includes('Récupération') || t.includes('données') || t.includes('récupération données')
                        ) || product.certificationsInfo?.some((c: string) =>
                            c.includes('Récupération données') || c.includes('récupération')
                        ) || product.recuperationDonnees === true;
                        if (!hasRecuperationDonnees) return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PRESTATION_SERVICE
                if (product.type === 'prestation_service' || product.type === 'prestation' || product.type === 'service') {
                    if (categoryFilters.categorie && product.categoriePrestation !== categoryFilters.categorie) {
                        return false;
                    }
                    if (categoryFilters.experience !== undefined && product.experienceAnnees !== undefined) {
                        if (product.experienceAnnees < categoryFilters.experience) {
                            return false;
                        }
                    }
                    if (categoryFilters.certifie === true && !product.certifie) {
                        return false;
                    }
                    if (categoryFilters.deplacement === true && !product.deplacement) {
                        return false;
                    }
                    if (categoryFilters.disponibilite && product.disponibilitePrestation !== categoryFilters.disponibilite) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR CARRELAGE
                if (product.type === 'carrelage') {
                    if (categoryFilters.typeCarrelage && product.typeCarrelage !== categoryFilters.typeCarrelage) {
                        return false;
                    }
                    if (categoryFilters.materiauCarrelage && product.materiauCarrelage !== categoryFilters.materiauCarrelage) {
                        return false;
                    }
                    if (categoryFilters.dimensionsCarrelage && product.dimensionsCarrelage !== categoryFilters.dimensionsCarrelage) {
                        return false;
                    }
                    if (categoryFilters.finitionCarrelage && product.finitionCarrelage !== categoryFilters.finitionCarrelage) {
                        return false;
                    }
                    if (categoryFilters.usageCarrelage && product.usageCarrelage !== categoryFilters.usageCarrelage) {
                        return false;
                    }
                    if (categoryFilters.aspectCarrelage && Array.isArray(categoryFilters.aspectCarrelage) && categoryFilters.aspectCarrelage.length > 0) {
                        if (!Array.isArray(product.aspectCarrelage)) {
                            return false;
                        }
                        if (!categoryFilters.aspectCarrelage.some(aspect => product.aspectCarrelage.includes(aspect))) {
                            return false;
                        }
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR COIFFURE & BEAUTÉ
                if (product.type === 'coiffure_beaute') {
                    // Filtre type de coiffure/service
                    if (categoryFilters.typeCoiffure && product.typeCoiffure !== categoryFilters.typeCoiffure) {
                        return false;
                    }
                    // Filtre longueur (mèches)
                    if (categoryFilters.longueurMech && product.longueurMech !== categoryFilters.longueurMech) {
                        return false;
                    }
                    // Filtre texture
                    if (categoryFilters.textureMech && product.textureMech !== categoryFilters.textureMech) {
                        return false;
                    }
                    // Filtre type de cheveux
                    if (categoryFilters.typeCheveux && product.typeCheveux !== categoryFilters.typeCheveux) {
                        return false;
                    }
                    // Filtre origine
                    if (categoryFilters.origineMech && product.origineMech !== categoryFilters.origineMech) {
                        return false;
                    }
                    // Filtre marque
                    if (categoryFilters.marqueCoiffure && product.marqueCoiffure !== categoryFilters.marqueCoiffure) {
                        return false;
                    }
                    // Filtre couleur
                    if (categoryFilters.couleurMech && product.couleurMech !== categoryFilters.couleurMech) {
                        return false;
                    }
                    // Filtre type de pose
                    if (categoryFilters.typePose && product.typePose !== categoryFilters.typePose) {
                        return false;
                    }
                    // Filtre durée de vie
                    if (categoryFilters.dureeVie && product.dureeVie !== categoryFilters.dureeVie) {
                        return false;
                    }
                    // Filtre type de salon
                    if (categoryFilters.typeSalon && product.typeSalon !== categoryFilters.typeSalon) {
                        return false;
                    }
                    // Filtre services proposés (multiselect)
                    if (categoryFilters.servicesProposed && Array.isArray(categoryFilters.servicesProposed) && categoryFilters.servicesProposed.length > 0) {
                        const hasService = categoryFilters.servicesProposed.some((service: string) =>
                            product.servicesProposed?.includes(service)
                        );
                        if (!hasService) return false;
                    }
                    // Filtre spécialités (multiselect)
                    if (categoryFilters.specialites && Array.isArray(categoryFilters.specialites) && categoryFilters.specialites.length > 0) {
                        const hasSpecialite = categoryFilters.specialites.some((spec: string) =>
                            product.specialites?.includes(spec)
                        );
                        if (!hasSpecialite) return false;
                    }
                    // Filtre coiffure à domicile
                    if (categoryFilters.coiffureADomicile === true && !product.coiffureADomicile) {
                        return false;
                    }
                    // Filtre urgence disponible
                    if (categoryFilters.urgenceDisponible === true && !product.urgenceDisponible) {
                        return false;
                    }
                }

                // ✅ FILTRES GÉNÉRIQUES
                for (const [key, value] of Object.entries(categoryFilters)) {
                    if (value === null || value === undefined || value === '') continue;

                    // Ignorer les filtres déjà traités spécifiquement
                    const specialFilters = [
                        // Santé
                        'prestationsMedicales', 'jourDisponibilite', 'momentDisponibilite', 'banqueSang',
                        'urgencesDisponible', 'rdvEnLigne', 'typeEtablissement', 'ouvertMaintenant', 'consultationsSpecialisees',
                        'joursOuverture', 'servicesAnnexes', 'equipementsHopital',
                        'deGarde', 'jourGarde', 'typePharmacie', 'services',
                        'examensLaboratoire', 'typeLaboratoire', 'prelevementDomicile', 'resultatRapide',
                        // Immobilier (incluant location courte durée)
                        'statutImmobilier', 'typeImmobilier', 'standing', 'etatGeneral', 'ameublement',
                        'nbChambres', 'nbSallesBain', 'superficie', 'equipementsImmo', 'parking', 'ascenseur',
                        'disponibleImmediatement', 'titreFoncier',
                        'prixParNuit', 'dureeMinimum', 'dureeMaximum', 'nettoyageInclus', 'lingeInclus',
                        'capacitePersonnes', 'capacitePersonnes_min', 'capacitePersonnes_max',
                        'calendrierDispo', 'reservationInstantanee', 'ville', 'quartier', 'acces_route', 'proximites',
                        // Immobilier Terrain
                        'typeTerrain', 'viabilisation', 'zonage', 'topographie', 'accesTerrain', 'formeTerrain',
                        'vegetation', 'usageActuel', 'reseauxTerrain', 'natureSol', 'bornage', 'constructibilite', 'cloture',
                        // Automobile
                        'typeVehicule', 'typeCarrosserie', 'marqueAutomobile', 'modeleAutomobile', 'etatVehicule',
                        'annee', 'kilometrage', 'couleurAutomobile', 'typeCarburant', 'transmission',
                        'nbPortes', 'nbPlaces', 'puissance', 'cylindree', 'equipementsAuto',
                        'premiereMain', 'historiqueEntretien', 'contreTechnique', 'garantie', 'papiers',
                        'villeVehicule', 'quartierVehicule', 'localisationVehicule',
                        // Mobilier
                        'typeMobilier', 'categorieMobilier', 'styleMobilier', 'materiauMobilier', 'couleurMobilier',
                        'etatMobilier', 'nombrePlaces_min', 'nombrePlaces_max', 'livraison', 'demontable', 'montageRequis',
                        // Électroménager
                        'typeElectro', 'categorieElectro', 'marqueElectro', 'etatElectro', 'consommationEnergetique',
                        'couleurElectro', 'anneeAchat_min', 'anneeAchat_max', 'capacite_min', 'capacite_max',
                        'fonctionnalites', 'garantieConstructeur', 'facture', 'manuel',
                        // Alimentation
                        'categorieAliment', 'typeAliment', 'origine', 'conditionnement', 'conservation', 'uniteMesure',
                        'stockDisponible_min', 'stockDisponible_max', 'bio', 'labelQualite', 'certifications',
                        // Smartphone
                        'marqueTelephone', 'modeleTelephone', 'stockage', 'ram', 'etatTelephone', 'couleurTelephone',
                        'operateur', 'anneeAchatTelephone', 'anneeAchatTelephone_min', 'anneeAchatTelephone_max',
                        'imei', 'garantieTelephone', 'batterieSante', 'tailleEcran', 'numeroCameraPrincipale',
                        'numeroCameraFrontale', 'typeEcran', 'batterie', 'reparations',
                        'accessoiresTelephone', 'connectivite5G', 'dualSim', 'nfc', 'chargementRapide',
                        'chargementSansFil', 'boiteOriginale', 'factureTelephone', 'ecranOriginal',
                        'garantieConstructeurTelephone', 'etancheite',
                        // Ordinateur
                        'typeOrdinateur', 'marqueOrdinateur', 'modeleOrdinateur', 'processeur', 'ramOrdinateur',
                        'stockageOrdinateur', 'carteGraphique', 'systemeExploitation', 'etatOrdinateur',
                        'anneeAchatOrdinateur', 'anneeAchatOrdinateur_min', 'anneeAchatOrdinateur_max',
                        'usage', 'tailleEcranOrdinateur', 'resolutionOrdinateur', 'typeEcranOrdinateur',
                        'frequenceProcesseur', 'typeSSD', 'lecteurOptique', 'clavier', 'webcam',
                        'touchscreen', 'wifi', 'portUSBC', 'portHDMI', 'bluetooth',
                        'garantieOrdinateur', 'garantieConstructeurOrdinateur', 'factureOrdinateur',
                        'boiteOriginaleOrdinateur', 'accessoiresOrdinateur', 'logicielsInclus',
                        // Textile (Vêtement)
                        'typeVetement', 'genreVetement', 'taille', 'couleurVetement', 'matiereVetement',
                        'marqueVetement', 'etatVetement', 'styleVetement', 'saisonVetement', 'origineVetement',
                        'lavable', 'patronVetement', 'coupeVetement', 'longueurVetement', 'collectionVetement',
                        'certifieVetement',
                        // Restauration
                        'typeCuisine', 'typeRestaurant', 'servicesRestau', 'gammePrix', 'capaciteRestaurant',
                        'capaciteRestaurant_min', 'capaciteRestaurant_max', 'horairesRestaurant', 'ambiance',
                        'chefNom', 'menuJour', 'cartePlats', 'regimesSpeciaux', 'livraison', 'terrasse',
                        'parking', 'wifi', 'reservation', 'adresseRestaurant', 'ouvertMaintenant',
                        // Musique & Instruments
                        'typeInstrument', 'categorieInstrument', 'marqueInstrument', 'modeleInstrument',
                        'etatInstrument', 'anneeInstrument', 'anneeInstrument_min', 'anneeInstrument_max',
                        'materiauInstrument', 'couleurInstrument', 'tailleInstrument', 'nombreCordes',
                        'typeAmplification', 'puissanceAmpli', 'accessoiresInclus', 'garantieInstrument',
                        'facture', 'revisionRecente', 'origineInstrument',
                        // Chaussure
                        'typeChaussure', 'pointure', 'couleurChaussure', 'marqueChaussure', 'materiauChaussure',
                        'etatChaussure', 'genreChaussure', 'usageChaussure',
                        // Livres & Fournitures
                        'categorieLivre', 'niveau', 'matiereScolaire', 'auteur', 'editeur', 'isbn',
                        'anneeEdition', 'etatLivre', 'langue',
                        // Covoiturage
                        'villeDepart', 'villeArrivee', 'pointDepart', 'pointArrivee', 'dateTrajet', 'heureTrajet', 'nbPlacesDisponibles',
                        'nbPlacesDisponibles_min', 'nbPlacesDisponibles_max', 'vehiculeInfo', 'preferencesTrajet', 'prixParPlace', 'typeVehiculeCovoiturage', 'frequenceTrajet',
                        // Evenementiel
                        'typeEvenement', 'capaciteEvenement', 'servicesEvenement', 'dureeEvenement',
                        'equipementsEvenement', 'tarifEvenement', 'localisationEvenement',
                        // Voyage & Tourisme
                        'typeVoyage', 'destinationVoyage', 'dureeVoyage', 'servicesVoyage', 'hebergementVoyage',
                        // Demenagement
                        'typeDemenagement', 'volumeDemenagement', 'servicesDemenagement', 'typeVehiculeDemenagement',
                        'distanceDemenagement', 'villeDepartDemenagement', 'villeArriveeDemenagement', 'trajetDemenagement',
                        'compagnieDemenagement', 'dureeDemenagement', 'disponibiliteDemenagement', 'typeAssuranceDemenagement',
                        'nbDemenageurs', 'accessibiliteDemenagement',
                        // Plomberie
                        'typePrestation', 'typePlomberie', 'urgence', 'urgence24h', 'specialitesPlomberie', 'equipementsPlomberie',
                        'disponibilitePlomberie', 'garantiePlomberie', 'garantieTravaux', 'devisGratuit', 'zonesInterventionPlombier',
                        // Nettoyage
                        'typeNettoyage', 'frequenceNettoyage', 'servicesNettoyage', 'produitsBio',
                        // Assurance
                        'typeAssurance', 'compagnieAssurance', 'typeCouverture', 'dureeContrat', 'franchiseAssurance',
                        // Électricien (service)
                        'typeElectricien', 'specialitesElectricien', 'equipementsElectricien', 'disponibiliteElectricien',
                        'garantieElectricien', 'urgence24hElec', 'devisGratuitElec', 'certificationsElectricien', 'zonesInterventionElectricien',
                        'zonesInterventionElectricienAuto',
                        // Electricite (produit)
                        'categorieElectrique', 'typeElectricite', 'marqueElectricite', 'tensionElectrique',
                        'puissanceElectrique', 'culotAmpoule', 'couleurLumiere', 'normesElectrique',
                        'etatElectrique', 'utilisationElectrique', 'garantieElectrique',
                        // Image & Son
                        'categorieImageSon', 'typeImageSon', 'marqueImageSon', 'technologieEcran', 'resolution',
                        'diagonaleEcran', 'modeleImageSon', 'etatImageSon', 'garantieImageSon', 'connectivitesImageSon',
                        'fonctionnalitesImageSon', 'puissanceAudio', 'anneeSortie', 'accessoiresImageSon',
                        // Sport & Loisirs
                        'typeSport', 'categorieSport', 'niveauSport', 'dureeSport', 'serviceSport',
                        'objectifSport', 'horairesSport', 'joursSport', 'equipementsSport',
                        // Bricolage
                        'typeBricolage', 'categorieBricolage', 'marqueBricolage', 'etatBricolage',
                        'puissanceBricolage', 'garantieBricolage',
                        // Enfants & Bebes
                        'categorieEnfant', 'ageRecommande', 'etatEnfant', 'securiteNorme',
                        // Decoration
                        'categorieDecoration', 'styleDecoration', 'pieceDecoration', 'matiereDecoration',
                        'couleurDecoration', 'tailleDecoration', 'etatDecoration', 'marqueDecoration',
                        'dimensionsDecoration', // Legacy
                        'typeDecoration', 'materiauDecoration',
                        // Jouets Enfants
                        'typeJouet', 'ageJouet', 'etatJouet', 'normeSecurite', 'ageRecommande', 'marqueJouet',
                        // Ustensiles Cuisine
                        'typeUstensile', 'materiauUstensile', 'marqueUstensile', 'capaciteUstensile',
                        // Quincaillerie
                        'categorieQuincaillerie', 'marqueQuincaillerie', 'referenceQuincaillerie', 'unite', 'stockDisponible',
                        // Cosmetique & Parfum (ancien format)
                        'typeCosmetique', 'marqueCosmetique', 'volumeCosmetique', 'uniteCosmetique', 'genreCosmetique',
                        'concentrationCosmetique', 'typePeau', 'typeCheveuxCosmetique', 'teinteCosmetique', 'finitionCosmetique',
                        'origineCosmetique', 'ingredientsCosmetique', 'certificationsCosmetique',
                        // Cosmetique & Parfum (nouveau format - synchro modalités)
                        'types', 'marques', 'genres', 'concentrations', 'types_peau', 'types_cheveux', 'teintes',
                        'finitions', 'origines', 'certifications', 'ingredients_principaux', 'unites',
                        // Pieces Auto (tous les champs)
                        'typePieceAuto', 'categoriePieceAuto', 'marquePieceAuto', 'marqueVehiculeCompatible', 'modeleVehicule',
                        'etatPieceAuto', 'originePiece', 'garantiePiece', 'niveauCompatibilite', 'materiauPiece',
                        'typeFournisseur', 'referencePieceAuto', 'compatibilitePieceAuto', 'avecReference', 'livraisonDisponible',
                        // Pieces Industrielles
                        'typePieceIndustrielle', 'marquePieceIndustrielle', 'referencePieceIndustrielle',
                        // Electronique
                        'typeElectronique', 'marqueElectronique', 'etatElectronique',
                        // Menuiserie & Ébénisterie
                        'serviceMenuiserie', 'typeBois', 'finitionsMenuiserie', 'styleMenuiserie', 'experienceMenuisier', 'certificationMenuisier', 'delaiMenuiserie', 'atelierMenuiserie', 'garantieMenuiserie', 'paiementMenuiserie', 'equipementAtelier', 'zonesInterventionMenuisier',
                        // Maçonnerie
                        'typeMacon', 'specialitesMacon', 'materiauxMacon', 'equipementsMacon', 'zonesInterventionMacon',
                        // Carreleur
                        'typeCarreleur', 'specialitesCarreleur', 'materiauxCarreleur', 'zonesInterventionCarreleur',
                        // Peintre
                        'typePeinture', 'specialitesPeintre', 'surfacesPeintre', 'zonesInterventionPeintre',
                        // Staffeur
                        'zonesInterventionStaffeur',
                        // Réparateurs divers
                        'zonesInterventionClimatiseur', 'zonesInterventionFrigoriste', 'zonesInterventionElectromenager', 'zonesInterventionElectronique',
                        'zonesInterventionMoto',
                        // Agriculture
                        'typeAgricole', 'culture', 'saisonAgricole', 'uniteVente', 'certificationsAgricole', 'localisationAgricole',
                        // Securite & Surveillance (22 filtres complets)
                        'typeServiceSecurite', 'typeClientSecurite', 'disponibiliteSecurite', 'typeCameraSecurite',
                        'resolutionCamera', 'stockageVideo', 'typeAlarme', 'controleAcces', 'nombreAgents',
                        'armementAgents', 'certificationsSecurite', 'dureeContratSecurite', 'interventionRapide',
                        'service24h7j', 'telesurveillance', 'installationIncluse', 'maintenanceIncluse', 'devisGratuit',
                        'garantieEquipement', 'marquesEquipements', 'alimentationElectrique', 'applicationMobile',
                        // Animaux & Veterinaire
                        'typeAnimal', 'raceAnimal', 'servicesVeterinaire', 'tarifVeterinaire',
                        // Agroalimentaire (en plus de aliments)
                        'typeAgro', 'origine', 'certificationAgro',
                        // Sante & Beaute
                        'typeProduitBeaute', 'marqueBeaute', 'bio', 'volumeBeaute',
                        // Juridique
                        'typeServiceJuridique', 'specialiteJuridique', 'experienceAvocat', 'tarifHoraire',
                        // Musique Services
                        'typeServiceMusical', 'genreMusical', 'dureePrestation', 'materielInclus',
                        // Photographie
                        'typePhotoService', 'stylePhoto', 'equipementPhoto', 'retouchesIncluses',
                        // Entreprise & Industrie
                        'typeEntreprise', 'secteurActivite', 'certification', 'etatMateriel',
                        // Bien-etre
                        'typeBienEtre', 'dureeBienEtre', 'servicesBienEtre', 'clienteleBienEtre', 'tarifsParCategorie', 'formulesSpa', 'specialitesBienEtre', 'horairesSpa',
                        // Prestation Service
                        'categoriePrestation', 'typePrestation', 'dureePrestation', 'zoneIntervention',
                        'experienceAnnees', 'certifie', 'deplacement', 'disponibilitePrestation',
                        'imagesRealisations', 'videosRealisations', 'titreService', 'descriptionService',
                        // Bijoux
                        'typeBijou', 'materiauBijou', 'poidsBijou', 'certificat',
                        // Juridique
                        'typeServiceJuridique', 'domaineJuridique', 'tarificationJuridique',
                        // Musique (services)
                        'typeServiceMusical', 'genreMusical', 'dureePrestation',
                        // Photographie
                        'typePhotoService', 'stylePhoto', 'equipementPhoto',
                        // Entreprise & Industrie
                        'typeEntreprise', 'secteurActivite', 'certification',
                        // Reparation
                        'typeReparation', 'specialiteReparation', 'garantieReparation', 'marqueReparation',
                        'delaiReparation', 'diagnosticGratuit', 'deplacementInclus', 'piecesOrigine',
                        // Carrelage
                        'typeCarrelage', 'materiauCarrelage', 'dimensionsCarrelage', 'finitionCarrelage',
                        'epaisseurCarrelage', 'usageCarrelage', 'aspectCarrelage', 'couleurCarrelage',
                        'surfaceDisponible', 'origineCarrelage',
                        // Ticket Voyage
                        'compagnie', 'compagnieTransport', 'typeVehiculeTransport', 'classeVoyage',
                        'depart', 'destination', 'dateDepart', 'heureDepart', 'numeroPlace',
                        'dureeTrajet', 'escales', 'bagage', 'repas', 'wifi', 'prixEnfant',
                        'prixBebe', 'remboursable', 'modifiable', 'assuranceVoyage', 'numeroBillet',
                        'codeReservation',
                        // Transport Intra-Urbain
                        'villeService', 'quartierService', 'categorieService', 'disponibilite', 'tarifBase',
                        'optionsConfort', 'modePaiement', 'etatVehicule', 'languesChauffeur',
                        // Mécanicien & Garage
                        'nomGarage', 'typeServiceMecanique', 'specialitesGarage', 'marquesVehicules', 'typesVehiculesMeca',
                        'certificationsMeca', 'horairesGarage', 'delaisIntervention', 'urgenceMeca', 'zonesInterventionMeca',
                        'equipementsGarage', 'servicesComplementaires', 'modesPaiement', 'devisGratuit', 'garantieReparations',
                        // Emploi
                        'posteOffre', 'typeContrat', 'domaineActivite', 'niveauExperience',
                        'salaireMin', 'salaireMax', 'salaireMin_min', 'salaireMax_max', 'deviseOffre',
                        'lieuTravail', 'typeEmploi', 'competencesRequises', 'diplomeRequis',
                        'languesRequises', 'avantages', 'horaires', 'dateDebut', 'dureeContrat',
                        'descriptionPoste', 'profilRecherche', 'teletravail',
                        // Formation
                        'domaineFormation', 'typeFormation', 'niveauFormation', 'modeFormation',
                        'dureeFormation', 'prixFormation', 'prixFormation_min', 'prixFormation_max',
                        'certificationFormation', 'dateDebutFormation', 'prerequis', 'objectifs',
                        'programme', 'formateurNom', 'horairesFormation', 'langueEnseignement',
                        'matieresFormation', 'nombrePlaces',
                        // Hotellerie
                        'categorieHotel', 'typeHebergement', 'nbChambresHotel', 'nbChambresHotel_min',
                        'nbChambresHotel_max', 'typesChambre', 'prixParNuit', 'prixParNuit_min',
                        'prixParNuit_max', 'deviseHotel', 'equipementsHotel', 'servicesHotel',
                        'petitDejeuner', 'restaurantHotel', 'bar', 'piscine', 'spa', 'parking',
                        'wifi', 'salleReunion', 'adresseHotel', 'villeHotel', 'zoneHotel', 'gpsHotel', 'noteHotel', 'nomEtablissementHotel', 'pensionHotel', 'politiquesHotel', 'languesHotel'
                    ];

                    if (specialFilters.includes(key)) {
                        continue;
                    }

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
    }, [products, categoryFilters, priceFilter, sortBy]); // ✅ Dépendances optimisées

    // ✅ Fonction wrapper pour compatibilité avec l'ancien code
    const filterProducts = (productsList: any[]): any[] => {
        // Si la liste fournie est différente de products, filtrer normalement
        if (productsList !== products) {
            let filtered = [...productsList];
            // Appliquer les mêmes filtres (code simplifié pour compatibilité)
            if (Object.keys(categoryFilters).length > 0) {
                filtered = filtered.filter(product => {
                    for (const [key, value] of Object.entries(categoryFilters)) {
                        if (product[key] && product[key] !== value) return false;
                    }
                    return true;
                });
            }
            return filtered;
        }
        // Sinon utiliser le memo
        return filteredProductsMemo;
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

        // ✅ NOUVEAU: Tri intelligent avec gestion des variantes
        filteredServices.sort((a, b) => {
            switch (sortBy) {
                case 'price_asc': {
                    // Tri ascendant: utiliser le prix MIN de chaque produit (variantes incluses)
                    const priceA = getServicePrice(a, 'min') || Infinity;
                    const priceB = getServicePrice(b, 'min') || Infinity;
                    return priceA - priceB;
                }
                case 'price_desc': {
                    // Tri descendant: utiliser le prix MAX de chaque produit (variantes incluses)
                    const priceA = getServicePrice(a, 'max') || 0;
                    const priceB = getServicePrice(b, 'max') || 0;
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
                    // ✅ CORRECTION: Gérer structure {valeur: [...]} ET array direct
                    const serviceProduits = service.data?.produits?.valeur || service.data?.produits || [];
                    if (Array.isArray(serviceProduits)) {
                        serviceProduits.forEach((product: any, productIndex: number) => {
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

                            // ✅ Calculer le score de priorité pour produits en promotion
                            let finalScore = service.score || 0;
                            const isPromo = product.en_promotion || product.promotion_active;

                            if (isPromo) {
                                // Bonus significatif pour produits en publicité
                                finalScore += 100; // Forte priorité pour affichage
                            }

                            extractedProducts.push({
                                ...product,
                                _serviceId: service.id,
                                _service: service,
                                _prestataire: prestataires.get(service.user_id),
                                _gps: bestGPS,
                                _gpsSource: productGPS ? 'product' : (serviceGPSFixe ? 'service_fixe' : 'service_realtime'),
                                _productIndex: productIndex, // ✅ NOUVEAU: Passer l'index du produit pour API media
                                distance: distance,
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
            setPrestataires(newPrestataires);
            setPrestatairesLoaded(true);
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des prestataires:', error);
            setPrestatairesLoaded(true); // Marquer comme chargé même en cas d'erreur
        }
    };

    // ❌ SUPPRIMÉ: Fallback inutile car l'endpoint n'existe pas
    // Le vrai problème est que la recherche ne retourne rien
    // Il faut débugger la recherche elle-même, pas créer un fallback

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
                    // ✅ CORRECTION: Afficher un message clair si aucun résultat
                    console.log('⚠️ Aucun résultat de recherche fourni');
                    console.warn('❌ PROBLÈME: La recherche n\'a retourné aucun résultat');
                    console.warn('❌ Vérifiez que :');
                    console.warn('   1. Il y a des services actifs en base PostgreSQL');
                    console.warn('   2. Les services ont des embeddings vectoriels (pgvector)');
                    console.warn('   3. La recherche /api/search/direct fonctionne correctement');

                    setError('Aucun résultat trouvé. Vérifiez que des services existent en base de données.');
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

                // ✅ OPTIMISATION 6: Track le contact
                const product = products.find(p => p._service?.id === foundService.id);
                if (product) {
                    trackProductContact(product.id || foundService.id, dominantCategory, 'message', prestataireId);
                }
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

                                    // ✅ OPTIMISATION 6: Track le contact WhatsApp
                                    const product = products.find(p => p._service?.id === foundService?.id);
                                    if (product) {
                                        trackProductContact(product.id || foundService.id, dominantCategory, 'whatsapp', prestataireId);
                                    }

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

    // Fonction de recherche (identique à HomeScreen)
    const handleSearch = async (input: any) => {
        try {
            // Vérifier l'authentification
            if (!user) {
                Alert.alert('Erreur d\'authentification', 'Vous devez être connecté pour effectuer une recherche');
                return;
            }

            setLoading(true);
            console.log('[ResultatBesoinScreen] Recherche avec:', input);

            // Utiliser yukpoclient (comme le frontend)
            let rechercherServices;
            try {
                const yukpoclientModule = await import('../lib/yukpoclient');
                rechercherServices = yukpoclientModule.rechercherServices;
            } catch (error) {
                console.error('[ResultatBesoinScreen] Erreur import yukpoclient:', error);
                Alert.alert('Erreur', 'Service de recherche temporairement indisponible');
                setLoading(false);
                return;
            }

            const result = await rechercherServices(input);
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

    // Fonction pour confirmer le paiement complet et générer le ticket PDF
    const confirmBusReservation = async (reservationId: string, reservation: any) => {
        try {
            const product = reservation.product;
            const totalPrice = parseInt(product.prix);
            const cautionPaid = reservation.cautionAmount || 500;
            const remainingToPay = totalPrice - cautionPaid;

            // Vérifier le solde
            if (!user || user.tokens_balance < remainingToPay) {
                Alert.alert(
                    'Solde insuffisant',
                    `Montant restant: ${remainingToPay} FCFA\nSolde: ${user?.tokens_balance || 0} FCFA`,
                    [
                        { text: 'Recharger', onPress: () => navigation.navigate('RechargeTokens') },
                        { text: 'Annuler' }
                    ]
                );
                return;
            }

            // Générer le ticket PDF
            const ticketData = {
                reservationId,
                passengerName: reservation.passengerName,
                seatNumber: reservation.seatNumber,
                compagnie: product.compagnieTransport || 'Compagnie de Transport',
                logoAgence: product.logoAgence,
                numeroBus: product.numeroBus || 'N/A',
                depart: product.depart,
                destination: product.destination,
                dateDepart: product.dateDepart,
                heureDepart: product.heureDepart,
                classeVoyage: product.classeVoyage,
                prix: totalPrice,
                devise: product.devise || 'FCFA',
                cautionPaid,
                totalPaid: totalPrice,
                escales: product.escales,
                conditionsVoyage: product.conditionsVoyage,
                qrCodeData: reservationId
            };

            const pdfUri = await generateAndDownloadTicket(ticketData);

            // Appeler l'API pour confirmer
            await apiPost('/bus-reservations/confirm', {
                reservation_id: reservationId,
                total_price: totalPrice,
                ticket_pdf_url: pdfUri
            });

            // Proposer de partager le ticket
            Alert.alert(
                '✅ Voyage confirmé!',
                `Votre ticket a été généré avec succès.\n\nPassager: ${reservation.passengerName}\nPlace: ${reservation.seatNumber}\nTrajet: ${product.depart} → ${product.destination}`,
                [
                    {
                        text: 'Partager le ticket',
                        onPress: () => shareTicketPDF(pdfUri, reservation.passengerName)
                    },
                    { text: 'OK' }
                ]
            );
        } catch (error) {
            console.error('Erreur confirmation réservation:', error);
            Alert.alert('Erreur', 'Impossible de confirmer la réservation');
        }
    };

    // Composant ServiceResultCard amélioré
    // Composant de rendu pour chaque produit
    const ProductCardComponent = ({ product }: { product: any }) => {
        const service = product._service;
        const prestataire = product._prestataire || prestataires.get(service.user_id) || null;

        // ✅ NOUVEAU: Préparer la localisation utilisateur pour ProductCard
        const userLocationForCard = location ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
        } : null;

        return (
            <ProductCard
                product={product}
                service={service}
                prestataire={prestataire}
                userLocation={userLocationForCard} // ✅ NOUVEAU: Passer la localisation
                onPress={async () => {
                    setSelectedProduct(product);
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);

                    // ✅ OPTIMISATION 6: Track la visualisation du produit
                    await trackProductView(
                        product.id || product.nom,
                        product.type || dominantCategory,
                        dominantCategory,
                        prestataire?.id || service.user_id
                    );
                }}
                onChatPress={async () => {
                    setSelectedProduct(product);
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                    setShowChatModal(true);

                    // ✅ OPTIMISATION 6: Track le contact via chat
                    await trackProductContact(
                        product.id || product.nom,
                        dominantCategory,
                        'message',
                        prestataire?.id || service.user_id
                    );
                }}
                onGalleryPress={() => {
                    setSelectedProduct(product);
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                    setShowGalleryModal(true);
                }}
                onBookSeat={() => {
                    setSelectedProduct(product);
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                    setShowSeatSelector(true);
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
                onShare={async (service) => {
                    try {
                        const deepLink = `yukpomnang://service/${service.id}`;
                        const webLink = `https://yukpomnang.com/service/${service.id}`;

                        const shareMessage = `🏢 ${service.data?.titre_service?.valeur || service.titre || 'Service'}\n\n` +
                            `${service.data?.description?.valeur || service.description || ''}\n\n` +
                            `👤 Par: ${prestataires.get(service.user_id)?.nom_structure || 'Prestataire'}\n\n` +
                            `📱 Voir dans l'app: ${deepLink}\n` +
                            `🌐 Voir en ligne: ${webLink}`;

                        await Share.share({
                            message: shareMessage,
                            title: `Découvrez: ${service.data?.titre_service?.valeur || service.titre}`,
                            url: webLink,
                        });
                    } catch (error) {
                        console.error('Erreur partage service:', error);
                    }
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

            {/* 🔍 Barre de recherche simple et horizontale */}
            <View style={styles.searchContainer}>
                <SearchBar
                    placeholder="Affiner votre recherche..."
                    onSubmit={async (query) => {
                        // Convertir la chaîne en objet comme HomeScreen
                        const input = { texte: query };
                        await handleSearch(input);
                    }}
                    showSendButton={true}
                />
            </View>

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
                <ScrollView style={styles.skeletonContainer}>
                    {/* ✅ OPTIMISATION 8: Skeleton Loaders pendant chargement */}
                    <ProductCardSkeleton />
                    <ProductCardSkeleton />
                    <ProductCardSkeleton />
                    <ProductCardSkeleton />
                    <View style={styles.skeletonInfo}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={styles.skeletonInfoText}>Chargement des prestataires...</Text>
                    </View>
                </ScrollView>
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
                                            // ✅ CORRECTION: Compter UNIQUEMENT les produits (pas les services)
                                            const filteredProducts = filterProducts(products);
                                            const total = filteredProducts.length;
                                            const originalTotal = products.length;
                                            return `${total} produit${total > 1 ? 's' : ''}${total !== originalTotal ? ` sur ${originalTotal}` : ''}`;
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

                    {/* Modal de filtres de catégorie - AMÉLIORÉ */}
                    <CategoryFilters
                        category={dominantCategory}
                        visible={showCategoryFilters}
                        onClose={() => setShowCategoryFilters(false)}
                        onApply={async (filters) => {
                            setCategoryFilters(filters);

                            // ✅ AMÉLIORATION: Sauvegarder dans l'historique
                            const filteredResults = filterProducts(products);
                            await saveFilterToHistory(dominantCategory, filters, filteredResults.length);

                            // Recharger l'historique
                            const updatedHistory = await getFilterHistory(dominantCategory);
                            setFilterHistory(updatedHistory);

                            console.log(`✅ Filtres appliqués: ${Object.keys(filters).length} filtres → ${filteredResults.length} résultats`);
                        }}
                        initialFilters={categoryFilters}
                        smartSuggestions={smartSuggestions}
                        filterHistory={filterHistory}
                    />

                    {/* ✅ OPTIMISATION 2: FlatList avec lazy loading pour performance */}
                    {(() => {
                        // ✅ CORRECTION: Afficher UNIQUEMENT les produits (pas les services)
                        const filteredProducts = filterProducts(products);

                        return filteredProducts.length > 0 ? (
                            <FlatList
                                data={filteredProducts}
                                keyExtractor={(item, index) => `product-${normalizeProduct(item).id}-${index}`}
                                renderItem={({ item }) => {
                                    const product = normalizeProduct(item);
                                    return (
                                        <ProductCardErrorBoundary
                                            productId={product.id}
                                            onError={(error) => {
                                                console.error(`ProductCard Error for ${product.id}:`, error);
                                            }}
                                        >
                                            <ProductCardComponent product={product} />
                                        </ProductCardErrorBoundary>
                                    );
                                }}
                                // ✅ Optimisations performance
                                windowSize={5}
                                maxToRenderPerBatch={10}
                                initialNumToRender={5}
                                removeClippedSubviews={true}
                                updateCellsBatchingPeriod={50}
                                // ✅ Pull to refresh
                                refreshControl={
                                    <RefreshControl
                                        refreshing={refreshing}
                                        onRefresh={onRefresh}
                                        colors={[categoryStyle.primaryColor]}
                                        tintColor={categoryStyle.primaryColor}
                                    />
                                }
                                // ✅ État vide
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <SafeIcon name="package" size={48} color="#D1D5DB" />
                                        <Text style={styles.emptyStateText}>Aucun résultat trouvé</Text>
                                        <Text style={styles.emptyStateSubtext}>
                                            {Object.keys(categoryFilters).length > 0
                                                ? 'Essayez de modifier vos filtres'
                                                : 'Essayez de modifier votre recherche'}
                                        </Text>
                                    </View>
                                }
                                // ✅ Footer
                                ListFooterComponent={
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
                                }
                                contentContainerStyle={styles.flatListContent}
                            />
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
                        );
                    })()}
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

            {/* Seat Selector Modal pour ticket_voyage */}
            {selectedProduct && selectedProduct.type === 'ticket_voyage' && selectedProduct.seatMap && (
                <BusSeatSelector
                    visible={showSeatSelector}
                    onClose={() => setShowSeatSelector(false)}
                    busConfiguration={selectedProduct.busConfiguration || { rows: 12, seatsPerRow: 4, aislePosition: 2, firstRowSeats: 2 }}
                    seatMap={selectedProduct.seatMap || []}
                    product={selectedProduct}
                    multipleMode={true}
                    currentUserId={user?.id}
                    onSelectSeat={async (seatsData, returnTripData) => {
                        const reservations = Array.isArray(seatsData) ? seatsData.map(seat => ({ seat, passengerName: seat.passengerName })) : [{ seat: seatsData, passengerName: seatsData.passengerName }];
                        try {
                            const ticketPrice = parseInt(selectedProduct.prix);
                            const nbPlaces = reservations.length;
                            const totalAmount = ticketPrice * nbPlaces;

                            // Vérifier le solde (paiement complet immédiat)
                            if (!user || !user.tokens_balance || user.tokens_balance < totalAmount) {
                                // Sauvegarder le contexte de réservation pour retour après recharge
                                const reservationContext = {
                                    productId: selectedProduct.id,
                                    productName: selectedProduct.nom,
                                    reservations: reservations.map(r => ({
                                        seatId: r.seat.id,
                                        seatNumber: r.seat.number,
                                        passengerName: r.passengerName
                                    })),
                                    totalAmount,
                                    ticketPrice,
                                    returnScreen: 'ResultatBesoin',
                                    timestamp: Date.now()
                                };

                                // Sauvegarder dans AsyncStorage
                                try {
                                    const AsyncStorage = await import('@react-native-async-storage/async-storage').then(m => m.default);
                                    await AsyncStorage.setItem('@yukpomnang:pending_bus_reservation', JSON.stringify(reservationContext));
                                    console.log('✅ Contexte réservation sauvegardé');
                                } catch (error) {
                                    console.error('Erreur sauvegarde contexte:', error);
                                }

                                // Redirection AUTOMATIQUE vers recharge (pas de choix Annuler)
                                Alert.alert(
                                    '💰 Rechargez votre compte',
                                    `Montant requis: ${totalAmount.toLocaleString()} FCFA\n(${nbPlaces} place${nbPlaces > 1 ? 's' : ''} × ${ticketPrice.toLocaleString()} FCFA)\n\nSolde actuel: ${user?.tokens_balance || 0} FCFA\n\n✅ Après recharge, vous reviendrez automatiquement à cette réservation.`,
                                    [
                                        {
                                            text: 'Recharger maintenant',
                                            onPress: () => {
                                                navigation.navigate('RechargeTokens', {
                                                    returnTo: 'ResultatBesoin',
                                                    minAmount: totalAmount,
                                                    reason: 'bus_reservation'
                                                });
                                            }
                                        }
                                    ]
                                );
                                return;
                            }

                            // Confirmer le paiement complet
                            const passengersList = reservations.map(r => `- Place ${r.seat.number}: ${r.passengerName}`).join('\n');

                            Alert.alert(
                                '🎫 Confirmer la réservation',
                                `${nbPlaces} place${nbPlaces > 1 ? 's' : ''} à réserver:\n\n${passengersList}\n\n💰 Montant total: ${totalAmount.toLocaleString()} FCFA\n✅ Paiement complet immédiat\n📄 Tickets PDF générés instantanément\n\n🏢 Vous pourrez aussi retirer vos tickets physiques à l'agence avec une pièce d'identité valide.`,
                                [
                                    { text: 'Annuler', style: 'cancel' },
                                    {
                                        text: 'Payer et obtenir tickets',
                                        onPress: async () => {
                                            try {
                                                // Mettre à jour localement toutes les places
                                                let updatedSeatMap = [...selectedProduct.seatMap];
                                                const reservationResults = [];

                                                for (const reservation of reservations) {
                                                    updatedSeatMap = updatedSeatMap.map(s =>
                                                        s.id === reservation.seat.id
                                                            ? { ...s, status: 'reserved', passengerName: reservation.passengerName }
                                                            : s
                                                    );

                                                    // Appeler l'API pour chaque réservation
                                                    try {
                                                        const result = await apiPost('/bus-reservations/reserve', {
                                                            seat_id: reservation.seat.id,
                                                            user_id: user?.id || '',
                                                            product_id: selectedProduct.id,
                                                            passenger_name: reservation.passengerName,
                                                            total_price: ticketPrice,
                                                            payment_status: 'fully_paid' // Paiement complet immédiat
                                                        });

                                                        reservationResults.push({
                                                            id: result.data?.reservation_id || result.reservation_id,
                                                            ...reservation,
                                                            ticketPrice
                                                        });

                                                        console.log(`✅ Réservation créée pour ${reservation.passengerName}`);
                                                    } catch (apiError) {
                                                        console.error(`⚠️ Erreur API pour ${reservation.passengerName}:`, apiError);
                                                    }
                                                }

                                                // Mettre à jour l'interface
                                                setSelectedProduct({
                                                    ...selectedProduct,
                                                    seatMap: updatedSeatMap
                                                });

                                                setProducts(prevProducts =>
                                                    prevProducts.map(p =>
                                                        p.id === selectedProduct.id
                                                            ? { ...p, seatMap: updatedSeatMap }
                                                            : p
                                                    )
                                                );

                                                // Générer les tickets PDF
                                                for (const res of reservationResults) {
                                                    const ticketData = {
                                                        reservationId: res.id,
                                                        passengerName: res.passengerName,
                                                        seatNumber: res.seat.number,
                                                        compagnie: selectedProduct.compagnieTransport || 'Compagnie de Transport',
                                                        logoAgence: selectedProduct.logoAgence,
                                                        numeroBus: selectedProduct.numeroBus || 'N/A',
                                                        depart: selectedProduct.depart,
                                                        destination: selectedProduct.destination,
                                                        dateDepart: selectedProduct.dateDepart,
                                                        heureDepart: selectedProduct.heureDepart,
                                                        classeVoyage: selectedProduct.classeVoyage,
                                                        prix: ticketPrice,
                                                        devise: selectedProduct.devise || 'FCFA',
                                                        cautionPaid: ticketPrice,
                                                        totalPaid: ticketPrice,
                                                        escales: selectedProduct.escales,
                                                        conditionsVoyage: selectedProduct.conditionsVoyage,
                                                        qrCodeData: res.id
                                                    };

                                                    try {
                                                        const pdfUri = await generateAndDownloadTicket(ticketData);
                                                        console.log(`✅ Ticket PDF généré pour ${res.passengerName}:`, pdfUri);
                                                    } catch (pdfError) {
                                                        console.error('Erreur génération PDF:', pdfError);
                                                    }
                                                }

                                                // Enregistrer la demande de retour si demandée
                                                if (returnTripData && returnTripData.wantReturn) {
                                                    try {
                                                        await subscribeToReturnBusNotifications(
                                                            user?.id || '',
                                                            selectedProduct.id, // original_bus_id
                                                            returnTripData.returnDate,
                                                            returnTripData.returnTime,
                                                            selectedProduct.destination, // departure_city (inversé pour le retour)
                                                            selectedProduct.depart // arrival_city (inversé pour le retour)
                                                        );
                                                        console.log('✅ Demande de retour enregistrée');
                                                    } catch (error) {
                                                        console.error('⚠️ Erreur enregistrement demande retour:', error);
                                                    }
                                                }

                                                // Afficher confirmation
                                                Alert.alert(
                                                    '✅ Réservation confirmée!',
                                                    `${nbPlaces} ticket${nbPlaces > 1 ? 's' : ''} généré${nbPlaces > 1 ? 's' : ''} avec succès!\n\n💰 ${totalAmount.toLocaleString()} FCFA débités\n📱 Tickets PDF dans vos téléchargements\n\n🏢 Vous pouvez aussi retirer vos tickets physiques directement à l'agence avec une pièce d'identité valide.${returnTripData && returnTripData.wantReturn ? '\n\n🔔 Vous serez notifié dès qu\'un bus retour sera disponible!' : ''}`,
                                                    [
                                                        {
                                                            text: 'Contacter l\'agence',
                                                            onPress: () => setShowChatModal(true)
                                                        },
                                                        { text: 'OK' }
                                                    ]
                                                );
                                            } catch (error) {
                                                console.error('Erreur réservation:', error);
                                                Alert.alert('Erreur', 'Impossible de finaliser les réservations');
                                            }
                                        }
                                    }
                                ]
                            );
                        } catch (error) {
                            console.error('Erreur réservation places:', error);
                            Alert.alert('Erreur', 'Impossible de réserver ces places');
                        }
                    }}
                />
            )}

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
        justifyContent: 'space-between', // ✅ Pour bien espacer les éléments
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000', // ✅ Ombre pour élévation
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6', // ✅ Fond pour visibilité
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000', // ✅ Ombre pour relief
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        gap: 6, // ✅ Espacement entre icône et texte
    },
    backIcon: {
        fontSize: 20, // ✅ Plus grand pour visibilité
        fontWeight: 'bold',
        color: '#374151',
    },
    backText: {
        fontSize: 15, // ✅ Légèrement réduit mais plus lisible
        fontWeight: '600',
        color: '#374151',
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
    // ✅ OPTIMISATION 8: Styles pour Skeleton Loader
    skeletonContainer: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    skeletonInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 10,
    },
    skeletonInfoText: {
        fontSize: 14,
        color: '#6B7280',
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
    // ✅ OPTIMISATION 2: Style FlatList
    flatListContent: {
        flexGrow: 1,
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






