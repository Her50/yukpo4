/**
 * Écran de gestion des tickets pour les agences de voyage
 * Permet de voir tous les tickets vendus, les statistiques, et accéder à la gestion d'embarquement
 */

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import SkeletonCard from '../components/SkeletonCard';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { requireAgency } from '../utils/navigationGuards';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface AgencyTicket {
    payment_id: string;
    product_id: string;
    product_name: string;
    bus_number?: string;
    departure_city: string;
    arrival_city: string;
    departure_date: string;
    departure_time: string;
    ticket_price: number;
    number_of_tickets: number;
    subtotal: number;
    yukpo_commission?: number;
    agency_payout?: number;
    total_amount: number;
    booking_fee: number;
    currency: string;
    payment_status: string;
    ticket_pdf_url?: string;
    reservation_ids: string[];
    customer_name?: string;
    customer_email?: string;
    boarded_count: number;
    created_at: string;
}

const AgencyTicketManagementScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tickets, setTickets] = useState<AgencyTicket[]>([]);
    const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
    const [stats, setStats] = useState({
        total: 0,
        totalRevenue: 0,
        totalCommission: 0,
        totalPayout: 0,
        todayCount: 0,
    });

    useEffect(() => {
        // Vérifier l'accès agence
        if (!requireAgency(user, navigation)) {
            return;
        }
        loadTickets();
    }, [user]);

    const loadTickets = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/bus-tickets/agency/tickets');

            if (response.success) {
                const ticketsData = (response as any).tickets || [];
                setTickets(ticketsData);
                calculateStats(ticketsData);
            } else {
                Alert.alert('Erreur', (response as any).error || 'Impossible de charger les tickets');
            }
        } catch (error: any) {
            console.error('Erreur chargement tickets:', error);
            Alert.alert('Erreur', 'Impossible de charger vos tickets');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateStats = (ticketsList: AgencyTicket[]) => {
        const today = new Date().toISOString().split('T')[0];
        const todayTickets = ticketsList.filter((t) => t.departure_date === today);

        const totalRevenue = ticketsList.reduce((sum, t) => sum + t.total_amount, 0);
        const totalCommission = ticketsList.reduce((sum, t) => sum + (t.yukpo_commission || 0), 0);
        const totalPayout = ticketsList.reduce((sum, t) => sum + (t.agency_payout || 0), 0);

        setStats({
            total: ticketsList.length,
            totalRevenue,
            totalCommission,
            totalPayout,
            todayCount: todayTickets.length,
        });
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadTickets();
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const formatTime = (timeStr: string) => {
        return timeStr.substring(0, 5);
    };

    const getTicketStatus = (ticket: AgencyTicket): 'upcoming' | 'past' => {
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
        if (filter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            return ticket.departure_date === today;
        }
        return getTicketStatus(ticket) === filter;
    });

    const handleViewBoarding = (ticket: AgencyTicket) => {
        (navigation as any).navigate('BusBoardingManagement', {
            productId: ticket.product_id,
            busNumber: ticket.bus_number,
        });
    };

    const renderTicketCard = (ticket: AgencyTicket) => {
        const status = getTicketStatus(ticket);
        const statusColor = status === 'upcoming' ? '#10B981' : '#6B7280';

        return (
            <View key={ticket.payment_id} style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                    <View style={styles.ticketHeaderLeft}>
                        <Text style={styles.ticketTitle}>{ticket.product_name}</Text>
                        {ticket.bus_number && (
                            <Text style={styles.busNumber}>Bus #{ticket.bus_number}</Text>
                        )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusText}>
                            {status === 'upcoming' ? 'À venir' : t('agencyTicketManagementScreen.passe')}
                        </Text>
                    </View>
                </View>

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

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Client</Text>
                        <Text style={styles.detailValue}>
                            {ticket.customer_name || ticket.customer_email || 'N/A'}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Places</Text>
                        <Text style={styles.detailValue}>
                            {ticket.number_of_tickets} ({ticket.boarded_count} embarqués)
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Reversement</Text>
                        <Text style={[styles.detailValue, styles.payoutValue]}>
                            {ticket.agency_payout?.toLocaleString() || 0} {ticket.currency}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionsRow}>
                    {status === 'upcoming' && (
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => handleViewBoarding(ticket)}
                        >
                            <SafeIcon name="users" size={16} color="#fff" />
                            <Text style={styles.primaryButtonText}>{t('agencyTicketManagement.gererEmbarquement')}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => {
                            (navigation as any).navigate('ManageBusSeats', {
                                productId: ticket.product_id,
                            });
                        }}
                    >
                        <SafeIcon name="settings" size={16} color={modernColors.primary} />
                        <Text style={styles.secondaryButtonText}>{t('agencyTicketManagement.gererPlaces')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('agencyTicketManagement.gestionDesTickets')}</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Statistiques */}
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <Text style={styles.statLabel}>{t('agencyTicketManagement.totalTickets')}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.todayCount}</Text>
                    <Text style={styles.statLabel}>Aujourd'hui</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>
                        {stats.totalPayout.toLocaleString()} XAF
                    </Text>
                    <Text style={styles.statLabel}>Reversements</Text>
                </View>
            </View>

            {/* Filtres */}
            <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(['all', 'today', 'upcoming', 'past'] as const).map((filterOption) => (
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
                                    : filterOption === 'today'
                                        ? "Aujourd'hui"
                                        : filterOption === 'upcoming'
                                            ? 'À venir'
                                            : t('agencyTicketManagementScreen.passes')}
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
                    <Text style={styles.emptyTitle}>{t('agencyTicketManagement.aucunTicket')}</Text>
                    <Text style={styles.emptyText}>
                        {filter === 'all'
                            ? 'Aucun ticket vendu pour le moment'
                            : filter === 'today'
                                ? 'Aucun ticket aujourd\'hui'
                                : filter === 'upcoming'
                                    ? t('agencyTicketManagementScreen.aucunTicketAVenir')
                                    : t('agencyTicketManagementScreen.aucunTicketPasse')}
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
    statsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
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
        flex: 1,
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
        textAlign: 'center',
    },
    payoutValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    primaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 6,
    },
    primaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    secondaryButton: {
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
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default AgencyTicketManagementScreen;

