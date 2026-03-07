import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { VEHICLE_TRANSPORT_OPTIONS, type VehicleType } from '../../config/deliveryConfig';
import { apiGet, apiPost, deliveryApi } from '../../services/api';
import { productsService } from '../../services/productsService';
import { modernColors } from '../../theme/modernTheme';
import { LocationObject } from '../LocationSelector';
import ModernGPSModal from '../ModernGPSModal';
import SafeIcon from '../SafeIcon';
import { NativeButton } from '../SafeNativeDesign';
import TimeSlotPicker from './TimeSlotPicker';

interface ProductDeliveryConfigModalProps {
    visible: boolean;
    onClose: () => void;
    serviceId: number;
    productIndex: number; // -1 pour mode transversal
    productName: string | any; // ✅ CORRECTION: Accepter any pour gérer les cas où ce n'est pas une string
    onSuccess?: () => void;
    allProducts?: Array<{ index: number; name: string }>;
}

interface ParcelType {
    id: number;
    name: string;
    description?: string;
}

const ProductDeliveryConfigModal: React.FC<ProductDeliveryConfigModalProps> = ({
    visible,
    onClose,
    serviceId,
    productIndex,
    productName,
    onSuccess,
    allProducts = []
}) => {
    // ✅ CORRECTION CRITIQUE: Normaliser productName pour s'assurer que c'est toujours une string valide
    const normalizedProductName = React.useMemo(() => {
        if (!productName) return 'Produit';
        if (typeof productName === 'string') {
            const trimmed = productName.trim();
            return trimmed.length > 0 ? trimmed : 'Produit';
        }
        if (typeof productName === 'number' || typeof productName === 'boolean') {
            return String(productName);
        }
        // Si c'est un objet, essayer d'extraire une valeur string
        if (typeof productName === 'object') {
            if ('valeur' in productName && typeof productName.valeur === 'string') {
                return productName.valeur.trim() || 'Produit';
            }
            if ('nom' in productName && typeof productName.nom === 'string') {
                return productName.nom.trim() || 'Produit';
            }
            if ('name' in productName && typeof productName.name === 'string') {
                return productName.name.trim() || 'Produit';
            }
        }
        // Fallback: convertir en string
        try {
            const str = String(productName);
            return str && str !== '[object Object]' ? str : 'Produit';
        } catch {
            return 'Produit';
        }
    }, [productName]);

    // ✅ CORRECTION: Normaliser allProducts pour s'assurer que c'est toujours un tableau valide
    const normalizedAllProducts = React.useMemo(() => {
        if (!allProducts) return [];
        if (!Array.isArray(allProducts)) return [];
        return allProducts.filter(p => p && (typeof p.index === 'number' || typeof p.name === 'string'));
    }, [allProducts]);

    const isTransversalMode = productIndex === -1;
    const [loading, setLoading] = useState(false);
    const [parcelTypes, setParcelTypes] = useState<ParcelType[]>([]);
    const [storageLocations, setStorageLocations] = useState<Array<{
        id: number;
        name: string;
        address: string;
        latitude: number;
        longitude: number;
        is_active: boolean;
    }>>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);

    // ✅ NOUVEAU: Options de réutilisation de configuration
    const [useExistingConfig, setUseExistingConfig] = useState(false);
    const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
    const [availableProducts, setAvailableProducts] = useState<Array<{ index: number, name: string, is_configured: boolean }>>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    // ✅ NOUVEAU: Indique si le formulaire a été pré-rempli depuis un autre produit
    const [prefilledFromProduct, setPrefilledFromProduct] = useState<string | null>(null);
    // ✅ NOUVEAU: État pour le modal GPS
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [gpsModalForIndex, setGpsModalForIndex] = useState<number | null>(null); // Index de l'adresse en cours de sélection
    // ✅ NOUVEAU 2026-01-02: État pour le modal de sélection de véhicule
    const [showVehicleModal, setShowVehicleModal] = useState(false);

    // ✅ NOUVEAU: Array d'adresses de récupération du produit (au moins une obligatoire)
    const [pickupAddresses, setPickupAddresses] = useState<Array<{
        id: string; // ID temporaire unique pour React key
        address: string;
        location: LocationObject | null;
        latitude: number;
        longitude: number;
    }>>([]);

    const [config, setConfig] = useState({
        required_vehicle_type_id: 0,
        preparation_time_minutes: '', // ✅ NOUVEAU: Temps de préparation en minutes
        weight_kg: '',
        volume_cm3: '',
        requires_isothermal: false,
        requires_fragile_handling: false,
        pickup_availability_schedule: '{}',
        pickup_instructions: '',
        billing_mode: 'standard',
        billing_partner_label: '',
        storage_location_id: null as number | null // ✅ NOUVEAU: Lieu de stockage GPS
    });

    // ✅ NOUVEAU: État pour stocker les données du produit
    const [productData, setProductData] = useState<any>(null);

    // ✅ CORRECTION: Reset complet des états quand le modal s'ouvre pour un nouveau produit
    useEffect(() => {
        if (visible) {
            setPrefilledFromProduct(null);
            setUseExistingConfig(false);
            setSelectedProductIndex(null);
            setProductData(null);
            setConfig({
                required_vehicle_type_id: 0,
                preparation_time_minutes: '',
                weight_kg: '',
                volume_cm3: '',
                requires_isothermal: false,
                requires_fragile_handling: false,
                pickup_availability_schedule: '{}',
                pickup_instructions: '',
                billing_mode: 'standard',
                billing_partner_label: '',
                storage_location_id: null,
            });
            setPickupAddresses([{
                id: `pickup_reset_${Date.now()}`,
                address: '',
                location: null,
                latitude: 0,
                longitude: 0,
            }]);
        }
    }, [visible, productIndex]);

    // ✅ NOUVEAU: Charger la liste des produits configurés pour proposer la réutilisation
    useEffect(() => {
        const loadAvailableConfigs = async () => {
            if (visible && !isTransversalMode && serviceId) {
                setLoadingProducts(true);
                try {
                    const response = await deliveryApi.listProductDeliveryConfigs(serviceId);
                    if (response.success && response.data) {
                        const data = response.data as any;
                        const products = Array.isArray(data.products) ? data.products : [];
                        // Filtrer pour ne garder que les produits AUTRES que le produit actuel ET qui sont configurés
                        const otherConfigured = products.filter(
                            (p: any) => p.index !== productIndex && p.is_configured
                        );
                        setAvailableProducts(otherConfigured);
                        console.log('[ProductDeliveryConfigModal] ✅ Produits configurés disponibles:', otherConfigured.length);
                    }
                } catch (error) {
                    console.warn('[ProductDeliveryConfigModal] Erreur chargement produits configurés:', error);
                    setAvailableProducts([]);
                } finally {
                    setLoadingProducts(false);
                }
            }
        };
        loadAvailableConfigs();
    }, [visible, serviceId, productIndex, isTransversalMode]);

    // ✅ NOUVEAU: Charger la config d'un produit existant quand l'utilisateur en sélectionne un pour réutiliser
    useEffect(() => {
        const loadSelectedConfig = async () => {
            if (selectedProductIndex === null || !serviceId || !useExistingConfig) return;
            setLoading(true);
            try {
                const response = await apiGet(`/api/delivery/product-config/${serviceId}/${selectedProductIndex}`);
                if (response.success && response.data && typeof response.data === 'object' && 'config' in response.data) {
                    const data = response.data as any;
                    const c = data.config;

                    // Pré-remplir le formulaire avec la config du produit sélectionné
                    const pickupAddr = (typeof c.pickup_address === 'string' ? c.pickup_address : '') || '';
                    const pickupLat = (typeof c.pickup_latitude === 'number' ? c.pickup_latitude : 0) || 0;
                    const pickupLng = (typeof c.pickup_longitude === 'number' ? c.pickup_longitude : 0) || 0;

                    if (pickupAddr) {
                        const pickupLocationObj: LocationObject | null = {
                            raw: pickupAddr,
                            place_name: pickupAddr,
                            components: {},
                            coordinates: (pickupLat !== 0 && pickupLng !== 0) ? { lat: pickupLat, lng: pickupLng } : undefined
                        };
                        setPickupAddresses([{
                            id: `pickup_reuse_${Date.now()}`,
                            address: pickupAddr,
                            location: pickupLocationObj,
                            latitude: pickupLat,
                            longitude: pickupLng,
                        }]);
                    }

                    setConfig({
                        required_vehicle_type_id: (typeof c.required_vehicle_type_id === 'number' ? c.required_vehicle_type_id : 0) || 0,
                        preparation_time_minutes: c.preparation_time_minutes ? String(c.preparation_time_minutes) : '0',
                        weight_kg: c.weight_kg ? String(c.weight_kg) : '',
                        volume_cm3: c.volume_cm3 ? String(c.volume_cm3) : '',
                        requires_isothermal: typeof c.requires_isothermal === 'boolean' ? c.requires_isothermal : false,
                        requires_fragile_handling: typeof c.requires_fragile_handling === 'boolean' ? c.requires_fragile_handling : false,
                        pickup_availability_schedule: JSON.stringify(c.pickup_availability_schedule || {}, null, 2),
                        pickup_instructions: (typeof c.pickup_instructions === 'string' ? c.pickup_instructions : '') || '',
                        billing_mode: (typeof c.billing_mode === 'string' ? c.billing_mode : 'standard') || 'standard',
                        billing_partner_label: (typeof c.billing_partner_label === 'string' ? c.billing_partner_label : '') || '',
                        storage_location_id: (typeof c.storage_location_id === 'number' ? c.storage_location_id : null) || null
                    });

                    const selectedName = availableProducts.find(p => p.index === selectedProductIndex)?.name || 'produit';
                    Alert.alert('Configuration copiée', `La configuration de "${selectedName}" a été chargée. Vous pouvez modifier les champs avant d'enregistrer.`);
                } else {
                    Alert.alert('Erreur', 'Impossible de charger la configuration du produit sélectionné.');
                }
            } catch (error) {
                console.error('[ProductDeliveryConfigModal] Erreur chargement config réutilisée:', error);
                Alert.alert('Erreur', 'Impossible de charger la configuration du produit sélectionné.');
            } finally {
                setLoading(false);
            }
        };
        loadSelectedConfig();
    }, [selectedProductIndex, serviceId, useExistingConfig]);

    // ✅ PHASE 4: Charger le produit depuis l'API si nécessaire
    useEffect(() => {
        const loadProduct = async () => {
            if (visible && !isTransversalMode && serviceId && productIndex >= 0) {
                // ✅ NOUVEAU: Retry logic pour gérer le cas où le produit n'est pas encore synchronisé
                let retryCount = 0;
                const maxRetries = 3;
                const retryDelays = [500, 1000, 1500]; // Délais en ms
                let productLoaded = false;

                while (retryCount <= maxRetries && !productLoaded) {
                    try {
                        const product = await productsService.getProduct(serviceId, productIndex);
                        setProductData(product);
                        console.log('[ProductDeliveryConfigModal] ✅ Produit chargé depuis API:', product.product_name);
                        productLoaded = true;

                        // ✅ NOUVEAU: Charger lieu_produit depuis product_data si disponible
                        const lieuProduit = product.product_data?.lieu_produit || product.product_data?.lieu_commercial || product.product_data?.lieu_commercialisation;
                        if (lieuProduit) {
                            // Extraire l'adresse textuelle et les coordonnées depuis lieu_produit
                            let addressText = '';
                            let latitude = 0;
                            let longitude = 0;
                            let locationObj: LocationObject | null = null;

                            // lieu_produit peut être un string (adresse textuelle) ou un objet LocationObject
                            if (typeof lieuProduit === 'string') {
                                addressText = lieuProduit;
                                // Essayer de parser pour extraire les coordonnées si elles sont incluses
                                locationObj = {
                                    raw: lieuProduit,
                                    place_name: lieuProduit,
                                    components: {},
                                };
                            } else if (typeof lieuProduit === 'object' && lieuProduit !== null) {
                                // Si c'est un objet avec valeur
                                if (lieuProduit.valeur) {
                                    if (typeof lieuProduit.valeur === 'string') {
                                        addressText = lieuProduit.valeur;
                                        locationObj = {
                                            raw: lieuProduit.valeur,
                                            place_name: lieuProduit.valeur,
                                            components: lieuProduit.composants || {},
                                            coordinates: lieuProduit.coordinates || undefined,
                                        };
                                        if (lieuProduit.coordinates) {
                                            latitude = lieuProduit.coordinates.lat || 0;
                                            longitude = lieuProduit.coordinates.lng || 0;
                                        }
                                    } else if (typeof lieuProduit.valeur === 'object' && lieuProduit.valeur.raw) {
                                        // Format LocationObject complet
                                        addressText = lieuProduit.valeur.raw || lieuProduit.valeur.place_name || '';
                                        locationObj = lieuProduit.valeur;
                                        if (lieuProduit.valeur.coordinates) {
                                            latitude = lieuProduit.valeur.coordinates.lat || 0;
                                            longitude = lieuProduit.valeur.coordinates.lng || 0;
                                        }
                                    }
                                } else if (lieuProduit.raw || lieuProduit.place_name) {
                                    // Format LocationObject direct
                                    addressText = lieuProduit.raw || lieuProduit.place_name || '';
                                    locationObj = lieuProduit as LocationObject;
                                    if (lieuProduit.coordinates) {
                                        latitude = lieuProduit.coordinates.lat || 0;
                                        longitude = lieuProduit.coordinates.lng || 0;
                                    }
                                }
                            }

                            // Si on a une adresse textuelle mais pas de coordonnées, on garde quand même l'adresse
                            // L'utilisateur pourra la compléter avec GPS si nécessaire
                            if (addressText) {
                                console.log('[ProductDeliveryConfigModal] ✅ Lieu produit trouvé:', addressText);
                                // Initialiser pickupAddresses avec cette adresse si pas encore chargée
                                setPickupAddresses(prev => {
                                    // Ne pas écraser si une config existe déjà
                                    if (prev.length > 0 && prev[0].address) {
                                        return prev;
                                    }
                                    return [{
                                        id: `pickup_product_${Date.now()}`,
                                        address: addressText,
                                        location: locationObj,
                                        latitude,
                                        longitude,
                                    }];
                                });
                            }
                        }

                        // Si on arrive ici, le produit a été chargé avec succès
                        break;
                    } catch (error: any) {
                        const errorMsg = error?.message || error?.error || String(error);
                        const isNotFoundError = errorMsg.includes('non trouvé') ||
                            errorMsg.includes('not found') ||
                            errorMsg.includes('404') ||
                            errorMsg.includes('Produit');

                        if (isNotFoundError && retryCount < maxRetries) {
                            // Produit non trouvé, retry avec délai
                            const delay = retryDelays[retryCount] || 1500;
                            console.log(`[ProductDeliveryConfigModal] Produit non trouvé, retry ${retryCount + 1}/${maxRetries} dans ${delay}ms...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            retryCount++;
                        } else {
                            // Autre erreur ou max retries atteint
                            console.warn('[ProductDeliveryConfigModal] Erreur chargement produit depuis API après retries, utilisation productName prop:', error);
                            // Fallback : utiliser productName fourni en prop
                            break;
                        }
                    }
                }
            }
        };

        loadProduct();
    }, [visible, serviceId, productIndex, isTransversalMode]);

    useEffect(() => {
        if (visible) {
            loadParcelTypes();
            loadStorageLocations();
            if (!isTransversalMode) {
                // ✅ CORRIGÉ: Attendre que productData soit chargé avant de charger la config existante
                // pour éviter d'écraser l'adresse du produit
                if (productData) {
                    loadExistingConfig();
                }
            } else {
                // En mode transversal, initialiser avec une adresse vide
                setPickupAddresses([{
                    id: `pickup_${Date.now()}`,
                    address: '',
                    location: null,
                    latitude: 0,
                    longitude: 0,
                }]);
            }
        }
    }, [visible, serviceId, productIndex, productData]);

    const loadStorageLocations = async () => {
        setLoadingLocations(true);
        try {
            const response = await deliveryApi.listStorageLocations();
            if (response.success && response.data) {
                const data = response.data as any;
                const activeLocations = Array.isArray(data?.locations)
                    ? data.locations.filter((loc: any) => loc && loc.is_active)
                    : [];
                setStorageLocations(activeLocations);
            }
        } catch (error) {
            console.error('Erreur chargement lieux de stock:', error);
        } finally {
            setLoadingLocations(false);
        }
    };

    // ✅ Mettre à jour les coordonnées de la première adresse quand un lieu de stock est sélectionné
    useEffect(() => {
        if (config.storage_location_id && storageLocations.length > 0 && pickupAddresses.length > 0) {
            const selectedLocation = storageLocations.find(loc => loc.id === config.storage_location_id);
            if (selectedLocation) {
                // Mettre à jour la première adresse de récupération avec les coordonnées du lieu de stockage
                setPickupAddresses(prev => {
                    const updated = [...prev];
                    if (updated[0]) {
                        updated[0] = {
                            ...updated[0],
                            address: selectedLocation.address,
                            latitude: selectedLocation.latitude,
                            longitude: selectedLocation.longitude,
                            location: {
                                raw: selectedLocation.address,
                                place_name: selectedLocation.address,
                                components: {},
                                coordinates: { lat: selectedLocation.latitude, lng: selectedLocation.longitude }
                            }
                        };
                    }
                    return updated;
                });
            }
        }
    }, [config.storage_location_id, storageLocations]);

    // ✅ NOUVEAU: Fonction pour ajouter une nouvelle adresse de récupération
    const handleAddPickupAddress = () => {
        const newId = `pickup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setPickupAddresses(prev => [...prev, {
            id: newId,
            address: '',
            location: null,
            latitude: 0,
            longitude: 0,
        }]);
    };

    // ✅ NOUVEAU: Fonction pour supprimer une adresse de récupération
    const handleRemovePickupAddress = (id: string) => {
        setPickupAddresses(prev => {
            const filtered = prev.filter(addr => addr.id !== id);
            // S'assurer qu'il reste au moins une adresse
            if (filtered.length === 0) {
                return [{
                    id: `pickup_${Date.now()}`,
                    address: '',
                    location: null,
                    latitude: 0,
                    longitude: 0,
                }];
            }
            return filtered;
        });
    };

    // ✅ NOUVEAU: Fonction pour mettre à jour une adresse de récupération
    const handleUpdatePickupAddress = (id: string, updates: Partial<typeof pickupAddresses[0]>) => {
        setPickupAddresses(prev => prev.map(addr =>
            addr.id === id ? { ...addr, ...updates } : addr
        ));
    };

    const loadParcelTypes = async () => {
        try {
            const response = await apiGet('/api/delivery/parcel-types');
            if (response.success && response.data && typeof response.data === 'object' && 'parcel_types' in response.data) {
                const data = response.data as any;
                if (Array.isArray(data.parcel_types)) {
                    setParcelTypes(data.parcel_types);
                }
            }
        } catch (error) {
            console.error('Erreur chargement types de colis:', error);
        }
    };

    // ✅ NOUVEAU: Fonction pour mapper VehicleType vers ID numérique
    // On utilise l'index + 1 comme ID (1-based) pour correspondre aux IDs de la base
    const getVehicleTypeId = (vehicleType: VehicleType): number => {
        const index = VEHICLE_TRANSPORT_OPTIONS.findIndex(v => v.value === vehicleType);
        return index >= 0 ? index + 1 : 0;
    };

    // ✅ NOUVEAU: Fonction pour mapper ID numérique vers VehicleType
    const getVehicleTypeFromId = (id: number): VehicleType | null => {
        const index = id - 1; // Convertir en 0-based
        if (index >= 0 && index < VEHICLE_TRANSPORT_OPTIONS.length) {
            return VEHICLE_TRANSPORT_OPTIONS[index].value;
        }
        return null;
    };

    const loadExistingConfig = async () => {
        try {
            const response = await apiGet(`/api/delivery/product-config/${serviceId}/${productIndex}`);
            if (response.success && response.data && typeof response.data === 'object' && 'config' in response.data) {
                const data = response.data as any;
                const c = data.config;

                // ✅ NOUVEAU: Charger l'adresse existante comme première adresse de récupération
                const pickupAddr = (typeof c.pickup_address === 'string' ? c.pickup_address : '') || '';
                const pickupLat = (typeof c.pickup_latitude === 'number' ? c.pickup_latitude : 0) || 0;
                const pickupLng = (typeof c.pickup_longitude === 'number' ? c.pickup_longitude : 0) || 0;

                // ✅ CORRIGÉ: Ne pas écraser si une adresse du produit existe déjà (même sans coordonnées GPS)
                setPickupAddresses(prev => {
                    // Si une adresse textuelle existe déjà (depuis lieu_produit), ne pas l'écraser
                    // Même si elle n'a pas de coordonnées GPS, l'utilisateur peut les ajouter manuellement
                    if (prev.length > 0 && prev[0].address && prev[0].address.trim().length > 0) {
                        return prev;
                    }

                    // Sinon, utiliser l'adresse de la config existante ou créer une adresse vide
                    const pickupLocationObj: LocationObject | null = pickupAddr
                        ? {
                            raw: pickupAddr,
                            place_name: pickupAddr,
                            components: {},
                            coordinates: (pickupLat !== 0 && pickupLng !== 0) ? { lat: pickupLat, lng: pickupLng } : undefined
                        }
                        : null;

                    return pickupAddr ? [{
                        id: `pickup_existing_${Date.now()}`,
                        address: pickupAddr,
                        location: pickupLocationObj,
                        latitude: pickupLat,
                        longitude: pickupLng,
                    }] : [{
                        id: `pickup_${Date.now()}`,
                        address: '',
                        location: null,
                        latitude: 0,
                        longitude: 0,
                    }];
                });

                setConfig({
                    required_vehicle_type_id: (typeof c.required_vehicle_type_id === 'number' ? c.required_vehicle_type_id : 0) || 0,
                    preparation_time_minutes: c.preparation_time_minutes ? String(c.preparation_time_minutes) : '0',
                    weight_kg: c.weight_kg ? String(c.weight_kg) : '',
                    volume_cm3: c.volume_cm3 ? String(c.volume_cm3) : '',
                    requires_isothermal: typeof c.requires_isothermal === 'boolean' ? c.requires_isothermal : false,
                    requires_fragile_handling: typeof c.requires_fragile_handling === 'boolean' ? c.requires_fragile_handling : false,
                    pickup_availability_schedule: JSON.stringify(c.pickup_availability_schedule || {}, null, 2),
                    pickup_instructions: (typeof c.pickup_instructions === 'string' ? c.pickup_instructions : '') || '',
                    billing_mode: (typeof c.billing_mode === 'string' ? c.billing_mode : 'standard') || 'standard',
                    billing_partner_label: (typeof c.billing_partner_label === 'string' ? c.billing_partner_label : '') || '',
                    storage_location_id: (typeof c.storage_location_id === 'number' ? c.storage_location_id : null) || null // ✅ NOUVEAU: Charger le lieu de stockage
                });
            } else {
                // ✅ CORRECTION CRITIQUE: Si pas de config pour ce produit, chercher une config existante
                // d'un AUTRE produit du même service pour pré-remplir le formulaire
                console.log('[ProductDeliveryConfigModal] ℹ️ Pas de config pour ce produit, recherche config existante...');
                let prefilledFromExisting = false;

                try {
                    const listResponse = await deliveryApi.listProductDeliveryConfigs(serviceId);
                    if (listResponse.success && listResponse.data) {
                        const listData = listResponse.data as any;
                        const allProducts = Array.isArray(listData.products) ? listData.products : [];
                        const configuredOther = allProducts.filter(
                            (p: any) => p.index !== productIndex && p.is_configured
                        );

                        if (configuredOther.length > 0) {
                            const sourceProduct = configuredOther[0];
                            console.log('[ProductDeliveryConfigModal] ✅ Config trouvée depuis:', sourceProduct.name);

                            const configResponse = await apiGet(`/api/delivery/product-config/${serviceId}/${sourceProduct.index}`);
                            if (configResponse.success && configResponse.data && typeof configResponse.data === 'object' && 'config' in configResponse.data) {
                                const cfgData = configResponse.data as any;
                                const c = cfgData.config;

                                const pickupAddr = (typeof c.pickup_address === 'string' ? c.pickup_address : '') || '';
                                const pickupLat = (typeof c.pickup_latitude === 'number' ? c.pickup_latitude : 0) || 0;
                                const pickupLng = (typeof c.pickup_longitude === 'number' ? c.pickup_longitude : 0) || 0;

                                if (pickupAddr) {
                                    // Préserver l'adresse lieu_produit si déjà définie
                                    setPickupAddresses(prev => {
                                        if (prev.length > 0 && prev[0].address && prev[0].address.trim().length > 0) {
                                            return prev;
                                        }
                                        const pickupLocationObj: LocationObject | null = {
                                            raw: pickupAddr,
                                            place_name: pickupAddr,
                                            components: {},
                                            coordinates: (pickupLat !== 0 && pickupLng !== 0) ? { lat: pickupLat, lng: pickupLng } : undefined
                                        };
                                        return [{
                                            id: `pickup_prefill_${Date.now()}`,
                                            address: pickupAddr,
                                            location: pickupLocationObj,
                                            latitude: pickupLat,
                                            longitude: pickupLng,
                                        }];
                                    });
                                }

                                setConfig({
                                    required_vehicle_type_id: (typeof c.required_vehicle_type_id === 'number' ? c.required_vehicle_type_id : 0) || 0,
                                    preparation_time_minutes: c.preparation_time_minutes ? String(c.preparation_time_minutes) : '0',
                                    weight_kg: c.weight_kg ? String(c.weight_kg) : '',
                                    volume_cm3: c.volume_cm3 ? String(c.volume_cm3) : '',
                                    requires_isothermal: typeof c.requires_isothermal === 'boolean' ? c.requires_isothermal : false,
                                    requires_fragile_handling: typeof c.requires_fragile_handling === 'boolean' ? c.requires_fragile_handling : false,
                                    pickup_availability_schedule: JSON.stringify(c.pickup_availability_schedule || {}, null, 2),
                                    pickup_instructions: (typeof c.pickup_instructions === 'string' ? c.pickup_instructions : '') || '',
                                    billing_mode: (typeof c.billing_mode === 'string' ? c.billing_mode : 'standard') || 'standard',
                                    billing_partner_label: (typeof c.billing_partner_label === 'string' ? c.billing_partner_label : '') || '',
                                    storage_location_id: (typeof c.storage_location_id === 'number' ? c.storage_location_id : null) || null
                                });

                                setPrefilledFromProduct(sourceProduct.name || 'un autre produit');
                                prefilledFromExisting = true;
                                console.log('[ProductDeliveryConfigModal] ✅ Formulaire pré-rempli depuis:', sourceProduct.name);
                            }
                        }
                    }
                } catch (prefillError) {
                    console.warn('[ProductDeliveryConfigModal] ⚠️ Erreur pré-remplissage depuis config existante:', prefillError);
                }

                // Si pas de pré-remplissage depuis un autre produit, essayer lieu_produit
                if (!prefilledFromExisting) {
                    if (productData?.product_data) {
                        const lieuProduit = productData.product_data.lieu_produit || productData.product_data.lieu_commercial || productData.product_data.lieu_commercialisation;
                        if (lieuProduit) {
                            let addressText = '';
                            let latitude = 0;
                            let longitude = 0;
                            let locationObj: LocationObject | null = null;

                            if (typeof lieuProduit === 'string') {
                                addressText = lieuProduit;
                                locationObj = {
                                    raw: lieuProduit,
                                    place_name: lieuProduit,
                                    components: {},
                                };
                            } else if (typeof lieuProduit === 'object' && lieuProduit !== null) {
                                if (lieuProduit.valeur) {
                                    if (typeof lieuProduit.valeur === 'string') {
                                        addressText = lieuProduit.valeur;
                                        locationObj = {
                                            raw: lieuProduit.valeur,
                                            place_name: lieuProduit.valeur,
                                            components: lieuProduit.composants || {},
                                            coordinates: lieuProduit.coordinates || undefined,
                                        };
                                        if (lieuProduit.coordinates) {
                                            latitude = lieuProduit.coordinates.lat || 0;
                                            longitude = lieuProduit.coordinates.lng || 0;
                                        }
                                    } else if (typeof lieuProduit.valeur === 'object' && lieuProduit.valeur.raw) {
                                        addressText = lieuProduit.valeur.raw || lieuProduit.valeur.place_name || '';
                                        locationObj = lieuProduit.valeur;
                                        if (lieuProduit.valeur.coordinates) {
                                            latitude = lieuProduit.valeur.coordinates.lat || 0;
                                            longitude = lieuProduit.valeur.coordinates.lng || 0;
                                        }
                                    }
                                } else if (lieuProduit.raw || lieuProduit.place_name) {
                                    addressText = lieuProduit.raw || lieuProduit.place_name || '';
                                    locationObj = lieuProduit as LocationObject;
                                    if (lieuProduit.coordinates) {
                                        latitude = lieuProduit.coordinates.lat || 0;
                                        longitude = lieuProduit.coordinates.lng || 0;
                                    }
                                }
                            }

                            if (addressText) {
                                setPickupAddresses([{
                                    id: `pickup_product_${Date.now()}`,
                                    address: addressText,
                                    location: locationObj,
                                    latitude,
                                    longitude,
                                }]);
                                return;
                            }
                        }
                    }

                    // Si pas de lieu_produit non plus, initialiser avec une adresse vide
                    setPickupAddresses([{
                        id: `pickup_${Date.now()}`,
                        address: '',
                        location: null,
                        latitude: 0,
                        longitude: 0,
                    }]);
                }
            }
        } catch (error) {
            console.error('Erreur chargement configuration:', error);
            // Initialiser avec une adresse vide en cas d'erreur
            setPickupAddresses([{
                id: `pickup_${Date.now()}`,
                address: '',
                location: null,
                latitude: 0,
                longitude: 0,
            }]);
        }
    };

    const handleSave = async () => {
        // ✅ NOUVEAU: Valider qu'il y a au moins une adresse de récupération valide
        const validAddresses = pickupAddresses.filter(addr =>
            addr.address.trim() &&
            addr.latitude !== 0 &&
            addr.longitude !== 0 &&
            !isNaN(addr.latitude) &&
            !isNaN(addr.longitude)
        );

        if (validAddresses.length === 0) {
            Alert.alert('Erreur', 'Au moins une adresse de récupération du produit avec coordonnées GPS valides est obligatoire');
            return;
        }

        // ✅ Utiliser la première adresse valide comme principale (pour compatibilité backend)
        const primaryAddress = validAddresses[0];

        const vehicleTypeId = typeof config.required_vehicle_type_id === 'number' ? config.required_vehicle_type_id : 0;
        if (!vehicleTypeId) {
            Alert.alert('Erreur', 'Le type de véhicule est obligatoire');
            return;
        }

        // ✅ NOUVEAU: Valider le temps de préparation
        const preparationTimeStr = config?.preparation_time_minutes && typeof config.preparation_time_minutes === 'string'
            ? config.preparation_time_minutes.trim()
            : '0';
        const preparationTime = preparationTimeStr ? parseInt(preparationTimeStr, 10) : 0;
        if (isNaN(preparationTime) || preparationTime < 0) {
            Alert.alert('Erreur', 'Le temps de préparation doit être un nombre positif ou nul (0 = instantané)');
            return;
        }

        let schedule;
        try {
            schedule = JSON.parse(config?.pickup_availability_schedule || '{}');
            if (Object.keys(schedule).length === 0) {
                Alert.alert('Erreur', 'Veuillez définir au moins une plage horaire de récupération');
                return;
            }
        } catch {
            Alert.alert('Erreur', 'Format JSON invalide pour les plages horaires');
            return;
        }

        setLoading(true);
        try {
            // ✅ CORRIGÉ: Validation approfondie des coordonnées GPS
            if (primaryAddress.latitude === 0 && primaryAddress.longitude === 0) {
                Alert.alert('Erreur', 'Les coordonnées GPS de la première adresse de récupération sont invalides. Veuillez sélectionner une adresse avec des coordonnées valides.');
                setLoading(false);
                return;
            }

            // ✅ Validation que les coordonnées sont dans des plages valides
            if (primaryAddress.latitude < -90 || primaryAddress.latitude > 90 ||
                primaryAddress.longitude < -180 || primaryAddress.longitude > 180) {
                Alert.alert('Erreur', 'Les coordonnées GPS sont hors limites. Veuillez sélectionner une adresse valide.');
                setLoading(false);
                return;
            }

            // ✅ VALIDATION CRITIQUE: Vérifier service_id et product_index
            if (!serviceId || serviceId <= 0) {
                Alert.alert('Erreur', 'ID de service invalide');
                setLoading(false);
                return;
            }
            if (!isTransversalMode && (productIndex === null || productIndex === undefined || productIndex < 0)) {
                Alert.alert('Erreur', 'Index de produit invalide');
                setLoading(false);
                return;
            }

            // ✅ VALIDATION FINALE: Vérifier que tous les champs requis sont présents et valides
            const vehicleTypeId = config && typeof config.required_vehicle_type_id === 'number' ? config.required_vehicle_type_id : 0;
            if (vehicleTypeId <= 0) {
                Alert.alert('Erreur', 'Le type de véhicule est obligatoire et doit être sélectionné');
                setLoading(false);
                return;
            }

            // ✅ VALIDATION: Vérifier que le schedule est un objet valide (pas une string)
            let finalSchedule = schedule;
            if (typeof schedule === 'string') {
                try {
                    finalSchedule = JSON.parse(schedule);
                } catch (e) {
                    Alert.alert('Erreur', 'Format JSON invalide pour les plages horaires');
                    setLoading(false);
                    return;
                }
            }
            if (!finalSchedule || typeof finalSchedule !== 'object' || Array.isArray(finalSchedule) || Object.keys(finalSchedule).length === 0) {
                Alert.alert('Erreur', 'Veuillez définir au moins une plage horaire de récupération valide');
                setLoading(false);
                return;
            }

            // ✅ CORRIGÉ: Convertir les clés françaises en clés anglaises pour le backend
            const dayMapping: { [key: string]: string } = {
                'lundi': 'monday',
                'mardi': 'tuesday',
                'mercredi': 'wednesday',
                'jeudi': 'thursday',
                'vendredi': 'friday',
                'samedi': 'saturday',
                'dimanche': 'sunday'
            };

            const convertedSchedule: { [key: string]: any } = {};
            for (const [frenchKey, value] of Object.entries(finalSchedule)) {
                const englishKey = dayMapping[frenchKey.toLowerCase()] || frenchKey;
                convertedSchedule[englishKey] = value;
            }
            finalSchedule = convertedSchedule;

            // ✅ CORRIGÉ: Toujours envoyer preparation_time_minutes (même si 0, car backend le requiert pour is_complete)
            const payload = {
                service_id: serviceId,
                product_index: isTransversalMode ? 0 : productIndex, // En mode transversal, sera remplacé dans la boucle
                // ✅ Utiliser la première adresse valide comme adresse principale (compatibilité backend)
                pickup_address: primaryAddress.address.trim(),
                pickup_latitude: primaryAddress.latitude,
                pickup_longitude: primaryAddress.longitude,
                // ✅ SOLUTION OPTIMALE: Envoyer le slug au lieu de l'ID calculé pour éviter les problèmes de clé étrangère
                // Le backend convertira le slug en ID réel depuis la base de données
                required_vehicle_type_id: vehicleTypeId, // Garder pour compatibilité
                vehicle_type_slug: vehicleTypeId > 0 ? getVehicleTypeFromId(vehicleTypeId) || undefined : undefined, // ✅ NOUVEAU: Envoyer le slug
                preparation_time_minutes: preparationTime, // ✅ CORRIGÉ: Toujours envoyer (même si 0)
                weight_kg: (config && typeof config.weight_kg === 'string' && config.weight_kg.trim()) ? parseFloat(config.weight_kg) : undefined,
                volume_cm3: (config && typeof config.volume_cm3 === 'string' && config.volume_cm3.trim()) ? parseFloat(config.volume_cm3) : undefined,
                requires_isothermal: config && typeof config.requires_isothermal === 'boolean' ? config.requires_isothermal : false,
                requires_fragile_handling: config && typeof config.requires_fragile_handling === 'boolean' ? config.requires_fragile_handling : false,
                pickup_availability_schedule: finalSchedule, // ✅ CORRIGÉ: Utiliser l'objet validé
                pickup_instructions: (config && typeof config.pickup_instructions === 'string' && config.pickup_instructions.trim()) ? config.pickup_instructions : undefined,
                billing_mode: typeof config.billing_mode === 'string' ? config.billing_mode : 'standard',
                billing_partner_label: (typeof config.billing_partner_label === 'string' && config.billing_partner_label.trim()) ? config.billing_partner_label : undefined,
                storage_location_id: config && typeof config.storage_location_id === 'number' ? config.storage_location_id : null // ✅ NOUVEAU: Lieu de stockage GPS
            };

            // ✅ DEBUG: Logger le payload pour diagnostiquer les erreurs
            console.log('[ProductDeliveryConfigModal] Payload de sauvegarde:', {
                ...payload,
                pickup_address_length: payload.pickup_address.length,
                has_valid_coords: payload.pickup_latitude !== 0 && payload.pickup_longitude !== 0,
                preparation_time: payload.preparation_time_minutes,
            });

            if (isTransversalMode && normalizedAllProducts.length > 0) {
                let successCount = 0;
                let errorCount = 0;

                for (const product of normalizedAllProducts) {
                    try {
                        const response = await apiPost('/api/delivery/product-config', {
                            ...payload,
                            product_index: product.index
                        });
                        if (response.success) {
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (error) {
                        console.error(`Erreur pour produit ${product.index}:`, error);
                        errorCount++;
                    }
                }

                if (errorCount === 0) {
                    Alert.alert('Succès', `Configuration appliquée à ${successCount} produit(s) avec succès`);
                    onSuccess?.();
                    onClose();
                } else {
                    Alert.alert('Partiellement réussi', `${successCount} produit(s) configuré(s), ${errorCount} erreur(s)`);
                }
            } else {
                // ✅ LOGS DÉTAILLÉS: Capturer toutes les informations pour diagnostic
                console.log('[SAUVEGARDE_CONFIG_LIVRAISON] 🚀 === DÉBUT sauvegarde configuration ===');
                console.log('[SAUVEGARDE_CONFIG_LIVRAISON] 📊 Payload complet:', JSON.stringify(payload, null, 2));
                console.log('[SAUVEGARDE_CONFIG_LIVRAISON] 📋 Détails payload:', {
                    service_id: payload.service_id,
                    product_index: payload.product_index,
                    pickup_address: payload.pickup_address?.substring(0, 50) + '...',
                    pickup_latitude: payload.pickup_latitude,
                    pickup_longitude: payload.pickup_longitude,
                    required_vehicle_type_id: payload.required_vehicle_type_id,
                    preparation_time_minutes: payload.preparation_time_minutes,
                    has_schedule: !!payload.pickup_availability_schedule && Object.keys(payload.pickup_availability_schedule).length > 0,
                    schedule_keys: payload.pickup_availability_schedule ? Object.keys(payload.pickup_availability_schedule) : [],
                    weight_kg: payload.weight_kg,
                    volume_cm3: payload.volume_cm3,
                    billing_mode: payload.billing_mode,
                });

                // ✅ NOUVEAU: Retry logic avec délai progressif pour gérer le cas où le produit n'est pas encore synchronisé
                let retryCount = 0;
                const maxRetries = 3;
                const retryDelays = [500, 1000, 2000]; // Délais en ms: 500ms, 1s, 2s
                let lastError: any = null;
                let lastResponse: any = null;

                while (retryCount <= maxRetries) {
                    try {
                        console.log(`[SAUVEGARDE_CONFIG_LIVRAISON] 🔄 Tentative ${retryCount + 1}/${maxRetries + 1}...`);
                        const response = await apiPost('/api/delivery/product-config', payload);
                        lastResponse = response;

                        console.log(`[SAUVEGARDE_CONFIG_LIVRAISON] 📡 Réponse reçue (tentative ${retryCount + 1}):`, {
                            success: response.success,
                            message: response.message,
                            error: response.error,
                            data: response.data,
                        });

                        if (response.success) {
                            console.log('[SAUVEGARDE_CONFIG_LIVRAISON] ✅ === SUCCÈS sauvegarde ===');
                            Alert.alert('Succès', 'Configuration de livraison sauvegardée avec succès');
                            onSuccess?.();
                            onClose();
                            return; // Sortir de la fonction si succès
                        } else {
                            // ✅ LOGS DÉTAILLÉS: Capturer l'erreur du backend
                            const errorMsg = response.message || response.error || '';
                            console.error(`[SAUVEGARDE_CONFIG_LIVRAISON] ❌ Erreur backend (tentative ${retryCount + 1}):`, {
                                message: response.message,
                                error: response.error,
                                data: response.data,
                                fullResponse: JSON.stringify(response, null, 2),
                            });

                            // Si l'erreur indique que le produit n'existe pas, retry
                            if (errorMsg.includes('non trouvé') || errorMsg.includes('not found') || errorMsg.includes('Produit') || errorMsg.includes('synchronisé')) {
                                if (retryCount < maxRetries) {
                                    const delay = retryDelays[retryCount] || 2000;
                                    console.log(`[SAUVEGARDE_CONFIG_LIVRAISON] ⏳ Produit non trouvé, retry ${retryCount + 1}/${maxRetries} dans ${delay}ms...`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                    retryCount++;
                                    continue;
                                }
                            }
                            // Autre erreur, afficher directement avec détails
                            console.error('[SAUVEGARDE_CONFIG_LIVRAISON] ❌ === ERREUR FINALE ===', {
                                errorMessage: errorMsg,
                                fullResponse: JSON.stringify(response, null, 2),
                                payload: JSON.stringify(payload, null, 2),
                            });
                            Alert.alert('Erreur', errorMsg || 'Erreur lors de la sauvegarde');
                            return;
                        }
                    } catch (error: any) {
                        lastError = error;
                        const errorMsg = error?.message || error?.error || error?.response?.data?.message || '';

                        console.error(`[SAUVEGARDE_CONFIG_LIVRAISON] ❌ Exception (tentative ${retryCount + 1}):`, {
                            message: error?.message,
                            error: error?.error,
                            responseData: error?.response?.data,
                            stack: error?.stack,
                            fullError: JSON.stringify(error, null, 2),
                        });

                        // Si l'erreur indique que le produit n'existe pas, retry
                        if (errorMsg.includes('non trouvé') || errorMsg.includes('not found') || errorMsg.includes('Produit') || errorMsg.includes('synchronisé')) {
                            if (retryCount < maxRetries) {
                                const delay = retryDelays[retryCount] || 2000;
                                console.log(`[SAUVEGARDE_CONFIG_LIVRAISON] ⏳ Produit non trouvé (exception), retry ${retryCount + 1}/${maxRetries} dans ${delay}ms...`);
                                await new Promise(resolve => setTimeout(resolve, delay));
                                retryCount++;
                                continue;
                            }
                        }
                        // Autre erreur ou max retries atteint, sortir de la boucle
                        break;
                    }
                }

                // Si on arrive ici, toutes les tentatives ont échoué
                console.error('[SAUVEGARDE_CONFIG_LIVRAISON] ❌ === ÉCHEC APRÈS TOUTES LES TENTATIVES ===');
                console.error('[SAUVEGARDE_CONFIG_LIVRAISON] ❌ Dernière erreur:', {
                    error: lastError,
                    response: lastResponse,
                    payload: JSON.stringify(payload, null, 2),
                });

                const errorMessage = lastError?.message || lastError?.error || lastResponse?.message || lastResponse?.error || lastError?.response?.data?.message || 'Erreur lors de la sauvegarde de la configuration. Le produit peut ne pas être encore synchronisé. Veuillez réessayer dans quelques instants.';
                console.error('[SAUVEGARDE_CONFIG_LIVRAISON] ❌ Message d\'erreur final:', errorMessage);
                Alert.alert('Erreur', errorMessage);
            }
        } catch (error: any) {
            console.error('[SAUVEGARDE_CONFIG_LIVRAISON] ❌ === ERREUR CRITIQUE DANS CATCH FINAL ===');
            console.error('[SAUVEGARDE_CONFIG_LIVRAISON] ❌ Erreur complète:', {
                message: error?.message,
                error: error?.error,
                name: error?.name,
                stack: error?.stack,
                response: error?.response,
                responseData: error?.response?.data,
                responseStatus: error?.response?.status,
                responseStatusText: error?.response?.statusText,
                fullError: JSON.stringify(error, null, 2),
            });

            // ✅ AMÉLIORÉ: Afficher le message d'erreur détaillé du backend
            const errorMessage = error?.message || error?.error || error?.response?.data?.message || error?.response?.data?.error || 'Erreur lors de la sauvegarde de la configuration';
            console.error('[SAUVEGARDE_CONFIG_LIVRAISON] ❌ Message d\'erreur final:', errorMessage);
            Alert.alert('Erreur', errorMessage);
        } finally {
            setLoading(false);
            console.log('[SAUVEGARDE_CONFIG_LIVRAISON] ✅ === FIN handleSave (loading désactivé) ===');
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
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {isTransversalMode
                            ? `Livraison - Tous (${normalizedAllProducts.length})`
                            : `Livraison - ${normalizedProductName}`
                        }
                    </Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Avertissement mode transversal */}
                    {isTransversalMode && (
                        <View style={styles.warningBox}>
                            <Text style={styles.warningText}>
                                ⚠️ Cette configuration sera appliquée à tous vos produits (sauf prestations). Les configurations existantes seront remplacées.
                            </Text>
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Bannière info quand le formulaire est pré-rempli depuis un autre produit */}
                    {prefilledFromProduct && (
                        <View style={styles.prefillBanner}>
                            <SafeIcon name="info" size={18} color="#0369A1" type="lucide" />
                            <Text style={styles.prefillBannerText}>
                                Configuration pré-remplie depuis "{prefilledFromProduct}". Vérifiez et modifiez si nécessaire avant d'enregistrer.
                            </Text>
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Option de réutilisation de configuration */}
                    {!isTransversalMode && availableProducts.length > 0 && !prefilledFromProduct && (
                        <View style={styles.section}>
                            <View style={styles.reuseSection}>
                                <View style={styles.reuseHeader}>
                                    <Text style={styles.label}>Utiliser la configuration d'un autre produit ?</Text>
                                    <TouchableOpacity
                                        onPress={() => setUseExistingConfig(!useExistingConfig)}
                                        style={styles.switchContainer}
                                    >
                                        <View style={[styles.switch, useExistingConfig && styles.switchActive]}>
                                            <View style={[styles.switchThumb, useExistingConfig && styles.switchThumbActive]} />
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                {useExistingConfig && (
                                    <View style={styles.selectContainer}>
                                        <Text style={styles.hint}>Sélectionnez un produit pour copier sa configuration :</Text>
                                        <TouchableOpacity
                                            style={styles.select}
                                            onPress={() => {
                                                const options: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }> = availableProducts.map(p => ({
                                                    text: `${p.name} ${p.is_configured ? '✓' : ''}`,
                                                    onPress: () => setSelectedProductIndex(p.index)
                                                }));
                                                options.push({ text: 'Annuler', style: 'cancel' });
                                                Alert.alert('Sélectionner un produit', '', options);
                                            }}
                                        >
                                            <Text style={[styles.selectText, !selectedProductIndex && styles.selectPlaceholder]}>
                                                {selectedProductIndex !== null
                                                    ? availableProducts.find(p => p.index === selectedProductIndex)?.name || 'Sélectionner...'
                                                    : 'Sélectionner un produit...'}
                                            </Text>
                                            <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                                        </TouchableOpacity>
                                        {loadingProducts && (
                                            <Text style={styles.hint}>Chargement des produits...</Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Adresses de récupération du produit (au moins une obligatoire) */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.label}>Adresses de récupération du produit *</Text>
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={handleAddPickupAddress}
                            >
                                <SafeIcon name="plus" size={20} color={modernColors.primary} />
                                <Text style={styles.addButtonText}>Ajouter</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.hint}>
                            Au moins une adresse est obligatoire. Lieux où le coursier peut récupérer le produit.
                        </Text>

                        {pickupAddresses.map((pickupAddr, index) => (
                            <View key={pickupAddr.id} style={styles.pickupAddressItem}>
                                <View style={styles.pickupAddressHeader}>
                                    <Text style={styles.pickupAddressLabel}>
                                        Adresse {index + 1}{index === 0 ? ' (principale)' : ''}
                                    </Text>
                                    {pickupAddresses.length > 1 && (
                                        <TouchableOpacity
                                            style={styles.removeButton}
                                            onPress={() => handleRemovePickupAddress(pickupAddr.id)}
                                        >
                                            <SafeIcon name="x" size={18} color={modernColors.danger || '#EF4444'} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={[styles.select, !pickupAddr.address && styles.selectPlaceholder]}
                                    onPress={() => {
                                        // ✅ CORRIGÉ: Pas besoin de setSelectedLocation, le modal utilise directement currentLocation
                                        setGpsModalForIndex(index);
                                        setShowGPSModal(true);
                                    }}
                                >
                                    <Text style={[styles.selectText, !pickupAddr.address && styles.selectPlaceholderText]}>
                                        {pickupAddr.address || 'Cliquez pour sélectionner le lieu de récupération GPS...'}
                                    </Text>
                                    <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                                </TouchableOpacity>
                                {/* ✅ CORRIGÉ: Afficher l'adresse textuelle si disponible */}
                                {pickupAddr.address && (
                                    <Text style={styles.addressText}>
                                        📍 {pickupAddr.address}
                                    </Text>
                                )}
                                {/* Afficher les coordonnées GPS seulement si disponibles et si l'adresse textuelle ne les contient pas */}
                                {pickupAddr.latitude !== 0 && pickupAddr.longitude !== 0 &&
                                    !pickupAddr.address.includes(pickupAddr.latitude.toFixed(2)) && (
                                        <Text style={styles.gpsText}>
                                            Coordonnées: {pickupAddr.latitude.toFixed(6)}, {pickupAddr.longitude.toFixed(6)}
                                        </Text>
                                    )}
                            </View>
                        ))}
                    </View>

                    {/* ✅ Lieu de stockage GPS (cohérent avec GlobalDeliveryConfigModal) */}
                    {Array.isArray(storageLocations) && storageLocations.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.label}>📍 Lieu de stockage GPS</Text>
                            <Text style={styles.hint}>
                                Sélectionnez le lieu de stockage principal pour ce produit. Ce lieu sera utilisé pour le calcul automatique des frais de livraison.
                            </Text>
                            <TouchableOpacity
                                style={styles.select}
                                onPress={() => {
                                    Alert.alert(
                                        'Lieu de stock',
                                        'Sélectionnez un lieu de stock (optionnel)',
                                        [
                                            {
                                                text: 'Aucun (saisie manuelle)',
                                                onPress: () => setConfig(prev => ({ ...prev, storage_location_id: null }))
                                            },
                                            ...storageLocations.map(loc => ({
                                                text: `${loc.name} - ${loc.address}`,
                                                onPress: () => {
                                                    setConfig(prev => ({
                                                        ...prev,
                                                        storage_location_id: loc.id,
                                                    }));
                                                }
                                            })),
                                            { text: 'Annuler', style: 'cancel' as const }
                                        ]
                                    );
                                }}
                            >
                                <Text style={styles.selectText}>
                                    {config.storage_location_id
                                        ? (storageLocations.find(loc => loc.id === config.storage_location_id)?.name || 'Lieu sélectionné')
                                        : 'Sélectionner un lieu de stock (optionnel)'}
                                </Text>
                                <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ✅ CORRIGÉ 2026-01-02: Type de véhicule avec modal personnalisé (toutes les options) */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Type de véhicule requis *</Text>
                        <TouchableOpacity
                            style={styles.select}
                            onPress={() => setShowVehicleModal(true)}
                        >
                            <Text style={[styles.selectText, !config.required_vehicle_type_id && styles.selectPlaceholder]}>
                                {(() => {
                                    if (!config.required_vehicle_type_id) {
                                        return 'Sélectionner...';
                                    }
                                    // Convertir l'ID en VehicleType
                                    const vehicleType = getVehicleTypeFromId(config.required_vehicle_type_id);
                                    if (vehicleType) {
                                        const vehicle = VEHICLE_TRANSPORT_OPTIONS.find(v => v.value === vehicleType);
                                        if (vehicle) {
                                            return `${vehicle.icon} ${vehicle.label}`;
                                        }
                                    }
                                    return 'Sélectionner...';
                                })()}
                            </Text>
                            <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* ✅ NOUVEAU: Temps de préparation */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Temps de préparation (minutes) *</Text>
                        <Text style={styles.hint}>
                            Temps nécessaire pour préparer le produit avant la collecte. 0 = instantané (ex: produits en stock). Exemples: repas (15-30 min), commandes sur mesure (60-120 min).
                        </Text>
                        <TextInput
                            style={styles.input}
                            value={config.preparation_time_minutes}
                            onChangeText={(text) => setConfig(prev => ({ ...prev, preparation_time_minutes: text.replace(/[^0-9]/g, '') }))}
                            placeholder="0"
                            keyboardType="numeric"
                        />
                    </View>

                    {/* Poids et volume */}
                    <View style={styles.row}>
                        <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Poids (kg)</Text>
                            <TextInput
                                style={styles.input}
                                value={config.weight_kg}
                                onChangeText={(text) => setConfig(prev => ({ ...prev, weight_kg: text }))}
                                placeholder="Optionnel"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Volume (cm³)</Text>
                            <TextInput
                                style={styles.input}
                                value={config.volume_cm3}
                                onChangeText={(text) => setConfig(prev => ({ ...prev, volume_cm3: text }))}
                                placeholder="Optionnel"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    {/* ✅ AMÉLIORÉ: Options spéciales avec meilleur visuel */}
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={[styles.checkboxCard, config.requires_isothermal && styles.checkboxCardActive]}
                            onPress={() => setConfig(prev => ({ ...prev, requires_isothermal: !prev.requires_isothermal }))}
                        >
                            <View style={styles.checkboxContent}>
                                <View style={[styles.checkboxIconContainer, config.requires_isothermal && styles.checkboxIconContainerActive]}>
                                    {config.requires_isothermal ? (
                                        <SafeIcon name="check" size={18} color="#FFFFFF" />
                                    ) : (
                                        <View style={styles.checkboxEmpty} />
                                    )}
                                </View>
                                <View style={styles.checkboxTextContainer}>
                                    <Text style={[styles.checkboxLabel, config.requires_isothermal && styles.checkboxLabelActive]}>
                                        ❄️ Isotherme requis
                                    </Text>
                                    <Text style={styles.checkboxDescription}>
                                        Produit nécessitant une température contrôlée
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.checkboxCard, config.requires_fragile_handling && styles.checkboxCardActive]}
                            onPress={() => setConfig(prev => ({ ...prev, requires_fragile_handling: !prev.requires_fragile_handling }))}
                        >
                            <View style={styles.checkboxContent}>
                                <View style={[styles.checkboxIconContainer, config.requires_fragile_handling && styles.checkboxIconContainerActive]}>
                                    {config.requires_fragile_handling ? (
                                        <SafeIcon name="check" size={18} color="#FFFFFF" />
                                    ) : (
                                        <View style={styles.checkboxEmpty} />
                                    )}
                                </View>
                                <View style={styles.checkboxTextContainer}>
                                    <Text style={[styles.checkboxLabel, config.requires_fragile_handling && styles.checkboxLabelActive]}>
                                        🫳 Manipulation fragile
                                    </Text>
                                    <Text style={styles.checkboxDescription}>
                                        Produit nécessitant une manipulation délicate
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Plages horaires */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Plages horaires de départ *</Text>
                        <Text style={styles.hint}>
                            Configurez les horaires de récupération pour chaque jour de la semaine
                        </Text>
                        <TimeSlotPicker
                            value={config.pickup_availability_schedule}
                            onChange={(jsonString) => setConfig(prev => ({ ...prev, pickup_availability_schedule: jsonString }))}
                        />
                    </View>

                    {/* Instructions */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Instructions de départ</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={config.pickup_instructions}
                            onChangeText={(text) => setConfig(prev => ({ ...prev, pickup_instructions: text }))}
                            placeholder="Instructions spéciales pour le coursier"
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Mode de facturation */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Mode de facturation</Text>
                        <TouchableOpacity
                            style={styles.select}
                            onPress={() => {
                                Alert.alert(
                                    'Mode de facturation',
                                    '',
                                    [
                                        { text: 'Standard', onPress: () => setConfig(prev => ({ ...prev, billing_mode: 'standard' })) },
                                        { text: 'Partenaire', onPress: () => setConfig(prev => ({ ...prev, billing_mode: 'partner' })) },
                                        { text: 'Annuler', style: 'cancel' as const }
                                    ]
                                );
                            }}
                        >
                            <Text style={styles.selectText}>
                                {config.billing_mode === 'partner' ? 'Partenaire' : 'Standard'}
                            </Text>
                            <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {config.billing_mode === 'partner' && (
                        <View style={styles.section}>
                            <Text style={styles.label}>Label partenaire</Text>
                            <TextInput
                                style={styles.input}
                                value={config.billing_partner_label}
                                onChangeText={(text) => setConfig(prev => ({ ...prev, billing_partner_label: text }))}
                                placeholder="Nom du partenaire"
                            />
                        </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                        <NativeButton
                            title="Annuler"
                            variant="secondary"
                            onPress={onClose}
                            style={styles.actionButton}
                        />
                        <NativeButton
                            title={loading
                                ? (isTransversalMode ? 'Application...' : 'Enregistrement...')
                                : (isTransversalMode ? `Appliquer à ${normalizedAllProducts.length} produit(s)` : 'Enregistrer')
                            }
                            variant="primary"
                            onPress={handleSave}
                            disabled={loading}
                            style={styles.actionButton}
                        />
                    </View>
                </ScrollView>
            </View>

            {/* ✅ NOUVEAU: Modal GPS pour sélection précise des adresses de récupération */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => {
                    setShowGPSModal(false);
                    setGpsModalForIndex(null);
                }}
                onSelect={async (coordinatesString) => {
                    // Parser les coordonnées depuis le format string "lat,lng"
                    const firstPoint = coordinatesString.split('|')[0].split(',');
                    if (firstPoint.length === 2) {
                        const lat = parseFloat(firstPoint[0]);
                        const lng = parseFloat(firstPoint[1]);

                        if (!isNaN(lat) && !isNaN(lng)) {
                            const index = gpsModalForIndex ?? 0;

                            // ✅ CORRIGÉ 2026-01-12: Utiliser reverseGeocodeWithRetry avec retry et fallback
                            try {
                                const { reverseGeocodeWithRetry } = await import('../../utils/reverseGeocoding');
                                const geocodeResult = await reverseGeocodeWithRetry(lat, lng, {
                                    fallbackAddress: coordinatesString
                                });

                                if (geocodeResult) {
                                    const fullAddress = geocodeResult.address;
                                    const placeName = geocodeResult.name || geocodeResult.street || geocodeResult.district || geocodeResult.city || 'Lieu sélectionné';

                                    // Construire un LocationObject avec le nom complet
                                    const locationObj: LocationObject = {
                                        raw: fullAddress,
                                        place_name: placeName, // Nom principal du lieu (établissement, rue, quartier)
                                        components: {
                                            quartier: geocodeResult.district || undefined,
                                            ville: geocodeResult.city || undefined,
                                            region: geocodeResult.region || undefined,
                                            pays: geocodeResult.country || undefined,
                                        },
                                        coordinates: { lat, lng },
                                    };

                                    // Trouver l'adresse à mettre à jour
                                    const currentAddr = pickupAddresses[index];
                                    if (currentAddr) {
                                        handleUpdatePickupAddress(currentAddr.id, {
                                            address: fullAddress,
                                            location: locationObj,
                                            latitude: lat,
                                            longitude: lng,
                                        });
                                    }
                                } else {
                                    // Fallback si pas de géocodage inverse
                                    const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                                    const locationObj: LocationObject = {
                                        raw: address,
                                        place_name: 'Lieu sélectionné',
                                        components: {},
                                        coordinates: { lat, lng }
                                    };

                                    const currentAddr = pickupAddresses[index];
                                    if (currentAddr) {
                                        handleUpdatePickupAddress(currentAddr.id, {
                                            address: address,
                                            location: locationObj,
                                            latitude: lat,
                                            longitude: lng,
                                        });
                                    }
                                }
                            } catch (error) {
                                console.error('[ProductDeliveryConfigModal] Erreur géocodage inverse:', error);
                                // Fallback en cas d'erreur
                                const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                                const locationObj: LocationObject = {
                                    raw: address,
                                    place_name: 'Lieu sélectionné',
                                    components: {},
                                    coordinates: { lat, lng }
                                };

                                const currentAddr = pickupAddresses[index];
                                if (currentAddr) {
                                    handleUpdatePickupAddress(currentAddr.id, {
                                        address: address,
                                        location: locationObj,
                                        latitude: lat,
                                        longitude: lng,
                                    });
                                }
                            }

                            setShowGPSModal(false);
                            setGpsModalForIndex(null);
                        }
                    }
                }}
                currentLocation={
                    gpsModalForIndex !== null && pickupAddresses[gpsModalForIndex]?.location?.coordinates
                        ? {
                            lat: pickupAddresses[gpsModalForIndex].location.coordinates.lat,
                            lng: pickupAddresses[gpsModalForIndex].location.coordinates.lng
                        }
                        : gpsModalForIndex !== null && pickupAddresses[gpsModalForIndex]?.latitude !== 0 && pickupAddresses[gpsModalForIndex]?.longitude !== 0
                            ? {
                                lat: pickupAddresses[gpsModalForIndex].latitude,
                                lng: pickupAddresses[gpsModalForIndex].longitude
                            }
                            : null
                }
                title="Sélectionner le lieu de récupération du produit"
                allowZoneSelection={false}
            />

            {/* ✅ NOUVEAU 2026-01-02: Modal personnalisé pour sélection du type de véhicule (toutes les options) */}
            <Modal
                visible={showVehicleModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowVehicleModal(false)}
            >
                <View style={styles.vehicleModalOverlay}>
                    <View style={styles.vehicleModalContent}>
                        <View style={styles.vehicleModalHeader}>
                            <Text style={styles.vehicleModalTitle}>Sélectionner un type de véhicule</Text>
                            <TouchableOpacity
                                onPress={() => setShowVehicleModal(false)}
                                style={styles.vehicleModalCloseButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.vehicleModalList} showsVerticalScrollIndicator={true}>
                            {VEHICLE_TRANSPORT_OPTIONS.map((vehicle) => {
                                const vehicleId = getVehicleTypeId(vehicle.value);
                                const isSelected = config.required_vehicle_type_id === vehicleId;
                                return (
                                    <TouchableOpacity
                                        key={vehicle.value}
                                        style={[
                                            styles.vehicleOption,
                                            isSelected && styles.vehicleOptionSelected
                                        ]}
                                        onPress={() => {
                                            setConfig(prev => ({ ...prev, required_vehicle_type_id: vehicleId }));
                                            setShowVehicleModal(false);
                                        }}
                                    >
                                        <Text style={styles.vehicleOptionIcon}>{vehicle.icon}</Text>
                                        <Text style={[
                                            styles.vehicleOptionLabel,
                                            isSelected && styles.vehicleOptionLabelSelected
                                        ]}>
                                            {vehicle.label}
                                        </Text>
                                        {isSelected && (
                                            <SafeIcon name="check" size={20} color={modernColors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    warningBox: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FCD34D',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    warningText: {
        fontSize: 12,
        color: '#92400E',
    },
    prefillBanner: {
        backgroundColor: '#E0F2FE',
        borderColor: '#7DD3FC',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    prefillBannerText: {
        fontSize: 13,
        color: '#0369A1',
        flex: 1,
        lineHeight: 18,
    },
    section: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    hint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: '#FFFFFF',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    select: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#FFFFFF',
    },
    selectText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    selectPlaceholder: {
        borderColor: '#E5E7EB',
    },
    selectPlaceholderText: {
        color: modernColors.textSecondary,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    checkboxCard: {
        borderWidth: 2,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    checkboxCardActive: {
        borderColor: modernColors.primary,
        backgroundColor: '#F0F9FF',
    },
    checkboxContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    checkboxIconContainerActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    checkboxEmpty: {
        width: 12,
        height: 12,
        borderRadius: 3,
        backgroundColor: 'transparent',
    },
    checkboxTextContainer: {
        flex: 1,
    },
    checkboxLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    checkboxLabelActive: {
        color: modernColors.primary,
    },
    checkboxDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    addressText: {
        fontSize: 13,
        color: modernColors.text,
        marginTop: 8,
        padding: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
    },
    gpsText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
        marginBottom: 32,
    },
    actionButton: {
        flex: 1,
    },
    // ✅ NOUVEAU 2026-01-02: Styles pour le modal de sélection de véhicule
    vehicleModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    vehicleModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        paddingBottom: 32,
    },
    vehicleModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    vehicleModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    vehicleModalCloseButton: {
        padding: 8,
    },
    vehicleModalList: {
        maxHeight: 400,
    },
    vehicleOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    vehicleOptionSelected: {
        backgroundColor: '#F0F9FF',
    },
    vehicleOptionIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    vehicleOptionLabel: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
    },
    vehicleOptionLabelSelected: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    // ✅ Styles pour les adresses de récupération
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F0F9FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        marginLeft: 4,
    },
    pickupAddressItem: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    pickupAddressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    pickupAddressLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    removeButton: {
        padding: 4,
    },
    // ✅ Styles pour la section de réutilisation de configuration
    reuseSection: {
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    reuseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchContainer: {
        paddingLeft: 12,
    },
    switch: {
        width: 48,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#D1D5DB',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    switchActive: {
        backgroundColor: '#10B981',
    },
    switchThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    switchThumbActive: {
        alignSelf: 'flex-end',
    },
    selectContainer: {
        marginTop: 12,
    },
});

export default ProductDeliveryConfigModal;
