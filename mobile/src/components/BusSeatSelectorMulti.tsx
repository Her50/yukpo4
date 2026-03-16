// @ts-nocheck
/**
 * Sélecteur de places de bus avec réservation multiple
 * - Mémorisation du nom du passager
 * - Sélection multiple de places (famille/amis)
 * - Paiement complet immédiat (caution = prix ticket)
 */
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeStorage from '../utils/safeStorage';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const PASSENGER_NAME_KEY = '@yukpomnang:passenger_name';

const modernColors = {
    primary: '#6366F1',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
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
    type: 'standard' | 'vip' | 'handicapped' | 'driver';
}

interface BusConfiguration {
    rows: number;
    seatsPerRow: number;
    aislePosition: number;
    firstRowSeats: number;
}

interface BusSeatSelectorProps {
    visible: boolean;
    onClose: () => void;
    busConfiguration: BusConfiguration;
    seatMap: Seat[];
    onSelectSeats: (seats: Array<{ seat: Seat; passengerName: string }>) => void;
    product: any;
}

const BusSeatSelectorMulti: React.FC<BusSeatSelectorProps> = ({
    visible,
    onClose,
    busConfiguration,
    seatMap,
    onSelectSeats,
    product
}) => {
        const { t } = useLanguageSafe();
const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
    const [passengerNames, setPassengerNames] = useState<string[]>([]);
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const [savedPassengerName, setSavedPassengerName] = useState('');

    // Charger le nom sauvegardé
    useEffect(() => {
        const loadSavedName = async () => {
            try {
                const saved = await SafeStorage.getItem(PASSENGER_NAME_KEY);
                if (saved) {
                    setSavedPassengerName(saved);
                    setPassengerNames([saved]);
                }
            } catch (error) {
                console.error('Erreur chargement nom:', error);
            }
        };

        if (visible) {
            loadSavedName();
        } else {
            // Reset au closing
            setSelectedSeats([]);
            setPassengerNames([]);
            setMultiSelectMode(false);
        }
    }, [visible]);

    const getSeatStyle = (seat: Seat) => {
        if (seat.type === 'driver') {
            return styles.seatDriver;
        }
        if (seat.status === 'occupied' || seat.status === 'reserved') {
            return styles.seatOccupied;
        }
        if (selectedSeats.find(s => s.id === seat.id)) {
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
        const index = selectedSeats.findIndex(s => s.id === seat.id);
        if (index !== -1) {
            return multiSelectMode ? (index + 1).toString() : '✓';
        }
        return seat.number;
    };

    const handleSeatPress = (seat: Seat) => {
        if (seat.status !== 'available' || seat.type === 'driver') return;

        if (multiSelectMode) {
            // Mode multiple: ajouter/retirer
            const index = selectedSeats.findIndex(s => s.id === seat.id);
            if (index !== -1) {
                // Retirer
                const newSeats = [...selectedSeats];
                const newNames = [...passengerNames];
                newSeats.splice(index, 1);
                newNames.splice(index, 1);
                setSelectedSeats(newSeats);
                setPassengerNames(newNames);
            } else {
                // Ajouter
                setSelectedSeats([...selectedSeats, seat]);
                setPassengerNames([...passengerNames, savedPassengerName || '']);
            }
        } else {
            // Mode simple
            setSelectedSeats([seat]);
            setPassengerNames([savedPassengerName || '']);
        }
    };

    const handleConfirm = async () => {
        // Vérifier que tous les noms sont remplis
        const allNamesFilled = passengerNames.every(name => name.trim().length > 0);
        if (!allNamesFilled) {
            Alert.alert('Noms manquants', 'Veuillez renseigner le nom de tous les passagers');
            return;
        }

        // Sauvegarder le premier nom pour les prochaines fois
        try {
            await SafeStorage.setItem(PASSENGER_NAME_KEY, passengerNames[0].trim());
        } catch (error) {
            console.error('Erreur sauvegarde nom:', error);
        }

        // Préparer les données
        const reservations = selectedSeats.map((seat, index) => ({
            seat,
            passengerName: passengerNames[index].trim()
        }));

        onSelectSeats(reservations);
        onClose();
    };

    const availableSeats = seatMap.filter(s => s.status === 'available' && s.type !== 'driver').length;
    const reservedSeats = seatMap.filter(s => s.status === 'reserved' || s.status === 'occupied').length;
    const ticketPrice = parseInt(product.prix) || 0;
    const totalPrice = ticketPrice * selectedSeats.length;

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
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>{t('busSeatSelectorMulti.reserverVosPlaces')}</Text>
                            <Text style={styles.headerSubtitle}>
                                {product.depart} → {product.destination}
                            </Text>
                            <Text style={styles.headerInfo}>
                                {product.dateDepart} à {product.heureDepart} • {ticketPrice.toLocaleString()} FCFA/place
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Mode sélection */}
                    <View style={styles.modeSelector}>
                        <TouchableOpacity
                            style={[
                                styles.modeButton,
                                !multiSelectMode && styles.modeButtonActive
                            ]}
                            onPress={() => {
                                setMultiSelectMode(false);
                                if (selectedSeats.length > 1) {
                                    setSelectedSeats([selectedSeats[0]]);
                                    setPassengerNames([passengerNames[0]]);
                                }
                            }}
                        >
                            <SafeIcon name="user" size={18} color={!multiSelectMode ? '#FFFFFF' : modernColors.primary} />
                            <Text style={[
                                styles.modeButtonText,
                                !multiSelectMode && styles.modeButtonTextActive
                            ]}>1 place</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.modeButton,
                                multiSelectMode && styles.modeButtonActive
                            ]}
                            onPress={() => setMultiSelectMode(true)}
                        >
                            <SafeIcon name="users" size={18} color={multiSelectMode ? '#FFFFFF' : modernColors.primary} />
                            <Text style={[
                                styles.modeButtonText,
                                multiSelectMode && styles.modeButtonTextActive
                            ]}>Famille/Amis</Text>
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
                            <Text style={styles.statText}>{reservedSeats} occupées</Text>
                        </View>
                        {selectedSeats.length > 0 && (
                            <View style={styles.statItem}>
                                <View style={[styles.statIndicator, { backgroundColor: modernColors.primary }]} />
                                <Text style={styles.statText}>{selectedSeats.length} sélectionnée(s)</Text>
                            </View>
                        )}
                    </View>

                    {/* Plan du bus */}
                    <ScrollView style={styles.busContainer} showsVerticalScrollIndicator={false}>
                        <View style={styles.busFront}>
                            <SafeIcon name="navigation" size={20} color="#FFFFFF" />
                            <Text style={styles.busFrontText}>AVANT DU BUS</Text>
                        </View>

                        <View style={styles.seatsGrid}>
                            {Array.from({ length: busConfiguration.rows }).map((_, rowIndex) => {
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

                        <View style={styles.busBack}>
                            <Text style={styles.busBackText}>{t('busSeatSelectorMulti.arriere')}</Text>
                        </View>
                    </ScrollView>

                    {/* Légende */}
                    <View style={styles.legend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendSeat, styles.seatAvailable]} />
                            <Text style={styles.legendText}>{t('busSeatSelectorMulti.disponible')}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendSeat, styles.seatSelected]} />
                            <Text style={styles.legendText}>{t('busSeatSelectorMulti.selectionnee')}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendSeat, styles.seatOccupied]} />
                            <Text style={styles.legendText}>{t('busSeatSelectorMulti.occupee')}</Text>
                        </View>
                    </View>

                    {/* Formulaire noms passagers */}
                    {selectedSeats.length > 0 && (
                        <ScrollView style={styles.passengersForm} showsVerticalScrollIndicator={false}>
                            <View style={styles.passengersFormHeader}>
                                <SafeIcon name={multiSelectMode ? "users" : "user"} size={20} color={modernColors.primary} />
                                <Text style={styles.passengersFormTitle}>
                                    Informations {selectedSeats.length > 1 ? 'des passagers' : 'du passager'}
                                </Text>
                            </View>

                            {selectedSeats.map((seat, index) => (
                                <View key={seat.id} style={styles.passengerItem}>
                                    <View style={styles.passengerHeader}>
                                        <View style={styles.seatBadge}>
                                            <Text style={styles.seatBadgeText}>Place {seat.number}</Text>
                                        </View>
                                        {multiSelectMode && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const newSeats = [...selectedSeats];
                                                    const newNames = [...passengerNames];
                                                    newSeats.splice(index, 1);
                                                    newNames.splice(index, 1);
                                                    setSelectedSeats(newSeats);
                                                    setPassengerNames(newNames);
                                                }}
                                                style={styles.removeButton}
                                            >
                                                <SafeIcon name="x" size={16} color={modernColors.error} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <TextInput
                                        style={styles.passengerInput}
                                        placeholder={index === 0 && savedPassengerName ? savedPassengerName : "Ex: Jean MBARGA"}
                                        value={passengerNames[index] || ''}
                                        onChangeText={(text) => {
                                            const newNames = [...passengerNames];
                                            newNames[index] = text;
                                            setPassengerNames(newNames);
                                        }}
                                        autoCapitalize="words"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            ))}

                            {multiSelectMode && selectedSeats.length > 0 && (
                                <Text style={styles.multiHint}>
                                    💡 Cliquez sur une place verte pour l'ajouter à votre sélection
                                </Text>
                            )}
                        </ScrollView>
                    )}

                    {/* Résumé paiement */}
                    {selectedSeats.length > 0 && (
                        <View style={styles.paymentSummary}>
                            <View style={styles.paymentRow}>
                                <Text style={styles.paymentLabel}>
                                    {selectedSeats.length} place{selectedSeats.length > 1 ? 's' : ''} × {ticketPrice.toLocaleString()} FCFA
                                </Text>
                                <Text style={styles.paymentAmount}>{totalPrice.toLocaleString()} FCFA</Text>
                            </View>
                            <Text style={styles.paymentNotice}>
                                💰 Paiement complet immédiat • Ticket PDF instantané
                            </Text>
                        </View>
                    )}

                    {/* Boutons */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelButtonText}>{t('busSeatSelectorMulti.annuler')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                (selectedSeats.length === 0 || !passengerNames.every(n => n.trim())) && styles.confirmButtonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={selectedSeats.length === 0 || !passengerNames.every(n => n.trim())}
                        >
                            <SafeIcon name="check-circle" size={22} color="#FFFFFF" />
                            <Text style={styles.confirmButtonText}>
                                {selectedSeats.length === 0
                                    ? 'Sélectionnez des places'
                                    : !passengerNames.every(n => n.trim())
                                        ? 'Remplissez les noms'
                                        : `Payer ${totalPrice.toLocaleString()} FCFA`}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    async function handleConfirm() {
        // Vérifier que tous les noms sont remplis
        const allNamesFilled = passengerNames.every(name => name.trim().length > 0);
        if (!allNamesFilled) {
            Alert.alert('Noms manquants', 'Veuillez renseigner le nom de tous les passagers');
            return;
        }

        // Sauvegarder le premier nom
        try {
            await SafeStorage.setItem(PASSENGER_NAME_KEY, passengerNames[0].trim());
        } catch (error) {
            console.error('Erreur sauvegarde nom:', error);
        }

        // Préparer les réservations
        const reservations = selectedSeats.map((seat, index) => ({
            seat,
            passengerName: passengerNames[index].trim()
        }));

        onSelectSeats(reservations);
        onClose();
    }
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
        maxHeight: '92%',
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
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    closeButton: {
        padding: 8,
    },
    modeSelector: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: modernColors.background,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: modernColors.background,
        flexWrap: 'wrap',
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
        maxHeight: 280,
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
    passengersForm: {
        maxHeight: 200,
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FEFCE8',
        borderTopWidth: 1,
        borderColor: '#FDE047',
    },
    passengersFormHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    passengersFormTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    passengerItem: {
        marginBottom: 12,
        gap: 8,
    },
    passengerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    seatBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    seatBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    removeButton: {
        padding: 6,
        backgroundColor: '#FEE2E2',
        borderRadius: 6,
    },
    passengerInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: modernColors.primary,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        fontWeight: '500',
        color: modernColors.text,
    },
    multiHint: {
        fontSize: 11,
        fontStyle: 'italic',
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    paymentSummary: {
        backgroundColor: '#F0FDF4',
        borderTopWidth: 2,
        borderColor: '#86EFAC',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 8,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentLabel: {
        fontSize: 15,
        color: modernColors.text,
        fontWeight: '500',
    },
    paymentAmount: {
        fontSize: 22,
        fontWeight: '700',
        color: modernColors.success,
    },
    paymentNotice: {
        fontSize: 11,
        color: '#15803D',
        fontStyle: 'italic',
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: modernColors.surface,
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
        backgroundColor: modernColors.success,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
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

export default BusSeatSelectorMulti;

