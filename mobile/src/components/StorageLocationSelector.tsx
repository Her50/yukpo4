import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { deliveryApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import ModernGPSModal from './ModernGPSModal';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface StorageLocation {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    zone_id?: string | null;
    is_active: boolean;
}

interface StorageLocationSelectorProps {
    value?: number | null; // ID du lieu de stockage sélectionné
    onSelect: (locationId: number | null) => void;
    label?: string;
    required?: boolean;
    showCreateButton?: boolean;
}

const StorageLocationSelector: React.FC<StorageLocationSelectorProps> = ({
    value,
    onSelect,
    label={t('storageLocationSelector.lieuDeStockage')},
    required = false,
    showCreateButton = true
}) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [locations, setLocations] = useState<StorageLocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [creatingLocation, setCreatingLocation] = useState(false);
    const [newLocationData, setNewLocationData] = useState({
        name: '',
        address: '',
        latitude: 0,
        longitude: 0,
    });

    useEffect(() => {
        loadLocations();
    }, []);

    const loadLocations = async () => {
        setLoading(true);
        try {
            const response = await deliveryApi.listStorageLocations();
            const rd: any = response.data;
            if (response.success && rd?.locations) {
                setLocations(rd.locations.filter((loc: StorageLocation) => loc.is_active));
            }
        } catch (error: any) {
            console.error('[StorageLocationSelector] Erreur chargement lieux:', error);
        } finally {
            setLoading(false);
        }
    };

    const selectedLocation = locations.find(loc => loc.id === value);

    const handleSelectLocation = () => {
        const options = [
            { text: t('storageLocationSelector.aucunLieuDeStockage'), onPress: () => onSelect(null) },
            ...locations.map(loc => ({
                text: `${loc.name} - ${loc.address}`,
                onPress: () => onSelect(loc.id)
            })),
            ...(showCreateButton ? [{
                text: t('storageLocationSelector.creerUnNouveauLieu'),
                onPress: () => {
                    setNewLocationData({ name: '', address: '', latitude: 0, longitude: 0 });
                    setShowGPSModal(true);
                }
            }] : []),
            {
                text: t('storageLocationSelector.gererLesLieuxDeStock'), onPress: () => {
                    // @ts-ignore
                    navigation.navigate('StorageLocations');
                }
            },
            { text: t('common.cancel'), style: 'cancel' as const }
        ];
        Alert.alert('Sélectionner un lieu de stockage', '', options);
    };

    const handleGPSSelect = (coordinates: string) => {
        // Format: "lat,lng"
        const [lat, lng] = coordinates.split(',').map(Number);
        setNewLocationData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
        }));
        setShowGPSModal(false);

        // Demander le nom et l'adresse
        Alert.prompt(
            'Nom du lieu de stockage',
            'Donnez un nom à ce lieu de stockage (ex: Entrepôt principal, Magasin centre-ville)',
            [
                { text: t('common.cancel'), style: 'cancel', onPress: () => { } },
                {
                    text: t('common.continue'),
                    onPress: (name) => {
                        if (name && name.trim()) {
                            setNewLocationData(prev => ({ ...prev, name: name.trim() }));
                            Alert.prompt(
                                'Adresse',
                                t('storageLocationSelector.entrezLadresseCompleteDeCeLieuDeStockage'),
                                [
                                    { text: t('common.cancel'), style: 'cancel', onPress: () => { } },
                                    {
                                        text: t('common.create'),
                                        onPress: async (address) => {
                                            if (address && address.trim()) {
                                                await createStorageLocation({
                                                    name: newLocationData.name || name.trim(),
                                                    address: address.trim(),
                                                    latitude: lat,
                                                    longitude: lng,
                                                });
                                            }
                                        }
                                    }
                                ],
                                'plain-text',
                                newLocationData.address
                            );
                        }
                    }
                }
            ],
            'plain-text',
            newLocationData.name
        );
    };

    const createStorageLocation = async (data: { name: string; address: string; latitude: number; longitude: number }) => {
        setCreatingLocation(true);
        try {
            const payload = {
                name: data.name,
                address: data.address,
                latitude: data.latitude,
                longitude: data.longitude,
                zone_id: null,
                is_active: true,
            };

            const response = await deliveryApi.createStorageLocation(payload);
            const crd: any = response.data;
            if (response.success && crd?.location) {
                await loadLocations();
                onSelect(crd.location.id);
                Alert.alert('Succès', 'Lieu de stockage créé avec succès');
            } else {
                throw new Error(response.message || t('storageLocationSelector.erreurLorsDeLaCreation'));
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de créer le lieu de stockage');
        } finally {
            setCreatingLocation(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <TouchableOpacity
                style={[styles.selectButton, !selectedLocation && styles.selectButtonEmpty]}
                onPress={handleSelectLocation}
                disabled={loading || creatingLocation}
            >
                <View style={styles.selectButtonContent}>
                    {selectedLocation ? (
                        <>
                            <SafeIcon name="warehouse" size={20} color={modernColors.primary} />
                            <View style={styles.locationInfo}>
                                <Text style={styles.locationName} numberOfLines={1}>
                                    {selectedLocation.name}
                                </Text>
                                <Text style={styles.locationAddress} numberOfLines={1}>
                                    {selectedLocation.address}
                                </Text>
                                <Text style={styles.locationGPS}>
                                    📍 {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.placeholderText}>
                                Sélectionner un lieu de stockage
                            </Text>
                        </>
                    )}
                    <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                </View>
            </TouchableOpacity>

            {selectedLocation && (
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => onSelect(null)}
                >
                    <SafeIcon name="x" size={16} color={modernColors.error} />
                    <Text style={styles.clearButtonText}>Retirer le lieu de stockage</Text>
                </TouchableOpacity>
            )}

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                title={t('storageLocationSelector.selectionnerL')}emplacement GPS du lieu de stockage"
                allowZoneSelection={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
    },
    selectButton: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: modernColors.surface,
    },
    selectButtonEmpty: {
        borderStyle: 'dashed',
    },
    selectButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    locationInfo: {
        flex: 1,
    },
    locationName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    locationAddress: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 2,
    },
    locationGPS: {
        fontSize: 11,
        color: modernColors.primary,
        marginTop: 2,
    },
    placeholderText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        padding: 8,
        alignSelf: 'flex-start',
    },
    clearButtonText: {
        fontSize: 12,
        color: modernColors.error,
    },
});

export default StorageLocationSelector;





