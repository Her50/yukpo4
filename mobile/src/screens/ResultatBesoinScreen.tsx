// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import { Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import CategoryFilters from '../components/CategoryFilters';
import ChatInputMobile from '../components/ChatInputMobile';
import ChatModalMobile from '../components/ChatModalMobile';
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import ModernGPSModal from '../components/ModernGPSModal';
import ProductCard from '../components/ProductCard';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import ServiceGalleryModal from '../components/ServiceGalleryModal';
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useServicesBatchData } from '../hooks/useServicesBatchData';
import { apiGet, apiPost } from '../services/api';
import { theme } from '../theme/theme';
import { generateProductShareMessage, generateSmartShareLink } from '../utils/productShareHelper';

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

// ✅ CORRIGÉ 2026-03-07: MemoizedProductCard défini en dehors du composant pour éviter de recréer le wrapper à chaque render
const MemoizedProductCard = React.memo(ProductCard, (prevProps, nextProps) => {
    return (
        prevProps.product?.id === nextProps.product?.id &&
        prevProps.product?.product_id === nextProps.product?.product_id &&
        prevProps.service?.id === nextProps.service?.id &&
        prevProps.isScrolling === nextProps.isScrolling &&
        prevProps.userLocation?.latitude === nextProps.userLocation?.latitude &&
        prevProps.userLocation?.longitude === nextProps.userLocation?.longitude
    );
});

// ✅ NOUVEAU 2026-03-12: ProductCard avec coordinateur vidéo intégré
const ProductCardWithVideoCoordinator: React.FC<{
    product: any;
    service: any;
    prestataire?: any;
    userLocation?: { latitude: number; longitude: number } | null;
    onPress?: () => void;
    onChatPress?: () => void;
    isScrolling?: boolean;
    videoCoordinator: {
        requestVideoPlayback: (videoId: string, playCallback: () => void) => boolean;
        releaseVideoPlayback: (videoId: string) => void;
    };
}> = ({ videoCoordinator, ...props }) => {
    // Générer un ID unique pour ce produit
    const videoId = `${props.service?.id || 'unknown'}-${props.product?.product_index || props.product?.id || 'unknown'}`;

    // Wrapper pour les callbacks vidéo
    const handleVideoRef = useCallback((videoRef: any, mediaKey: string) => {
        // Enregistrer la référence vidéo locale si nécessaire
        console.log(`[ProductCardWithVideoCoordinator] Vidéo enregistrée: ${videoId}-${mediaKey}`);
    }, [videoId]);

    const handleVideoPlaybackRequest = useCallback((playCallback: () => void) => {
        return videoCoordinator.requestVideoPlayback(videoId, playCallback);
    }, [videoCoordinator, videoId]);

    const handleVideoRelease = useCallback(() => {
        videoCoordinator.releaseVideoPlayback(videoId);
    }, [videoCoordinator, videoId]);

    return (
        <ProductCard
            {...props}
            // Passer les callbacks vidéo personnalisés
            onVideoRef={handleVideoRef}
            onVideoPlaybackRequest={handleVideoPlaybackRequest}
            onVideoRelease={handleVideoRelease}
        />
    );
};

