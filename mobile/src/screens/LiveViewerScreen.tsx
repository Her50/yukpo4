import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeIcon from '../components/SafeIcon';
import { LiveChatModal } from '../components/video/LiveChatModal';
import { useAuth } from '../contexts/AuthContext';
import { liveStreamingService } from '../services/liveStreamingService';
import {
    fetchFlashSalesBySession,
    reserveFlashSaleSlot,
    getFlashSaleTicketStatus,
    type LiveFlashSale,
    type FlashSaleReservationTicket,
} from '../services/flashSaleService';
import { modernColors } from '../theme/modernTheme';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300?text=Live';

const formatRelativeTime = (ms: number): string => {
    if (ms <= 0) return '0s';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    if (minutes > 0) return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    return `${seconds}s`;
};

export default function LiveViewerScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { sessionId } = (route.params as any) || {};

    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
    const [flashSales, setFlashSales] = useState<LiveFlashSale[]>([]);
    const [showChat, setShowChat] = useState(false);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [reservingSaleId, setReservingSaleId] = useState<string | null>(null);
    const [activeTickets, setActiveTickets] = useState<Record<string, FlashSaleReservationTicket>>({});
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Countdown timer
    useEffect(() => {
        const interval = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Load session data
    const loadSession = useCallback(async () => {
        if (!sessionId) return;
        try {
            setLoading(true);
            const resp = await liveStreamingService.getLiveSession(sessionId);
            const backendResp = resp.data as any;
            const innerData = backendResp?.data || backendResp;
            if (innerData) {
                const sessionObj = innerData.session || innerData;
                setSession({
                    ...sessionObj,
                    linked_services: innerData.linked_services || sessionObj.linked_services,
                    flash_sales: innerData.flash_sales || sessionObj.flash_sales,
                    replay: innerData.replay || sessionObj.replay,
                });
            }
        } catch (error) {
            console.error('[LiveViewerScreen] Erreur chargement session:', error);
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    // Load flash sales
    const loadFlashSales = useCallback(async () => {
        if (!sessionId) return;
        try {
            const sales = await fetchFlashSalesBySession(sessionId);
            setFlashSales(sales);
        } catch (error) {
            console.error('[LiveViewerScreen] Erreur chargement flash sales:', error);
        }
    }, [sessionId]);

    useEffect(() => {
        loadSession();
        loadFlashSales();

        // Poll for updates every 10 seconds
        pollIntervalRef.current = setInterval(() => {
            loadSession();
            loadFlashSales();
        }, 10000);

        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [loadSession, loadFlashSales]);

    const pollTicketStatus = useCallback(
        async (ticketId: string, flashSaleId: string) => {
            let attempts = 0;
            const poll = async () => {
                try {
                    const updatedTicket = await getFlashSaleTicketStatus(ticketId);
                    setActiveTickets(prev => ({ ...prev, [flashSaleId]: updatedTicket }));
                    if (updatedTicket.status !== 'pending') {
                        if (updatedTicket.status === 'confirmed') {
                            Alert.alert('Réservation confirmée', 'Votre réservation a été confirmée !');
                            loadFlashSales();
                        } else {
                            Alert.alert('Réservation échouée', updatedTicket.message || 'Impossible de confirmer.');
                        }
                        return;
                    }
                    attempts++;
                    if (attempts < 15) setTimeout(poll, 2000);
                } catch (_e) { /* ignore */ }
            };
            setTimeout(poll, 2000);
        },
        [loadFlashSales]
    );

    const handleReserve = async (sale: LiveFlashSale) => {
        if (!user) {
            Alert.alert('Connexion requise', 'Connectez-vous pour réserver.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Se connecter', onPress: () => navigation.navigate('Login' as never) },
            ]);
            return;
        }
        setReservingSaleId(sale.id);
        try {
            const ticket = await reserveFlashSaleSlot(sale.id, 1);
            setActiveTickets(prev => ({ ...prev, [sale.id]: ticket }));
            if (ticket.status === 'pending') {
                Alert.alert('Réservation en cours', 'Votre réservation est en cours de traitement...');
                pollTicketStatus(ticket.ticket_id, sale.id);
            } else if (ticket.status === 'confirmed') {
                Alert.alert('Réservation confirmée', 'Votre réservation a été confirmée !');
                loadFlashSales();
            } else {
                Alert.alert('Échec', ticket.message || 'Impossible de réserver.');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de réserver.');
        } finally {
            setReservingSaleId(null);
        }
    };

    const userId = user?.id ? (typeof user.id === 'string' ? parseInt(user.id, 10) : user.id) : 0;

    if (loading && !session) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement du live...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!session) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <SafeIcon name="video-off" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyText}>Ce live n'est plus disponible</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.backBtnText}>Retour</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const isLive = session.status === 'live' || session.status === 'active';

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    {isLive && (
                        <View style={styles.liveBadge}>
                            <SafeIcon name="radio" size={10} color="#FFF" />
                            <Text style={styles.liveBadgeText}>LIVE</Text>
                        </View>
                    )}
                    <Text style={styles.headerTitle} numberOfLines={1}>{session.title}</Text>
                </View>
                <View style={styles.headerRight}>
                    <SafeIcon name="users" size={16} color="#FFF" />
                    <Text style={styles.viewerCountText}>{session.current_viewers || 0}</Text>
                </View>
            </View>

            {/* Video area placeholder */}
            <View style={styles.videoArea}>
                <SafeIcon name="video" size={64} color="#9CA3AF" />
                <Text style={styles.videoPlaceholderText}>
                    {isLive ? 'Diffusion en direct' : 'En attente du live...'}
                </Text>
                {session.description && (
                    <Text style={styles.descriptionText} numberOfLines={3}>{session.description}</Text>
                )}
            </View>

            {/* Flash Sales + Controls */}
            <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
                {/* Flash Sales section */}
                {flashSales.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Ventes Flash</Text>
                        {flashSales.map(sale => {
                            const startsAtMs = new Date(sale.start_at).getTime();
                            const endsAtMs = new Date(sale.end_at).getTime();
                            const isEnded = nowMs >= endsAtMs;
                            const isUpcoming = nowMs < startsAtMs;
                            const timeDiff = isUpcoming ? startsAtMs - nowMs : endsAtMs - nowMs;
                            const isSoldOut = sale.reserved_quantity >= sale.stock_target;
                            const ratio = sale.stock_target > 0
                                ? Math.min(100, Math.round((sale.reserved_quantity / sale.stock_target) * 100))
                                : 0;
                            const ticket = activeTickets[sale.id];
                            const canReserve = !isEnded && !isUpcoming && !isSoldOut
                                && reservingSaleId !== sale.id
                                && ticket?.status !== 'pending' && ticket?.status !== 'confirmed';
                            const linked = sale.linked_service;
                            const isUrgent = !isEnded && !isUpcoming && timeDiff < 5 * 60 * 1000;

                            return (
                                <View key={sale.id} style={styles.flashCard}>
                                    {linked?.cover_media && (
                                        <Image source={{ uri: linked.cover_media }} style={styles.flashImage} resizeMode="cover" />
                                    )}
                                    <View style={styles.flashContent}>
                                        <View style={styles.flashHeader}>
                                            <Text style={styles.flashTitle}>{linked?.title || `Produit #${sale.service_id}`}</Text>
                                            <View style={[styles.statusPill, isUrgent && styles.urgentPill]}>
                                                <Text style={[styles.statusPillText, isUrgent && styles.urgentPillText]}>
                                                    {isEnded ? 'Terminé' : isUpcoming
                                                        ? `Dans ${formatRelativeTime(timeDiff)}`
                                                        : `Fin ${formatRelativeTime(timeDiff)}`}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.flashPrice}>{sale.promo_price_cfa.toLocaleString('fr-FR')} CFA</Text>

                                        {/* Stock progress */}
                                        <View style={styles.stockRow}>
                                            <Text style={styles.stockLabel}>{sale.reserved_quantity}/{sale.stock_target} réservés</Text>
                                            <Text style={styles.stockPercent}>{ratio}%</Text>
                                        </View>
                                        <View style={styles.progressBar}>
                                            <View style={[styles.progressFill, { width: `${ratio}%` }, isUrgent && styles.urgentProgress]} />
                                        </View>

                                        {/* Reserve button */}
                                        <TouchableOpacity
                                            style={[
                                                styles.reserveBtn,
                                                !canReserve && styles.reserveBtnDisabled,
                                                !user && styles.loginBtn,
                                            ]}
                                            onPress={() => handleReserve(sale)}
                                            disabled={(!canReserve && !!user) || reservingSaleId === sale.id}
                                        >
                                            {reservingSaleId === sale.id ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <Text style={styles.reserveBtnText}>
                                                    {isEnded ? 'Terminé'
                                                        : isUpcoming ? 'Bientôt'
                                                        : isSoldOut ? 'Épuisé'
                                                        : ticket?.status === 'pending' ? 'Traitement...'
                                                        : ticket?.status === 'confirmed' ? 'Réservé'
                                                        : user ? 'Réserver' : 'Se connecter'}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Linked services */}
                {session.linked_services && session.linked_services.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Services liés</Text>
                        {session.linked_services.map((svc: any) => (
                            <TouchableOpacity
                                key={svc.id}
                                style={styles.linkedServiceCard}
                                onPress={() => (navigation as any).navigate('ServiceDetail', { serviceId: svc.id })}
                            >
                                {svc.cover_media && (
                                    <Image source={{ uri: svc.cover_media }} style={styles.linkedImage} resizeMode="cover" />
                                )}
                                <View style={styles.linkedContent}>
                                    <Text style={styles.linkedTitle}>{svc.title || `Service #${svc.id}`}</Text>
                                    {svc.short_description && (
                                        <Text style={styles.linkedDesc} numberOfLines={2}>{svc.short_description}</Text>
                                    )}
                                </View>
                                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Bottom controls */}
            <View style={styles.bottomBar}>
                <TouchableOpacity style={styles.bottomBtn} onPress={() => setShowChat(true)}>
                    <SafeIcon name="message-circle" size={20} color="#FFF" />
                    <Text style={styles.bottomBtnText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.bottomBtn}
                    onPress={async () => {
                        try {
                            await Share.share({
                                message: `Regardez le live "${session.title}" sur Yukpo !`,
                            });
                        } catch (_e) { /* cancelled */ }
                    }}
                >
                    <SafeIcon name="Redo2" size={20} color="#FFF" />
                    <Text style={styles.bottomBtnText}>Partager</Text>
                </TouchableOpacity>
            </View>

            {/* Chat Modal */}
            <LiveChatModal
                visible={showChat}
                sessionId={sessionId}
                userId={userId}
                onClose={() => setShowChat(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { color: '#9CA3AF', fontSize: 16 },
    emptyText: { color: '#9CA3AF', fontSize: 18, fontWeight: '600' },
    backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: modernColors.primary, borderRadius: 8 },
    backBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.8)',
    },
    headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, gap: 8 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4 },
    liveBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    viewerCountText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

    videoArea: {
        height: 220, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', gap: 12,
    },
    videoPlaceholderText: { color: '#9CA3AF', fontSize: 16 },
    descriptionText: { color: '#6B7280', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

    scrollArea: { flex: 1, backgroundColor: '#FFF' },
    scrollContent: { padding: 16 },

    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },

    flashCard: {
        backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', marginBottom: 12,
        borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    flashImage: { width: '100%', height: 120 },
    flashContent: { padding: 12 },
    flashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    flashTitle: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
    statusPill: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    statusPillText: { color: '#6366F1', fontSize: 11, fontWeight: '600' },
    urgentPill: { backgroundColor: '#FEF2F2' },
    urgentPillText: { color: '#DC2626' },
    flashPrice: { fontSize: 20, fontWeight: '700', color: modernColors.primary, marginBottom: 8 },
    stockRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    stockLabel: { fontSize: 12, color: '#6B7280' },
    stockPercent: { fontSize: 12, fontWeight: '600', color: '#111827' },
    progressBar: { height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
    progressFill: { height: '100%', backgroundColor: modernColors.primary, borderRadius: 3 },
    urgentProgress: { backgroundColor: '#DC2626' },

    reserveBtn: { backgroundColor: modernColors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    reserveBtnDisabled: { backgroundColor: '#D1D5DB' },
    loginBtn: { backgroundColor: '#6366F1' },
    reserveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

    linkedServiceCard: {
        flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB',
        borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
    },
    linkedImage: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
    linkedContent: { flex: 1 },
    linkedTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
    linkedDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },

    bottomBar: {
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.9)',
    },
    bottomBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
    bottomBtnText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
});
