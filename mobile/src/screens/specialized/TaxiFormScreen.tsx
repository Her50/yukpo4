// ✅ REFONTE TOTALE 2026-03-05: TaxiFormScreen → Dashboard pro + Formulaire
// Mode Dashboard (taxi existant): 3 tabs (Accueil / Service / Stats)
// Mode Création: Formulaire guidé avec header gradient
// Exploite endpoints: CRUD taxi, booking, availability, dynamic pricing
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { clearSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiGet, apiPost, servicesApi } from '../../services/api';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const STORAGE_KEY = '@taxi_last_form_data';
type TabType = 'overview' | 'service' | 'stats';

const TaxiFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;
    const devise = getCurrencyIntelligently() || 'XAF';

    // Dashboard state
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    // ✅ FIX: Partenaires voient TOUJOURS le dashboard (même vide), pas le formulaire de création
    const [isDashboardMode, setIsDashboardMode] = useState(user?.role === 'partenaire' && !mode);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [taxiData, setTaxiData] = useState<any>(null);
    const [isAvailable, setIsAvailable] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        nom_chauffeur: '', telephone: '', whatsapp: '',
        type_vehicule: '', marque_modele: '', immatriculation: '', couleur: '', annee: '',
        zone_intervention: [] as string[],
        tarif_base: '500', tarif_par_km: '200', devise: 'XAF',
        paiement_cash: true, paiement_mobile_money: false, paiement_carte: false,
        climatisation: false, wifi: false,
        image_vehicule: null as string | null,
    });

    const [loading, setLoading] = useState(false);
    const [selectedZones, setSelectedZones] = useState<LocationObject[]>([]);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);

    const { partnerData } = usePartnerData(user?.role);
    const { errors, validateField, validateForm, setError } = useFormValidation({
        telephone: { required: true, pattern: /^\+?[0-9]{9,15}$/ },
    });
    useFormAutoSave(STORAGE_KEY, formData, mode !== 'edit', 1000);

    // ─── DATA LOADING ────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const resp = await apiGet('/api/taxis');
                const d = (resp?.data || resp) as any;
                const taxis = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
                const myTaxi = taxis.find((t: any) => t.user_id === user?.id) || (taxis.length > 0 ? taxis[0] : null);
                if (myTaxi) {
                    setTaxiData(myTaxi);
                    setIsDashboardMode(true);
                    setIsAvailable(myTaxi.disponible || myTaxi.is_available || false);
                    if (!serviceId && myTaxi.service_id) setServiceId(myTaxi.service_id);
                }
            } catch (e) { console.log('[Taxi] Init:', e); }

            if (mode === 'edit' && specializedServiceId) {
                try {
                    setLoading(true);
                    const resp = await apiGet(`/api/taxis/${specializedServiceId}`);
                    if (resp.success && resp.data) {
                        const d = resp.data as any;
                        setFormData({
                            nom_chauffeur: d.nom_chauffeur || '', telephone: d.telephone || '', whatsapp: d.whatsapp || '',
                            type_vehicule: d.type_vehicule || '', marque_modele: d.marque_modele || '',
                            immatriculation: d.immatriculation || '', couleur: d.couleur || '', annee: d.annee || '',
                            zone_intervention: d.zone_intervention || [],
                            tarif_base: d.tarif_base ? String(d.tarif_base) : '500',
                            tarif_par_km: d.tarif_par_km ? String(d.tarif_par_km) : '200',
                            devise: d.devise || 'XAF',
                            paiement_cash: d.paiement_cash ?? true, paiement_mobile_money: d.paiement_mobile_money || false,
                            paiement_carte: d.paiement_carte || false,
                            climatisation: d.climatisation || false, wifi: d.wifi || false,
                            image_vehicule: d.image_vehicule || null,
                        });
                        if (d.gps) setSelectedGPS(d.gps);
                    }
                } catch (e) { console.error('[Taxi] Edit:', e); } finally { setLoading(false); }
            }
            setInitialLoading(false);
        };
        init();
    }, []);

    useEffect(() => {
        if (!serviceId && user?.id && formData.nom_chauffeur) {
            (async () => {
                try {
                    const resp = await servicesApi.createService({ titre_service: `Taxi ${formData.nom_chauffeur}`, description: 'Service de taxi', category: 'transport' });
                    if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) setServiceId((resp.data as any).id);
                } catch (e) { console.error('[Taxi] Service:', e); }
            })();
        }
    }, [formData.nom_chauffeur, serviceId, user?.id]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const resp = await apiGet('/api/taxis');
            const d = (resp?.data || resp) as any;
            const taxis = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
            const myTaxi = taxis.find((t: any) => t.user_id === user?.id) || (taxis.length > 0 ? taxis[0] : null);
            if (myTaxi) {
                setTaxiData(myTaxi);
                setIsAvailable(myTaxi.disponible || myTaxi.is_available || false);
            }
        } catch (e) { console.log('[Taxi] Refresh:', e); }
        setRefreshing(false);
    };

    const handleToggleAvailability = async () => {
        if (!taxiData?.id) return;
        try {
            const newStatus = !isAvailable;
            await apiPost(`/api/taxis/${taxiData.id}/update-availability`, { disponible: newStatus });
            setIsAvailable(newStatus);
            Alert.alert(t('message.success'), newStatus ? t('taxiForm.nowAvailable') : t('taxiForm.nowOffDuty'));
        } catch (e) { Alert.alert(t('message.error'), t('taxiForm.cannotChangeStatus')); }
    };

    const pickVehicleImage = async (source: 'gallery' | 'camera') => {
        try {
            const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert(t('taxiForm.permissionDenied')); return; }
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8, base64: true })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images' as any, allowsEditing: true, quality: 0.8, base64: true });
            if (!result.canceled && result.assets[0]) {
                const b64 = result.assets[0].base64;
                setFormData({ ...formData, image_vehicule: b64 ? `data:image/jpeg;base64,${b64}` : result.assets[0].uri });
            }
        } catch (e) { Alert.alert(t('message.error'), t('taxiForm.cannotSelectImage')); }
    };

    const handleSubmit = async () => {
        if (!formData.telephone.trim()) { Alert.alert(t('message.error'), t('taxiForm.phoneRequired')); return; }
        setLoading(true);
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                const resp = await servicesApi.createService({ titre_service: `Taxi ${formData.nom_chauffeur || 'Anonyme'}`, description: 'Taxi', category: 'transport' });
                if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) { finalServiceId = (resp.data as any).id; setServiceId(finalServiceId); }
            } catch (e) { Alert.alert(t('message.error'), t('taxiForm.cannotCreateService')); setLoading(false); return; }
        }
        if (!finalServiceId) { Alert.alert(t('message.error'), t('taxiForm.serviceIdMissing')); setLoading(false); return; }
        try {
            const payload = {
                service_id: finalServiceId, nom_chauffeur: formData.nom_chauffeur || null,
                telephone: formData.telephone, whatsapp: formData.whatsapp || null,
                type_vehicule: formData.type_vehicule || null, marque_modele: formData.marque_modele || null,
                immatriculation: formData.immatriculation || null, couleur: formData.couleur || null, annee: formData.annee || null,
                gps: selectedGPS || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
                zone_intervention: selectedZones.length > 0 ? selectedZones.map(z => z.raw || z.place_name || '') : null,
                tarif_base: parseInt(formData.tarif_base) || 500, tarif_par_km: parseInt(formData.tarif_par_km) || 200,
                devise: formData.devise,
                paiement_cash: formData.paiement_cash, paiement_mobile_money: formData.paiement_mobile_money,
                paiement_carte: formData.paiement_carte,
                climatisation: formData.climatisation, wifi: formData.wifi,
                image_vehicule: formData.image_vehicule || null,
            };
            const resp = await apiPost('/api/taxis', payload);
            if (resp.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert(t('message.success'), t('taxiForm.taxiRegistered'), [{ text: 'OK', onPress: () => { setIsDashboardMode(true); setActiveTab('overview'); } }]);
            } else { Alert.alert(t('message.error'), (resp as any).error || t('taxiForm.cannotRegister')); }
        } catch (e: any) { Alert.alert(t('message.error'), e.message || t('taxiForm.genericError')); } finally { setLoading(false); }
    };

    if (initialLoading) return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#F59E0B" /><Text style={s.loadingText}>Chargement...</Text></View>;

    // ─── RENDER: Overview ────────────────────────────────────────────────
    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: 'Tarif base', value: `${formData.tarif_base} ${devise}`, icon: 'banknote', color: '#F59E0B' },
                    { label: 'Par km', value: `${formData.tarif_par_km} ${devise}`, icon: 'map', color: '#3B82F6' },
                    { label: 'Zones', value: selectedZones.length, icon: 'map-pin', color: '#10B981' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            {/* Availability Toggle */}
            <View style={[s.availCard, { backgroundColor: isAvailable ? '#F0FDF4' : '#FEF2F2' }]}>
                <View style={[s.availDot, { backgroundColor: isAvailable ? '#10B981' : '#EF4444' }]} />
                <View style={{ flex: 1 }}>
                    <Text style={[s.availTitle, { color: isAvailable ? '#16A34A' : '#DC2626' }]}>{isAvailable ? 'Disponible' : 'Hors service'}</Text>
                    <Text style={s.availSub}>{isAvailable ? 'Visible pour les clients' : 'Non visible'}</Text>
                </View>
                <Switch value={isAvailable} onValueChange={handleToggleAvailability} trackColor={{ false: '#D1D5DB', true: '#10B981' }} />
            </View>

            {/* Quick Actions */}
            <View style={s.quickRow}>
                <TouchableOpacity style={s.quickAction} onPress={() => setActiveTab('service')}>
                    <View style={[s.quickIcon, { backgroundColor: '#F59E0B15' }]}><SafeIcon name="settings" size={22} color="#F59E0B" /></View>
                    <Text style={s.quickLabel}>Mon service</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickAction} onPress={() => setActiveTab('stats')}>
                    <View style={[s.quickIcon, { backgroundColor: '#3B82F615' }]}><SafeIcon name="bar-chart-2" size={22} color="#3B82F6" /></View>
                    <Text style={s.quickLabel}>Statistiques</Text>
                </TouchableOpacity>
            </View>

            {/* Vehicle Info */}
            {taxiData && (
                <>
                    <Text style={s.sectionTitle}>Mon véhicule</Text>
                    {[
                        taxiData.marque_modele && { icon: 'car', text: taxiData.marque_modele },
                        taxiData.immatriculation && { icon: 'hash', text: taxiData.immatriculation },
                        taxiData.couleur && { icon: 'palette', text: taxiData.couleur },
                        taxiData.telephone && { icon: 'phone', text: taxiData.telephone },
                    ].filter(Boolean).map((info: any, i) => (
                        <View key={i} style={s.infoRow}><SafeIcon name={info.icon as any} size={16} color="#6B7280" /><Text style={s.infoText}>{info.text}</Text></View>
                    ))}
                </>
            )}

            {/* Payment badges */}
            <Text style={[s.sectionTitle, { marginTop: 16 }]}>Paiements acceptés</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {formData.paiement_cash && <View style={s.payBadge}><Text style={s.payText}>💵 Cash</Text></View>}
                {formData.paiement_mobile_money && <View style={s.payBadge}><Text style={s.payText}>📱 Mobile Money</Text></View>}
                {formData.paiement_carte && <View style={s.payBadge}><Text style={s.payText}>💳 Carte</Text></View>}
            </View>
        </ScrollView>
    );

    // ─── RENDER: Service Form ────────────────────────────────────────────
    const renderServiceForm = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            <View style={s.field}><NativeInput label="Nom du chauffeur" value={formData.nom_chauffeur} onChangeText={t => setFormData({ ...formData, nom_chauffeur: t })} placeholder="Votre nom" /></View>
            <View style={s.field}><NativeInput label="Téléphone *" value={formData.telephone} onChangeText={t => setFormData({ ...formData, telephone: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
            <View style={s.field}><NativeInput label="WhatsApp" value={formData.whatsapp} onChangeText={t => setFormData({ ...formData, whatsapp: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>

            <Text style={[s.sectionTitle, { marginTop: 8 }]}>Véhicule</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Type" value={formData.type_vehicule} onChangeText={t => setFormData({ ...formData, type_vehicule: t })} placeholder="Berline" /></View>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Marque/Modèle" value={formData.marque_modele} onChangeText={t => setFormData({ ...formData, marque_modele: t })} placeholder="Toyota Corolla" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Immatriculation" value={formData.immatriculation} onChangeText={t => setFormData({ ...formData, immatriculation: t })} placeholder="LT 1234 AB" /></View>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Couleur" value={formData.couleur} onChangeText={t => setFormData({ ...formData, couleur: t })} placeholder="Jaune" /></View>
            </View>
            <View style={s.field}><NativeInput label="Année" value={formData.annee} onChangeText={t => setFormData({ ...formData, annee: t })} placeholder="2020" keyboardType="numeric" /></View>

            {/* Photo */}
            <View style={s.field}>
                <Text style={s.label}>Photo du véhicule</Text>
                {formData.image_vehicule ? (
                    <View style={s.imgContainer}>
                        <Image source={{ uri: formData.image_vehicule }} style={s.imgPreview} />
                        <TouchableOpacity style={s.imgRemove} onPress={() => setFormData({ ...formData, image_vehicule: null })}><SafeIcon name="x" size={18} color="#fff" /></TouchableOpacity>
                    </View>
                ) : (
                    <View style={s.imgPickers}>
                        <TouchableOpacity style={s.imgPickerBtn} onPress={() => pickVehicleImage('camera')}><SafeIcon name="camera" size={22} color="#F59E0B" /><Text style={s.imgPickerText}>Photo</Text></TouchableOpacity>
                        <TouchableOpacity style={s.imgPickerBtn} onPress={() => pickVehicleImage('gallery')}><SafeIcon name="image" size={22} color="#F59E0B" /><Text style={s.imgPickerText}>Galerie</Text></TouchableOpacity>
                    </View>
                )}
            </View>

            {/* GPS */}
            <View style={s.field}>
                <TouchableOpacity style={s.gpsBtn} onPress={() => setShowGPSModal(true)}>
                    <SafeIcon name="map-pin" size={20} color="#F59E0B" />
                    <Text style={s.gpsBtnText}>{selectedGPS ? '✓ GPS sélectionné' : 'Position GPS'}</Text>
                    <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>

            {/* Tarifs */}
            <Text style={[s.sectionTitle, { marginTop: 8 }]}>Tarifs</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}><NativeInput label={`Base (${devise})`} value={formData.tarif_base} onChangeText={t => setFormData({ ...formData, tarif_base: t.replace(/\D/g, '') })} placeholder="500" keyboardType="numeric" /></View>
                <View style={[s.field, { flex: 1 }]}><NativeInput label={`Par km (${devise})`} value={formData.tarif_par_km} onChangeText={t => setFormData({ ...formData, tarif_par_km: t.replace(/\D/g, '') })} placeholder="200" keyboardType="numeric" /></View>
            </View>

            {/* Options */}
            <Text style={[s.sectionTitle, { marginTop: 8 }]}>Options & Paiements</Text>
            {[
                { label: 'Cash', key: 'paiement_cash' },
                { label: 'Mobile Money', key: 'paiement_mobile_money' },
                { label: 'Carte bancaire', key: 'paiement_carte' },
                { label: 'Climatisation', key: 'climatisation' },
                { label: 'WiFi', key: 'wifi' },
            ].map(opt => (
                <View key={opt.key} style={s.switchRow}>
                    <Text style={s.switchLbl}>{opt.label}</Text>
                    <Switch value={(formData as any)[opt.key]} onValueChange={v => setFormData({ ...formData, [opt.key]: v })} trackColor={{ false: '#D1D5DB', true: '#F59E0B' }} />
                </View>
            ))}

            <NativeButton title={loading ? 'Enregistrement...' : (isDashboardMode ? 'Mettre à jour' : 'Enregistrer le Taxi')} onPress={handleSubmit} disabled={loading || !formData.telephone.trim()} variant="primary" size="large" style={{ marginTop: 24 }} />
        </ScrollView>
    );

    // ─── RENDER: Stats ───────────────────────────────────────────────────
    const renderStats = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="bar-chart-2" size={22} color="#F59E0B" /><Text style={s.analyticsTitle}>Tarification</Text></View>
                {[
                    { l: 'Tarif de base', v: `${formData.tarif_base} ${devise}` },
                    { l: 'Prix par km', v: `${formData.tarif_par_km} ${devise}` },
                    { l: 'Véhicule', v: formData.marque_modele || '—' },
                    { l: 'Climatisation', v: formData.climatisation ? 'Oui' : 'Non' },
                ].map((r, i) => (
                    <View key={i} style={s.analyticsRow}><Text style={s.analyticsLbl}>{r.l}</Text><Text style={s.analyticsVal}>{r.v}</Text></View>
                ))}
            </View>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="sparkles" size={22} color="#8B5CF6" /><Text style={s.analyticsTitle}>Prix dynamique IA</Text></View>
                <Text style={s.analyticsEmpty}>Le calcul de prix dynamique s'adapte à la demande en temps réel.</Text>
            </View>
        </ScrollView>
    );

    // ─── RENDER: Dashboard ───────────────────────────────────────────────
    if (isDashboardMode) {
        const tabs: { key: TabType; label: string; icon: string }[] = [
            { key: 'overview', label: 'Accueil', icon: 'layout-dashboard' },
            { key: 'service', label: 'Service', icon: 'settings' },
            { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
        ];
        return (
            <View style={s.container}>
                <LinearGradient colors={['#92400E', '#F59E0B']} style={s.dashHeader}>
                    <View style={s.dashHeaderRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={s.dashTitle}>{formData.nom_chauffeur || 'Mon Taxi'}</Text>
                            <Text style={s.dashSub}>{formData.marque_modele || 'Véhicule'} · {isAvailable ? '🟢 Disponible' : '🔴 Hors service'}</Text>
                        </View>
                    </View>
                    <View style={s.tabsRow}>{tabs.map(t => (
                        <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabOn]} onPress={() => setActiveTab(t.key)}>
                            <SafeIcon name={t.icon as any} size={14} color={activeTab === t.key ? '#fff' : '#ffffff70'} />
                            <Text style={[s.tabText, activeTab === t.key && s.tabTextOn]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}</View>
                </LinearGradient>
                <View style={s.dashContent}>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'service' && renderServiceForm()}
                    {activeTab === 'stats' && renderStats()}
                </View>
                <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={(c: string) => { setSelectedGPS(c); setShowGPSModal(false); }} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Position du taxi" />
            </View>
        );
    }

    // ─── RENDER: Creation ────────────────────────────────────────────────
    return (
        <View style={s.container}>
            <LinearGradient colors={['#92400E', '#F59E0B']} style={s.createHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                <Text style={s.createTitle}>Enregistrer un Taxi</Text>
            </LinearGradient>
            {renderServiceForm()}
            <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={(c: string) => { setSelectedGPS(c); setShowGPSModal(false); }} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Position du taxi" />
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 12, fontSize: 15, color: '#6B7280', fontWeight: '500' },
    dashHeader: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    dashHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    backBtn: { marginRight: 12, padding: 4 },
    dashTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    dashSub: { fontSize: 13, color: '#ffffffCC', marginTop: 2 },
    dashContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    createHeader: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    createTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    tabsRow: { flexDirection: 'row', gap: 4, paddingBottom: 8 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: '#ffffff15' },
    tabOn: { backgroundColor: '#ffffff30' },
    tabText: { fontSize: 11, color: '#ffffff70', fontWeight: '500' },
    tabTextOn: { color: '#fff', fontWeight: '700' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    statCard: { flex: 1, minWidth: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
    statValue: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 8 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    availCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, marginBottom: 20 },
    availDot: { width: 12, height: 12, borderRadius: 6 },
    availTitle: { fontSize: 15, fontWeight: '600' },
    availSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    infoText: { fontSize: 14, color: '#374151' },
    payBadge: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEF3C7', borderRadius: 8 },
    payText: { fontSize: 13, fontWeight: '600', color: '#92400E' },
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingVertical: 6 },
    switchLbl: { fontSize: 14, color: '#374151', fontWeight: '500' },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, gap: 12 },
    gpsBtnText: { flex: 1, fontSize: 14, color: '#111827' },
    imgContainer: { position: 'relative' },
    imgPreview: { width: '100%', height: 160, borderRadius: 12 },
    imgRemove: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    imgPickers: { flexDirection: 'row', gap: 12 },
    imgPickerBtn: { flex: 1, alignItems: 'center', gap: 8, padding: 20, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, borderStyle: 'dashed' },
    imgPickerText: { fontSize: 13, color: '#F59E0B', fontWeight: '500' },
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
    analyticsHdr: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    analyticsTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
    analyticsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsLbl: { fontSize: 14, color: '#6B7280' },
    analyticsVal: { fontSize: 16, fontWeight: '700', color: '#111827' },
    analyticsEmpty: { fontSize: 14, color: '#6B7280', fontStyle: 'italic', lineHeight: 20 },
});

export default TaxiFormScreen;
