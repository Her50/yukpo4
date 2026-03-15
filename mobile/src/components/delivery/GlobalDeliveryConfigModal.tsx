import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Location from 'expo-location';
import { apiGet, apiPost, deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton, NativeCard } from '../SafeNativeDesign';
import ModernGPSModal from '../ModernGPSModal';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Product {
    serviceId: number;
    productIndex: number;
    productName: string;
    serviceName: string;
}

interface GlobalDeliveryConfigModalProps {
    visible: boolean;
    onClose: () => void;
    selectedProducts: Product[]; // Liste des produits sélectionnés
    onSuccess?: () => void;
}

interface ParcelType {
    id: number;
    name: string;
    description?: string;
}

interface TimeSlot {
    start: string;
    end: string;
}

interface WeeklySchedule {
    lundi?: TimeSlot[];
    mardi?: TimeSlot[];
    mercredi?: TimeSlot[];
    jeudi?: TimeSlot[];
    vendredi?: TimeSlot[];
    samedi?: TimeSlot[];
    dimanche?: TimeSlot[];
}

const DAYS_OF_WEEK = [
    { key: 'lundi' as const, label: 'Lundi' },
    { key: 'mardi' as const, label: 'Mardi' },
    { key: 'mercredi' as const, label: 'Mercredi' },
    { key: 'jeudi' as const, label: 'Jeudi' },
    { key: 'vendredi' as const, label: 'Vendredi' },
    { key: 'samedi' as const, label: 'Samedi' },
    { key: 'dimanche' as const, label: 'Dimanche' },
];

