/**
 * Écran de gestion manuelle des places non disponibles
 * Permet aux agences de bloquer/débloquer des places avec une raison
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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface SeatBlock {
    id: string;
    product_id: string;
    seat_id: string;
    seat_number: number;
    reason: string;
    reason_details?: string;
    blocked_by: number;
    blocked_at: string;
    blocked_by_name?: string;
    product_name?: string;
    bus_number?: string;
}

const ManageBusSeatsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { t } = useLanguageSafe();
    const { productId } = (route.params as any) || {};

    const [loading, setLoading] = useState(true);
    const [seatMap, setSeatMap] = useState<any[]>([]);
    const [blockedSeats, setBlockedSeats] = useState<SeatBlock[]>([]);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [selectedSeatForBlock, setSelectedSeatForBlock] = useState<any | null>(null);
    const [blockReason, setBlockReason] = useState<string>('maintenance');
    const [blockReasonDetails, setBlockReasonDetails] = useState<string>('');

    useEffect(() => {
        if (productId) {
            loadData();
        } else {
            Alert.alert(t('message.error'), t('busSeats.productIdMissing'));
            navigation.goBack();
        }
    }, [productId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [availabilityRes, blocksRes] = await Promise.all([
                apiGet(`/api/bus-tickets/seats/${productId}/availability`),
                apiGet(`/api/bus-tickets/seats/${productId}/blocks`),
            ]);

            if (availabilityRes.success && availabilityRes.availability) {
                setSeatMap(availabilityRes.availability.seats || []);
            }

            if (blocksRes.success) {
                setBlockedSeats(blocksRes.blocks || []);
            }
        } catch (error: any) {
            console.error('Erreur chargement données:', error);
            Alert.alert(t('message.error'), t('busSeats.cannotLoad'));
        } finally {
            setLoading(false);
        }
    };

    const handleSeatPress = (seat: any) => {
        const isBlocked = blockedSeats.some((b) => b.seat_id === seat.seat_id && b.product_id === productId);

        if (isBlocked) {
            // Débloquer
            Alert.alert(
                t('busSeats.unblockSeat'),
                t('busSeats.unblockConfirm', { seat: seat.seat_number }),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: 'Débloquer',
                        onPress: async () => {
                            try {
                                const response = await apiPost('/api/bus-tickets/seats/unblock', {
                                    product_id: productId,
                                    seat_id: seat.seat_id,
                                });

                                if (response.success) {
                                    Alert.alert(t('message.success'), t('busSeats.seatUnblocked'));
                                    loadData();
                                } else {
                                    Alert.alert(t('message.error'), response.error || t('busSeats.cannotUnblock'));
                                }
                            } catch (error: any) {
                                Alert.alert(t('message.error'), t('busSeats.cannotUnblock'));
                            }
                        },
                    },
                ]
            );
        } else {
            // Bloquer
            setSelectedSeatForBlock(seat);
            setShowBlockModal(true);
        }
    };

    const handleBlockSeat = async () => {
        if (!selectedSeatForBlock) return;

        if (!blockReason) {
            Alert.alert(t('message.error'), t('busSeats.selectReason'));
            return;
        }

        try {
            const response = await apiPost('/api/bus-tickets/seats/block', {
                product_id: productId,
                seat_id: selectedSeatForBlock.seat_id,
                seat_number: selectedSeatForBlock.seat_number,
                reason: blockReason,
                reason_details: blockReasonDetails || null,
            });

            if (response.success) {
                Alert.alert(t('message.success'), t('busSeats.seatBlocked'));
                setShowBlockModal(false);
                setSelectedSeatForBlock(null);
                setBlockReason('maintenance');
                setBlockReasonDetails('');
                loadData();
            } else {
                Alert.alert(t('message.error'), response.error || t('busSeats.cannotBlock'));
            }
        } catch (error: any) {
            Alert.alert(t('message.error'), t('busSeats.cannotBlock'));
        }
    };

    const getSeatStatus = (seatId: string): 'available' | 'blocked' => {
        const isBlocked = blockedSeats.some((b) => b.seat_id === seatId && b.product_id === productId);
        return isBlocked ? 'blocked' : 'available';
    };

    const getSeatStyle = (status: string) => {
        switch (status) {
            case 'blocked':
                return styles.seatBlocked;
            default:
                return styles.seatAvailable;
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Gestion des places</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                    Appuyez sur une place pour la bloquer ou la débloquer
                </Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : (
                <ScrollView style={styles.content}>
                    {/* Liste des places bloquées */}
                    {blockedSeats.length > 0 && (
                        <View style={styles.blockedListContainer}>
                            <Text style={styles.sectionTitle}>Places bloquées ({blockedSeats.length})</Text>
                            {blockedSeats.map((block) => (
                                <View key={block.id} style={styles.blockedItem}>
                                    <View style={styles.blockedItemLeft}>
                                        <Text style={styles.blockedSeatNumber}>
                                            Place {block.seat_number} ({block.seat_id})
                                        </Text>
                                        <Text style={styles.blockedReason}>
                                            Raison: {block.reason}
                                            {block.reason_details && ` - ${block.reason_details}`}
                                        </Text>
                                        <Text style={styles.blockedDate}>
                                            Bloqué le {new Date(block.blocked_at).toLocaleString('fr-FR')}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Plan des sièges */}
                    <View style={styles.seatMapContainer}>
                        <Text style={styles.sectionTitle}>Plan des sièges</Text>
                        <View style={styles.legend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendSeat, styles.seatAvailable]} />
                                <Text style={styles.legendText}>Disponible</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendSeat, styles.seatBlocked]} />
                                <Text style={styles.legendText}>Bloquée</Text>
                            </View>
                        </View>

                        {rows.map((row) => (
                            <View key={row} style={styles.row}>
                                <Text style={styles.rowLabel}>Rangée {row}</Text>
                                <View style={styles.seatsInRow}>
                                    {seatsByRow[row].map((seat) => {
                                        const status = getSeatStatus(seat.seat_id);
                                        return (
                                            <TouchableOpacity
                                                key={seat.seat_id}
                                                style={[styles.seat, getSeatStyle(status)]}
                                                onPress={() => handleSeatPress(seat)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.seatText,
                                                        status === 'blocked' && styles.seatTextBlocked,
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
                </ScrollView>
            )}

            {/* Modal blocage */}
            <Modal
                visible={showBlockModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowBlockModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Bloquer la place {selectedSeatForBlock?.seat_number}</Text>
                            <TouchableOpacity
                                onPress={() => setShowBlockModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <SafeIcon name="x" size={24} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Raison du blocage *</Text>
                            <View style={styles.reasonButtons}>
                                {['maintenance', 'damaged', 'reserved', 'other'].map((reason) => (
                                    <TouchableOpacity
                                        key={reason}
                                        style={[
                                            styles.reasonButton,
                                            blockReason === reason && styles.reasonButtonActive,
                                        ]}
                                        onPress={() => setBlockReason(reason)}
                                    >
                                        <Text
                                            style={[
                                                styles.reasonButtonText,
                                                blockReason === reason && styles.reasonButtonTextActive,
                                            ]}
                                        >
                                            {reason === 'maintenance'
                                                ? 'Maintenance'
                                                : reason === 'damaged'
                                                    ? 'Endommagée'
                                                    : reason === 'reserved'
                                                        ? 'Réservée'
                                                        : 'Autre'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.modalLabel}>Détails (optionnel)</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={blockReasonDetails}
                                onChangeText={setBlockReasonDetails}
                                placeholder="Ex: Siège cassé, réparation en cours..."
                                multiline
                                numberOfLines={3}
                            />

                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={handleBlockSeat}
                            >
                                <Text style={styles.modalButtonText}>Bloquer la place</Text>
                            </TouchableOpacity>
                        </View>
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
    infoContainer: {
        padding: 16,
        backgroundColor: '#FEF3C7',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    infoText: {
        fontSize: 14,
        color: '#92400E',
        textAlign: 'center',
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
    blockedListContainer: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    blockedItem: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    blockedItemLeft: {
        flex: 1,
    },
    blockedSeatNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    blockedReason: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    blockedDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    seatMapContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    legend: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
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
        borderWidth: 1,
    },
    legendText: {
        fontSize: 12,
        color: '#6B7280',
    },
    row: {
        marginBottom: 16,
    },
    rowLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
    },
    seatsInRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    seat: {
        width: 40,
        height: 40,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    seatAvailable: {
        backgroundColor: '#F3F4F6',
        borderColor: '#D1D5DB',
    },
    seatBlocked: {
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
    },
    seatText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    seatTextBlocked: {
        color: '#fff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '90%',
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalBody: {
        padding: 16,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    reasonButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    reasonButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#F9FAFB',
    },
    reasonButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    reasonButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    reasonButtonTextActive: {
        color: '#fff',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        marginBottom: 16,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    modalButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});

export default ManageBusSeatsScreen;