// ✅ NOUVEAU: Memoized wrapper pour ProductCardWithVideoCoordinator
const MemoizedProductCardWithCoordinator = React.memo(ProductCardWithVideoCoordinator, (prevProps, nextProps) => {
    return (
        prevProps.product?.id === nextProps.product?.id &&
        prevProps.product?.product_id === nextProps.product?.product_id &&
        prevProps.service?.id === nextProps.service?.id &&
        prevProps.isScrolling === nextProps.isScrolling &&
        prevProps.userLocation?.latitude === nextProps.userLocation?.latitude &&
        prevProps.userLocation?.longitude === nextProps.userLocation?.longitude &&
        prevProps.videoCoordinator === nextProps.videoCoordinator
    );
});

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
    // ✅ CORRIGÉ 2026-03-06: Ref pour suivre les vidéos actives et les arrêter proprement
    const activeVideoRefs = useRef<Map<string, Video>>(new Map());
    const isScrollingRef = useRef(false);
    const [isScrollingState, setIsScrollingState] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prestatairesRef = useRef<Map<string, Prestataire>>(new Map());
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ✅ NOUVEAU 2026-03-12: Coordinateur global des vidéos pour éviter les lectures simultanées
    const videoCoordinatorRef = useRef<{
        currentlyPlaying: Set<string>; // IDs des vidéos en cours de lecture
        maxConcurrentVideos: number;
        queue: Array<{ id: string; callback: () => void }>;
    }>({
        currentlyPlaying: new Set(),
        maxConcurrentVideos: 2, // Maximum 2 vidéos simultanément
        queue: [],
    });

    // ✅ NOUVEAU: Fonction pour demander la permission de jouer une vidéo
    const requestVideoPlayback = useCallback((videoId: string, playCallback: () => void) => {
        const coordinator = videoCoordinatorRef.current;

        // Si la vidéo joue déjà, autoriser
        if (coordinator.currentlyPlaying.has(videoId)) {
            playCallback();
            return true;
        }

        // Si on peut ajouter une vidéo, jouer directement
        if (coordinator.currentlyPlaying.size < coordinator.maxConcurrentVideos) {
            coordinator.currentlyPlaying.add(videoId);
            playCallback();
            return true;
        }

        // Sinon, mettre en file d'attente
        coordinator.queue.push({ id: videoId, callback: playCallback });
        return false;
    }, []);

    // ✅ NOUVEAU: Fonction pour libérer une vidéo
    const releaseVideoPlayback = useCallback((videoId: string) => {
        const coordinator = videoCoordinatorRef.current;
        coordinator.currentlyPlaying.delete(videoId);

        // Jouer la prochaine vidéo en attente
        if (coordinator.queue.length > 0) {
            const next = coordinator.queue.shift();
            if (next) {
                coordinator.currentlyPlaying.add(next.id);
                next.callback();
            }
        }
    }, []);

    // ✅ NOUVEAU: Arrêter toutes les vidéos et vider la file d'attente
    const stopAllVideosAndClearQueue = useCallback(() => {
        // Arrêter toutes les vidéos actuelles
        activeVideoRefs.current.forEach((videoRef, key) => {
            if (videoRef) {
                videoRef.pauseAsync().catch(() => {
                    console.log(`[ResultatBesoinScreen] Vidéo ${key} déjà arrêtée ou inaccessible`);
                });
            }
        });
        activeVideoRefs.current.clear();

        // Vider la file d'attente du coordinateur
        videoCoordinatorRef.current.currentlyPlaying.clear();
        videoCoordinatorRef.current.queue = [];
    }, []);
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
    // ✅ CORRIGÉ 2026-03-05: searchQuery en state pour se mettre à jour lors des re-recherches
    // Avant: const searchQuery = routeParams.searchQuery (jamais mis à jour → scoring produit avec requête périmée)
    const [searchQuery, setSearchQuery] = useState(routeParams.searchQuery || routeParams.query || '');

    // ✅ CORRECTION 2025-12-30: useRef pour éviter les re-renders infinis
    const hasProcessedInitialResults = useRef(false);
    const initialResultsLength = useRef(initialResults?.length || 0);

    // ✅ CORRIGÉ 2026-01-24: Fonction utilitaire pour extraire le nom du produit avec fallbacks
    // ✅ MIGRATION COMPLÈTE: Tous les produits sont maintenant dans service_products avec product_name (colonne générée)
    // Le backend retourne product_name depuis service_products, mais product_data contient nom_produit
    const getProductName = useCallback((productData: any): string => {
        if (!productData) return 'Produit sans nom';

        // ✅ PRIORITÉ 1: product_name depuis le backend (colonne générée PostgreSQL)
        if (productData.product_name) return String(productData.product_name);

        // ✅ PRIORITÉ 2: nom_produit depuis product_data (format original)
        if (productData.nom_produit) return String(productData.nom_produit);

        // ✅ PRIORITÉ 3: Autres variantes possibles
        if (productData.nom) return String(productData.nom);
        if (productData.name) return String(productData.name);
        if (productData.titre) return String(productData.titre);
        if (productData.title) return String(productData.title);

        // ✅ ERREUR: Si aucun nom n'est disponible, c'est une anomalie
        console.error('[ResultatBesoinScreen] ❌ ERREUR: product_name manquant (anomalie backend):', productData);
        return 'Produit sans nom';
    }, []);

    // ✅ CORRIGÉ 2026-03-05: Stop words français pour filtrer les mots non-significatifs de la requête
    // Évite que "manger" dans "je souhaite manger les beignets" donne autant de poids que "beignets"
    const FRENCH_STOP_WORDS = new Set([
        'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
        'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
        'ce', 'ces', 'cette', 'cet', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
        'son', 'sa', 'ses', 'notre', 'votre', 'leur', 'leurs',
        'me', 'te', 'se', 'en', 'y',
        'et', 'ou', 'mais', 'donc', 'car', 'ni', 'que', 'qui', 'dont',
        'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'chez',
        'est', 'sont', 'suis', 'es', 'sommes', 'etes',
        'ai', 'as', 'avons', 'avez', 'ont',
        'être', 'avoir', 'fait', 'faire',
        'pas', 'ne', 'plus', 'très', 'bien', 'tout', 'tous', 'aussi',
        'souhaite', 'veux', 'voudrais', 'cherche', 'besoin', 'faut',
    ]);

    // ✅ CORRIGÉ 2026-03-05: Fonction améliorée pour calculer le score de pertinence au niveau produit
    // Corrige le problème où "salle à manger" ranke au-dessus de "beignets" pour la requête "je souhaite manger les beignets"
    const calculateProductRelevanceScore = useCallback((product: any, query: string): number => {
        if (!query || !product) return 0;

        const queryLower = query.toLowerCase().trim();
        const allWords = queryLower.split(/\s+/).filter(w => w.length > 0);

        if (allWords.length === 0) return 0;

        // ✅ CORRIGÉ 2026-03-05: Filtrer les stop words pour ne garder que les mots significatifs
        // "je souhaite manger les beignets" → ["manger", "beignets"]
        const contentWords = allWords.filter(w => w.length >= 3 && !FRENCH_STOP_WORDS.has(w));
        // Fallback: si tous les mots sont des stop words, utiliser les mots de 3+ caractères
        const queryWords = contentWords.length > 0 ? contentWords : allWords.filter(w => w.length >= 3);

        if (queryWords.length === 0) return 0;

        let score = 0;

        // ✅ CORRIGÉ: Utiliser la fonction utilitaire pour extraire le nom correctement
        const productData = product.product_data || product;
        const nomProduit = getProductName(productData).toLowerCase();
        const descriptionProduit = (productData.description_produit || productData.description || product.description_produit || product.description || '').toLowerCase();
        const categorieProduit = (productData.categorie_produit || productData.category || product.categorie_produit || product.category || '').toLowerCase();
        const combinaisonBrute = (productData.combinaison_brute || product.combinaison_brute || '').toLowerCase();

        // Extraire les sous-caractéristiques (marque, modèle, etc.)
        const sousCaracteristiques = productData.sous_caracteristiques || product.sous_caracteristiques || {};
        const allCharacteristics = Object.values(sousCaracteristiques)
            .flat()
            .map((v: any) => String(v).toLowerCase())
            .join(' ');

        // Construire un texte complet pour la recherche
        const allProductText = `${nomProduit} ${descriptionProduit} ${categorieProduit} ${combinaisonBrute} ${allCharacteristics}`.toLowerCase();

        // ✅ CORRIGÉ 2026-03-05: Construire la requête significative (sans stop words) pour matching exact
        const meaningfulQuery = queryWords.join(' ');

        // Score pour correspondance exacte de la requête significative dans le nom
        if (nomProduit.includes(meaningfulQuery)) {
            score += 100; // Bonus très élevé pour correspondance exacte dans le nom
        } else if (categorieProduit.includes(meaningfulQuery)) {
            score += 80; // Bonus élevé pour correspondance dans la catégorie
        } else if (allProductText.includes(meaningfulQuery)) {
            score += 50;
        }

        // ✅ CORRIGÉ 2026-03-05: Score pondéré pour chaque mot-clé significatif
        queryWords.forEach(word => {
            if (word.length < 2) return;

            // ✅ CORRIGÉ: Correspondance dans le nom (priorité absolue)
            if (nomProduit === word) {
                score += 50; // Correspondance exacte d'un mot dans le nom
            } else if (nomProduit.startsWith(word)) {
                score += 40; // Commence par le mot
            } else if (nomProduit.includes(word)) {
                score += 30; // Contient le mot
            }

            // Correspondance dans la catégorie
            if (categorieProduit.includes(word)) {
                score += 35;
            }

            // Correspondance dans les sous-caractéristiques (marque, modèle, etc.)
            if (allCharacteristics.includes(word)) {
                score += 25;
            }

            // Correspondance dans la description
            if (descriptionProduit.includes(word)) {
                score += 10;
            }

            // Correspondance dans la combinaison brute
            if (combinaisonBrute.includes(word)) {
                score += 12;
            }
        });

        // ✅ CORRIGÉ 2026-03-05: Bonus multi-mots basé sur les mots significatifs (pas les stop words)
        const matchingWords = queryWords.filter(word =>
            word.length >= 2 && allProductText.includes(word)
        );
        if (matchingWords.length === queryWords.length && queryWords.length > 1) {
            score += 40; // Bonus élevé si TOUS les mots significatifs correspondent
        } else if (matchingWords.length >= Math.ceil(queryWords.length / 2)) {
            score += 15; // Bonus partiel si au moins la moitié correspond
        }

        // ✅ CORRIGÉ 2026-03-11: Supprimé le score minimal qui causait l'affichage de produits non pertinents
        // Seuls les produits avec un vrai score de pertinence (> 0) doivent être affichés

        return score;
    }, [getProductName]);

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

        if (__DEV__) console.log('🔍 [ResultatBesoinScreen] filterProducts:', productsList.length, 'produits');

        // Appliquer les filtres de catégorie spécifiques
        if (Object.keys(categoryFilters).length > 0) {
            const beforeFilter = filtered.length;
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
                    // ✅ CORRIGÉ: Ne pas exclure si la propriété n'existe pas dans le produit
                    if (product[key] !== undefined && product[key] !== null && product[key] !== value) {
                        return false;
                    }
                }
                return true;
            });

            if (__DEV__ && beforeFilter > 0 && filtered.length === 0) {
                console.error('❌ [ResultatBesoinScreen] Tous les produits exclus par filtres catégorie!');
            }
        }

        // Appliquer le filtre par prix
        if (priceFilter.min !== null || priceFilter.max !== null) {
            const beforePriceFilter = filtered.length;
            filtered = filtered.filter(product => {
                const price = parseFloat(product.prix || product.price);
                if (isNaN(price)) return false;
                if (priceFilter.min !== null && price < priceFilter.min) return false;
                if (priceFilter.max !== null && price > priceFilter.max) return false;

                return true;
            });

            if (__DEV__ && beforePriceFilter > 0 && filtered.length === 0) {
                console.error('❌ [ResultatBesoinScreen] Tous les produits exclus par filtre prix!');
            }
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

        if (__DEV__) console.log('✅ [ResultatBesoinScreen] filterProducts:', filtered.length, '/', productsList.length);

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
            // ✅ AMÉLIORÉ: Valider et filtrer les résultats invalides AVANT traitement
            if (!results || !Array.isArray(results)) {
                console.warn('⚠️ [ResultatBesoinScreen] Résultats invalides (non-array):', results);
                return [];
            }

            // Filtrer les résultats null/undefined ou sans service_id
            const validResults = results.filter((result) => {
                if (!result || typeof result !== 'object') {
                    console.warn('⚠️ [ResultatBesoinScreen] Résultat invalide (null/undefined/non-object):', result);
                    return false;
                }
                if (!result.service_id) {
                    console.warn('⚠️ [ResultatBesoinScreen] Résultat sans service_id:', result);
                    return false;
                }
                return true;
            });

            if (validResults.length === 0) {
                console.warn('⚠️ [ResultatBesoinScreen] Aucun résultat valide après filtrage');
                return [];
            }

            if (!location) {
                // Si pas de géolocalisation, trier seulement par score
                console.log('📍 Géolocalisation non disponible, tri par score uniquement');
                return validResults.sort((a, b) => (b.score || 0) - (a.score || 0));
            }

            // ✅ AMÉLIORÉ: Valider location.coords avant utilisation
            if (!(location as any)?.coords?.latitude || !(location as any)?.coords?.longitude) {
                console.warn('⚠️ [ResultatBesoinScreen] Coordonnées GPS invalides dans location:', location);
                return validResults.sort((a, b) => (b.score || 0) - (a.score || 0));
            }

            // Enrichir les résultats avec la distance calculée
            const enrichedResults = validResults.map((result) => {
                try {
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
                                const lat = parseFloat(coords[0].trim());
                                const lon = parseFloat(coords[1].trim());
                                if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                                    const userLat = (location as any).coords.latitude;
                                    const userLon = (location as any).coords.longitude;
                                    if (!isNaN(userLat) && !isNaN(userLon)) {
                                        distance = calculateDistance(
                                            userLat,
                                            userLon,
                                            lat,
                                            lon
                                        );
                                        console.log(`✅ [ResultatBesoinScreen] Distance calculée pour ${result.service_id}: ${distance.toFixed(2)} km`);
                                    }
                                } else {
                                    console.warn(`⚠️ [ResultatBesoinScreen] Coordonnées GPS invalides pour ${result.service_id}: lat=${lat}, lon=${lon}`);
                                }
                            }
                        } catch (error) {
                            console.warn(`⚠️ [ResultatBesoinScreen] Erreur parsing GPS pour ${result.service_id}:`, error);
                        }
                    }

                    return {
                        ...result,
                        distance,
                        proximityScore: distance < 1 ? 1.0 : distance < 5 ? 0.8 : distance < 10 ? 0.6 : 0.4
                    };
                } catch (error) {
                    console.error(`❌ [ResultatBesoinScreen] Erreur traitement résultat ${result?.service_id}:`, error);
                    // Retourner le résultat avec valeurs par défaut en cas d'erreur
                    return {
                        ...result,
                        distance: Infinity,
                        proximityScore: 0.4
                    };
                }
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

            const servicePromises = serviceIds.map(async (serviceId, index) => {
                try {
                    console.log(`🔍 [ResultatBesoinScreen] Récupération du service ${serviceId}...`);
                    const response = await apiGet(`/api/services/${serviceId}`);
                    console.log(`✅ [ResultatBesoinScreen] Service ${serviceId} récupéré:`, response);

                    if (response.data) {
                        const service = response.data as Service;

                        // ✅ CORRECTION: Récupérer les produits depuis l'API service_products (nouveau système)
                        let productsFromAPI: any[] = [];
                        try {
                            const productsResponse = await apiGet(`/api/services/${serviceId}/products`);
                            // ✅ DEBUG 2026-01-13: Logs détaillés pour diagnostiquer les problèmes d'affichage
                            if (__DEV__) console.log(`🔍 [ResultatBesoinScreen] DEBUG produits API pour service ${serviceId}:`, {
                                success: productsResponse.success,
                                hasData: !!productsResponse.data,
                                dataType: typeof productsResponse.data,
                                isArray: Array.isArray(productsResponse.data),
                                dataLength: Array.isArray(productsResponse.data) ? productsResponse.data.length : 'N/A',
                                fullResponse: productsResponse
                            });

                            if (productsResponse.success && Array.isArray(productsResponse.data)) {
                                productsFromAPI = productsResponse.data;
                                if (__DEV__) {
                                    console.log(`✅ [ResultatBesoinScreen] ${productsFromAPI.length} produits récupérés depuis API pour service ${serviceId}`);
                                    // ✅ DEBUG: Log détaillé des produits récupérés
                                    if (productsFromAPI.length > 0) {
                                        console.log(`📦 [ResultatBesoinScreen] Détails produits pour service ${serviceId}:`,
                                            productsFromAPI.map((p: any) => ({
                                                id: p.id,
                                                product_id: p.product_id,
                                                product_index: p.product_index,
                                                nom: p.product_data?.nom || p.nom || p.name,
                                                product_data_keys: p.product_data ? Object.keys(p.product_data) : []
                                            }))
                                        );
                                    }
                                }
                            } else {
                                console.warn(`⚠️ [ResultatBesoinScreen] Réponse produits API invalide pour service ${serviceId}:`, {
                                    success: productsResponse.success,
                                    hasData: !!productsResponse.data,
                                    isArray: Array.isArray(productsResponse.data),
                                    response: productsResponse
                                });
                            }
                        } catch (productsError) {
                            console.warn(`⚠️ [ResultatBesoinScreen] Erreur récupération produits API pour ${serviceId}:`, productsError);
                            // ❌ SUPPRIMÉ: Plus de fallback vers l'ancien système - utiliser uniquement service_products
                        }

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
                            },
                            // ✅ NOUVEAU: Ajouter les produits de l'API dans un champ dédié pour traitement ultérieur
                            _productsFromAPI: productsFromAPI
                        };

                        if (__DEV__) console.log(`✅ [ResultatBesoinScreen] Service ${service.id} enrichi avec GPS:`, {
                            searchGps,
                            finalGps: enrichedService.gps,
                            gps_fixe: enrichedService.data?.gps_fixe,
                            productsFromAPICount: productsFromAPI.length
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
                // ✅ CORRIGÉ 2026-01-13: Utiliser startTransition pour les mises à jour non urgentes
                startTransition(() => {
                    setServices(validServices);
                });

                // Extraire tous les produits de tous les services
                const extractedProducts: any[] = [];
                const userGPS = location?.coords ? `${location.coords.latitude},${location.coords.longitude}` : null;

                validServices.forEach((service) => {
                    // ✅ CORRECTION CRITIQUE: Utiliser UNIQUEMENT les produits depuis l'API service_products (nouveau système)
                    let serviceProduits: any[] = [];

                    // ✅ DEBUG 2026-01-13: Logs détaillés pour diagnostiquer les problèmes d'affichage
                    if (__DEV__) console.log(`🔍 [ResultatBesoinScreen] DEBUG extraction produits pour service ${service.id}:`, {
                        hasProductsFromAPI: !!service._productsFromAPI,
                        isArray: Array.isArray(service._productsFromAPI),
                        productsFromAPICount: Array.isArray(service._productsFromAPI) ? service._productsFromAPI.length : 0,
                        productsFromAPISample: Array.isArray(service._productsFromAPI) && service._productsFromAPI.length > 0
                            ? service._productsFromAPI[0]
                            : null
                    });

                    // ✅ CORRIGÉ 2026-03-07: Helper pour extraire un tableau de médias depuis différents formats
                    // Déplacé au niveau du forEach pour être accessible dans tout le bloc
                    const extractMediaField = (field: any): any[] => {
                        if (Array.isArray(field) && field.length > 0) return field;
                        if (field && typeof field === 'object' && Array.isArray(field.valeur)) return field.valeur;
                        if (field && typeof field === 'string') return [field];
                        return [];
                    };

                    // ✅ CORRIGÉ 2026-03-07: Normaliser les images/vidéos (extraire les URLs si ce sont des objets)
                    // Déplacé au niveau du forEach pour être accessible dans tout le bloc
                    const normalizeMediaArray = (mediaArray: any[]): string[] => {
                        const result: string[] = [];
                        for (const item of mediaArray) {
                            if (typeof item === 'string' && item.trim() && item !== 'false') {
                                result.push(item.trim());
                            } else if (item && typeof item === 'object') {
                                const val = item.url || item.path || item.uri || item.src;
                                if (typeof val === 'string' && val.trim()) {
                                    result.push(val.trim());
                                } else if (item.valeur) {
                                    if (typeof item.valeur === 'string' && item.valeur.trim()) {
                                        result.push(item.valeur.trim());
                                    } else if (Array.isArray(item.valeur)) {
                                        for (const sub of item.valeur) {
                                            if (typeof sub === 'string' && sub.trim() && sub !== 'false') {
                                                result.push(sub.trim());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return result;
                    };

                    // Produits depuis l'API service_products (nouveau système uniquement)
                    if (service._productsFromAPI && Array.isArray(service._productsFromAPI) && service._productsFromAPI.length > 0) {
                        serviceProduits = service._productsFromAPI.map((productFromAPI: any) => {
                            // ✅ Transformer le format API vers format attendu (product_data contient les données)
                            const productData = productFromAPI.product_data || productFromAPI;

                            if (__DEV__) {
                                console.log(`🔍 [ResultatBesoinScreen] Structure productFromAPI pour service ${service.id}:`, {
                                    hasProductData: !!productFromAPI.product_data,
                                    productDataKeys: productFromAPI.product_data ? Object.keys(productFromAPI.product_data) : [],
                                    productDataImages: productFromAPI.product_data?.images,
                                    productDataVideos: productFromAPI.product_data?.videos,
                                    directImages: productFromAPI.images,
                                    directVideos: productFromAPI.videos,
                                    allKeys: Object.keys(productFromAPI),
                                    productFromAPISample: JSON.stringify(productFromAPI).substring(0, 500),
                                });
                            }

                            const productName = getProductName(productData) || productFromAPI.product_name || '';

                            let extractedImages: any[] = [];
                            let extractedVideos: any[] = [];

                            // Source 1: productFromAPI.images/videos (direct)
                            extractedImages = extractMediaField(productFromAPI.images);
                            extractedVideos = extractMediaField(productFromAPI.videos);

                            // Source 2: productData.images/videos
                            if (extractedImages.length === 0 && productData) {
                                extractedImages = extractMediaField(productData.images);
                            }
                            if (extractedVideos.length === 0 && productData) {
                                extractedVideos = extractMediaField(productData.videos);
                            }

                            const normalizedImages = normalizeMediaArray(extractedImages);
                            const normalizedVideos = normalizeMediaArray(extractedVideos);

                            // ✅ CORRIGÉ 2026-01-20: Extraire correctement tous les champs du produit
                            // ✅ CORRIGÉ 2026-01-21: S'assurer que les images et vidéos sont bien incluses depuis product_data
                            // ✅ CORRIGÉ 2026-01-23: S'assurer que la description est explicitement extraite
                            const transformedProduct = {
                                // ✅ Préserver toutes les propriétés de product_data
                                ...productData,
                                // ✅ CRITIQUE: Garder product_data comme structure séparée pour ProductCard
                                product_data: productData, // ✅ Structure complète de product_data (inclut variants, has_variant, variation_prix, etc.)
                                // ✅ CORRIGÉ 2026-02-10: Utiliser les images/vidéos normalisées
                                images: normalizedImages,
                                videos: normalizedVideos,
                                // ✅ NOUVEAU 2026-01-XX: Préserver les variations de prix (variants, has_variant, variation_prix)
                                has_variant: productData.has_variant || productFromAPI.has_variant || false,
                                variants: productData.variants || productFromAPI.variants || [],
                                variation_prix: productData.variation_prix || productData.variabilite_prix || productData.price_variant || productFromAPI.variation_prix,
                                variant_dimension: productData.variant_dimension || productFromAPI.variant_dimension,
                                // ✅ Ajouter les propriétés de l'API si elles ne sont pas dans product_data
                                product_name: productName || productFromAPI.product_name,
                                product_type: productFromAPI.product_type || productData.type || productData.product_type,
                                product_price: productFromAPI.product_price || productData.prix_produit || productData.prix || productData.price,
                                // ✅ Ajouter l'index du produit pour référence
                                product_index: productFromAPI.product_index,
                                // ✅ Préserver l'ID si disponible
                                id: productFromAPI.id || productFromAPI.product_id,
                                // ✅ CORRIGÉ 2026-01-23: Utiliser le nom extrait correctement (même logique que DB)
                                nom_produit: productName,
                                nom: productName,
                                name: productName,
                                // ✅ CORRIGÉ 2026-01-23: S'assurer que la description est explicitement extraite et disponible
                                description: productData.description || productData.description_produit || '',
                                description_produit: productData.description_produit || productData.description || '',
                                // ✅ NOUVEAU 2026-01-23: Transmettre les statistiques dynamiques du service au produit
                                _serviceId: service.id,
                                _service: {
                                    ...service,
                                    reviews_count: service.reviews_count, // ✅ Statistique dynamique calculée par le backend
                                    rating_count: service.rating_count,
                                    average_rating: service.average_rating,
                                },
                            };

                            // ✅ DEBUG 2026-02-10: Log détaillé de chaque produit transformé avec description et images
                            if (__DEV__) console.log(`📦 [ResultatBesoinScreen] Produit transformé pour service ${service.id}:`, {
                                id: transformedProduct.id,
                                product_index: transformedProduct.product_index,
                                nom_produit: transformedProduct.nom_produit,
                                nom: transformedProduct.nom,
                                name: transformedProduct.name,
                                product_name: transformedProduct.product_name,
                                description: transformedProduct.description,
                                description_produit: transformedProduct.description_produit,
                                images_count: normalizedImages.length,
                                videos_count: normalizedVideos.length,
                            });

                            return transformedProduct;
                        });
                        if (__DEV__) {
                            console.log(`✅ [ResultatBesoinScreen] ${serviceProduits.length} produits depuis API service_products pour service ${service.id}`);
                            console.log(`📋 [ResultatBesoinScreen] Liste des produits extraits pour service ${service.id}:`,
                                serviceProduits.map((p: any) => ({
                                    id: p.id,
                                    product_index: p.product_index,
                                    nom_produit: p.nom_produit,
                                    nom: p.nom,
                                    name: p.name
                                }))
                            );
                        }
                    } else {
                        console.warn(`⚠️ [ResultatBesoinScreen] Aucun produit trouvé dans _productsFromAPI pour service ${service.id}`);
                    }
                    // ❌ SUPPRIMÉ: Plus de fallback vers l'ancien système (service.data.produits) - utiliser uniquement service_products

                    if (serviceProduits.length > 0) {
                        // ✅ CORRIGÉ 2026-03-02: Filtrer les produits par pertinence avec la recherche
                        // Ne garder QUE les produits qui correspondent à la requête (score > 0)
                        // Si un seul produit → scorer aussi pour vérifier la pertinence
                        // Si aucun produit pertinent → NE RIEN GARDER (pas de fallback vers le 1er produit)
                        // L'ancien code gardait serviceProduits[0] même quand il n'était pas pertinent
                        // (ex: "jus de fruit" quand on cherche "beignets")
                        let filteredServiceProduits = serviceProduits;
                        if (searchQuery) {
                            const scoredProducts = serviceProduits.map((p: any) => {
                                const score = calculateProductRelevanceScore(p, searchQuery);
                                // ✅ DEBUG 2026-03-06: Logger les détails du premier produit pour diagnostiquer
                                if (__DEV__ && (p.product_index === 0 || score === 0)) {
                                    const productData = p.product_data || p;
                                    console.log(`🔍 [ResultatBesoinScreen] DEBUG Score produit (index=${p.product_index}):`, {
                                        score,
                                        nom_produit: productData.nom_produit,
                                        product_name: productData.product_name,
                                        nom: productData.nom,
                                        name: productData.name,
                                        description: productData.description_produit || productData.description,
                                        hasImages: Array.isArray(productData.images) && productData.images.length > 0,
                                        imagesCount: Array.isArray(productData.images) ? productData.images.length : 0,
                                        id: productData.id,
                                        product_id: productData.product_id,
                                    });
                                }
                                return {
                                    product: p,
                                    relevanceScore: score,
                                };
                            });
                            const relevant = scoredProducts.filter((sp: any) => sp.relevanceScore > 0);

                            // ✅ DEBUG 2026-03-06: Logger les produits filtrés pour voir si le premier est éliminé
                            if (__DEV__) {
                                const firstProduct = serviceProduits.find(p => p.product_index === 0);
                                const firstProductScore = firstProduct ? scoredProducts.find(sp => sp.product === firstProduct)?.relevanceScore : null;

                                console.log(`🎯 [ResultatBesoinScreen] Service ${service.id}: Filtrage recherche "${searchQuery}"`, {
                                    totalProducts: serviceProduits.length,
                                    relevantCount: relevant.length,
                                    firstProductScore,
                                    firstProductFilteredOut: firstProductScore === 0,
                                    filteredProducts: relevant.map(sp => ({
                                        index: sp.product.product_index,
                                        score: sp.relevanceScore,
                                        nom: getProductName(sp.product.product_data || sp.product)
                                    }))
                                });
                            }
                            if (relevant.length > 0) {
                                // ✅ CORRIGÉ 2026-03-05: Trier par score de pertinence DÉCROISSANT
                                // Avant: les produits gardaient l'ordre d'insertion API (ex: "salle à manger" avant "beignets")
                                relevant.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
                                filteredServiceProduits = relevant.map((sp: any) => sp.product);
                                if (__DEV__) console.log(`🎯 [ResultatBesoinScreen] Service ${service.id}: ${filteredServiceProduits.length}/${serviceProduits.length} produits pertinents pour "${searchQuery}"`, relevant.map((sp: any) => ({ nom: getProductName(sp.product.product_data || sp.product), score: sp.relevanceScore })));
                            } else {
                                // ✅ CORRIGÉ 2026-03-02: Aucun produit pertinent → ne rien afficher pour ce service
                                // L'ancien code gardait le 1er produit par défaut, ce qui affichait des produits hors-sujet
                                filteredServiceProduits = [];
                                if (__DEV__) console.log(`🎯 [ResultatBesoinScreen] Service ${service.id}: aucun produit pertinent pour "${searchQuery}", service ignoré`);
                            }
                        }

                        filteredServiceProduits.forEach((product: any) => {
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
                                    }
                                } catch (error) {
                                    console.warn('⚠️ [ResultatBesoinScreen] Erreur calcul distance produit:', error);
                                }
                            }

                            // ✅ FALLBACK: Utiliser la distance du service si disponible et si la distance du produit n'a pas pu être calculée
                            if ((distance === undefined || !Number.isFinite(distance)) && service.distance !== undefined && Number.isFinite(service.distance)) {
                                distance = service.distance;
                            }

                            // ✅ NOUVEAU 2026-01-20: Calculer le score de pertinence au niveau produit
                            // Base: score du service (pertinence générale)
                            let finalScore = service.score || 0;

                            // ✅ AJOUT: Score de pertinence spécifique au produit par rapport à la requête
                            if (searchQuery) {
                                const productRelevanceScore = calculateProductRelevanceScore(product, searchQuery);
                                // Ajouter le score de pertinence produit (poids important pour différencier les produits)
                                finalScore += productRelevanceScore;

                                if (__DEV__) {
                                    const productDataForLog = product.product_data || product;
                                    const productNameForLog = getProductName(productDataForLog) || 'unknown';
                                    console.log(`🎯 [ResultatBesoinScreen] Score produit calculé pour "${productNameForLog}":`, {
                                        serviceScore: service.score || 0,
                                        productRelevanceScore,
                                        finalScore,
                                        searchQuery
                                    });
                                }
                            }

                            const isPromo = product.en_promotion || product.promotion_active;

                            if (isPromo) {
                                // Bonus significatif pour produits en publicité
                                finalScore += 100; // Forte priorité pour affichage
                            }

                            // ✅ CORRIGÉ 2026-02-10: Utiliser directement product.images/videos depuis transformedProduct
                            // ✅ transformedProduct.images/videos sont déjà normalisés et corrects (extraits dans lignes 754-805)
                            // ✅ Le backend enrichit product_data.images/videos avec URLs CDN complètes depuis la table media
                            // ✅ PRIORITÉ ABSOLUE: product.images/videos (déjà normalisés dans transformedProduct)
                            let productImages: string[] = Array.isArray(product.images) ? product.images : [];
                            let productVideos: string[] = Array.isArray(product.videos) ? product.videos : [];

                            // ✅ CORRIGÉ: Si product.images/videos sont vides, essayer product_data comme fallback (mais normaliser)
                            // ✅ Cela garantit que même si l'extraction initiale a échoué, on récupère les médias depuis product_data
                            if (productImages.length === 0) {
                                const productDataFromProduct = product.product_data || product;
                                const fallbackImages = Array.isArray(productDataFromProduct?.images)
                                    ? productDataFromProduct.images
                                    : productDataFromProduct?.images
                                        ? [productDataFromProduct.images]
                                        : [];

                                if (fallbackImages.length > 0) {
                                    // ✅ Normaliser les fallbacks avec la même fonction que l'extraction initiale
                                    productImages = normalizeMediaArray(fallbackImages);
                                    if (__DEV__) console.log(`[ResultatBesoinScreen] ✅ Images récupérées depuis product_data (fallback):`, productImages.length);
                                }
                            }

                            if (productVideos.length === 0) {
                                const productDataFromProduct = product.product_data || product;
                                const fallbackVideos = Array.isArray(productDataFromProduct?.videos)
                                    ? productDataFromProduct.videos
                                    : productDataFromProduct?.videos
                                        ? [productDataFromProduct.videos]
                                        : [];

                                if (fallbackVideos.length > 0) {
                                    // ✅ Normaliser les fallbacks avec la même fonction que l'extraction initiale
                                    productVideos = normalizeMediaArray(fallbackVideos);
                                    if (__DEV__) console.log(`[ResultatBesoinScreen] ✅ Vidéos récupérées depuis product_data (fallback):`, productVideos.length);
                                }
                            }

                            // ✅ CORRIGÉ 2026-03-02: SUPPRIMÉ le fallback vers les médias du service
                            // L'ancien fallback récupérait service.images/videos qui provenaient du PREMIER produit
                            // du service (pas du produit recherché). Chaque produit a maintenant ses propres médias
                            // correctement enrichis dans product_data par le backend (table media + presigned URLs).

                            // ✅ DEBUG 2026-01-22: Log pour diagnostiquer les images depuis la table media
                            if (__DEV__ && (productImages.length > 0 || productVideos.length > 0)) {
                                const productDataForLog = product.product_data || product;
                                const productNameForLog = getProductName(productDataForLog) || 'produit';
                                console.log(`[ResultatBesoinScreen] Images/vidéos extraites pour produit ${productNameForLog}:`, {
                                    productImagesCount: productImages.length,
                                    productVideosCount: productVideos.length,
                                    productHasImages: !!product.images,
                                    productHasVideos: !!product.videos,
                                    productDataHasImages: !!productDataForLog?.images,
                                    productDataHasVideos: !!productDataForLog?.videos,
                                    firstImageUrl: productImages[0]?.substring?.(0, 80) || productImages[0],
                                    firstVideoUrl: productVideos[0]?.substring?.(0, 80) || productVideos[0],
                                });
                            }

                            // ✅ CORRIGÉ: Créer un identifiant unique stable pour éviter les doublons
                            // Utiliser service_id-product_index si disponible, sinon id de la table service_products
                            const productDataForId = product.product_data || product;
                            const productNameForId = getProductName(productDataForId) || 'unknown';
                            const stableProductId = product.product_index !== undefined
                                ? `${service.id}_${product.product_index}`
                                : product.id || product.product_id || `${service.id}-${productNameForId}`;

                            // ✅ CORRIGÉ 2026-01-22: CRITIQUE - ProductCard attend product.product_data
                            // Il faut garder product_data comme structure séparée ET aplatir les propriétés principales
                            // ✅ product contient déjà product_data (ajouté dans transformedProduct)
                            extractedProducts.push({
                                // ✅ Propriétés principales au niveau racine (pour compatibilité)
                                ...product,
                                // ✅ CORRIGÉ: S'assurer que l'ID est toujours défini et unique
                                id: stableProductId,
                                product_id: stableProductId,
                                // ✅ CRITIQUE: product_data est déjà dans product (ajouté dans transformedProduct)
                                // ProductCard fait: const productData = product.product_data || product;
                                _serviceId: service.id,
                                _service: {
                                    ...service,
                                    // ✅ NOUVEAU 2026-01-23: Transmettre les statistiques dynamiques calculées par le backend
                                    reviews_count: service.reviews_count,
                                    rating_count: service.rating_count,
                                    average_rating: service.average_rating,
                                },
                                _prestataire: prestataires.get(service.user_id),
                                _gps: bestGPS,
                                _gpsSource: productGPS ? 'product' : (serviceGPSFixe ? 'service_fixe' : 'service_realtime'),
                                distance: distance,
                                distance_km: distance, // ✅ Ajout pour compatibilité ProductCard
                                // ✅ CORRIGÉ 2026-02-10: S'assurer que les images/vidéos depuis la table media sont bien incluses
                                // ✅ Les URLs CDN sont déjà des URLs complètes (https://...) depuis le backend via build_public_url()
                                // ✅ Le backend enrichit product_data.images/videos avec les médias depuis la table media (lignes 118-158 de products_controller.rs)
                                // ✅ CORRIGÉ: Utiliser product.images/videos s'ils existent (déjà extraits dans transformedProduct depuis product_data.images/videos)
                                // ✅ Sinon, utiliser productImages/productVideos (fallbacks vers service)
                                // ✅ transformedProduct.images/videos contient déjà les médias depuis product_data.images/videos enrichis par le backend
                                images: (Array.isArray(product.images) && product.images.length > 0) ? product.images : productImages,
                                videos: (Array.isArray(product.videos) && product.videos.length > 0) ? product.videos : productVideos,
                                score: finalScore, // ✅ Score ajusté avec bonus promo
                                en_promotion: isPromo, // Passer le flag
                                promotion_active: isPromo
                            });
                        });
                    }
                });

                if (__DEV__) {
                    console.log(`📦 [ResultatBesoinScreen] ${extractedProducts.length} produits extraits de ${validServices.length} services`);
                    if (extractedProducts.length > 0) {
                        console.log(`🔍 [ResultatBesoinScreen] DEBUG produits extraits (avant déduplication):`,
                            extractedProducts.map((p: any) => ({
                                id: p.id,
                                product_index: p.product_index,
                                nom: p.nom || p.name,
                                _serviceId: p._serviceId,
                                score: p.score,
                            }))
                        );
                    }
                }

                // ✅ CORRIGÉ: Dédupliquer les produits basés sur un identifiant unique stable
                // Utiliser le même format que ProductCard pour garantir la cohérence
                const seenProductIds = new Set<string>();
                const deduplicatedProducts = extractedProducts.filter((product) => {
                    // ✅ CORRIGÉ: Utiliser le même format d'ID que ProductCard
                    // Priorité: service_id-product_index (format standard) > id de la table > fallback
                    const serviceId = product._serviceId || product.service_id;
                    const productIndex = product.product_index !== undefined && product.product_index !== null
                        ? product.product_index
                        : (typeof product.index === 'number' ? product.index : undefined);

                    let productUniqueId: string;
                    if (productIndex !== undefined && productIndex !== null && serviceId) {
                        // Format standard: service_id-product_index
                        productUniqueId = `${serviceId}_${productIndex}`;
                    } else if (product.id || product.product_id) {
                        // ID de la table service_products
                        productUniqueId = String(product.id || product.product_id);
                    } else {
                        // Fallback: service_id-nom
                        const productDataForId = product.product_data || product;
                        const productNameForId = getProductName(productDataForId) || 'unknown';
                        productUniqueId = serviceId
                            ? `${serviceId}-${productNameForId}`
                            : `unknown-${productNameForId}`;
                    }

                    if (seenProductIds.has(productUniqueId)) {
                        const productDataForLog = product.product_data || product;
                        const productNameForLog = getProductName(productDataForLog) || 'produit';
                        console.warn(`⚠️ [ResultatBesoinScreen] Produit dupliqué détecté et ignoré: ${productUniqueId} (${productNameForLog})`);
                        return false;
                    }
                    seenProductIds.add(productUniqueId);
                    // ✅ CORRIGÉ: S'assurer que l'ID du produit correspond au format utilisé pour la déduplication
                    product.id = productUniqueId;
                    product.product_id = productUniqueId;
                    return true;
                });

                if (__DEV__) {
                    console.log(`📦 [ResultatBesoinScreen] ${deduplicatedProducts.length} produits après déduplication (${extractedProducts.length - deduplicatedProducts.length} doublons supprimés)`);
                    if (deduplicatedProducts.length === 0 && extractedProducts.length > 0) {
                        console.error(`❌ [ResultatBesoinScreen] PROBLÈME: ${extractedProducts.length} produits extraits mais 0 après déduplication!`);
                    }
                }

                // ✅ TRI PRIORITAIRE : Produits en promotion d'abord
                deduplicatedProducts.sort((a, b) => {
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

                if (__DEV__) console.log(`📊 [ResultatBesoinScreen] Produits triés: ${deduplicatedProducts.length} produits (ordre final)`);

                // ✅ CORRIGÉ 2026-01-13: Utiliser startTransition pour les mises à jour non urgentes
                startTransition(() => {
                    setProducts(deduplicatedProducts);
                    if (__DEV__) console.log(`✅ [ResultatBesoinScreen] ${deduplicatedProducts.length} produits définis dans l'état pour affichage`);
                });

                // Récupérer les informations des prestataires
                const userIds = validServices.map(service => service.user_id).filter(id => id);
                if (userIds.length > 0) {
                    await fetchPrestatairesBatch(userIds);
                } else {
                    // Aucun prestataire à charger, marquer comme chargé
                    if (__DEV__) console.log('📊 Aucun prestataire à charger');
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
            if (__DEV__) console.log('🔄 Début du chargement des prestataires pour:', userIds);

            const prestatairePromises = userIds.map(async (userId) => {
                try {
                    const response = await apiGet(`/api/users/profile/${userId}`);
                    if (response.data) {
                        if (__DEV__) console.log(`✅ Prestataire ${userId} chargé`);
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
                    if (__DEV__) console.log(`📝 Prestataire ${result.userId} normalisé:`, normalizedPrestataire.name);
                }
            });

            if (__DEV__) console.log(`📊 ${newPrestataires.size} prestataires chargés sur ${userIds.length} demandés`);

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
                // ✅ CORRIGÉ 2026-01-13: Utiliser startTransition pour les mises à jour non urgentes
                startTransition(() => {
                    setPrestataires(newPrestataires);
                });
            }

            // ✅ CORRIGÉ 2026-01-14: Mettre à jour les produits avec debounce plus long pour éviter les re-renders en cascade
            // Annuler le timeout précédent s'il existe
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }

            // ✅ CORRIGÉ: Debounce augmenté à 300ms pour mieux regrouper et éviter les tremblements
            updateTimeoutRef.current = setTimeout(() => {
                startTransition(() => {
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
                                        // ✅ CORRIGÉ: Créer un nouvel objet seulement si nécessaire, sans changer la référence du produit
                                        return {
                                            ...product,
                                            _prestataire: prestataire
                                        };
                                    }
                                }
                            }
                            // ✅ CORRIGÉ: Retourner la même référence si pas de changement
                            return product;
                        });

                        // ✅ CORRIGÉ: Ne retourner un nouveau tableau que s'il y a des changements réels
                        if (!hasChanges) {
                            return prevProducts; // Même référence = pas de re-render
                        }

                        return updatedProducts;
                    });
                });
                updateTimeoutRef.current = null;
            }, 300); // ✅ Debounce augmenté à 300ms pour mieux regrouper les mises à jour et éviter les tremblements

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
            if (__DEV__) console.log('⏭️ [ResultatBesoinScreen] Résultats déjà traités, skip');
            return;
        }

        const processResults = async () => {
            try {
                // ✅ AMÉLIORÉ: Validation robuste des résultats initiaux
                if (!initialResults) {
                    if (__DEV__) console.log('⚠️ [ResultatBesoinScreen] Aucun résultat initial fourni (null/undefined)');
                    hasProcessedInitialResults.current = true;
                    initialResultsLength.current = 0;
                    setLoading(false);
                    setPrestatairesLoaded(true);
                    return;
                }

                if (!Array.isArray(initialResults)) {
                    console.error('❌ [ResultatBesoinScreen] Résultats initiaux ne sont pas un array:', typeof initialResults, initialResults);
                    hasProcessedInitialResults.current = true;
                    initialResultsLength.current = 0;
                    setLoading(false);
                    setPrestatairesLoaded(true);
                    setError('Format de résultats invalide');
                    return;
                }

                if (initialResults.length === 0) {
                    if (__DEV__) console.log('⚠️ [ResultatBesoinScreen] Aucun résultat initial fourni (array vide)');
                    hasProcessedInitialResults.current = true;
                    initialResultsLength.current = 0;
                    setLoading(false);
                    setPrestatairesLoaded(true);
                    return;
                }

                if (__DEV__) console.log('🔄 [ResultatBesoinScreen] Traitement des résultats initiaux:', initialResults.length);

                // Marquer comme traité AVANT le traitement asynchrone
                hasProcessedInitialResults.current = true;
                initialResultsLength.current = initialResults.length;

                // ✅ AMÉLIORÉ: Trier les résultats avec gestion d'erreur robuste
                let sortedResults: SearchResult[] = [];
                try {
                    sortedResults = await sortResultsByRelevanceAndProximity(initialResults);
                    if (__DEV__) console.log('✅ [ResultatBesoinScreen] Résultats triés:', sortedResults.length);
                } catch (sortError) {
                    console.error('❌ [ResultatBesoinScreen] Erreur lors du tri des résultats:', sortError);
                    // Fallback: utiliser les résultats initiaux sans tri
                    sortedResults = initialResults.filter((r: any) => r && r.service_id) as SearchResult[];
                    if (__DEV__) console.warn('⚠️ [ResultatBesoinScreen] Utilisation des résultats sans tri (fallback)');
                }

                // ✅ AMÉLIORÉ: Extraction des IDs avec validation robuste
                const serviceIds = sortedResults
                    .filter((result: any) => {
                        if (!result || typeof result !== 'object') {
                            console.warn('⚠️ [ResultatBesoinScreen] Résultat invalide lors de l\'extraction des IDs:', result);
                            return false;
                        }
                        return true;
                    })
                    .map((result: any) => {
                        try {
                            const id = result.service_id;
                            if (!id || id === 'undefined' || id === 'null') {
                                return null;
                            }
                            return id.toString();
                        } catch (error) {
                            console.warn('⚠️ [ResultatBesoinScreen] Erreur extraction service_id:', error, result);
                            return null;
                        }
                    })
                    .filter((id: any): id is string => id !== null && id !== undefined && id !== '');

                if (__DEV__) console.log('📋 [ResultatBesoinScreen] IDs des services à charger:', serviceIds.length, serviceIds);

                if (serviceIds.length > 0) {
                    await fetchServicesByIds(serviceIds, sortedResults);
                } else {
                    if (__DEV__) console.warn('⚠️ [ResultatBesoinScreen] Aucun service ID valide trouvé après extraction');
                    setLoading(false);
                    setPrestatairesLoaded(true);
                    setError('Aucun service valide trouvé dans les résultats');
                }
            } catch (error: any) {
                console.error('❌ [ResultatBesoinScreen] Erreur CRITIQUE lors du traitement des résultats:', error);
                console.error('❌ [ResultatBesoinScreen] Stack trace:', error?.stack);
                console.error('❌ [ResultatBesoinScreen] Résultats initiaux:', initialResults);
                setLoading(false);
                setPrestatairesLoaded(true);
                setError(`Erreur lors du traitement des résultats: ${error?.message || 'Erreur inconnue'}`);
            }
        };

        // Ajouter un timeout de sécurité
        const timeoutId = setTimeout(() => {
            if (!prestatairesLoaded) {
                if (__DEV__) console.warn('⏰ Timeout atteint, forcer le chargement');
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

    // ✅ CORRIGÉ 2026-03-06: Fonction pour arrêter toutes les vidéos actuelles
    const stopAllVideos = useCallback(() => {
        stopAllVideosAndClearQueue();
    }, [stopAllVideosAndClearQueue]);

    // ✅ CORRIGÉ 2026-03-06: Gestion du scroll pour arrêter les vidéos
    const handleScrollBegin = useCallback(() => {
        isScrollingRef.current = true;
        setIsScrollingState(true); // ✅ FIX 2026-03-11: Déclencher re-render pour propager isScrolling aux cartes
        stopAllVideos();

        // Annuler le timeout précédent
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
    }, [stopAllVideos]);

    const handleScrollEnd = useCallback(() => {
        // Marquer la fin du scroll après un délai pour éviter les faux positifs
        scrollTimeoutRef.current = setTimeout(() => {
            isScrollingRef.current = false;
            setIsScrollingState(false); // ✅ FIX 2026-03-11: Déclencher re-render pour propager isScrolling aux cartes
        }, 300);
    }, []);

    // ✅ CORRIGÉ 2026-03-06: Nettoyer les timeouts et vidéos au démontage
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            stopAllVideos();
        };
    }, [stopAllVideos]);

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
                    `Comment souhaitez-vous contacter ${prestataire?.nom_complet || prestataire?.nom || prestataire?.name || 'ce prestataire'} ?`,
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

                if (__DEV__) console.log('[ResultatBesoinScreen] Notification de chat ouvert envoyée au prestataire');
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

    const handleShare = useCallback(async (service: Service) => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }
        try {
            const titre = service.titre || service.title || service.data?.titre_service?.valeur || 'Service Yukpo';
            const description = service.description || service.data?.description?.valeur || '';
            const prix = service.prix || service.data?.prix?.valeur;
            const devise = service.devise || 'XAF';
            const serviceLocation = service.localisation || service.data?.localisation?.valeur || '';

            // Essayer de trouver le premier produit du service pour un lien produit précis
            const serviceProducts = services.find(s => s.id === service.id);
            const firstProductIndex = 0;
            const serviceId = service.id;

            const shareMessage = generateProductShareMessage({
                productName: titre,
                productDescription: description,
                price: prix ? (typeof prix === 'string' ? parseFloat(prix) || undefined : prix) : undefined,
                devise,
                location: serviceLocation,
                productId: firstProductIndex,
                serviceId,
            });

            const smartLink = generateSmartShareLink(firstProductIndex, serviceId);

            const result = await Share.share({
                message: shareMessage,
                title: titre,
                url: smartLink,
            });

            if (result.action === Share.sharedAction) {
                if (__DEV__) console.log('[ResultatBesoinScreen] Service partagé avec succès');
            }
        } catch (error) {
            console.error('[ResultatBesoinScreen] Erreur partage:', error);
        }
    }, [services]);

    const handleFavorite = useCallback((service: Service) => {
        Alert.alert('Favoris', `Service ${service.titre || service.title || 'Service'} ajouté aux favoris`);
    }, []);

    const handleReview = useCallback((service: Service) => {
        Alert.alert('Avis', 'Ouverture du formulaire d\'avis');
    }, []);

    const handleServicePress = useCallback((service: Service) => {
        if (__DEV__) console.log('Service pressé:', service.id);
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
                if (__DEV__) console.log('[ResultatBesoinScreen] Notification de contact créée pour le prestataire');
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
            if (__DEV__) console.log('[ResultatBesoinScreen] Recherche avec:', {
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

            // ✅ CORRIGÉ 2026-03-05: Mettre à jour searchQuery pour que le scoring produit utilise la nouvelle requête
            const newSearchText = searchPayload.texte || '';
            if (newSearchText) {
                setSearchQuery(newSearchText);
            }

            const result = await rechercherServices(searchPayload);
            if (__DEV__) console.log('[ResultatBesoinScreen] Résultat API brut:', result);

            // Parser les résultats (même logique que HomeScreen)
            let results = [];
            if (result?.resultats?.resultats && Array.isArray(result.resultats.resultats)) {
                results = result.resultats.resultats;
                if (__DEV__) console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.resultats.resultats:', results.length);
            }
            else if (result?.resultats && Array.isArray(result.resultats)) {
                results = result.resultats;
                if (__DEV__) console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.resultats:', results.length);
            }
            else if (result?.results && Array.isArray(result.results)) {
                results = result.results;
                if (__DEV__) console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.results:', results.length);
            }
            else if (result?.data?.resultats && Array.isArray(result.data.resultats)) {
                results = result.data.resultats;
                if (__DEV__) console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.data.resultats:', results.length);
            }
            else if (result?.data && Array.isArray(result.data)) {
                results = result.data;
                if (__DEV__) console.log('[ResultatBesoinScreen] ✅ Résultats trouvés dans result.data:', results.length);
            }

            if (results.length > 0) {
                if (__DEV__) console.log('[ResultatBesoinScreen] Traitement de', results.length, 'résultats');

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
                if (__DEV__) console.log('[ResultatBesoinScreen] Aucun résultat trouvé');
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

    // ✅ updateTimeoutRef déclaré en haut du composant avec les autres refs

    // ✅ CORRIGÉ 2025-01-02: Mémoriser les listes filtrées avec comparaison profonde pour éviter les recalculs inutiles
    const filteredProducts = useMemo(() => {
        // ✅ OPTIMISÉ 2026-03-XX: Logs gatés derrière __DEV__ pour performance production
        if (__DEV__) {
            console.log('🔍 [ResultatBesoinScreen] filterProducts:', products.length, 'produits, filtres:', Object.keys(categoryFilters).length);
        }

        if (products.length === 0) {
            if (__DEV__) console.warn('⚠️ [ResultatBesoinScreen] filterProducts - Aucun produit');
            return [];
        }

        const filtered = filterProducts(products);
        if (__DEV__) {
            console.log('✅ [ResultatBesoinScreen] filterProducts:', filtered.length, '/', products.length);
            if (filtered.length === 0 && products.length > 0) {
                console.error('❌ [ResultatBesoinScreen] Tous les produits filtrés!', { categoryFilters, priceFilter });
            }
        }

        return filtered;
    }, [products, categoryFilters, priceFilter, sortBy]);

    const filteredServices = useMemo(() => {
        // ✅ Comparer les longueurs et références pour éviter les recalculs inutiles
        if (services.length === 0) return [];
        return filterAndSortServices(services);
    }, [services, priceFilter, sortBy]);

    // ✅ CORRIGÉ 2026-01-14: Mémoriser la liste combinée avec clés STABLES (sans score qui change)
    // ✅ CORRIGÉ 2026-01-XX: Éviter les doublons - ne pas afficher les services qui ont déjà des produits extraits
    const allResults = useMemo(() => {
        if (__DEV__) console.log('🔍 [ResultatBesoinScreen] allResults:', filteredServices.length, 'services,', filteredProducts.length, 'produits');

        // ✅ NOUVEAU: Créer un Set des serviceIds qui ont des produits pour éviter les doublons
        // ✅ CORRIGÉ: Vérifier aussi service_id en plus de _serviceId
        const serviceIdsWithProducts = new Set(
            filteredProducts
                .map(p => {
                    const serviceId = p._serviceId || p.service_id || p._service?.id || '';
                    return String(serviceId);
                })
                .filter(id => id && id !== 'undefined' && id !== 'null' && id !== '')
        );

        // ✅ OPTIMISÉ 2026-03-XX: Debug gaté derriere __DEV__
        if (__DEV__) console.log('🔍 [ResultatBesoinScreen] serviceIdsWithProducts:', serviceIdsWithProducts.size);

        // ✅ CORRIGÉ: Ne pas afficher les services qui ont déjà des produits (éviter doublon)
        const services = filteredServices
            .filter(service => {
                const serviceId = String(service.id);
                const hasProducts = serviceIdsWithProducts.has(serviceId);
                if (hasProducts && __DEV__) {
                    console.log(`🔄 [ResultatBesoinScreen] Service ${serviceId} ignoré (produits extraits)`);
                }
                return !hasProducts; // Afficher uniquement les services SANS produits
            })
            .map(service => ({
                type: 'service' as const,
                data: service,
                // ✅ CORRIGÉ: Clé stable sans score pour éviter les re-renders
                key: `service-${service.id}`
            }));
        const products = filteredProducts.map((product, idx) => {
            // ✅ CORRIGÉ: Clé stable basée uniquement sur des propriétés immuables (sans score)
            // Utiliser le même format d'ID que ProductCard pour garantir la cohérence
            const serviceId = product._serviceId || product.service_id || 'unknown';
            const productIndex = product.product_index !== undefined && product.product_index !== null
                ? product.product_index
                : (typeof product.index === 'number' ? product.index : undefined);
            const productDataForName = product.product_data || product;
            const productName = getProductName(productDataForName) || `product-${idx}`;

            // ✅ CORRIGÉ: Utiliser le même format d'ID que ProductCard et la déduplication
            let productUniqueId: string;
            if (productIndex !== undefined && productIndex !== null && serviceId) {
                productUniqueId = `${serviceId}_${productIndex}`;
            } else if (product.id || product.product_id) {
                productUniqueId = String(product.id || product.product_id);
            } else {
                productUniqueId = `${serviceId}-${productName}`;
            }

            return {
                type: 'product' as const,
                data: product,
                key: `product-${productUniqueId}`
            };
        });

        const allResultsArray = [...services, ...products];
        if (__DEV__) {
            console.log('✅ [ResultatBesoinScreen] allResults:', allResultsArray.length, '(services:', services.length, ', produits:', products.length, ')');
        }

        return allResultsArray;
    }, [filteredServices, filteredProducts, getProductName]);

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

    // ✅ CORRIGÉ 2026-01-14: Fonction pour rendre ProductCard avec React.memo pour éviter les re-renders
    const renderProductCard = useCallback((product: any) => {
        // ✅ CORRIGÉ: Vérifier que product existe
        if (!product) {
            if (__DEV__) console.warn('[ResultatBesoinScreen] ⚠️ Product est undefined dans renderProductCard');
            return null;
        }

        const service = product._service;
        // ✅ Priorité: prestataire dans le produit > prestataire dans la Map > null
        const prestataireFromProduct = product._prestataire;
        const prestataireFromMap = service?.user_id ? prestatairesRef.current.get(service.user_id) : null;
        const prestataire = prestataireFromProduct || prestataireFromMap || null;

        // ✅ CORRIGÉ 2026-01-23: Utiliser la fonction utilitaire pour extraire le nom correctement
        // ✅ CORRIGÉ 2026-01-23: S'assurer que productData n'est jamais undefined
        const productData = product?.product_data || product || {};
        const productName = getProductName(productData) || 'Produit sans nom';
        const serviceId = product._serviceId || service?.id || 'unknown';

        // Créer l'objet coordinateur pour ce produit
        const videoCoordinator = {
            requestVideoPlayback,
            releaseVideoPlayback,
        };

        return (
            <MemoizedProductCardWithCoordinator
                key={`product-${serviceId}-${productName}`}
                product={product}
                service={service}
                prestataire={prestataire}
                userLocation={userLocationMemo}
                isScrolling={isScrollingState}
                videoCoordinator={videoCoordinator}
                onPress={() => {
                    // ✅ CORRIGÉ 2026-02-25: Naviguer vers la boutique du prestataire pour afficher TOUS ses produits
                    if (service?.user_id) {
                        const prestataireNameForNav = prestataire?.nom || prestataire?.nom_complet || prestataire?.name || 'Prestataire';
                        navigation.navigate('PrestataireBoutique' as never, {
                            userId: service.user_id,
                            user_id: service.user_id,
                            prestataireName: prestataireNameForNav,
                            name: prestataireNameForNav,
                            clickedProduct: product,
                            clickedService: service,
                        } as never);
                    }
                }}
                onChatPress={() => {
                    console.log('[ResultatBesoinScreen] Chat button pressed', {
                        product: product?.nom || product?.product_data?.nom,
                        service: service?.id,
                        prestataire: prestataire?.nom || prestataire?.nom_complet,
                        hasService: !!service,
                        hasPrestataire: !!prestataire
                    });
                    setSelectedProduct(product);
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                    setShowChatModal(true);
                    console.log('[ResultatBesoinScreen] Chat modal state set to true');
                }}
            />
        );
    }, [userLocationMemo, isScrollingState, getProductName, navigation, requestVideoPlayback, releaseVideoPlayback]); // ✅ Utiliser userLocationMemo au lieu de location directement

    // ✅ NOUVEAU 2026-01-XX: Fonction pour rendre ProductCard pour les services (utiliser le même visuel que les produits)
    // ✅ DÉPLACÉ avant renderListItem pour éviter les problèmes de dépendances
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
            <MemoizedProductCard
                key={`service-${service.id}`}
                product={serviceAsProduct}
                service={service}
                prestataire={prestataire}
                userLocation={userLocationMemo}
                isScrolling={isScrollingState}
                onPress={() => {
                    // ✅ CORRIGÉ 2026-02-25: Naviguer vers la boutique du prestataire pour afficher TOUS ses produits
                    if (service?.user_id) {
                        const prestataireNameForNav = prestataire?.nom || prestataire?.nom_complet || prestataire?.name || 'Prestataire';
                        navigation.navigate('PrestataireBoutique' as never, {
                            userId: service.user_id,
                            user_id: service.user_id,
                            prestataireName: prestataireNameForNav,
                            name: prestataireNameForNav,
                            clickedService: service,
                        } as never);
                    }
                }}
                onChatPress={() => {
                    setSelectedService(service);
                    setSelectedPrestataire(prestataire);
                    setShowChatModal(true);
                }}
            />
        );
    }, [userLocationMemo, isScrollingState, getPrestataire, navigation]); // ✅ Utiliser handleServiceClick au lieu de handleServicePress

    // ✅ NOUVEAU 2026-01-14: renderItem mémorisé pour FlatList pour éviter les re-renders
    const renderListItem = useCallback(({ item }: { item: { type: 'service' | 'product'; data: any; key: string } }) => {
        // ✅ CORRIGÉ: Vérifier que item et item.data existent
        if (!item || !item.data) {
            if (__DEV__) console.warn('[ResultatBesoinScreen] ⚠️ Item ou item.data est undefined:', item);
            return null;
        }

        if (item.type === 'service') {
            const service = item.data as Service;
            if (!service) {
                if (__DEV__) console.warn('[ResultatBesoinScreen] ⚠️ Service est undefined');
                return null;
            }
            return renderServiceAsProductCard(service);
        } else {
            const product = item.data;
            if (!product) {
                if (__DEV__) console.warn('[ResultatBesoinScreen] ⚠️ Product est undefined');
                return null;
            }
            return renderProductCard(product);
        }
    }, [renderServiceAsProductCard, renderProductCard]);

    // ✅ NOUVEAU 2026-01-14: keyExtractor mémorisé pour FlatList
    const keyExtractor = useCallback((item: { key: string }, index: number) => {
        return item.key || `item-${index}`;
    }, []);

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
                keyboardShouldPersistTaps="handled"
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
                                        if (__DEV__) console.log('[ResultatBesoinScreen] Localisation GPS définie:', { lat, lng });
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
                                                // ✅ CORRIGÉ 2026-02-25: Afficher uniquement allResults.length (déjà dédupliqué)
                                                // products.length + services.length double-comptait les services ayant des produits
                                                const total = allResults.length;
                                                return `${total} résultat${total > 1 ? 's' : ''}`;
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
                                if (__DEV__) console.log('Filtres appliqués:', filters);
                            }}
                            initialFilters={categoryFilters}
                        />

                        {/* ✅ CORRIGÉ 2026-03-06: FlatList optimisée avec gestion des vidéos */}
                        {allResults.length > 0 ? (
                            <FlatList
                                data={allResults}
                                renderItem={renderListItem}
                                keyExtractor={keyExtractor}
                                contentContainerStyle={styles.servicesContainer}
                                showsVerticalScrollIndicator={false}
                                onScrollBeginDrag={handleScrollBegin}
                                onScrollEndDrag={handleScrollEnd}
                                onMomentumScrollBegin={handleScrollBegin}
                                onMomentumScrollEnd={handleScrollEnd}
                                removeClippedSubviews={true}
                                maxToRenderPerBatch={10}
                                updateCellsBatchingPeriod={50}
                                initialNumToRender={5}
                                windowSize={10}
                                getItemLayout={(data, index) => ({
                                    length: 300, // Hauteur approximative d'une ProductCard
                                    offset: 300 * index,
                                    index,
                                })}
                                refreshControl={
                                    <RefreshControl
                                        refreshing={refreshing}
                                        onRefresh={onRefresh}
                                        colors={[theme.colors.primary]}
                                    />
                                }
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
                        )}

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
        paddingTop: 0, // ✅ RÉDUIT: Éliminer l'espacement excessif en haut
        paddingBottom: 20,
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
        paddingHorizontal: 16, // ✅ RÉDUIT: De padding: 16 à paddingHorizontal: 16
        paddingVertical: 8, // ✅ AJOUTÉ: paddingVertical explicite et réduit
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
        paddingHorizontal: 16,
        paddingVertical: 4, // ✅ RÉDUIT: De 8 à 4 pour compacter l'espacement vertical
        backgroundColor: 'white',
        marginBottom: 8, // ✅ AJOUTÉ: Margin bottom explicite et réduit
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
        paddingHorizontal: 16, // ✅ CORRIGÉ 2026-03-11: Augmenté pour meilleur équilibre des cartes
        paddingVertical: 2,
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
        marginTop: 0, // ✅ RÉDUIT: De 4 à 0 pour éliminer complètement le vide excessif en haut
        marginBottom: 8, // ✅ RÉDUIT: De 8 à 8 inchangé
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






