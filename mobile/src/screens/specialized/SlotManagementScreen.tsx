// Écran prestataire: Gestion des créneaux de consultation (Hôpital/Laboratoire)
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface Slot {
    id: number;
    start_time: string;
    end_time: string;
    max_bookings: number;
    current_bookings: number;
    consultation_type: string | null;
    price: number | null;
    currency: string | null;
    is_active: boolean;
    available: boolean;
}

interface SlotManagementScreenProps {
    route: {
        params: {
            serviceId: number;
            serviceType: 'hopital' | 'laboratoire';
            serviceName?: string;
        };
    };
    navigation: any;
}

const CONSULTATION_TYPES_HOPITAL = [
    t('slotManagementScreen.consultationGenerale'),
    t('slotManagementScreen.consultationSpecialisee'),
    'Urgences',
    'Suivi',
    t('slotManagementScreen.pediatrie'),
    t('slotManagementScreen.maternite'),
    'Chirurgie',
    'Radiologie',
];

const CONSULTATION_TYPES_LABO = [
    'Prise de sang',
    'Analyse urine',
    t('slotManagementScreen.bacteriologie'),
    'Imagerie - Radio',
    t('slotManagementScreen.imagerieEchographie'),
    'Imagerie - Scanner',
    'Imagerie - IRM',
    'Biochimie',
];

