// @ts-nocheck
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import React, { useEffect, useState } from 'react';
import {
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

const PASSENGER_NAME_KEY = '@yukpomnang:passenger_name';

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
    status: 'available' | 'reserved' | 'occupied' | 'prebooked';
    type: 'standard' | 'vip' | 'handicapped' | 'driver';
    prebooked?: boolean;
    prebookedForUserId?: string; // ID de l'utilisateur qui a pré-réservé
    passengerName?: string;
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
    onSelectSeat: (seat: Seat | Seat[], returnTripData?: { wantReturn: boolean; returnDate: string; returnTime: string }) => void; // Peut être une ou plusieurs places
    selectedSeatNumber?: number;
    product: any;
    multipleMode?: boolean; // Mode réservation multiple
    currentUserId?: string; // ID de l'utilisateur actuel
}

const BusSeatSelector: React.FC<BusSeatSelectorProps> = ({
    visible,
    onClose,
    busConfiguration,
    seatMap,
    onSelectSeat,
    selectedSeatNumber,
    product,
    multipleMode = false,
    currentUserId
}) => {
    const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
    const [passengerNames, setPassengerNames] = useState<string[]>([]);
    const [savedName, setSavedName] = useState('');
    const [isMultipleMode, setIsMultipleMode] = useState(multipleMode);

    // États pour la demande de retour
    const [wantReturn, setWantReturn] = useState(false);
    const [returnDate, setReturnDate] = useState('');
    const [returnTime, setReturnTime] = useState('');

    // Charger le nom sauvegardé au démarrage
    useEffect(() => {
        const loadSavedName = async () => {
            try {
                const saved = await SafeStorage.getItem(PASSENGER_NAME_KEY);
                if (saved) {
                    setSavedName(saved);
                    setPassengerNames([saved]); // Proposer par défaut pour la première place
                }
            } catch (error) {
                console.error('Erreur chargement nom sauvegardé:', error);
            }
        };
        loadSavedName();
    }, []);

    // Mettre à jour passengerNames quand selectedSeats change
    useEffect(() => {
        const currentLength = passengerNames.length;
        const neededLength = selectedSeats.length;

        if (neededLength > currentLength) {
            // Ajouter des noms vides
            setPassengerNames([...passengerNames, ...Array(neededLength - currentLength).fill('')]);
        } else if (neededLength < currentLength) {
            // Réduire les noms
            setPassengerNames(passengerNames.slice(0, neededLength));
        }
    }, [selectedSeats.length]);

    const getSeatStyle = (seat: Seat) => {
        if (seat.type === 'driver') {
            return styles.seatDriver;
        }
        if (seat.status === 'occupied' || seat.status === 'reserved') {
            return styles.seatOccupied;
        }
        // Place pré-réservée pour retour
        if (seat.status === 'prebooked' || seat.prebooked) {
            // Si c'est pour l'utilisateur actuel, style spécial
            if (seat.prebookedForUserId === currentUserId) {
                return styles.seatPrebookedOwn;
            }
            return styles.seatPrebooked;
        }
        if (selectedSeats.find(s => s.id === seat.id) || seat.number === selectedSeatNumber) {
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
        if (seat.status === 'prebooked' || seat.prebooked) {
            return '⏳'; // Sablier pour pré-réservé
        }
        const selectedIndex = selectedSeats.findIndex(s => s.id === seat.id);
        if (selectedIndex >= 0) {
            return isMultipleMode ? (selectedIndex + 1).toString() : '✓';
        }
        return seat.number;
    };

    const handleSeatPress = (seat: Seat) => {
        // Vérifier si la place est prebooked et si l'utilisateur peut la sélectionner
        if (seat.status === 'prebooked' || seat.prebooked) {
            // Si la place est pré-réservée, seul le propriétaire peut la sélectionner
            if (seat.prebookedForUserId !== currentUserId) {
                // Afficher un message d'erreur ou simplement ignorer
                return;
            }
        }

        if ((seat.status === 'available' || (seat.status === 'prebooked' && seat.prebookedForUserId === currentUserId)) && seat.type !== 'driver') {
            if (isMultipleMode) {
                // Mode multiple: toggle la sélection
                const isSelected = selectedSeats.find(s => s.id === seat.id);
                if (isSelected) {
                    setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
                } else {
                    setSelectedSeats([...selectedSeats, seat]);
                }
            } else {
                // Mode simple: remplace la sélection
                setSelectedSeats([seat]);
            }
        }
    };

    const handleConfirm = async () => {
        // Vérifier que tous les noms sont remplis
        const allNamesFilled = passengerNames.every((name, idx) => idx >= selectedSeats.length || name.trim().length > 0);

        if (selectedSeats.length > 0 && allNamesFilled) {
            // Sauvegarder le premier nom pour les prochaines fois
            if (passengerNames[0] && passengerNames[0].trim()) {
                try {
                    await SafeStorage.setItem(PASSENGER_NAME_KEY, passengerNames[0].trim());
                    console.log('✅ Nom passager sauvegardé:', passengerNames[0].trim());
                } catch (error) {
                    console.error('Erreur sauvegarde nom:', error);
                }
            }

            // Attacher les noms aux sièges
            const seatsWithNames = selectedSeats.map((seat, idx) => ({
                ...seat,
                passengerName: passengerNames[idx].trim()
            }));

            // Préparer les données de retour si demandé
            const returnTripData = wantReturn && returnDate && returnTime ? {
                wantReturn: true,
                returnDate: returnDate.trim(),
                returnTime: returnTime.trim()
            } : undefined;

            // Retourner un seul ou plusieurs sièges avec les données de retour
            onSelectSeat(isMultipleMode ? seatsWithNames : seatsWithNames[0], returnTripData);
            onClose();
        }
    };

    // ✅ CORRECTION: Vérifier que seatMap existe avant de filtrer
    const availableSeats = (seatMap || []).filter(s => s.status === 'available').length;
    const reservedSeats = (seatMap || []).filter(s => s.status === 'reserved' || s.status === 'occupied').length;

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

                    {/* Statistiques et Toggle Mode */}
                    <View style={styles.statsContainerWithToggle}>
                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <View style={[styles.statIndicator, { backgroundColor: modernColors.success }]} />
                                <Text style={styles.statText}>{availableSeats} disponibles</Text>
                            </View>
                            <View style={styles.statItem}>
                                <View style={[styles.statIndicator, { backgroundColor: '#9CA3AF' }]} />
                                <Text style={styles.statText}>{reservedSeats} réservées</Text>
                            </View>
                            {selectedSeats.length > 0 && (
                                <View style={styles.statItem}>
                                    <View style={[styles.statIndicator, { backgroundColor: modernColors.primary }]} />
                                    <Text style={styles.statText}>
                                        {selectedSeats.length} {selectedSeats.length > 1 ? 'sélectionnées' : 'sélectionnée'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            style={[styles.modeToggle, isMultipleMode && styles.modeToggleActive]}
                            onPress={() => {
                                setIsMultipleMode(!isMultipleMode);
                                if (!isMultipleMode) {
                                    // Passer en mode multiple: garder sélection
                                } else {
                                    // Passer en mode simple: garder seule la première
                                    setSelectedSeats(selectedSeats.slice(0, 1));
                                }
                            }}
                        >
                            <SafeIcon
                                name={isMultipleMode ? "users" : "user"}
                                size={16}
                                color={isMultipleMode ? '#FFFFFF' : modernColors.primary}
                            />
                            <Text style={[styles.modeToggleText, isMultipleMode && styles.modeToggleTextActive]}>
                                {isMultipleMode ? 'Multiple' : 'Simple'}
                            </Text>
                        </TouchableOpacity>
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
                            {Array.from({ length: busConfiguration?.rows || 0 }).map((_, rowIndex) => {
                                // Première rangée peut avoir moins de sièges (chauffeur + passagers)
                                const seatsInThisRow = (seatMap || []).filter(s => s.row === rowIndex + 1);

                                // ✅ CORRECTION: Séparer explicitement en deux colonnes
                                // Configuration standard: [2, 2] = 2 sièges à gauche, 2 à droite
                                const isFirstRow = rowIndex === 0;
                                const seatsPerSide = Math.floor(seatsInThisRow.length / 2);

                                // Sièges de gauche et de droite
                                const leftSeats = seatsInThisRow.slice(0, seatsPerSide);
                                const rightSeats = seatsInThisRow.slice(seatsPerSide);

                                return (
                                    <View key={rowIndex} style={styles.seatRow}>
                                        <Text style={styles.rowLabel}>{rowIndex + 1}</Text>

                                        {/* Colonne de gauche */}
                                        {leftSeats.map((seat) => (
                                            <TouchableOpacity
                                                key={seat.id}
                                                style={[styles.seat, getSeatStyle(seat)]}
                                                onPress={() => handleSeatPress(seat)}
                                                disabled={
                                                    seat.type === 'driver' ||
                                                    seat.status === 'occupied' ||
                                                    seat.status === 'reserved' ||
                                                    ((seat.status === 'prebooked' || seat.prebooked) && seat.prebookedForUserId !== currentUserId)
                                                }
                                            >
                                                <Text style={[
                                                    styles.seatNumber,
                                                    (seat.status === 'occupied' || seat.status === 'reserved' || ((seat.status === 'prebooked' || seat.prebooked) && seat.prebookedForUserId !== currentUserId) || seat.type === 'driver') && styles.seatNumberDisabled
                                                ]}>
                                                    {getSeatIcon(seat)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}

                                        {/* Allée centrale */}
                                        <View style={styles.aisle} />

                                        {/* Colonne de droite */}
                                        {rightSeats.map((seat) => (
                                            <TouchableOpacity
                                                key={seat.id}
                                                style={[styles.seat, getSeatStyle(seat)]}
                                                onPress={() => handleSeatPress(seat)}
                                                disabled={
                                                    seat.type === 'driver' ||
                                                    seat.status === 'occupied' ||
                                                    seat.status === 'reserved' ||
                                                    ((seat.status === 'prebooked' || seat.prebooked) && seat.prebookedForUserId !== currentUserId)
                                                }
                                            >
                                                <Text style={[
                                                    styles.seatNumber,
                                                    (seat.status === 'occupied' || seat.status === 'reserved' || ((seat.status === 'prebooked' || seat.prebooked) && seat.prebookedForUserId !== currentUserId) || seat.type === 'driver') && styles.seatNumberDisabled
                                                ]}>
                                                    {getSeatIcon(seat)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
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
                            <View style={[styles.legendSeat, styles.seatPrebooked]} />
                            <Text style={styles.legendText}>Pré-réservée</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendSeat, styles.seatOccupied]} />
                            <Text style={styles.legendText}>Occupée</Text>
                        </View>
                    </View>

                    {/* Formulaire noms passagers */}
                    {selectedSeats.length > 0 && (
                        <ScrollView style={styles.passengerForm} nestedScrollEnabled>
                            <View style={styles.passengerFormHeader}>
                                <SafeIcon name={isMultipleMode ? "users" : "user"} size={18} color={modernColors.primary} />
                                <Text style={styles.passengerFormTitle}>
                                    {isMultipleMode
                                        ? `Informations des ${selectedSeats.length} passagers`
                                        : 'Informations du passager'}
                                </Text>
                            </View>

                            {selectedSeats.map((seat, index) => (
                                <View key={seat.id} style={styles.passengerInputContainer}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={styles.passengerInputLabel}>
                                            {isMultipleMode && `Place ${seat.number} - `}Nom complet <Text style={{ color: modernColors.error }}>*</Text>
                                        </Text>
                                        {index === 0 && savedName && (
                                            <Text style={styles.savedNameBadge}>✓ Sauvegardé</Text>
                                        )}
                                    </View>
                                    <TextInput
                                        style={styles.passengerInput}
                                        placeholder={index === 0 ? "Ex: Jean MBARGA (vous)" : "Ex: Marie MBARGA"}
                                        value={passengerNames[index] || ''}
                                        onChangeText={(text) => {
                                            const newNames = [...passengerNames];
                                            newNames[index] = text;
                                            setPassengerNames(newNames);
                                        }}
                                        autoCapitalize="words"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                    {index === 0 && savedName && passengerNames[0] === savedName && (
                                        <Text style={styles.savedNameHint}>
                                            💡 Modifiable si nécessaire
                                        </Text>
                                    )}
                                </View>
                            ))}

                            <View style={styles.cautionInfo}>
                                <SafeIcon name="info" size={14} color={modernColors.warning} />
                                <Text style={styles.cautionInfoText}>
                                    Total: <Text style={{ fontWeight: '700' }}>
                                        {((parseInt(product.prix) || 0) * selectedSeats.length).toLocaleString()} FCFA
                                    </Text> pour {selectedSeats.length} {selectedSeats.length > 1 ? 'places' : 'place'}
                                </Text>
                            </View>
                        </ScrollView>
                    )}

                    {/* Section Demande de Retour */}
                    {selectedSeats.length > 0 && passengerNames.every((n, idx) => idx >= selectedSeats.length || n.trim().length > 0) && (
                        <View style={styles.returnTripSection}>
                            <View style={styles.returnTripHeader}>
                                <SafeIcon name="repeat" size={18} color={modernColors.primary} />
                                <Text style={styles.returnTripTitle}>
                                    Souhaitez-vous réserver votre retour ?
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.returnTripToggle}
                                onPress={() => setWantReturn(!wantReturn)}
                            >
                                <View style={[
                                    styles.returnToggleSwitch,
                                    wantReturn && styles.returnToggleSwitchActive
                                ]}>
                                    <View style={[
                                        styles.returnToggleThumb,
                                        wantReturn && styles.returnToggleThumbActive
                                    ]} />
                                </View>
                                <Text style={styles.returnToggleText}>
                                    {wantReturn ? '🔔 Oui, notifiez-moi' : 'Non, aller simple uniquement'}
                                </Text>
                            </TouchableOpacity>

                            {wantReturn && (
                                <View style={styles.returnFormContainer}>
                                    <View style={styles.returnInfoBox}>
                                        <SafeIcon name="bell" size={16} color={modernColors.primary} />
                                        <Text style={styles.returnInfoText}>
                                            📲 Vous recevrez une notification dès qu'un bus correspondant sera créé!
                                        </Text>
                                    </View>

                                    <View style={styles.returnFieldRow}>
                                        <View style={styles.returnFieldContainer}>
                                            <Text style={styles.returnFieldLabel}>
                                                Date de retour souhaitée <Text style={styles.required}>*</Text>
                                            </Text>
                                            <View style={styles.returnInputWrapper}>
                                                <SafeIcon name="calendar" size={16} color={modernColors.primary} />
                                                <TextInput
                                                    style={styles.returnInput}
                                                    placeholder="JJ/MM/AAAA"
                                                    value={returnDate}
                                                    onChangeText={setReturnDate}
                                                    placeholderTextColor="#9CA3AF"
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>

                                        <View style={styles.returnFieldContainer}>
                                            <Text style={styles.returnFieldLabel}>
                                                Heure souhaitée <Text style={styles.required}>*</Text>
                                            </Text>
                                            <View style={styles.returnInputWrapper}>
                                                <SafeIcon name="clock" size={16} color={modernColors.primary} />
                                                <TextInput
                                                    style={styles.returnInput}
                                                    placeholder="HH:MM"
                                                    value={returnTime}
                                                    onChangeText={setReturnTime}
                                                    placeholderTextColor="#9CA3AF"
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.returnRouteInfo}>
                                        <SafeIcon name="arrow-right-left" size={14} color={modernColors.textSecondary} />
                                        <Text style={styles.returnRouteText}>
                                            Trajet retour: {product.destination} → {product.depart}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Détails de paiement */}
                    {selectedSeats.length > 0 && passengerNames.every((n, idx) => idx >= selectedSeats.length || n.trim().length > 0) && (
                        <View style={styles.paymentBreakdown}>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>
                                    {selectedSeats.length} {selectedSeats.length > 1 ? 'billets' : 'billet'} × {(parseInt(product.prix) || 0).toLocaleString()} FCFA
                                </Text>
                                <Text style={styles.breakdownValue}>
                                    {((parseInt(product.prix) || 0) * selectedSeats.length).toLocaleString()} FCFA
                                </Text>
                            </View>
                            <View style={styles.breakdownRow}>
                                <View style={styles.feeLabel}>
                                    <SafeIcon name="credit-card" size={14} color={modernColors.primary} />
                                    <Text style={styles.breakdownLabel}>Frais de réservation en ligne</Text>
                                </View>
                                <Text style={styles.breakdownValue}>500 FCFA</Text>
                            </View>
                            <View style={styles.breakdownDivider} />
                            <View style={styles.breakdownRow}>
                                <Text style={styles.totalLabel}>TOTAL À PAYER</Text>
                                <Text style={styles.totalValue}>
                                    {((parseInt(product.prix) || 0) * selectedSeats.length + 500).toLocaleString()} FCFA
                                </Text>
                            </View>
                        </View>
                    )}

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
                                (selectedSeats.length === 0 || !passengerNames.every((n, idx) => idx >= selectedSeats.length || n.trim().length > 0)) && styles.confirmButtonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={selectedSeats.length === 0 || !passengerNames.every((n, idx) => idx >= selectedSeats.length || n.trim().length > 0)}
                        >
                            <SafeIcon name="check" size={20} color="#FFFFFF" />
                            <Text style={styles.confirmButtonText}>
                                {selectedSeats.length > 0
                                    ? (passengerNames.every((n, idx) => idx >= selectedSeats.length || n.trim().length > 0)
                                        ? `Payer ${((parseInt(product.prix) || 0) * selectedSeats.length + 500).toLocaleString()} FCFA`
                                        : `Entrez ${isMultipleMode ? 'les noms' : 'votre nom'}`)
                                    : `Sélectionnez ${isMultipleMode ? 'les places' : 'une place'}`}
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
    statsContainerWithToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: modernColors.background,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
        flex: 1,
    },
    modeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1.5,
        borderColor: modernColors.primary,
        borderRadius: 8,
    },
    modeToggleActive: {
        backgroundColor: modernColors.primary,
    },
    modeToggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    modeToggleTextActive: {
        color: '#FFFFFF',
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
    seatPrebooked: {
        backgroundColor: '#F59E0B', // Orange pour pré-réservé
        borderColor: '#D97706',
        opacity: 0.7,
    },
    seatPrebookedOwn: {
        backgroundColor: '#FBBF24', // Orange plus clair pour mes pré-réservations
        borderColor: '#F59E0B',
        borderWidth: 2,
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
    paymentBreakdown: {
        marginTop: 16,
        marginHorizontal: 20,
        padding: 16,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 12,
        gap: 8,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    breakdownLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    breakdownValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    feeLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    breakdownDivider: {
        height: 1,
        backgroundColor: '#BFDBFE',
        marginVertical: 6,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '800',
        color: modernColors.primary,
    },
    returnTripSection: {
        marginTop: 16,
        marginHorizontal: 20,
        padding: 16,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 12,
    },
    returnTripHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    returnTripTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
    },
    returnTripToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
    },
    returnToggleSwitch: {
        width: 50,
        height: 28,
        backgroundColor: '#E5E7EB',
        borderRadius: 14,
        padding: 2,
        justifyContent: 'center',
    },
    returnToggleSwitchActive: {
        backgroundColor: modernColors.primary,
    },
    returnToggleThumb: {
        width: 24,
        height: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    returnToggleThumbActive: {
        transform: [{ translateX: 22 }],
    },
    returnToggleText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    returnFormContainer: {
        marginTop: 16,
        gap: 12,
    },
    returnInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    returnInfoText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    returnFieldRow: {
        flexDirection: 'row',
        gap: 12,
    },
    returnFieldContainer: {
        flex: 1,
    },
    returnFieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    returnInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
    },
    returnInput: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        padding: 0,
    },
    returnRouteInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#DBEAFE',
    },
    returnRouteText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    passengerForm: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FEFCE8',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#FDE047',
    },
    passengerFormHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    passengerFormTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
    },
    passengerInputContainer: {
        marginBottom: 12,
    },
    passengerInputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
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
    cautionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
    },
    cautionInfoText: {
        fontSize: 12,
        color: '#92400E',
        flex: 1,
    },
    savedNameBadge: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.success,
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    savedNameHint: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 6,
        fontStyle: 'italic',
    },
});

export default BusSeatSelector;
