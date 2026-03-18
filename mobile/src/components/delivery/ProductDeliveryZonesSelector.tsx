// ✅ Phase 9 - Amélioration : Composant mobile pour associer des zones de livraison aux produits
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';
// ✅ CORRIGÉ: Utiliser SafeStorage au lieu d'AsyncStorage directement
import SafeStorage from '../../utils/safeStorage';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface DeliveryZone {
    id: string;
    name: string;
    description?: string | null;
    is_active: boolean;
}

interface ProductDeliveryZonesSelectorProps {
    serviceId: number;
    productIndex: number;
    selectedZoneIds?: string[];
    onChange?: (zoneIds: string[]) => void;
    readonly?: boolean;
}

const ProductDeliveryZonesSelector: React.FC<ProductDeliveryZonesSelectorProps> = ({
    serviceId,
    productIndex,
    selectedZoneIds = [],
    onChange,
    readonly = false,
}) => {
        const { t } = useLanguageSafe();
const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<string[]>(selectedZoneIds);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadZones();
        loadProductZones();
    }, [serviceId, productIndex]);

    useEffect(() => {
        setSelected(selectedZoneIds);
    }, [selectedZoneIds]);

    const loadZones = async () => {
        setLoading(true);
        try {
            const zonesList = await deliveryApi.listDeliveryZones();
            setZones(zonesList.filter((z: DeliveryZone) => z.is_active));
        } catch (error: any) {
            console.error('Erreur chargement zones:', error);
            Alert.alert('Erreur', 'Impossible de charger les zones de livraison');
        } finally {
            setLoading(false);
        }
    };

    const loadProductZones = async () => {
        try {
            // ✅ CORRIGÉ: Utiliser SafeStorage au lieu d'AsyncStorage directement
            const token = await SafeStorage.getItem('auth_token');
            const response = await fetch(
                `${require('../../config/environment').config.API_BASE_URL}/api/products/${serviceId}/${productIndex}/zones`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );
            if (response.ok) {
                const data = await response.json();
                setSelected(data.zone_ids || []);
            }
        } catch (error: any) {
            console.error('Erreur chargement zones produit:', error);
        }
    };

    const handleToggleZone = (zoneId: string) => {
        if (readonly) return;

        const newSelected = selected.includes(zoneId)
            ? selected.filter(id => id !== zoneId)
            : [...selected, zoneId];

        setSelected(newSelected);
        onChange?.(newSelected);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
            const SafeStorage = require('../../utils/safeStorage').default;
            const token = await SafeStorage.getItem('auth_token');
            const response = await fetch(
                `${require('../../config/environment').config.API_BASE_URL}/api/products/${serviceId}/${productIndex}/zones`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ zone_ids: selected }),
                }
            );

            if (!response.ok) {
                throw new Error('Erreur lors de la sauvegarde');
            }

            Alert.alert('✅ Zones sauvegardées', 'Les zones de livraison ont été associées au produit avec succès');
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de sauvegarder les zones');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                    <Text style={styles.title}>Zones de livraison disponibles</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('productDeliveryZonesSelector.chargementDesZones')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                <Text style={styles.title}>Zones de livraison disponibles</Text>
            </View>

            {!readonly && (
                <View style={styles.saveButtonContainer}>
                    <NativeButton
                        onPress={handleSave}
                        disabled={saving}
                        variant="primary"
                        style={styles.saveButton}
                    >
                        {saving ? 'Sauvegarde...' : 'Enregistrer'}
                    </NativeButton>
                </View>
            )}

            {zones.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>{t('productDeliveryZonesSelector.aucuneZoneDeLivraisonDisponible')}</Text>
                </View>
            ) : (
                <ScrollView style={styles.zonesList} showsVerticalScrollIndicator={false}>
                    {zones.map((zone) => {
                        const isSelected = selected.includes(zone.id);
                        return (
                            <TouchableOpacity
                                key={zone.id}
                                onPress={() => handleToggleZone(zone.id)}
                                disabled={readonly}
                                style={[
                                    styles.zoneItem,
                                    isSelected && styles.zoneItemSelected,
                                    readonly && styles.zoneItemReadonly,
                                ]}
                            >
                                <View style={styles.zoneItemContent}>
                                    <View
                                        style={[
                                            styles.checkbox,
                                            isSelected && styles.checkboxSelected,
                                        ]}
                                    >
                                        {isSelected && (
                                            <SafeIcon name="check" size={14} color="#FFFFFF" />
                                        )}
                                    </View>
                                    <View style={styles.zoneInfo}>
                                        <Text style={styles.zoneName}>{zone.name}</Text>
                                        {zone.description && (
                                            <Text style={styles.zoneDescription}>
                                                {zone.description}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {selected.length > 0 && (
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {selected.length} zone{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginLeft: 8,
    },
    saveButtonContainer: {
        marginBottom: 16,
    },
    saveButton: {
        width: '100%',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingText: {
        marginLeft: 8,
        color: modernColors.textSecondary,
        fontSize: 14,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: modernColors.textSecondary,
        fontSize: 14,
    },
    zonesList: {
        maxHeight: 300,
    },
    zoneItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
    },
    zoneItemSelected: {
        borderColor: modernColors.primary,
        backgroundColor: `${modernColors.primary}10`,
    },
    zoneItemReadonly: {
        opacity: 0.6,
    },
    zoneItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: modernColors.border,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    zoneInfo: {
        flex: 1,
    },
    zoneName: {
        fontSize: 15,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 4,
    },
    zoneDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    footer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    footerText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
});

export default ProductDeliveryZonesSelector;


