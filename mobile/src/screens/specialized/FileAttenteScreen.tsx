// H4 - File d'attente virtuelle avec auto-refresh et notifications
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { hospitalService } from '../../services/hospitalService';
import notificationSchedulerService from '../../services/notificationSchedulerService';
import { modernColors } from '../../theme/modernTheme';

interface QueueState {
    position: number;
    estimated_wait_minutes: number;
    total_ahead: number;
}

const REFRESH_INTERVAL_MS = 30_000;

const FileAttenteScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute() as any;
    const { hospitalId, departement, hospitalName } = route.params || {};

    const [ticketId, setTicketId] = useState<string | null>(null);
    const [queueState, setQueueState] = useState<QueueState | null>(null);
    const [joining, setJoining] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notifScheduled, setNotifScheduled] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Rejoindre la file au montage si pas encore de ticket
    useEffect(() => {
        handleJoinQueue();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Auto-refresh toutes les 30s quand on a un ticket
    useEffect(() => {
        if (!ticketId) return;
        intervalRef.current = setInterval(() => {
            refreshPosition(false);
        }, REFRESH_INTERVAL_MS);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [ticketId]);

    const handleJoinQueue = async () => {
        setJoining(true);
        try {
            const resp = await hospitalService.joinVirtualQueue(hospitalId, departement || 'Général');
            const data = (resp?.data || resp) as any;
            const tid = data?.ticket_id;
            if (tid) {
                setTicketId(tid);
                setQueueState({
                    position: data.position || 1,
                    estimated_wait_minutes: data.estimated_wait_minutes || 0,
                    total_ahead: (data.position || 1) - 1,
                });
            } else {
                Alert.alert('Erreur', "Impossible de rejoindre la file d'attente");
            }
        } catch (e) {
            Alert.alert('Erreur', "Problème lors de l'inscription en file d'attente");
        } finally {
            setJoining(false);
        }
    };

    const refreshPosition = useCallback(async (showLoader = true) => {
        if (!ticketId) return;
        if (showLoader) setLoading(true);
        try {
            const resp = await hospitalService.getQueuePosition(hospitalId, ticketId);
            const data = (resp?.data || resp) as any;
            if (resp.success || data?.success) {
                setQueueState({
                    position: data.position,
                    estimated_wait_minutes: data.estimated_wait_minutes || 0,
                    total_ahead: data.total_ahead || 0,
                });
            }
        } catch (e) {
            console.warn('[FileAttenteScreen] refreshPosition error:', e);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [ticketId, hospitalId]);

    const handleNotifyMe = async () => {
        if (!queueState) return;
        // Planifier une notif estimée quand c'est son tour
        const waitMs = (queueState.estimated_wait_minutes || 5) * 60 * 1000;
        const notifDate = new Date(Date.now() + Math.max(waitMs - 5 * 60 * 1000, 60_000));
        await notificationSchedulerService.scheduleRDVReminder(
            notifDate,
            "C'est bientôt votre tour !",
            `Votre numéro sera appelé dans environ 5 minutes — ${departement || 'Consultation'}`,
            `queue_${ticketId}`
        );
        setNotifScheduled(true);
        Alert.alert('Rappel activé', 'Vous serez notifié quand votre tour approche.');
    };

    const handleLeaveQueue = () => {
        Alert.alert(
            'Quitter la file',
            'Voulez-vous quitter la file d\'attente ? Votre ticket sera annulé.',
            [
                { text: 'Non', style: 'cancel' },
                {
                    text: 'Quitter',
                    style: 'destructive',
                    onPress: async () => {
                        if (ticketId) {
                            await hospitalService.leaveQueue(hospitalId, ticketId);
                            if (notifScheduled) {
                                await notificationSchedulerService.cancelReminder(`queue_${ticketId}`);
                            }
                        }
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    // Calcul du pourcentage de progression (inverse de position)
    const progressPercent = queueState
        ? Math.max(0, Math.min(100, 100 - ((queueState.position - 1) / Math.max(queueState.total_ahead + 1, 1)) * 100))
        : 0;

    const circleSize = 180;
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    if (joining) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.joiningText}>Inscription en file d'attente...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color={modernColors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title}>File d'attente</Text>
                    {hospitalName && <Text style={styles.subtitle}>{hospitalName}</Text>}
                </View>
            </View>

            <View style={styles.content}>
                {departement && (
                    <View style={styles.departementBadge}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                        <Text style={styles.departementText}>{departement}</Text>
                    </View>
                )}

                {/* Cercle de progression */}
                <View style={styles.circleWrapper}>
                    <View style={[styles.outerCircle, { width: circleSize, height: circleSize }]}>
                        <View style={styles.innerCircle}>
                            {loading ? (
                                <ActivityIndicator size="small" color={modernColors.primary} />
                            ) : (
                                <>
                                    <Text style={styles.positionLabel}>Position</Text>
                                    <Text style={styles.positionNumber}>{queueState?.position ?? '—'}</Text>
                                    <Text style={styles.positionSub}>
                                        {queueState?.total_ahead != null ? `${queueState.total_ahead} avant vous` : ''}
                                    </Text>
                                </>
                            )}
                        </View>
                        {/* Indicateur arc visuel simplifié */}
                        <View
                            style={[
                                styles.progressArc,
                                { borderColor: modernColors.primary, opacity: progressPercent / 100 + 0.2 },
                            ]}
                        />
                    </View>
                </View>

                {/* Temps estimé */}
                {queueState && (
                    <View style={styles.waitCard}>
                        <SafeIcon name="clock" size={20} color="#F59E0B" />
                        <Text style={styles.waitLabel}>Temps d'attente estimé</Text>
                        <Text style={styles.waitTime}>
                            {queueState.estimated_wait_minutes > 0
                                ? `${queueState.estimated_wait_minutes} min`
                                : 'Bientôt votre tour'}
                        </Text>
                    </View>
                )}

                {/* Ticket ID */}
                {ticketId && (
                    <View style={styles.ticketRow}>
                        <Text style={styles.ticketLabel}>Numéro de ticket</Text>
                        <Text style={styles.ticketId}>{ticketId}</Text>
                    </View>
                )}

                {/* Rafraichir */}
                <TouchableOpacity style={styles.refreshBtn} onPress={() => refreshPosition(true)}>
                    <SafeIcon name="refresh-cw" size={16} color={modernColors.primary} />
                    <Text style={styles.refreshText}>Actualiser la position</Text>
                </TouchableOpacity>
                <Text style={styles.autoRefreshHint}>Actualisation automatique toutes les 30s</Text>

                {/* Boutons d'action */}
                <View style={styles.actionBtns}>
                    <TouchableOpacity
                        style={[styles.notifBtn, notifScheduled && styles.notifBtnDone]}
                        onPress={handleNotifyMe}
                        disabled={notifScheduled}
                    >
                        <SafeIcon name={notifScheduled ? 'bell-check' : 'bell'} size={18} color={notifScheduled ? '#10B981' : modernColors.primary} />
                        <Text style={[styles.notifBtnText, notifScheduled && styles.notifBtnTextDone]}>
                            {notifScheduled ? 'Rappel activé' : 'Me notifier quand c\'est mon tour'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveQueue}>
                        <SafeIcon name="log-out" size={18} color="#EF4444" />
                        <Text style={styles.leaveBtnText}>Quitter la file</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    joiningText: { fontSize: 15, color: '#6B7280' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: 48, paddingHorizontal: 16, paddingBottom: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    },
    backBtn: { marginRight: 12, padding: 4 },
    headerText: { flex: 1 },
    title: { fontSize: 20, fontWeight: '700', color: modernColors.textPrimary },
    subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    content: { flex: 1, alignItems: 'center', padding: 24, gap: 20 },
    departementBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: modernColors.primary + '15',
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    },
    departementText: { fontSize: 14, fontWeight: '600', color: modernColors.primary },
    circleWrapper: { marginVertical: 8 },
    outerCircle: {
        borderRadius: 90,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    innerCircle: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
    },
    progressArc: {
        position: 'absolute',
        width: 160, height: 160, borderRadius: 80,
        borderWidth: 6,
    },
    positionLabel: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
    positionNumber: { fontSize: 42, fontWeight: '800', color: modernColors.primary },
    positionSub: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
    waitCard: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    waitLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
    waitTime: { fontSize: 18, fontWeight: '700', color: '#F59E0B' },
    ticketRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    },
    ticketLabel: { fontSize: 13, color: '#6B7280' },
    ticketId: { fontSize: 14, fontWeight: '700', color: '#111827', letterSpacing: 1 },
    refreshBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
        borderWidth: 1, borderColor: modernColors.primary,
    },
    refreshText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },
    autoRefreshHint: { fontSize: 11, color: '#9CA3AF' },
    actionBtns: { width: '100%', gap: 12 },
    notifBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 14, borderRadius: 12,
        borderWidth: 1, borderColor: modernColors.primary,
        backgroundColor: '#fff',
    },
    notifBtnDone: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
    notifBtnText: { fontSize: 14, fontWeight: '600', color: modernColors.primary },
    notifBtnTextDone: { color: '#10B981' },
    leaveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 14, borderRadius: 12,
        borderWidth: 1, borderColor: '#EF4444',
        backgroundColor: '#FFF5F5',
    },
    leaveBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});

export default FileAttenteScreen;
