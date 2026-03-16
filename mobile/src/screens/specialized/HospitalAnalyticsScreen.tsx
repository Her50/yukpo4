// ✅ Phase 4: Écran Analytics pour prestataires Hôpitaux
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface HospitalAnalyticsScreenParams {
    hospitalId: number;
}

interface HospitalAnalytics {
    total_appointments: number;
    completed_appointments: number;
    pending_appointments: number;
    cancelled_appointments: number;
    total_revenue: number;
    average_wait_time: number;
    patient_satisfaction: number;
    top_services: Array<{ name: string; count: number }>;
}

const HospitalAnalyticsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as HospitalAnalyticsScreenParams;

    const [analytics, setAnalytics] = useState<HospitalAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir les analytics');
            navigation.goBack();
            return;
        }
        if (params?.hospitalId) {
            loadAnalytics();
        }
    }, [user, params?.hospitalId]);

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/hopitaux/${params.hospitalId}/analytics`);
            const resData = (response?.data || response) as any;

            if (resData?.success || resData?.analytics) {
                setAnalytics(resData.analytics || resData.data || resData);
            } else {
                Alert.alert('Info', 'Les analytics ne sont pas encore disponibles pour cet hôpital.');
            }
        } catch (error: any) {
            console.error('[HospitalAnalyticsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les analytics');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadAnalytics();
    };

    const formatNumber = (num: number | null | undefined) => {
        if (num === null || num === undefined) return 'N/A';
        return num.toLocaleString('fr-FR');
    };

    const StatCard = ({ icon, title, value, color = modernColors.primary }: any) => (
        <NativeCard style={styles.statCard}>
            <View style={styles.statCardHeader}>
                <SafeIcon name={icon} size={24} color={color} />
                <Text style={styles.statCardTitle}>{title}</Text>
            </View>
            <Text style={[styles.statCardValue, { color }]}>{value}</Text>
        </NativeCard>
    );

    if (loading && !analytics) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('hospitalAnalytics.chargementDesAnalytics')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('hospitalAnalytics.analyticsHopital')}</Text>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[modernColors.primary]} />
                }
            >
                {analytics ? (
                    <>
                        <View style={styles.statsGrid}>
                            <StatCard icon="calendar" title="Total RDV" value={formatNumber(analytics.total_appointments)} color={modernColors.primary} />
                            <StatCard icon="check-circle" title={t('hospitalAnalytics.completes')} value={formatNumber(analytics.completed_appointments)} color="#10B981" />
                            <StatCard icon="clock" title="En attente" value={formatNumber(analytics.pending_appointments)} color="#F59E0B" />
                            <StatCard icon="x-circle" title={t('hospitalAnalytics.annules')} value={formatNumber(analytics.cancelled_appointments)} color="#EF4444" />
                        </View>

                        <NativeCard style={styles.revenueCard}>
                            <Text style={styles.revenueTitle}>Revenus</Text>
                            <Text style={styles.revenueValue}>{formatNumber(analytics.total_revenue)} FCFA</Text>
                        </NativeCard>

                        {analytics.top_services && analytics.top_services.length > 0 && (
                            <NativeCard style={styles.topServicesCard}>
                                <Text style={styles.sectionTitle}>{t('hospitalAnalytics.servicesLesPlusDemandes')}</Text>
                                {analytics.top_services.map((service, index) => (
                                    <View key={index} style={styles.serviceRow}>
                                        <Text style={styles.serviceName}>{service.name}</Text>
                                        <Text style={styles.serviceCount}>{service.count}</Text>
                                    </View>
                                ))}
                            </NativeCard>
                        )}
                    </>
                ) : (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="bar-chart-2" size={64} color="#D1D5DB" />
                        <Text style={styles.emptyText}>{t('hospitalAnalytics.lesAnalyticsSerontDisponiblesApres')}</Text>
                        <NativeButton title={t('hospitalAnalytics.actualiser')} onPress={loadAnalytics} variant="primary" style={styles.retryButton} />
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backButton: { marginRight: 12 },
    title: { fontSize: 18, fontWeight: '700', color: '#111827' },
    content: { flex: 1 },
    contentContainer: { padding: 16 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    statCard: { width: '47%', padding: 16 },
    statCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    statCardTitle: { fontSize: 12, color: '#6B7280', marginLeft: 8, flex: 1 },
    statCardValue: { fontSize: 24, fontWeight: '700' },
    revenueCard: { padding: 20, alignItems: 'center', marginBottom: 16 },
    revenueTitle: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
    revenueValue: { fontSize: 28, fontWeight: '800', color: modernColors.primary },
    topServicesCard: { padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    serviceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    serviceName: { fontSize: 14, color: '#374151' },
    serviceCount: { fontSize: 14, fontWeight: '600', color: modernColors.primary },
    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 16, marginBottom: 20 },
    retryButton: { minWidth: 120 },
});

export default HospitalAnalyticsScreen;
