/**
 * Écran pour afficher tous les tickets de voyage de l'utilisateur
 * Permet de voir les tickets à venir, passés, annulés
 * Affiche QR code, PDF, et permet de partager
 */

import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import SkeletonCard from '../components/SkeletonCard';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface BusTicket {
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
    created_at: string;
}

const MyBusTicketsScreen: React.FC = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tickets, setTickets] = useState<BusTicket[]>([]);
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('all');

    useEffect(() => {
        loadTickets();
    }, []);

    const loadTickets = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/bus-tickets/my-tickets');
            const resData = (response?.data || response) as any;

            if (resData.success && resData.tickets) {
                setTickets(resData.tickets);
            } else {
                Alert.alert('Erreur', resData.error || 'Impossible de charger les tickets');
            }
        } catch (error: any) {
            console.error('Erreur chargement tickets:', error);
            Alert.alert('Erreur', 'Impossible de charger vos tickets');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadTickets();
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

    const formatTime = (timeStr: string) => {
        return timeStr.substring(0, 5); // HH:MM
    };

    const getTicketStatus = (ticket: BusTicket): 'upcoming' | 'past' | 'cancelled' => {
        if (ticket.payment_status === 'refunded') {
            return 'cancelled';
        }

        try {
            const departureDateTime = new Date(`${ticket.departure_date} ${ticket.departure_time}`);
            const now = new Date();
            return departureDateTime > now ? 'upcoming' : 'past';
        } catch {
            return 'past';
        }
    };

    const filteredTickets = tickets.filter((ticket) => {
        if (filter === 'all') return true;
        return getTicketStatus(ticket) === filter;
    });

    const handleViewPDF = async (ticket: BusTicket) => {
        if (!ticket.ticket_pdf_url) {
            Alert.alert('PDF non disponible', 'Le ticket PDF n\'est pas encore généré');
            return;
        }

        try {
            await Linking.openURL(ticket.ticket_pdf_url);
        } catch (error) {
            Alert.alert('Erreur', 'Impossible d\'ouvrir le PDF');
        }
    };

    const handleShareTicket = async (ticket: BusTicket) => {
        try {
            if (ticket.ticket_pdf_url) {
                // Télécharger le PDF et partager
                const fileUri = `${FileSystem.cacheDirectory}ticket_${ticket.payment_id}.pdf`;
                const downloadResult = await FileSystem.downloadAsync(ticket.ticket_pdf_url, fileUri);

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(downloadResult.uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Partager le ticket',
                    });
                } else {
                    Alert.alert('Partage non disponible', 'La fonctionnalité de partage n\'est pas disponible sur cet appareil');
                }
            } else {
                // Partager les informations textuelles
                const message = `Ticket de voyage\n${ticket.departure_city} → ${ticket.arrival_city}\n${formatDate(ticket.departure_date)} à ${formatTime(ticket.departure_time)}\n${ticket.total_amount} ${ticket.currency}`;
                await Share.share({ message });
            }
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de partager le ticket');
        }
    };

    const renderTicketCard = (ticket: BusTicket) => {
        const status = getTicketStatus(ticket);
        const statusColor =
            status === 'upcoming'
                ? '#10B981'
                : status === 'past'
                    ? '#6B7280'
                    : '#EF4444';

        return (
            <View key={ticket.payment_id} style={styles.ticketCard}>
                {/* Header avec statut */}
                <View style={styles.ticketHeader}>
                    <View style={styles.ticketHeaderLeft}>
                        <Text style={styles.ticketTitle}>{ticket.product_name}</Text>
                        {ticket.bus_number && (
                            <Text style={styles.busNumber}>Bus #{ticket.bus_number}</Text>
                        )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusText}>
                            {status === 'upcoming'
                                ? 'À venir'
                                : status === 'past'
                                    ? 'Passé'
                                    : 'Annulé'}
                        </Text>
                    </View>
                </View>

                {/* Informations voyage */}
                <View style={styles.routeContainer}>
                    <View style={styles.cityContainer}>
                        <Text style={styles.cityName}>{ticket.departure_city}</Text>
                        <Text style={styles.time}>{formatTime(ticket.departure_time)}</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                        <SafeIcon name="arrow-right" size={20} color={modernColors.primary} />
                    </View>
                    <View style={styles.cityContainer}>
                        <Text style={styles.cityName}>{ticket.arrival_city}</Text>
                    </View>
                </View>

                {/* Date + round-trip badge */}
                <View style={styles.dateRow}>
                    <SafeIcon name="calendar" size={14} color="#6B7280" />
                    <Text style={styles.dateText}>{formatDate(ticket.departure_date)}</Text>
                    {(ticket.is_round_trip || ticket.return_date) && (
                        <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8 }}>
                            <Text style={{ fontSize: 11, color: '#1D4ED8', fontWeight: '600' }}>Aller-Retour</Text>
                        </View>
                    )}
                </View>
                {ticket.return_date && (
                    <View style={[styles.dateRow, { marginTop: 4 }]}>
                        <SafeIcon name="rotate-ccw" size={14} color="#2563EB" type="lucide" />
                        <Text style={[styles.dateText, { color: '#2563EB' }]}>Retour: {formatDate(ticket.return_date)}{ticket.return_time ? ` à ${ticket.return_time.substring(0, 5)}` : ''}</Text>
                    </View>
                )}

                {/* Détails */}
                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Places</Text>
                        <Text style={styles.detailValue}>{ticket.number_of_tickets}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Prix unitaire</Text>
                        <Text style={styles.detailValue}>
                            {ticket.ticket_price.toLocaleString()} {ticket.currency}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Total</Text>
                        <Text style={[styles.detailValue, styles.totalValue]}>
                            {ticket.total_amount.toLocaleString()} {ticket.currency}
                        </Text>
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                    {ticket.ticket_pdf_url && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleViewPDF(ticket)}
                        >
                            <SafeIcon name="file-text" size={16} color={modernColors.primary} />
                            <Text style={styles.actionButtonText}>Voir PDF</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleShareTicket(ticket)}
                    >
                        <SafeIcon name="share-2" size={16} color={modernColors.primary} />
                        <Text style={styles.actionButtonText}>Partager</Text>
                    </TouchableOpacity>
                    {status === 'upcoming' && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                const qrData = JSON.stringify({
                                    type: 'bus_ticket',
                                    payment_id: ticket.payment_id,
                                    product_id: ticket.product_id,
                                    reservation_ids: ticket.reservation_ids,
                                    departure_city: ticket.departure_city,
                                    arrival_city: ticket.arrival_city,
                                    departure_date: ticket.departure_date,
                                    number_of_tickets: ticket.number_of_tickets,
                                });
                                (navigation as any).navigate('BusTicketQR', {
                                    qrData,
                                    ticketInfo: {
                                        departure_city: ticket.departure_city,
                                        arrival_city: ticket.arrival_city,
                                        departure_date: ticket.departure_date,
                                        departure_time: ticket.departure_time,
                                        number_of_tickets: ticket.number_of_tickets,
                                        bus_number: ticket.bus_number,
                                    },
                                });
                            }}
                        >
                            <SafeIcon name="qr-code" size={16} color={modernColors.primary} />
                            <Text style={styles.actionButtonText}>QR Code</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Mes tickets de voyage</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Filtres */}
            <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(['all', 'upcoming', 'past', 'cancelled'] as const).map((filterOption) => (
                        <TouchableOpacity
                            key={filterOption}
                            style={[
                                styles.filterChip,
                                filter === filterOption && styles.filterChipActive,
                            ]}
                            onPress={() => setFilter(filterOption)}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    filter === filterOption && styles.filterChipTextActive,
                                ]}
                            >
                                {filterOption === 'all'
                                    ? 'Tous'
                                    : filterOption === 'upcoming'
                                        ? 'À venir'
                                        : filterOption === 'past'
                                            ? 'Passés'
                                            : 'Annulés'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Liste des tickets */}
            {loading ? (
                <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
                    <SkeletonCard count={3} />
                </ScrollView>
            ) : filteredTickets.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="ticket" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>Aucun ticket</Text>
                    <Text style={styles.emptyText}>
                        {filter === 'all'
                            ? 'Vous n\'avez pas encore de tickets de voyage'
                            : filter === 'upcoming'
                                ? 'Aucun ticket à venir'
                                : filter === 'past'
                                    ? 'Aucun ticket passé'
                                    : 'Aucun ticket annulé'}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {filteredTickets.map((ticket) => renderTicketCard(ticket))}
                </ScrollView>
            )}
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
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    placeholder: {
        width: 32,
    },
    filtersContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    ticketCard: {
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
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    ticketHeaderLeft: {
        flex: 1,
    },
    ticketTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    busNumber: {
        fontSize: 12,
        color: '#6B7280',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    routeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
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
        marginHorizontal: 12,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    dateText: {
        fontSize: 14,
        color: '#6B7280',
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        marginBottom: 12,
    },
    detailItem: {
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        gap: 6,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default MyBusTicketsScreen;

