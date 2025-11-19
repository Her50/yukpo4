import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface StorageLocation {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    zone_id?: string | null; // ✅ Phase 9 - Amélioration : Zone géographique associée
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ✅ Phase 9 - Amélioration : Interface pour les zones de livraison
interface DeliveryZone {
    id: string;
    name: string;
    description?: string | null;
    is_active: boolean;
}

const StorageLocationsScreen: React.FC = () => {
    const navigation = useNavigation();
    const [locations, setLocations] = useState<StorageLocation[]>([]);
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingZones, setLoadingZones] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        latitude: '',
        longitude: '',
        zone_id: null as string | null,
        is_active: true,
    });

    useEffect(() => {
        loadLocations();
        loadZones();
    }, []);

    const loadZones = async () => {
        setLoadingZones(true);
        try {
            const zonesList = await deliveryApi.listDeliveryZones();
            // zonesList est déjà un tableau après traitement dans api.ts
            if (Array.isArray(zonesList)) {
                setZones(zonesList.filter((z: DeliveryZone) => z.is_active));
            } else {
                setZones([]);
            }
        } catch (error: any) {
            console.error('Erreur chargement zones:', error);
            // Ne pas afficher d'erreur si les zones ne sont pas disponibles
            setZones([]);
        } finally {
            setLoadingZones(false);
        }
    };

    const loadLocations = async () => {
        setLoading(true);
        try {
            const response = await deliveryApi.listStorageLocations();
            if (response.success && response.data?.locations) {
                setLocations(response.data.locations);
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de charger les lieux de stock');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingLocation(null);
        setFormData({
            name: '',
            address: '',
            latitude: '',
            longitude: '',
            zone_id: null,
            is_active: true,
        });
        setShowModal(true);
    };

    const handleEdit = (location: StorageLocation) => {
        setEditingLocation(location);
        setFormData({
            name: location.name,
            address: location.address,
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            zone_id: location.zone_id || null,
            is_active: location.is_active,
        });
        setShowModal(true);
    };

    const handleDelete = async (id: number) => {
        Alert.alert(
            'Confirmation',
            'Êtes-vous sûr de vouloir supprimer ce lieu de stock ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deliveryApi.deleteStorageLocation(id);
                            Alert.alert('Succès', 'Lieu de stock supprimé avec succès');
                            loadLocations();
                        } catch (error: any) {
                            Alert.alert('Erreur', error.message || 'Impossible de supprimer le lieu de stock');
                        }
                    },
                },
            ]
        );
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Erreur', 'Le nom est obligatoire');
            return;
        }
        if (!formData.address.trim()) {
            Alert.alert('Erreur', 'L\'adresse est obligatoire');
            return;
        }
        const lat = parseFloat(formData.latitude);
        const lng = parseFloat(formData.longitude);
        if (isNaN(lat) || isNaN(lng)) {
            Alert.alert('Erreur', 'Veuillez entrer des coordonnées GPS valides');
            return;
        }

        try {
            const payload = {
                name: formData.name,
                address: formData.address,
                latitude: lat,
                longitude: lng,
                zone_id: formData.zone_id || null,
                is_active: formData.is_active,
            };

            if (editingLocation) {
                await deliveryApi.updateStorageLocation(editingLocation.id, payload);
                Alert.alert('Succès', 'Lieu de stock mis à jour avec succès');
            } else {
                await deliveryApi.createStorageLocation(payload);
                Alert.alert('Succès', 'Lieu de stock créé avec succès');
            }
            setShowModal(false);
            loadLocations();
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de sauvegarder le lieu de stock');
        }
    };

    const renderLocation = ({ item }: { item: StorageLocation }) => (
        <NativeCard style={[styles.locationCard, !item.is_active && styles.inactiveCard]}>
            <View style={styles.locationHeader}>
                <View style={styles.locationTitleRow}>
                    <SafeIcon name="warehouse" size={20} color={modernColors.primary} />
                    <Text style={styles.locationName}>{item.name}</Text>
                </View>
                {!item.is_active && (
                    <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveText}>Inactif</Text>
                    </View>
                )}
            </View>
            <View style={styles.locationContent}>
                <View style={styles.addressRow}>
                    <SafeIcon name="map-pin" size={16} color={modernColors.textSecondary} />
                    <Text style={styles.addressText}>{item.address}</Text>
                </View>
                <Text style={styles.gpsText}>
                    GPS: {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                </Text>
                {item.zone_id && (
                    <Text style={styles.zoneText}>
                        Zone: {zones.find(z => z.id === item.zone_id)?.name || item.zone_id}
                    </Text>
                )}
            </View>
            <View style={styles.locationActions}>
                <NativeButton
                    title="Modifier"
                    variant="secondary"
                    size="small"
                    onPress={() => handleEdit(item)}
                />
                <NativeButton
                    title="Supprimer"
                    variant="secondary"
                    size="small"
                    onPress={() => handleDelete(item.id)}
                    style={styles.deleteButton}
                />
            </View>
        </NativeCard>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <SafeIcon name="warehouse" size={24} color={modernColors.primary} />
                    <Text style={styles.headerTitle}>Lieux de stock</Text>
                </View>
                <TouchableOpacity onPress={handleCreate} style={styles.addButton}>
                    <SafeIcon name="plus" size={24} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : locations.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="warehouse" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyTitle}>Aucun lieu de stock</Text>
                    <Text style={styles.emptyText}>
                        Créez votre premier lieu de stock pour optimiser vos livraisons
                    </Text>
                    <NativeButton
                        title="Créer un lieu de stock"
                        variant="primary"
                        onPress={handleCreate}
                        style={styles.createButton}
                    />
                </View>
            ) : (
                <FlatList
                    data={locations}
                    renderItem={renderLocation}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={loadLocations}
                />
            )}

            {/* Modal de création/édition */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingLocation ? 'Modifier le lieu de stock' : 'Nouveau lieu de stock'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Nom du lieu de stock *</Text>
                                <NativeInput
                                    value={formData.name}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                                    placeholder="Ex: Entrepôt principal, Magasin centre-ville..."
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Adresse *</Text>
                                <NativeInput
                                    value={formData.address}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                                    placeholder="Adresse complète"
                                    multiline
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Latitude *</Text>
                                <NativeInput
                                    value={formData.latitude}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, latitude: text }))}
                                    placeholder="Ex: 4.050000"
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Longitude *</Text>
                                <NativeInput
                                    value={formData.longitude}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, longitude: text }))}
                                    placeholder="Ex: 9.700000"
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* ✅ Phase 9 - Amélioration : Sélection de la zone géographique */}
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Zone de livraison (optionnel)</Text>
                                <TouchableOpacity
                                    style={styles.selectButton}
                                    onPress={() => {
                                        const options = [
                                            { text: 'Aucune zone', onPress: () => setFormData(prev => ({ ...prev, zone_id: null })) },
                                            ...zones.map(zone => ({
                                                text: `${zone.name}${zone.description ? ` - ${zone.description}` : ''}`,
                                                onPress: () => setFormData(prev => ({ ...prev, zone_id: zone.id }))
                                            })),
                                            { text: 'Annuler', style: 'cancel' as const }
                                        ];
                                        Alert.alert('Sélectionner une zone', '', options);
                                    }}
                                >
                                    <Text style={styles.selectButtonText}>
                                        {formData.zone_id
                                            ? zones.find(z => z.id === formData.zone_id)?.name || 'Zone sélectionnée'
                                            : 'Aucune zone'}
                                    </Text>
                                    <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                                {loadingZones && (
                                    <Text style={styles.hintText}>Chargement des zones...</Text>
                                )}
                            </View>

                            <View style={styles.checkboxRow}>
                                <TouchableOpacity
                                    style={styles.checkbox}
                                    onPress={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                                >
                                    <SafeIcon
                                        name={formData.is_active ? 'check-square' : 'square'}
                                        size={20}
                                        color={modernColors.primary}
                                    />
                                    <Text style={styles.checkboxLabel}>Lieu de stock actif</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                variant="secondary"
                                onPress={() => setShowModal(false)}
                                style={styles.cancelButton}
                            />
                            <NativeButton
                                title={editingLocation ? 'Mettre à jour' : 'Créer'}
                                variant="primary"
                                onPress={handleSave}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    addButton: {
        padding: 8,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    createButton: {
        marginTop: 8,
    },
    listContent: {
        padding: 16,
    },
    locationCard: {
        marginBottom: 16,
    },
    inactiveCard: {
        opacity: 0.6,
    },
    locationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    locationName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        flex: 1,
    },
    inactiveBadge: {
        backgroundColor: modernColors.textSecondary + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    inactiveText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    locationContent: {
        marginBottom: 12,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    addressText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    gpsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    locationActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    deleteButton: {
        backgroundColor: modernColors.error + '20',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    modalBody: {
        padding: 16,
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    checkboxRow: {
        marginTop: 8,
    },
    checkbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkboxLabel: {
        fontSize: 14,
        color: modernColors.text,
        marginLeft: 8,
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
    },
    selectButtonText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    hintText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    zoneText: {
        fontSize: 12,
        color: modernColors.primary,
        marginTop: 4,
        fontWeight: '500',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    cancelButton: {
        flex: 1,
    },
});

export default StorageLocationsScreen;

