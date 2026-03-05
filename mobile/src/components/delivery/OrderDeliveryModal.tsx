import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Modal,
    Image as RNImage,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { config } from '../../config/environment';
import { UserSavedAddress } from '../../hooks/useSavedAddresses';
import { apiGet, apiPost, userApi } from '../../services/api';
import { notificationSoundService } from '../../services/notificationSoundService';
import { modernColors } from '../../theme/modernTheme';
import { LocationObject } from '../LocationSelector';
import ModernGPSModal from '../ModernGPSModal';
import NativeDatePicker from '../NativeDatePicker';
import NativeTimePicker from '../NativeTimePicker';
import SafeIcon from '../SafeIcon';
import { SavedAddressSelector } from './SavedAddressSelector';

interface ProductVariant {
    valeur?: string;
    value?: string;
    prix?: number;
    price?: number;
    devise?: string;
    currency?: string;
    stock?: number;
    quantite?: number;
    image?: string;
    conditionnement?: string;
    [key: string]: any;
}

interface OrderDeliveryModalProps {
    visible: boolean;
    onClose: () => void;
    serviceId: number | null | undefined; // ✅ CORRIGÉ: Accepter null/undefined pour éviter les crashes
    productIndex?: number;
    productName?: string;
    onSuccess?: (deliveryId: string) => void;
    // ✅ NOUVEAU : Pour prix négociés
    conversationId?: number;
    clientUserId?: number;
    // ✅ NOUVEAU 2026-01-23: Variations de prix du produit
    productVariants?: ProductVariant[];
    selectedVariantIndex?: number;
    // ✅ FIX 2026-03-03: Prix du produit passé directement depuis ProductCard
    initialProductPrice?: number;
}

interface Location {
    latitude: number;
    longitude: number;
    address?: string;
}

interface Product {
    index: number;
    name: string;
    price: number;
    originalPrice?: number;
    hasPromotion?: boolean;
    promotionType?: string;
    promotionValeur?: string;
    thumbnail?: string;
}

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

interface UserMeResponse {
    gps?: string;
    [key: string]: any;
}

interface ServiceResponse {
    data?: {
        produits?: {
            valeur?: any[];
        } | any[];
    };
    [key: string]: any;
}

interface DeliveryCostsResponse {
    delivery_cost_cents?: number;
    is_delivery_free?: boolean;
    [key: string]: any;
}

interface DeliveryOrderResponse {
    delivery?: {
        id: string;
    };
    [key: string]: any;
}

