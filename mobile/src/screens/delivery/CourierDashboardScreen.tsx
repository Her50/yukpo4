import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { DeliverySummary } from '../../types/delivery';

const CourierDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeDeliveries, setActiveDeliveries] = useState<DeliverySummary[]>([]);
    const [stats, setStats] = useState({
        totalDeliveries: 0,
        completedDeliveries: 0,
        totalEarnings: 0,
        currentMonthEarnings: 0,
    });

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        try {
            setLoading(true);
            // Charger les livraisons actives
            const deliveriesResponse = await deliveryApi.listActiveDeliveries();
            const deliveries = deliveriesResponse.data?.deliveries || deliveriesResponse.data || [];
            setActiveDeliveries(Array.isArray(deliveries) ? deliveries : []);

            // TODO: Charger les statistiques du coursier
            // const statsResponse = await deliveryApi.getCourierStats(user?.id);
            // setStats(statsResponse.data);
        } catch (error) {
            console.error('[CourierDashboardScreen] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleOpenDelivery = (deliveryId: string) => {
        navigation.navigate('DeliveryShoppingTracking' as never, { deliveryId } as never);
    };

    if (loading) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView
                style={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Suivre mes courses</Text>
                    <Text style={styles.subtitle}>Tableau de bord coursier</Text>
                </View>

                {/* Statistiques */}
                <View style={styles.statsContainer}>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.completedDeliveries}</Text>
                        <Text style={styles.statLabel}>Livraisons complétées</Text>
                    </NativeCard>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.totalEarnings.toLocaleString()} XAF</Text>
                        <Text style={styles.statLabel}>Gains totaux</Text>
                    </NativeCard>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.currentMonthEarnings.toLocaleString()} XAF</Text>
                        <Text style={styles.statLabel}>Ce mois</Text>
                    </NativeCard>
                </View>

                {/* Livraisons actives */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Livraisons actives</Text>
                    {activeDeliveries.length === 0 ? (
                        <NativeCard style={styles.emptyCard}>
                            <SafeIcon name="package" size={48} color={modernColors.textSecondary} />
                            <Text style={styles.emptyText}>Aucune livraison active</Text>
                        </NativeCard>
                    ) : (
                        activeDeliveries.map((delivery) => (
                            <TouchableOpacity
                                key={delivery.id}
                                onPress={() => handleOpenDelivery(delivery.id)}
                            >
                                <NativeCard style={styles.deliveryCard}>
                                    <View style={styles.deliveryHeader}>
                                        <Text style={styles.deliveryId}>
                                            Livraison #{delivery.id.slice(-6)}
                                        </Text>
                                        <Text style={styles.deliveryStatus}>{delivery.status}</Text>
                                    </View>
                                    <View style={styles.deliveryInfo}>
                                        <View style={styles.deliveryRow}>
                                            <SafeIcon name="map-pin" size={16} color={modernColors.textSecondary} />
                                            <Text style={styles.deliveryText}>
                                                {delivery.pickup?.label || 'Pickup'}
                                            </Text>
                                        </View>
                                        <View style={styles.deliveryRow}>
                                            <SafeIcon name="navigation" size={16} color={modernColors.textSecondary} />
                                            <Text style={styles.deliveryText}>
                                                {delivery.dropoff?.label || 'Dropoff'}
                                            </Text>
                                        </View>
                                    </View>
                                </NativeCard>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Actions rapides */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Actions rapides</Text>
                    <NativeButton
                        title="📊 Voir mes statistiques"
                        variant="outline"
                        onPress={() => {
                            // TODO: Naviguer vers page statistiques détaillées
                            Alert.alert('Info', 'Page statistiques à venir');
                        }}
                    />
                    <NativeButton
                        title="💰 Voir mes gains"
                        variant="outline"
                        onPress={() => {
                            // TODO: Naviguer vers page gains
                            Alert.alert('Info', 'Page gains à venir');
                        }}
                    />
                </View>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    scroll: {
        flex: 1,
    },
    header: {
        padding: 16,
        paddingBottom: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    section: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    emptyCard: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 12,
    },
    deliveryCard: {
        marginBottom: 12,
        padding: 16,
    },
    deliveryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    deliveryId: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    deliveryStatus: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        textTransform: 'uppercase',
    },
    deliveryInfo: {
        gap: 8,
    },
    deliveryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    deliveryText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        flex: 1,
    },
});

export default CourierDashboardScreen;

