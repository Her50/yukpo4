/**
 * Écran de gestion des crédits de tickets bus reportés
 * Permet de voir les crédits actifs, leur montant net, et de les utiliser pour un nouveau voyage
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import {
    formatCreditAmount,
    getUserCredits,
    TicketCredit,
} from '../../services/busTicketCreditService';

const COLORS = {
    primary: '#2563EB',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray900: '#111827',
    white: '#FFFFFF',
    orange: '#F97316',
};

export default function BusTicketCreditsScreen() {
    const { t } = useLanguageSafe();
    const navigation = useNavigation<any>();

    const [credits, setCredits] = useState<TicketCredit[]>([]);
    const [activeTotal, setActiveTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadCredits = useCallback(async () => {
        try {
            const result = await getUserCredits();
            if (result.success) {
                setCredits(result.credits || []);
                setActiveTotal(result.active_total || 0);
            }
        } catch (error) {
            console.error('Erreur chargement crédits:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadCredits();
    }, [loadCredits]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadCredits();
    }, [loadCredits]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return COLORS.success;
            case 'used': return COLORS.gray400;
            case 'expired': return COLORS.danger;
            case 'cancelled': return COLORS.gray500;
            default: return COLORS.gray400;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return t('busTicketCredits.actif');
            case 'used': return t('busTicketCredits.utilise');
            case 'expired': return t('busTicketCredits.expire');
            case 'cancelled': return t('busTicketCredits.annule');
            default: return status;
        }
    };

    const getReasonLabel = (reason: string) => {
        switch (reason) {
            case 'no_show': return t('busTicketCredits.nonPresentation');
            case 'user_request': return t('busTicketCredits.demandeUtilisateur');
            case 'cancelled_trip': return t('busTicketCredits.voyageAnnule');
            default: return reason;
        }
    };

    const handleUseCredit = (credit: TicketCredit) => {
        if (credit.status !== 'active') {
            Alert.alert(
                t('busTicketCredits.creditNonDisponible'),
                t('busTicketCredits.ceCreditNePeutPlusEtreUtilise')
            );
            return;
        }

        if (credit.days_until_expiry <= 0) {
            Alert.alert(
                t('busTicketCredits.creditExpire'),
                t('busTicketCredits.ceCreditAExpire')
            );
            return;
        }

        // Naviguer vers la recherche de bus avec le crédit pré-sélectionné
        navigation.navigate('AgenceVoyageSearch', {
            creditId: credit.credit_id,
            creditAmount: credit.net_credit_amount,
            fromCredits: true,
        });
    };

    const renderCreditCard = ({ item }: { item: TicketCredit }) => {
        const isActive = item.status === 'active' && item.days_until_expiry > 0;
        const isExpiringSoon = item.days_until_expiry > 0 && item.days_until_expiry <= 30;

        return (
            <View style={[styles.creditCard, !isActive && styles.creditCardInactive]}>
                {/* En-tête */}
                <View style={styles.cardHeader}>
                    <View style={styles.routeContainer}>
                        <Text style={styles.cityText}>{item.original_departure_city}</Text>
                        <Ionicons name="arrow-forward" size={16} color={COLORS.gray400} />
                        <Text style={styles.cityText}>{item.original_arrival_city}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {getStatusLabel(item.status)}
                        </Text>
                    </View>
                </View>

                {/* Montants */}
                <View style={styles.amountsContainer}>
                    <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>{t('busTicketCredits.montantOriginal')}</Text>
                        <Text style={styles.amountValueStriked}>
                            {formatCreditAmount(item.original_amount)}
                        </Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>
                            {t('busTicketCredits.penalite')} ({item.penalty_percentage}%)
                        </Text>
                        <Text style={[styles.amountValue, { color: COLORS.danger }]}>
                            -{formatCreditAmount(item.penalty_amount)}
                        </Text>
                    </View>
                    <View style={[styles.amountRow, styles.amountRowTotal]}>
                        <Text style={styles.amountLabelBold}>{t('busTicketCredits.creditNet')}</Text>
                        <Text style={styles.amountValueBold}>
                            {formatCreditAmount(item.net_credit_amount)}
                        </Text>
                    </View>
                </View>

                {/* Détails */}
                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.gray500} />
                        <Text style={styles.detailText}>
                            {t('busTicketCredits.voyageDu')} {item.original_departure_date} {t('busTicketCredits.a')} {item.original_departure_time}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="information-circle-outline" size={14} color={COLORS.gray500} />
                        <Text style={styles.detailText}>{getReasonLabel(item.reason)}</Text>
                    </View>
                    {isActive && (
                        <View style={styles.detailRow}>
                            <Ionicons
                                name="time-outline"
                                size={14}
                                color={isExpiringSoon ? COLORS.warning : COLORS.gray500}
                            />
                            <Text style={[
                                styles.detailText,
                                isExpiringSoon && { color: COLORS.warning, fontWeight: '600' }
                            ]}>
                                {t('busTicketCredits.expireDans')} {item.days_until_expiry} {t('busTicketCredits.jours')}
                            </Text>
                        </View>
                    )}
                    {item.status === 'used' && item.supplement_amount && item.supplement_amount > 0 && (
                        <View style={styles.detailRow}>
                            <Ionicons name="add-circle-outline" size={14} color={COLORS.orange} />
                            <Text style={styles.detailText}>
                                {t('busTicketCredits.supplementPaye')}: {formatCreditAmount(item.supplement_amount)}
                            </Text>
                        </View>
                    )}
                    {item.status === 'used' && item.refund_amount && item.refund_amount > 0 && (
                        <View style={styles.detailRow}>
                            <Ionicons name="return-down-back-outline" size={14} color={COLORS.success} />
                            <Text style={styles.detailText}>
                                {t('busTicketCredits.excedentRestitue')}: {formatCreditAmount(item.refund_amount)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Bouton utiliser */}
                {isActive && (
                    <TouchableOpacity
                        style={styles.useButton}
                        onPress={() => handleUseCredit(item)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="swap-horizontal" size={18} color={COLORS.white} />
                        <Text style={styles.useButtonText}>
                            {t('busTicketCredits.utiliserPourUnNouveauVoyage')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="ticket-outline" size={64} color={COLORS.gray400} />
            <Text style={styles.emptyTitle}>{t('busTicketCredits.aucunCredit')}</Text>
            <Text style={styles.emptySubtitle}>
                {t('busTicketCredits.vousNavezPasDeCreditsDeTickets')}
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Résumé */}
            {activeTotal > 0 && (
                <View style={styles.summaryCard}>
                    <View style={styles.summaryContent}>
                        <Text style={styles.summaryLabel}>{t('busTicketCredits.creditsTotauxActifs')}</Text>
                        <Text style={styles.summaryAmount}>{formatCreditAmount(activeTotal)}</Text>
                    </View>
                    <Ionicons name="wallet" size={32} color={COLORS.primary} />
                </View>
            )}

            {/* Liste des crédits */}
            <FlatList
                data={credits}
                keyExtractor={(item) => item.credit_id}
                renderItem={renderCreditCard}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.gray100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.gray100,
    },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        padding: 20,
        borderRadius: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    summaryContent: {
        flex: 1,
    },
    summaryLabel: {
        fontSize: 14,
        color: COLORS.gray500,
        marginBottom: 4,
    },
    summaryAmount: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.primary,
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    creditCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
    },
    creditCardInactive: {
        opacity: 0.7,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    routeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    cityText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.gray900,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    amountsContainer: {
        backgroundColor: COLORS.gray100,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    amountRowTotal: {
        borderTopWidth: 1,
        borderTopColor: COLORS.gray200,
        marginTop: 6,
        paddingTop: 8,
    },
    amountLabel: {
        fontSize: 13,
        color: COLORS.gray500,
    },
    amountLabelBold: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.gray700,
    },
    amountValue: {
        fontSize: 13,
        color: COLORS.gray600,
    },
    amountValueStriked: {
        fontSize: 13,
        color: COLORS.gray400,
        textDecorationLine: 'line-through',
    },
    amountValueBold: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    detailsContainer: {
        gap: 6,
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 13,
        color: COLORS.gray500,
    },
    useButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 12,
    },
    useButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.white,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.gray700,
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: COLORS.gray500,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
});
