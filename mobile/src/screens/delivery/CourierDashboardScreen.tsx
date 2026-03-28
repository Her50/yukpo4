import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import BookCourierSubDashboard from '../../components/delivery/BookCourierSubDashboard';
import CourierStatsChart from '../../components/delivery/CourierStatsChart';
import SkeletonDeliveryCard from '../../components/delivery/SkeletonDeliveryCard';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { deliveryApi } from '../../services/api';
import { notificationSoundService } from '../../services/notificationSoundService';
import { modernColors } from '../../theme/modernTheme';
import { DeliverySummary } from '../../types/delivery';
import { useScreenEnter } from '../../utils/animations';

const CourierDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeDeliveries, setActiveDeliveries] = useState<DeliverySummary[]>([]);
    const [lastDeliveryCount, setLastDeliveryCount] = useState(0);
    const [stats, setStats] = useState({
        totalDeliveries: 0,
        completedDeliveries: 0,
        totalEarnings: 0,
        currentMonthEarnings: 0,
        avgDeliveryTime: 0,
        successRate: 95,
    });

    // ✅ CORRIGÉ: S'assurer que toutes les valeurs stats sont des nombres
    const safeStats = {
        totalDeliveries: typeof stats.totalDeliveries === 'number' ? stats.totalDeliveries : 0,
        completedDeliveries: typeof stats.completedDeliveries === 'number' ? stats.completedDeliveries : 0,
        totalEarnings: typeof stats.totalEarnings === 'number' ? stats.totalEarnings : 0,
        currentMonthEarnings: typeof stats.currentMonthEarnings === 'number' ? stats.currentMonthEarnings : 0,
        avgDeliveryTime: typeof stats.avgDeliveryTime === 'number' ? stats.avgDeliveryTime : 0,
        successRate: typeof stats.successRate === 'number' ? stats.successRate : 0,
    };

    // ✅ NOUVEAU: Animation d'entrée
    const screenEnterStyle = useScreenEnter();

    useFocusEffect(
        useCallback(() => {
            // ✅ FIX 2026-03-03: Initialiser le service audio + polling pour nouvelles livraisons
            notificationSoundService.initialize().catch(console.error);
            loadData();

            // Polling toutes les 15 secondes pour détecter les nouvelles livraisons
            const interval = setInterval(() => {
                loadData();
            }, 15000);

            return () => {
                clearInterval(interval);
            };
        }, [])
    );

    const loadData = async () => {
        try {
            setLoading(true);
            // Charger les livraisons actives
            const deliveriesResponse = await deliveryApi.listActiveDeliveries();
            const deliveries = deliveriesResponse.data?.deliveries || deliveriesResponse.data || [];
            const deliveriesList = Array.isArray(deliveries) ? deliveries : [];
            setActiveDeliveries(deliveriesList);

            // ✅ FIX 2026-03-03: Notification sonore si nouvelle livraison détectée
            if (deliveriesList.length > lastDeliveryCount && lastDeliveryCount > 0) {
                notificationSoundService.playSoundWithVibration('delivery_request').catch(console.error);
            }
            setLastDeliveryCount(deliveriesList.length);

            // ✅ FIX 2026-03-05: Charger les stats réelles depuis l'API
            try {
                const statsResponse = await deliveryApi.getCourierStats() as any;
                if (statsResponse?.success && statsResponse?.data) {
                    const d = statsResponse.data;
                    setStats({
                        totalDeliveries: d.totalDeliveries ?? 0,
                        completedDeliveries: d.completedDeliveries ?? 0,
                        totalEarnings: d.totalEarnings ?? 0,
                        currentMonthEarnings: d.currentMonthEarnings ?? 0,
                        avgDeliveryTime: d.avgDeliveryTime ?? 0,
                        successRate: d.successRate ?? 0,
                    });
                }
            } catch (statsErr) {
                console.warn('[CourierDashboardScreen] Stats non disponibles:', statsErr);
            }
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
        const id = deliveryId != null ? String(deliveryId) : '';
        if (!id) return;
        navigation.navigate('DeliveryShoppingTracking' as never, { deliveryId: id } as never);
    };

    if (loading) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('common.loading', 'Chargement...')}</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <Animated.View style={[styles.animatedContainer, screenEnterStyle.style as any]}>
                <ScrollView
                    style={styles.scroll}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('courierDashboard.title', 'Tableau de bord coursier')}</Text>
                        <Text style={styles.subtitle}>{t('courierDashboard.subtitle', 'Suivez vos performances et livraisons')}</Text>
                    </View>

                    {/* ✅ NOUVEAU: Graphiques de statistiques animés */}
                    <CourierStatsChart
                        completedDeliveries={safeStats.completedDeliveries}
                        totalEarnings={safeStats.totalEarnings}
                        currentMonthEarnings={safeStats.currentMonthEarnings}
                        avgDeliveryTime={safeStats.avgDeliveryTime}
                        successRate={safeStats.successRate}
                    />

                    {/* ✅ PHASE 3: Sous-dashboard Livres Scolaires */}
                    <BookCourierSubDashboard onRefresh={handleRefresh} />

                    {/* Livraisons actives */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('courierDashboard.activeDeliveries', 'Livraisons actives')}</Text>
                        {loading && activeDeliveries.length === 0 ? (
                            <>
                                <SkeletonDeliveryCard />
                                <SkeletonDeliveryCard />
                            </>
                        ) : activeDeliveries.length === 0 ? (
                            <NativeCard style={styles.emptyCard}>
                                <SafeIcon name="package" size={48} color={modernColors.textSecondary} />
                                <Text style={styles.emptyText}>{t('courierDashboard.noActiveDeliveries', 'Aucune livraison active')}</Text>
                                <Text style={styles.emptySubtext}>
                                    {t('courierDashboard.newDeliveriesHere', 'Les nouvelles livraisons apparaîtront ici')}
                                </Text>
                            </NativeCard>
                        ) : (
                            activeDeliveries.map((delivery, index) => (
                                <TouchableOpacity
                                    key={delivery.id}
                                    onPress={() => handleOpenDelivery(delivery.id)}
                                    style={styles.deliveryCardWrapper}
                                >
                                    <NativeCard style={styles.deliveryCard}>
                                        <View style={styles.deliveryHeader}>
                                            <Text style={styles.deliveryId}>
                                                {t('courierDashboard.deliveryNum', 'Livraison')} #
                                                {delivery?.id != null ? String(delivery.id).slice(-6) : '—'}
                                            </Text>
                                            <Text style={styles.deliveryStatus}>{delivery.status}</Text>
                                        </View>
                                        <View style={styles.deliveryInfo}>
                                            <View style={styles.deliveryRow}>
                                                <SafeIcon name="map-pin" size={16} color={modernColors.textSecondary} />
                                                <Text style={styles.deliveryText}>
                                                    {delivery.pickup?.label || t('courierDashboard.pickup')}
                                                </Text>
                                            </View>
                                            <View style={styles.deliveryRow}>
                                                <SafeIcon name="navigation" size={16} color={modernColors.textSecondary} />
                                                <Text style={styles.deliveryText}>
                                                    {delivery.dropoff?.label || t('courierDashboard.dropoff')}
                                                </Text>
                                            </View>
                                        </View>
                                        {/* Bouton code de vérification pour le prestataire */}
                                        <TouchableOpacity
                                            style={styles.verificationCodeButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                (navigation as any).navigate('CourierVerificationCode', { deliveryId: delivery.id });
                                            }}
                                        >
                                            <SafeIcon name="shield" size={16} color={modernColors.primary} />
                                            <Text style={styles.verificationCodeButtonText}>{t('courierDashboard.myVerificationCode', 'Mon code de vérification')}</Text>
                                        </TouchableOpacity>
                                    </NativeCard>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>

                    {/* Actions rapides */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('courierDashboard.quickActions', 'Actions rapides')}</Text>
                        <NativeButton
                            title={`📊 ${t('courierDashboard.voirStatistiques')}`}
                            variant="outline"
                            onPress={() => {
                                Alert.alert(
                                    t('courierDashboard.detailedStats', 'Statistiques détaillées'),
                                    `${t('courierDashboard.livraisonsCompletees')}: ${safeStats.completedDeliveries}\n` +
                                    `${t('courierDashboard.tauxReussite')}: ${safeStats.successRate.toFixed(1)}%\n` +
                                    `${t('courierDashboard.tempsMoyen')}: ${safeStats.avgDeliveryTime.toFixed(0)} min\n` +
                                    `${t('courierDashboard.gainsTotaux')}: ${safeStats.totalEarnings.toFixed(0)} XAF\n` +
                                    `${t('courierDashboard.gainsCeMois')}: ${safeStats.currentMonthEarnings.toFixed(0)} XAF`,
                                    [{ text: t('common.ok') }]
                                );
                            }}
                        />
                        <NativeButton
                            title={`💰 ${t('courierDashboard.monPortefeuille')}`}
                            variant="outline"
                            onPress={() => {
                                (navigation as any).navigate('WalletFinancial');
                            }}
                        />
                    </View>
                </ScrollView>
            </Animated.View>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    animatedContainer: {
        flex: 1,
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
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    deliveryCardWrapper: {
        marginBottom: 12,
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
    verificationCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: modernColors.primary + '30',
    },
    verificationCodeButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default CourierDashboardScreen;

