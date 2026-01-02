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
import { apiGet, apiPost, deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';
import LocationSelector, { LocationObject } from '../LocationSelector';
import ModernGPSModal from '../ModernGPSModal';
import TimeSlotPicker from './TimeSlotPicker';
import { VEHICLE_TRANSPORT_OPTIONS, type VehicleType } from '../../config/deliveryConfig';

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
    
    // ✅ NOUVEAU: Options de réutilisation de configuration
    const [useExistingConfig, setUseExistingConfig] = useState(false);
    const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
    const [availableProducts, setAvailableProducts] = useState<Array<{index: number, name: string, is_configured: boolean}>>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    // ✅ Phase 9 - Amélioration 32 : Gestion des lieux de stock
    const [storageLocations, setStorageLocations] = useState<Array<{
        id: number;
        name: string;
        address: string;
        latitude: number;
        longitude: number;
        is_active: boolean;
    }>>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    // ✅ NOUVEAU: État pour le modal GPS
    const [showGPSModal, setShowGPSModal] = useState(false);
    // ✅ NOUVEAU 2026-01-02: État pour le modal de sélection de véhicule
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    // ✅ NOUVEAU 2026-01-02: État pour stocker l'adresse du lieu de stock (indépendamment de storage_location_id)
    const [storageLocationAddress, setStorageLocationAddress] = useState('');
    const [config, setConfig] = useState({
        pickup_address: '',
        pickup_location: null as LocationObject | null, // ✅ NOUVEAU: Objet location complet
        pickup_latitude: 0,
        pickup_longitude: 0,
        storage_location_id: undefined as number | undefined, // ✅ Phase 9 - Amélioration 32
        required_vehicle_type_id: 0,
        preparation_time_minutes: '', // ✅ NOUVEAU: Temps de préparation en minutes
        weight_kg: '',
        volume_cm3: '',
        requires_isothermal: false,
        requires_fragile_handling: false,
        pickup_availability_schedule: '{}',
        pickup_instructions: '',
        billing_mode: 'standard',
        billing_partner_label: ''
    });

    useEffect(() => {
        if (visible) {
            loadParcelTypes();
            loadStorageLocations(); // ✅ Phase 9 - Amélioration 32
            if (!isTransversalMode) {
                loadExistingConfig();
            }
        }
    }, [visible, serviceId, productIndex]);

    // ✅ Phase 9 - Amélioration 32 : Charger les lieux de stock
    const loadStorageLocations = async () => {
        setLoadingLocations(true);
        try {
            const response = await deliveryApi.listStorageLocations();
            if (response.success && response.data && typeof response.data === 'object' && 'locations' in response.data) {
                const data = response.data as any;
                if (Array.isArray(data.locations)) {
                    setStorageLocations(data.locations);
                }
            }
        } catch (error) {
            console.error('Erreur chargement lieux de stock:', error);
        } finally {
            setLoadingLocations(false);
        }
    };

    // ✅ CORRIGÉ 2026-01-02: Mettre à jour l'adresse du lieu de stock quand storage_location_id change
    useEffect(() => {
        if (config.storage_location_id && storageLocations.length > 0) {
            const selectedLocation = storageLocations.find(loc => loc.id === config.storage_location_id);
            if (selectedLocation) {
                // ✅ Mettre à jour l'adresse affichée dans LocationSelector
                setStorageLocationAddress(selectedLocation.address || '');
            }
        } else if (!config.storage_location_id) {
            // Si pas de storage_location_id, garder l'adresse si elle a été saisie manuellement
            // (ne pas la vider si l'utilisateur a sélectionné un lieu qui n'est pas dans storageLocations)
        }
    }, [config.storage_location_id, storageLocations]);

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
                // ✅ CORRIGÉ: Construire LocationObject si on a une adresse
                const pickupAddr = (typeof c.pickup_address === 'string' ? c.pickup_address : '') || '';
                const pickupLat = (typeof c.pickup_latitude === 'number' ? c.pickup_latitude : 0) || 0;
                const pickupLng = (typeof c.pickup_longitude === 'number' ? c.pickup_longitude : 0) || 0;
                
                const pickupLocationObj: LocationObject | null = pickupAddr 
                    ? {
                        raw: pickupAddr,
                        place_name: pickupAddr.split(',')[0].trim(),
                        components: {},
                        coordinates: (pickupLat !== 0 && pickupLng !== 0) ? { lat: pickupLat, lng: pickupLng } : undefined
                    }
                    : null;
                
                const storageLocationId = (typeof c.storage_location_id === 'number' ? c.storage_location_id : undefined);
                
                // ✅ CORRIGÉ 2026-01-02: Récupérer l'adresse du lieu de stock si disponible
                // Attendre que storageLocations soit chargé (via useEffect)
                let storageAddr = '';
                if (storageLocationId && storageLocations.length > 0) {
                    const foundLocation = storageLocations.find(loc => loc.id === storageLocationId);
                    storageAddr = foundLocation?.address || '';
                }
                
                setStorageLocationAddress(storageAddr);
                
                setConfig({
                    pickup_address: pickupAddr,
                    pickup_location: pickupLocationObj,
                    pickup_latitude: pickupLat,
                    pickup_longitude: pickupLng,
                    storage_location_id: storageLocationId, // ✅ Phase 9 - Amélioration 32
                    required_vehicle_type_id: (typeof c.required_vehicle_type_id === 'number' ? c.required_vehicle_type_id : 0) || 0,
                    preparation_time_minutes: c.preparation_time_minutes ? String(c.preparation_time_minutes) : '0', // ✅ NOUVEAU
                    weight_kg: c.weight_kg ? String(c.weight_kg) : '',
                    volume_cm3: c.volume_cm3 ? String(c.volume_cm3) : '',
                    requires_isothermal: typeof c.requires_isothermal === 'boolean' ? c.requires_isothermal : false,
                    requires_fragile_handling: typeof c.requires_fragile_handling === 'boolean' ? c.requires_fragile_handling : false,
                    pickup_availability_schedule: JSON.stringify(c.pickup_availability_schedule || {}, null, 2),
                    pickup_instructions: (typeof c.pickup_instructions === 'string' ? c.pickup_instructions : '') || '',
                    billing_mode: (typeof c.billing_mode === 'string' ? c.billing_mode : 'standard') || 'standard',
                    billing_partner_label: (typeof c.billing_partner_label === 'string' ? c.billing_partner_label : '') || ''
                });
            }
        } catch (error) {
            console.error('Erreur chargement configuration:', error);
        }
    };

    const handleSave = async () => {
        // ✅ CORRIGÉ: Validation avec support LocationObject
        const pickupAddress = config?.pickup_location?.raw || (config && typeof config.pickup_address === 'string' ? config.pickup_address : '');
        if (!pickupAddress.trim()) {
            Alert.alert('Erreur', 'L\'adresse de départ est obligatoire');
            return;
        }
        const vehicleTypeId = typeof config.required_vehicle_type_id === 'number' ? config.required_vehicle_type_id : 0;
        if (!vehicleTypeId) {
            Alert.alert('Erreur', 'Le type de véhicule est obligatoire');
            return;
        }

        // ✅ NOUVEAU: Valider le temps de préparation
        const preparationTime = (config?.preparation_time_minutes && typeof config.preparation_time_minutes === 'string' && config.preparation_time_minutes.trim()) 
            ? parseInt(config.preparation_time_minutes.trim(), 10) 
            : 0;
        if (preparationTime < 0) {
            Alert.alert('Erreur', 'Le temps de préparation doit être positif ou nul (0 = instantané)');
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
            const payload = {
                service_id: typeof serviceId === 'number' ? serviceId : 0,
                product_index: typeof productIndex === 'number' ? productIndex : 0,
                // ✅ CORRIGÉ: Utiliser l'adresse depuis pickup_location si disponible
                pickup_address: config?.pickup_location?.raw || (config && typeof config.pickup_address === 'string' ? config.pickup_address : ''),
                pickup_latitude: config?.pickup_location?.coordinates?.lat || (config && typeof config.pickup_latitude === 'number' ? config.pickup_latitude : 0),
                pickup_longitude: config?.pickup_location?.coordinates?.lng || (config && typeof config.pickup_longitude === 'number' ? config.pickup_longitude : 0),
                storage_location_id: config && typeof config.storage_location_id === 'number' ? config.storage_location_id : null, // ✅ Phase 9 - Amélioration 32
                required_vehicle_type_id: config && typeof config.required_vehicle_type_id === 'number' ? config.required_vehicle_type_id : 0,
                preparation_time_minutes: preparationTime > 0 ? preparationTime : undefined, // ✅ NOUVEAU
                weight_kg: (config && typeof config.weight_kg === 'string' && config.weight_kg.trim()) ? parseFloat(config.weight_kg) : undefined,
                volume_cm3: (config && typeof config.volume_cm3 === 'string' && config.volume_cm3.trim()) ? parseFloat(config.volume_cm3) : undefined,
                requires_isothermal: config && typeof config.requires_isothermal === 'boolean' ? config.requires_isothermal : false,
                requires_fragile_handling: config && typeof config.requires_fragile_handling === 'boolean' ? config.requires_fragile_handling : false,
                pickup_availability_schedule: schedule,
                pickup_instructions: (config && typeof config.pickup_instructions === 'string' && config.pickup_instructions.trim()) ? config.pickup_instructions : undefined,
                billing_mode: typeof config.billing_mode === 'string' ? config.billing_mode : 'standard',
                billing_partner_label: (typeof config.billing_partner_label === 'string' && config.billing_partner_label.trim()) ? config.billing_partner_label : undefined
            };

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
                const response = await apiPost('/api/delivery/product-config', payload);
                if (response.success) {
                    Alert.alert('Succès', 'Configuration de livraison sauvegardée avec succès');
                    onSuccess?.();
                    onClose();
                } else {
                    Alert.alert('Erreur', response.message || 'Erreur lors de la sauvegarde');
                }
            }
        } catch (error: any) {
            console.error('Erreur sauvegarde:', error);
            Alert.alert('Erreur', 'Erreur lors de la sauvegarde de la configuration');
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

                    {/* ✅ NOUVEAU: Option de réutilisation de configuration */}
                    {!isTransversalMode && availableProducts.length > 0 && (
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

                    {/* ✅ CORRIGÉ 2026-01-02: Lieu de stock avec LocationSelector - Correction insertion adresse */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Lieu de stock (optionnel)</Text>
                        <LocationSelector
                            label=""
                            value={storageLocationAddress || (config.storage_location_id 
                                ? (storageLocations.find(loc => loc.id === config.storage_location_id)?.address || '')
                                : '')}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRIGÉ 2026-01-02: Extraire l'adresse formatée et les coordonnées
                                const address = location.raw || location.place_name || '';
                                const coords = location.coordinates;
                                
                                // ✅ CORRIGÉ 2026-01-02: Toujours mettre à jour l'adresse affichée
                                setStorageLocationAddress(address);
                                
                                // Si un lieu de stock existe avec cette adresse, l'utiliser
                                const existingLocation = storageLocations.find(loc => 
                                    loc.address === address || 
                                    (coords && Math.abs(loc.latitude - coords.lat) < 0.0001 && Math.abs(loc.longitude - coords.lng) < 0.0001)
                                );
                                
                                setConfig(prev => ({
                                    ...prev,
                                    storage_location_id: existingLocation?.id,
                                    // Ne pas mettre à jour pickup_address ici, c'est pour le lieu de stock
                                }));
                                
                                console.log('[ProductDeliveryConfigModal] ✅ Lieu de stock sélectionné:', {
                                    address,
                                    storage_location_id: existingLocation?.id,
                                    hasCoordinates: !!coords
                                });
                            }}
                            placeholder="Ville, quartier, pays..."
                            enrichWithBackend={true}
                            required={false}
                        />
                        {loadingLocations && (
                            <Text style={styles.hint}>Chargement des lieux de stock...</Text>
                        )}
                    </View>

                    {/* ✅ CORRIGÉ: Adresse de départ avec ModernGPSModal pour sélection GPS précise */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Adresse de départ *</Text>
                        <TouchableOpacity
                            style={styles.select}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <Text style={[styles.selectText, !config?.pickup_address && styles.selectPlaceholder]}>
                                {config?.pickup_address || 'Sélectionner la localisation GPS précise...'}
                            </Text>
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                        {((typeof config.pickup_latitude === 'number' && config.pickup_latitude !== 0) || (typeof config.pickup_longitude === 'number' && config.pickup_longitude !== 0)) && (
                            <Text style={styles.gpsText}>
                                📍 GPS: {typeof config.pickup_latitude === 'number' ? config.pickup_latitude.toFixed(6) : '0.000000'}, {typeof config.pickup_longitude === 'number' ? config.pickup_longitude.toFixed(6) : '0.000000'}
                            </Text>
                        )}
                    </View>

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

            {/* ✅ NOUVEAU: Modal GPS pour sélection précise de l'adresse de départ */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coordinatesString) => {
                    // Parser les coordonnées depuis le format string "lat,lng"
                    const firstPoint = coordinatesString.split('|')[0].split(',');
                    if (firstPoint.length === 2) {
                        const lat = parseFloat(firstPoint[0]);
                        const lng = parseFloat(firstPoint[1]);
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            // Construire un LocationObject avec les coordonnées
                            const locationObj: LocationObject = {
                                raw: `${lat}, ${lng}`,
                                place_name: `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                                components: {},
                                coordinates: { lat, lng }
                            };
                            
                            setConfig(prev => ({
                                ...prev,
                                pickup_address: locationObj.raw,
                                pickup_location: locationObj,
                                pickup_latitude: lat,
                                pickup_longitude: lng,
                            }));
                            
                            setShowGPSModal(false);
                        }
                    }
                }}
                currentLocation={
                    (config.pickup_latitude !== 0 && config.pickup_longitude !== 0)
                        ? { lat: config.pickup_latitude, lng: config.pickup_longitude }
                        : null
                }
                title="Sélectionner l'adresse de départ GPS"
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
    gpsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
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
});

export default ProductDeliveryConfigModal;
