// Écran utilisateur: Voir les créneaux disponibles et réserver (Hôpital/Laboratoire/Imagerie)
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Slot {
    id: number;
    start_time: string;
    end_time: string;
    max_bookings: number;
    current_bookings: number;
    consultation_type: string | null;
    price: number | null;
    currency: string | null;
    available: boolean;
    remaining: number;
}

interface BookAppointmentScreenProps {
    route: {
        params: {
            serviceId: number;
            serviceType: 'hopital' | 'laboratoire';
            serviceName?: string;
        };
    };
    navigation: any;
}

const BookAppointmentScreen: React.FC<BookAppointmentScreenProps> = ({ route, navigation }) => {
    const { user } = useAuth();
    const { serviceId, serviceType, serviceName } = route.params;

        const { t } = useLanguageSafe();
const [selectedDate, setSelectedDate] = useState<string>('');
    const [datesWithSlots, setDatesWithSlots] = useState<string[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    // Booking form
    const [patientName, setPatientName] = useState(user?.name || '');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    // Load available dates first
    const loadAvailability = useCallback(async (date?: string) => {
        try {
            setLoading(true);
            const queryDate = date || new Date().toISOString().split('T')[0];
            const endpoint = serviceType === 'hopital'
                ? `/api/hopitaux/${serviceId}/available-slots?date=${queryDate}`
                : `/api/laboratoires/${serviceId}/available-slots?date=${queryDate}`;

            const response = await apiGet(endpoint);
            if (response.success) {
                const data = response as any;
                const allSlots = data.slots || data.data?.slots || [];
                setSlots(allSlots.filter((s: Slot) => s.available));
                const dates = data.dates_with_availability || data.data?.dates_with_availability || [];
                if (dates.length > 0 && !date) {
                    setDatesWithSlots(dates);
                    // Auto-select first available date
                    if (!selectedDate) {
                        setSelectedDate(dates[0]);
                        // Reload with correct date
                        loadSlotsForDate(dates[0]);
                        return;
                    }
                } else if (dates.length > 0) {
                    setDatesWithSlots(dates);
                }
            }
        } catch (error: any) {
            console.error('[BookAppointmentScreen] Erreur:', error);
        } finally {
            setLoading(false);
        }
    }, [serviceId, serviceType]);

    const loadSlotsForDate = async (date: string) => {
        try {
            setLoading(true);
            setSelectedDate(date);
            setSelectedSlot(null);
            const endpoint = serviceType === 'hopital'
                ? `/api/hopitaux/${serviceId}/available-slots?date=${date}`
                : `/api/laboratoires/${serviceId}/available-slots?date=${date}`;

            const response = await apiGet(endpoint);
            if (response.success) {
                const data = response as any;
                const allSlots = data.slots || data.data?.slots || [];
                setSlots(allSlots.filter((s: Slot) => s.available));
            }
        } catch (error: any) {
            console.error('[BookAppointmentScreen] Erreur chargement slots:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAvailability();
    }, [loadAvailability]);

    const handleBookSlot = async () => {
        if (!selectedSlot) {
            Alert.alert('Erreur', 'Veuillez sélectionner un créneau');
            return;
        }
        if (!patientName.trim()) {
            Alert.alert('Erreur', 'Le nom du patient est obligatoire');
            return;
        }

        try {
            setBooking(true);
            const response = await apiPost('/api/appointments/book', {
                slot_id: selectedSlot.id,
                patient_name: patientName.trim(),
                reason: reason.trim() || null,
                notes: notes.trim() || null,
            });

            if (response.success) {
                Alert.alert(
                    t('bookAppointmentScreen.reservationConfirmee'),
                    t('bookAppointmentScreen.votreRendezvousDuAAEte', { formatDateDisplay(selectedDate): formatDateDisplay(selectedDate), selectedSlot_start_time?_substring(0, 5): selectedSlot.start_time?.substring(0, 5) }),
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', (response as any).error || t('bookAppointment.impossibleDeReserver'));
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setBooking(false);
        }
    };

    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long' };
        return d.toLocaleDateString('fr-FR', options);
    };

    const formatDateShort = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    const getDayName = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Prendre rendez-vous</Text>
                    <Text style={styles.headerSubtitle}>
                        {serviceName || (serviceType === 'hopital' ? 'Hôpital / Clinique' : 'Laboratoire / Imagerie')}
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.scrollContent}>
                {/* Date Selector */}
                <Text style={styles.sectionTitle}>{t('bookAppointment.choisirUneDate')}</Text>
                {datesWithSlots.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                        {datesWithSlots.map((date) => (
                            <TouchableOpacity
                                key={date}
                                style={[styles.dateCard, selectedDate === date && styles.dateCardActive]}
                                onPress={() => loadSlotsForDate(date)}
                            >
                                <Text style={[styles.dateDayName, selectedDate === date && styles.dateTextActive]}>
                                    {getDayName(date)}
                                </Text>
                                <Text style={[styles.dateDay, selectedDate === date && styles.dateTextActive]}>
                                    {formatDateShort(date)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : !loading ? (
                    <View style={styles.noAvailability}>
                        <SafeIcon name="calendar-x" size={32} color="#9CA3AF" />
                        <Text style={styles.noAvailabilityText}>
                            Aucun créneau disponible dans les 30 prochains jours
                        </Text>
                    </View>
                ) : null}

                {/* Slots */}
                {selectedDate ? (
                    <>
                        <Text style={styles.sectionTitle}>
                            Créneaux du {formatDateDisplay(selectedDate)}
                        </Text>
                        {loading ? (
                            <ActivityIndicator size="large" color={modernColors.primary} style={{ marginTop: 20 }} />
                        ) : slots.length > 0 ? (
                            <View style={styles.slotsGrid}>
                                {slots.map((slot) => (
                                    <TouchableOpacity
                                        key={slot.id}
                                        style={[
                                            styles.slotChip,
                                            selectedSlot?.id === slot.id && styles.slotChipSelected,
                                        ]}
                                        onPress={() => setSelectedSlot(slot)}
                                    >
                                        <Text style={[
                                            styles.slotChipTime,
                                            selectedSlot?.id === slot.id && styles.slotChipTimeSelected,
                                        ]}>
                                            {slot.start_time?.substring(0, 5)}
                                        </Text>
                                        {slot.consultation_type && (
                                            <Text style={[
                                                styles.slotChipType,
                                                selectedSlot?.id === slot.id && styles.slotChipTypeSelected,
                                            ]} numberOfLines={1}>
                                                {slot.consultation_type}
                                            </Text>
                                        )}
                                        {slot.price != null && (
                                            <Text style={[
                                                styles.slotChipPrice,
                                                selectedSlot?.id === slot.id && styles.slotChipPriceSelected,
                                            ]}>
                                                {slot.price} {slot.currency || 'XAF'}
                                            </Text>
                                        )}
                                        <Text style={[
                                            styles.slotChipRemaining,
                                            selectedSlot?.id === slot.id && styles.slotChipRemainingSelected,
                                        ]}>
                                            {slot.remaining} place(s)
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.noSlots}>
                                <Text style={styles.noSlotsText}>{t('bookAppointment.aucunCreneauDisponibleCeJour')}</Text>
                            </View>
                        )}
                    </>
                ) : null}

                {/* Booking Form */}
                {selectedSlot && (
                    <View style={styles.bookingForm}>
                        <Text style={styles.sectionTitle}>{t('bookAppointment.vosInformations')}</Text>

                        <View style={styles.selectedSlotBanner}>
                            <SafeIcon name="check-circle" size={20} color="#059669" />
                            <Text style={styles.selectedSlotText}>
                                {formatDateDisplay(selectedDate)} à {selectedSlot.start_time?.substring(0, 5)} - {selectedSlot.end_time?.substring(0, 5)}
                                {selectedSlot.consultation_type ? ` (${selectedSlot.consultation_type})` : ''}
                            </Text>
                        </View>

                        <Text style={styles.fieldLabel}>{t('bookAppointment.nomDuPatient')}/Text>
                        <NativeInput
                            value={patientName}
                            onChangeText={setPatientName}
                            placeholder={t('bookAppointment.nomCompletDuPatient')}
                        />

                        <Text style={styles.fieldLabel}>
                            {serviceType === 'hopital' ? 'Motif de consultation' : 'Type d\t('bookAppointmentScreen.examenSouhaite')}
                        </Text>
                        <NativeInput
                            value={reason}
                            onChangeText={setReason}
                            placeholder={serviceType === 'hopital' ? 'Ex: Douleurs abdominales...' : 'Ex: Bilan sanguin complet...'}
                            multiline
                        />

                        <Text style={styles.fieldLabel}>{t('bookAppointment.notesSupplementaires')}</Text>
                        <NativeInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder={t('bookAppointment.informationsComplementaires')}
                            multiline
                        />

                        {selectedSlot.price != null && (
                            <View style={styles.priceBanner}>
                                <Text style={styles.priceLabel}>Tarif consultation</Text>
                                <Text style={styles.priceValue}>{selectedSlot.price} {selectedSlot.currency || 'XAF'}</Text>
                            </View>
                        )}

                        <NativeButton
                            title={booking ? t('bookAppointmentScreen.reservationEnCours') : t('bookAppointmentScreen.confirmerLeRendezvous')}
                            onPress={handleBookSlot}
                            disabled={booking}
                        />
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backButton: { padding: 8, marginRight: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    scrollContent: { flex: 1 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
    dateScroll: { paddingHorizontal: 12, paddingBottom: 8 },
    dateCard: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, marginHorizontal: 4, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', minWidth: 60 },
    dateCardActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    dateDayName: { fontSize: 12, color: '#6B7280', fontWeight: '600', textTransform: 'capitalize' },
    dateDay: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 2 },
    dateTextActive: { color: '#fff' },
    noAvailability: { alignItems: 'center', padding: 30 },
    noAvailabilityText: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
    slotChip: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, minWidth: '30%', alignItems: 'center' },
    slotChipSelected: { borderColor: modernColors.primary, backgroundColor: '#EEF2FF' },
    slotChipTime: { fontSize: 16, fontWeight: '700', color: '#111827' },
    slotChipTimeSelected: { color: modernColors.primary },
    slotChipType: { fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' },
    slotChipTypeSelected: { color: modernColors.primary },
    slotChipPrice: { fontSize: 12, fontWeight: '600', color: '#059669', marginTop: 2 },
    slotChipPriceSelected: { color: modernColors.primary },
    slotChipRemaining: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
    slotChipRemainingSelected: { color: modernColors.primary },
    noSlots: { padding: 30, alignItems: 'center' },
    noSlotsText: { fontSize: 14, color: '#9CA3AF' },
    bookingForm: { padding: 16, marginTop: 8 },
    selectedSlotBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 12, borderRadius: 10, marginBottom: 16, gap: 8 },
    selectedSlotText: { fontSize: 14, fontWeight: '600', color: '#059669', flex: 1 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 4 },
    priceBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF7ED', padding: 14, borderRadius: 10, marginTop: 16, marginBottom: 16 },
    priceLabel: { fontSize: 14, color: '#92400E', fontWeight: '500' },
    priceValue: { fontSize: 18, fontWeight: '700', color: '#B45309' },
});

export default BookAppointmentScreen;