const OrderDeliveryModal: React.FC<OrderDeliveryModalProps> = ({
    visible,
    onClose,
    serviceId,
    productIndex,
    productName,
    onSuccess,
    conversationId, // ✅ NOUVEAU
    clientUserId, // ✅ NOUVEAU
    productVariants, // ✅ NOUVEAU 2026-01-23: Variations de prix
    selectedVariantIndex, // ✅ NOUVEAU 2026-01-23: Index de variation présélectionné
    initialProductPrice, // ✅ FIX 2026-03-03: Prix initial du produit
}) => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
    const [notes, setNotes] = useState('');
    const [userGPS, setUserGPS] = useState<Location | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false); // ✅ NOUVEAU : Pour ouvrir le modal GPS

    // ✅ FIX 2026-03-03: Toast de confirmation animé
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const showToast = useCallback((message: string, duration: number = 3000) => {
        setToastMessage(message);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(duration),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setToastMessage(null));
    }, [toastOpacity]);

    // ✅ NOUVEAU 2026-01-23: État pour la sélection de variation et quantité
    const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(
        selectedVariantIndex !== undefined ? selectedVariantIndex : (productVariants && productVariants.length > 0 ? 0 : -1)
    );
    const [quantity, setQuantity] = useState<number>(1); // ✅ Quantité par défaut à 1

    // ✅ Phase 3 - Amélioration 7 : Préférences de livraison
    const [preferredDeliveryDate, setPreferredDeliveryDate] = useState<string>(''); // Format YYYY-MM-DD pour l'API
    const [preferredDeliveryDateDisplay, setPreferredDeliveryDateDisplay] = useState<string>(''); // Format JJ/MM/AAAA pour l'affichage
    const [preferredDeliveryTimeStart, setPreferredDeliveryTimeStart] = useState<string>('');
    const [preferredDeliveryTimeEnd, setPreferredDeliveryTimeEnd] = useState<string>('');
    const [isFlexible, setIsFlexible] = useState<boolean>(true);
    const [flexibilityWindowDays, setFlexibilityWindowDays] = useState<number>(3);
    const [urgencyLevel, setUrgencyLevel] = useState<'standard' | 'urgent' | 'scheduled'>('standard');

    // ✅ Phase 7 - Amélioration 23 : Coûts de livraison
    // ✅ FIX 2026-03-03: Initialiser avec initialProductPrice si fourni
    const [productPrice, setProductPrice] = useState<number | null>(initialProductPrice && initialProductPrice > 0 ? initialProductPrice : null);
    const [deliveryCost, setDeliveryCost] = useState<number | null>(null);
    const [isDeliveryFree, setIsDeliveryFree] = useState<boolean>(false);
    const [loadingCosts, setLoadingCosts] = useState(false);

    // ✅ NOUVEAU: Assurance et solde utilisateur
    const [insuranceCost, setInsuranceCost] = useState<number>(0);
    const [userBalance, setUserBalance] = useState<number>(0);

    // ✅ Phase 8 - Amélioration 26 : Sélection multi-produits
    const [selectedProducts, setSelectedProducts] = useState<number[]>(() =>
        productIndex !== undefined ? [productIndex] : []
    );
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [showProductSelector, setShowProductSelector] = useState(false);

    // Charger GPS utilisateur au montage et récupérer les coûts
    useEffect(() => {
        // ✅ CORRIGÉ: Vérifier que serviceId est valide avant d'exécuter les fonctions
        if (visible && serviceId && typeof serviceId === 'number' && serviceId > 0) {
            // ✅ CORRIGÉ: Wrapper toutes les fonctions dans try-catch pour éviter les crashes
            const loadData = async () => {
                try {
                    await Promise.all([
                        loadUserGPS().catch(err => console.warn('[OrderDeliveryModal] Erreur loadUserGPS:', err)),
                        loadAvailableProducts().catch(err => console.warn('[OrderDeliveryModal] Erreur loadAvailableProducts:', err)),
                    ]);

                    if (productIndex !== undefined) {
                        setSelectedProducts([productIndex]);
                    }

                    // ✅ NOUVEAU : Charger automatiquement la position actuelle de l'utilisateur
                    // Cette fonction essaie d'abord la position actuelle, puis utilise le GPS de l'API comme fallback
                    loadCurrentLocationAutomatically().catch(err => {
                        console.warn('[OrderDeliveryModal] Erreur loadCurrentLocationAutomatically:', err);
                        // Ne pas bloquer l'utilisateur si la localisation échoue
                    });
                } catch (error) {
                    console.error('[OrderDeliveryModal] Erreur lors du chargement des données:', error);
                    // Ne pas afficher d'alerte pour éviter de bloquer l'utilisateur
                }
            };

            loadData();
        } else if (visible && (!serviceId || typeof serviceId !== 'number' || serviceId <= 0)) {
            // ✅ CORRIGÉ: Afficher une erreur si serviceId est invalide
            console.error('[OrderDeliveryModal] serviceId invalide:', serviceId);
            Alert.alert(
                'Erreur',
                'Impossible de charger les informations de livraison. Le service est invalide.',
                [{ text: 'OK', onPress: onClose }]
            );
        }
    }, [visible, serviceId, productIndex]);

    // ✅ NOUVEAU 2026-01-23: Réinitialiser la quantité et la variation quand le modal s'ouvre
    useEffect(() => {
        if (visible) {
            setQuantity(1); // Quantité par défaut à 1
            setSelectedVariantIdx(
                selectedVariantIndex !== undefined ? selectedVariantIndex : (productVariants && productVariants.length > 0 ? 0 : -1)
            );
        }
    }, [visible, selectedVariantIndex, productVariants]);

    // Recalculer les coûts quand les produits sélectionnés, dropoff, variation ou quantité changent
    useEffect(() => {
        if (visible && selectedProducts.length > 0 && dropoffLocation) {
            loadCosts();
        }
    }, [visible, selectedProducts, dropoffLocation, selectedVariantIdx, quantity]);

    // ✅ FIX 2026-03-05: L'assurance est maintenant calculée par le backend via estimate-costs
    // Le calcul local a été supprimé car il divergeait du backend (taux/paliers différents)
    // Le coût d'assurance est mis à jour dans loadCosts() via response.data.insurance_cost_cents

    // NOUVEAU: Charger le solde utilisateur
    useEffect(() => {
        const loadBalance = async () => {
            try {
                const response = await userApi.getTokensBalance() as any;
                if (response.success && response.data) {
                    setUserBalance(response.data.tokens_balance || 0);
                }
            } catch (error) {
                console.error('[OrderDeliveryModal] Erreur chargement solde:', error);
            }
        };
        if (visible) {
            loadBalance();
        }
    }, [visible]);

    // NOUVEAU : Fonction helper pour formater l'adresse avec quartier
    const formatAddressWithDistrict = (addr: Location.LocationGeocodedAddress): string => {
        const addressParts: string[] = [];

        // Rue et numéro
        if (addr.street || addr.streetNumber) {
            const streetPart = [addr.streetNumber, addr.street].filter(Boolean).join(' ');
            if (streetPart) addressParts.push(streetPart);
        }

        // Quartier/District (priorité haute pour l'affichage)
        if (addr.district && addr.district !== addr.city) {
            addressParts.push(addr.district);
        } else if (addr.subregion && addr.subregion !== addr.city) {
            addressParts.push(addr.subregion);
        }

        // Ville
        if (addr.city) {
            addressParts.push(addr.city);
        }

        // Région (si différente de la ville)
        if (addr.region && addr.region !== addr.city && addr.region !== addr.district) {
            addressParts.push(addr.region);
        }

        // Pays (optionnel, seulement si nécessaire)
        // if (addr.country && addressParts.length < 2) {
        //     addressParts.push(addr.country);
        // }

        return addressParts.length > 0 ? addressParts.join(', ') : '';
    };

    const loadUserGPS = async () => {
        try {
            // ✅ CORRIGÉ: Utiliser GET au lieu de POST pour récupérer les infos utilisateur
            const response = await apiGet('/api/user/me') as ApiResponse<UserMeResponse>;
            if (response.success && response.data?.gps) {
                const gpsString = response.data.gps;
                // ✅ CORRIGÉ: Vérifier que gps est une string valide avant de split
                if (typeof gpsString === 'string' && gpsString.includes(',')) {
                    const parts = gpsString.split(',').map(parseFloat);
                    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                        const [lng, lat] = parts;
                        const location = { latitude: lat, longitude: lng };
                        setUserGPS(location);
                        // Ne pas définir dropoffLocation ici, on laisse loadCurrentLocationAutomatically le faire
                        // Mais si loadCurrentLocationAutomatically échoue, on pourra utiliser ce GPS comme fallback
                    }
                }
            }
        } catch (error) {
            console.error('Erreur chargement GPS utilisateur:', error);
            // Ne pas propager l'erreur pour éviter les crashes
        }
    };

    // ✅ NOUVEAU : Charger automatiquement la position actuelle
    const loadCurrentLocationAutomatically = async () => {
        try {
            // ✅ CORRIGÉ: Vérifier que Location est disponible et importé correctement
            if (!Location || typeof Location !== 'object' || typeof Location.requestForegroundPermissionsAsync !== 'function') {
                console.warn('[OrderDeliveryModal] Location API non disponible');
                // Fallback : utiliser le GPS de l'utilisateur depuis l'API si disponible
                if (!userGPS) {
                    await loadUserGPS();
                }
                if (userGPS) {
                    setDropoffLocation(userGPS);
                }
                return;
            }

            // Vérifier les permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                // Si pas de permission, utiliser le GPS de l'utilisateur depuis l'API comme fallback
                // Récupérer le GPS depuis l'API si pas encore chargé
                let gpsToUse = userGPS;
                if (!gpsToUse) {
                    try {
                        const response = await apiGet('/api/user/me') as ApiResponse<UserMeResponse>;
                        if (response.success && response.data?.gps) {
                            const [lng, lat] = response.data.gps.split(',').map(parseFloat);
                            gpsToUse = { latitude: lat, longitude: lng };
                            setUserGPS(gpsToUse);
                        }
                    } catch (apiError) {
                        console.warn('Erreur récupération GPS depuis API:', apiError);
                    }
                }

                if (gpsToUse) {
                    // Géocoder le GPS de l'utilisateur depuis l'API
                    try {
                        // ✅ CORRIGÉ: Vérifier que reverseGeocodeAsync est disponible
                        if (Location && typeof Location.reverseGeocodeAsync === 'function') {
                            const reverseGeocode = await Location.reverseGeocodeAsync(gpsToUse);
                            if (reverseGeocode && Array.isArray(reverseGeocode) && reverseGeocode.length > 0) {
                                const addr = reverseGeocode[0];
                                const formattedAddress = formatAddressWithDistrict(addr);
                                setDropoffLocation({
                                    ...gpsToUse,
                                    address: formattedAddress || `${gpsToUse.latitude.toFixed(6)}, ${gpsToUse.longitude.toFixed(6)}`,
                                });
                            } else {
                                setDropoffLocation(gpsToUse);
                            }
                        } else {
                            // Si reverseGeocodeAsync n'est pas disponible, utiliser directement les coordonnées
                            setDropoffLocation(gpsToUse);
                        }
                    } catch (geocodeError) {
                        console.warn('Erreur géocodage GPS utilisateur:', geocodeError);
                        // ✅ CORRIGÉ: Toujours définir dropoffLocation même en cas d'erreur
                        setDropoffLocation(gpsToUse);
                    }
                }
                return;
            }

            // Obtenir la position actuelle
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            // Géocodage inverse pour obtenir l'adresse avec quartier
            try {
                // ✅ CORRIGÉ: Vérifier que reverseGeocodeAsync est disponible
                if (Location && typeof Location.reverseGeocodeAsync === 'function') {
                    const reverseGeocode = await Location.reverseGeocodeAsync(coords);
                    if (reverseGeocode && Array.isArray(reverseGeocode) && reverseGeocode.length > 0) {
                        const addr = reverseGeocode[0];
                        const formattedAddress = formatAddressWithDistrict(addr);

                        setDropoffLocation({
                            ...coords,
                            address: formattedAddress || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
                        });
                    } else {
                        setDropoffLocation(coords);
                    }
                } else {
                    // Si reverseGeocodeAsync n'est pas disponible, utiliser directement les coordonnées
                    setDropoffLocation(coords);
                }
            } catch (geocodeError) {
                console.warn('Erreur géocodage automatique:', geocodeError);
                // ✅ CORRIGÉ: Toujours définir dropoffLocation même en cas d'erreur
                setDropoffLocation(coords);
            }

            setUserGPS(coords);
        } catch (error) {
            console.warn('Erreur chargement position automatique:', error);
            // Fallback : utiliser le GPS de l'utilisateur depuis l'API si disponible
            try {
                const response = await apiGet('/api/user/me') as ApiResponse<UserMeResponse>;
                if (response.success && response.data?.gps) {
                    const [lng, lat] = response.data.gps.split(',').map(parseFloat);
                    const gpsFromApi = { latitude: lat, longitude: lng };
                    setUserGPS(gpsFromApi);

                    try {
                        // ✅ CORRIGÉ: Vérifier que reverseGeocodeAsync est disponible
                        if (Location && typeof Location.reverseGeocodeAsync === 'function') {
                            const reverseGeocode = await Location.reverseGeocodeAsync(gpsFromApi);
                            if (reverseGeocode && Array.isArray(reverseGeocode) && reverseGeocode.length > 0) {
                                const addr = reverseGeocode[0];
                                const formattedAddress = formatAddressWithDistrict(addr);
                                setDropoffLocation({
                                    ...gpsFromApi,
                                    address: formattedAddress || `${gpsFromApi.latitude.toFixed(6)}, ${gpsFromApi.longitude.toFixed(6)}`,
                                });
                            } else {
                                setDropoffLocation(gpsFromApi);
                            }
                        } else {
                            // Si reverseGeocodeAsync n'est pas disponible, utiliser directement les coordonnées
                            setDropoffLocation(gpsFromApi);
                        }
                    } catch (geocodeError) {
                        console.warn('Erreur géocodage GPS utilisateur (fallback):', geocodeError);
                        // ✅ CORRIGÉ: Toujours définir dropoffLocation même en cas d'erreur
                        setDropoffLocation(gpsFromApi);
                    }
                }
            } catch (apiError) {
                console.warn('Erreur récupération GPS depuis API (fallback):', apiError);
            }
        }
    };

    // ✅ Phase 8 - Amélioration 26 : Charger les produits disponibles du service
    const loadAvailableProducts = async () => {
        // ✅ CORRIGÉ: Vérification stricte de serviceId
        if (!serviceId || typeof serviceId !== 'number' || serviceId <= 0) {
            console.error('[OrderDeliveryModal] serviceId invalide dans loadAvailableProducts:', serviceId);
            return;
        }

        setLoadingProducts(true);
        try {
            // ✅ CORRIGÉ: Utiliser GET au lieu de POST pour récupérer un service
            const response = await apiGet(`/api/services/${serviceId}`) as ApiResponse<ServiceResponse>;
            if (response.success && response.data) {
                const service = response.data;
                const products = (service.data?.produits && typeof service.data.produits === 'object' && 'valeur' in service.data.produits
                    ? (service.data.produits as any).valeur
                    : service.data?.produits) || [];

                // ✅ Fonction helper pour obtenir le prix réel avec promotions
                const getRealPrice = (product: any): number => {
                    // 1. Vérifier promotion produit active
                    if (product.promotionActive) {
                        const now = new Date();
                        const endDate = product.promotionDateFin ? new Date(product.promotionDateFin) : null;

                        if (!endDate || now <= endDate) {
                            const valeur = product.promotionValeur;
                            if (valeur) {
                                const valeurStr = String(valeur).trim();
                                const basePrice = product.price || 0;

                                // Pourcentage
                                if (valeurStr.endsWith('%')) {
                                    const pct = parseFloat(valeurStr.replace('%', ''));
                                    if (!isNaN(pct)) return basePrice * (1 - pct / 100);
                                }
                                // Réduction fixe
                                if (valeurStr.startsWith('-')) {
                                    const reduction = parseFloat(valeurStr.replace('-', '').split(' ')[0]);
                                    if (!isNaN(reduction)) return Math.max(0, basePrice - reduction);
                                }
                                // Prix fixe
                                const fixedPrice = parseFloat(valeurStr.split(' ')[0]);
                                if (!isNaN(fixedPrice) && fixedPrice < basePrice) return fixedPrice;
                            }
                        }
                    }

                    // 2. Vérifier prix réduit/discounted
                    if (product.discounted_price && product.discounted_price < (product.price || 0)) {
                        return product.discounted_price;
                    }

                    // 3. Prix de base
                    return product.price || 0;
                };

                const productList = products
                    .map((p: any, index: number) => {
                        const basePrice = p.price || 0;
                        const realPrice = getRealPrice(p);
                        const hasPromotion = realPrice < basePrice && basePrice > 0;

                        // Extraire la première image pour thumbnail
                        let thumbnail: string | undefined;
                        const rawImages = p.images;
                        if (rawImages) {
                            let imgArr: string[] = [];
                            if (Array.isArray(rawImages)) imgArr = rawImages;
                            else if (rawImages.valeur && Array.isArray(rawImages.valeur)) imgArr = rawImages.valeur;
                            else if (typeof rawImages === 'string') imgArr = [rawImages];
                            const firstImg = imgArr[0];
                            if (firstImg && typeof firstImg === 'string' && firstImg.trim()) {
                                const img = firstImg.trim();
                                if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) {
                                    thumbnail = img;
                                } else {
                                    const base = (config.API_BASE_URL || '').replace(/\/$/, '');
                                    thumbnail = base ? `${base}/api/media/files/${img.replace(/^\//, '')}` : undefined;
                                }
                            }
                        }

                        return {
                            index,
                            name: p.nom || p.name || p.title || `Produit ${index + 1}`,
                            price: realPrice,
                            originalPrice: basePrice,
                            hasPromotion,
                            promotionType: p.promotionType,
                            promotionValeur: p.promotionValeur,
                            thumbnail,
                        };
                    })
                    .filter((p: any) => p.name && p.price > 0); // Filtrer les produits valides

                setAvailableProducts(productList);
            }
        } catch (error) {
            console.error('Erreur chargement produits:', error);
        } finally {
            setLoadingProducts(false);
        }
    };

    // ✅ Phase 7 - Amélioration 23 : Charger les coûts estimés (adapté pour multi-produits)
    // ✅ CORRIGÉ 2026-01-23: Prendre en compte la variation et la quantité
    // ✅ IMPORTANT : Le coût de livraison est indépendant du nombre de produits
    const loadCosts = async () => {
        // ✅ CORRIGÉ: Vérification stricte de serviceId
        if (!serviceId || typeof serviceId !== 'number' || serviceId <= 0 || selectedProducts.length === 0 || !dropoffLocation) {
            return;
        }

        setLoadingCosts(true);
        try {
            // ✅ CORRIGÉ 2026-01-23: Calculer le prix total en tenant compte de la variation et de la quantité
            // ✅ FIX 2026-03-03: Ordre de priorité corrigé :
            //   1. Variante sélectionnée (vient de ProductCard, prix fiable)
            //   2. initialProductPrice (prix réel affiché dans ProductCard, prioritaire)
            //   3. availableProducts (ancien JSONB — dernier recours uniquement)
            let totalProductPrice = 0;

            // 1. Si on a des variations de prix pour le produit principal
            if (productVariants && productVariants.length > 0 && selectedVariantIdx >= 0 && selectedVariantIdx < productVariants.length) {
                const selectedVariant = productVariants[selectedVariantIdx];
                const variantPrice = selectedVariant.prix || selectedVariant.price || 0;
                totalProductPrice = variantPrice * quantity;
            }
            // 2. Sinon, utiliser initialProductPrice (prix réel du ProductCard — nouveau système)
            else if (initialProductPrice && initialProductPrice > 0) {
                totalProductPrice = initialProductPrice * quantity;
            }
            // 3. Dernier recours : ancien JSONB (multi-produits uniquement)
            else {
                selectedProducts.forEach((idx) => {
                    const product = availableProducts.find(p => p.index === idx);
                    if (product) {
                        totalProductPrice += product.price;
                    }
                });
            }

            setProductPrice(totalProductPrice);

            // ✅ Le coût de livraison est calculé UNE SEULE FOIS, indépendamment du nombre de produits
            // On utilise le premier produit uniquement pour obtenir la configuration de livraison (pickup, billing_mode)
            const firstProductIndex = selectedProducts[0];

            const payload = {
                service_id: serviceId,
                product_index: firstProductIndex,
                dropoff: dropoffLocation,
                // ✅ NOUVEAU : Pour prix négociés
                conversation_id: conversationId,
                client_user_id: clientUserId,
            };

            const response = await apiPost('/api/delivery/estimate-costs', payload) as ApiResponse<DeliveryCostsResponse>;
            if (response.success && response.data) {
                const data = response.data;

                // ✅ Le coût de livraison ne change PAS selon le nombre de produits
                // Il est basé uniquement sur la distance pickup -> dropoff
                if (data.delivery_cost_cents !== undefined) {
                    setDeliveryCost(data.delivery_cost_cents / 100); // Convertir centimes en FCFA
                }
                if (data.is_delivery_free !== undefined) {
                    setIsDeliveryFree(data.is_delivery_free);
                }
                // ✅ FIX 2026-03-05: Utiliser le coût d'assurance calculé par le backend
                if ((data as any).insurance_cost_cents !== undefined) {
                    setInsuranceCost(Math.ceil((data as any).insurance_cost_cents / 100));
                } else {
                    setInsuranceCost(0);
                }
            }
        } catch (error) {
            console.error('Erreur chargement coûts:', error);
            // Ne pas bloquer l'utilisateur si les coûts ne peuvent pas être chargés
        } finally {
            setLoadingCosts(false);
        }
    };

    // ✅ Phase 8 - Amélioration 26 : Toggle sélection produit
    const toggleProductSelection = (productIdx: number) => {
        setSelectedProducts(prev => {
            if (prev.includes(productIdx)) {
                // Désélectionner (mais garder au moins un produit)
                if (prev.length > 1) {
                    return prev.filter(idx => idx !== productIdx);
                }
                return prev;
            } else {
                // Sélectionner
                return [...prev, productIdx];
            }
        });
    };

    const handleUseCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission requise',
                    'L\'accès à la localisation est nécessaire pour utiliser votre position actuelle.'
                );
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            // ✅ AMÉLIORÉ : Géocodage inverse pour obtenir l'adresse avec quartier
            try {
                // ✅ CORRIGÉ: Vérifier que reverseGeocodeAsync est disponible
                if (Location && typeof Location.reverseGeocodeAsync === 'function') {
                    const reverseGeocode = await Location.reverseGeocodeAsync(coords);
                    if (reverseGeocode && Array.isArray(reverseGeocode) && reverseGeocode.length > 0) {
                        const addr = reverseGeocode[0];
                        const formattedAddress = formatAddressWithDistrict(addr);

                        setDropoffLocation({
                            ...coords,
                            address: formattedAddress || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
                        });
                    } else {
                        setDropoffLocation(coords);
                    }
                } else {
                    // Si reverseGeocodeAsync n'est pas disponible, utiliser directement les coordonnées
                    setDropoffLocation(coords);
                }
            } catch (geocodeError) {
                console.warn('Erreur géocodage:', geocodeError);
                // ✅ CORRIGÉ: Toujours définir dropoffLocation même en cas d'erreur
                setDropoffLocation(coords);
            }

            setUserGPS(coords);
        } catch (error) {
            console.error('Erreur géolocalisation:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position');
        }
    };

    // ✅ NOUVEAU : Handler pour sélectionner une adresse via Google Maps
    const handleSelectAddressFromMap = () => {
        setShowGPSModal(true);
    };

    // ✅ NOUVEAU : Handler pour quand l'utilisateur sélectionne une adresse dans le modal GPS
    const handleGPSSelect = async (coordinates: string) => {
        try {
            // Le modal GPS retourne une chaîne de coordonnées "lat,lng"
            const [lat, lng] = coordinates.split(',').map(parseFloat);

            if (isNaN(lat) || isNaN(lng)) {
                console.error('[OrderDeliveryModal] Coordonnées invalides:', coordinates);
                return;
            }

            // ✅ AMÉLIORÉ : Géocodage inverse pour obtenir l'adresse avec quartier
            try {
                // ✅ CORRIGÉ: Vérifier que reverseGeocodeAsync est disponible
                if (Location && typeof Location.reverseGeocodeAsync === 'function') {
                    const reverseGeocode = await Location.reverseGeocodeAsync({
                        latitude: lat,
                        longitude: lng,
                    });

                    if (reverseGeocode && Array.isArray(reverseGeocode) && reverseGeocode.length > 0) {
                        const addr = reverseGeocode[0];
                        const formattedAddress = formatAddressWithDistrict(addr);

                        setDropoffLocation({
                            latitude: lat,
                            longitude: lng,
                            address: formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                        });
                    } else {
                        setDropoffLocation({
                            latitude: lat,
                            longitude: lng,
                        });
                    }
                } else {
                    // Si reverseGeocodeAsync n'est pas disponible, utiliser directement les coordonnées
                    setDropoffLocation({
                        latitude: lat,
                        longitude: lng,
                    });
                }
            } catch (geocodeError) {
                console.warn('[OrderDeliveryModal] Erreur géocodage:', geocodeError);
                // ✅ CORRIGÉ: Toujours définir dropoffLocation même en cas d'erreur
                setDropoffLocation({
                    latitude: lat,
                    longitude: lng,
                });
            }

            setShowGPSModal(false);
        } catch (error) {
            console.error('[OrderDeliveryModal] Erreur sélection GPS:', error);
        }
    };

    const handleSubmit = async () => {
        // ✅ CORRIGÉ: Vérifier serviceId avant de soumettre
        if (!serviceId || typeof serviceId !== 'number' || serviceId <= 0) {
            Alert.alert('Erreur', 'Service invalide. Impossible de créer la commande.');
            return;
        }

        if (!dropoffLocation) {
            Alert.alert('Adresse requise', 'Veuillez fournir une adresse de livraison');
            return;
        }

        if (selectedProducts.length === 0) {
            Alert.alert('Produit requis', 'Veuillez sélectionner au moins un produit');
            return;
        }

        // ✅ NOUVEAU 2026-01-23: Vérifier qu'une variation est sélectionnée si le produit en a
        if (productVariants && productVariants.length > 0 && selectedVariantIdx < 0) {
            Alert.alert('Variation requise', 'Veuillez sélectionner une variation de prix pour ce produit');
            return;
        }

        // ✅ NOUVEAU 2026-01-23: Vérifier que la quantité est valide
        if (quantity < 1) {
            Alert.alert('Quantité invalide', 'La quantité doit être au moins égale à 1');
            return;
        }

        // ✅ NOUVEAU: Vérifier le solde avant de soumettre
        const totalCost = (productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost;
        try {
            const balanceResponse = await userApi.getTokensBalance() as any;
            const currentBalance = balanceResponse?.data?.tokens_balance || 0;
            setUserBalance(currentBalance);

            if (currentBalance < totalCost) {
                Alert.alert(
                    'Solde insuffisant',
                    `Votre solde (${currentBalance.toLocaleString('fr-FR')} FCFA) est insuffisant pour couvrir le total de ${totalCost.toLocaleString('fr-FR')} FCFA.\n\nVeuillez recharger votre compte.`,
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Recharger',
                            onPress: () => {
                                onClose();
                                (navigation as any).navigate('RechargeTokens');
                            },
                        },
                    ]
                );
                return;
            }
        } catch (balanceError) {
            console.warn('[OrderDeliveryModal] Erreur vérification solde:', balanceError);
        }

        setLoading(true);
        try {
            // ✅ Phase 8 - Amélioration 26 : Si plusieurs produits, créer plusieurs commandes
            if (selectedProducts.length > 1) {
                const responses = await Promise.all(
                    selectedProducts.map(idx =>
                        apiPost('/api/delivery/client-order', {
                            service_id: serviceId,
                            product_index: idx,
                            dropoff: dropoffLocation,
                            notes: notes || undefined,
                            // ✅ NOUVEAU : Pour prix négociés
                            conversation_id: conversationId,
                            // ✅ NOUVEAU 2026-01-23: Variation et quantité (pour chaque produit)
                            variant_index: (productVariants && productVariants.length > 0 && selectedVariantIdx >= 0) ? selectedVariantIdx : undefined,
                            quantity: quantity,
                        })
                    )
                );

                const firstResponse = responses[0];

                // Sauvegarder les préférences pour la première livraison
                const firstResponseTyped = firstResponse as ApiResponse<DeliveryOrderResponse>;
                if (firstResponseTyped.success && firstResponseTyped.data?.delivery?.id) {
                    if (preferredDeliveryDate || preferredDeliveryTimeStart) {
                        try {
                            const preferencesPayload = {
                                delivery_id: firstResponseTyped.data.delivery.id,
                                preferred_delivery_date: preferredDeliveryDate || undefined,
                                preferred_delivery_time_start: preferredDeliveryTimeStart || undefined,
                                preferred_delivery_time_end: preferredDeliveryTimeEnd || undefined,
                                is_flexible: isFlexible,
                                flexibility_window_days: flexibilityWindowDays,
                                urgency_level: urgencyLevel,
                            };
                            await apiPost('/api/delivery/preferences', preferencesPayload);
                        } catch (prefError) {
                            console.error('Erreur sauvegarde préférences:', prefError);
                        }
                    }
                }

                // ✅ FIX 2026-03-03: Toast + son au lieu de Alert bloquant
                showToast(`✅ ${selectedProducts.length} commande(s) créée(s) ! Recherche de coursier en cours...`);
                notificationSoundService.playSound('order').catch(console.error);

                if (firstResponseTyped.success && firstResponseTyped.data?.delivery?.id && onSuccess) {
                    // Laisser le toast s'afficher 1.5s avant de naviguer
                    setTimeout(() => {
                        onSuccess(firstResponseTyped.data!.delivery!.id);
                    }, 1500);
                }
            } else {
                // Un seul produit : utiliser le flux normal
                const payload: any = {
                    service_id: serviceId,
                    product_index: selectedProducts[0],
                    dropoff: dropoffLocation,
                    notes: notes || undefined,
                    // ✅ NOUVEAU : Pour prix négociés
                    conversation_id: conversationId,
                    // ✅ NOUVEAU 2026-01-23: Variation et quantité
                    variant_index: (productVariants && productVariants.length > 0 && selectedVariantIdx >= 0) ? selectedVariantIdx : undefined,
                    quantity: quantity,
                };

                const response = await apiPost('/api/delivery/client-order', payload) as ApiResponse<DeliveryOrderResponse>;

                // ✅ Phase 3 - Amélioration 7 : Sauvegarder les préférences de livraison si fournies
                if (response.success && response.data?.delivery?.id) {
                    if (preferredDeliveryDate || preferredDeliveryTimeStart) {
                        try {
                            const preferencesPayload = {
                                delivery_id: response.data.delivery.id,
                                preferred_delivery_date: preferredDeliveryDate || undefined,
                                preferred_delivery_time_start: preferredDeliveryTimeStart || undefined,
                                preferred_delivery_time_end: preferredDeliveryTimeEnd || undefined,
                                is_flexible: isFlexible,
                                flexibility_window_days: flexibilityWindowDays,
                                urgency_level: urgencyLevel,
                            };
                            await apiPost('/api/delivery/preferences', preferencesPayload);
                        } catch (prefError) {
                            console.error('Erreur sauvegarde préférences:', prefError);
                            // Ne pas bloquer la commande si les préférences échouent
                        }
                    }
                }

                if (response.success) {
                    // ✅ FIX 2026-03-03: Toast + son au lieu de Alert bloquant
                    showToast('✅ Commande créée ! Recherche de coursier en cours...');
                    notificationSoundService.playSound('order').catch(console.error);

                    // Laisser le toast s'afficher 1.5s avant de naviguer vers le suivi
                    setTimeout(() => {
                        if (onSuccess && response.data?.delivery?.id) {
                            onSuccess(response.data.delivery.id);
                        }
                        onClose();
                    }, 1500);
                } else {
                    Alert.alert('Erreur', response.error || 'Impossible de créer la commande');
                }
            }
        } catch (error: any) {
            console.error('Erreur création commande:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.header}
                >
                    <View style={styles.headerContent}>
                        <SafeIcon name="package" size={24} color="#FFFFFF" />
                        <View style={styles.headerText}>
                            <Text style={styles.headerTitle}>Commander la livraison</Text>
                            {productName && (
                                <Text style={styles.headerSubtitle}>{productName}</Text>
                            )}
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeButton}
                        disabled={loading}
                    >
                        <SafeIcon name="x" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </LinearGradient>

                {/* Content */}
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* ✅ NOUVEAU 2026-01-23: Sélection de variation de prix si disponible */}
                    {productVariants && productVariants.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="package" size={18} color="#9333EA" />
                                <Text style={styles.sectionTitle}>Variation de prix *</Text>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.variantsScrollView}
                                contentContainerStyle={styles.variantsScrollContent}
                            >
                                {productVariants.map((variant, idx) => {
                                    const variantPrice = variant.prix || variant.price || 0;
                                    const variantValue = variant.valeur || variant.value || variant.conditionnement || `Option ${idx + 1}`;
                                    const isSelected = selectedVariantIdx === idx;

                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            onPress={() => setSelectedVariantIdx(idx)}
                                            style={[
                                                styles.variantCard,
                                                isSelected && styles.variantCardSelected
                                            ]}
                                        >
                                            <Text style={[
                                                styles.variantValue,
                                                isSelected && styles.variantValueSelected
                                            ]}>
                                                {variantValue}
                                            </Text>
                                            <Text style={[
                                                styles.variantPrice,
                                                isSelected && styles.variantPriceSelected
                                            ]}>
                                                {variantPrice.toLocaleString('fr-FR')} FCFA
                                            </Text>
                                            {isSelected && (
                                                <View style={styles.variantCheckmark}>
                                                    <SafeIcon name="check" size={14} color="#FFFFFF" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* ✅ NOUVEAU 2026-01-23: Sélection de quantité */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="shopping-cart" size={18} color="#10B981" />
                            <Text style={styles.sectionTitle}>Quantité *</Text>
                        </View>
                        <View style={styles.quantityContainer}>
                            <TouchableOpacity
                                style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
                                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                                disabled={quantity <= 1}
                            >
                                <SafeIcon name="minus" size={18} color={quantity <= 1 ? "#9CA3AF" : modernColors.text} />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.quantityInput}
                                value={quantity.toString()}
                                onChangeText={(text) => {
                                    const num = parseInt(text) || 1;
                                    setQuantity(Math.max(1, num));
                                }}
                                keyboardType="numeric"
                                selectTextOnFocus
                            />
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => setQuantity(quantity + 1)}
                            >
                                <SafeIcon name="plus" size={18} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ✅ Phase 8 - Amélioration 26 : Sélection multi-produits */}
                    {availableProducts.length > 1 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="package" size={18} color="#9333EA" />
                                <Text style={styles.sectionTitle}>Produits à commander</Text>
                                {!showProductSelector && (
                                    <TouchableOpacity
                                        onPress={() => setShowProductSelector(true)}
                                        style={styles.addProductButton}
                                    >
                                        <Text style={styles.addProductButtonText}>Ajouter</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {showProductSelector ? (
                                <View style={styles.productSelectorContainer}>
                                    <View style={styles.productSelectorHeader}>
                                        <Text style={styles.productSelectorTitle}>
                                            Sélectionnez les produits ({selectedProducts.length} sélectionné{selectedProducts.length > 1 ? 's' : ''})
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => setShowProductSelector(false)}
                                            style={styles.closeSelectorButton}
                                        >
                                            <Text style={styles.closeSelectorButtonText}>Fermer</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={styles.productList} nestedScrollEnabled>
                                        {availableProducts.map((product) => (
                                            <TouchableOpacity
                                                key={product.index}
                                                onPress={() => toggleProductSelection(product.index)}
                                                style={[
                                                    styles.productItem,
                                                    selectedProducts.includes(product.index) && styles.productItemSelected,
                                                ]}
                                            >
                                                <View style={styles.checkboxContainer}>
                                                    <View
                                                        style={[
                                                            styles.checkbox,
                                                            selectedProducts.includes(product.index) && styles.checkboxChecked,
                                                        ]}
                                                    >
                                                        {selectedProducts.includes(product.index) && (
                                                            <SafeIcon name="check" size={14} color="#FFFFFF" />
                                                        )}
                                                    </View>
                                                </View>
                                                {product.thumbnail ? (
                                                    <RNImage source={{ uri: product.thumbnail }} style={styles.productThumb} />
                                                ) : (
                                                    <View style={[styles.productThumb, styles.productThumbPlaceholder]}>
                                                        <SafeIcon name="package" size={18} color="#9CA3AF" />
                                                    </View>
                                                )}
                                                <View style={styles.productInfo}>
                                                    <View style={styles.productNameRow}>
                                                        <Text style={styles.productName}>{product.name}</Text>
                                                        {product.hasPromotion && (
                                                            <View style={styles.promoBadge}>
                                                                <Text style={styles.promoBadgeText}>PROMO</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <View style={styles.productPriceRow}>
                                                        {product.hasPromotion && product.originalPrice && (
                                                            <Text style={styles.productOriginalPrice}>
                                                                {product.originalPrice.toLocaleString('fr-FR')} FCFA
                                                            </Text>
                                                        )}
                                                        <Text style={[
                                                            styles.productPrice,
                                                            product.hasPromotion && styles.productPricePromo
                                                        ]}>
                                                            {product.price.toLocaleString('fr-FR')} FCFA
                                                        </Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            ) : (
                                <View style={styles.selectedProductsList}>
                                    {selectedProducts.map((idx) => {
                                        const product = availableProducts.find(p => p.index === idx);
                                        return product ? (
                                            <View key={idx} style={styles.selectedProductCard}>
                                                {product.thumbnail ? (
                                                    <RNImage source={{ uri: product.thumbnail }} style={styles.selectedProductThumb} />
                                                ) : (
                                                    <View style={[styles.selectedProductThumb, styles.productThumbPlaceholder]}>
                                                        <SafeIcon name="package" size={14} color="#9CA3AF" />
                                                    </View>
                                                )}
                                                <View style={styles.selectedProductInfo}>
                                                    <View style={styles.productNameRow}>
                                                        <Text style={styles.selectedProductName}>{product.name}</Text>
                                                        {product.hasPromotion && (
                                                            <View style={styles.promoBadgeSmall}>
                                                                <Text style={styles.promoBadgeTextSmall}>PROMO</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <View style={styles.productPriceRow}>
                                                        {product.hasPromotion && product.originalPrice && (
                                                            <Text style={styles.productOriginalPrice}>
                                                                {product.originalPrice.toLocaleString('fr-FR')} FCFA
                                                            </Text>
                                                        )}
                                                        <Text style={[
                                                            styles.selectedProductPrice,
                                                            product.hasPromotion && styles.productPricePromo
                                                        ]}>
                                                            {product.price.toLocaleString('fr-FR')} FCFA
                                                        </Text>
                                                    </View>
                                                </View>
                                                {selectedProducts.length > 1 && (
                                                    <TouchableOpacity
                                                        onPress={() => toggleProductSelection(idx)}
                                                        style={styles.removeProductButton}
                                                    >
                                                        <SafeIcon name="x" size={16} color="#DC2626" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ) : null;
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Point de départ */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="map-pin" size={18} color={modernColors.success} />
                            <Text style={styles.sectionTitle}>Point de départ</Text>
                        </View>
                        {pickupLocation ? (
                            <View style={styles.locationCard}>
                                <Text style={styles.locationText}>
                                    {pickupLocation.address ||
                                        `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}`}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.locationCardPlaceholder}>
                                <Text style={styles.placeholderText}>
                                    Adresse de collecte automatique (depuis la configuration du produit)
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Point de livraison */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
                            <Text style={styles.sectionTitle}>Adresse de livraison *</Text>
                        </View>

                        {/* ✅ NOUVEAU : Sélecteur d'adresse sauvegardée */}
                        <SavedAddressSelector
                            addressType="dropoff"
                            value={dropoffLocation ? {
                                raw: dropoffLocation.address || '',
                                place_name: dropoffLocation.address || '',
                                coordinates: { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude },
                                components: {},
                            } : undefined}
                            onSelect={(address: UserSavedAddress | LocationObject) => {
                                if ('id' in address && 'latitude' in address) {
                                    // C'est un UserSavedAddress
                                    const savedAddr = address as UserSavedAddress;
                                    setDropoffLocation({
                                        latitude: savedAddr.latitude,
                                        longitude: savedAddr.longitude,
                                        address: savedAddr.address,
                                    });
                                } else {
                                    // C'est un LocationObject
                                    const loc = address as LocationObject;
                                    const coords = loc.coordinates;
                                    if (coords?.lat && coords?.lng) {
                                        setDropoffLocation({
                                            latitude: coords.lat,
                                            longitude: coords.lng,
                                            address: loc.raw || loc.place_name || '',
                                        });
                                    }
                                }
                            }}
                            allowNew={true}
                        />

                        {dropoffLocation ? (
                            <View style={styles.locationCard}>
                                <View style={styles.locationCardHeader}>
                                    <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
                                    <Text style={styles.locationLabel}>Adresse de livraison</Text>
                                </View>
                                <Text style={styles.locationText}>
                                    {dropoffLocation.address ||
                                        `${dropoffLocation.latitude.toFixed(6)}, ${dropoffLocation.longitude.toFixed(6)}`}
                                </Text>
                                <TouchableOpacity
                                    style={styles.modifyButton}
                                    onPress={() => setDropoffLocation(null)}
                                >
                                    <Text style={styles.modifyButtonText}>Choisir une autre adresse</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.locationActions}>
                                {/* ✅ NOUVEAU : Bouton pour sélectionner une adresse sur la carte */}
                                <TouchableOpacity
                                    style={[styles.locationButton, styles.locationButtonSecondary]}
                                    onPress={handleSelectAddressFromMap}
                                >
                                    <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                                    <Text style={styles.locationButtonText}>
                                        Choisir une adresse sur la carte
                                    </Text>
                                </TouchableOpacity>

                                <Text style={styles.hintText}>
                                    Si votre position actuelle n'est pas affichée, vous pouvez choisir une autre adresse
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Notes */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Instructions de livraison (optionnel)</Text>
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Ex: Sonner deux fois, laisser devant la porte..."
                            style={styles.notesInput}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* ✅ Phase 3 - Amélioration 7 : Préférences de livraison */}
                    <View style={[styles.section, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 24 }]}>
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="clock" size={18} color={modernColors.accent} />
                            <Text style={styles.sectionTitle}>Préférences de livraison (optionnel)</Text>
                        </View>

                        <View style={styles.preferencesGrid}>
                            {/* Date de livraison */}
                            <View style={styles.preferenceItem}>
                                <NativeDatePicker
                                    label="Date de livraison"
                                    value={preferredDeliveryDateDisplay}
                                    onChange={(dateString: string) => {
                                        // dateString est au format JJ/MM/AAAA
                                        setPreferredDeliveryDateDisplay(dateString);
                                        // Convertir en format YYYY-MM-DD pour l'API
                                        if (dateString) {
                                            const parts = dateString.split('/');
                                            if (parts.length === 3) {
                                                const day = parts[0];
                                                const month = parts[1];
                                                const year = parts[2];
                                                setPreferredDeliveryDate(`${year}-${month}-${day}`);
                                            }
                                        } else {
                                            setPreferredDeliveryDate('');
                                        }
                                    }}
                                    minimumDate={new Date()} // Ne pas permettre les dates passées
                                    placeholder="Sélectionner une date"
                                />
                            </View>

                            {/* Niveau d'urgence - Sélecteur visuel */}
                            <View style={styles.preferenceItem}>
                                <Text style={styles.preferenceLabel}>Mode de livraison</Text>
                                <View style={styles.deliveryModeContainer}>
                                    {[
                                        { key: 'standard' as const, label: 'Standard', icon: 'truck' as const, desc: '2-4h', color: '#3B82F6' },
                                        { key: 'urgent' as const, label: 'Express', icon: 'zap' as const, desc: '30-60min', color: '#F59E0B' },
                                        { key: 'scheduled' as const, label: 'Programmé', icon: 'calendar' as const, desc: 'Date fixe', color: '#8B5CF6' },
                                    ].map((mode) => (
                                        <TouchableOpacity
                                            key={mode.key}
                                            style={[
                                                styles.deliveryModeCard,
                                                urgencyLevel === mode.key && { borderColor: mode.color, backgroundColor: mode.color + '10' }
                                            ]}
                                            onPress={() => setUrgencyLevel(mode.key)}
                                        >
                                            <SafeIcon name={mode.icon} size={18} color={urgencyLevel === mode.key ? mode.color : modernColors.textSecondary} />
                                            <Text style={[
                                                styles.deliveryModeLabel,
                                                urgencyLevel === mode.key && { color: mode.color, fontWeight: '700' }
                                            ]}>{mode.label}</Text>
                                            <Text style={[
                                                styles.deliveryModeDesc,
                                                urgencyLevel === mode.key && { color: mode.color }
                                            ]}>{mode.desc}</Text>
                                            {urgencyLevel === mode.key && (
                                                <View style={[styles.deliveryModeCheck, { backgroundColor: mode.color }]}>
                                                    <SafeIcon name="check" size={10} color="#FFFFFF" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Heures de livraison */}
                        {preferredDeliveryDate && (
                            <View style={styles.preferencesGrid}>
                                <View style={styles.preferenceItem}>
                                    <NativeTimePicker
                                        label="Heure de début"
                                        value={preferredDeliveryTimeStart}
                                        onChange={setPreferredDeliveryTimeStart}
                                        placeholder="Sélectionner l'heure de début"
                                    />
                                </View>
                                <View style={styles.preferenceItem}>
                                    <NativeTimePicker
                                        label="Heure de fin"
                                        value={preferredDeliveryTimeEnd}
                                        onChange={setPreferredDeliveryTimeEnd}
                                        placeholder="Sélectionner l'heure de fin"
                                    />
                                </View>
                            </View>
                        )}

                        {/* Flexibilité */}
                        <View style={styles.flexibilitySection}>
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setIsFlexible(!isFlexible)}
                            >
                                <View style={[styles.checkbox, isFlexible && styles.checkboxChecked]}>
                                    {isFlexible && <SafeIcon name="check" size={14} color="#FFFFFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>
                                    Accepter d'autres créneaux si indisponible
                                </Text>
                            </TouchableOpacity>

                            {isFlexible && (
                                <View style={styles.flexibilityInput}>
                                    <Text style={styles.preferenceLabel}>Fenêtre de flexibilité (jours)</Text>
                                    <TextInput
                                        style={styles.preferenceInput}
                                        keyboardType="numeric"
                                        value={flexibilityWindowDays.toString()}
                                        onChangeText={(text) => setFlexibilityWindowDays(parseInt(text) || 3)}
                                    />
                                    <Text style={styles.hintText}>
                                        Rechercher un créneau disponible dans les {flexibilityWindowDays} prochains jours
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                    {/* ✅ FIX 2026-03-01: Récapitulatif de commande complet et toujours visible
                        Structuré comme le flux coursier (DeliveryParcelFlowNew SummaryStep) avec:
                        - Coût du produit (détaillé avec variation/quantité)
                        - Frais de livraison
                        - Assurance
                        - Total
                        - Solde utilisateur
                    */}
                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <SafeIcon name="file-text" size={20} color={modernColors.primary} />
                            <Text style={styles.summarySectionTitle}>Récapitulatif de commande</Text>
                        </View>

                        {/* Carte 1: Produit(s) */}
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryCardTitle}>Produit</Text>
                            {productVariants && productVariants.length > 0 && selectedVariantIdx >= 0 ? (
                                <View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>{productName || 'Produit'}</Text>
                                        <Text style={styles.summaryValue}>
                                            {(productVariants[selectedVariantIdx].prix || productVariants[selectedVariantIdx].price || 0).toLocaleString('fr-FR')} FCFA
                                        </Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabelLight}>
                                            Variation: {productVariants[selectedVariantIdx].valeur || productVariants[selectedVariantIdx].value || productVariants[selectedVariantIdx].conditionnement || '-'}
                                        </Text>
                                    </View>
                                    {quantity > 1 && (
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>Quantité × {quantity}</Text>
                                            <Text style={styles.summaryValue}>
                                                {((productVariants[selectedVariantIdx].prix || productVariants[selectedVariantIdx].price || 0) * quantity).toLocaleString('fr-FR')} FCFA
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ) : selectedProducts.length > 1 ? (
                                <View>
                                    {selectedProducts.map((idx) => {
                                        const product = availableProducts.find(p => p.index === idx);
                                        return product ? (
                                            <View key={idx} style={styles.summaryRow}>
                                                <View style={styles.costLabelContainer}>
                                                    <Text style={styles.summaryLabel}>{product.name}</Text>
                                                    {product.hasPromotion && (
                                                        <View style={styles.promoBadgeSmall}>
                                                            <Text style={styles.promoBadgeTextSmall}>PROMO</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.costValueContainer}>
                                                    {product.hasPromotion && product.originalPrice && (
                                                        <Text style={styles.costOriginalPrice}>
                                                            {product.originalPrice.toLocaleString('fr-FR')}
                                                        </Text>
                                                    )}
                                                    <Text style={styles.summaryValue}>
                                                        {product.price.toLocaleString('fr-FR')} FCFA
                                                    </Text>
                                                </View>
                                            </View>
                                        ) : null;
                                    })}
                                    <View style={[styles.summaryRow, styles.subtotalRow]}>
                                        <Text style={styles.subtotalLabel}>Sous-total produits</Text>
                                        <Text style={styles.summaryValue}>{(productPrice || 0).toLocaleString('fr-FR')} FCFA</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>{productName || 'Produit'}{quantity > 1 ? ` × ${quantity}` : ''}</Text>
                                    <Text style={styles.summaryValue}>
                                        {productPrice !== null ? `${productPrice.toLocaleString('fr-FR')} FCFA` : 'Calcul en cours...'}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Carte 2: Frais de livraison + Assurance */}
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryCardTitle}>Frais</Text>
                            {loadingCosts ? (
                                <Text style={styles.summaryLoadingText}>Calcul des frais de livraison...</Text>
                            ) : (
                                <>
                                    <View style={styles.summaryRow}>
                                        <View style={styles.costLabelContainer}>
                                            <Text style={styles.summaryLabel}>Frais de livraison</Text>
                                            {isDeliveryFree && (
                                                <View style={styles.freeBadge}>
                                                    <Text style={styles.freeBadgeText}>Gratuite</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.summaryValue}>
                                            {deliveryCost !== null
                                                ? `${isDeliveryFree ? '0' : deliveryCost.toLocaleString('fr-FR')} FCFA`
                                                : dropoffLocation ? 'Calcul...' : 'Indiquez l\'adresse'}
                                        </Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Assurance colis</Text>
                                        <Text style={styles.summaryValue}>
                                            {insuranceCost > 0 ? `${insuranceCost.toLocaleString('fr-FR')} FCFA` : '0 FCFA'}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* Carte 3: Total + Solde */}
                        <View style={styles.summaryCardTotal}>
                            <View style={[styles.summaryRow, { paddingVertical: 12 }]}>
                                <Text style={styles.totalLabel}>Total à payer</Text>
                                <Text style={styles.totalValue}>
                                    {((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost).toLocaleString('fr-FR')} FCFA
                                </Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Votre solde</Text>
                                <Text style={[
                                    styles.summaryValue,
                                    userBalance < ((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost) && { color: '#EF4444' }
                                ]}>
                                    {userBalance.toLocaleString('fr-FR')} FCFA
                                </Text>
                            </View>
                            {userBalance < ((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost) && (
                                <Text style={styles.summaryWarning}>
                                    ⚠️ Solde insuffisant. Rechargez votre compte avant de confirmer.
                                </Text>
                            )}
                        </View>

                        {/* ✅ FIX 2026-03-03: Message de garantie remboursement */}
                        <View style={styles.guaranteeCard}>
                            <View style={styles.guaranteeHeader}>
                                <SafeIcon name="shield" size={20} color="#059669" />
                                <Text style={styles.guaranteeTitle}>Garantie satisfaction Yukpo</Text>
                            </View>
                            <Text style={styles.guaranteeText}>
                                Le paiement de la marchandise est intégralement remboursable si vous n'êtes pas satisfait à la livraison. Seuls les frais de livraison seront retenus.
                            </Text>
                            <View style={styles.guaranteeBullets}>
                                <View style={styles.guaranteeBulletRow}>
                                    <SafeIcon name="check-circle" size={14} color="#059669" />
                                    <Text style={styles.guaranteeBulletText}>Remboursement intégral du produit si insatisfaction</Text>
                                </View>
                                <View style={styles.guaranteeBulletRow}>
                                    <SafeIcon name="check-circle" size={14} color="#059669" />
                                    <Text style={styles.guaranteeBulletText}>Frais de livraison ({isDeliveryFree ? 'Gratuits' : deliveryCost !== null ? `${deliveryCost.toLocaleString('fr-FR')} FCFA` : '...'}) non remboursables</Text>
                                </View>
                                <View style={styles.guaranteeBulletRow}>
                                    <SafeIcon name="check-circle" size={14} color="#059669" />
                                    <Text style={styles.guaranteeBulletText}>Assurance colis incluse pour votre protection</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={onClose}
                        disabled={loading}
                    >
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.submitButton,
                            (!dropoffLocation || loading) && styles.submitButtonDisabled,
                            userBalance < ((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost) && styles.submitButtonWarning,
                        ]}
                        onPress={() => {
                            const totalCost = (productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost;
                            if (userBalance < totalCost) {
                                // ✅ NOUVEAU 2026-03-01: Rediriger vers la recharge si solde insuffisant
                                Alert.alert(
                                    'Solde insuffisant',
                                    'Votre solde est insuffisant pour cette commande. Voulez-vous recharger votre compte maintenant ?',
                                    [
                                        {
                                            text: 'Annuler',
                                            style: 'cancel',
                                            onPress: () => { }
                                        },
                                        {
                                            text: 'Recharger',
                                            onPress: () => {
                                                // Naviguer vers l'écran de recharge
                                                navigation.navigate('RechargeTokens' as any);
                                                onClose(); // Fermer le modal de livraison
                                            }
                                        }
                                    ]
                                );
                            } else {
                                handleSubmit();
                            }
                        }}
                        disabled={loading || !dropoffLocation}
                    >
                        <Text style={[
                            styles.submitButtonText,
                            userBalance < ((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost) && styles.submitButtonTextWarning
                        ]}>
                            {loading ? 'Création...' :
                                userBalance < ((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost)
                                    ? 'Recharger pour continuer'
                                    : `Confirmer ${((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost) > 0 ? `• ${((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0)) + insuranceCost).toLocaleString('fr-FR')} FCFA` : ''}`
                            }
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ✅ FIX 2026-03-03: Toast de confirmation animé */}
            {toastMessage && (
                <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
                    <LinearGradient
                        colors={['#059669', '#047857']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.toastGradient}
                    >
                        <SafeIcon name="check-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.toastText}>{toastMessage}</Text>
                    </LinearGradient>
                </Animated.View>
            )}

            {/* ✅ NOUVEAU : Modal GPS pour sélectionner une adresse sur la carte */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={
                    dropoffLocation
                        ? { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude }
                        : userGPS
                            ? { lat: userGPS.latitude, lng: userGPS.longitude }
                            : undefined
                }
                title="Sélectionner l'adresse de livraison"
                allowZoneSelection={false}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#E0E7FF',
        marginTop: 2,
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    locationCard: {
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 12,
    },
    locationCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    locationLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    locationCardPlaceholder: {
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    locationText: {
        fontSize: 15,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 12,
        lineHeight: 22,
    },
    placeholderText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    modifyButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    modifyButtonText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '500',
    },
    locationActions: {
        gap: 12,
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    locationButtonSecondary: {
        backgroundColor: '#FFFFFF',
        borderColor: modernColors.primary,
        borderWidth: 2,
    },
    locationButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: modernColors.primary,
    },
    hintText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    notesInput: {
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        fontSize: 14,
        color: modernColors.text,
        minHeight: 80,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    submitButton: {
        backgroundColor: modernColors.primary,
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.6,
    },
    submitButtonWarning: {
        backgroundColor: '#EF4444',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    submitButtonTextWarning: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    preferencesGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    preferenceItem: {
        flex: 1,
    },
    preferenceLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 8,
    },
    preferenceInput: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 14,
        color: modernColors.text,
    },
    pickerContainer: {
        marginTop: 0,
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
    },
    pickerText: {
        fontSize: 14,
        color: modernColors.text,
    },
    flexibilitySection: {
        marginTop: 8,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    checkboxLabel: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    flexibilityInput: {
        marginLeft: 32,
    },
    // ✅ Styles pour affichage promotions
    productNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    promoBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#FEE2E2',
        borderRadius: 4,
    },
    promoBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#DC2626',
    },
    promoBadgeSmall: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        backgroundColor: '#FEE2E2',
        borderRadius: 3,
        marginLeft: 4,
    },
    promoBadgeTextSmall: {
        fontSize: 9,
        fontWeight: '700',
        color: '#DC2626',
    },
    productPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    productOriginalPrice: {
        fontSize: 11,
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    productPricePromo: {
        color: '#16A34A',
        fontWeight: '600',
    },
    costLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    costValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    costOriginalPrice: {
        fontSize: 11,
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    costValuePromo: {
        color: '#16A34A',
        fontWeight: '600',
    },
    // ✅ Styles pour sélecteur de produits
    addProductButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 6,
    },
    addProductButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    productSelectorContainer: {
        marginTop: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
    },
    productSelectorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    productSelectorTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    closeSelectorButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
    },
    closeSelectorButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    productList: {
        maxHeight: 300,
    },
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    productItemSelected: {
        borderColor: modernColors.primary,
        borderWidth: 2,
        backgroundColor: '#EFF6FF',
    },
    productThumb: {
        width: 44,
        height: 44,
        borderRadius: 8,
        marginRight: 10,
        backgroundColor: '#F3F4F6',
    },
    productThumbPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxContainer: {
        marginRight: 12,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    // ✅ Styles pour produits sélectionnés
    selectedProductsList: {
        marginTop: 12,
        gap: 8,
    },
    selectedProductCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    selectedProductThumb: {
        width: 36,
        height: 36,
        borderRadius: 6,
        marginRight: 8,
        backgroundColor: '#F3F4F6',
    },
    selectedProductInfo: {
        flex: 1,
    },
    selectedProductName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    selectedProductPrice: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    removeProductButton: {
        padding: 8,
        marginLeft: 8,
    },
    // ✅ FIX 2026-03-01: Styles pour récapitulatif de commande structuré
    summarySection: {
        marginTop: 24,
        marginBottom: 8,
    },
    summarySectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    summarySectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 10,
    },
    summaryCardTotal: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: modernColors.primary,
        marginBottom: 10,
    },
    summaryCardTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        flex: 1,
    },
    summaryLabelLight: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    summaryLoadingText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
        paddingVertical: 8,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#BFDBFE',
        marginVertical: 8,
    },
    summaryWarning: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 8,
        fontStyle: 'italic',
    },
    // ✅ Styles hérités pour compatibilité
    costsSection: {
        marginTop: 24,
    },
    costsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    costsCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    productsDetail: {
        marginBottom: 12,
    },
    costRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    costLabel: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    costValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    subtotalRow: {
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        marginTop: 8,
        paddingTop: 12,
    },
    subtotalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    totalRow: {
        borderTopWidth: 2,
        borderTopColor: modernColors.primary,
        marginTop: 12,
        paddingTop: 12,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    freeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#D1FAE5',
        borderRadius: 4,
        marginLeft: 8,
    },
    freeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#065F46',
    },
    // ✅ NOUVEAU 2026-01-23: Styles pour sélection de variation
    variantsScrollView: {
        marginTop: 12,
    },
    variantsScrollContent: {
        gap: 12,
        paddingRight: 20,
    },
    variantCard: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        minWidth: 140,
        position: 'relative',
    },
    variantCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#EFF6FF',
    },
    variantValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    variantValueSelected: {
        color: modernColors.primary,
    },
    variantPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    variantPriceSelected: {
        color: modernColors.primary,
    },
    variantCheckmark: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ✅ NOUVEAU 2026-01-23: Styles pour sélection de quantité
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginTop: 12,
    },
    quantityButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityButtonDisabled: {
        opacity: 0.5,
    },
    quantityInput: {
        width: 80,
        height: 44,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderRadius: 12,
    },
    // ✅ FIX 2026-03-03: Styles pour toast de confirmation
    toastContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        zIndex: 9999,
        elevation: 10,
    },
    toastGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    toastText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
    },
    // ✅ FIX 2026-03-03: Styles pour sélecteur de mode de livraison
    deliveryModeContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    deliveryModeCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        position: 'relative',
    },
    deliveryModeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 4,
        textAlign: 'center',
    },
    deliveryModeDesc: {
        fontSize: 10,
        color: modernColors.textSecondary,
        marginTop: 2,
        textAlign: 'center',
    },
    deliveryModeCheck: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ✅ FIX 2026-03-03: Styles pour la garantie remboursement
    guaranteeCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#BBF7D0',
        marginTop: 12,
    },
    guaranteeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    guaranteeTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#059669',
    },
    guaranteeText: {
        fontSize: 13,
        color: '#065F46',
        lineHeight: 20,
        marginBottom: 10,
    },
    guaranteeBullets: {
        gap: 6,
    },
    guaranteeBulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    guaranteeBulletText: {
        fontSize: 12,
        color: '#065F46',
        flex: 1,
        lineHeight: 18,
    },
});

export default OrderDeliveryModal;

