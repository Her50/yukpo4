// ✅ REFONTE 2026-03-07: CovoiturageDetailsScreen → UX moderne
// Hero gradient vert, route visuelle, profil conducteur, réservation, chat, partage, pull-to-refresh
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ChatModalMobile from '../../components/ChatModalMobile';
import CovoiturageDriverProfile from '../../components/covoiturage/CovoiturageDriverProfile';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';

interface CovoiturageDetails {
    id: number;
    service_id: number;
    user_id: number;
    depart: string;
    destination: string;
    gps_depart?: string;
    gps_destination?: string;
    date_depart: string;
    heure_depart?: string;
    nombre_places: number;
    places_disponibles: number;
    prix_par_place: number;
    devise: string;
    statut: string;
    type_vehicule?: string;
    marque_modele?: string;
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
        user_id: number;
    };
}

const CovoiturageDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as { covoiturageId: number };

    const [covoiturage, setCovoiturage] = useState<CovoiturageDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [booking, setBooking] = useState(false);
    const [numberOfPlaces, setNumberOfPlaces] = useState(1);
    const [passengerNames, setPassengerNames] = useState('');
    const [notes, setNotes] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [driverReviews, setDriverReviews] = useState<any[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);

    useEffect(() => { loadCovoiturageDetails(); }, []);
    useEffect(() => { if (covoiturage?.prestataire?.user_id) loadDriverReviews(); }, [covoiturage?.prestataire?.user_id]);

    const loadCovoiturageDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/covoiturages/${params.covoiturageId}`);
            if (response.success && response.data) setCovoiturage(response.data as CovoiturageDetails);
            else { Alert.alert('Erreur', 'Impossible de charger les détails'); navigation.goBack(); }
        } catch (error: any) { Alert.alert('Erreur', error.message || 'Erreur de chargement'); navigation.goBack(); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadCovoiturageDetails(); setRefreshing(false); }, []);

    const loadDriverReviews = async () => {
        if (!covoiturage?.prestataire?.user_id) return;
        try { setLoadingReviews(true); const r = await apiGet(`/api/covoiturages/${params.covoiturageId}/reviews`); if (r.success && r.data) setDriverReviews((r.data as any).reviews || []); } catch { } finally { setLoadingReviews(false); }
    };

    const handleShare = async () => {
        if (!covoiturage) return;
        const dateStr = new Date(covoiturage.date_depart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        try {
            await Share.share({
                message: `Covoiturage ${covoiturage.depart} → ${covoiturage.destination}\nLe ${dateStr}${covoiturage.heure_depart ? ' à ' + covoiturage.heure_depart.substring(0, 5) : ''}\n${covoiturage.prix_par_place.toLocaleString('fr-FR')} ${covoiturage.devise}/place - ${covoiturage.places_disponibles} place(s) dispo\nVia Yukpo`,
                title: `Covoiturage ${covoiturage.depart} → ${covoiturage.destination}`,
            });
        } catch { }
    };

    if (loading) return (<View style={st.center}><ActivityIndicator size="large" color="#059669" /><Text style={st.centerText}>Chargement...</Text></View>);
    if (!covoiturage) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#059669" /><Text style={st.centerText}>Trajet non trouvé</Text></View>);

    const totalPrice = numberOfPlaces * covoiturage.prix_par_place;
    const isOpen = covoiturage.statut === 'ouvert';
    const hasPlaces = covoiturage.places_disponibles > 0;
    const dateDisplay = new Date(covoiturage.date_depart).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <View style={st.container}>
            {/* Hero Gradient Header */}
            <LinearGradient colors={['#064E3B', '#059669', '#34D399']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    {/* Route visualization */}
                    <View style={st.routeViz}>
                        <View style={st.routeEndpoint}>
                            <View style={[st.routeDot, { backgroundColor: '#fff' }]} />
                            <Text style={st.routeCity} numberOfLines={1}>{covoiturage.depart}</Text>
                        </View>
                        <View style={st.routeConnector}>
                            <View style={st.routeDash} />
                            <SafeIcon name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
                            <View style={st.routeDash} />
                        </View>
                        <View style={st.routeEndpoint}>
                            <View style={[st.routeDot, { backgroundColor: '#FCD34D' }]} />
                            <Text style={st.routeCity} numberOfLines={1}>{covoiturage.destination}</Text>
                        </View>
                    </View>
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: isOpen ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }]}>
                            <View style={[st.badgeDot, { backgroundColor: isOpen ? '#fff' : '#FCA5A5' }]} />
                            <Text style={st.badgeText}>{isOpen ? 'Ouvert' : covoiturage.statut}</Text>
                        </View>
                        <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                            <SafeIcon name="users" size={12} color="#fff" />
                            <Text style={st.badgeText}>{covoiturage.places_disponibles}/{covoiturage.nombre_places} places</Text>
                        </View>
                    </View>
                    <Text style={st.heroPrice}>{covoiturage.prix_par_place.toLocaleString('fr-FR')} {covoiturage.devise} / place</Text>
                </View>
            </LinearGradient>

            <ScrollView style={st.scroll} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#059669']} />}>

                {/* Trip Info Card */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="info" size={18} color="#059669" /><Text style={st.cardTitle}>Détails du trajet</Text></View>
                    <View style={st.infoRow}><SafeIcon name="calendar" size={16} color="#6B7280" /><Text style={st.infoText}>{dateDisplay}</Text></View>
                    {covoiturage.heure_depart && (<View style={st.infoRow}><SafeIcon name="clock" size={16} color="#6B7280" /><Text style={st.infoText}>Départ à {covoiturage.heure_depart.substring(0, 5)}</Text></View>)}
                    {covoiturage.type_vehicule && (<View style={st.infoRow}><SafeIcon name="car" size={16} color="#6B7280" /><Text style={st.infoText}>{covoiturage.type_vehicule}{covoiturage.marque_modele ? ' — ' + covoiturage.marque_modele : ''}</Text></View>)}
                </View>

                {/* Quick Actions */}
                <View style={st.quickRow}>
                    {[
                        { icon: 'message-square', label: 'Chat', color: '#8B5CF6', onPress: () => { if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); navigation.navigate('Login' as never); return; } setShowChat(true); } },
                        { icon: 'share-2', label: 'Partager', color: '#3B82F6', onPress: handleShare },
                    ].map((a, i) => (
                        <TouchableOpacity key={i} style={st.quickAction} onPress={a.onPress}>
                            <View style={[st.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon} size={20} color={a.color} /></View>
                            <Text style={st.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Driver Profile */}
                {covoiturage.prestataire && (
                    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                        <CovoiturageDriverProfile
                            driver={{
                                user_id: covoiturage.prestataire.user_id,
                                nom_complet: covoiturage.prestataire.nom_complet,
                                avatar_url: covoiturage.prestataire.avatar_url,
                                note_moyenne: (covoiturage.prestataire as any).note_moyenne,
                                nombre_trajets: (covoiturage.prestataire as any).nombre_trajets,
                                nombre_avis: (covoiturage.prestataire as any).nombre_avis,
                                date_inscription: (covoiturage.prestataire as any).date_inscription,
                                is_verified: (covoiturage.prestataire as any).is_verified,
                                badges: (covoiturage.prestataire as any).badges,
                            }}
                            reviews={driverReviews}
                            onContactPress={() => setShowChat(true)}
                            onViewAllReviews={() => Alert.alert('Avis', 'Page tous les avis à venir')}
                        />
                    </View>
                )}

                {/* Booking Card */}
                {isOpen && hasPlaces && (
                    <View style={[st.card, { borderColor: '#A7F3D0', borderWidth: 1 }]}>
                        <View style={st.cardHeader}><SafeIcon name="calendar" size={18} color="#059669" /><Text style={st.cardTitle}>Réserver une place</Text></View>

                        <View style={{ marginBottom: 14 }}>
                            <Text style={st.label}>Nombre de places</Text>
                            <View style={st.placesSelector}>
                                <TouchableOpacity style={st.selectorBtn} onPress={() => setNumberOfPlaces(Math.max(1, numberOfPlaces - 1))} disabled={numberOfPlaces <= 1}>
                                    <SafeIcon name="minus" size={16} color="#059669" />
                                </TouchableOpacity>
                                <Text style={st.placesValue}>{numberOfPlaces}</Text>
                                <TouchableOpacity style={st.selectorBtn} onPress={() => setNumberOfPlaces(Math.min(covoiturage.places_disponibles, numberOfPlaces + 1))} disabled={numberOfPlaces >= covoiturage.places_disponibles}>
                                    <SafeIcon name="plus" size={16} color="#059669" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ marginBottom: 14 }}>
                            <Text style={st.label}>Noms des passagers (optionnel)</Text>
                            <TextInput style={st.textInput} value={passengerNames} onChangeText={setPassengerNames} placeholder="Ex: Jean Dupont, Marie Martin" placeholderTextColor="#9CA3AF" multiline />
                        </View>

                        <View style={{ marginBottom: 14 }}>
                            <Text style={st.label}>Notes (optionnel)</Text>
                            <TextInput style={st.textInput} value={notes} onChangeText={setNotes} placeholder="Informations complémentaires..." placeholderTextColor="#9CA3AF" multiline />
                        </View>

                        <View style={st.totalRow}>
                            <Text style={st.totalLabel}>Total:</Text>
                            <Text style={st.totalPrice}>{totalPrice.toLocaleString('fr-FR')} {covoiturage.devise}</Text>
                        </View>

                        {covoiturage.user_id === (user?.id as any) ? (
                            <TouchableOpacity style={[st.bookBtn, { backgroundColor: '#6366F1' }]} onPress={() => navigation.navigate('MyTrips' as never)}>
                                <SafeIcon name="settings" size={20} color="#fff" />
                                <Text style={st.bookBtnText}>Gérer mon trajet</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[st.bookBtn, (booking || numberOfPlaces > covoiturage.places_disponibles) && { opacity: 0.5 }]}
                                onPress={() => navigation.navigate('CovoiturageBooking' as never, { covoiturageId: params.covoiturageId, numberOfPlaces, passengerNames, notes } as never)}
                                disabled={booking || numberOfPlaces > covoiturage.places_disponibles}
                            >
                                {booking ? <ActivityIndicator color="#fff" /> : <SafeIcon name="check" size={20} color="#fff" />}
                                <Text style={st.bookBtnText}>Réserver {numberOfPlaces} place{numberOfPlaces > 1 ? 's' : ''}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Chat modal */}
            {covoiturage.prestataire && user && (
                <ChatModalMobile visible={showChat} onClose={() => setShowChat(false)}
                    service={{ id: covoiturage.service_id, titre_service: `Covoiturage ${covoiturage.depart} → ${covoiturage.destination}`, user_id: covoiturage.user_id }}
                    prestataireInfo={covoiturage.prestataire} user={user} />
            )}
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0FDF4' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF4' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroPrice: { fontSize: 18, fontWeight: '700', color: '#FCD34D', marginTop: 12 },
    // Route visualization
    routeViz: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, width: '100%' },
    routeEndpoint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    routeDot: { width: 10, height: 10, borderRadius: 5 },
    routeCity: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
    routeConnector: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    routeDash: { width: 12, height: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
    // Badges
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeDot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    // Scroll
    scroll: { flex: 1 },
    // Quick actions
    quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 14 },
    quickAction: { alignItems: 'center', width: 64 },
    quickIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    quickLabel: { fontSize: 11, color: '#374151', textAlign: 'center', fontWeight: '500' },
    // Card
    card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
    // Info
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    infoText: { fontSize: 14, color: '#374151', flex: 1 },
    // Booking form
    label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
    placesSelector: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    selectorBtn: { padding: 12, backgroundColor: '#F0FDF4', borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' },
    placesValue: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#111827' },
    textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', minHeight: 60, textAlignVertical: 'top', backgroundColor: '#F9FAFB' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', marginBottom: 14 },
    totalLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
    totalPrice: { fontSize: 22, fontWeight: '800', color: '#059669' },
    // Book button
    bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#059669', padding: 16, borderRadius: 14, shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    bookBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default CovoiturageDetailsScreen;

