/**
 * Composant modal interactif pour sélectionner visuellement les sièges d'un bus
 */

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

export interface SelectedSeat {
    seat_id: string;
    seat_number: number;
    row: number;
    col: number;
}

interface BusSeatSelectorProps {
    visible: boolean;
    onClose: () => void;
    productId: string;
    ticketPrice: number;
    currency?: string;
    onReserve: (selectedSeats: SelectedSeat[], totalPrice: number) => void;
}

const BusSeatSelector: React.FC<BusSeatSelectorProps> = ({
    visible,
    onClose,
    productId,
    ticketPrice,
    currency = 'XAF',
    onReserve,
}) => {
        const { t } = useLanguageSafe();
const [loading, setLoading] = useState(true);
    const [seatMap, setSeatMap] = useState<any[]>([]);
    const [reservedSeats, setReservedSeats] = useState<string[]>([]);
    const [blockedSeats, setBlockedSeats] = useState<string[]>([]);
    const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
    const [maxSeats] = useState(10); // Limite de sélection

    useEffect(() => {
        if (visible && productId) {
            loadSeatAvailability();
        } else {
            // Réinitialiser lors de la fermeture
            setSelectedSeats([]);
            setSeatMap([]);
            setReservedSeats([]);
            setBlockedSeats([]);
        }
    }, [visible, productId]);

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

    const getSeatStatus = (seatId: string): 'available' | 'reserved' | 'blocked' | 'selected' => {
        if (selectedSeats.some((s) => s.seat_id === seatId)) {
            return 'selected';
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
                    ? t('busSeatSelector.cettePlaceEstDejaReservee')
                    : 'Cette place n\'est pas disponible (bloquée manuellement)'
            );
            return;
        }

        if (status === 'selected') {
            // Désélectionner
            setSelectedSeats(selectedSeats.filter((s) => s.seat_id !== seat.seat_id));
        } else {
            // Sélectionner (si pas de limite atteinte)
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
                },
            ]);
        }
    };

    const getSeatStyle = (status: string) => {
        switch (status) {
            case 'available':
                return styles.seatAvailable;
            case 'reserved':
                return styles.seatReserved;
            case 'blocked':
                return styles.seatBlocked;
            case 'selected':
                return styles.seatSelected;
            default:
                return styles.seatAvailable;
        }
    };

    const getSeatTextColor = (status: string) => {
        switch (status) {
            case 'reserved':
            case 'blocked':
                return '#fff';
            case 'selected':
                return '#fff';
            default:
                return '#111827';
        }
    };

    // Organiser les sièges par rangée
    const seatsByRow: { [key: number]: any[] } = {};
    seatMap.forEach((seat) => {
        if (!seatsByRow[seat.row]) {
            seatsByRow[seat.row] = [];
        }
        seatsByRow[seat.row].push(seat);
    });

    const rows = Object.keys(seatsByRow)
        .map(Number)
        .sort((a, b) => a - b);

    // Calculer le total
    const numberOfTickets = selectedSeats.length;
    const subtotal = ticketPrice * numberOfTickets;
    const bookingFee = 500; // FCFA fixe
    const totalPrice = subtotal + bookingFee;

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
                    <Text style={styles.title}>{t('busSeatSelector.selectionDesPlaces')}</Text>
                    <View style={styles.placeholder} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>{t('busSeatSelector.chargementDeLaDisponibilite')}</Text>
                    </View>
                ) : (
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Légende */}
                        <View style={styles.legendContainer}>
                            <Text style={styles.legendTitle}>{t('busSeatSelector.legende')}</Text>
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSeat, styles.seatAvailable]} />
                                    <Text style={styles.legendText}>{t('busSeatSelector.disponible')}</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSeat, styles.seatReserved]} />
                                    <Text style={styles.legendText}>{t('busSeatSelector.reserve')}</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSeat, styles.seatBlocked]} />
                                    <Text style={styles.legendText}>{t('busSeatSelector.bloque')}</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSeat, styles.seatSelected]} />
                                    <Text style={styles.legendText}>{t('busSeatSelector.selectionne')}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Plan des sièges */}
                        <View style={styles.seatsContainer}>
                            <Text style={styles.sectionTitle}>{t('busSeatSelector.planDesSieges')}</Text>
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
                                                            styles.seat,
                                                            getSeatStyle(status),
                                                            (status === 'reserved' || status === 'blocked') &&
                                                            styles.seatDisabled,
                                                        ]}
                                                        onPress={() => handleSeatPress(seat)}
                                                        disabled={status === 'reserved' || status === 'blocked'}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.seatNumber,
                                                                { color: getSeatTextColor(status) },
                                                            ]}
                                                        >
                                                            {seat.seat_number}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Informations sélection */}
                        {selectedSeats.length > 0 && (
                            <View style={styles.selectionInfo}>
                                <Text style={styles.selectionTitle}>
                                    {selectedSeats.length} place{selectedSeats.length > 1 ? 's' : ''} sélectionnée
                                    {selectedSeats.length > 1 ? 's' : ''}
                                </Text>
                                <View style={styles.selectedSeatsList}>
                                    {selectedSeats.map((seat) => (
                                        <View key={seat.seat_id} style={styles.selectedSeatBadge}>
                                            <Text style={styles.selectedSeatText}>Place {seat.seat_number}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Détail du paiement */}
                        <View style={styles.paymentBreakdown}>
                            <Text style={styles.breakdownTitle}>{t('busSeatSelector.detailDuPaiement')}</Text>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>
                                    Prix tickets ({numberOfTickets}x)
                                </Text>
                                <Text style={styles.breakdownValue}>
                                    {subtotal.toLocaleString()} {currency}
                                </Text>
                            </View>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>{t('busSeatSelector.fraisDeReservation')}</Text>
                                <Text style={styles.breakdownValue}>
                                    {bookingFee.toLocaleString()} {currency}
                                </Text>
                            </View>
                            <View style={[styles.breakdownRow, styles.commissionRow]}>
                                <Text style={styles.commissionLabel}>
                                    Commission Yukpo (5%)
                                </Text>
                                <Text style={styles.commissionValue}>
                                    {Math.round(subtotal * 0.05).toLocaleString()} {currency}
                                </Text>
                            </View>
                            <View style={[styles.breakdownRow, styles.totalRow]}>
                                <Text style={styles.totalLabel}>{t('busSeatSelector.totalAPayer')}</Text>
                                <Text style={styles.totalValue}>
                                    {totalPrice.toLocaleString()} {currency}
                                </Text>
                            </View>
                            <Text style={styles.note}>
                                Note: {Math.round(subtotal * 0.95).toLocaleString()} {currency} seront reversés à l'agence
                            </Text>
                        </View>
                    </ScrollView>
                )}

                {/* Footer avec bouton réserver */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.reserveButton,
                            selectedSeats.length === 0 && styles.reserveButtonDisabled,
                        ]}
                        onPress={handleReserve}
                        disabled={selectedSeats.length === 0}
                    >
                        <Text style={styles.reserveButtonText}>
                            Réserver avec caution ({totalPrice.toLocaleString()} {currency})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
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
        gap: 16,
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    legendContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    legendTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
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
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    legendText: {
        fontSize: 12,
        color: '#6B7280',
    },
    seatsContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
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
        textAlign: 'right',
        marginRight: 12,
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
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    seatAvailable: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
    },
    seatReserved: {
        backgroundColor: '#9CA3AF',
        borderColor: '#6B7280',
    },
    seatBlocked: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    seatSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    seatDisabled: {
        opacity: 0.6,
    },
    seatNumber: {
        fontSize: 12,
        fontWeight: '600',
    },
    selectionInfo: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    selectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E40AF',
        marginBottom: 12,
    },
    selectedSeatsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectedSeatBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    selectedSeatText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    paymentBreakdown: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    breakdownTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
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
    commissionRow: {
        backgroundColor: '#FEF3C7',
        padding: 8,
        borderRadius: 8,
        marginBottom: 8,
    },
    commissionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#92400E',
    },
    commissionValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400E',
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    note: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
        fontStyle: 'italic',
    },
    footer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    reserveButton: {
        backgroundColor: modernColors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    reserveButtonDisabled: {
        backgroundColor: '#D1D5DB',
        opacity: 0.6,
    },
    reserveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default BusSeatSelector;

