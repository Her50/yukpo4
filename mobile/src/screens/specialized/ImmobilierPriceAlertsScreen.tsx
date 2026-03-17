// Écran de gestion des alertes prix
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface PriceAlert {
    id: number;
    property_id?: number;
    property_titre?: string;
    search_criteria?: any;
    target_price_max?: number;
    alert_type: string;
    is_active: boolean;
}

const ImmobilierPriceAlertsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAlerts = async () => {
        try {
            setError(null);
            const response = await immobilierService.getMyPriceAlerts();
            if (response.success && response.data) {
                setAlerts((response as any).data);
            } else {
                setError(t('immobilierPriceAlertsScreen.erreurLorsDuChargementDesAlertes'));
            }
        } catch (err: any) {
            console.error('[ImmobilierPriceAlertsScreen] Erreur:', err);
            setError(err.message || 'Erreur lors du chargement');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadAlerts();
        }, [])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadAlerts();
    };

    const handleToggleAlert = async (alertId: number, currentStatus: boolean) => {
        // Note: L'API backend devrait avoir un endpoint pour activer/désactiver une alerte
        // Pour l'instant, on affiche juste une confirmation
        Alert.alert(
            currentStatus ? t('immobilierPriceAlertsScreen.desactiverL')alerte' : 'Activer l\'alerte',
            t('immobilierPriceAlertsScreen.cetteFonctionnaliteSeraDisponibleProchainement'),
            [{ text: 'OK' }]
        );
    };

    const handleDeleteAlert = (alertId: number) => {
        Alert.alert(
            'Supprimer l\'alerte',
            t('immobilierPriceAlertsScreen.etesvousSurDeVouloirSupprimerCette'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                        // TODO: Implémenter la suppression côté backend
                        Alert.alert('Info', t('immobilierPriceAlertsScreen.suppressionAImplementer'));
                    },
                },
            ]
        );
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'N/A';
        if (price >= 1000000) {
            return `${(price / 1000000).toFixed(1)}M FCFA`;
        }
        return `${(price / 1000).toFixed(0)}K FCFA`;
    };

    const getAlertTypeLabel = (type: string) => {
        switch (type) {
            case 'price_drop':
                return 'Baisse de prix';
            case 'new_property':
                return 'Nouveau bien';
            case 'price_match':
                return 'Prix correspondant';
            default:
                return type;
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('immobilierPriceAlerts.chargementDeVosAlertes')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="bell" size={24} color={modernColors.primary} />
                <Text style={styles.headerTitle}>{t('immobilierPriceAlerts.mesAlertesPrix')}</Text>
                <Text style={styles.headerSubtitle}>
                    {alerts.length} alerte{alerts.length > 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={alerts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.alertCard}>
                        <View style={styles.alertHeader}>
                            <View style={styles.alertHeaderLeft}>
                                <SafeIcon
                                    name={item.is_active ? 'bell' : 'bell-off'}
                                    size={20}
                                    color={item.is_active ? modernColors.primary : '#9CA3AF'}
                                />
                                <Text style={styles.alertType}>
                                    {getAlertTypeLabel(item.alert_type)}
                                </Text>
                            </View>
                            <Switch
                                value={item.is_active}
                                onValueChange={() => handleToggleAlert(item.id, item.is_active)}
                                trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                            />
                        </View>

                        {item.property_titre && (
                            <Text style={styles.alertPropertyTitle}>{item.property_titre}</Text>
                        )}

                        {item.target_price_max && (
                            <View style={styles.alertPriceRow}>
                                <Text style={styles.alertPriceLabel}>Prix maximum :</Text>
                                <Text style={styles.alertPriceValue}>
                                    {formatPrice(item.target_price_max)}
                                </Text>
                            </View>
                        )}

                        {item.search_criteria && (
                            <View style={styles.alertCriteria}>
                                <Text style={styles.alertCriteriaLabel}>{t('immobilierPriceAlerts.criteres')}</Text>
                                <Text style={styles.alertCriteriaText}>
                                    {JSON.stringify(item.search_criteria, null, 2)}
                                </Text>
                            </View>
                        )}

                        <View style={styles.alertActions}>
                            {item.property_id && (
                                <TouchableOpacity
                                    style={styles.alertActionButton}
                                    onPress={() => {
                                        (navigation as any).navigate('ImmobilierDetails', {
                                            propertyId: item.property_id,
                                        });
                                    }}
                                >
                                    <SafeIcon name="eye" size={16} color={modernColors.primary} />
                                    <Text style={styles.alertActionText}>{t('immobilierPriceAlerts.voirLeBien')}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.alertActionButton, styles.deleteButton]}
                                onPress={() => handleDeleteAlert(item.id)}
                            >
                                <SafeIcon name="trash-2" size={16} color="#EF4444" />
                                <Text style={[styles.alertActionText, styles.deleteText]}>
                                    Supprimer
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[modernColors.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="bell-off" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyText}>{t('immobilierPriceAlerts.aucuneAlerte')}</Text>
                        <Text style={styles.emptySubtext}>
                            Créez des alertes pour être notifié lorsque des biens correspondent à vos critères
                        </Text>
                        <NativeButton
                            title={t('immobilierPriceAlerts.creerUneAlerte')}
                            onPress={() => {
                                (navigation as any).navigate('ImmobilierSearch');
                            }}
                            style={styles.createButton}
                        />
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    listContent: {
        padding: 16,
    },
    alertCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    alertHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    alertHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    alertType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    alertPropertyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
    },
    alertPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    alertPriceLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    alertPriceValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    alertCriteria: {
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    alertCriteriaLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    alertCriteriaText: {
        fontSize: 12,
        color: '#374151',
        fontFamily: 'monospace',
    },
    alertActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    alertActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        gap: 6,
    },
    deleteButton: {
        backgroundColor: '#FEE2E2',
    },
    alertActionText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    deleteText: {
        color: '#EF4444',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 24,
    },
    createButton: {
        minWidth: 200,
    },
});

export default ImmobilierPriceAlertsScreen;

