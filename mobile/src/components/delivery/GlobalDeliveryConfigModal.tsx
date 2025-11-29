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
import { NativeButton, NativeCard } from '../NativeDesign';
import SafeIcon from '../SafeIcon';

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

const GlobalDeliveryConfigModal: React.FC<GlobalDeliveryConfigModalProps> = ({
    visible,
    onClose,
    selectedProducts,
    onSuccess,
}) => {
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
    const [config, setConfig] = useState({
        pickup_address: '',
        pickup_latitude: 0,
        pickup_longitude: 0,
        storage_location_id: undefined as number | undefined,
        required_vehicle_type_id: 0,
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
        if (visible && selectedProducts.length > 0) {
            loadParcelTypes();
            loadStorageLocations();
        }
    }, [visible, selectedProducts]);

    const loadStorageLocations = async () => {
        setLoadingLocations(true);
        try {
            const response = await deliveryApi.listStorageLocations();
            if (response.success && response.data?.locations) {
                // ✅ Sécuriser : Filtrer uniquement les lieux actifs
                const activeLocations = Array.isArray(response.data.locations)
                    ? response.data.locations.filter((loc: any) => loc && loc.is_active)
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
            if (response.success && response.data?.parcel_types) {
                // ✅ Sécuriser : S'assurer que parcelTypes est un tableau
                const types = Array.isArray(response.data.parcel_types)
                    ? response.data.parcel_types.filter((t: any) => t && t.id && t.name)
                    : [];
                setParcelTypes(types);
            }
        } catch (error) {
            console.error('Erreur chargement types de colis:', error);
        }
    };

    const handleSave = async () => {
        // Validation
        if (!config.pickup_address.trim()) {
            Alert.alert('Erreur', 'Veuillez sélectionner ou saisir une adresse de départ');
            return;
        }

        if (!config.required_vehicle_type_id || config.required_vehicle_type_id === 0) {
            Alert.alert('Erreur', 'Veuillez sélectionner un type de véhicule');
            return;
        }

        if (selectedProducts.length === 0) {
            Alert.alert('Erreur', 'Aucun produit sélectionné');
            return;
        }

        setLoading(true);

        try {
            // ✅ Grouper les produits par serviceId pour optimiser les appels API
            const productsByService = selectedProducts.reduce((acc, product) => {
                if (!acc[product.serviceId]) {
                    acc[product.serviceId] = [];
                }
                acc[product.serviceId].push(product.productIndex);
                return acc;
            }, {} as Record<number, number[]>);

            // ✅ Appliquer la configuration à tous les produits sélectionnés
            // ✅ CORRECTION: Vérifier que productsByService et productIndices sont valides
            const entries = Object.entries(productsByService).filter(([serviceIdStr, productIndices]) => {
                const serviceId = parseInt(serviceIdStr, 10);
                return !isNaN(serviceId) && Array.isArray(productIndices) && productIndices.length > 0;
            });

            const promises = entries.map(([serviceIdStr, productIndices]) => {
                const serviceId = parseInt(serviceIdStr, 10);

                return Promise.all((productIndices as number[]).filter(idx => typeof idx === 'number' && !isNaN(idx)).map(productIndex => {
                    return apiPost(`/api/delivery/product-config/${serviceId}/${productIndex}`, {
                        pickup_address: config.pickup_address,
                        pickup_latitude: config.pickup_latitude,
                        pickup_longitude: config.pickup_longitude,
                        storage_location_id: config.storage_location_id,
                        required_vehicle_type_id: config.required_vehicle_type_id,
                        weight_kg: config.weight_kg ? parseFloat(config.weight_kg) : null,
                        volume_cm3: config.volume_cm3 ? parseFloat(config.volume_cm3) : null,
                        requires_isothermal: config.requires_isothermal,
                        requires_fragile_handling: config.requires_fragile_handling,
                        pickup_availability_schedule: JSON.parse(config.pickup_availability_schedule || '{}'),
                        pickup_instructions: config.pickup_instructions,
                        billing_mode: config.billing_mode,
                        billing_partner_label: config.billing_partner_label || ''
                    });
                }));
            });

            const results = await Promise.all(promises.flat());

            // ✅ Vérifier si toutes les configurations ont été appliquées avec succès
            const successCount = results.filter(r => r.success).length;
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

    // ✅ Sécuriser : Vérifier que selectedProducts est un tableau valide
    const validProducts = Array.isArray(selectedProducts) ? selectedProducts.filter(p => p && p.serviceId && typeof p.productIndex === 'number') : [];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Configuration livraison globale</Text>
                    <TouchableOpacity onPress={onClose}>
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Liste des produits sélectionnés */}
                    <NativeCard style={styles.productsCard}>
                        <View style={styles.productsHeader}>
                            <SafeIcon name="package" size={20} color={modernColors.primary} />
                            <Text style={styles.productsTitle}>
                                Produits sélectionnés ({validProducts.length})
                            </Text>
                        </View>
                        {validProducts.length === 0 ? (
                            <Text style={styles.emptyText}>Aucun produit sélectionné</Text>
                        ) : (
                            <ScrollView style={styles.productsList} nestedScrollEnabled>
                                {validProducts.map((product, index) => (
                                    <View key={`${product.serviceId}_${product.productIndex}_${index}`} style={styles.productItem}>
                                        <SafeIcon name="check-circle" size={16} color="#10B981" />
                                        <View style={styles.productInfo}>
                                            <Text style={styles.productName} numberOfLines={1}>
                                                {product.productName || 'Produit sans nom'}
                                            </Text>
                                            <Text style={styles.serviceName} numberOfLines={1}>
                                                Service: {product.serviceName || 'Service sans nom'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </NativeCard>

                    {/* Adresse de départ */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Adresse de départ *</Text>
                        {/* Lieu de stock */}
                        {Array.isArray(storageLocations) && storageLocations.length > 0 && (
                            <TouchableOpacity
                                style={styles.select}
                                onPress={() => {
                                    Alert.alert(
                                        'Lieu de stock',
                                        'Sélectionnez un lieu de stock',
                                        [
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
                        )}
                        <TextInput
                            style={styles.input}
                            value={config.pickup_address}
                            onChangeText={(text) => setConfig(prev => ({ ...prev, pickup_address: text }))}
                            placeholder="Ou saisir une adresse manuellement"
                            placeholderTextColor={modernColors.textSecondary}
                        />
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
                                            { text: 'Annuler', style: 'cancel' as const }
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

                    {/* Poids et volume */}
                    <View style={styles.row}>
                        <View style={[styles.section, styles.halfSection]}>
                            <Text style={styles.label}>Poids (kg)</Text>
                            <TextInput
                                style={styles.input}
                                value={config.weight_kg}
                                onChangeText={(text) => setConfig(prev => ({ ...prev, weight_kg: text }))}
                                placeholder="0"
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
                                placeholder="0"
                                keyboardType="numeric"
                                placeholderTextColor={modernColors.textSecondary}
                            />
                        </View>
                    </View>

                    {/* Options spéciales */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Options spéciales</Text>
                        <View style={styles.checkboxRow}>
                            <TouchableOpacity
                                style={styles.checkbox}
                                onPress={() => setConfig(prev => ({ ...prev, requires_isothermal: !prev.requires_isothermal }))}
                            >
                                <SafeIcon
                                    name={config.requires_isothermal ? "check-square" : "square"}
                                    size={20}
                                    color={modernColors.primary}
                                />
                                <Text style={styles.checkboxLabel}>Isotherme (froid)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.checkbox}
                                onPress={() => setConfig(prev => ({ ...prev, requires_fragile_handling: !prev.requires_fragile_handling }))}
                            >
                                <SafeIcon
                                    name={config.requires_fragile_handling ? "check-square" : "square"}
                                    size={20}
                                    color={modernColors.primary}
                                />
                                <Text style={styles.checkboxLabel}>Manipulation fragile</Text>
                            </TouchableOpacity>
                        </View>
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
                            title={loading ? `Application à ${validProducts.length} produit(s)...` : `Appliquer à ${validProducts.length} produit(s)`}
                            variant="primary"
                            onPress={handleSave}
                            disabled={loading || validProducts.length === 0}
                            style={styles.actionButton}
                        />
                    </View>
                </ScrollView>
            </View>
        </Modal>
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
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
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
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        paddingVertical: 16,
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
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
        marginBottom: 32,
    },
    actionButton: {
        flex: 1,
    },
});

export default GlobalDeliveryConfigModal;
