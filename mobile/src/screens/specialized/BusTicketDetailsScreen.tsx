import { useNavigation, useRoute } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import SkeletonCard from '../../components/SkeletonCard';
import TripMap from '../../components/TripMap';
import { apiGet, apiPatch } from '../../services/api';
import ticketNotifications from '../../services/ticketNotifications';
import { modernColors } from '../../theme/modernTheme';

interface TicketDetails {
    payment_id: string;
    product_id: string;
    product_name: string;
    bus_number?: string;
    departure_city: string;
    arrival_city: string;
    departure_date: string;
    departure_time: string;
    return_date?: string;
    return_time?: string;
    is_round_trip?: boolean;
    ticket_price: number;
    number_of_tickets: number;
    total_amount: number;
    currency: string;
    payment_status: string;
    ticket_pdf_url?: string;
    reservation_ids: string[];
    reservations_details?: Array<{
        reservation_id: string;
        seat_id: string;
        seat_number: number;
        passenger_name?: string;
    }>;
    created_at: string;
}

const BusTicketDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const paymentId = (route.params as any)?.paymentId as string;

    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState<TicketDetails | null>(null);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (paymentId) {
            loadTicketDetails();
        }
    }, [paymentId]);

    const loadTicketDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/bus-tickets/ticket/${paymentId}`);
            const resData = (response?.data || response) as any;

            if (resData.success && resData.ticket) {
                const ticketData = resData.ticket as TicketDetails;
                setTicket(ticketData);

                // Planifier les notifications si le ticket est payé
                if (ticketData.payment_status === 'completed') {
                    await ticketNotifications.scheduleAllReminders({
                        ticketId: ticketData.product_id,
                        paymentId: ticketData.payment_id,
                        departureDate: ticketData.departure_date,
                        departureTime: ticketData.departure_time,
                        departureCity: ticketData.departure_city,
                        arrivalCity: ticketData.arrival_city,
                        type: 'reminder_24h',
                    });
                }
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails du ticket');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[BusTicketDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de charger les détails du ticket');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!ticket) return;

        Alert.alert(
            'Annuler la réservation',
            'Êtes-vous sûr de vouloir annuler cette réservation ?',
            [
                { text: 'Non', style: 'cancel' },
                {
                    text: 'Oui, annuler',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setCancelling(true);

                            // Annuler chaque réservation (PATCH)
                            for (const reservationId of ticket.reservation_ids) {
                                await apiPatch(`/api/bus-tickets/reservations/${reservationId}/cancel`, {});
                            }

                            Alert.alert('Succès', 'Réservation annulée avec succès');
                            navigation.goBack();
                        } catch (error: any) {
                            console.error('[BusTicketDetailsScreen] Erreur annulation:', error);
                            Alert.alert('Erreur', error.message || 'Impossible d\'annuler la réservation');
                        } finally {
                            setCancelling(false);
                        }
                    },
                },
            ]
        );
    };

    const handleShare = async () => {
        if (!ticket) return;

        const qrData = {
            id: ticket.reservation_ids[0],
            payment_id: ticket.payment_id,
            product_id: ticket.product_id,
            timestamp: new Date().toISOString(),
            type: 'bus_ticket',
        };

        const qrText = JSON.stringify(qrData);
        const shareText = `Ticket de bus - ${ticket.departure_city} → ${ticket.arrival_city}\nDate: ${ticket.departure_date} à ${ticket.departure_time}\nQR Code: ${qrText}`;

        try {
            await Sharing.shareAsync({
                message: shareText,
                title: 'Ticket de bus',
            });
        } catch (error: any) {
            console.error('[BusTicketDetailsScreen] Erreur partage:', error);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Détails du ticket</Text>
                </View>
                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                    <SkeletonCard count={3} />
                </ScrollView>
            </View>
        );
    }

    if (!ticket) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Détails du ticket</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Ticket non trouvé</Text>
                </View>
            </View>
        );
    }

    // Données pour QR code
    const qrData = JSON.stringify({
        id: ticket.reservation_ids[0],
        payment_id: ticket.payment_id,
        product_id: ticket.product_id,
        timestamp: new Date().toISOString(),
        type: 'bus_ticket',
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Mon ticket</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* QR Code */}
                <View style={styles.qrCard}>
                    <Text style={styles.qrTitle}>Code QR d'embarquement</Text>
                    <View style={styles.qrContainer}>
                        <QRCode
                            value={qrData}
                            size={200}
                            backgroundColor="#fff"
                            color="#000"
                        />
                    </View>
                    <Text style={styles.qrHint}>
                        Présentez ce code QR lors de l'embarquement
                    </Text>
                </View>

                {/* Informations du trajet */}
                <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>Informations du trajet</Text>

                    <View style={styles.routeContainer}>
                        <View style={styles.cityContainer}>
                            <View style={styles.cityDot} />
                            <View style={styles.cityInfo}>
                                <Text style={styles.cityName}>{ticket.departure_city}</Text>
                                <Text style={styles.time}>{ticket.departure_time.substring(0, 5)}</Text>
                            </View>
                        </View>

                        <View style={styles.routeLine} />

                        <View style={styles.cityContainer}>
                            <View style={[styles.cityDot, styles.cityDotArrival]} />
                            <View style={styles.cityInfo}>
                                <Text style={styles.cityName}>{ticket.arrival_city}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Date</Text>
                        <Text style={styles.infoValue}>{formatDate(ticket.departure_date)}</Text>
                    </View>

                    {/* ✅ NOUVEAU: Durée du trajet */}
                    {(ticket as any).duration_minutes && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Durée</Text>
                            <Text style={styles.infoValue}>
                                {(ticket as any).duration_minutes} minutes
                            </Text>
                        </View>
                    )}

                    {ticket.bus_number && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Bus</Text>
                            <Text style={styles.infoValue}>#{ticket.bus_number}</Text>
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Carte du trajet */}
                    <View style={styles.mapContainer}>
                        <TripMap
                            departureCity={ticket.departure_city}
                            arrivalCity={ticket.arrival_city}
                            distanceKm={(ticket as any).distance_km}
                            durationMinutes={(ticket as any).duration_minutes}
                        />
                    </View>
                </View>

                {/* Places réservées */}
                {ticket.reservations_details && ticket.reservations_details.length > 0 && (
                    <View style={styles.infoCard}>
                        <Text style={styles.cardTitle}>Places réservées</Text>
                        {ticket.reservations_details.map((reservation, index) => (
                            <View key={index} style={styles.seatInfo}>
                                <Text style={styles.seatNumber}>Place {reservation.seat_number}</Text>
                                {reservation.passenger_name && (
                                    <Text style={styles.passengerName}>{reservation.passenger_name}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Informations de paiement */}
                <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>Informations de paiement</Text>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Nombre de tickets</Text>
                        <Text style={styles.infoValue}>{ticket.number_of_tickets}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Prix unitaire</Text>
                        <Text style={styles.infoValue}>
                            {ticket.ticket_price.toLocaleString('fr-FR')} {ticket.currency}
                        </Text>
                    </View>

                    <View style={[styles.infoRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total payé</Text>
                        <Text style={styles.totalValue}>
                            {ticket.total_amount.toLocaleString('fr-FR')} {ticket.currency}
                        </Text>
                    </View>

                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>
                            Statut: {ticket.payment_status === 'completed' ? '✅ Payé' : '⏳ En attente'}
                        </Text>
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="Partager le ticket"
                        onPress={handleShare}
                        variant="outline"
                        size="medium"
                        style={styles.actionButton}
                    />

                    {ticket.payment_status === 'completed' && !ticket.is_round_trip && (
                        <NativeButton
                            title="Créer une demande de retour"
                            onPress={() => {
                                navigation.navigate('BusReturnRequestForm' as never, {
                                    outboundPaymentId: ticket.payment_id,
                                    outboundTicket: ticket,
                                } as never);
                            }}
                            variant="primary"
                            size="medium"
                            style={styles.actionButton}
                        />
                    )}

                    {ticket.payment_status === 'completed' && (
                        <NativeButton
                            title={cancelling ? 'Annulation...' : 'Annuler la réservation'}
                            onPress={handleCancel}
                            variant="outline"
                            size="medium"
                            style={[styles.actionButton, styles.cancelButton]}
                            disabled={cancelling}
                        />
                    )}
                </View>
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 48,
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    qrCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    qrTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    qrContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    qrHint: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    routeContainer: {
        marginBottom: 16,
    },
    cityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cityDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: modernColors.primary,
    },
    cityDotArrival: {
        backgroundColor: '#10B981',
    },
    cityInfo: {
        flex: 1,
    },
    cityName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    time: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    routeLine: {
        width: 2,
        height: 24,
        backgroundColor: '#E5E7EB',
        marginLeft: 5,
        marginVertical: 8,
    },
    mapContainer: {
        marginTop: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    statusBadge: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
        alignItems: 'center',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    seatInfo: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    seatNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    passengerName: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    actionsContainer: {
        gap: 12,
        marginBottom: 32,
    },
    actionButton: {
        marginTop: 8,
    },
    cancelButton: {
        borderColor: '#EF4444',
    },
});

export default BusTicketDetailsScreen;

