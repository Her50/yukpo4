import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import BusSeatSelector, { SelectedSeat } from '../../components/bus/BusSeatSelector';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import SkeletonCard from '../../components/SkeletonCard';
import TripMap from '../../components/TripMap';
import { useAuth } from '../../contexts/AuthContext';
import { trackBooking } from '../../services/analytics';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface TicketData {
    product_id: string;
    agency_nom: string;
    departure_city?: string;
    arrival_city?: string;
    departure_date?: string;
    departure_time?: string;
    ticket_price?: number;
    available_seats: number;
    distance_km?: number;
}

const BusTicketBookingScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user } = useAuth();

    const ticketData = (route.params as any)?.ticketData as TicketData;
    const productId = (route.params as any)?.productId || ticketData?.product_id;
    // ✅ NOUVEAU: Infos retour pour aller-retour
    const isRoundTrip = (route.params as any)?.isRoundTrip || false;
    const returnDate = (route.params as any)?.returnDate;
    const returnTime = (route.params as any)?.returnTime;

    const [showSeatSelector, setShowSeatSelector] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reservations, setReservations] = useState<any[]>([]);

    const handleSelectSeats = () => {
        if (!productId) {
            Alert.alert('Erreur', 'Informations de ticket manquantes');
            return;
        }
        setShowSeatSelector(true);
    };

    const handleReserve = async (selectedSeats: SelectedSeat[], totalPrice: number) => {
        if (selectedSeats.length === 0) {
            Alert.alert('Erreur', 'Aucune place sélectionnée');
            return;
        }

        try {
            setLoading(true);
            setShowSeatSelector(false);

            // Créer les réservations
            const seatsPayload = selectedSeats.map((seat) => ({
                seat_id: seat.seat_id,
                seat_number: seat.seat_number,
                passenger_name: user?.nom_complet || user?.email || 'Passager',
            }));

            const response = await apiPost('/api/bus-tickets/reservations', {
                product_id: productId,
                seats: seatsPayload,
            });

            const resData = (response?.data || response) as any;
            if (resData.success) {
                const reservationsData = resData.reservations || [];
                setReservations(reservationsData);

                // Track booking
                trackBooking(productId, selectedSeats.length, (ticketData?.ticket_price || 0) * selectedSeats.length);

                // Planifier les notifications si le paiement est complété
                // (Les notifications seront planifiées après le paiement)

                Alert.alert(
                    t('busTicketBookingScreen.reservationCreee'),
                    t('busTicketBookingScreen.placesReserveesAvecSuccesVousAvez', { selectedSeats_length: selectedSeats.length }),
                    [
                        {
                            text: 'Payer maintenant',
                            onPress: () => {
                                (navigation as any).navigate('BusTicketPayment', {
                                    productId,
                                    reservationIds: reservationsData.map((r: any) => r.reservation_id),
                                    ticketPrice: ticketData?.ticket_price || 0,
                                    isRoundTrip,
                                    returnDate,
                                    returnTime,
                                });
                            },
                        },
                        { text: t('common.later'), style: 'cancel' },
                    ]
                );
            } else {
                Alert.alert('Erreur', (response as any).error || t('busTicketBooking.impossibleDeCreerLaReservation'));
            }
        } catch (error: any) {
            console.error('[BusTicketBookingScreen] Erreur réservation:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la réservation');
        } finally {
            setLoading(false);
        }
    };

    if (!ticketData && !productId) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('busTicketBooking.reservation')}</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{t('busTicketBooking.informationsDeTicketManquantes')}/Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('busTicketBooking.reserverDesPlaces')}</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Informations du trajet */}
                <View style={styles.tripInfoCard}>
                    <Text style={styles.agencyName}>{ticketData?.agency_nom || 'Agence de voyage'}</Text>

                    <View style={styles.routeContainer}>
                        <View style={styles.cityContainer}>
                            <View style={styles.cityDot} />
                            <View style={styles.cityInfo}>
                                <Text style={styles.cityName}>
                                    {ticketData?.departure_city || t('busTicketBooking.depart')}
                                </Text>
                                {ticketData?.departure_time && (
                                    <Text style={styles.time}>{ticketData.departure_time.substring(0, 5)}</Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.routeLine} />

                        <View style={styles.cityContainer}>
                            <View style={[styles.cityDot, styles.cityDotArrival]} />
                            <View style={styles.cityInfo}>
                                <Text style={styles.cityName}>
                                    {ticketData?.arrival_city || t('busTicketBooking.arrivee')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {ticketData?.departure_date && (
                        <Text style={styles.dateText}>
                            {new Date(ticketData.departure_date).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                            })}
                        </Text>
                    )}

                    {/* ✅ NOUVEAU: Carte du trajet */}
                    <TripMap
                        departureCity={ticketData?.departure_city || t('busTicketBooking.depart')}
                        arrivalCity={ticketData?.arrival_city || t('busTicketBooking.arrivee')}
                        distanceKm={ticketData?.distance_km}
                        durationMinutes={(ticketData as any)?.duration_minutes}
                    />

                    <View style={styles.priceContainer}>
                        <Text style={styles.priceLabel}>{t('busTicketBooking.prixParPlace')}/Text>
                        <Text style={styles.price}>
                            {ticketData?.ticket_price
                                ? `${ticketData.ticket_price.toLocaleString('fr-FR')} FCFA`
                                : 'Non disponible'}
                        </Text>
                    </View>
                </View>

                {/* Sélection des places */}
                <View style={styles.selectionCard}>
                    <Text style={styles.cardTitle}>{t('busTicketBooking.selectionnerLesPlaces')}</Text>
                    <Text style={styles.cardSubtitle}>
                        {ticketData?.available_seats || 0} place(s) disponible(s)
                    </Text>

                    <NativeButton
                        title={t('busTicketBooking.choisirLesPlaces')}
                        onPress={handleSelectSeats}
                        variant="primary"
                        size="large"
                        style={styles.selectButton}
                        disabled={loading}
                    />
                </View>

                {loading && (
                    <View style={styles.loadingContainer}>
                        <SkeletonCard count={1} />
                    </View>
                )}
            </ScrollView>

            {/* Modal sélection sièges */}
            <BusSeatSelector
                visible={showSeatSelector}
                onClose={() => setShowSeatSelector(false)}
                productId={productId}
                ticketPrice={ticketData?.ticket_price || 0}
                currency="XAF"
                onReserve={handleReserve}
            />
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
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
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
    tripInfoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    agencyName: {
        fontSize: 18,
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
    dateText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
        fontStyle: 'italic',
    },
    priceContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    priceLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    price: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    selectionCard: {
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
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
    },
    selectButton: {
        marginTop: 8,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
});

export default BusTicketBookingScreen;

