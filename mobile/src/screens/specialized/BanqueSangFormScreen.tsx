// ✅ REFONTE TOTALE 2026-03-05: BanqueSangFormScreen → Dashboard pro + Formulaire
// Mode Dashboard (banque existante): 3 tabs (Accueil / Service / Stocks)
// Mode Création: Formulaire guidé avec header gradient
// Exploite endpoints: CRUD banque-sang, stocks, statistics
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
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

const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const STORAGE_KEY = '@banque_sang_form';
type TabType = 'overview' | 'service' | 'stocks';

const BanqueSangFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    // Dashboard state
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    // ✅ FIX: Partenaires voient TOUJOURS le dashboard (même vide), pas le formulaire de création
    const [isDashboardMode, setIsDashboardMode] = useState(user?.role === 'partenaire' && !mode);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [bankData, setBankData] = useState<any>(null);
    const [statistics, setStatistics] = useState<any>(null);

    // Form state
    const [formData, setFormData] = useState({
        nom: '', adresse: '',
        quartier: null as LocationObject | string | null,
        ville: '', pays: '',
        accepte_dons: true, accepte_demandes: true, urgence_24h: false,
        telephone: '', telephone_urgence: '', whatsapp: '', email: '',
    });
    const [loading, setLoading] = useState(false);
    const [stocks, setStocks] = useState<Record<string, { quantite: string; unite: string }>>({});
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);

    const { partnerData } = usePartnerData(user?.role, 'banquesang');
    const { errors, validateField, validateForm, setError } = useFormValidation({
        nom: { required: true, minLength: 3 },
        telephone: { pattern: /^\+?[0-9]{9,15}$/ },
        email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    });
    useFormAutoSave(STORAGE_KEY, formData, true, 1000);

    // Computed
    const totalStock = Object.values(stocks).reduce((s, v) => s + (parseInt(v.quantite) || 0), 0);
    const groupsWithStock = Object.entries(stocks).filter(([_, v]) => parseInt(v.quantite) > 0).length;

    // ─── DATA LOADING ────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            if (user?.role === 'partenaire') {
                try {
                    const partnerResp = await apiGet('/api/partners/me');
                    if (partnerResp.success && partnerResp.data) {
                        const p = partnerResp.data as any;
                        setFormData(prev => ({
                            ...prev, nom: p.name || prev.nom,
                            adresse: p.address || p.location_address || prev.adresse,
                            telephone: p.contact_phone || prev.telephone, email: p.contact_email || prev.email,
                            quartier: p.city ? { raw: p.city, place_name: p.city } as any : prev.quartier,
                            ville: p.city || prev.ville, pays: p.country || prev.pays,
                        }));
                    }
                    const bankResp = await apiGet('/api/banques-sang');
                    const resData = (bankResp?.data || bankResp) as any;
                    const banks = Array.isArray(resData?.data) ? resData.data : Array.isArray(resData) ? resData : [];
                    if (banks.length > 0) {
                        const myBank = banks[0];
                        setBankData(myBank);
                        setIsDashboardMode(true);
                        if (!serviceId && myBank.service_id) setServiceId(myBank.service_id);
                        const bid = myBank.id;
                        if (bid) { loadStatistics(bid); }
                        // Pre-fill stocks from bank data
                        if (myBank.stocks && typeof myBank.stocks === 'object') {
                            setStocks(myBank.stocks);
                        }
                    }
                } catch (e) { console.log('[BanqueSang] Init:', e); }
            }
            if (mode === 'edit' && specializedServiceId) {
                try {
                    setLoading(true);
                    const resp = await apiGet(`/api/banques-sang/${specializedServiceId}`);
                    if (resp.success && resp.data) {
                        const d = resp.data as any;
                        setFormData({
                            nom: d.nom || '', adresse: d.adresse || '',
                            quartier: d.quartier ? { raw: d.quartier, place_name: d.quartier } as any : null,
                            ville: d.ville || '', pays: d.pays || '',
                            accepte_dons: d.accepte_dons ?? true, accepte_demandes: d.accepte_demandes ?? true,
                            urgence_24h: d.urgence_24h || false,
                            telephone: d.telephone || '', telephone_urgence: d.telephone_urgence || '',
                            whatsapp: d.whatsapp || '', email: d.email || '',
                        });
                        if (d.gps) setSelectedGPS(d.gps);
                        if (d.stocks) setStocks(d.stocks);
                    }
                } catch (e) { console.error('[BanqueSang] Edit:', e); } finally { setLoading(false); }
            }
            setInitialLoading(false);
        };
        init();
    }, [user?.role]);

    useEffect(() => {
        if (!serviceId && user?.id && formData.nom) {
            (async () => {
                try {
                    const resp = await servicesApi.createService({ titre_service: formData.nom || 'Banque de sang', description: 'Centre de collecte de sang', category: 'sante' });
                    if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) setServiceId((resp.data as any).id);
                } catch (e) { console.error('[BanqueSang] Service:', e); }
            })();
        }
    }, [formData.nom, serviceId, user?.id]);

    const loadStatistics = async (bid: number) => {
        try {
            const resp = await apiGet(`/api/banques-sang/${bid}/statistics`);
            if (resp.success) setStatistics(resp.data || resp);
        } catch (e) { console.log('[BanqueSang] Stats:', e); }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        const bid = bankData?.id;
        if (bid) await loadStatistics(bid);
        setRefreshing(false);
    };

    const handleGPSSelect = (c: string) => { setSelectedGPS(c); setShowGPSModal(false); };

    const handleUpdateStocks = async () => {
        if (!bankData?.id) { Alert.alert(t('message.error'), t('banqueSang.bankNotRegistered')); return; }
        setLoading(true);
        try {
            await apiPost(`/api/banques-sang/${bankData.id}/stocks`, { stocks });
            Alert.alert(t('message.success'), t('banqueSang.stocksUpdated'));
        } catch (e: any) { Alert.alert(t('message.error'), e.message || t('banqueSang.stocksUpdateError')); } finally { setLoading(false); }
    };

    const handleSubmit = async () => {
        if (!formData.nom.trim()) { Alert.alert(t('message.error'), t('banqueSang.nameRequired')); return; }
        setLoading(true);
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                const resp = await servicesApi.createService({ titre_service: formData.nom, description: 'Banque de sang', category: 'sante' });
                if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) { finalServiceId = (resp.data as any).id; setServiceId(finalServiceId); }
            } catch (e) { Alert.alert(t('message.error'), t('banqueSang.cannotCreateService')); setLoading(false); return; }
        }
        if (!finalServiceId) { Alert.alert(t('message.error'), t('banqueSang.serviceIdMissing')); setLoading(false); return; }
        try {
            const payload = {
                service_id: finalServiceId, nom: formData.nom, adresse: formData.adresse || null,
                quartier: typeof formData.quartier === 'string' ? formData.quartier : ((formData.quartier as any)?.raw || (formData.quartier as any)?.place_name || null),
                ville: formData.ville || null, pays: formData.pays || null,
                gps: selectedGPS || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
                accepte_dons: formData.accepte_dons, accepte_demandes: formData.accepte_demandes,
                urgence_24h: formData.urgence_24h,
                telephone: formData.telephone || null, telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null, email: formData.email || null,
            };
            const resp = await apiPost('/api/banques-sang', payload);
            if (resp.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert(t('message.success'), t('banqueSang.bankRegistered'), [{ text: 'OK', onPress: () => { setIsDashboardMode(true); setActiveTab('overview'); handleRefresh(); } }]);
            } else { Alert.alert(t('message.error'), (resp as any).error || t('banqueSang.cannotRegister')); }
        } catch (e: any) { Alert.alert(t('message.error'), e.message || t('banqueSang.genericError')); } finally { setLoading(false); }
    };

    if (initialLoading) return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#DC2626" /><Text style={s.loadingText}>{t('banqueSangForm.chargement')}</Text></View>;

    // ─── RENDER: Overview ────────────────────────────────────────────────
    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: 'Groupes dispo', value: groupsWithStock, icon: 'droplets', color: '#DC2626' },
                    { label: t('banqueSangForm.stockTotal'), value: `${totalStock} u.`, icon: 'package', color: '#3B82F6' },
                    { label: 'Dons', value: formData.accepte_dons ? '✓' : '✗', icon: 'heart', color: '#10B981' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            {/* Urgence badge */}
            <View style={[s.urgenceCard, { backgroundColor: formData.urgence_24h ? '#FEF2F2' : '#F3F4F6' }]}>
                <SafeIcon name="alert-triangle" size={20} color={formData.urgence_24h ? '#DC2626' : '#6B7280'} />
                <Text style={[s.urgenceText, { color: formData.urgence_24h ? '#DC2626' : '#6B7280' }]}>
                    {formData.urgence_24h ? t('banqueSangFormScreen.serviceDurgence24hActive') : t('banqueSangFormScreen.serviceDurgenceDesactive')}
                </Text>
            </View>

            {/* Quick Actions */}
            <View style={s.quickRow}>
                <TouchableOpacity style={s.quickAction} onPress={() => setActiveTab('stocks')}>
                    <View style={[s.quickIcon, { backgroundColor: '#DC262615' }]}><SafeIcon name="droplets" size={22} color="#DC2626" /></View>
                    <Text style={s.quickLabel}>{t('banqueSangForm.gererStocks')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickAction} onPress={() => setActiveTab('service')}>
                    <View style={[s.quickIcon, { backgroundColor: '#6B728015' }]}><SafeIcon name="settings" size={22} color="#6B7280" /></View>
                    <Text style={s.quickLabel}>{t('banqueSangForm.monService')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickAction} onPress={() => { Alert.alert(t('common.deconnexion'), t('common.confirmDeconnexion'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }]); }}>
                    <View style={[s.quickIcon, { backgroundColor: '#DC262615' }]}><SafeIcon name="log-out" size={22} color="#DC2626" /></View>
                    <Text style={s.quickLabel}>{t('common.sortir')}</Text>
                </TouchableOpacity>
            </View>

            {/* Stock Summary */}
            {groupsWithStock > 0 && (
                <>
                    <Text style={s.sectionTitle}>{t('banqueSangForm.stocksDisponibles')}</Text>
                    <View style={s.bloodGrid}>
                        {GROUPES_SANGUINS.map(g => {
                            const qty = parseInt(stocks[g]?.quantite || '0');
                            const hasStock = qty > 0;
                            return (
                                <View key={g} style={[s.bloodCard, hasStock && s.bloodCardActive]}>
                                    <Text style={[s.bloodType, hasStock && s.bloodTypeActive]}>{g}</Text>
                                    <Text style={[s.bloodQty, hasStock && s.bloodQtyActive]}>{qty} {stocks[g]?.unite || 'poches'}</Text>
                                </View>
                            );
                        })}
                    </View>
                </>
            )}

            {/* Stats from backend */}
            {statistics && (
                <>
                    <Text style={[s.sectionTitle, { marginTop: 16 }]}>Statistiques</Text>
                    {[
                        statistics.total_donations !== undefined && { l: t('banqueSangFormScreen.donsRecus'), v: statistics.total_donations },
                        statistics.total_requests !== undefined && { l: t('banqueSangFormScreen.demandesTraitees'), v: statistics.total_requests },
                        statistics.urgent_requests !== undefined && { l: 'Urgences', v: statistics.urgent_requests },
                    ].filter(Boolean).map((r: any, i) => (
                        <View key={i} style={s.statRow}><Text style={s.statRowLbl}>{r.l}</Text><Text style={s.statRowVal}>{r.v}</Text></View>
                    ))}
                </>
            )}
        </ScrollView>
    );

    // ─── RENDER: Service Form ────────────────────────────────────────────
    const renderServiceForm = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            {user?.role !== 'partenaire' && (
                <View style={s.field}><NativeInput label={t('banqueSangFormScreen.nom')} value={formData.nom} onChangeText={t => setFormData({ ...formData, nom: t })} placeholder="Ex: Banque de Sang Centrale" /></View>
            )}
            <View style={s.field}>
                <TouchableOpacity style={s.gpsBtn} onPress={() => setShowGPSModal(true)}>
                    <SafeIcon name="map-pin" size={20} color="#DC2626" />
                    <Text style={s.gpsBtnText}>{selectedGPS ? t('banqueSangFormScreen.gpsSelectionne') : t('banqueSangFormScreen.selectionnerSurLaCarte')}</Text>
                    <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
            {user?.role !== 'partenaire' && <View style={s.field}><NativeInput label="Adresse" value={formData.adresse} onChangeText={t => setFormData({ ...formData, adresse: t })} placeholder={t('banqueSangForm.adresseComplete')} multiline /></View>}
            <View style={s.field}>
                <LocationSelector label={t('banqueSangForm.quartierVille')} value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''} onSelect={(loc: LocationObject) => {
                    setFormData({ ...formData, quartier: loc, ville: loc.components?.ville || formData.ville, pays: loc.components?.pays || formData.pays });
                }} placeholder={t('banqueSangForm.rechercher')} scope="all" enrichWithBackend />
            </View>
            <View style={s.switchRow}><View><Text style={s.switchLbl}>Accepte les dons</Text><Text style={s.hint}>{t('banqueSangForm.lesDonneursPeuventVousContacter')}/Text></View><Switch value={formData.accepte_dons} onValueChange={v => setFormData({ ...formData, accepte_dons: v })} trackColor={{ false: '#D1D5DB', true: '#DC2626' }} /></View>
            <View style={s.switchRow}><View><Text style={s.switchLbl}>Accepte les demandes</Text><Text style={s.hint}>{t('banqueSangForm.lesPatientsPeuventDemanderDu')}/Text></View><Switch value={formData.accepte_demandes} onValueChange={v => setFormData({ ...formData, accepte_demandes: v })} trackColor={{ false: '#D1D5DB', true: '#DC2626' }} /></View>
            <View style={s.switchRow}><View><Text style={s.switchLbl}>Urgence 24h</Text><Text style={s.hint}>{t('banqueSangForm.serviceDurgenceDisponibleEnPermanence')}/Text></View><Switch value={formData.urgence_24h} onValueChange={v => setFormData({ ...formData, urgence_24h: v })} trackColor={{ false: '#D1D5DB', true: '#DC2626' }} /></View>
            {user?.role !== 'partenaire' && (
                <>
                    <View style={s.field}><NativeInput label={t('banqueSangForm.telephone')} value={formData.telephone} onChangeText={t => setFormData({ ...formData, telephone: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="Urgence" value={formData.telephone_urgence} onChangeText={t => setFormData({ ...formData, telephone_urgence: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="WhatsApp" value={formData.whatsapp} onChangeText={t => setFormData({ ...formData, whatsapp: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="Email" value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} placeholder="banque@example.com" keyboardType="email-address" autoCapitalize="none" /></View>
                </>
            )}
            <NativeButton title={loading ? 'Enregistrement...' : (isDashboardMode ? t('banqueSangFormScreen.mettreAJour') : 'Enregistrer')} onPress={handleSubmit} disabled={loading || !formData.nom.trim()} variant="primary" size="large" style={{ marginTop: 24 }} />
        </ScrollView>
    );

    // ─── RENDER: Stocks Tab ──────────────────────────────────────────────
    const renderStocksTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            <View style={s.stockHeader}>
                <Text style={s.sectionTitle}>{t('banqueSangForm.gestionDesStocks')}</Text>
                <Text style={s.stockSummary}>{groupsWithStock}/{GROUPES_SANGUINS.length} groupes · {totalStock} unités</Text>
            </View>
            {GROUPES_SANGUINS.map(group => {
                const qty = parseInt(stocks[group]?.quantite || '0');
                const unite = stocks[group]?.unite || 'poches';
                return (
                    <View key={group} style={s.stockRow}>
                        <View style={[s.stockBadge, qty > 0 ? s.stockBadgeActive : {}]}>
                            <Text style={[s.stockBadgeText, qty > 0 ? s.stockBadgeTextActive : {}]}>{group}</Text>
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 12 }}>
                            <NativeInput
                                value={stocks[group]?.quantite || ''}
                                onChangeText={t => setStocks(prev => ({ ...prev, [group]: { ...prev[group], quantite: t.replace(/\D/g, ''), unite } }))}
                                placeholder="0" keyboardType="numeric"
                            />
                        </View>
                        <View style={s.uniteRow}>
                            {['poches', 'ml'].map(u => (
                                <TouchableOpacity key={u} style={[s.uniteBtn, unite === u && s.uniteBtnOn]} onPress={() => setStocks(prev => ({ ...prev, [group]: { quantite: prev[group]?.quantite || '0', unite: u } }))}>
                                    <Text style={[s.uniteBtnText, unite === u && s.uniteBtnTextOn]}>{u}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            })}
            <NativeButton title={loading ? t('banqueSangFormScreen.miseAJour') : t('banqueSangFormScreen.mettreAJourLesStocks')} onPress={handleUpdateStocks} disabled={loading} variant="primary" size="large" style={{ marginTop: 24 }} />
        </ScrollView>
    );

    // ─── RENDER: Dashboard ───────────────────────────────────────────────
    if (isDashboardMode || (user?.role === 'partenaire' && serviceId)) {
        const tabs: { key: TabType; label: string; icon: string }[] = [
            { key: 'overview', label: t('banqueSangForm.accueil'), icon: 'layout-dashboard' },
            { key: 'service', label: 'Service', icon: 'settings' },
            { key: 'stocks', label: 'Stocks', icon: 'droplets' },
        ];
        return (
            <View style={s.container}>
                <LinearGradient colors={['#7F1D1D', '#DC2626']} style={s.dashHeader}>
                    <View style={s.dashHeaderRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={s.dashTitle}>{bankData?.nom || formData.nom || 'Banque de Sang'}</Text>
                            <Text style={s.dashSub}>{groupsWithStock} groupe{groupsWithStock > 1 ? 's' : ''} · {totalStock} unités en stock</Text>
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
                    {activeTab === 'stocks' && renderStocksTab()}
                </View>
                <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation" />
            </View>
        );
    }

    // ─── RENDER: Creation ────────────────────────────────────────────────
    return (
        <View style={s.container}>
            <LinearGradient colors={['#7F1D1D', '#DC2626']} style={s.createHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                <Text style={s.createTitle}>{t('banqueSangFormScreen.enregistrerUneBanqueDeSang')}</Text>
            </LinearGradient>
            {renderServiceForm()}
            <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation" />
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
    statValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    urgenceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, marginBottom: 20 },
    urgenceText: { fontSize: 15, fontWeight: '600' },
    quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    bloodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    bloodCard: { width: '23%', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    bloodCardActive: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
    bloodType: { fontSize: 18, fontWeight: '700', color: '#9CA3AF' },
    bloodTypeActive: { color: '#DC2626' },
    bloodQty: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
    bloodQtyActive: { color: '#DC2626' },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 6 },
    statRowLbl: { fontSize: 14, color: '#6B7280' },
    statRowVal: { fontSize: 16, fontWeight: '700', color: '#111827' },
    field: { marginBottom: 16 },
    hint: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingVertical: 6 },
    switchLbl: { fontSize: 14, color: '#374151', fontWeight: '500' },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, gap: 12 },
    gpsBtnText: { flex: 1, fontSize: 14, color: '#111827' },
    stockHeader: { marginBottom: 16 },
    stockSummary: { fontSize: 13, color: '#6B7280', marginTop: -8 },
    stockRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    stockBadge: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#E5E7EB' },
    stockBadgeActive: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
    stockBadgeText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
    stockBadgeTextActive: { color: '#DC2626' },
    uniteRow: { flexDirection: 'row', gap: 4 },
    uniteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F3F4F6' },
    uniteBtnOn: { backgroundColor: '#DC2626' },
    uniteBtnText: { fontSize: 12, color: '#374151' },
    uniteBtnTextOn: { color: '#fff', fontWeight: '600' },
});

export default BanqueSangFormScreen;
