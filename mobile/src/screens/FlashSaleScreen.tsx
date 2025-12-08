import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import {
    fetchActiveFlashSales,
    fetchFlashSalesBySession,
    getFlashSaleTicketStatus,
    reserveFlashSaleSlot,
    type FlashSaleReservationTicket,
    type LiveFlashSale,
} from '../services/flashSaleService';
import { modernColors } from '../theme/modernTheme';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300?text=Produit';

const formatRelativeTime = (ms: number): string => {
    if (ms <= 0) return '0s';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${seconds}s`;
};

const FlashSaleScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const sessionId = (route.params as any)?.sessionId;

    const [flashSales, setFlashSales] = useState<LiveFlashSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reservingSaleId, setReservingSaleId] = useState<string | null>(null);
    const [activeTickets, setActiveTickets] = useState<Record<string, FlashSaleReservationTicket>>({});
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => {
            // ✅ SÉCURITÉ: Vérifier que interval existe avant de le nettoyer
            if (interval) {
                clearInterval(interval);
            }
        };
    }, []);

    const loadFlashSales = useCallback(async () => {
        try {
            setLoading(true);
            const sales = sessionId
                ? await fetchFlashSalesBySession(sessionId)
                : await fetchActiveFlashSales();
            setFlashSales(sales);
        } catch (error: any) {
            console.error('[FlashSaleScreen] Erreur chargement flash sales:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les ventes flash');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [sessionId]);

    useEffect(() => {
        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        loadFlashSales().catch(error => {
            console.error('[FlashSaleScreen] Erreur loadFlashSales:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [loadFlashSales]);

    const pollTicketStatus = useCallback(
        async (ticketId: string, flashSaleId: string) => {
            const maxAttempts = 15; // 30 secondes max (15 * 2s)
            let attempts = 0;

            const poll = async () => {
                try {
                    const updatedTicket = await getFlashSaleTicketStatus(ticketId);
                    setActiveTickets((prev) => ({
                        ...prev,
                        [flashSaleId]: updatedTicket,
                    }));

                    if (updatedTicket.status !== 'pending') {
                        if (updatedTicket.status === 'confirmed') {
                            Alert.alert('✅ Réservation confirmée', 'Votre réservation a été confirmée avec succès !');
                            loadFlashSales(); // Recharger pour mettre à jour le stock
                        } else if (updatedTicket.status === 'failed' || updatedTicket.status === 'out_of_stock') {
                            Alert.alert('❌ Réservation échouée', updatedTicket.message || 'Impossible de confirmer votre réservation');
                        }
                        return;
                    }

                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(poll, 2000);
                    } else {
                        Alert.alert('⏱️ Temps écoulé', 'Le traitement de votre réservation prend plus de temps que prévu. Vérifiez votre statut plus tard.');
                    }
                } catch (error: any) {
                    console.error('[FlashSaleScreen] Erreur polling ticket:', error);
                }
            };

            setTimeout(poll, 2000);
        },
        [loadFlashSales]
    );

    const handleReserve = async (sale: LiveFlashSale) => {
        if (!user) {
            Alert.alert('Connexion requise', 'Connectez-vous pour réserver cette promotion.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Se connecter', onPress: () => navigation.navigate('Login' as never) },
            ]);
            return;
        }

        setReservingSaleId(sale.id);
        try {
            const ticket = await reserveFlashSaleSlot(sale.id, 1);
            setActiveTickets((prev) => ({
                ...prev,
                [sale.id]: ticket,
            }));

            if (ticket.status === 'pending') {
                Alert.alert('⏳ Réservation en cours', 'Votre réservation est en cours de traitement...');
                pollTicketStatus(ticket.ticket_id, sale.id);
            } else if (ticket.status === 'confirmed') {
                Alert.alert('✅ Réservation confirmée', 'Votre réservation a été confirmée avec succès !');
                loadFlashSales();
            } else {
                Alert.alert('❌ Réservation échouée', ticket.message || 'Impossible de réserver cette vente flash');
            }
        } catch (error: any) {
            console.error('[FlashSaleScreen] Erreur réservation:', error);
            Alert.alert('Erreur', error.message || 'Impossible de réserver cette vente flash');
        } finally {
            setReservingSaleId(null);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadFlashSales();
    }, [loadFlashSales]);

    if (loading && flashSales.length === 0) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement des ventes flash...</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Retour</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>🔥 Ventes Flash</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {flashSales.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>Aucune vente flash disponible</Text>
                        <Text style={styles.emptyStateSubtext}>Revenez plus tard pour découvrir les promotions</Text>
                    </View>
                ) : (
                    flashSales.map((sale) => {
                        const linked = sale.linked_service;
                        const image = linked?.cover_media || linked?.gallery?.[0] || PLACEHOLDER_IMAGE;
                        const startsAtMs = new Date(sale.start_at).getTime();
                        const endsAtMs = new Date(sale.end_at).getTime();
                        const isEnded = nowMs >= endsAtMs;
                        const isUpcoming = nowMs < startsAtMs;
                        const timeDiff = isUpcoming ? startsAtMs - nowMs : endsAtMs - nowMs;
                        const statusLabel = isEnded
                            ? 'Terminé'
                            : isUpcoming
                                ? `Débute dans ${formatRelativeTime(timeDiff)}`
                                : `En cours · fin dans ${formatRelativeTime(timeDiff)}`;
                        const isSoldOut = sale.reserved_quantity >= sale.stock_target;
                        const ratio =
                            sale.stock_target > 0
                                ? Math.min(100, Math.round((sale.reserved_quantity / sale.stock_target) * 100))
                                : 0;

                        const ticket = activeTickets[sale.id];
                        const ticketStatus = ticket?.status;
                        const canReserve =
                            !isEnded &&
                            !isUpcoming &&
                            !isSoldOut &&
                            reservingSaleId !== sale.id &&
                            ticketStatus !== 'pending' &&
                            ticketStatus !== 'confirmed';

                        const buttonLabel = isEnded
                            ? 'Terminé'
                            : isUpcoming
                                ? 'Bientôt disponible'
                                : isSoldOut
                                    ? 'Stock épuisé'
                                    : ticketStatus === 'pending'
                                        ? 'Traitement...'
                                        : ticketStatus === 'confirmed'
                                            ? '✅ Réservé'
                                            : reservingSaleId === sale.id
                                                ? 'Réservation...'
                                                : user
                                                    ? 'Réserver'
                                                    : 'Se connecter';

                        return (
                            <View key={sale.id} style={styles.saleCard}>
                                <View style={styles.imageContainer}>
                                    <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
                                    <View style={styles.statusBadge}>
                                        <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                                    </View>
                                </View>

                                <View style={styles.cardContent}>
                                    <Text style={styles.saleTitle}>{linked?.title || `Produit #${sale.service_id}`}</Text>
                                    {linked?.short_description && (
                                        <Text style={styles.saleDescription} numberOfLines={2}>
                                            {linked.short_description}
                                        </Text>
                                    )}

                                    <View style={styles.priceContainer}>
                                        <Text style={styles.promoPrice}>
                                            {sale.promo_price_cfa.toLocaleString('fr-FR')} CFA
                                        </Text>
                                        {linked?.price && (
                                            <Text style={styles.originalPrice}>Prix: {linked.price}</Text>
                                        )}
                                    </View>

                                    <View style={styles.stockContainer}>
                                        <View style={styles.stockInfo}>
                                            <Text style={styles.stockText}>
                                                Réservations: {sale.reserved_quantity}/{sale.stock_target}
                                            </Text>
                                            <Text style={styles.stockPercent}>{ratio}%</Text>
                                        </View>
                                        <View style={styles.progressBar}>
                                            <View style={[styles.progressFill, { width: `${ratio}%` }]} />
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[
                                            styles.reserveButton,
                                            (!canReserve || reservingSaleId === sale.id) && styles.reserveButtonDisabled,
                                        ]}
                                        onPress={() => handleReserve(sale)}
                                        disabled={!canReserve || reservingSaleId === sale.id}
                                    >
                                        {reservingSaleId === sale.id ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.reserveButtonText}>{buttonLabel}</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e5e5',
    },
    backButton: {
        padding: 8,
    },
    backButtonText: {
        fontSize: 16,
        color: modernColors.primary,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    placeholder: {
        width: 60,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    saleCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        height: 200,
        backgroundColor: '#e5e5e5',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    statusBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    cardContent: {
        padding: 16,
    },
    saleTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    saleDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    priceContainer: {
        marginBottom: 12,
    },
    promoPrice: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.primary,
        marginBottom: 4,
    },
    originalPrice: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    stockContainer: {
        marginBottom: 16,
    },
    stockInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    stockText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    stockPercent: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    progressBar: {
        height: 6,
        backgroundColor: '#e5e5e5',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
    },
    reserveButton: {
        backgroundColor: modernColors.primary,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reserveButtonDisabled: {
        backgroundColor: '#ccc',
    },
    reserveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default FlashSaleScreen;