const GlobalDeliveryConfigModal: React.FC<GlobalDeliveryConfigModalProps> = ({
    visible,
    onClose,
    selectedProducts,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);

    const { t } = useLanguageSafe();    const [parcelTypes, setParcelTypes] = useState<ParcelType[]>([]);
    const [storageLocations, setStorageLocations] = useState<Array<{
        id: number;
        name: string;
        address: string;
        latitude: number;
        longitude: number;
        is_active: boolean;
    }>>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [gpsField, setGpsField] = useState<'pickup' | null>(null);
    
    const [config, setConfig] = useState({
        pickup_address: '',
        pickup_latitude: 0,
        pickup_longitude: 0,
        storage_location_id: undefined as number | undefined,
        required_vehicle_type_id: 0,
        preparation_time_minutes: '', // ✅ NOUVEAU: Temps de préparation en minutes
        weight_kg: '',
        volume_cm3: '',
        requires_isothermal: false,
        requires_fragile_handling: false,
        pickup_availability_schedule: {} as WeeklySchedule,
        pickup_instructions: '',
        billing_mode: 'standard' as 'standard' | 'partner',
        billing_partner_label: ''
    });

    // ✅ CORRIGÉ: Ne pas utiliser le dernier produit, mais afficher tous les produits sélectionnés
    // ✅ AMÉLIORÉ: S'assurer que les produits sont toujours à jour et ne se figent pas
    const validProducts = React.useMemo(() => {
        if (!Array.isArray(selectedProducts)) return [];
        return selectedProducts.filter(p => 
            p && 
            p.serviceId && 
            typeof p.serviceId === 'number' && 
            typeof p.productIndex === 'number' &&
            p.productName // ✅ S'assurer que productName existe
        );
    }, [selectedProducts]);
    const validProductsCount = validProducts.length || 0;

    useEffect(() => {
        if (visible && validProductsCount > 0) {
            loadParcelTypes();
            loadStorageLocations();
        }
    }, [visible, validProductsCount]);

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

    // ✅ Mettre à jour les coordonnées quand un lieu de stock est sélectionné
    useEffect(() => {
        if (config.storage_location_id && storageLocations.length > 0) {
            const selectedLocation = storageLocations.find(loc => loc.id === config.storage_location_id);
            if (selectedLocation) {
                setConfig(prev => ({
                    ...prev,
                    pickup_address: selectedLocation.address,
                    pickup_latitude: selectedLocation.latitude,
                    pickup_longitude: selectedLocation.longitude,
                }));
            }
        }
    }, [config.storage_location_id, storageLocations]);

    const loadParcelTypes = async () => {
        try {
            const response = await apiGet('/api/delivery/parcel-types');
            if (response.success && response.data) {
                const data = response.data as any;
                const types = Array.isArray(data?.parcel_types)
                    ? data.parcel_types.filter((t: any) => t && t.id && t.name)
                    : [];
                setParcelTypes(types);
            }
        } catch (error) {
            console.error('Erreur chargement types de colis:', error);
        }
    };

    // ✅ NOUVEAU: Gérer la sélection GPS via ModernGPSModal avec géocodage inverse
    const handleGPSSelect = async (coordinates: string) => {
        if (!gpsField) return;
        
        const [lat, lng] = coordinates.split(',').map(Number.parseFloat);
        if (isNaN(lat) || isNaN(lng)) {
            setShowGPSModal(false);
            setGpsField(null);
            return;
        }

        // ✅ Géocodage inverse pour récupérer l'adresse automatiquement
        try {
            const reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (reverseGeocode && reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                const fullAddress = [
                    addr.streetNumber,
                    addr.street,
                    addr.district || addr.subregion,
                    addr.city,
                    addr.region
                ].filter(Boolean).join(', ').trim() || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

                setConfig(prev => ({
                    ...prev,
                    pickup_address: fullAddress,
                    pickup_latitude: lat,
                    pickup_longitude: lng,
                }));
            } else {
                setConfig(prev => ({
                    ...prev,
                    pickup_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                    pickup_latitude: lat,
                    pickup_longitude: lng,
                }));
            }
        } catch (error) {
            console.error('Erreur géocodage inverse:', error);
            // En cas d'erreur, utiliser les coordonnées comme adresse
            setConfig(prev => ({
                ...prev,
                pickup_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                pickup_latitude: lat,
                pickup_longitude: lng,
            }));
        }

        setShowGPSModal(false);
        setGpsField(null);
    };

    // ✅ NOUVEAU: Gérer les plages horaires avec interface utilisateur
    const toggleDaySchedule = (day: keyof WeeklySchedule) => {
        setConfig(prev => {
            const schedule = { ...prev.pickup_availability_schedule };
            if (schedule[day] && schedule[day]!.length > 0) {
                delete schedule[day];
            } else {
                schedule[day] = [{ start: '08:00', end: '18:00' }];
            }
            return { ...prev, pickup_availability_schedule: schedule };
        });
    };

    const updateTimeSlot = (day: keyof WeeklySchedule, slotIndex: number, field: 'start' | 'end', value: string) => {
        setConfig(prev => {
            const schedule = { ...prev.pickup_availability_schedule };
            if (!schedule[day]) return prev;
            const slots = [...(schedule[day] || [])];
            slots[slotIndex] = { ...slots[slotIndex], [field]: value };
            schedule[day] = slots;
            return { ...prev, pickup_availability_schedule: schedule };
        });
    };

    const addTimeSlot = (day: keyof WeeklySchedule) => {
        setConfig(prev => {
            const schedule = { ...prev.pickup_availability_schedule };
            if (!schedule[day]) schedule[day] = [];
            schedule[day]!.push({ start: '08:00', end: '18:00' });
            return { ...prev, pickup_availability_schedule: schedule };
        });
    };

    const removeTimeSlot = (day: keyof WeeklySchedule, slotIndex: number) => {
        setConfig(prev => {
            const schedule = { ...prev.pickup_availability_schedule };
            if (!schedule[day]) return prev;
            const slots = schedule[day]!.filter((_, i) => i !== slotIndex);
            if (slots.length === 0) {
                delete schedule[day];
            } else {
                schedule[day] = slots;
            }
            return { ...prev, pickup_availability_schedule: schedule };
        });
    };

    const handleSave = async () => {
        // Validation
        if (!config?.pickup_address || typeof config.pickup_address !== 'string' || !config.pickup_address.trim()) {
            Alert.alert('Erreur', 'Veuillez sélectionner ou saisir une adresse de départ');
            return;
        }

        if (!config.pickup_latitude || !config.pickup_longitude || config.pickup_latitude === 0 || config.pickup_longitude === 0) {
            Alert.alert('Erreur', 'Veuillez sélectionner une position GPS précise pour le matching avec les coursiers');
            return;
        }

        if (!config.required_vehicle_type_id || config.required_vehicle_type_id === 0) {
            Alert.alert('Erreur', 'Veuillez sélectionner un type de véhicule');
            return;
        }

        if (Object.keys(config.pickup_availability_schedule).length === 0) {
            Alert.alert('Erreur', 'Veuillez définir au moins une plage horaire de départ');
            return;
        }

        if (!config.preparation_time_minutes || isNaN(parseInt(config.preparation_time_minutes)) || parseInt(config.preparation_time_minutes) <= 0) {
            Alert.alert('Erreur', 'Veuillez saisir un temps de préparation valide (en minutes)');
            return;
        }

        if (validProductsCount === 0) {
            Alert.alert('Erreur', 'Aucun produit sélectionné');
            return;
        }

        setLoading(true);

        try {
            // Grouper les produits par serviceId pour optimiser les appels API
            const productsByService = validProducts.reduce((acc, product) => {
                if (!acc[product.serviceId]) {
                    acc[product.serviceId] = [];
                }
                acc[product.serviceId].push(product.productIndex);
                return acc;
            }, {} as Record<number, number[]>);

            const entries = Object.entries(productsByService).filter(([serviceIdStr, productIndices]) => {
                const serviceId = parseInt(serviceIdStr, 10);
                return !isNaN(serviceId) && Array.isArray(productIndices) && productIndices.length > 0;
            });

            const promises = entries.map(([serviceIdStr, productIndices]) => {
                const serviceId = parseInt(serviceIdStr, 10);

                return Promise.all((productIndices as number[]).filter(idx => typeof idx === 'number' && !isNaN(idx)).map(productIndex => {
                    return apiPost(`/api/delivery/product-config/${serviceId}/${productIndex}`, {
                        pickup_address: config?.pickup_address || '',
                        pickup_latitude: config.pickup_latitude,
                        pickup_longitude: config.pickup_longitude,
                        storage_location_id: config.storage_location_id,
                        required_vehicle_type_id: config.required_vehicle_type_id,
                        preparation_time_minutes: parseInt(config.preparation_time_minutes), // ✅ NOUVEAU: Temps de préparation
                        weight_kg: config.weight_kg ? parseFloat(config.weight_kg) : null,
                        volume_cm3: config.volume_cm3 ? parseFloat(config.volume_cm3) : null,
                        requires_isothermal: config.requires_isothermal,
                        requires_fragile_handling: config.requires_fragile_handling,
                        pickup_availability_schedule: config.pickup_availability_schedule, // ✅ Déjà un objet, pas de JSON.parse
                        pickup_instructions: config.pickup_instructions,
                        billing_mode: config.billing_mode,
                        billing_partner_label: config.billing_partner_label || ''
                    });
                }));
            });

            const results = await Promise.all(promises.flat());

            const successCount = results.filter((r: any) => r && r.success === true).length;
            const totalCount = results.length;

            if (successCount === totalCount) {
                Alert.alert(
                    '✅ Succès',
                    `Configuration de livraison appliquée avec succès à ${totalCount} produit(s)`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                onClose();
                                if (onSuccess) onSuccess();
                            }
                        }
                    ]
                );
            } else {
                Alert.alert(
                    '⚠️ Succès partiel',
                    `Configuration appliquée à ${successCount}/${totalCount} produit(s)`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                onClose();
                                if (onSuccess) onSuccess();
                            }
                        }
                    ]
                );
            }
        } catch (error: any) {
            console.error('Erreur configuration livraison globale:', error);
            Alert.alert(
                'Erreur',
                error.message || 'Impossible d\'appliquer la configuration de livraison'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={onClose}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Text style={styles.headerTitle}>
                                Configuration livraison
                            </Text>
                            {validProductsCount > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {validProductsCount === 1 
                                        ? `1 produit sélectionné`
                                        : `${validProductsCount} produits sélectionnés - Configuration identique pour tous`
                                    }
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Liste des produits sélectionnés */}
                        {validProductsCount > 0 && (
                            <NativeCard style={styles.productsCard}>
                                <View style={styles.productsHeader}>
                                    <SafeIcon name="package" size={20} color={modernColors.primary} />
                                    <Text style={styles.productsTitle}>
                                        Produits concernés ({validProductsCount})
                                    </Text>
                                </View>
                                <ScrollView style={styles.productsList} nestedScrollEnabled>
                                    {validProducts.map((product, index) => {
                                        const productNameDisplay = (() => {
                                            if (!product.productName) return 'Produit sans nom';
                                            if (typeof product.productName === 'string') {
                                                return product.productName.trim() || 'Produit sans nom';
                                            }
                                            return String(product.productName) || 'Produit sans nom';
                                        })();

                                        const serviceNameDisplay = (() => {
                                            if (!product.serviceName) return 'Service sans nom';
                                            if (typeof product.serviceName === 'string') {
                                                return product.serviceName.trim() || 'Service sans nom';
                                            }
                                            return String(product.serviceName) || 'Service sans nom';
                                        })();

                                        return (
                                            <View key={`${product.serviceId}_${product.productIndex}_${index}`} style={styles.productItem}>
                                                <SafeIcon name="check-circle" size={16} color="#10B981" />
                                                <View style={styles.productInfo}>
                                                    <Text style={styles.productName} numberOfLines={1}>
                                                        {productNameDisplay}
                                                    </Text>
                                                    <Text style={styles.serviceName} numberOfLines={1}>
                                                        {serviceNameDisplay}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </NativeCard>
                        )}

                        {/* Adresse de départ avec GPS */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Adresse de départ *</Text>
                            
                            {/* Lieu de stock optionnel */}
                            {Array.isArray(storageLocations) && storageLocations.length > 0 && (
                                <TouchableOpacity
                                    style={styles.select}
                                    onPress={() => {
                                        Alert.alert(
                                            'Lieu de stock',
                                            'Sélectionnez un lieu de stock (optionnel)',
                                            [
                                                { 
                                                    text: 'Aucun (saisie manuelle)', 
                                                    onPress: () => setConfig(prev => ({ ...prev, storage_location_id: undefined }))
                                                },
                                                ...storageLocations.map(loc => ({
                                                    text: `${loc.name} - ${loc.address}`,
                                                    onPress: () => {
                                                        setConfig(prev => ({
                                                            ...prev,
                                                            storage_location_id: loc.id,
                                                            pickup_address: loc.address,
                                                            pickup_latitude: loc.latitude,
                                                            pickup_longitude: loc.longitude,
                                                        }));
                                                    }
                                                })),
                                                { text: t('common.cancel'), style: 'cancel' as const }
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
                            )}

                            {/* ✅ NOUVEAU: Champ avec bouton GPS pour géocodage intelligent */}
                            <View style={styles.addressRow}>
                                <TextInput
                                    style={[styles.input, styles.addressInput]}
                                    value={config?.pickup_address || ''}
                                    onChangeText={(text) => setConfig(prev => ({ ...prev, pickup_address: text }))}
                                    placeholder="Rechercher un quartier, une ville, une adresse..."
                                    placeholderTextColor={modernColors.textSecondary}
                                />
                                <TouchableOpacity
                                    style={styles.gpsButton}
                                    onPress={() => {
                                        setGpsField('pickup');
                                        setShowGPSModal(true);
                                    }}
                                >
                                    <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* ✅ Afficher les coordonnées GPS */}
                            {(config.pickup_latitude !== 0 || config.pickup_longitude !== 0) && (
                                <View style={styles.gpsInfo}>
                                    <SafeIcon name="navigation" size={16} color="#10B981" />
                                    <Text style={styles.gpsText}>
                                        GPS: {config.pickup_latitude.toFixed(6)}, {config.pickup_longitude.toFixed(6)}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Type de véhicule */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Type de véhicule requis *</Text>
                            {Array.isArray(parcelTypes) && parcelTypes.length > 0 ? (
                                <TouchableOpacity
                                    style={styles.select}
                                    onPress={() => {
                                        Alert.alert(
                                            'Type de véhicule',
                                            'Sélectionnez un type de véhicule',
                                            [
                                                ...parcelTypes.map(pt => ({
                                                    text: pt.name,
                                                    onPress: () => setConfig(prev => ({ ...prev, required_vehicle_type_id: pt.id }))
                                                })),
                                                { text: t('common.cancel'), style: 'cancel' as const }
                                            ]
                                        );
                                    }}
                                >
                                    <Text style={styles.selectText}>
                                        {config.required_vehicle_type_id
                                            ? (parcelTypes.find(pt => pt.id === config.required_vehicle_type_id)?.name || 'Type sélectionné')
                                            : 'Sélectionner un type'}
                                    </Text>
                                    <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.hint}>Chargement des types de véhicule...</Text>
                            )}
                        </View>

                        {/* ✅ NOUVEAU: Temps de préparation */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Temps de préparation *</Text>
                            <Text style={styles.hint}>
                                Durée en minutes nécessaire pour préparer le produit avant l'arrivée du coursier
                            </Text>
                            <View style={styles.preparationTimeRow}>
                                <TextInput
                                    style={[styles.input, styles.preparationInput]}
                                    value={config.preparation_time_minutes}
                                    onChangeText={(text) => setConfig(prev => ({ ...prev, preparation_time_minutes: text }))}
                                    placeholder="30"
                                    keyboardType="numeric"
                                    placeholderTextColor={modernColors.textSecondary}
                                />
                                <Text style={styles.preparationUnit}>minutes</Text>
                            </View>
                        </View>

                        {/* Poids et volume */}
                        <View style={styles.row}>
                            <View style={[styles.section, styles.halfSection]}>
                                <Text style={styles.label}>Poids (kg)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={config.weight_kg}
                                    onChangeText={(text) => setConfig(prev => ({ ...prev, weight_kg: text }))}
                                    placeholder="Optionnel"
                                    keyboardType="numeric"
                                    placeholderTextColor={modernColors.textSecondary}
                                />
                            </View>
                            <View style={[styles.section, styles.halfSection]}>
                                <Text style={styles.label}>Volume (cm³)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={config.volume_cm3}
                                    onChangeText={(text) => setConfig(prev => ({ ...prev, volume_cm3: text }))}
                                    placeholder="Optionnel"
                                    keyboardType="numeric"
                                    placeholderTextColor={modernColors.textSecondary}
                                />
                            </View>
                        </View>

                        {/* Options spéciales */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Options spéciales</Text>
                            <View style={styles.checkboxRow}>
                                <View style={styles.checkbox}>
                                    <Switch
                                        value={config.requires_isothermal}
                                        onValueChange={(value) => setConfig(prev => ({ ...prev, requires_isothermal: value }))}
                                        trackColor={{ false: '#ccc', true: modernColors.primary }}
                                    />
                                    <Text style={styles.checkboxLabel}>Isotherme (froid)</Text>
                                </View>
                                <View style={styles.checkbox}>
                                    <Switch
                                        value={config.requires_fragile_handling}
                                        onValueChange={(value) => setConfig(prev => ({ ...prev, requires_fragile_handling: value }))}
                                        trackColor={{ false: '#ccc', true: modernColors.primary }}
                                    />
                                    <Text style={styles.checkboxLabel}>Manipulation fragile</Text>
                                </View>
                            </View>
                        </View>

                        {/* ✅ NOUVEAU: Plages horaires avec interface utilisateur (remplace JSON) */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Plages horaires de départ *</Text>
                            <Text style={styles.hint}>
                                Définissez les heures auxquelles les coursiers peuvent récupérer les colis
                            </Text>
                            
                            {DAYS_OF_WEEK.map((day) => {
                                const isActive = config.pickup_availability_schedule[day.key] && config.pickup_availability_schedule[day.key]!.length > 0;
                                const slots = config.pickup_availability_schedule[day.key] || [];

                                return (
                                    <View key={day.key} style={styles.daySchedule}>
                                        <TouchableOpacity
                                            style={styles.dayHeader}
                                            onPress={() => toggleDaySchedule(day.key)}
                                        >
                                            <View style={styles.dayHeaderLeft}>
                                                <SafeIcon 
                                                    name={isActive ? "check-square" : "square"} 
                                                    size={20} 
                                                    color={isActive ? modernColors.primary : modernColors.textSecondary} 
                                                />
                                                <Text style={[styles.dayLabel, isActive && styles.dayLabelActive]}>
                                                    {day.label}
                                                </Text>
                                            </View>
                                            {isActive && (
                                                <Text style={styles.slotCount}>
                                                    {slots.length} plage{slots.length > 1 ? 's' : ''}
                                                </Text>
                                            )}
                                        </TouchableOpacity>

                                        {isActive && (
                                            <View style={styles.timeSlots}>
                                                {slots.map((slot, slotIndex) => (
                                                    <View key={slotIndex} style={styles.timeSlotRow}>
                                                        <TextInput
                                                            style={[styles.timeInput, styles.halfInput]}
                                                            value={slot.start}
                                                            onChangeText={(value) => updateTimeSlot(day.key, slotIndex, 'start', value)}
                                                            placeholder="08:00"
                                                            placeholderTextColor={modernColors.textSecondary}
                                                        />
                                                        <Text style={styles.timeSeparator}>-</Text>
                                                        <TextInput
                                                            style={[styles.timeInput, styles.halfInput]}
                                                            value={slot.end}
                                                            onChangeText={(value) => updateTimeSlot(day.key, slotIndex, 'end', value)}
                                                            placeholder="18:00"
                                                            placeholderTextColor={modernColors.textSecondary}
                                                        />
                                                        {slots.length > 1 && (
                                                            <TouchableOpacity
                                                                style={styles.removeSlotButton}
                                                                onPress={() => removeTimeSlot(day.key, slotIndex)}
                                                            >
                                                                <SafeIcon name="x" size={16} color="#EF4444" />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                ))}
                                                <TouchableOpacity
                                                    style={styles.addSlotButton}
                                                    onPress={() => addTimeSlot(day.key)}
                                                >
                                                    <SafeIcon name="plus" size={16} color={modernColors.primary} />
                                                    <Text style={styles.addSlotText}>Ajouter une plage</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {/* Instructions */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Instructions de départ</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={config.pickup_instructions}
                                onChangeText={(text) => setConfig(prev => ({ ...prev, pickup_instructions: text }))}
                                placeholder="Instructions spéciales pour le coursier (optionnel)"
                                multiline
                                numberOfLines={3}
                                placeholderTextColor={modernColors.textSecondary}
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
                                            { text: t('common.cancel'), style: 'cancel' as const }
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
                                    placeholderTextColor={modernColors.textSecondary}
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
                                title={loading ? `Application...` : `Appliquer à ${validProductsCount} produit${validProductsCount > 1 ? 's' : ''}`}
                                variant="primary"
                                onPress={handleSave}
                                disabled={loading || validProductsCount === 0}
                                style={styles.actionButton}
                            />
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* ✅ Modal GPS pour sélection intelligente d'adresse */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => {
                    setShowGPSModal(false);
                    setGpsField(null);
                }}
                onSelect={handleGPSSelect}
                currentLocation={
                    config.pickup_latitude !== 0 && config.pickup_longitude !== 0
                        ? { lat: config.pickup_latitude, lng: config.pickup_longitude }
                        : null
                }
                title="Sélectionner l'adresse de départ"
                allowZoneSelection={false}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: modernColors.primary,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 4,
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    productsCard: {
        marginBottom: 16,
        padding: 16,
    },
    productsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    productsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    productsList: {
        maxHeight: 150,
    },
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    serviceName: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    section: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfSection: {
        flex: 1,
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
        fontStyle: 'italic',
        marginBottom: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    addressRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    addressInput: {
        flex: 1,
    },
    gpsButton: {
        padding: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    gpsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        padding: 8,
        backgroundColor: '#F0FDF4',
        borderRadius: 6,
    },
    gpsText: {
        fontSize: 12,
        color: '#166534',
        fontFamily: 'monospace',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    select: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: modernColors.surface,
    },
    selectText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    checkboxRow: {
        flexDirection: 'row',
        gap: 16,
        flexWrap: 'wrap',
    },
    checkbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkboxLabel: {
        fontSize: 14,
        color: modernColors.text,
    },
    daySchedule: {
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        overflow: 'hidden',
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: modernColors.surface,
    },
    dayHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dayLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    dayLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    slotCount: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    timeSlots: {
        padding: 12,
        backgroundColor: modernColors.background,
        gap: 8,
    },
    timeSlotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timeInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 6,
        padding: 8,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    halfInput: {
        flex: 1,
    },
    timeSeparator: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    removeSlotButton: {
        padding: 8,
    },
    addSlotButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 8,
        marginTop: 4,
    },
    addSlotText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
        marginBottom: 32,
    },
    actionButton: {
        flex: 1,
    },
    preparationTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    preparationInput: {
        flex: 1,
    },
    preparationUnit: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
        minWidth: 70,
    },
});

export default GlobalDeliveryConfigModal;
