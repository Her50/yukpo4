// ✅ NOUVEAU: Écran de liste des réservations de l'utilisateur

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

interface Reservation {
    id: number;
    service_id: number;
    service_type: string;
    reservation_type: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    requested_date: string | null;
    confirmed_date: string | null;
    amount: number | null;
    currency: string | null;
    payment_status: string | null;
    created_at: string;
    details: any;
}

const MesReservationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { user } = useAuth();
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
            const response = await apiGet(`/api/specialized-services/reservations${params}`);

            const resData = (response?.data || response) as any;
            if (resData.success) {
                setReservations(resData.reservations || []);
            }
        } catch (error: any) {
            console.error('[MesReservationsScreen] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleCancel = async (reservationId: number) => {
        Alert.alert(
            'Annuler la réservation',
            'Êtes-vous sûr de vouloir annuler cette réservation ?',
            [
                { text: 'Non', style: 'cancel' },
                {
                    text: 'Oui',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await apiPatch(
                                `/api/specialized-services/reservations/${reservationId}/cancel`,
                                { reason: 'Annulé par le client' }
                            );

                            const cancelData = (response?.data || response) as any;
                            if (cancelData.success) {
                                Alert.alert('Succès', 'Réservation annulée');
                                loadReservations();
                            } else {
                                Alert.alert('Erreur', response.error || 'Impossible d\'annuler');
                            }
                        } catch (error: any) {
                            console.error('[MesReservationsScreen] Erreur annulation:', error);
                            Alert.alert('Erreur', 'Une erreur est survenue');
                        }
                    },
                },
            ]
        );
    };

    const handlePay = (reservation: Reservation) => {
        if (reservation.amount && reservation.payment_status !== 'paid') {
            navigation.navigate('Payment', {
                reservationId: reservation.id,
                amount: reservation.amount,
                currency: reservation.currency || 'XOF',
            });
        }
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
                return 'Confirmée';
            case 'completed':
                return 'Terminée';
            case 'cancelled':
                return 'Annulée';
            default:
                return status;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Non spécifié';
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

            <Text style={styles.dateLabel}>Date demandée:</Text>
            <Text style={styles.date}>{formatDate(item.requested_date)}</Text>

            {item.confirmed_date && (
                <>
                    <Text style={styles.dateLabel}>Date confirmée:</Text>
                    <Text style={styles.date}>{formatDate(item.confirmed_date)}</Text>
                </>
            )}

            {item.amount && (
                <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Montant:</Text>
                    <Text style={styles.amount}>
                        {item.amount} {item.currency || 'XOF'}
                    </Text>
                </View>
            )}

            <View style={styles.actions}>
                {item.status === 'pending' && (
                    <NativeButton
                        title="Annuler"
                        variant="secondary"
                        onPress={() => handleCancel(item.id)}
                        style={styles.actionButton}
                    />
                )}

                {item.status === 'confirmed' && item.amount && item.payment_status !== 'paid' && (
                    <NativeButton
                        title="Payer"
                        variant="primary"
                        onPress={() => handlePay(item)}
                        style={styles.actionButton}
                    />
                )}

                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('ServiceDetail', { serviceId: item.service_id })
                    }
                >
                    <Text style={styles.detailLink}>Voir le service</Text>
                </TouchableOpacity>
            </View>
        </NativeCard>
    );

    if (loading && reservations.length === 0) {
        return (
            <View style={styles.center}>
                <Text>Chargement...</Text>
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
                    <Text style={styles.filterText}>En attente</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'confirmed' && styles.filterActive,
                    ]}
                    onPress={() => setStatusFilter('confirmed')}
                >
                    <Text style={styles.filterText}>Confirmées</Text>
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
                        <Text style={styles.emptyText}>Aucune réservation</Text>
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
    amountContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    amountLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    amount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        alignItems: 'center',
    },
    actionButton: {
        flex: 1,
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

export default MesReservationsScreen;

