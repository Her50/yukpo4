// ✅ REFONTE 2026-03-07: TaxiDetailsScreen → UX moderne
// Hero gradient ambre, quick actions, profil chauffeur, équipements, assurance, partage, pull-to-refresh
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { InsuranceSelector } from '../../components/covoiturage/InsuranceSelector';
import { QRCodeDisplay } from '../../components/covoiturage/QRCodeDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import PushNotificationService from '../../services/pushNotificationService';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface TaxiDetails {
    id: number;
    service_id: number;
    user_id: number;
    zone: string;
    gps_actuel?: string;
    is_available_now: boolean;
    is_on_duty?: boolean;
    type_vehicule?: string;
    marque_modele?: string;
    immatriculation?: string;
    couleur?: string;
    telephone?: string;
    whatsapp?: string;
    email?: string;
    tarif_base?: number;
    tarif_par_km?: number;
    devise?: string;
    climatisation?: boolean;
    wifi?: boolean;
    paiement_carte?: boolean;
    paiement_mobile_money?: boolean;
    nom_chauffeur?: string;
    driver?: {
        nom_complet?: string;
        avatar_url?: string;
        rating?: number;
        reviews_count?: number;
        is_verified?: boolean;
    };
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
        user_id: number;
    };
}

const TaxiDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as { taxiId: number };

    const [taxi, setTaxi] = useState<TaxiDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [booking, setBooking] = useState(false);
    const [selectedInsurance, setSelectedInsurance] = useState<'basic' | 'premium' | 'full' | null>(null);
    const [showInsuranceSelector, setShowInsuranceSelector] = useState(false);
    const [reservationId, setReservationId] = useState<number | null>(null);
    const [bookingSuccess, setBookingSuccess] = useState(false);

    useEffect(() => { loadTaxiDetails(); }, []);

    const loadTaxiDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/taxis/${params.taxiId}/details-enhanced`)
                .catch(() => apiGet(`/api/taxis/${params.taxiId}`));
            const r = response.data as any;
            if (response.success && r) setTaxi(r);
            else { Alert.alert(t('message.error'), t('taxiDetailsScreen.impossibleDeChargerLesDetailsDu')); navigation.goBack(); }
        } catch (error: any) { Alert.alert(t('message.error'), error.message || t('taxiDetailsScreen.impossibleDeChargerLesDetailsDu')); navigation.goBack(); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadTaxiDetails(); setRefreshing(false); }, []);

    const handleCall = () => { if (taxi?.telephone) Linking.openURL(`tel:${taxi.telephone}`); };
    const handleWhatsApp = () => {
        const num = taxi?.whatsapp || taxi?.telephone;
        if (num) Linking.openURL(`https://wa.me/${num.replace(/[^0-9+]/g, '')}`);
    };
    const handleEmail = () => { if (taxi?.email) Linking.openURL(`mailto:${taxi.email}`); };
    const handleShare = async () => {
        if (!taxi) return;
        const driverName = taxi.driver?.nom_complet || taxi.nom_chauffeur || taxi.prestataire?.nom_complet || '';
        try {
            await Share.share({
                message: `Taxi ${taxi.zone}${driverName ? ' - ' + driverName : ''}${taxi.type_vehicule ? t('taxiDetailsScreen.nvehicule') + taxi.type_vehicule : ''}${taxi.marque_modele ? ' ' + taxi.marque_modele : ''}${taxi.tarif_base ? '\nTarif base: ' + taxi.tarif_base + ' ' + (taxi.devise || 'XAF') : ''}\nVia Yukpo`,
                title: `Taxi ${taxi.zone}`,
            });
        } catch { }
    };

    const handleBook = async () => {
        if (!user) { Alert.alert(t('taxiBooking.loginRequired'), t('taxiBooking.loginToBook')); navigation.navigate('Login' as never); return; }
        try {
            setBooking(true);
            const response = await apiPost(`/api/taxis/${params.taxiId}/book`, {
                departure_gps: taxi?.gps_actuel || null,
                arrival_gps: null,
                estimated_price: taxi?.tarif_base ? taxi.tarif_base + (5 * (taxi.tarif_par_km || 200)) : null,
                notes: t('taxiDetailsScreen.reservationDepuisApp'),
            });
            const r = response.data as any;
            if (response.success && r?.reservation) {
                const resId = r.reservation.id;
                setReservationId(resId);
                setBookingSuccess(true);
                if (selectedInsurance) {
                    try { await apiPost(`/api/reservations/${resId}/insurance`, { reservation_id: resId, coverage_type: selectedInsurance }); } catch { }
                }
                try { await apiPost(`/api/reservations/${resId}/qr-code`, {}); } catch { }
                try { await PushNotificationService.registerForPushNotifications(); } catch { }
            } else {
                Alert.alert('Erreur', (response as any).error || t('taxiDetails.impossibleDeCreerLaReservation'));
            }
        } catch (error: any) { Alert.alert(t('message.error'), error.message || t('taxiDetailsScreen.erreurDeReservation')); }
        finally { setBooking(false); }
    };

    if (loading) return (<View style={st.center}><ActivityIndicator size="large" color="#F59E0B" /><Text style={st.centerText}>{t('taxiDetails.chargement')}</Text></View>);
    if (!taxi) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#F59E0B" /><Text style={st.centerText}>{t('taxiDetails.taxiNonTrouve')}</Text></View>);

    const isAvailable = taxi.is_available_now;
    const driverName = taxi.driver?.nom_complet || taxi.nom_chauffeur || taxi.prestataire?.nom_complet || '';
    const driverRating = taxi.driver?.rating || 0;

    const equipments = [
        taxi.climatisation && { icon: 'snowflake' as const, label: 'Clim' },
        taxi.wifi && { icon: 'wifi' as const, label: 'WiFi' },
        taxi.paiement_carte && { icon: 'credit-card' as const, label: 'Carte' },
        taxi.paiement_mobile_money && { icon: 'smartphone' as const, label: 'Mobile Money' },
    ].filter(Boolean) as { icon: string; label: string }[];

    return (
        <View style={st.container}>
            {/* Hero Gradient Header */}
            <LinearGradient colors={['#92400E', '#D97706', '#FBBF24']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    <View style={st.heroIconWrap}><SafeIcon name="car" size={28} color="#D97706" /></View>
                    <Text style={st.heroTitle} numberOfLines={1}>Taxi — {taxi.zone}</Text>
                    {driverName ? <Text style={st.heroDriver}>{driverName}</Text> : null}
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: isAvailable ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }]}>
                            <View style={[st.badgeDot, { backgroundColor: isAvailable ? '#fff' : '#FCA5A5' }]} />
                            <Text style={st.badgeText}>{isAvailable ? t('taxiHome.disponible') : t('taxiDetailsScreen.occupe')}</Text>
                        </View>
                        {taxi.driver?.is_verified && (
                            <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                <SafeIcon name="check-circle" size={12} color="#fff" />
                                <Text style={st.badgeText}>{t('taxiDetails.verifie')}</Text>
                            </View>
                        )}
                        {taxi.type_vehicule && (
                            <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                <Text style={st.badgeText}>{taxi.type_vehicule}</Text>
                            </View>
                        )}
                    </View>
                    {driverRating > 0 && (
                        <View style={st.ratingRow}>
                            {[1, 2, 3, 4, 5].map(i => (<SafeIcon key={i} name="star" size={16} color={i <= Math.floor(driverRating) ? '#FCD34D' : 'rgba(255,255,255,0.3)'} />))}
                            <Text style={st.ratingText}>{driverRating.toFixed(1)} ({taxi.driver?.reviews_count || 0} avis)</Text>
                        </View>
                    )}
                </View>
            </LinearGradient>

            <ScrollView style={st.scroll} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#D97706']} />}>

                {/* Quick Actions */}
                <View style={st.quickRow}>
                    {[
                        taxi.telephone && { icon: 'phone', label: t('taxiBooking.call'), color: '#D97706', onPress: handleCall },
                        { icon: 'message-circle', label: 'WhatsApp', color: '#25D366', onPress: handleWhatsApp },
                        taxi.email && { icon: 'mail', label: 'Email', color: '#3B82F6', onPress: handleEmail },
                        { icon: 'share-2', label: t('taxiDetailsScreen.partager'), color: '#8B5CF6', onPress: handleShare },
                    ].filter(Boolean).map((a: any, i) => (
                        <TouchableOpacity key={i} style={st.quickAction} onPress={a.onPress}>
                            <View style={[st.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon} size={20} color={a.color} /></View>
                            <Text style={st.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Vehicle & Pricing Card */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="car" size={18} color="#D97706" /><Text style={st.cardTitle}>{t('taxiDetails.vehiculeTarifs')}</Text></View>
                    {taxi.marque_modele && (
                        <View style={st.infoRow}><SafeIcon name="info" size={16} color="#6B7280" /><Text style={st.infoText}>{taxi.marque_modele}</Text></View>
                    )}
                    {taxi.couleur && (
                        <View style={st.infoRow}><SafeIcon name="palette" size={16} color="#6B7280" /><Text style={st.infoText}>Couleur: {taxi.couleur}</Text></View>
                    )}
                    {taxi.immatriculation && (
                        <View style={st.infoRow}><SafeIcon name="hash" size={16} color="#6B7280" /><Text style={st.infoText}>{taxi.immatriculation}</Text></View>
                    )}
                    {(taxi.tarif_base || taxi.tarif_par_km) && (
                        <View style={st.priceRow}>
                            {taxi.tarif_base != null && (
                                <View style={st.priceCard}>
                                    <Text style={st.priceLabel}>Base</Text>
                                    <Text style={st.priceValue}>{taxi.tarif_base.toLocaleString('fr-FR')}</Text>
                                    <Text style={st.priceCurrency}>{taxi.devise || 'XAF'}</Text>
                                </View>
                            )}
                            {taxi.tarif_par_km != null && (
                                <View style={st.priceCard}>
                                    <Text style={st.priceLabel}>Par km</Text>
                                    <Text style={st.priceValue}>{taxi.tarif_par_km.toLocaleString('fr-FR')}</Text>
                                    <Text style={st.priceCurrency}>{taxi.devise || 'XAF'}</Text>
                                </View>
                            )}
                        </View>
                    )}
                    {equipments.length > 0 && (
                        <View style={st.equipRow}>
                            {equipments.map((e, i) => (
                                <View key={i} style={st.equipChip}>
                                    <SafeIcon name={e.icon} size={14} color="#6366F1" />
                                    <Text style={st.equipText}>{e.label}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Booking success */}
                {bookingSuccess && reservationId && (
                    <View style={[st.card, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderWidth: 1 }]}>
                        <View style={{ alignItems: 'center', padding: 8 }}>
                            <SafeIcon name="check-circle" size={56} color="#10B981" />
                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#065F46', marginTop: 10 }}>{t('taxiDetails.reservationConfirmee')}</Text>
                            <Text style={{ fontSize: 14, color: '#047857', marginTop: 4, textAlign: 'center' }}>{t('taxiDetails.leChauffeurSeraNotifie')}</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#064E3B', marginTop: 8 }}>N° {reservationId}</Text>
                            <QRCodeDisplay reservationId={reservationId} />
                        </View>
                    </View>
                )}

                {/* Insurance & Book actions */}
                {!bookingSuccess && (
                    <>
                        {/* Insurance */}
                        <View style={st.card}>
                            <View style={st.cardHeader}>
                                <SafeIcon name="shield" size={18} color="#10B981" />
                                <Text style={st.cardTitle}>Assurance passager</Text>
                                <TouchableOpacity onPress={() => setShowInsuranceSelector(!showInsuranceSelector)} style={st.toggleBtn}>
                                    <Text style={st.toggleText}>{selectedInsurance ? 'Modifier' : 'Ajouter'}</Text>
                                </TouchableOpacity>
                            </View>
                            {selectedInsurance && (
                                <View style={st.insuranceRow}>
                                    <SafeIcon name="shield" size={18} color="#10B981" />
                                    <Text style={st.insuranceText}>{t('taxiDetailsScreen.insurance')} {selectedInsurance} sélectionnée</Text>
                                </View>
                            )}
                            {showInsuranceSelector && (
                                <InsuranceSelector
                                    onSelect={(type) => { setSelectedInsurance(type); setShowInsuranceSelector(false); }}
                                    selected={selectedInsurance || undefined}
                                />
                            )}
                        </View>

                        {/* Owner manage button */}
                        {user && taxi.user_id === (user.id as any) && (
                            <TouchableOpacity style={[st.fullBtn, { borderLeftColor: '#6366F1', borderLeftWidth: 3 }]}
                                onPress={() => navigation.navigate('TaxiAvailability' as never, { taxiId: taxi.id } as never)}>
                                <SafeIcon name="settings" size={18} color="#6366F1" />
                                <Text style={[st.fullBtnText, { color: '#4338CA' }]}>{t('taxiDetails.gererLaDisponibilite')}</Text>
                                <SafeIcon name="chevron-right" size={18} color="#A5B4FC" />
                            </TouchableOpacity>
                        )}

                        {/* Book button */}
                        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                            <TouchableOpacity
                                style={[st.bookBtn, (!isAvailable || !taxi.is_on_duty) && { opacity: 0.5 }]}
                                onPress={() => navigation.navigate('TaxiBooking' as never, { taxiId: taxi.id, departureGPS: taxi.gps_actuel || undefined } as never)}
                                disabled={!isAvailable || !taxi.is_on_duty || booking}
                            >
                                {booking ? <ActivityIndicator color="#fff" /> : <SafeIcon name="calendar" size={20} color="#fff" />}
                                <Text style={st.bookBtnText}>{t('taxiDetails.reserverMaintenant')}</Text>
                            </TouchableOpacity>
                        </View>

                        {taxi.telephone && (
                            <TouchableOpacity style={[st.fullBtn, { marginHorizontal: 16 }]} onPress={handleCall}>
                                <SafeIcon name="phone" size={18} color="#D97706" />
                                <Text style={st.fullBtnText}>Appeler directement</Text>
                                <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {bookingSuccess && (
                    <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                        <TouchableOpacity style={st.bookBtn} onPress={() => navigation.navigate('MesReservations' as never)}>
                            <SafeIcon name="list" size={20} color="#fff" />
                            <Text style={st.bookBtnText}>{t('taxiDetails.voirMesReservations')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFBEB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFBEB' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
    heroDriver: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeDot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
    ratingText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginLeft: 4 },
    // Scroll
    scroll: { flex: 1 },
    // Quick actions
    quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
    quickAction: { alignItems: 'center', width: 64 },
    quickIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    quickLabel: { fontSize: 11, color: '#374151', textAlign: 'center', fontWeight: '500' },
    // Card
    card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
    // Info rows
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    infoText: { fontSize: 14, color: '#374151' },
    // Pricing
    priceRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 4 },
    priceCard: { flex: 1, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A' },
    priceLabel: { fontSize: 11, color: '#92400E', fontWeight: '600' },
    priceValue: { fontSize: 20, fontWeight: '800', color: '#D97706', marginTop: 2 },
    priceCurrency: { fontSize: 10, color: '#B45309' },
    // Equipment chips
    equipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    equipChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
    equipText: { fontSize: 12, color: '#4338CA', fontWeight: '500' },
    // Insurance
    toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F0FDF4' },
    toggleText: { fontSize: 12, color: '#10B981', fontWeight: '600' },
    insuranceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    insuranceText: { fontSize: 13, color: '#065F46', fontWeight: '500' },
    // Full width buttons
    fullBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    fullBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
    // Book button
    bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#D97706', padding: 16, borderRadius: 14, shadowColor: '#D97706', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    bookBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default TaxiDetailsScreen;

