// ✅ NOUVEAU: Écran de gestion des réservations pour prestataire

import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPatch } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Reservation {
    id: number;
    service_id: number;
    service_type: string;
    user_id: number;
    reservation_type: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    requested_date: string | null;
    confirmed_date: string | null;
    amount: number | null;
    currency: string | null;
    payment_status: string | null;
    created_at: string;
    details: any;
    notes: string | null;
}

const PrestataireReservationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { user } = useAuth();
        const { t } = useLanguageSafe();
const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    useEffect(() => {
        loadReservations();
    }, [statusFilter]);

    const loadReservations = async () => {
        try {
            const params = statusFilter ? `?status=${statusFilter}` : '';
            const response = await apiGet(`/api/specialized-services/reservations/prestataire${params}`);

            const resData = (response?.data || response) as any;
            if (resData.success) {
                setReservations(resData.reservations || []);
            }
        } catch (error: any) {
            console.error('[PrestataireReservationsScreen] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleConfirm = async (reservationId: number) => {
        try {
            const response = await apiPatch(
                `/api/specialized-services/reservations/${reservationId}/confirm`,
                {}
            );

            const confirmData = (response?.data || response) as any;
            if (confirmData.success) {
                Alert.alert('Succès', 'Réservation confirmée');
                loadReservations();
            } else {
                Alert.alert('Erreur', confirmData.error || 'Impossible de confirmer');
            }
        } catch (error: any) {
            console.error('[PrestataireReservationsScreen] Erreur confirmation:', error);
            Alert.alert('Erreur', 'Une erreur est survenue');
        }
    };

    const handleComplete = async (reservationId: number) => {
        Alert.alert(
            t('prestataireReservationsScreen.marquerCommeTerminee'),
            t('prestataireReservationsScreen.etesvousSurQueCetteReservationEst'),
            [
                { text: t('common.no'), style: 'cancel' },
                {
                    text: t('common.yes'),
                    onPress: async () => {
                        // TODO: Implémenter endpoint pour compléter
                        Alert.alert('Info', 'Fonctionnalité à venir');
                    },
                },
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return modernColors.success;
            case 'pending':
                return modernColors.warning;
            case 'completed':
                return modernColors.primary;
            case 'cancelled':
                return modernColors.error;
            default:
                return modernColors.textSecondary;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending':
                return 'En attente';
            case 'confirmed':
                return t('prestataireReservationsScreen.confirmee');
            case 'completed':
                return t('prestataireReservationsScreen.terminee');
            case 'cancelled':
                return t('prestataireReservationsScreen.annulee');
            default:
                return status;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return t('prestataireReservationsScreen.nonSpecifie');
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const renderReservation = ({ item }: { item: Reservation }) => (
        <NativeCard style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.serviceType}>{item.service_type.toUpperCase()}</Text>
                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) + '20' },
                    ]}
                >
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>

            <Text style={styles.dateLabel}>{t('prestataireReservations.dateDemandee')}</Text>
            <Text style={styles.date}>{formatDate(item.requested_date)}</Text>

            {item.confirmed_date && (
                <>
                    <Text style={styles.dateLabel}>{t('prestataireReservations.dateConfirmee')}</Text>
                    <Text style={styles.date}>{formatDate(item.confirmed_date)}</Text>
                </>
            )}

            {item.notes && (
                <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>{t('prestataireReservations.notesClient')}</Text>
                    <Text style={styles.notes}>{item.notes}</Text>
                </View>
            )}

            <View style={styles.actions}>
                {item.status === 'pending' && (
                    <>
                        <NativeButton
                            title={t('prestataireReservationsScreen.confirmer')}
                            variant="primary"
                            onPress={() => handleConfirm(item.id)}
                            style={styles.actionButton}
                        />
                        <NativeButton
                            title="Refuser"
                            variant="secondary"
                            onPress={() => Alert.alert('Info', 'Fonctionnalité à venir')}
                            style={styles.actionButton}
                        />
                    </>
                )}

                {item.status === 'confirmed' && (
                    <NativeButton
                        title={t('prestataireReservations.marquerCommeTerminee')}
                        variant="primary"
                        onPress={() => handleComplete(item.id)}
                        style={styles.actionButton}
                    />
                )}

                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('ServiceDetailSpecialized', {
                            serviceId: item.service_id,
                        })
                    }
                >
                    <Text style={styles.detailLink}>{t('prestataireReservations.voirLeService')}</Text>
                </TouchableOpacity>
            </View>
        </NativeCard>
    );

    if (loading && reservations.length === 0) {
        return (
            <View style={styles.center}>
                <Text>{t('prestataireReservations.chargement')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.filters}>
                <TouchableOpacity
                    style={[styles.filterButton, statusFilter === null && styles.filterActive]}
                    onPress={() => setStatusFilter(null)}
                >
                    <Text style={styles.filterText}>Toutes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, statusFilter === 'pending' && styles.filterActive]}
                    onPress={() => setStatusFilter('pending')}
                >
                    <Text style={styles.filterText}>{t('prestataireReservations.enAttente')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'confirmed' && styles.filterActive,
                    ]}
                    onPress={() => setStatusFilter('confirmed')}
                >
                    <Text style={styles.filterText}>{t('prestataireReservations.confirmees')}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={reservations}
                renderItem={renderReservation}
                keyExtractor={(item) => item.id.toString()}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={loadReservations} />
                }
                ListEmptyComponent={
                    <View style={styles.center}>
                        <SafeIcon name="calendar" size={48} color={modernColors.textSecondary} />
                        <Text style={styles.emptyText}>{t('prestataireReservations.aucuneReservation')}</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    filters: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
    },
    filterActive: {
        backgroundColor: modernColors.primary,
    },
    filterText: {
        color: modernColors.text,
        fontWeight: '600',
    },
    card: {
        margin: 16,
        marginBottom: 8,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    serviceType: {
        fontSize: 14,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    dateLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 8,
    },
    date: {
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 4,
    },
    notesContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
    },
    notesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    notes: {
        fontSize: 14,
        color: modernColors.text,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    actionButton: {
        flex: 1,
        minWidth: 120,
    },
    detailLink: {
        color: modernColors.primary,
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        marginTop: 16,
    },
});

export default PrestataireReservationsScreen;

