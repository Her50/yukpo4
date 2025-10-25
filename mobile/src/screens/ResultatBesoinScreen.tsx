// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import SafeIcon from '../components/SafeIcon';
import SearchBar from '../components/SearchBar';
import ServiceGalleryModal from '../components/ServiceGalleryModal';
import UltraModernServiceCard from '../components/UltraModernServiceCard';
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
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
                // ✅ FILTRES SPÉCIAUX POUR CLINIQUES/HÔPITAUX
                if (product.type === 'hopital_clinique') {
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
                if (product.type === 'aliments' || product.type === 'agroalimentaire') {
                    if (categoryFilters.categorieAliment && product.categorieAliment !== categoryFilters.categorieAliment) return false;
                    if (categoryFilters.typeAliment && product.typeAliment !== categoryFilters.typeAliment) return false;
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

                    // Stockage (multiselect)
                    if (categoryFilters.stockage && Array.isArray(categoryFilters.stockage) && categoryFilters.stockage.length > 0) {
                        if (!categoryFilters.stockage.includes(product.stockage)) {
                            return false;
                        }
                    }

                    // RAM (multiselect)
                    if (categoryFilters.ram && Array.isArray(categoryFilters.ram) && categoryFilters.ram.length > 0) {
                        if (!categoryFilters.ram.includes(product.ram)) {
                            return false;
                        }
                    }

                    // Couleur (multiselect)
                    if (categoryFilters.couleurTelephone && Array.isArray(categoryFilters.couleurTelephone) && categoryFilters.couleurTelephone.length > 0) {
                        if (!categoryFilters.couleurTelephone.includes(product.couleurTelephone)) {
                            return false;
                        }
                    }

                    // Opérateur
                    if (categoryFilters.operateur && product.operateur !== categoryFilters.operateur) {
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
                    if (categoryFilters.domaineActivite && product.domaineActivite !== categoryFilters.domaineActivite) {
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

                    // Multiselect filters (langues)
                    if (categoryFilters.languesRequises && Array.isArray(categoryFilters.languesRequises) && categoryFilters.languesRequises.length > 0) {
                        const hasAllLangues = categoryFilters.languesRequises.every(langue =>
                            product.languesRequises && product.languesRequises.includes(langue)
                        );
                        if (!hasAllLangues) {
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

                // ✅ FILTRES SPÉCIAUX POUR RESTAURATION
                if (product.type === 'restauration') {
                    // Select filters
                    if (categoryFilters.typeRestaurant && product.typeRestaurant !== categoryFilters.typeRestaurant) {
                        return false;
                    }
                    if (categoryFilters.gammePrix && product.gammePrix !== categoryFilters.gammePrix) {
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

                    // Toggle filters
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

                    // Range filters (capacité)
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
                    if (categoryFilters.typeAmplification && product.typeAmplification !== categoryFilters.typeAmplification) {
                        return false;
                    }
                    if (categoryFilters.nombreCordes && product.nombreCordes !== categoryFilters.nombreCordes) {
                        return false;
                    }

                    // Multiselect filters
                    if (categoryFilters.materiauInstrument && Array.isArray(categoryFilters.materiauInstrument) && categoryFilters.materiauInstrument.length > 0) {
                        if (!categoryFilters.materiauInstrument.includes(product.materiauInstrument)) {
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
                    if (categoryFilters.garantieInstrument === true && !product.garantieInstrument) {
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

                // ✅ FILTRES SPÉCIAUX POUR DEMENAGEMENT
                if (product.type === 'demenagement') {
                    if (categoryFilters.typeDemenagement && product.typeDemenagement !== categoryFilters.typeDemenagement) {
                        return false;
                    }
                    if (categoryFilters.typeVehiculeDemenagement && product.typeVehiculeDemenagement !== categoryFilters.typeVehiculeDemenagement) {
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

                // ✅ FILTRES SPÉCIAUX POUR PLOMBERIE
                if (product.type === 'plomberie') {
                    if (categoryFilters.typePrestation && product.typePrestation !== categoryFilters.typePrestation) {
                        return false;
                    }
                    if (categoryFilters.urgence === true && !product.urgence) {
                        return false;
                    }
                    if (categoryFilters.specialitesPlomberie && Array.isArray(categoryFilters.specialitesPlomberie) && categoryFilters.specialitesPlomberie.length > 0) {
                        if (!Array.isArray(product.specialitesPlomberie)) {
                            return false;
                        }
                        if (!categoryFilters.specialitesPlomberie.some(spec => product.specialitesPlomberie.includes(spec))) {
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

                // ✅ FILTRES SPÉCIAUX POUR ASSURANCE
                if (product.type === 'assurance') {
                    if (categoryFilters.typeAssurance && product.typeAssurance !== categoryFilters.typeAssurance) {
                        return false;
                    }
                    if (categoryFilters.compagnieAssurance && product.compagnieAssurance !== categoryFilters.compagnieAssurance) {
                        return false;
                    }
                    if (categoryFilters.typeCouverture && product.typeCouverture !== categoryFilters.typeCouverture) {
                        return false;
                    }
                    if (categoryFilters.dureeContrat && product.dureeContrat !== categoryFilters.dureeContrat) {
                        return false;
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

                // ✅ FILTRES SPÉCIAUX POUR IMAGE_SON
                if (product.type === 'image_son') {
                    if (categoryFilters.typeImageSon && product.typeImageSon !== categoryFilters.typeImageSon) {
                        return false;
                    }
                    if (categoryFilters.marqueImageSon && product.marqueImageSon !== categoryFilters.marqueImageSon) {
                        return false;
                    }
                    if (categoryFilters.etatImageSon && product.etatImageSon !== categoryFilters.etatImageSon) {
                        return false;
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

                // ✅ FILTRES SPÉCIAUX POUR DECORATION
                if (product.type === 'decoration') {
                    if (categoryFilters.typeDecoration && product.typeDecoration !== categoryFilters.typeDecoration) {
                        return false;
                    }
                    if (categoryFilters.styleDecoration && product.styleDecoration !== categoryFilters.styleDecoration) {
                        return false;
                    }
                    if (categoryFilters.pieceDecoration && product.pieceDecoration !== categoryFilters.pieceDecoration) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR JOUETS_ENFANTS
                if (product.type === 'jouets_enfants') {
                    if (categoryFilters.typeJouet && product.typeJouet !== categoryFilters.typeJouet) {
                        return false;
                    }
                    if (categoryFilters.ageJouet && product.ageJouet !== categoryFilters.ageJouet) {
                        return false;
                    }
                    if (categoryFilters.etatJouet && product.etatJouet !== categoryFilters.etatJouet) {
                        return false;
                    }
                    if (categoryFilters.normeSecurite === true && !product.normeSecurite) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR USTENSILES_CUISINE
                if (product.type === 'ustensiles_cuisine') {
                    if (categoryFilters.typeUstensile && product.typeUstensile !== categoryFilters.typeUstensile) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR QUINCAILLERIE
                if (product.type === 'quincaillerie') {
                    if (categoryFilters.categorieQuincaillerie && product.categorieQuincaillerie !== categoryFilters.categorieQuincaillerie) {
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

                // ✅ FILTRES SPÉCIAUX POUR PIECES_AUTO
                if (product.type === 'pieces_auto') {
                    if (categoryFilters.typePieceAuto && product.typePieceAuto !== categoryFilters.typePieceAuto) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR PIECES_INDUSTRIELLES
                if (product.type === 'pieces_industrielles') {
                    if (categoryFilters.typePieceIndustrielle && product.typePieceIndustrielle !== categoryFilters.typePieceIndustrielle) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ELECTRONIQUE
                if (product.type === 'electronique') {
                    if (categoryFilters.typeElectronique && product.typeElectronique !== categoryFilters.typeElectronique) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR MENUISERIE
                if (product.type === 'menuiserie') {
                    if (categoryFilters.typeMenuiserie && product.typeMenuiserie !== categoryFilters.typeMenuiserie) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR AGRICULTURE
                if (product.type === 'agriculture') {
                    if (categoryFilters.typeAgricole && product.typeAgricole !== categoryFilters.typeAgricole) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR SECURITE_SURVEILLANCE
                if (product.type === 'securite_surveillance') {
                    if (categoryFilters.typeSecurite && product.typeSecurite !== categoryFilters.typeSecurite) {
                        return false;
                    }
                }

                // ✅ FILTRES SPÉCIAUX POUR ANIMAUX_VETERINAIRE
                if (product.type === 'animaux_veterinaire') {
                    if (categoryFilters.typeAnimal && product.typeAnimal !== categoryFilters.typeAnimal) {
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

                // ✅ FILTRES SPÉCIAUX POUR BIEN_ETRE
                if (product.type === 'bien_etre') {
                    if (categoryFilters.typeBienEtre && product.typeBienEtre !== categoryFilters.typeBienEtre) {
                        return false;
                    }
                    if (categoryFilters.dureeSoins && product.dureeSoins !== categoryFilters.dureeSoins) {
                        return false;
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

                // ✅ FILTRES SPÉCIAUX POUR BIEN_ETRE
                if (product.type === 'bien_etre' || product.type === 'bien-etre') {
                    if (categoryFilters.typeBienEtre && product.typeBienEtre !== categoryFilters.typeBienEtre) {
                        return false;
                    }
                    if (categoryFilters.dureeSoins && product.dureeSoins !== categoryFilters.dureeSoins) {
                        return false;
                    }
                    if (categoryFilters.packageDispo === true && !product.packageDispo) {
                        return false;
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

                // ✅ FILTRES GÉNÉRIQUES
                for (const [key, value] of Object.entries(categoryFilters)) {
                    if (value === null || value === undefined || value === '') continue;

                    // Ignorer les filtres déjà traités spécifiquement
                    const specialFilters = [
                        // Santé
                        'prestationsMedicales', 'jourDisponibilite', 'momentDisponibilite', 'banqueSang',
                        'urgencesDisponible', 'rdvEnLigne', 'typeEtablissement', 'ouvertMaintenant',
                        'deGarde', 'jourGarde', 'typePharmacie', 'services',
                        'examensLaboratoire', 'typeLaboratoire', 'prelevementDomicile', 'resultatRapide',
                        // Immobilier (incluant location courte durée)
                        'statutImmobilier', 'typeImmobilier', 'standing', 'etatGeneral', 'ameublement',
                        'nbChambres', 'nbSallesBain', 'superficie', 'equipementsImmo', 'parking', 'ascenseur',
                        'disponibleImmediatement', 'titreFoncier',
                        'prixParNuit', 'dureeMinimum', 'dureeMaximum', 'nettoyageInclus', 'lingeInclus',
                        'capacitePersonnes', 'capacitePersonnes_min', 'capacitePersonnes_max',
                        'calendrierDispo', 'reservationInstantanee',
                        // Automobile
                        'typeVehicule', 'typeCarrosserie', 'marqueAutomobile', 'modeleAutomobile', 'etatVehicule',
                        'annee', 'kilometrage', 'couleurAutomobile', 'typeCarburant', 'transmission',
                        'nbPortes', 'nbPlaces', 'puissance', 'cylindree', 'equipementsAuto',
                        'premiereMain', 'historiqueEntretien', 'contreTechnique', 'garantie', 'papiers',
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
                        'pointDepart', 'pointArrivee', 'dateTrajet', 'heureTrajet', 'nbPlacesDisponibles',
                        'nbPlacesDisponibles_min', 'nbPlacesDisponibles_max', 'vehiculeInfo', 'preferencesTrajet', 'prixParPlace',
                        // Evenementiel
                        'typeEvenement', 'capaciteEvenement', 'servicesEvenement', 'dureeEvenement',
                        'equipementsEvenement', 'tarifEvenement', 'localisationEvenement',
                        // Voyage & Tourisme
                        'typeVoyage', 'destinationVoyage', 'dureeVoyage', 'servicesVoyage', 'hebergementVoyage',
                        // Demenagement
                        'typeDemenagement', 'volumeDemenagement', 'servicesDemenagement', 'typeVehiculeDemenagement',
                        // Plomberie
                        'typePrestation', 'urgence', 'specialitesPlomberie', 'garantieTravaux',
                        // Nettoyage
                        'typeNettoyage', 'frequenceNettoyage', 'servicesNettoyage', 'produitsBio',
                        // Assurance
                        'typeAssurance', 'compagnieAssurance', 'typeCouverture', 'dureeContrat', 'franchiseAssurance',
                        // Electricite
                        'typeElectrique', 'marqueElectrique', 'caracteristiques',
                        // Image & Son
                        'typeImageSon', 'marqueImageSon', 'etatImageSon', 'diagonaleEcran', 'resolution', 'garantieImageSon',
                        // Sport & Loisirs
                        'typeSport', 'categorieSport', 'niveauSport',
                        // Bricolage
                        'typeBricolage', 'categorieBricolage', 'marqueBricolage', 'etatBricolage',
                        'puissanceBricolage', 'garantieBricolage',
                        // Enfants & Bebes
                        'categorieEnfant', 'ageRecommande', 'etatEnfant', 'securiteNorme',
                        // Decoration
                        'typeDecoration', 'styleDecoration', 'pieceDecoration', 'materiauDecoration',
                        'couleurDecoration', 'dimensionsDecoration',
                        // Jouets Enfants
                        'typeJouet', 'ageJouet', 'etatJouet', 'normeSecurite', 'ageRecommande', 'marqueJouet',
                        // Ustensiles Cuisine
                        'typeUstensile', 'materiauUstensile', 'marqueUstensile', 'capaciteUstensile',
                        // Quincaillerie
                        'categorieQuincaillerie', 'marqueQuincaillerie', 'referenceQuincaillerie', 'unite', 'stockDisponible',
                        // Cosmetique & Parfum
                        'typeCosmetique', 'marqueCosmetique', 'volumeCosmetique', 'uniteCosmetique',
                        // Pieces Auto
                        'typePieceAuto', 'marquePieceAuto', 'referencePieceAuto', 'compatibilitePieceAuto',
                        // Pieces Industrielles
                        'typePieceIndustrielle', 'marquePieceIndustrielle', 'referencePieceIndustrielle',
                        // Electronique
                        'typeElectronique', 'marqueElectronique', 'etatElectronique',
                        // Menuiserie
                        'typeMenuiserie', 'typeBois', 'finitionMenuiserie', 'styleMenuiserie', 'dimensionsMenuiserie', 'delaiMenuiserie',
                        // Agriculture
                        'typeAgricole', 'culture', 'saisonAgricole', 'uniteVente', 'certificationsAgricole', 'localisationAgricole',
                        // Securite & Surveillance
                        'typeSecurite', 'zoneSecurite', 'dureeSecurite', 'equipementsSecurite', 'tarifSecurite',
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
                        'typeBienEtre', 'dureeSoins', 'tarifsSpeciaux', 'packageDispo',
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
                        'wifi', 'salleReunion', 'adresseHotel', 'villeHotel', 'gpsHotel', 'noteHotel'
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
                    // ✅ CORRECTION: Gérer structure {valeur: [...]} ET array direct
                    const serviceProduits = service.data?.produits?.valeur || service.data?.produits || [];
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
                                            const filteredProducts = filterProducts(products);
                                            const filteredServices = filterAndSortServices(services);
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

                    {/* ✅ CORRECTION: Afficher TOUS les résultats (services ET produits) */}
                    <View style={styles.servicesContainer}>
                        {(() => {
                            // Combiner les services et les produits
                            const filteredProducts = filterProducts(products);
                            const filteredServices = filterAndSortServices(services);

                            // ✅ Afficher d'abord les services complets, puis les produits individuels
                            const allResults = [
                                ...filteredServices.map(service => ({ type: 'service', data: service })),
                                ...filteredProducts.map(product => ({ type: 'product', data: product }))
                            ];

                            return allResults.length > 0 ? (
                                allResults.map((result, index) => {
                                    if (result.type === 'service') {
                                        // Afficher le service complet
                                        const service = result.data as Service;
                                        return (
                                            <UltraModernServiceCard
                                                key={`service-${index}-${service.id}`}
                                                service={service}
                                                onContactPress={() => handleContactPress(service)}
                                                onCallPress={() => handleCallPress(service)}
                                                onViewGallery={() => {
                                                    setSelectedService(service);
                                                    setShowGalleryModal(true);
                                                }}
                                                categoryStyle={categoryStyle}
                                                terminology={terminology}
                                            />
                                        );
                                    } else {
                                        // Afficher le produit individuel
                                        const product = normalizeProduct(result.data);
                                        return (
                                            <ProductCardComponent key={`product-${index}-${product.nom}`} product={product} />
                                        );
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
                            );
                        })()}
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