const SlotManagementScreen: React.FC<SlotManagementScreenProps> = ({ route, navigation }) => {
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { serviceId, serviceType, serviceName } = route.params;

    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state for adding a slot
    const [newSlot, setNewSlot] = useState({
        start_time: '08:00',
        end_time: '08:30',
        max_bookings: '1',
        consultation_type: '',
        price: '',
        notes: '',
    });

    const consultationTypes = serviceType === 'hopital' ? CONSULTATION_TYPES_HOPITAL : CONSULTATION_TYPES_LABO;

    const loadSlots = useCallback(async () => {
        try {
            setLoading(true);
            const endpoint = serviceType === 'hopital'
                ? `/api/hopitaux/${serviceId}/available-slots?date=${selectedDate}`
                : `/api/laboratoires/${serviceId}/available-slots?date=${selectedDate}`;
            const response = await apiGet(endpoint);
            if (response.success) {
                setSlots((response as any).slots || (response as any).data?.slots || []);
            }
        } catch (error: any) {
            console.error('[SlotManagementScreen] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [serviceId, serviceType, selectedDate]);

    useEffect(() => {
        loadSlots();
    }, [loadSlots]);

    const handleAddSlot = async () => {
        if (!newSlot.start_time || !newSlot.end_time) {
            Alert.alert(t('message.error'), t('slotManagement.startAndEndRequired'));
            return;
        }

        try {
            setSaving(true);
            const endpoint = serviceType === 'hopital'
                ? `/api/hopitaux/${serviceId}/slots`
                : `/api/laboratoires/${serviceId}/slots`;

            const response = await apiPost(endpoint, {
                date: selectedDate,
                service_type: serviceType,
                slots: [{
                    start_time: newSlot.start_time,
                    end_time: newSlot.end_time,
                    max_bookings: parseInt(newSlot.max_bookings) || 1,
                    consultation_type: newSlot.consultation_type || null,
                    price: newSlot.price ? parseFloat(newSlot.price) : null,
                    notes: newSlot.notes || null,
                }],
            });

            if (response.success) {
                Alert.alert(t('message.success'), t('slotManagement.slotAdded'));
                setShowAddModal(false);
                setNewSlot({ start_time: '08:00', end_time: '08:30', max_bookings: '1', consultation_type: '', price: '', notes: '' });
                loadSlots();
            } else {
                Alert.alert(t('message.error'), (response as any).error || t('slotManagement.cannotAddSlot'));
            }
        } catch (error: any) {
            Alert.alert(t('message.error'), error.message || t('slotManagement.errorOccurred'));
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateSlots = async () => {
        Alert.alert(
            t('slotManagement.generateSlots'),
            t('slotManagement.generateSlotsMsg', { date: selectedDate }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('slotManagement.generer'),
                    onPress: async () => {
                        try {
                            setSaving(true);
                            const generatedSlots = [];
                            for (let h = 8; h < 17; h++) {
                                generatedSlots.push({
                                    start_time: `${h.toString().padStart(2, '0')}:00`,
                                    end_time: `${h.toString().padStart(2, '0')}:30`,
                                    max_bookings: 1,
                                });
                                generatedSlots.push({
                                    start_time: `${h.toString().padStart(2, '0')}:30`,
                                    end_time: `${(h + 1).toString().padStart(2, '0')}:00`,
                                    max_bookings: 1,
                                });
                            }

                            const endpoint = serviceType === 'hopital'
                                ? `/api/hopitaux/${serviceId}/slots`
                                : `/api/laboratoires/${serviceId}/slots`;

                            const response = await apiPost(endpoint, {
                                date: selectedDate,
                                service_type: serviceType,
                                slots: generatedSlots,
                            });

                            if (response.success) {
                                Alert.alert(t('message.success'), t('slotManagement.slotsGenerated', { count: generatedSlots.length }));
                                loadSlots();
                            }
                        } catch (error: any) {
                            Alert.alert(t('message.error'), error.message || t('slotManagement.generationError'));
                        } finally {
                            setSaving(false);
                        }
                    },
                },
            ]
        );
    };

    const changeDate = (offset: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + offset);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        return d.toLocaleDateString('fr-FR', options);
    };

    const renderSlot = ({ item }: { item: Slot }) => (
        <View style={[styles.slotCard, !item.available && styles.slotCardFull]}>
            <View style={styles.slotTimeContainer}>
                <SafeIcon name="clock" size={16} color={item.available ? modernColors.primary : '#9CA3AF'} />
                <Text style={[styles.slotTime, !item.available && styles.slotTimeFull]}>
                    {item.start_time?.substring(0, 5)} - {item.end_time?.substring(0, 5)}
                </Text>
            </View>
            {item.consultation_type && (
                <Text style={styles.slotType}>{item.consultation_type}</Text>
            )}
            <View style={styles.slotMeta}>
                <Text style={styles.slotBookings}>
                    {item.current_bookings}/{item.max_bookings} réservé(s)
                </Text>
                {item.price != null && (
                    <Text style={styles.slotPrice}>{item.price} {item.currency || 'XAF'}</Text>
                )}
            </View>
            <View style={[styles.slotStatus, item.available ? styles.slotAvailable : styles.slotFull]}>
                <Text style={styles.slotStatusText}>
                    {item.available ? 'Disponible' : 'Complet'}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{t('slotManagement.gestionDesCreneaux')}</Text>
                    <Text style={styles.headerSubtitle}>{serviceName || (serviceType === 'hopital' ? t('slotManagementScreen.hopital') : 'Laboratoire')}</Text>
                </View>
            </View>

            {/* Date Navigation */}
            <View style={styles.dateNav}>
                <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
                    <SafeIcon name="chevron-left" size={24} color={modernColors.primary} />
                </TouchableOpacity>
                <View style={styles.dateCenter}>
                    <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
                </View>
                <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrow}>
                    <SafeIcon name="chevron-right" size={24} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAddModal(true)}>
                    <SafeIcon name="plus" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>{t('slotManagementScreen.ajouter')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleGenerateSlots}>
                    <SafeIcon name="zap" size={18} color={modernColors.primary} />
                    <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>Auto 08h-17h</Text>
                </TouchableOpacity>
            </View>

            {/* Slots List */}
            {loading ? (
                <ActivityIndicator size="large" color={modernColors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={slots}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderSlot}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSlots(); }} />}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <SafeIcon name="calendar" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>{t('slotManagement.aucunCreneauPourCetteDate')}</Text>
                            <Text style={styles.emptySubtext}>{t('slotManagement.ajoutezDesCreneauxOuGenerezles')}</Text>
                        </View>
                    }
                />
            )}

            {/* Add Slot Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('slotManagement.nouveauCreneau')}</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.fieldLabel}>{t('slotManagement.heureDeDebut')}</Text>
                            <NativeInput
                                value={newSlot.start_time}
                                onChangeText={(v: string) => setNewSlot({ ...newSlot, start_time: v })}
                                placeholder="08:00"
                            />
                            <Text style={styles.fieldLabel}>{t('slotManagement.heureDeFin')}</Text>
                            <NativeInput
                                value={newSlot.end_time}
                                onChangeText={(v: string) => setNewSlot({ ...newSlot, end_time: v })}
                                placeholder="08:30"
                            />
                            <Text style={styles.fieldLabel}>Places max</Text>
                            <NativeInput
                                value={newSlot.max_bookings}
                                onChangeText={(v: string) => setNewSlot({ ...newSlot, max_bookings: v })}
                                keyboardType="numeric"
                                placeholder="1"
                            />
                            <Text style={styles.fieldLabel}>{t('slotManagement.typeDeConsultation')}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {consultationTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.chip, newSlot.consultation_type === type && styles.chipActive]}
                                        onPress={() => setNewSlot({ ...newSlot, consultation_type: type })}
                                    >
                                        <Text style={[styles.chipText, newSlot.consultation_type === type && styles.chipTextActive]}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <Text style={styles.fieldLabel}>Prix (optionnel)</Text>
                            <NativeInput
                                value={newSlot.price}
                                onChangeText={(v: string) => setNewSlot({ ...newSlot, price: v })}
                                keyboardType="numeric"
                                placeholder="Ex: 5000"
                            />
                            <Text style={styles.fieldLabel}>{t('slotManagement.notesOptionnel')}</Text>
                            <NativeInput
                                value={newSlot.notes}
                                onChangeText={(v: string) => setNewSlot({ ...newSlot, notes: v })}
                                placeholder="Instructions pour le patient..."
                                multiline
                            />
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <NativeButton
                                title={saving ? 'Enregistrement...' : t('slotManagementScreen.ajouterLeCreneau')}
                                onPress={handleAddSlot}
                                disabled={saving}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backButton: { padding: 8, marginRight: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    dateNav: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    dateArrow: { padding: 8 },
    dateCenter: { flex: 1, alignItems: 'center' },
    dateText: { fontSize: 15, fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
    actions: { flexDirection: 'row', padding: 12, gap: 10 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: modernColors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 6 },
    actionBtnSecondary: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: modernColors.primary },
    actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    actionBtnTextSecondary: { color: modernColors.primary },
    listContent: { padding: 12 },
    slotCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    slotCardFull: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    slotTimeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    slotTime: { fontSize: 16, fontWeight: '700', color: '#111827' },
    slotTimeFull: { color: '#9CA3AF' },
    slotType: { fontSize: 13, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    slotMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    slotBookings: { fontSize: 13, color: '#6B7280' },
    slotPrice: { fontSize: 13, fontWeight: '600', color: modernColors.primary },
    slotStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    slotAvailable: { backgroundColor: '#ECFDF5' },
    slotFull: { backgroundColor: '#FEF2F2' },
    slotStatusText: { fontSize: 12, fontWeight: '600', color: '#059669' },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 },
    emptySubtext: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    modalBody: { padding: 16 },
    modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 4 },
    chipScroll: { marginVertical: 8 },
    chip: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8 },
    chipActive: { backgroundColor: modernColors.primary },
    chipText: { fontSize: 13, color: '#6B7280' },
    chipTextActive: { color: '#fff', fontWeight: '600' },
});

export default SlotManagementScreen;
