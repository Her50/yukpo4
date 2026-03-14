/**
 * Sélecteur de sièges amélioré avec zoom, indicateurs premium, et recommandations
 */

import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

export interface SelectedSeat {
    seat_id: string;
    seat_number: number;
    row: number;
    col: number;
    is_premium?: boolean;
    seat_type?: 'window' | 'aisle' | 'middle';
}

interface EnhancedBusSeatSelectorProps {
    visible: boolean;
    onClose: () => void;
    productId: string;
    ticketPrice: number;
    currency?: string;
    onReserve: (selectedSeats: SelectedSeat[], totalPrice: number) => void;
}

interface SeatRecommendation {
    seat_id: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 3;

const EnhancedBusSeatSelector: React.FC<EnhancedBusSeatSelectorProps> = ({
    visible,
    onClose,
    productId,
    ticketPrice,
    currency = 'XAF',
    onReserve,
}) => {
    const [loading, setLoading] = useState(true);
    const [seatMap, setSeatMap] = useState<any[]>([]);
    const [reservedSeats, setReservedSeats] = useState<string[]>([]);
    const [blockedSeats, setBlockedSeats] = useState<string[]>([]);
    const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
    const [recommendations, setRecommendations] = useState<SeatRecommendation[]>([]);
    const [showPremiumOnly, setShowPremiumOnly] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const maxSeats = 10;

    // Animations pour zoom
    const scale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (visible && productId) {
            loadSeatAvailability();
        } else {
            resetState();
        }
    }, [visible, productId]);

    const resetState = () => {
        setSelectedSeats([]);
        setSeatMap([]);
        setReservedSeats([]);
        setBlockedSeats([]);
        setRecommendations([]);
        setZoomLevel(1);
        scale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
    };

    const loadSeatAvailability = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/bus-tickets/${productId}/availability`);
            const resData = (response?.data || response) as any;

            if (resData.success && resData.availability) {
                const availability = resData.availability;
                setSeatMap(availability.seat_map || []);
                setReservedSeats(availability.reserved_seats || []);
                setBlockedSeats(availability.blocked_seats || []);

                // Générer recommandations intelligentes
                generateRecommendations(availability.seat_map || [], availability.reserved_seats || []);
            } else {
                Alert.alert('Erreur', resData.error || 'Impossible de charger la disponibilité');
            }
        } catch (error: any) {
            console.error('Erreur chargement disponibilité:', error);
            Alert.alert('Erreur', 'Impossible de charger la disponibilité des places');
        } finally {
            setLoading(false);
        }
    };

    const generateRecommendations = (seats: any[], reserved: string[]) => {
        const recs: SeatRecommendation[] = [];

        // Recommander sièges fenêtre disponibles
        seats.forEach((seat) => {
            if (!reserved.includes(seat.seat_id) && seat.is_window) {
                recs.push({
                    seat_id: seat.seat_id,
                    reason: 'Fenêtre avec vue',
                    priority: 'high',
                });
            }
        });

        // Recommander sièges côte à côte si plusieurs personnes
        const availableSeats = seats.filter(s => !reserved.includes(s.seat_id));
        for (let i = 0; i < availableSeats.length - 1; i++) {
            const seat1 = availableSeats[i];
            const seat2 = availableSeats[i + 1];
            if (seat1.row === seat2.row && Math.abs(seat1.col - seat2.col) === 1) {
                recs.push({
                    seat_id: seat1.seat_id,
                    reason: 'Sièges côte à côte disponibles',
                    priority: 'medium',
                });
            }
        }

        setRecommendations(recs.slice(0, 5)); // Limiter à 5 recommandations
    };

    const getSeatStatus = (seatId: string): 'available' | 'reserved' | 'blocked' | 'selected' | 'recommended' => {
        if (selectedSeats.some((s) => s.seat_id === seatId)) {
            return 'selected';
        }
        if (recommendations.some((r) => r.seat_id === seatId)) {
            return 'recommended';
        }
        if (reservedSeats.includes(seatId)) {
            return 'reserved';
        }
        if (blockedSeats.includes(seatId)) {
            return 'blocked';
        }
        return 'available';
    };

    const handleSeatPress = (seat: any) => {
        const status = getSeatStatus(seat.seat_id);

        if (status === 'reserved' || status === 'blocked') {
            Alert.alert(
                'Place non disponible',
                status === 'reserved'
                    ? 'Cette place est déjà réservée'
                    : 'Cette place n\'est pas disponible (bloquée manuellement)'
            );
            return;
        }

        if (status === 'selected') {
            setSelectedSeats(selectedSeats.filter((s) => s.seat_id !== seat.seat_id));
        } else {
            if (selectedSeats.length >= maxSeats) {
                Alert.alert('Limite atteinte', `Vous ne pouvez sélectionner que ${maxSeats} places maximum`);
                return;
            }
            setSelectedSeats([
                ...selectedSeats,
                {
                    seat_id: seat.seat_id,
                    seat_number: seat.seat_number,
                    row: seat.row,
                    col: seat.col,
                    is_premium: seat.is_premium || seat.is_window,
                    seat_type: seat.seat_type || (seat.is_window ? 'window' : seat.is_aisle ? 'aisle' : 'middle'),
                },
            ]);
        }
    };

    const pinchHandler = useAnimatedGestureHandler({
        onStart: (_, ctx: any) => {
            ctx.startScale = scale.value;
        },
        onActive: (event: any, ctx: any) => {
            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ctx.startScale * event.scale));
            scale.value = newScale;
            setZoomLevel(newScale);
        },
        onEnd: () => {
            if (scale.value < MIN_SCALE) {
                scale.value = withSpring(MIN_SCALE);
                setZoomLevel(MIN_SCALE);
            } else if (scale.value > MAX_SCALE) {
                scale.value = withSpring(MAX_SCALE);
                setZoomLevel(MAX_SCALE);
            }
        },
    });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: scale.value },
                { translateX: translateX.value },
                { translateY: translateY.value },
            ],
        };
    });

    const getSeatStyle = (status: string, seat: any) => {
        const baseStyle = [styles.seat];

        switch (status) {
            case 'available':
                return [...baseStyle, styles.seatAvailable];
            case 'reserved':
                return [...baseStyle, styles.seatReserved];
            case 'blocked':
                return [...baseStyle, styles.seatBlocked];
            case 'selected':
                return [...baseStyle, styles.seatSelected];
            case 'recommended':
                return [...baseStyle, styles.seatRecommended];
            default:
                return [...baseStyle, styles.seatAvailable];
        }
    };

    const getSeatBadge = (seat: any) => {
        if (seat.is_premium || seat.is_window) {
            return <View style={styles.premiumBadge}><SafeIcon name="star" size={10} color="#FFD700" /></View>;
        }
        return null;
    };

    // Organiser les sièges par rangée
    const seatsByRow: { [key: number]: any[] } = {};
    const filteredSeats = showPremiumOnly
        ? seatMap.filter(s => s.is_premium || s.is_window)
        : seatMap;

    filteredSeats.forEach((seat) => {
        if (!seatsByRow[seat.row]) {
            seatsByRow[seat.row] = [];
        }
        seatsByRow[seat.row].push(seat);
    });

    const rows = Object.keys(seatsByRow)
        .map(Number)
        .sort((a, b) => a - b);

    const numberOfTickets = selectedSeats.length;
    const subtotal = ticketPrice * numberOfTickets;
    const premiumFee = selectedSeats.filter(s => s.is_premium).length * 1000; // 1000 FCFA par siège premium
    const bookingFee = 500;
    const totalPrice = subtotal + premiumFee + bookingFee;

    const handleReserve = () => {
        if (selectedSeats.length === 0) {
            Alert.alert('Aucune place sélectionnée', 'Veuillez sélectionner au moins une place');
            return;
        }
        onReserve(selectedSeats, totalPrice);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Sélection des places</Text>
                    <View style={styles.placeholder} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Chargement...</Text>
                    </View>
                ) : (
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Contrôles */}
                        <View style={styles.controls}>
                            <TouchableOpacity
                                style={[styles.filterButton, showPremiumOnly && styles.filterButtonActive]}
                                onPress={() => setShowPremiumOnly(!showPremiumOnly)}
                            >
                                <SafeIcon name="star" size={16} color={showPremiumOnly ? '#fff' : modernColors.primary} />
                                <Text style={[styles.filterButtonText, showPremiumOnly && styles.filterButtonTextActive]}>
                                    Premium uniquement
                                </Text>
                            </TouchableOpacity>
                            <View style={styles.zoomControls}>
                                <TouchableOpacity
                                    style={styles.zoomButton}
                                    onPress={() => {
                                        const newScale = Math.max(MIN_SCALE, scale.value - 0.2);
                                        scale.value = withSpring(newScale);
                                        setZoomLevel(newScale);
                                    }}
                                >
                                    <SafeIcon name="minus" size={16} color={modernColors.primary} />
                                </TouchableOpacity>
                                <Text style={styles.zoomText}>{String(Math.round(zoomLevel * 100))}%</Text>
                                <TouchableOpacity
                                    style={styles.zoomButton}
                                    onPress={() => {
                                        const newScale = Math.min(MAX_SCALE, scale.value + 0.2);
                                        scale.value = withSpring(newScale);
                                        setZoomLevel(newScale);
                                    }}
                                >
                                    <SafeIcon name="plus" size={16} color={modernColors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Recommandations */}
                        {recommendations.length > 0 && (
                            <View style={styles.recommendationsContainer}>
                                <Text style={styles.recommendationsTitle}>💡 Recommandations</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {recommendations.map((rec) => (
                                        <View key={rec.seat_id} style={styles.recommendationBadge}>
                                            <Text style={styles.recommendationText}>{rec.reason}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Légende */}
                        <View style={styles.legendContainer}>
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSeat, styles.seatAvailable]} />
                                    <Text style={styles.legendText}>Disponible</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSeat, styles.seatRecommended]} />
                                    <Text style={styles.legendText}>Recommandé</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSeat, styles.seatSelected]} />
                                    <Text style={styles.legendText}>Sélectionné</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSeat, styles.seatReserved]} />
                                    <Text style={styles.legendText}>Réservé</Text>
                                </View>
                            </View>
                        </View>

                        {/* Plan des sièges avec zoom */}
                        <GestureHandlerRootView>
                            <PinchGestureHandler onGestureEvent={pinchHandler}>
                                <Reanimated.View style={[styles.seatsContainer, animatedStyle]}>
                                    <Text style={styles.sectionTitle}>Plan des sièges (pincez pour zoomer)</Text>
                                    {rows.map((row) => (
                                        <View key={row} style={styles.row}>
                                            <Text style={styles.rowLabel}>R{row}</Text>
                                            <View style={styles.seatsRow}>
                                                {seatsByRow[row]
                                                    .sort((a, b) => a.col - b.col)
                                                    .map((seat) => {
                                                        const status = getSeatStatus(seat.seat_id);
                                                        return (
                                                            <TouchableOpacity
                                                                key={seat.seat_id}
                                                                style={[
                                                                    ...getSeatStyle(status, seat),
                                                                    (status === 'reserved' || status === 'blocked') &&
                                                                    styles.seatDisabled,
                                                                ]}
                                                                onPress={() => handleSeatPress(seat)}
                                                                disabled={status === 'reserved' || status === 'blocked'}
                                                            >
                                                                {getSeatBadge(seat)}
                                                                <Text style={[styles.seatNumber, { color: status === 'selected' || status === 'reserved' || status === 'blocked' ? '#fff' : '#111827' }]}>
                                                                    {seat.seat_number}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                            </View>
                                        </View>
                                    ))}
                                </Reanimated.View>
                            </PinchGestureHandler>
                        </GestureHandlerRootView>

                        {/* Informations sélection */}
                        {selectedSeats.length > 0 && (
                            <View style={styles.selectionInfo}>
                                <Text style={styles.selectionTitle}>
                                    {String(selectedSeats.length)} place{selectedSeats.length > 1 ? 's' : ''} sélectionnée{selectedSeats.length > 1 ? 's' : ''}
                                </Text>
                                <View style={styles.selectedSeatsList}>
                                    {selectedSeats.map((seat) => (
                                        <View key={seat.seat_id} style={styles.selectedSeatBadge}>
                                            <Text style={styles.selectedSeatText}>
                                                Place {seat.seat_number}{seat.is_premium ? ' ⭐' : ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Détail du paiement */}
                        <View style={styles.paymentBreakdown}>
                            <Text style={styles.breakdownTitle}>Détail du paiement</Text>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>
                                    Prix tickets ({numberOfTickets}x)
                                </Text>
                                <Text style={styles.breakdownValue}>
                                    {subtotal.toLocaleString()} {currency}
                                </Text>
                            </View>
                            {premiumFee > 0 && (
                                <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>Supplément premium</Text>
                                    <Text style={styles.breakdownValue}>
                                        {premiumFee.toLocaleString()} {currency}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>Frais de réservation</Text>
                                <Text style={styles.breakdownValue}>
                                    {bookingFee.toLocaleString()} {currency}
                                </Text>
                            </View>
                            <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                                <Text style={styles.breakdownTotalLabel}>Total</Text>
                                <Text style={styles.breakdownTotalValue}>
                                    {totalPrice.toLocaleString()} {currency}
                                </Text>
                            </View>
                        </View>

                        {/* Bouton réserver */}
                        <TouchableOpacity style={styles.reserveButton} onPress={handleReserve}>
                            <Text style={styles.reserveButtonText}>
                                Réserver {String(selectedSeats.length)} place{selectedSeats.length > 1 ? 's' : ''}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    closeButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    placeholder: {
        width: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
    },
    content: {
        flex: 1,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
    },
    filterButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    filterButtonTextActive: {
        color: '#fff',
    },
    zoomControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    zoomButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    zoomText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        minWidth: 50,
        textAlign: 'center',
    },
    recommendationsContainer: {
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    recommendationsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    recommendationBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        marginRight: 8,
    },
    recommendationText: {
        fontSize: 12,
        color: modernColors.primary,
    },
    legendContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    legendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendSeat: {
        width: 24,
        height: 24,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
        color: '#6B7280',
    },
    seatsContainer: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    rowLabel: {
        width: 30,
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    seatsRow: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    seat: {
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        position: 'relative',
    },
    seatAvailable: {
        backgroundColor: '#F3F4F6',
        borderColor: '#D1D5DB',
    },
    seatRecommended: {
        backgroundColor: '#DBEAFE',
        borderColor: modernColors.primary,
        borderWidth: 2,
    },
    seatSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    seatReserved: {
        backgroundColor: '#9CA3AF',
        borderColor: '#6B7280',
    },
    seatBlocked: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    seatDisabled: {
        opacity: 0.5,
    },
    seatNumber: {
        fontSize: 12,
        fontWeight: '600',
    },
    premiumBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
    },
    selectionInfo: {
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
    },
    selectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    selectedSeatsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectedSeatBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
    },
    selectedSeatText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    paymentBreakdown: {
        padding: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
    },
    breakdownTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    breakdownLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    breakdownValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    breakdownTotal: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    breakdownTotalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    breakdownTotalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    reserveButton: {
        margin: 16,
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    reserveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default EnhancedBusSeatSelector;


