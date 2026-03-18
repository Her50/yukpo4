// ✅ Phase 4: Écran Analytics pour prestataires Pharmacies
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { PharmacyAnalytics, pharmacyService } from '../../services/pharmacyService';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const { width } = Dimensions.get('window');

interface PharmacyAnalyticsScreenParams {
    pharmacyId: number;
}

const PharmacyAnalyticsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as PharmacyAnalyticsScreenParams;

    const [analytics, setAnalytics] = useState<PharmacyAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    // ✅ Vérification propriétaire au chargement
    useEffect(() => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir les analytics');
            navigation.goBack();
            return;
        }

        if (params?.pharmacyId) {
            checkOwnership();
        }
    }, [user, params?.pharmacyId]);

    // ✅ Charger analytics après vérification propriétaire
    useEffect(() => {
        if (isAuthorized === true && params?.pharmacyId) {
            loadAnalytics();
        }
    }, [isAuthorized, selectedPeriod]);

    // ✅ Vérifier que l'utilisateur est propriétaire
    const checkOwnership = async () => {
        try {
            const response = await pharmacyService.getPharmacyDetails(params.pharmacyId);
            if (response.success && response.data) {
                const pharmacy = response.data;
                const isOwner = user && String(user.id) === String(pharmacy.user_id);
                setIsAuthorized(isOwner);

                if (!isOwner) {
                    Alert.alert(
                        t('pharmacyAnalyticsScreen.accesRefuse'),
                        t('pharmacyAnalyticsScreen.vousNetesPasAutoriseAVoirLesAnalytics'),
                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                }
            } else {
                Alert.alert(t('message.error') || 'Erreur', t('pharmacyAnalyticsScreen.impossibleDeVerifierLesPermissions'));
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[PharmacyAnalyticsScreen] Erreur vérification propriétaire:', error);
            Alert.alert(t('message.error') || 'Erreur', t('pharmacyAnalyticsScreen.impossibleDeVerifierLesPermissions'));
            navigation.goBack();
        }
    };

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            const response = await pharmacyService.getAnalytics(params.pharmacyId);

            if (response.success && response.data) {
                setAnalytics(response.data.analytics);
            } else {
                Alert.alert(t('message.error') || 'Erreur', response.error || (t('pharmacyAnalytics.impossibleCharger') || 'Impossible de charger les analytics'));
            }
        } catch (error: any) {
            console.error('[PharmacyAnalyticsScreen] Erreur:', error);
            Alert.alert(t('message.error') || 'Erreur', error.message || (t('pharmacyAnalytics.impossibleCharger') || 'Impossible de charger les analytics'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadAnalytics();
    };

    const formatNumber = (num: number | null) => {
        if (num === null || num === undefined) return 'N/A';
        return num.toLocaleString('fr-FR');
    };

    const formatCurrency = (amount: string | null) => {
        if (!amount) return 'N/A';
        try {
            const num = parseFloat(amount);
            return `${num.toLocaleString('fr-FR')} XAF`;
        } catch {
            return amount;
        }
    };

    // Composant StatCard
    const StatCard = ({ icon, title, value, subtitle, color = modernColors.primary }: any) => (
        <NativeCard style={styles.statCard}>
            <View style={styles.statCardHeader}>
                <SafeIcon name={icon} size={24} color={color} />
                <Text style={styles.statCardTitle}>{title}</Text>
            </View>
            <Text style={[styles.statCardValue, { color }]}>{value}</Text>
            {subtitle && <Text style={styles.statCardSubtitle}>{subtitle}</Text>}
        </NativeCard>
    );

    // ✅ Afficher loading pendant vérification propriétaire
    if (isAuthorized === null || (loading && !analytics)) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>
                    {isAuthorized === null ? (t('pharmacyAnalytics.verificationPermissions') || 'Vérification des permissions...') : (t('pharmacyAnalytics.chargementAnalytics') || 'Chargement des analytics...')}
                </Text>
            </View>
        );
    }

    // ✅ Si non autorisé, ne rien afficher (déjà redirigé)
    if (isAuthorized === false) {
        return null;
    }

    if (!analytics) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{t('pharmacyAnalytics.nonDisponibles') || 'Analytics non disponibles'}</Text>
                <NativeButton
                    title={t('pharmacyAnalytics.reessayer')}
                    onPress={loadAnalytics}
                    variant="primary"
                    style={styles.retryButton}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('pharmacyAnalytics.titre') || 'Analytics Pharmacie'}</Text>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[modernColors.primary]}
                    />
                }
            >
                {/* Sélecteur de période */}
                <View style={styles.periodSelector}>
                    <TouchableOpacity
                        style={[
                            styles.periodButton,
                            selectedPeriod === '7d' && styles.periodButtonActive,
                        ]}
                        onPress={() => setSelectedPeriod('7d')}
                    >
                        <Text
                            style={[
                                styles.periodButtonText,
                                selectedPeriod === '7d' && styles.periodButtonTextActive,
                            ]}
                        >
                            7j
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.periodButton,
                            selectedPeriod === '30d' && styles.periodButtonActive,
                        ]}
                        onPress={() => setSelectedPeriod('30d')}
                    >
                        <Text
                            style={[
                                styles.periodButtonText,
                                selectedPeriod === '30d' && styles.periodButtonTextActive,
                            ]}
                        >
                            30j
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.periodButton,
                            selectedPeriod === '90d' && styles.periodButtonActive,
                        ]}
                        onPress={() => setSelectedPeriod('90d')}
                    >
                        <Text
                            style={[
                                styles.periodButtonText,
                                selectedPeriod === '90d' && styles.periodButtonTextActive,
                            ]}
                        >
                            90j
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Statistiques principales */}
                <View style={styles.statsGrid}>
                    <StatCard
                        icon="shopping-cart"
                        title={t('pharmacyAnalytics.totalCommandes') || 'Total commandes'}
                        value={formatNumber(analytics.total_orders)}
                        color={modernColors.primary}
                    />
                    <StatCard
                        icon="calendar"
                        title={t('pharmacyAnalytics.commandes7j') || 'Commandes (7j)'}
                        value={formatNumber(analytics.orders_7d)}
                        color={modernColors.info}
                    />
                    <StatCard
                        icon="calendar"
                        title={t('pharmacyAnalytics.commandes30j') || 'Commandes (30j)'}
                        value={formatNumber(analytics.orders_30d)}
                        color={modernColors.success}
                    />
                </View>

                {/* Statistiques de revenus */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>{t('pharmacyAnalytics.revenus')}</Text>
                    <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>{t('pharmacyAnalytics.revenuTotal')}</Text>
                        <Text style={[styles.detailsValue, styles.revenueValue]}>
                            {formatCurrency(analytics.total_revenue)}
                        </Text>
                    </View>
                    <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Valeur moyenne commande:</Text>
                        <Text style={styles.detailsValue}>
                            {formatCurrency(analytics.avg_order_value)}
                        </Text>
                    </View>
                </NativeCard>

                {/* Résumé */}
                <NativeCard style={styles.card}>
                    <View style={styles.summaryHeader}>
                        <SafeIcon name="bar-chart" size={24} color={modernColors.primary} />
                        <Text style={styles.cardTitle}>{t('pharmacyAnalytics.resumeDeLaPeriode')}</Text>
                    </View>
                    <Text style={styles.summaryText}>
                        Vous avez reçu {formatNumber(analytics.orders_7d)} commandes au cours des 7 derniers jours
                        et {formatNumber(analytics.orders_30d)} au cours des 30 derniers jours.
                        Votre revenu total est de {formatCurrency(analytics.total_revenue)} avec une valeur moyenne par commande de{' '}
                        {formatCurrency(analytics.avg_order_value)}.
                    </Text>
                </NativeCard>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
        marginBottom: 16,
    },
    retryButton: {
        marginTop: 16,
    },
    periodSelector: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
        padding: 8,
        borderRadius: 8,
    },
    periodButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    periodButtonActive: {
        backgroundColor: modernColors.primary,
    },
    periodButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    periodButtonTextActive: {
        color: '#FFFFFF',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        minWidth: (width - 48) / 2,
        padding: 16,
    },
    statCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    statCardTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        flex: 1,
    },
    statCardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statCardSubtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    card: {
        marginBottom: 16,
        padding: 20,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 16,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    detailsLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        flex: 1,
    },
    detailsValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    revenueValue: {
        color: modernColors.success,
        fontSize: 16,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    summaryText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 22,
    },
});

export default PharmacyAnalyticsScreen;
