import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
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
    const { t } = useLanguageSafe();
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
            Alert.alert(t('message.error'), error.message || t('flashSale.cannotLoad'));
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
                            Alert.alert(t('flashSale.reservationConfirmed'), t('flashSale.reservationConfirmedMsg'));
                            loadFlashSales(); // Recharger pour mettre à jour le stock
                        } else if (updatedTicket.status === 'failed' || updatedTicket.status === 'out_of_stock') {
                            Alert.alert(t('flashSale.reservationFailed'), updatedTicket.message || t('flashSale.cannotConfirm'));
                        }
                        return;
                    }

                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(poll, 2000);
                    } else {
                        Alert.alert(t('flashSale.timeExpired'), t('flashSale.timeExpiredMsg'));
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
            Alert.alert(t('flashSale.loginRequired'), t('flashSale.loginRequiredMsg'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.login'), onPress: () => navigation.navigate('Login' as never) },
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
                Alert.alert(t('flashSale.reservationPending'), t('flashSale.reservationPendingMsg'));
                pollTicketStatus(ticket.ticket_id, sale.id);
            } else if (ticket.status === 'confirmed') {
                Alert.alert(t('flashSale.reservationConfirmed'), t('flashSale.reservationConfirmedMsg'));
                loadFlashSales();
            } else {
                Alert.alert(t('flashSale.reservationFailed'), ticket.message || t('flashSale.cannotReserve'));
            }
        } catch (error: any) {
            console.error('[FlashSaleScreen] Erreur réservation:', error);
            Alert.alert(t('message.error'), error.message || t('flashSale.cannotReserve'));
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
                    <Text style={styles.loadingText}>{t('flashSale.chargementDesVentesFlash')}</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{t('flashSale.retour')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('flashSale.ventesFlash')}</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {flashSales.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>{t('flashSale.aucuneVenteFlashDisponible')}</Text>
                        <Text style={styles.emptyStateSubtext}>{t('flashSale.revenezPlusTardPourDecouvrir')}</Text>
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
                            ? t('flashSaleScreen.termine')
                            : isUpcoming
                                ? t('flashSaleScreen.debuteDans', { formatRelativeTime_timeDi: formatRelativeTime(timeDiff) })
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
                            ? t('flashSaleScreen.termine')
                            : isUpcoming
                                ? t('flashSaleScreen.bientotDisponible')
                                : isSoldOut
                                    ? t('flashSaleScreen.stockEpuise')
                                    : ticketStatus === 'pending'
                                        ? 'Traitement...'
                                        : ticketStatus === 'confirmed'
                                            ? t('flashSaleScreen.reserve')
                                            : reservingSaleId === sale.id
                                                ? t('flashSaleScreen.reservation')
                                                : user
                                                    ? t('flashSaleScreen.reserver')
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

                                    <View style={styles.actionRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.reserveButton,
                                                (!canReserve || reservingSaleId === sale.id) && styles.reserveButtonDisabled,
                                                !user && styles.loginButton,
                                            ]}
                                            onPress={() => handleReserve(sale)}
                                            disabled={(!canReserve && !!user) || reservingSaleId === sale.id}
                                        >
                                            {reservingSaleId === sale.id ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <Text style={[styles.reserveButtonText, !user && styles.loginButtonText]}>{buttonLabel}</Text>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.shareIconButton}
                                            onPress={async () => {
                                                try {
                                                    await Share.share({
                                                        message: t('flashSaleScreen.venteFlashACfaDecouvrezSur', { linked?_title || 'Produit': linked?.title || 'Produit', sale_promo_price_cfa_toLocaleString('fr-FR'): sale.promo_price_cfa.toLocaleString('fr-FR') }),
                                                    });
                                                } catch (_e) { /* cancelled */ }
                                            }}
                                        >
                                            <Text style={styles.shareIconText}>{t('flashSaleScreen.partager')}</Text>
                                        </TouchableOpacity>
                                    </View>
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
    loginButton: {
        backgroundColor: '#6366F1',
    },
    loginButtonText: {
        color: '#FFFFFF',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    shareIconButton: {
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    shareIconText: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '500',
    },
});

export default FlashSaleScreen;

