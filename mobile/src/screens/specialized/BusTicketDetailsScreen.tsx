// ✅ REFONTE 2026-03-07: BusTicketDetailsScreen → UX moderne
// Hero gradient bleu/cyan, QR code, route visuelle, carte trajet, paiement, partage, pull-to-refresh
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import SafeIcon from '../../components/SafeIcon';
import SkeletonCard from '../../components/SkeletonCard';
import TripMap from '../../components/TripMap';
import { apiGet, apiPatch } from '../../services/api';
import ticketNotifications from '../../services/ticketNotifications';

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
    reservations_details?: Array<{ reservation_id: string; seat_id: string; seat_number: number; passenger_name?: string }>;
    created_at: string;
}

const BusTicketDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const paymentId = (route.params as any)?.paymentId as string;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [ticket, setTicket] = useState<TicketDetails | null>(null);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => { if (paymentId) loadTicketDetails(); }, [paymentId]);

    const loadTicketDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/bus-tickets/ticket/${paymentId}`);
            const resData = (response?.data || response) as any;
            if (resData.success && resData.ticket) {
                const ticketData = resData.ticket as TicketDetails;
                setTicket(ticketData);
                if (ticketData.payment_status === 'completed') {
                    await ticketNotifications.scheduleAllReminders({ ticketId: ticketData.product_id, paymentId: ticketData.payment_id, departureDate: ticketData.departure_date, departureTime: ticketData.departure_time, departureCity: ticketData.departure_city, arrivalCity: ticketData.arrival_city, type: 'reminder_24h' });
                }
            } else { Alert.alert('Erreur', 'Impossible de charger les détails du ticket'); navigation.goBack(); }
        } catch { Alert.alert('Erreur', 'Impossible de charger les détails du ticket'); navigation.goBack(); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadTicketDetails(); setRefreshing(false); }, [paymentId]);

    const handleCancel = () => {
        if (!ticket) return;
        Alert.alert('Annuler la réservation', 'Êtes-vous sûr de vouloir annuler ?', [
            { text: 'Non', style: 'cancel' },
            {
                text: 'Oui, annuler', style: 'destructive', onPress: async () => {
                    try { setCancelling(true); for (const rid of ticket.reservation_ids) await apiPatch(`/api/bus-tickets/reservations/${rid}/cancel`, {}); Alert.alert('Succès', 'Réservation annulée'); navigation.goBack(); }
                    catch (e: any) { Alert.alert('Erreur', e.message || 'Impossible d\'annuler'); }
                    finally { setCancelling(false); }
                }
            },
        ]);
    };

    const handleShare = async () => {
        if (!ticket) return;
        try {
            await Share.share({
                message: `Ticket de bus ${ticket.departure_city} → ${ticket.arrival_city}\nDate: ${formatDate(ticket.departure_date)} à ${ticket.departure_time.substring(0, 5)}\n${ticket.number_of_tickets} ticket(s) - ${ticket.total_amount.toLocaleString('fr-FR')} ${ticket.currency}\nVia Yukpo`,
                title: `Ticket ${ticket.departure_city} → ${ticket.arrival_city}`,
            });
        } catch { }
    };

    const formatDate = (dateStr: string) => { try { return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return dateStr; } };

    if (loading) return (<View style={st.container}><LinearGradient colors={['#0C4A6E', '#0284C7', '#38BDF8']} style={st.hero}><View style={st.heroTop}><TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity></View><View style={st.heroContent}><View style={st.heroIconWrap}><SafeIcon name="bus" size={28} color="#0284C7" /></View><Text style={st.heroTitle}>Chargement...</Text></View></LinearGradient><ScrollView style={{ flex: 1, padding: 16 }}><SkeletonCard count={3} /></ScrollView></View>);
    if (!ticket) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#0284C7" /><Text style={st.centerText}>Ticket non trouvé</Text></View>);

    const qrData = JSON.stringify({ id: ticket.reservation_ids[0], payment_id: ticket.payment_id, product_id: ticket.product_id, timestamp: new Date().toISOString(), type: 'bus_ticket' });
    const isPaid = ticket.payment_status === 'completed';

    return (
        <View style={st.container}>
            {/* Hero */}
            <LinearGradient colors={['#0C4A6E', '#0284C7', '#38BDF8']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share-2" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    {/* Route visualization */}
                    <View style={st.routeViz}>
                        <View style={st.routeEnd}><View style={[st.routeDot, { backgroundColor: '#fff' }]} /><Text style={st.routeCity} numberOfLines={1}>{ticket.departure_city}</Text><Text style={st.routeTime}>{ticket.departure_time.substring(0, 5)}</Text></View>
                        <View style={st.routeConn}><View style={st.routeDash} /><SafeIcon name="bus" size={16} color="rgba(255,255,255,0.7)" /><View style={st.routeDash} /></View>
                        <View style={st.routeEnd}><View style={[st.routeDot, { backgroundColor: '#34D399' }]} /><Text style={st.routeCity} numberOfLines={1}>{ticket.arrival_city}</Text></View>
                    </View>
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: isPaid ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)' }]}>
                            <Text style={st.badgeText}>{isPaid ? 'Payé' : 'En attente'}</Text>
                        </View>
                        <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                            <Text style={st.badgeText}>{ticket.number_of_tickets} ticket{ticket.number_of_tickets > 1 ? 's' : ''}</Text>
                        </View>
                        {ticket.is_round_trip && (<View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><SafeIcon name="repeat" size={12} color="#fff" /><Text style={st.badgeText}>Aller-retour</Text></View>)}
                    </View>
                    <Text style={st.heroPrice}>{ticket.total_amount.toLocaleString('fr-FR')} {ticket.currency}</Text>
                </View>
            </LinearGradient>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0284C7']} />}>

                {/* QR Code */}
                <View style={[st.card, { alignItems: 'center' }]}>
                    <View style={st.cardHeader}><SafeIcon name="maximize" size={18} color="#0284C7" /><Text style={st.cardTitle}>Code QR d'embarquement</Text></View>
                    <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, marginVertical: 12 }}><QRCode value={qrData} size={180} backgroundColor="#fff" color="#000" /></View>
                    <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center' }}>Présentez ce code QR lors de l'embarquement</Text>
                </View>

                {/* Trip Info */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="map" size={18} color="#0284C7" /><Text style={st.cardTitle}>Informations du trajet</Text></View>
                    <View style={st.infoRow}><Text style={st.infoLabel}>Date</Text><Text style={st.infoValue}>{formatDate(ticket.departure_date)}</Text></View>
                    {(ticket as any).duration_minutes && (<View style={st.infoRow}><Text style={st.infoLabel}>Durée</Text><Text style={st.infoValue}>{(ticket as any).duration_minutes} min</Text></View>)}
                    {ticket.bus_number && (<View style={st.infoRow}><Text style={st.infoLabel}>Bus</Text><Text style={st.infoValue}>#{ticket.bus_number}</Text></View>)}
                    <View style={{ marginTop: 12 }}><TripMap departureCity={ticket.departure_city} arrivalCity={ticket.arrival_city} distanceKm={(ticket as any).distance_km} durationMinutes={(ticket as any).duration_minutes} /></View>
                </View>

                {/* Seats */}
                {ticket.reservations_details && ticket.reservations_details.length > 0 && (
                    <View style={st.card}>
                        <View style={st.cardHeader}><SafeIcon name="users" size={18} color="#0284C7" /><Text style={st.cardTitle}>Places réservées</Text></View>
                        {ticket.reservations_details.map((r, i) => (
                            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < ticket.reservations_details!.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Place {r.seat_number}</Text>
                                {r.passenger_name && <Text style={{ fontSize: 13, color: '#6B7280' }}>{r.passenger_name}</Text>}
                            </View>
                        ))}
                    </View>
                )}

                {/* Payment */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="credit-card" size={18} color="#0284C7" /><Text style={st.cardTitle}>Paiement</Text></View>
                    <View style={st.infoRow}><Text style={st.infoLabel}>Tickets</Text><Text style={st.infoValue}>{ticket.number_of_tickets}</Text></View>
                    <View style={st.infoRow}><Text style={st.infoLabel}>Prix unitaire</Text><Text style={st.infoValue}>{ticket.ticket_price.toLocaleString('fr-FR')} {ticket.currency}</Text></View>
                    <View style={[st.infoRow, { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}><Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Total</Text><Text style={{ fontSize: 18, fontWeight: '800', color: '#0284C7' }}>{ticket.total_amount.toLocaleString('fr-FR')} {ticket.currency}</Text></View>
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: isPaid ? '#F0FDF4' : '#FFFBEB', borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: isPaid ? '#10B981' : '#D97706' }}>{isPaid ? 'Payé' : 'En attente de paiement'}</Text>
                    </View>
                </View>

                {/* Actions */}
                <View style={{ paddingHorizontal: 16, gap: 10 }}>
                    <TouchableOpacity style={st.actionBtn} onPress={handleShare}><SafeIcon name="share-2" size={18} color="#0284C7" /><Text style={st.actionBtnText}>Partager le ticket</Text><SafeIcon name="chevron-right" size={18} color="#9CA3AF" /></TouchableOpacity>

                    {isPaid && !ticket.is_round_trip && (
                        <TouchableOpacity style={[st.primaryBtn, { backgroundColor: '#0284C7' }]} onPress={() => navigation.navigate('BusReturnRequestForm' as never, { outboundPaymentId: ticket.payment_id, outboundTicket: ticket } as never)}>
                            <SafeIcon name="repeat" size={20} color="#fff" /><Text style={st.primaryBtnText}>Demande de retour</Text>
                        </TouchableOpacity>
                    )}

                    {isPaid && (
                        <TouchableOpacity style={[st.actionBtn, { borderLeftWidth: 3, borderLeftColor: '#EF4444' }]} onPress={handleCancel} disabled={cancelling}>
                            {cancelling ? <ActivityIndicator size="small" color="#EF4444" /> : <SafeIcon name="x-circle" size={18} color="#EF4444" />}
                            <Text style={[st.actionBtnText, { color: '#DC2626' }]}>Annuler la réservation</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F9FF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F9FF' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
    heroPrice: { fontSize: 22, fontWeight: '800', color: '#FCD34D', marginTop: 10 },
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    // Route viz
    routeViz: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginBottom: 4 },
    routeEnd: { flex: 1, alignItems: 'center', gap: 4 },
    routeDot: { width: 10, height: 10, borderRadius: 5 },
    routeCity: { fontSize: 15, fontWeight: '700', color: '#fff', textAlign: 'center' },
    routeTime: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    routeConn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    routeDash: { width: 12, height: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
    // Card
    card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
    // Info
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    infoLabel: { fontSize: 13, color: '#6B7280' },
    infoValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
    // Buttons
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    actionBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 14, shadowColor: '#0284C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default BusTicketDetailsScreen;

