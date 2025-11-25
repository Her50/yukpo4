/**
 * Écran de gestion d'embarquement pour les agences de voyage
 * Permet de scanner les QR codes des tickets et de gérer l'embarquement des passagers
 */

import { useNavigation, useRoute } from '@react-navigation/native';
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
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../components/SafeIcon';

interface BoardingSummary {
    total_reservations: number;
    boarded_passengers: number;
    pending_passengers: number;
    no_show_passengers: number;
    completion_percentage: number;
    is_complete: boolean;
}

interface PassengerInfo {
    reservation_id: string;
    product_id: string;
    user_id: number;
    seat_id: string;
    seat_number: number;
    passenger_name?: string;
    payment_id?: string;
    total_amount?: number;
    boarding_status: string;
    is_validated: boolean;
    validated_at?: string;
    validated_by?: number;
    validation_method?: string;
    validator_name?: string;
    display_status: string;
}

const BusBoardingManagementScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { productId, busNumber } = (route.params as any) || {};

    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<BoardingSummary | null>(null);
    const [passengers, setPassengers] = useState<PassengerInfo[]>([]);
    const [showScanner, setShowScanner] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [selectedPassenger, setSelectedPassenger] = useState<PassengerInfo | null>(null);

    useEffect(() => {
        if (productId) {
            loadBoardingData();
        } else {
            Alert.alert('Erreur', 'Product ID manquant');
            navigation.goBack();
        }
    }, [productId]);

    const loadBoardingData = async () => {
        try {
            setLoading(true);
            const [summaryRes, passengersRes] = await Promise.all([
                apiGet(`/api/bus-tickets/boarding/${productId}/summary`),
                apiGet(`/api/bus-tickets/boarding/${productId}/passengers`),
            ]);

            if (summaryRes.success) {
                setSummary(summaryRes.summary);
            }

            if (passengersRes.success) {
                setPassengers(passengersRes.passengers);
            }
        } catch (error: any) {
            console.error('Erreur chargement données embarquement:', error);
            Alert.alert('Erreur', 'Impossible de charger les données');
        } finally {
            setLoading(false);
        }
    };

    const handleQRCodeScanned = async (qrData: string) => {
        try {
            setScanning(true);
            const qrJson = JSON.parse(qrData);

            // Vérifier format QR code
            if (qrJson.type !== 'BUS_TICKET_YUKPOMNANG') {
                Alert.alert('Erreur', 'QR code invalide');
                setShowScanner(false);
                return;
            }

            // Valider le ticket
            const response = await apiPost('/api/bus-tickets/validate', {
                qr_code_data: qrJson,
                product_id: productId,
            });

            if (response.success) {
                Alert.alert(
                    '✅ Validé',
                    `Passager: ${response.passenger_name}\nPlace: ${response.seat_number}`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setShowScanner(false);
                                loadBoardingData();
                            },
                        },
                    ]
                );
            } else {
                if (response.already_boarded) {
                    Alert.alert('⚠️ Déjà embarqué', 'Ce passager a déjà été validé');
                } else {
                    Alert.alert('Erreur', response.error || 'Validation échouée');
                }
            }
        } catch (error: any) {
            console.error('Erreur validation QR code:', error);
            Alert.alert('Erreur', 'QR code invalide ou corrompu');
        } finally {
            setScanning(false);
        }
    };

    const handleManualValidation = async (passenger: PassengerInfo) => {
        Alert.alert(
            'Validation manuelle',
            `Valider manuellement ${passenger.passenger_name || 'ce passager'} ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Valider',
                    onPress: async () => {
                        try {
                            const response = await apiPost('/api/bus-tickets/validate/manual', {
                                reservation_id: passenger.reservation_id,
                                notes: 'Validation manuelle',
                            });

                            if (response.success) {
                                Alert.alert('✅ Validé', 'Passager validé avec succès');
                                loadBoardingData();
                            } else {
                                Alert.alert('Erreur', response.error || 'Validation échouée');
                            }
                        } catch (error: any) {
                            Alert.alert('Erreur', 'Impossible de valider le passager');
                        }
                    },
                },
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'boarded':
                return '#10B981';
            case 'pending':
                return '#F59E0B';
            case 'no_show':
                return '#EF4444';
            default:
                return '#6B7280';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'boarded':
                return 'check-circle';
            case 'pending':
                return 'clock';
            case 'no_show':
                return 'x-circle';
            default:
                return 'help-circle';
        }
    };

    const renderPassengerCard = (passenger: PassengerInfo) => {
        const statusColor = getStatusColor(passenger.display_status);
        const statusIcon = getStatusIcon(passenger.display_status);

        return (
            <View key={passenger.reservation_id} style={styles.passengerCard}>
                <View style={styles.passengerHeader}>
                    <View style={styles.passengerInfo}>
                        <Text style={styles.passengerName}>
                            {passenger.passenger_name || `Passager ${passenger.seat_number}`}
                        </Text>
                        <Text style={styles.seatInfo}>
                            Place {passenger.seat_number} ({passenger.seat_id})
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <SafeIcon name={statusIcon} size={14} color="#fff" />
                        <Text style={styles.statusText}>
                            {passenger.display_status === 'boarded'
                                ? 'Embarqué'
                                : passenger.display_status === 'pending'
                                    ? 'En attente'
                                    : 'No-show'}
                        </Text>
                    </View>
                </View>

                {passenger.is_validated && passenger.validated_at && (
                    <Text style={styles.validatedAt}>
                        Validé le {new Date(passenger.validated_at).toLocaleString('fr-FR')}
                    </Text>
                )}

                {!passenger.is_validated && (
                    <TouchableOpacity
                        style={styles.validateButton}
                        onPress={() => handleManualValidation(passenger)}
                    >
                        <SafeIcon name="check" size={16} color="#fff" />
                        <Text style={styles.validateButtonText}>Valider manuellement</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Gestion embarquement</Text>
                <View style={styles.placeholder} />
            </View>

            {busNumber && (
                <View style={styles.busInfo}>
                    <Text style={styles.busNumber}>Bus #{busNumber}</Text>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : (
                <>
                    {/* Résumé */}
                    {summary && (
                        <View style={styles.summaryContainer}>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryTitle}>Résumé embarquement</Text>
                                <View style={styles.summaryStats}>
                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryValue}>
                                            {summary.boarded_passengers}/{summary.total_reservations}
                                        </Text>
                                        <Text style={styles.summaryLabel}>Embarqués</Text>
                                    </View>
                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryValue}>
                                            {summary.pending_passengers}
                                        </Text>
                                        <Text style={styles.summaryLabel}>En attente</Text>
                                    </View>
                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryValue}>
                                            {summary.completion_percentage.toFixed(0)}%
                                        </Text>
                                        <Text style={styles.summaryLabel}>Complété</Text>
                                    </View>
                                </View>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${summary.completion_percentage}%`,
                                                backgroundColor:
                                                    summary.is_complete
                                                        ? '#10B981'
                                                        : modernColors.primary,
                                            },
                                        ]}
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Bouton scanner */}
                    <View style={styles.scannerButtonContainer}>
                        <TouchableOpacity
                            style={styles.scannerButton}
                            onPress={() => setShowScanner(true)}
                            disabled={scanning}
                        >
                            <SafeIcon name="qr-code" size={24} color="#fff" />
                            <Text style={styles.scannerButtonText}>
                                {scanning ? 'Scan en cours...' : 'Scanner QR code ticket'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Liste des passagers */}
                    <ScrollView style={styles.passengersList}>
                        <Text style={styles.passengersTitle}>Liste des passagers</Text>
                        {passengers.map((passenger) => renderPassengerCard(passenger))}
                    </ScrollView>
                </>
            )}

            {/* Modal Scanner QR Code */}
            <Modal
                visible={showScanner}
                animationType="slide"
                onRequestClose={() => setShowScanner(false)}
            >
                <View style={styles.scannerModal}>
                    <View style={styles.scannerHeader}>
                        <Text style={styles.scannerTitle}>Scanner QR code</Text>
                        <TouchableOpacity
                            onPress={() => setShowScanner(false)}
                            style={styles.closeButton}
                        >
                            <SafeIcon name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.scannerContent}>
                        <Text style={styles.scannerInstructions}>
                            Pointez la caméra vers le QR code du ticket
                        </Text>
                        {/* TODO: Intégrer le scanner QR code réel */}
                        <View style={styles.scannerPlaceholder}>
                            <SafeIcon name="camera" size={64} color="#D1D5DB" />
                            <Text style={styles.scannerPlaceholderText}>
                                Scanner QR code à implémenter
                            </Text>
                            <Text style={styles.scannerPlaceholderSubtext}>
                                Utiliser expo-barcode-scanner ou react-native-vision-camera
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.manualEntryButton}
                            onPress={() => {
                                // Alternative: saisie manuelle du code
                                Alert.alert(
                                    'Saisie manuelle',
                                    'Entrez le code de réservation',
                                    [
                                        { text: 'Annuler', style: 'cancel' },
                                        {
                                            text: 'Valider',
                                            onPress: () => {
                                                // TODO: Implémenter validation par code
                                            },
                                        },
                                    ]
                                );
                            }}
                        >
                            <Text style={styles.manualEntryButtonText}>
                                Saisir code manuellement
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
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
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    placeholder: {
        width: 32,
    },
    busInfo: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    busNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
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
    summaryContainer: {
        padding: 16,
    },
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    summaryStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    summaryStat: {
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    progressBar: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    scannerButtonContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    scannerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        gap: 8,
    },
    scannerButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    passengersList: {
        flex: 1,
        padding: 16,
    },
    passengersTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    passengerCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    passengerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    passengerInfo: {
        flex: 1,
    },
    passengerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    seatInfo: {
        fontSize: 14,
        color: '#6B7280',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    validatedAt: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
    },
    validateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 6,
        marginTop: 8,
    },
    validateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    scannerModal: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
    },
    scannerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    scannerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    scannerInstructions: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 32,
        textAlign: 'center',
    },
    scannerPlaceholder: {
        alignItems: 'center',
        marginBottom: 32,
    },
    scannerPlaceholderText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
    },
    scannerPlaceholderSubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 8,
        textAlign: 'center',
    },
    manualEntryButton: {
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    manualEntryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default BusBoardingManagementScreen;

