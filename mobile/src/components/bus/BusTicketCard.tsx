/**
 * Composant pour afficher un ticket bus individuel avec disponibilité en temps réel
 */

import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

export interface BusTicketData {
    product_id: string;
    product_name: string;
    bus_model_name?: string;
    total_seats?: number;
    available_seats: number;
    reserved_seats: number;
    bus_number?: string;
    departure_city?: string;
    arrival_city?: string;
    departure_date?: string;
    departure_time?: string;
    ticket_price?: number;
    currency?: string;
    distance_km?: number;
}

interface BusTicketCardProps {
    ticket: BusTicketData;
    onViewSeats?: (ticket: BusTicketData) => void;
    onReserve?: (ticket: BusTicketData) => void;
}

const BusTicketCard: React.FC<BusTicketCardProps> = ({
    ticket,
    onViewSeats,
    onReserve,
}) => {
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
            });
        } catch {
            return dateStr;
        }
    };

    const formatTime = (timeStr?: string) => {
        if (!timeStr) return '';
        return timeStr.substring(0, 5); // HH:MM
    };

    const availabilityPercentage =
        ticket.total_seats && ticket.total_seats > 0
            ? (ticket.available_seats / ticket.total_seats) * 100
            : 0;

    const getAvailabilityColor = () => {
        if (availabilityPercentage > 50) return '#10B981'; // Vert
        if (availabilityPercentage > 20) return '#F59E0B'; // Orange
        return '#EF4444'; // Rouge
    };

    return (
        <View style={styles.card}>
            {/* Header avec trajet */}
            <View style={styles.header}>
                <View style={styles.routeContainer}>
                    <View style={styles.cityContainer}>
                        <Text style={styles.cityName}>
                            {ticket.departure_city || t('busTicketCard.depart')}
                        </Text>
                        {ticket.departure_time && (
                            <Text style={styles.time}>{formatTime(ticket.departure_time)}</Text>
                        )}
                    </View>
                    <View style={styles.arrowContainer}>
                        <SafeIcon name="arrow-right" size={20} color={modernColors.primary} />
                        {ticket.distance_km && (
                            <Text style={styles.distance}>
                                {ticket.distance_km.toFixed(1)} km
                            </Text>
                        )}
                    </View>
                    <View style={styles.cityContainer}>
                        <Text style={styles.cityName}>
                            {ticket.arrival_city || 'Destination'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Informations voyage */}
            <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                    <SafeIcon name="calendar" size={14} color="#6B7280" />
                    <Text style={styles.infoText}>
                        {formatDate(ticket.departure_date)}
                    </Text>
                </View>
                {ticket.bus_model_name && (
                    <View style={styles.infoItem}>
                        <SafeIcon name="truck" size={14} color="#6B7280" />
                        <Text style={styles.infoText}>{ticket.bus_model_name}</Text>
                    </View>
                )}
                {ticket.bus_number && (
                    <View style={styles.infoItem}>
                        <Text style={styles.infoText}>Bus #{ticket.bus_number}</Text>
                    </View>
                )}
            </View>

            {/* Disponibilité */}
            <View style={styles.availabilityContainer}>
                <View style={styles.availabilityInfo}>
                    <Text style={styles.availabilityLabel}>Places disponibles</Text>
                    <View style={styles.availabilityBadge}>
                        <View
                            style={[
                                styles.availabilityIndicator,
                                { backgroundColor: getAvailabilityColor() },
                            ]}
                        />
                        <Text style={styles.availabilityText}>
                            {ticket.available_seats} / {ticket.total_seats || '?'} places
                        </Text>
                    </View>
                </View>
                {ticket.ticket_price && (
                    <View style={styles.priceContainer}>
                        <Text style={styles.priceLabel}>Prix</Text>
                        <Text style={styles.priceValue}>
                            {ticket.ticket_price.toLocaleString()} {ticket.currency || 'FCFA'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Barre de progression disponibilité */}
            {ticket.total_seats && ticket.total_seats > 0 && (
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${availabilityPercentage}%`,
                                backgroundColor: getAvailabilityColor(),
                            },
                        ]}
                    />
                </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
                {onViewSeats && (
                    <TouchableOpacity
                        style={styles.viewSeatsButton}
                        onPress={() => onViewSeats(ticket)}
                    >
                        <SafeIcon name="grid" size={16} color={modernColors.primary} />
                        <Text style={styles.viewSeatsText}>Voir places</Text>
                    </TouchableOpacity>
                )}
                {onReserve && ticket.available_seats > 0 && (
                    <TouchableOpacity
                        style={styles.reserveButton}
                        onPress={() => onReserve(ticket)}
                    >
                        <Text style={styles.reserveButtonText}>{t('busTicketCard.reserver')}</Text>
                        <SafeIcon name="arrow-right" size={16} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        marginBottom: 16,
    },
    routeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cityContainer: {
        flex: 1,
    },
    cityName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    time: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    arrowContainer: {
        alignItems: 'center',
        marginHorizontal: 12,
    },
    distance: {
        fontSize: 10,
        color: '#9CA3AF',
        marginTop: 4,
    },
    infoRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 12,
        color: '#6B7280',
    },
    availabilityContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    availabilityInfo: {
        flex: 1,
    },
    availabilityLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 6,
    },
    availabilityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    availabilityIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    availabilityText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    priceLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    priceValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginBottom: 16,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    viewSeatsButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        gap: 8,
    },
    viewSeatsText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    reserveButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 8,
    },
    reserveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});

export default BusTicketCard;

