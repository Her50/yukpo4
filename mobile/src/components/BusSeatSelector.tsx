import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
// @ts-ignore
import { LinearGradient } from 'expo-linear-gradient';
// @ts-ignore
import SafeIcon from './SafeIcon';
// @ts-ignore
import { NativeButton } from './NativeDesign';
// @ts-ignore
import { modernColors } from '../theme/modernTheme';

interface Seat {
    id: string;
    row: number;
    col: number;
    status: 'available' | 'occupied' | 'selected';
    label: string;
}

interface BusConfig {
    rows: number;
    cols: number;
    layout: number[];
    customRowLayouts?: { [row: number]: number[] }; // Configuration par rangée
}

interface BusSeatSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSelectSeat: (seatLabel: string) => void;
    occupiedSeats?: string[]; // Liste des places déjà occupées
    busType?: 'standard' | 'vip' | 'express'; // Type de bus
    customConfig?: BusConfig; // Configuration personnalisée
}

const BusSeatSelector: React.FC<BusSeatSelectorProps> = ({
    visible,
    onClose,
    onSelectSeat,
    occupiedSeats = [],
    busType = 'standard',
    customConfig
}) => {
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
    const [tempConfig, setTempConfig] = useState<BusConfig>({
        rows: 18,
        cols: 4,
        layout: [2, 2],
        customRowLayouts: {}
    });

    // Configuration des bus selon le type
    const getBusConfig = () => {
        // Si configuration personnalisée fournie, l'utiliser
        if (customConfig) {
            return customConfig;
        }

        switch (busType) {
            case 'vip':
                // Bus VIP: 2+1 configuration, 15 rangées
                return { rows: 15, cols: 3, layout: [2, 1] };
            case 'express':
                // Bus Express: 2+2 configuration, 12 rangées
                return { rows: 12, cols: 4, layout: [2, 2] };
            default:
                // Bus Standard: 2+2 configuration, 18 rangées
                return { rows: 18, cols: 4, layout: [2, 2] };
        }
    };

    const [config, setConfig] = useState<BusConfig>(getBusConfig());

    // Générer les sièges avec support des configurations par rangée
    const generateSeats = (): Seat[] => {
        const seats: Seat[] = [];
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

        for (let row = 1; row <= config.rows; row++) {
            // Utiliser la configuration personnalisée pour cette rangée si elle existe
            const rowLayout = config.customRowLayouts?.[row] || config.layout;
            const rowCols = rowLayout.reduce((sum, val) => sum + val, 0);

            for (let col = 0; col < rowCols; col++) {
                const label = `${letters[col]}${row.toString().padStart(2, '0')}`;
                const isOccupied = occupiedSeats.includes(label);

                seats.push({
                    id: `${row}-${col}`,
                    row,
                    col,
                    status: isOccupied ? 'occupied' : 'available',
                    label
                });
            }
        }

        return seats;
    };

    const [seats, setSeats] = useState<Seat[]>([]);
    const [selectedSeat, setSelectedSeat] = useState<string | null>(null);

    // Initialiser les sièges au chargement et quand config change
    React.useEffect(() => {
        const initialSeats = generateSeats();
        setSeats(initialSeats);
        setSelectedSeat(null);
    }, [config.rows, config.cols, config.layout, config.customRowLayouts]);

    const handleSeatPress = (seat: Seat) => {
        if (seat.status === 'occupied') return;

        // Désélectionner tous les sièges et sélectionner celui-ci
        const updatedSeats = seats.map(s => ({
            ...s,
            status: s.id === seat.id ? 'selected' : (s.status === 'selected' ? 'available' : s.status)
        })) as Seat[];

        setSeats(updatedSeats);
        setSelectedSeat(seat.label);
    };

    const handleConfirm = () => {
        if (selectedSeat) {
            onSelectSeat(selectedSeat);
            onClose();
        }
    };

    const getSeatStyle = (status: string) => {
        switch (status) {
            case 'occupied':
                return styles.seatOccupied;
            case 'selected':
                return styles.seatSelected;
            default:
                return styles.seatAvailable;
        }
    };

    const getSeatIcon = (status: string) => {
        switch (status) {
            case 'occupied':
                return 'x';
            case 'selected':
                return 'check';
            default:
                return 'square';
        }
    };

    // Organiser les sièges par rangée
    const seatsByRow: { [key: number]: Seat[] } = {};
    seats.forEach(seat => {
        if (!seatsByRow[seat.row]) {
            seatsByRow[seat.row] = [];
        }
        seatsByRow[seat.row].push(seat);
    });

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={modernColors.primaryGradient}
                    style={styles.header}
                >
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                    >
                        <SafeIcon name="x" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Sélection de place</Text>
                    <TouchableOpacity
                        style={styles.configButton}
                        onPress={() => {
                            setTempConfig(config);
                            setShowConfigModal(true);
                        }}
                    >
                        <SafeIcon name="settings" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </LinearGradient>

                {/* Info sur le type de bus */}
                <View style={styles.busInfo}>
                    <SafeIcon name="truck" size={24} color={modernColors.primary} />
                    <Text style={styles.busType}>
                        Bus {busType === 'vip' ? 'VIP' : busType === 'express' ? 'Express' : 'Standard'}
                    </Text>
                    <Text style={styles.busConfig}>
                        {config.layout.join('-')} • {config.rows} rangées
                    </Text>
                </View>

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

                {/* Plan du bus */}
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.busContainer}>
                        {/* Cabine du conducteur */}
                        <View style={styles.driverCabin}>
                            <SafeIcon name="user" size={20} color="#FFFFFF" />
                            <Text style={styles.driverText}>Conducteur</Text>
                        </View>

                        {/* Sièges */}
                        <View style={styles.seatsContainer}>
                            {Object.keys(seatsByRow).map((rowKey) => {
                                const row = parseInt(rowKey);
                                const rowSeats = seatsByRow[row];
                                const rowLayout = config.customRowLayouts?.[row] || config.layout;

                                return (
                                    <View key={row} style={styles.row}>
                                        <Text style={styles.rowNumber}>{row}</Text>
                                        <View style={styles.rowSeats}>
                                            {rowSeats.slice(0, rowLayout[0]).map(seat => (
                                                <TouchableOpacity
                                                    key={seat.id}
                                                    style={[styles.seat, getSeatStyle(seat.status)]}
                                                    onPress={() => handleSeatPress(seat)}
                                                    disabled={seat.status === 'occupied'}
                                                >
                                                    <Text style={[
                                                        styles.seatLabel,
                                                        seat.status === 'selected' && styles.seatLabelSelected,
                                                        seat.status === 'occupied' && styles.seatLabelOccupied
                                                    ]}>
                                                        {seat.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}

                                            {/* Allée */}
                                            <View style={styles.aisle} />

                                            {rowSeats.slice(rowLayout[0]).map(seat => (
                                                <TouchableOpacity
                                                    key={seat.id}
                                                    style={[styles.seat, getSeatStyle(seat.status)]}
                                                    onPress={() => handleSeatPress(seat)}
                                                    disabled={seat.status === 'occupied'}
                                                >
                                                    <Text style={[
                                                        styles.seatLabel,
                                                        seat.status === 'selected' && styles.seatLabelSelected,
                                                        seat.status === 'occupied' && styles.seatLabelOccupied
                                                    ]}>
                                                        {seat.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Arrière du bus */}
                        <View style={styles.busBack}>
                            <Text style={styles.busBackText}>Sortie de secours</Text>
                        </View>
                    </View>
                </ScrollView>

                {/* Footer avec sélection actuelle et bouton de confirmation */}
                <View style={styles.footer}>
                    {selectedSeat ? (
                        <>
                            <View style={styles.selectedInfo}>
                                <SafeIcon name="check-circle" size={24} color={modernColors.success} />
                                <View style={styles.selectedTextContainer}>
                                    <Text style={styles.selectedLabel}>Place sélectionnée</Text>
                                    <Text style={styles.selectedSeat}>{selectedSeat}</Text>
                                </View>
                            </View>
                            <NativeButton
                                title="Confirmer"
                                onPress={handleConfirm}
                                variant="primary"
                                style={styles.confirmButton}
                            />
                        </>
                    ) : (
                        <View style={styles.noSelection}>
                            <SafeIcon name="info" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.noSelectionText}>
                                Sélectionnez une place pour continuer
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Modal de configuration du bus */}
            <Modal
                visible={showConfigModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowConfigModal(false)}
            >
                <View style={styles.configModalContainer}>
                    <View style={styles.configModalHeader}>
                        <Text style={styles.configModalTitle}>⚙️ Configuration du bus</Text>
                        <TouchableOpacity
                            style={styles.configModalClose}
                            onPress={() => setShowConfigModal(false)}
                        >
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.configModalContent}>
                        <Text style={styles.configLabel}>Nombre de rangées</Text>
                        <View style={styles.configRow}>
                            <TouchableOpacity
                                style={styles.configButtonStyle}
                                onPress={() => setTempConfig({ ...tempConfig, rows: Math.max(1, tempConfig.rows - 1) })}
                            >
                                <SafeIcon name="minus" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            <Text style={styles.configValue}>{tempConfig.rows}</Text>
                            <TouchableOpacity
                                style={styles.configButtonStyle}
                                onPress={() => setTempConfig({ ...tempConfig, rows: Math.min(30, tempConfig.rows + 1) })}
                            >
                                <SafeIcon name="plus" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.configLabel}>Configuration générale</Text>
                        <View style={styles.layoutButtons}>
                            {[
                                { layout: [1, 1], cols: 2, label: '1-1' },
                                { layout: [2, 1], cols: 3, label: '2-1 (VIP)' },
                                { layout: [2, 2], cols: 4, label: '2-2 (Standard)' },
                                { layout: [2, 3], cols: 5, label: '2-3' },
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.label}
                                    style={[
                                        styles.layoutButton,
                                        tempConfig.layout[0] === option.layout[0] &&
                                        tempConfig.layout[1] === option.layout[1] &&
                                        styles.layoutButtonActive
                                    ]}
                                    onPress={() => setTempConfig({ ...tempConfig, layout: option.layout, cols: option.cols })}
                                >
                                    <Text style={[
                                        styles.layoutButtonText,
                                        tempConfig.layout[0] === option.layout[0] &&
                                        tempConfig.layout[1] === option.layout[1] &&
                                        styles.layoutButtonTextActive
                                    ]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Configuration avancée par rangée */}
                        <TouchableOpacity
                            style={styles.advancedConfigToggle}
                            onPress={() => setShowAdvancedConfig(!showAdvancedConfig)}
                        >
                            <SafeIcon
                                name={showAdvancedConfig ? "chevron-down" : "chevron-right"}
                                size={20}
                                color={modernColors.primary}
                            />
                            <Text style={styles.advancedConfigText}>
                                Configuration avancée (par rangée)
                            </Text>
                        </TouchableOpacity>

                        {showAdvancedConfig && (
                            <View style={styles.advancedConfigContainer}>
                                <View style={styles.hintBox}>
                                    <Text style={styles.hintText}>
                                        💡 Configurez chaque rangée individuellement. Généralement : Rangée 1 (chauffeur) = 1-1, Dernière rangée = siège supplémentaire
                                    </Text>
                                </View>

                                {/* Boutons rapides */}
                                <View style={styles.quickConfigButtons}>
                                    <TouchableOpacity
                                        style={styles.quickConfigButton}
                                        onPress={() => {
                                            const newLayouts = { ...tempConfig.customRowLayouts };
                                            newLayouts[1] = [1, 1]; // Première rangée 1-1
                                            setTempConfig({ ...tempConfig, customRowLayouts: newLayouts });
                                        }}
                                    >
                                        <Text style={styles.quickConfigButtonText}>Rangée 1 → 1-1</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.quickConfigButton}
                                        onPress={() => {
                                            const newLayouts = { ...tempConfig.customRowLayouts };
                                            newLayouts[tempConfig.rows] = [2, 3]; // Dernière rangée avec siège supplémentaire
                                            setTempConfig({ ...tempConfig, customRowLayouts: newLayouts });
                                        }}
                                    >
                                        <Text style={styles.quickConfigButtonText}>Dernière → 2-3</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Configuration de chaque rangée */}
                                {Array.from({ length: tempConfig.rows }, (_, i) => i + 1).map((rowNum) => {
                                    const rowLayout = tempConfig.customRowLayouts?.[rowNum] || tempConfig.layout;
                                    return (
                                        <View key={rowNum} style={styles.rowConfigItem}>
                                            <Text style={styles.rowConfigLabel}>
                                                Rangée {rowNum}
                                                {rowNum === 1 && ' (Chauffeur)'}
                                                {rowNum === tempConfig.rows && ' (Dernière)'}
                                            </Text>
                                            <View style={styles.rowConfigButtons}>
                                                {[
                                                    { layout: [1, 1], label: '1-1' },
                                                    { layout: [2, 1], label: '2-1' },
                                                    { layout: [2, 2], label: '2-2' },
                                                    { layout: [2, 3], label: '2-3' },
                                                    { layout: [3, 2], label: '3-2' },
                                                ].map((option) => (
                                                    <TouchableOpacity
                                                        key={option.label}
                                                        style={[
                                                            styles.miniLayoutButton,
                                                            rowLayout[0] === option.layout[0] &&
                                                            rowLayout[1] === option.layout[1] &&
                                                            styles.miniLayoutButtonActive
                                                        ]}
                                                        onPress={() => {
                                                            const newLayouts = { ...tempConfig.customRowLayouts };
                                                            newLayouts[rowNum] = option.layout;
                                                            setTempConfig({ ...tempConfig, customRowLayouts: newLayouts });
                                                        }}
                                                    >
                                                        <Text style={[
                                                            styles.miniLayoutButtonText,
                                                            rowLayout[0] === option.layout[0] &&
                                                            rowLayout[1] === option.layout[1] &&
                                                            styles.miniLayoutButtonTextActive
                                                        ]}>
                                                            {option.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.configPreview}>
                            <Text style={styles.configPreviewTitle}>Aperçu :</Text>
                            <Text style={styles.configPreviewText}>
                                • {tempConfig.rows} rangées
                            </Text>
                            <Text style={styles.configPreviewText}>
                                • Configuration générale : {tempConfig.layout[0]}-{tempConfig.layout[1]}
                            </Text>
                            {Object.keys(tempConfig.customRowLayouts || {}).length > 0 && (
                                <Text style={styles.configPreviewText}>
                                    • {Object.keys(tempConfig.customRowLayouts || {}).length} rangée(s) personnalisée(s)
                                </Text>
                            )}
                        </View>
                    </ScrollView>

                    <View style={styles.configModalFooter}>
                        <NativeButton
                            title="Annuler"
                            onPress={() => setShowConfigModal(false)}
                            variant="secondary"
                            style={{ flex: 1 }}
                        />
                        <NativeButton
                            title="Appliquer"
                            onPress={() => {
                                setConfig(tempConfig);
                                setShowConfigModal(false);
                            }}
                            variant="primary"
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            </Modal>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerSpacer: {
        width: 40,
    },
    busInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    busType: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    busConfig: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendSeat: {
        width: 20,
        height: 20,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    scrollView: {
        flex: 1,
    },
    busContainer: {
        padding: 20,
        alignItems: 'center',
    },
    driverCabin: {
        width: '100%',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 24,
    },
    driverText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    seatsContainer: {
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rowNumber: {
        width: 30,
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    rowSeats: {
        flexDirection: 'row',
        gap: 8,
    },
    seat: {
        width: 60,
        height: 60,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    seatAvailable: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
    },
    seatSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    seatOccupied: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        opacity: 0.5,
    },
    seatLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    seatLabelSelected: {
        color: '#FFFFFF',
    },
    seatLabelOccupied: {
        color: modernColors.textSecondary,
    },
    aisle: {
        width: 20,
    },
    busBack: {
        width: '100%',
        backgroundColor: '#FCD34D',
        borderRadius: 12,
        padding: 12,
        marginTop: 24,
        alignItems: 'center',
    },
    busBackText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#78350F',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    selectedInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    selectedTextContainer: {
        flex: 1,
    },
    selectedLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    selectedSeat: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.success,
    },
    confirmButton: {
        marginTop: 8,
    },
    noSelection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
    },
    noSelectionText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    configButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    configButtonStyle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    configModalContainer: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    configModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    configModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    configModalClose: {
        padding: 8,
    },
    configModalContent: {
        flex: 1,
        padding: 20,
    },
    configLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 20,
        marginBottom: 12,
    },
    configRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        backgroundColor: modernColors.surface,
        padding: 20,
        borderRadius: 12,
    },
    configValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: modernColors.primary,
        minWidth: 60,
        textAlign: 'center',
    },
    layoutButtons: {
        gap: 12,
    },
    layoutButton: {
        padding: 16,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
    },
    layoutButtonActive: {
        backgroundColor: '#EFF6FF',
        borderColor: modernColors.primary,
    },
    layoutButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    layoutButtonTextActive: {
        color: modernColors.primary,
    },
    configPreview: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.success,
    },
    configPreviewTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    configPreviewText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    configModalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    advancedConfigToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        backgroundColor: '#F0F9FF',
        borderRadius: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    advancedConfigText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    advancedConfigContainer: {
        marginTop: 16,
        gap: 12,
    },
    hintBox: {
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    hintText: {
        fontSize: 12,
        color: '#78350F',
        lineHeight: 16,
    },
    quickConfigButtons: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    quickConfigButton: {
        flex: 1,
        padding: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        alignItems: 'center',
    },
    quickConfigButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    rowConfigItem: {
        marginTop: 12,
        padding: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    rowConfigLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    rowConfigButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    miniLayoutButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: modernColors.background,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    miniLayoutButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    miniLayoutButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    miniLayoutButtonTextActive: {
        color: '#FFFFFF',
    },
});

export default BusSeatSelector;

