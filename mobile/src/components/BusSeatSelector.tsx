// @ts-nocheck
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from './SafeIcon';

const modernColors = {
    primary: '#6366F1',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    text: '#1F2937',
    textSecondary: '#6B7280',
    background: '#F9FAFB',
    surface: '#FFFFFF',
    border: '#E5E7EB',
};

interface Seat {
    id: string;
    number: number;
    row: number;
    col: number;
    status: 'available' | 'reserved' | 'occupied';
    type: 'standard' | 'vip' | 'handicapped';
}

interface BusConfiguration {
    rows: number;
    seatsPerRow: number;
    aislePosition: number;
}

interface BusSeatSelectorProps {
    visible: boolean;
    onClose: () => void;
    busConfiguration: BusConfiguration;
    seatMap: Seat[];
    onSelectSeat: (seat: Seat) => void;
    selectedSeatNumber?: number;
    product: any;
}

const BusSeatSelector: React.FC<BusSeatSelectorProps> = ({
    visible,
    onClose,
    busConfiguration,
    seatMap,
    onSelectSeat,
    selectedSeatNumber,
    product
}) => {
    const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

    const getSeatStyle = (seat: Seat) => {
        if (seat.type === 'driver') {
            return styles.seatDriver;
        }
        if (seat.status === 'occupied' || seat.status === 'reserved') {
            return styles.seatOccupied;
        }
        if (selectedSeat?.id === seat.id || seat.number === selectedSeatNumber) {
            return styles.seatSelected;
        }
        return styles.seatAvailable;
    };

    const getSeatIcon = (seat: Seat) => {
        if (seat.type === 'driver') {
            return '🚗';
        }
        if (seat.status === 'occupied' || seat.status === 'reserved') {
            return '🔒';
        }
        if (selectedSeat?.id === seat.id || seat.number === selectedSeatNumber) {
            return '✓';
        }
        return seat.number;
    };

    const handleSeatPress = (seat: Seat) => {
        if (seat.status === 'available' && seat.type !== 'driver') {
            setSelectedSeat(seat);
        }
    };

    const handleConfirm = () => {
        if (selectedSeat) {
            onSelectSeat(selectedSeat);
            onClose();
        }
    };

    const availableSeats = seatMap.filter(s => s.status === 'available').length;
    const reservedSeats = seatMap.filter(s => s.status === 'reserved' || s.status === 'occupied').length;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>🚌 Sélectionnez votre place</Text>
                            <Text style={styles.headerSubtitle}>
                                {product.depart} → {product.destination}
                            </Text>
                            <Text style={styles.headerInfo}>
                                {product.dateDepart} à {product.heureDepart}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    </View>

                    {/* Statistiques */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <View style={[styles.statIndicator, { backgroundColor: modernColors.success }]} />
                            <Text style={styles.statText}>{availableSeats} disponibles</Text>
                        </View>
                        <View style={styles.statItem}>
                            <View style={[styles.statIndicator, { backgroundColor: '#9CA3AF' }]} />
                            <Text style={styles.statText}>{reservedSeats} réservées</Text>
                        </View>
                        {selectedSeat && (
                            <View style={styles.statItem}>
                                <View style={[styles.statIndicator, { backgroundColor: modernColors.primary }]} />
                                <Text style={styles.statText}>Place {selectedSeat.number}</Text>
                            </View>
                        )}
                    </View>

                    {/* Plan du bus */}
                    <ScrollView style={styles.busContainer} showsVerticalScrollIndicator={false}>
                        {/* Avant du bus */}
                        <View style={styles.busFront}>
                            <SafeIcon name="navigation" size={20} color="#FFFFFF" />
                            <Text style={styles.busFrontText}>AVANT DU BUS</Text>
                        </View>

                        {/* Grille de sièges */}
                        <View style={styles.seatsGrid}>
                            {Array.from({ length: busConfiguration.rows }).map((_, rowIndex) => {
                                // Première rangée peut avoir moins de sièges (chauffeur + passagers)
                                const seatsInThisRow = seatMap.filter(s => s.row === rowIndex + 1);
                                
                                return (
                                    <View key={rowIndex} style={styles.seatRow}>
                                        <Text style={styles.rowLabel}>{rowIndex + 1}</Text>
                                        {seatsInThisRow.map((seat, colIndex) => {
                                            const isAisle = seat.type !== 'driver' && colIndex === Math.floor(seatsInThisRow.length / 2);

                                            return (
                                                <React.Fragment key={seat.id}>
                                                    {isAisle && <View style={styles.aisle} />}
                                                    <TouchableOpacity
                                                        style={[styles.seat, getSeatStyle(seat)]}
                                                        onPress={() => handleSeatPress(seat)}
                                                        disabled={seat.status !== 'available' || seat.type === 'driver'}
                                                    >
                                                        <Text style={[
                                                            styles.seatNumber,
                                                            (seat.status === 'occupied' || seat.status === 'reserved' || seat.type === 'driver') && styles.seatNumberDisabled
                                                        ]}>
                                                            {getSeatIcon(seat)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </React.Fragment>
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </View>

                        {/* Arrière du bus */}
                        <View style={styles.busBack}>
                            <Text style={styles.busBackText}>ARRIÈRE</Text>
                        </View>
                    </ScrollView>

                {/* Légende */}
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendSeat, styles.seatAvailable]} />
                        <Text style={styles.legendText}>Disponible</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendSeat, styles.seatSelected]} />
                        <Text style={styles.legendText}>Sélectionnée</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendSeat, styles.seatOccupied]} />
                        <Text style={styles.legendText}>Occupée</Text>
                    </View>
                </View>

                    {/* Boutons d'action */}
                    <View style={styles.actions}>
                                                <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelButtonText}>Annuler</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                                        style={[
                                styles.confirmButton,
                                !selectedSeat && styles.confirmButtonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={!selectedSeat}
                        >
                            <SafeIcon name="check" size={20} color="#FFFFFF" />
                            <Text style={styles.confirmButtonText}>
                                {selectedSeat ? `Réserver place ${selectedSeat.number}` : 'Sélectionnez une place'}
                                                        </Text>
                                                    </TouchableOpacity>
                                            </View>
                    </View>
                </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 2,
    },
    headerInfo: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    closeButton: {
        padding: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: modernColors.background,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    statText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    busContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    busFront: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        marginBottom: 16,
    },
    busFrontText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    seatsGrid: {
        gap: 8,
    },
    seatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    rowLabel: {
        width: 28,
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    aisle: {
        width: 20,
    },
    seat: {
        width: 46,
        height: 46,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    seatAvailable: {
        backgroundColor: modernColors.success,
        borderColor: '#059669',
    },
    seatSelected: {
        backgroundColor: modernColors.primary,
        borderColor: '#4F46E5',
        transform: [{ scale: 1.05 }],
    },
    seatOccupied: {
        backgroundColor: '#9CA3AF',
        borderColor: '#6B7280',
        opacity: 0.6,
    },
    seatDriver: {
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
    },
    seatNumber: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    seatNumberDisabled: {
        fontSize: 16,
    },
    busBack: {
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    busBackText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.background,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendSeat: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
    },
    legendText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.text,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    confirmButton: {
        flex: 2,
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmButtonDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.6,
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default BusSeatSelector;
