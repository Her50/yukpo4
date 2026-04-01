// H1 - Mes Rendez-vous avec statuts et gestion des rappels
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { hospitalService } from '../../services/hospitalService';
import notificationSchedulerService from '../../services/notificationSchedulerService';
import { modernColors } from '../../theme/modernTheme';

interface Appointment {
    id: number;
    hospital_id: number;
    hospital_name?: string;
    service_name?: string;
    preferred_date?: string;
    preferred_time?: string;
    status?: string;
    notes?: string;
    created_at?: string;
    reminder_id?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending:   { label: 'En attente',  color: '#F59E0B' },
    confirmed: { label: 'Confirmé',    color: '#10B981' },
    cancelled: { label: 'Annulé',      color: '#EF4444' },
    done:      { label: 'Terminé',     color: '#6B7280' },
};

const MesRdvScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir vos RDV');
            navigation.goBack();
            return;
        }
        loadAppointments();
    }, [statusFilter]);

    const loadAppointments = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const resp = await hospitalService.getMyAppointments({
                status: statusFilter || undefined,
            });
            const data = (resp?.data || resp) as any;
            setAppointments(data?.appointments || []);
        } catch (e) {
            console.warn('[MesRdvScreen] erreur chargement:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleCancelReminder = useCallback(async (appointment: Appointment) => {
        const remId = appointment.reminder_id || `rdv_${appointment.id}`;
        Alert.alert(
            'Annuler le rappel',
            `Supprimer le rappel pour ce RDV ?`,
            [
                { text: 'Non', style: 'cancel' },
                {
                    text: 'Oui, annuler',
                    style: 'destructive',
                    onPress: async () => {
                        await notificationSchedulerService.cancelReminder(remId);
                        Alert.alert('Rappel annulé', 'Le rappel a été supprimé.');
                    },
                },
            ]
        );
    }, []);

    const statusInfo = (status?: string) =>
        STATUS_LABELS[status || 'pending'] || STATUS_LABELS['pending'];

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const renderItem = ({ item }: { item: Appointment }) => {
        const si = statusInfo(item.status);
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.iconWrap}>
                        <SafeIcon name="calendar" size={22} color={modernColors.primary} />
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.hospitalName}>{item.hospital_name || 'Hôpital'}</Text>
                        {item.service_name ? (
                            <Text style={styles.serviceName}>{item.service_name}</Text>
                        ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: si.color + '22' }]}>
                        <Text style={[styles.statusText, { color: si.color }]}>{si.label}</Text>
                    </View>
                </View>

                <View style={styles.dateRow}>
                    <SafeIcon name="clock" size={14} color="#6B7280" />
                    <Text style={styles.dateText}>
                        {formatDate(item.preferred_date)}
                        {item.preferred_time ? `  ${item.preferred_time}` : ''}
                    </Text>
                </View>

                {item.notes ? (
                    <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
                ) : null}

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.btnOutline}
                        onPress={() => handleCancelReminder(item)}
                    >
                        <SafeIcon name="bell-off" size={14} color={modernColors.primary} />
                        <Text style={styles.btnOutlineText}>Annuler le rappel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.btnPrimary}
                        onPress={() =>
                            (navigation as any).navigate('PostConsultationFeedback', {
                                consultationId: item.id,
                            })
                        }
                    >
                        <SafeIcon name="star" size={14} color="#fff" />
                        <Text style={styles.btnPrimaryText}>Donner avis</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const filters = [null, 'pending', 'confirmed', 'done', 'cancelled'];
    const filterLabel = (s: string | null) => s ? STATUS_LABELS[s]?.label : 'Tous';

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color={modernColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Mes Rendez-vous</Text>
            </View>

            {/* Filtres statut */}
            <View style={styles.filterRow}>
                {filters.map(f => (
                    <TouchableOpacity
                        key={String(f)}
                        style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
                        onPress={() => setStatusFilter(f)}
                    >
                        <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
                            {filterLabel(f)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={modernColors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={appointments}
                    keyExtractor={i => String(i.id)}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadAppointments(true)} />
                    }
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <SafeIcon name="calendar-off" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>Aucun rendez-vous trouvé</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 48,
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backBtn: { marginRight: 12, padding: 4 },
    title: { fontSize: 20, fontWeight: '700', color: modernColors.textPrimary },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexWrap: 'wrap',
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    filterChipActive: { backgroundColor: modernColors.primary },
    filterChipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
    filterChipTextActive: { color: '#fff' },
    list: { padding: 16, gap: 12 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    iconWrap: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: modernColors.primary + '15',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 10,
    },
    cardInfo: { flex: 1 },
    hospitalName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    serviceName: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    statusBadge: {
        paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 10, alignSelf: 'flex-start',
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    dateText: { fontSize: 13, color: '#374151' },
    notes: { fontSize: 13, color: '#6B7280', marginBottom: 10, fontStyle: 'italic' },
    actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    btnOutline: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 9, borderRadius: 8,
        borderWidth: 1, borderColor: modernColors.primary,
    },
    btnOutlineText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },
    btnPrimary: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 9, borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    btnPrimaryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 15, color: '#9CA3AF' },
});

export default MesRdvScreen;
