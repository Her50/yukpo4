// ✅ NOUVEAU: Écran de gestion de disponibilité pour gérants d'hôtels/meublés
// Date: 2026-01-26

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
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
import { Calendar } from 'react-native-calendars';
import { apiGet, apiPost, apiDelete } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';

type RouteParams = {
    propertyId: number;
    serviceId: number;
};

interface AvailabilityBlock {
    id: number;
    date_debut: string;
    date_fin: string;
    block_type: string;
    reason?: string;
    is_active: boolean;
}

interface Reservation {
    id: number;
    date_arrivee: string;
    date_depart: string;
    nombre_nuitees: number;
    montant_total: number;
    status: string;
    payment_status: string;
    nom_client?: string;
}

interface CalendarDay {
    date: string;
    status: 'available' | 'reserved' | 'blocked';
}

const HotelAvailabilityManagementScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { user } = useAuth();
    const propertyId = route.params?.propertyId;
    const serviceId = route.params?.serviceId;

    const [loading, setLoading] = useState(true);
    const [calendar, setCalendar] = useState<Record<string, CalendarDay>>({});
    const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    
    // Modal blocage
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockForm, setBlockForm] = useState({
        date_debut: '',
        date_fin: '',
        block_type: 'maintenance',
        reason: '',
    });

    // Statistiques
    const [stats, setStats] = useState({
        occupancy_rate: 0,
        total_revenue: 0,
        upcoming_reservations: 0,
    });

    useEffect(() => {
        loadData();
    }, [propertyId, selectedMonth]);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                loadCalendar(),
                loadBlocks(),
                loadReservations(),
                loadStats(),
            ]);
        } catch (error) {
            console.error('[HotelAvailabilityManagement] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de charger les données');
        } finally {
            setLoading(false);
        }
    };

    const loadCalendar = async () => {
        const response = await apiGet<{ success: boolean; data: CalendarDay[] }>(
            `/api/immobilier/biens/${propertyId}/availability/calendar`
        );
        if (response.success && response.data) {
            const calendarData: Record<string, any> = {};
            response.data.forEach(day => {
                const color = day.status === 'available' ? '#10B981' : 
                             day.status === 'reserved' ? '#EF4444' : '#F59E0B';
                calendarData[day.date] = {
                    selected: true,
                    selectedColor: color,
                    marked: true,
                    dotColor: color,
                };
            });
            setCalendar(calendarData);
        }
    };

    const loadBlocks = async () => {
        const response = await apiGet<{ success: boolean; data: AvailabilityBlock[] }>(
            `/api/immobilier/biens/${propertyId}/availability/blocks`
        );
        if (response.success && response.data) {
            setBlocks(response.data.filter(b => b.is_active));
        }
    };

    const loadReservations = async () => {
        // TODO: Créer endpoint pour lister réservations d'un bien
        // Pour l'instant, utiliser un endpoint générique
        const response = await apiGet<{ success: boolean; data: Reservation[] }>(
            `/api/immobilier/biens/${propertyId}/reservations`
        );
        if (response.success && response.data) {
            setReservations(response.data);
        }
    };

    const loadStats = async () => {
        // TODO: Créer endpoint pour statistiques
        // Calculer depuis les données existantes
        const upcoming = reservations.filter(r => 
            r.status === 'pending' || r.status === 'confirmed'
        ).length;
        const totalRevenue = reservations
            .filter(r => r.payment_status === 'fully_paid')
            .reduce((sum, r) => sum + r.montant_total, 0);
        
        setStats({
            occupancy_rate: 0, // À calculer depuis calendrier
            total_revenue: totalRevenue,
            upcoming_reservations: upcoming,
        });
    };

    const handleCreateBlock = async () => {
        if (!blockForm.date_debut || !blockForm.date_fin) {
            Alert.alert('Erreur', 'Veuillez sélectionner les dates');
            return;
        }

        try {
            const response = await apiPost(
                `/api/immobilier/biens/${propertyId}/availability/blocks`,
                blockForm
            );

            if (response.success) {
                Alert.alert('Succès', 'Blocage créé avec succès');
                setShowBlockModal(false);
                setBlockForm({ date_debut: '', date_fin: '', block_type: 'maintenance', reason: '' });
                loadData();
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de la création');
            }
        } catch (error) {
            console.error('[HotelAvailabilityManagement] Erreur création blocage:', error);
            Alert.alert('Erreur', 'Impossible de créer le blocage');
        }
    };

    const handleDeleteBlock = async (blockId: number) => {
        Alert.alert(
            'Confirmer',
            'Voulez-vous supprimer ce blocage ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await apiDelete(
                                `/api/immobilier/biens/${propertyId}/availability/blocks/${blockId}`
                            );
                            if (response.success) {
                                loadData();
                            }
                        } catch (error) {
                            Alert.alert('Erreur', 'Impossible de supprimer le blocage');
                        }
                    },
                },
            ]
        );
    };

    const getBlockTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            maintenance: '🔧 Maintenance',
            renovation: '🏗️ Rénovation',
            fermeture: '🚫 Fermeture',
            event: '🎉 Événement',
            manual: '✋ Manuel',
        };
        return labels[type] || type;
    };

    const getReservationStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: '⏳ En attente',
            confirmed: '✅ Confirmée',
            checked_in: '🏨 En cours',
            checked_out: '✅ Terminée',
            cancelled: '❌ Annulée',
        };
        return labels[status] || status;
    };

    if (loading) {
        return (
            <SafeNativeView>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView>
            <ScrollView style={styles.container}>
                {/* En-tête */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Gestion Disponibilité</Text>
                    <TouchableOpacity
                        onPress={() => setShowBlockModal(true)}
                        style={styles.addButton}
                    >
                        <SafeIcon name="plus" size={24} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Statistiques */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.occupancy_rate}%</Text>
                        <Text style={styles.statLabel}>Taux occupation</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>
                            {stats.total_revenue.toLocaleString('fr-FR')} FCFA
                        </Text>
                        <Text style={styles.statLabel}>Revenus totaux</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.upcoming_reservations}</Text>
                        <Text style={styles.statLabel}>Réservations à venir</Text>
                    </View>
                </View>

                {/* Calendrier */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📅 Calendrier de disponibilité</Text>
                    <Calendar
                        current={selectedMonth.toISOString().split('T')[0]}
                        markedDates={calendar}
                        markingType="multi-dot"
                        theme={{
                            todayTextColor: modernColors.primary,
                            selectedDayBackgroundColor: modernColors.primary,
                            arrowColor: modernColors.primary,
                        }}
                        onMonthChange={(month) => {
                            setSelectedMonth(new Date(month.dateString));
                        }}
                    />
                    <View style={styles.legend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
                            <Text style={styles.legendText}>Disponible</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
                            <Text style={styles.legendText}>Réservé</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#F59E0B' }]} />
                            <Text style={styles.legendText}>Bloqué</Text>
                        </View>
                    </View>
                </View>

                {/* Blocages actifs */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🚫 Blocages actifs</Text>
                    {blocks.length === 0 ? (
                        <Text style={styles.emptyText}>Aucun blocage actif</Text>
                    ) : (
                        blocks.map(block => (
                            <View key={block.id} style={styles.blockCard}>
                                <View style={styles.blockHeader}>
                                    <View>
                                        <Text style={styles.blockType}>
                                            {getBlockTypeLabel(block.block_type)}
                                        </Text>
                                        <Text style={styles.blockDates}>
                                            {block.date_debut} → {block.date_fin}
                                        </Text>
                                        {block.reason && (
                                            <Text style={styles.blockReason}>{block.reason}</Text>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteBlock(block.id)}
                                        style={styles.deleteButton}
                                    >
                                        <SafeIcon name="trash-2" size={20} color={modernColors.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* Réservations */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📋 Réservations</Text>
                    {reservations.length === 0 ? (
                        <Text style={styles.emptyText}>Aucune réservation</Text>
                    ) : (
                        reservations.map(reservation => (
                            <View key={reservation.id} style={styles.reservationCard}>
                                <View style={styles.reservationHeader}>
                                    <View>
                                        <Text style={styles.reservationClient}>
                                            {reservation.nom_client || 'Client'}
                                        </Text>
                                        <Text style={styles.reservationDates}>
                                            {reservation.date_arrivee} → {reservation.date_depart}
                                        </Text>
                                        <Text style={styles.reservationNights}>
                                            {reservation.nombre_nuitees} nuitée{reservation.nombre_nuitees > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                    <View style={styles.reservationStatus}>
                                        <Text style={styles.reservationStatusText}>
                                            {getReservationStatusLabel(reservation.status)}
                                        </Text>
                                        <Text style={styles.reservationPayment}>
                                            {reservation.payment_status === 'fully_paid' ? '✅ Payé' : 
                                             reservation.payment_status === 'advance_paid' ? '💰 Acompte' : 
                                             '⏳ En attente'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.reservationAmount}>
                                    {reservation.montant_total.toLocaleString('fr-FR')} FCFA
                                </Text>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Modal création blocage */}
            <Modal
                visible={showBlockModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowBlockModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Bloquer des dates</Text>
                            <TouchableOpacity onPress={() => setShowBlockModal(false)}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <NativeInput
                                label="Date début"
                                value={blockForm.date_debut}
                                onChangeText={(text) => setBlockForm({ ...blockForm, date_debut: text })}
                                placeholder="YYYY-MM-DD"
                            />

                            <NativeInput
                                label="Date fin"
                                value={blockForm.date_fin}
                                onChangeText={(text) => setBlockForm({ ...blockForm, date_fin: text })}
                                placeholder="YYYY-MM-DD"
                            />

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Type de blocage</Text>
                                {['maintenance', 'renovation', 'fermeture', 'event', 'manual'].map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.typeButton,
                                            blockForm.block_type === type && styles.typeButtonActive,
                                        ]}
                                        onPress={() => setBlockForm({ ...blockForm, block_type: type })}
                                    >
                                        <Text style={[
                                            styles.typeButtonText,
                                            blockForm.block_type === type && styles.typeButtonTextActive,
                                        ]}>
                                            {getBlockTypeLabel(type)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <NativeInput
                                label="Raison (optionnel)"
                                value={blockForm.reason}
                                onChangeText={(text) => setBlockForm({ ...blockForm, reason: text })}
                                placeholder="Ex: Rénovation des chambres"
                                multiline
                            />

                            <NativeButton
                                title="Créer blocage"
                                onPress={handleCreateBlock}
                                style={styles.submitButton}
                            />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: modernColors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
    },
    addButton: {
        padding: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: modernColors.surface,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    section: {
        padding: 16,
        backgroundColor: modernColors.surface,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendColor: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    legendText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    blockCard: {
        backgroundColor: modernColors.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.warning,
    },
    blockHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    blockType: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    blockDates: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    blockReason: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    deleteButton: {
        padding: 8,
    },
    reservationCard: {
        backgroundColor: modernColors.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    reservationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    reservationClient: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    reservationDates: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    reservationNights: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    reservationStatus: {
        alignItems: 'flex-end',
    },
    reservationStatusText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    reservationPayment: {
        fontSize: 12,
        color: modernColors.success,
    },
    reservationAmount: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.primary,
    },
    emptyText: {
        textAlign: 'center',
        color: modernColors.textSecondary,
        padding: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 8,
    },
    typeButton: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.background,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    typeButtonActive: {
        backgroundColor: modernColors.primary + '20',
        borderColor: modernColors.primary,
    },
    typeButtonText: {
        fontSize: 14,
        color: modernColors.text,
    },
    typeButtonTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    submitButton: {
        marginTop: 16,
    },
});

export default HotelAvailabilityManagementScreen;

