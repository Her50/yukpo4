/**
 * Écran réservations covoiturage — filtré + assurance + rappels de trajet
 */

import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import MobileMoneyPaymentModal from '../../components/MobileMoneyPaymentModal';
import PostTripRatingModal from '../../components/PostTripRatingModal';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPatch, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface CovoiturageReservation {
    id: number;
    service_id: number;
    service_type: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    reservation_date: string | null;
    reservation_time: string | null;
    amount: number | null;
    currency: string | null;
    payment_status: string | null;
    insurance_included: boolean;
    insurance_coverage_amount: number | null;
    created_at: string;
    details: any;
}

const STATUS_COLORS: Record<string, string> = {
    pending: '#F59E0B',
    confirmed: '#10B981',
    completed: '#6366F1',
    cancelled: '#EF4444',
};

const COVERAGE_LABELS: Record<string, { label: string; amount: string; price: number }> = {
    basic: { label: 'Couverture de base', amount: '50 000 XAF', price: 500 },
    premium: { label: 'Couverture premium', amount: '200 000 XAF', price: 1500 },
    full: { label: 'Couverture complète', amount: '500 000 XAF', price: 3000 },
};

const MesReservationsCovoiturageScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [reservations, setReservations] = useState<CovoiturageReservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [paymentModal, setPaymentModal] = useState<{ reservationId: number; amount: number } | null>(null);
    const [ratingModal, setRatingModal] = useState<{ reservationId: number; ratedUserId: number } | null>(null);

    const loadReservations = useCallback(async () => {
        try {
            const params = statusFilter ? `?status=${statusFilter}&service_type=covoiturage` : '?service_type=covoiturage';
            const response = await apiGet(`/api/specialized-services/reservations${params}`);
            const resData = (response?.data || response) as any;
            if (resData?.success) {
                const all: CovoiturageReservation[] = resData.reservations || [];
                // Filtre côté client en sécurité
                setReservations(all.filter((r) => r.service_type === 'covoiturage'));
            }
        } catch (err: any) {
            console.error('[MesReservationsCovoiturageScreen] Erreur:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadReservations();
    }, [loadReservations]);

    const handleCancel = async (id: number) => {
        Alert.alert('Annuler le trajet', 'Voulez-vous vraiment annuler cette réservation ?', [
            { text: 'Non', style: 'cancel' },
            {
                text: 'Oui, annuler',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiPatch(`/api/specialized-services/reservations/${id}/cancel`, {
                            reason: 'Annulé par le client',
                        });
                        loadReservations();
                    } catch {
                        Alert.alert('Erreur', "Impossible d'annuler la réservation.");
                    }
                },
            },
        ]);
    };

    const handleSubscribeInsurance = (reservation: CovoiturageReservation) => {
        if (reservation.insurance_included) {
            Alert.alert(
                'Assurance active',
                `Couverture : ${reservation.insurance_coverage_amount?.toLocaleString()} XAF`,
            );
            return;
        }

        Alert.alert(
            'Souscrire une assurance',
            'Choisissez votre niveau de couverture :',
            [
                {
                    text: `Basique — 50 000 XAF (500 XAF)`,
                    onPress: () => subscribeInsurance(reservation.id, 'basic'),
                },
                {
                    text: `Premium — 200 000 XAF (1 500 XAF)`,
                    onPress: () => subscribeInsurance(reservation.id, 'premium'),
                },
                {
                    text: `Complète — 500 000 XAF (3 000 XAF)`,
                    onPress: () => subscribeInsurance(reservation.id, 'full'),
                },
                { text: 'Annuler', style: 'cancel' },
            ],
        );
    };

    const subscribeInsurance = async (reservationId: number, coverageType: string) => {
        try {
            const res = await apiPost(`/api/reservations/${reservationId}/insurance`, {
                coverage_type: coverageType,
            });
            const data = (res?.data || res) as any;
            if (data?.success) {
                Alert.alert('Assurance souscrite', data.message || 'Assurance activée avec succès.');
                loadReservations();
            }
        } catch (err: any) {
            Alert.alert('Erreur', err?.message || "Impossible de souscrire l'assurance.");
        }
    };

    const handleScheduleReminders = async (reservation: CovoiturageReservation) => {
        try {
            const res = await apiPost(`/api/reservations/${reservation.id}/schedule-notifications`, {
                reminder_minutes_before: [60, 15],
            });
            const data = (res?.data || res) as any;
            if (data?.success) {
                Alert.alert(
                    'Rappels programmés',
                    `${data.scheduled_count} rappel(s) programmé(s) : 60 min et 15 min avant le départ.`,
                );
            }
        } catch {
            Alert.alert('Erreur', 'Impossible de programmer les rappels.');
        }
    };

    const renderItem = ({ item }: { item: CovoiturageReservation }) => {
        const statusColor = STATUS_COLORS[item.status] || modernColors.textSecondary;
        const isActive = item.status === 'pending' || item.status === 'confirmed';

        return (
            <NativeCard style={styles.card}>
                {/* En-tête */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <SafeIcon name="car" size={18} color={modernColors.primary} />
                        <Text style={styles.serviceLabel}>Covoiturage</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* Infos trajet */}
                <View style={styles.infoRow}>
                    <SafeIcon name="calendar" size={14} color={modernColors.textSecondary} />
                    <Text style={styles.infoText}>
                        {item.reservation_date
                            ? new Date(item.reservation_date).toLocaleDateString('fr-FR')
                            : 'Date à confirmer'}
                        {item.reservation_time ? ` à ${item.reservation_time}` : ''}
                    </Text>
                </View>

                {item.amount != null && (
                    <View style={styles.infoRow}>
                        <SafeIcon name="dollar-sign" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.infoText}>
                            {item.amount.toLocaleString()} {item.currency || 'XAF'}
                            {item.payment_status === 'paid' ? ' — Payé ✓' : ' — Non payé'}
                        </Text>
                    </View>
                )}

                {/* Bouton payer si non payé */}
                {item.amount != null && item.payment_status !== 'paid' && isActive && (
                    <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() => setPaymentModal({ reservationId: item.id, amount: item.amount! })}
                    >
                        <SafeIcon name="credit-card" size={14} color="#fff" />
                        <Text style={styles.payBtnText}>
                            Payer {item.amount.toLocaleString()} {item.currency || 'XAF'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Bouton noter si trajet terminé */}
                {item.status === 'completed' && (
                    <TouchableOpacity
                        style={styles.rateBtn}
                        onPress={() => setRatingModal({
                            reservationId: item.id,
                            ratedUserId: (item.details as any)?.driver_user_id || 0,
                        })}
                    >
                        <SafeIcon name="star" size={14} color="#F59E0B" />
                        <Text style={styles.rateBtnText}>Noter ce trajet</Text>
                    </TouchableOpacity>
                )}

                {/* Badge assurance */}
                {item.insurance_included ? (
                    <View style={styles.insuranceBadge}>
                        <SafeIcon name="shield" size={13} color="#10B981" />
                        <Text style={styles.insuranceBadgeText}>
                            Assuré — {item.insurance_coverage_amount?.toLocaleString()} XAF
                        </Text>
                    </View>
                ) : isActive ? (
                    <TouchableOpacity
                        style={styles.insuranceButton}
                        onPress={() => handleSubscribeInsurance(item)}
                    >
                        <SafeIcon name="shield" size={13} color="#6366F1" />
                        <Text style={styles.insuranceButtonText}>Souscrire une assurance</Text>
                    </TouchableOpacity>
                ) : null}

                {/* Actions */}
                {isActive && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={styles.reminderBtn}
                            onPress={() => handleScheduleReminders(item)}
                        >
                            <SafeIcon name="bell" size={14} color={modernColors.primary} />
                            <Text style={styles.reminderBtnText}>Rappels</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => handleCancel(item.id)}
                        >
                            <Text style={styles.cancelBtnText}>Annuler</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </NativeCard>
        );
    };

    const filters = [null, 'pending', 'confirmed', 'completed', 'cancelled'];
    const filterLabels: Record<string, string> = {
        null: 'Tous',
        pending: 'En attente',
        confirmed: 'Confirmés',
        completed: 'Terminés',
        cancelled: 'Annulés',
    };

    return (
        <View style={styles.container}>
            {/* Filtre statut */}
            <View style={styles.filterRow}>
                {filters.map((f) => (
                    <TouchableOpacity
                        key={String(f)}
                        style={[
                            styles.filterChip,
                            statusFilter === f && styles.filterChipActive,
                        ]}
                        onPress={() => setStatusFilter(f)}
                    >
                        <Text
                            style={[
                                styles.filterChipText,
                                statusFilter === f && styles.filterChipTextActive,
                            ]}
                        >
                            {filterLabels[String(f)]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Raccourcis KYC + Fidélité */}
            <View style={styles.shortcutsRow}>
                <TouchableOpacity
                    style={styles.shortcutBtn}
                    onPress={() => navigation.navigate('DriverVerification' as never, { serviceType: 'covoiturage' } as never)}
                >
                    <SafeIcon name="shield-check" size={16} color="#6366F1" />
                    <Text style={styles.shortcutText}>Vérification conducteur</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.shortcutBtn, { borderColor: '#D97706' }]}
                    onPress={() => navigation.navigate('Loyalty' as never)}
                >
                    <SafeIcon name="star" size={16} color="#D97706" />
                    <Text style={[styles.shortcutText, { color: '#D97706' }]}>Mes points fidélité</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={modernColors.primary} style={{ marginTop: 40 }} />
            ) : reservations.length === 0 ? (
                <View style={styles.empty}>
                    <SafeIcon name="car" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucune réservation de covoiturage</Text>
                </View>
            ) : (
                <FlatList
                    data={reservations}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadReservations();
                            }}
                        />
                    }
                    contentContainerStyle={styles.list}
                />
            )}

            {paymentModal && (
                <MobileMoneyPaymentModal
                    visible={!!paymentModal}
                    onClose={() => setPaymentModal(null)}
                    onSuccess={() => { setPaymentModal(null); loadReservations(); }}
                    amount={paymentModal.amount}
                    reservationId={paymentModal.reservationId}
                />
            )}

            {ratingModal && (
                <PostTripRatingModal
                    visible={!!ratingModal}
                    onClose={() => setRatingModal(null)}
                    onRated={() => { setRatingModal(null); loadReservations(); }}
                    reservationId={ratingModal.reservationId}
                    ratedUserId={ratingModal.ratedUserId}
                    serviceType="covoiturage"
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: modernColors.background },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 6,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: {
        backgroundColor: modernColors.primary + '20',
        borderColor: modernColors.primary,
    },
    filterChipText: { fontSize: 12, color: modernColors.textSecondary },
    filterChipTextActive: { color: modernColors.primary, fontWeight: '600' },
    list: { padding: 12, gap: 10 },
    card: { marginBottom: 10 },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    serviceLabel: { fontSize: 14, fontWeight: '600', color: modernColors.text },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    statusText: { fontSize: 10, fontWeight: '700' },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    infoText: { fontSize: 13, color: modernColors.textSecondary },
    insuranceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 6,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    insuranceBadgeText: { fontSize: 12, color: '#065F46', fontWeight: '500' },
    insuranceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#6366F1',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    insuranceButtonText: { fontSize: 12, color: '#6366F1', fontWeight: '500' },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        gap: 8,
    },
    reminderBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    reminderBtnText: { fontSize: 13, color: modernColors.primary, fontWeight: '500' },
    cancelBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
    },
    cancelBtnText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },
    payBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
        backgroundColor: '#10B981', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
        alignSelf: 'stretch',
    },
    payBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
    rateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
        borderWidth: 1, borderColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
        alignSelf: 'flex-start',
    },
    rateBtnText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
    shortcutsRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    shortcutBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#6366F1',
        backgroundColor: '#F5F3FF',
    },
    shortcutText: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 16, color: modernColors.textSecondary },
});

export default MesReservationsCovoiturageScreen;
