import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import BusSeatSelector, { SelectedSeat } from '../bus/BusSeatSelector';
import BusTicketCard, { BusTicketData } from '../bus/BusTicketCard';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface AgenceVoyageResultCardProps {
    agency: {
        id: number;
        service_id: number;
        nom_agence: string;
        quartier?: string;
        ville?: string;
        telephone?: string;
        whatsapp?: string;
        peut_emettre_tickets_bus?: boolean;
        distance_km?: number;
        services_voyage?: string[];
        compagnies_bus?: string[];
    };
    busTickets?: BusTicketData[];
    onPress?: () => void;
    onViewSeats?: (ticket: BusTicketData) => void;
    onReserve?: (ticket: BusTicketData) => void;
}

const AgenceVoyageResultCard: React.FC<AgenceVoyageResultCardProps> = ({
    agency,
    busTickets,
    onPress,
    onViewSeats,
    onReserve,
}) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [showSeatSelector, setShowSeatSelector] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<BusTicketData | null>(null);

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            (navigation as any).navigate('ServiceDetailSpecialized', {
                serviceId: agency.service_id,
                serviceType: 'agence_voyage',
            });
        }
    };

    const handleViewSeats = (ticket: BusTicketData) => {
        setSelectedTicket(ticket);
        setShowSeatSelector(true);
        if (onViewSeats) {
            onViewSeats(ticket);
        }
    };

    const handleReserve = (ticket: BusTicketData) => {
        setSelectedTicket(ticket);
        setShowSeatSelector(true);
        if (onReserve) {
            onReserve(ticket);
        }
    };

    const handleSeatSelectorReserve = async (selectedSeats: SelectedSeat[], totalPrice: number) => {
        if (!selectedTicket || selectedSeats.length === 0) {
            return;
        }

        try {
            // Créer les réservations
            const { apiPost } = await import('../../services/api');
            const reservationResponse = await apiPost('/api/bus-tickets/reservations', {
                product_id: selectedTicket.product_id,
                seats: selectedSeats.map(seat => ({
                    seat_id: seat.seat_id,
                    seat_number: seat.seat_number,
                    passenger_name: null, // Peut être ajouté plus tard
                })),
                caution_amount: 500, // Montant caution par défaut
            });

            if (reservationResponse.success && reservationResponse.reservations) {
                const reservationIds = reservationResponse.reservations.map((r: any) => r.reservation_id);

                // Naviguer vers l'écran de paiement avec les réservations
                (navigation as any).navigate('BusTicketPayment', {
                    productId: selectedTicket.product_id,
                    reservationIds,
                    ticketPrice: selectedTicket.ticket_price || 0,
                    numberOfTickets: selectedSeats.length,
                    totalPrice,
                });
            } else {
                Alert.alert('Erreur', reservationResponse.error || t('agenceVoyageResultCard.impossibleDeCreerLesReservations'));
            }
        } catch (error: any) {
            console.error('Erreur création réservations:', error);
            Alert.alert('Erreur', error.message || t('agenceVoyageResultCard.uneErreurEstSurvenueLorsDe'));
        } finally {
            setShowSeatSelector(false);
            setSelectedTicket(null);
        }
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>\uD83D\uDE8C</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{agency.nom_agence}</Text>
                    {agency.peut_emettre_tickets_bus && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{t('agenceVoyageResultCard.ticketsBus')}</Text>
                        </View>
                    )}
                </View>
            </View>

            {(agency.quartier || agency.ville) && (
                <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>
                        {[agency.quartier, agency.ville].filter(Boolean).join(', ')}
                    </Text>
                </View>
            )}

            {agency.services_voyage && agency.services_voyage.length > 0 && (
                <View style={styles.servicesRow}>
                    {agency.services_voyage.slice(0, 3).map((service, index) => (
                        <View key={index} style={styles.serviceTag}>
                            <Text style={styles.serviceTagText}>{service}</Text>
                        </View>
                    ))}
                </View>
            )}

            {agency.compagnies_bus && agency.compagnies_bus.length > 0 && (
                <View style={styles.compagniesRow}>
                    <Text style={styles.compagniesLabel}>Compagnies:</Text>
                    {agency.compagnies_bus.slice(0, 2).map((compagnie, index) => (
                        <View key={index} style={styles.compagnieTag}>
                            <Text style={styles.compagnieTagText}>{compagnie}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Afficher les tickets bus disponibles si présents */}
            {busTickets && busTickets.length > 0 && (
                <View style={styles.ticketsSection}>
                    <Text style={styles.ticketsSectionTitle}>{t('agenceVoyageResultCard.ticketsDisponibles')}</Text>
                    {busTickets.map((ticket, index) => (
                        <BusTicketCard
                            key={ticket.product_id || index}
                            ticket={ticket}
                            onViewSeats={() => handleViewSeats(ticket)}
                            onReserve={() => handleReserve(ticket)}
                        />
                    ))}
                </View>
            )}

            <View style={styles.footer}>
                {agency.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {agency.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    {agency.telephone && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => Linking.openURL(`tel:${agency.telephone}`)}
                        >
                            <SafeIcon name="phone" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                    {agency.whatsapp && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => {
                                const whatsappNumber = agency.whatsapp?.replace(/[^0-9]/g, '') || '';
                                Linking.openURL(`https://wa.me/${whatsappNumber}`);
                            }}
                        >
                            <SafeIcon name="message-circle" size={16} color="#25D366" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Modal sélection de places */}
            {selectedTicket && (
                <BusSeatSelector
                    visible={showSeatSelector}
                    onClose={() => {
                        setShowSeatSelector(false);
                        setSelectedTicket(null);
                    }}
                    productId={selectedTicket.product_id}
                    ticketPrice={selectedTicket.ticket_price || 0}
                    currency={selectedTicket.currency}
                    onReserve={handleSeatSelectorReserve}
                />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 24,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: '#F59E0B',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 6,
    },
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    serviceTag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    serviceTagText: {
        fontSize: 12,
        color: '#374151',
    },
    compagniesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    compagniesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginRight: 4,
    },
    compagnieTag: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    compagnieTagText: {
        fontSize: 12,
        color: '#92400E',
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
        marginLeft: 4,
    },
    contactRow: {
        flexDirection: 'row',
        gap: 8,
    },
    contactButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ticketsSection: {
        marginTop: 16,
        marginBottom: 12,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    ticketsSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
});

export default AgenceVoyageResultCard;

