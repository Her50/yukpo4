// ✅ NOUVEAU: Écran de réservation hôtel/meublé côté UTILISATEUR
// Permet à un client de demander une réservation de séjour (dates, chambres, invités)

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { immobilierService } from '../../services/immobilierService';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

type RouteParams = {
    propertyId: number;
    propertyName?: string;
    typeBien?: string;
    prixNuitee?: number;
    ville?: string;
};

const HotelBookingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const params = (route.params || {}) as RouteParams;
    const propertyId = params.propertyId;
    const propertyName = params.propertyName || 'Hébergement';
    const typeBien = params.typeBien || 'hotel';
    const prixNuitee = params.prixNuitee || 0;
    const ville = params.ville || '';

    const devise = getCurrencyIntelligently() || 'FCFA';

    const [dateArrivee, setDateArrivee] = useState('');
    const [dateDepart, setDateDepart] = useState('');
    const [nombreAdultes, setNombreAdultes] = useState('1');
    const [nombreEnfants, setNombreEnfants] = useState('0');
    const [nombreChambres, setNombreChambres] = useState('1');
    const [nomClient, setNomClient] = useState(user?.name || '');
    const [telephoneClient, setTelephoneClient] = useState(user?.phone || '');
    const [emailClient, setEmailClient] = useState(user?.email || '');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const nbNuits = (() => {
        try {
            if (!dateArrivee || !dateDepart) return 0;
            const diff = new Date(dateDepart).getTime() - new Date(dateArrivee).getTime();
            return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        } catch { return 0; }
    })();

    const nbChambresNum = parseInt(nombreChambres) || 1;
    const prixTotal = prixNuitee * nbNuits * nbChambresNum;

    const formatPrice = (price: number) => {
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M ${devise}`;
        if (price >= 1000) return `${(price / 1000).toFixed(0)}K ${devise}`;
        return `${price.toLocaleString()} ${devise}`;
    };

    const handleSubmit = async () => {
        if (!dateArrivee.trim() || !dateDepart.trim()) {
            Alert.alert(t('message.error'), t('hotelBooking.enterDates'));
            return;
        }
        if (!nomClient.trim() || !telephoneClient.trim()) {
            Alert.alert(t('message.error'), t('hotelBooking.nameAndPhoneRequired'));
            return;
        }

        const arrDate = new Date(dateArrivee);
        const depDate = new Date(dateDepart);
        if (isNaN(arrDate.getTime()) || isNaN(depDate.getTime())) {
            Alert.alert(t('message.error'), t('hotelBooking.invalidDateFormat'));
            return;
        }
        if (depDate <= arrDate) {
            Alert.alert(t('message.error'), t('hotelBooking.departureMustBeAfterArrival'));
            return;
        }

        try {
            setLoading(true);
            const response = await immobilierService.bookHotelStay({
                property_id: propertyId,
                date_arrivee: dateArrivee.trim(),
                date_depart: dateDepart.trim(),
                nombre_adultes: parseInt(nombreAdultes) || 1,
                nombre_enfants: parseInt(nombreEnfants) || 0,
                nombre_chambres: nbChambresNum,
                nom_client: nomClient.trim(),
                telephone_client: telephoneClient.trim(),
                email_client: emailClient.trim() || undefined,
                prix_nuitee: prixNuitee || undefined,
                prix_total: prixTotal || undefined,
                notes: notes.trim() || undefined,
            });

            const resData = (response?.data || response) as any;
            if (resData?.success) {
                const reservationId = resData?.data?.id || resData?.data?.reservation_id;
                Alert.alert(
                    t('hotelBooking.reservationSent'),
                    t('hotelBooking.reservationSentMsg', { name: propertyName }),
                    [
                        ...(reservationId && prixTotal > 0 ? [{
                            text: 'Payer maintenant',
                            onPress: () => (navigation as any).navigate('HotelBookingPayment', {
                                reservationId,
                                montantTotal: prixTotal,
                                propertyName,
                            }),
                        }] : []),
                        {
                            text: 'OK',
                            style: 'cancel' as const,
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert(t('message.error'), resData?.message || t('hotelBooking.cannotCreateReservation'));
            }
        } catch (error: any) {
            console.error('[HotelBookingScreen] Erreur:', error);
            Alert.alert(t('message.error'), error.message || t('hotelBooking.errorOccurred'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={s.container}>
            <LinearGradient colors={['#312E81', '#4F46E5']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>Réserver un séjour</Text>
                        <Text style={s.headerSub} numberOfLines={1}>{propertyName}</Text>
                    </View>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Info badge */}
                    <View style={s.infoBadge}>
                        <SafeIcon name="info" size={16} color="#4F46E5" />
                        <Text style={s.infoBadgeText}>
                            {typeBien === 'meuble' ? 'Location meublée' : 'Hôtel'} · {ville || 'Cameroun'}
                            {prixNuitee > 0 ? ` · ${formatPrice(prixNuitee)}/nuit` : ''}
                        </Text>
                    </View>

                    {/* Dates */}
                    <Text style={s.sectionTitle}>Dates du séjour</Text>
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.label}>Arrivée *</Text>
                            <TextInput
                                style={s.input}
                                value={dateArrivee}
                                onChangeText={setDateArrivee}
                                placeholder="AAAA-MM-JJ"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={s.label}>Départ *</Text>
                            <TextInput
                                style={s.input}
                                value={dateDepart}
                                onChangeText={setDateDepart}
                                placeholder="AAAA-MM-JJ"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                    </View>
                    {nbNuits > 0 && (
                        <Text style={s.hint}>{nbNuits} nuit{nbNuits > 1 ? 's' : ''}</Text>
                    )}

                    {/* Occupants */}
                    <Text style={s.sectionTitle}>Occupants</Text>
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.label}>Adultes</Text>
                            <View style={s.stepper}>
                                <TouchableOpacity style={s.stepBtn}
                                    onPress={() => setNombreAdultes(String(Math.max(1, (parseInt(nombreAdultes) || 1) - 1)))}>
                                    <SafeIcon name="minus" size={16} color="#6366F1" />
                                </TouchableOpacity>
                                <Text style={s.stepValue}>{nombreAdultes}</Text>
                                <TouchableOpacity style={s.stepBtn}
                                    onPress={() => setNombreAdultes(String((parseInt(nombreAdultes) || 1) + 1))}>
                                    <SafeIcon name="plus" size={16} color="#6366F1" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={s.label}>Enfants</Text>
                            <View style={s.stepper}>
                                <TouchableOpacity style={s.stepBtn}
                                    onPress={() => setNombreEnfants(String(Math.max(0, (parseInt(nombreEnfants) || 0) - 1)))}>
                                    <SafeIcon name="minus" size={16} color="#6366F1" />
                                </TouchableOpacity>
                                <Text style={s.stepValue}>{nombreEnfants}</Text>
                                <TouchableOpacity style={s.stepBtn}
                                    onPress={() => setNombreEnfants(String((parseInt(nombreEnfants) || 0) + 1))}>
                                    <SafeIcon name="plus" size={16} color="#6366F1" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={s.label}>Chambres</Text>
                            <View style={s.stepper}>
                                <TouchableOpacity style={s.stepBtn}
                                    onPress={() => setNombreChambres(String(Math.max(1, (parseInt(nombreChambres) || 1) - 1)))}>
                                    <SafeIcon name="minus" size={16} color="#6366F1" />
                                </TouchableOpacity>
                                <Text style={s.stepValue}>{nombreChambres}</Text>
                                <TouchableOpacity style={s.stepBtn}
                                    onPress={() => setNombreChambres(String((parseInt(nombreChambres) || 1) + 1))}>
                                    <SafeIcon name="plus" size={16} color="#6366F1" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Contact */}
                    <Text style={s.sectionTitle}>Vos coordonnées</Text>
                    <Text style={s.label}>Nom complet *</Text>
                    <TextInput style={s.input} value={nomClient} onChangeText={setNomClient}
                        placeholder="Votre nom" placeholderTextColor="#9CA3AF" />

                    <Text style={s.label}>Téléphone *</Text>
                    <TextInput style={s.input} value={telephoneClient} onChangeText={setTelephoneClient}
                        placeholder="+237 6XX XXX XXX" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />

                    <Text style={s.label}>Email</Text>
                    <TextInput style={s.input} value={emailClient} onChangeText={setEmailClient}
                        placeholder="votre@email.com" placeholderTextColor="#9CA3AF" keyboardType="email-address" />

                    <Text style={s.label}>Notes / demandes spéciales</Text>
                    <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                        value={notes} onChangeText={setNotes}
                        placeholder="Ex: chambre calme, lit bébé..." placeholderTextColor="#9CA3AF" multiline />

                    {/* Price Summary */}
                    {prixNuitee > 0 && nbNuits > 0 && (
                        <View style={s.priceCard}>
                            <Text style={s.priceTitle}>Estimation du prix</Text>
                            <View style={s.priceRow}>
                                <Text style={s.priceLabel}>{formatPrice(prixNuitee)} × {nbNuits} nuit{nbNuits > 1 ? 's' : ''} × {nbChambresNum} chambre{nbChambresNum > 1 ? 's' : ''}</Text>
                            </View>
                            <View style={[s.priceRow, s.priceTotalRow]}>
                                <Text style={s.priceTotalLabel}>Total estimé</Text>
                                <Text style={s.priceTotalValue}>{formatPrice(prixTotal)}</Text>
                            </View>
                            <Text style={s.priceNote}>Le prix final sera confirmé par le gérant</Text>
                        </View>
                    )}

                    {/* Submit */}
                    <NativeButton
                        title={loading ? 'Envoi en cours...' : 'Envoyer la demande de réservation'}
                        onPress={handleSubmit}
                        disabled={loading}
                        variant="primary"
                        size="large"
                        style={s.submitBtn}
                    />

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 20, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
    scrollContent: { padding: 16 },
    infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', padding: 12, borderRadius: 10, marginBottom: 16 },
    infoBadgeText: { fontSize: 13, color: '#4F46E5', fontWeight: '500', flex: 1 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 10 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
    hint: { fontSize: 12, color: '#6366F1', fontWeight: '500', marginTop: 4 },
    row: { flexDirection: 'row' },
    stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 4 },
    stepBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    stepValue: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111827' },
    priceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    priceTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    priceLabel: { fontSize: 13, color: '#6B7280' },
    priceTotalRow: { borderTopWidth: 2, borderTopColor: '#E5E7EB', marginTop: 8, paddingTop: 10 },
    priceTotalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
    priceTotalValue: { fontSize: 18, fontWeight: '800', color: '#6366F1' },
    priceNote: { fontSize: 11, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' },
    submitBtn: { marginTop: 24, backgroundColor: '#6366F1' },
});

export default HotelBookingScreen;
