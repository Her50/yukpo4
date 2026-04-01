// Refonte 2026-03-27: Dashboard mini-site pour établissements supérieurs
// Objectif: permettre la publication d'informations clés (formations/concours/frais/conditions)
// + visibilité publique + analytics de consultation/recherche.

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ProductVideoCreationModal from '../../components/ProductVideoCreationModal';
import SafeIcon from '../../components/SafeIcon';
import SmartLanguageSelector from '../../components/SmartLanguageSelector';
import { NativeButton } from '../../components/SafeNativeDesign';
import { ManagedProduct } from '../../types/ManagedProduct';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { apiGet } from '../../services/api';
import { orientationScolaireApi } from '../../services/orientationScolaireApi';
import {
    detectGeoLanguageContext,
    getCountryFromCoords,
    getDefaultLanguageForCountry,
    getLanguagesForCountry,
} from '../../services/geoLanguageService';
import SafeStorage from '../../utils/safeStorage';

type TabType = 'vitrine' | 'formations' | 'admissions' | 'analytics';

interface Program {
    id: number;
    nom: string;
    niveau?: string;
    duree?: string;
    places_disponibles?: number;
    is_active: boolean;
}

interface PartnerEtab {
    id: number;
    nom_etablissement: string;
    ville?: string;
    region?: string;
    type_etablissement?: string;
    filieres?: string[];
    specialites?: string[];
    frais_inscription?: string | number;
    conditions_acces?: string;
    concours?: any[];
    site_web?: string;
    adresse?: string;
    programmes_docs?: Array<{ name?: string; url?: string }>;
    statistiques_examens?: Record<string, any>;
    gps?: string;
}

/** Primaire / secondaire : cadre national par pays — pas de filières à saisir côté Yukpo */
const K12_SYSTEMS: Record<string, { title: string; note: string }> = {
    CM: { title: 'Enseignement fondamental & secondaire (Cameroun)', note: 'Programmes officiels MINEDUB / MINESEC ; dépôt PDF/Excel pour listes et résultats.' },
    FR: { title: 'École primaire, collège, lycée', note: 'Socle commun, cycles nationaux ; pas de filières à renseigner ici.' },
    SN: { title: 'Primaire & secondaire', note: 'Référentiel national ; documents et stats de performance côté établissement.' },
    CI: { title: 'Primaire & secondaire', note: 'Cadre national CI ; programmes via fichiers et indicateurs de réussite.' },
    MA: { title: 'Primaire & secondaire', note: 'Cycles nationaux MA ; dépôt programmes et résultats académiques.' },
};

const HIGHER_EDU_SYSTEMS: Record<string, { title: string; structure: string; access: string }> = {
    CM: { title: 'Système LMD + BTS/HND', structure: 'Licence (3) · Master (2) · Doctorat (3+)', access: 'Concours / étude de dossier selon filière' },
    FR: { title: 'Système LMD', structure: 'Licence (3) · Master (2) · Doctorat (3+)', access: 'Parcoursup / concours écoles / dossier' },
    SN: { title: 'Système LMD', structure: 'Licence · Master · Doctorat', access: 'Dossier, orientation nationale, concours' },
    CI: { title: 'Système LMD', structure: 'Licence · Master · Doctorat', access: 'Orientation, dossier, concours selon établissement' },
    MA: { title: 'Système LMD + classes préparatoires', structure: 'Licence · Master · Doctorat', access: 'Concours, dossier, tests spécifiques' },
    TN: { title: 'Système LMD', structure: 'Licence · Master · Doctorat', access: 'Orientation, concours, dossiers' },
    US: { title: 'Undergraduate / Graduate', structure: 'Bachelor (4) · Master (1-2) · PhD', access: 'SAT/ACT ou dossier + frais + essays' },
    GB: { title: 'Undergraduate / Postgraduate', structure: 'Bachelor (3) · Master (1) · PhD', access: 'UCAS, dossier, IELTS selon profil' },
};

const OrientationPartnerDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user, logout } = useAuth();
    const { t, setLanguage } = useLanguageSafe();

    const [activeTab, setActiveTab] = useState<TabType>('vitrine');
    const [showStudioModal, setShowStudioModal] = useState(false);
    const [studioProduct, setStudioProduct] = useState<ManagedProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [mineEtabs, setMineEtabs] = useState<Array<{ id: number; nom_etablissement: string; ville: string }>>([]);
    const [selectedEtabId, setSelectedEtabId] = useState<number | null>(null);
    const [selectedEtab, setSelectedEtab] = useState<PartnerEtab | null>(null);
    const [analytics, setAnalytics] = useState<any>(null);
    const [countryCode, setCountryCode] = useState<string>('CM');
    const [countryLanguages, setCountryLanguages] = useState<Array<{ code: string; nativeName: string; isOfficial: boolean; isLocal: boolean }>>([]);
    const [defaultCountryLanguage, setDefaultCountryLanguage] = useState<string>('fr');
    const [stats, setStats] = useState({
        totalPrograms: 0,
        activePrograms: 0,
        totalPlaces: 0,
        inscriptions: 0,
        views: 0,
        searches: 0,
        clicks: 0,
    });

    const extractPrograms = (payload: any): Program[] => {
        const raw =
            payload?.programs ||
            payload?.formations ||
            payload?.data?.programs ||
            payload?.data?.formations ||
            [];
        if (!Array.isArray(raw)) return [];
        return raw.map((p: any, idx: number) => ({
            id: Number(p?.id ?? idx + 1),
            nom: String(p?.nom || p?.name || p?.filiere || 'Programme'),
            niveau: p?.niveau || p?.level,
            duree: p?.duree || p?.duration,
            places_disponibles: Number(p?.places_disponibles ?? p?.places ?? 0) || 0,
            is_active: p?.is_active !== false,
        }));
    };

    const normalizeStats = (progs: Program[], etab: PartnerEtab | null, a: any) => {
        const summary = a?.summary || a?.totals || a?.stats || {};
        return {
            totalPrograms: progs.length,
            activePrograms: progs.filter((p) => p.is_active !== false).length,
            totalPlaces: progs.reduce((sum, p) => sum + (p.places_disponibles || 0), 0),
            inscriptions: Number(summary?.inscriptions || summary?.applications || etab?.concours?.length || 0),
            views: Number(summary?.views || summary?.profile_views || summary?.visits || 0),
            searches: Number(summary?.searches || summary?.search_hits || 0),
            clicks: Number(summary?.cta_clicks || summary?.contact_clicks || 0),
        };
    };

    const parseGps = (gps?: string | null): { lat: number; lng: number } | null => {
        if (!gps || typeof gps !== 'string') return null;
        const parts = gps.split(',').map((v) => Number(v.trim()));
        if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
        return { lat: parts[0], lng: parts[1] };
    };

    const resolveCountryContext = async (etabData: PartnerEtab | null) => {
        const parsed = parseGps(etabData?.gps);
        let iso: string | null = null;
        if (parsed) {
            iso = getCountryFromCoords(parsed.lat, parsed.lng);
        }
        if (!iso) {
            const geo = await detectGeoLanguageContext();
            iso = geo.countryCode;
        }
        const finalIso = (iso || 'CM').toUpperCase();
        const langs = getLanguagesForCountry(finalIso);
        const defaultLang = getDefaultLanguageForCountry(finalIso);
        setCountryCode(finalIso);
        setCountryLanguages(langs);
        setDefaultCountryLanguage(defaultLang);

        // Ne pas écraser un choix utilisateur explicite.
        const userSelected = await SafeStorage.getItem('app_language_user_selected');
        if (userSelected !== '1') {
            setLanguage(defaultLang);
        }
    };

    const loadData = useCallback(async () => {
        try {
            const mine = await orientationScolaireApi.getMyEtablissements();
            const etabs = Array.isArray(mine?.etablissements) ? mine.etablissements : [];
            setMineEtabs(etabs);
            const effectiveId = selectedEtabId ?? (etabs.length > 0 ? etabs[0].id : null);
            setSelectedEtabId(effectiveId);
            if (!effectiveId) {
                setPrograms([]);
                setSelectedEtab(null);
                setAnalytics(null);
                setStats(normalizeStats([], null, null));
                return;
            }

            const [detailsResp, analyticsResp] = await Promise.all([
                apiGet(`/api/orientation-scolaire/etablissements/${effectiveId}`),
                orientationScolaireApi.getAnalytics(effectiveId).catch(() => null),
            ]);

            const detailsData = (detailsResp as any)?.data;
            const etabData = detailsData?.data || detailsData || null;
            setSelectedEtab(etabData);
            setAnalytics(analyticsResp || null);
            await resolveCountryContext(etabData);

            const progs = extractPrograms(etabData);
            setPrograms(progs);
            setStats(normalizeStats(progs, etabData, analyticsResp));
        } catch (e) {
            console.error('[OrientationPartnerDashboard] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const TABS: { key: TabType; label: string; icon: string }[] = isK12
        ? [
            { key: 'vitrine', label: 'Vitrine', icon: 'layout-dashboard' },
            { key: 'formations', label: 'Programmes', icon: 'book-open' },
            { key: 'admissions', label: 'Performances', icon: 'trending-up' },
            { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
        ]
        : [
            { key: 'vitrine', label: 'Vitrine', icon: 'layout-dashboard' },
            { key: 'formations', label: 'Formations', icon: 'book-open' },
            { key: 'admissions', label: 'Admissions', icon: 'file-text' },
            { key: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
        ];

    const typeEtab = (selectedEtab?.type_etablissement || '').toLowerCase();
    const isHigherEducation = typeEtab === 'superieur';
    const isK12 = typeEtab === 'primaire' || typeEtab === 'secondaire';
    /** Avertissement « vitrine supérieur » uniquement pour types hors LMD (ex. école de formation métier) */
    const showHigherEdMismatchWarning =
        !!selectedEtab && !isHigherEducation && !isK12;

    const k12System = K12_SYSTEMS[countryCode] || {
        title: 'Primaire & secondaire',
        note: 'Les programmes suivent le cadre national du pays. Déposez vos documents officiels (PDF/Excel) et vos statistiques de performance.',
    };
    const higherEduSystem = HIGHER_EDU_SYSTEMS[countryCode] || {
        title: 'Système supérieur local',
        structure: 'Licence/Bachelor · Master · Doctorat',
        access: 'Dossier, concours, tests selon établissement',
    };
    const publicProfileUrl = selectedEtab?.id
        ? `https://yukpomnang.com/orientation/etablissement/${selectedEtab.id}`
        : '';

    /** Bourse du livre : enregistre les manuels extraits avec `etablissement_id` pour la checklist parent (ProgrammeBesoins). */
    const navigateToProgrammeUpload = useCallback(() => {
        const e = selectedEtab;
        if (e?.id) {
            (navigation as any).navigate('EtablissementScolaire', {
                etablissementId: e.id,
                nomEtablissement: e.nom_etablissement,
                typeEtablissement: e.type_etablissement,
            });
        } else {
            (navigation as any).navigate('EtablissementScolaire');
        }
    }, [navigation, selectedEtab]);

    const sharePublicProfile = async () => {
        if (!publicProfileUrl) return;
        try {
            await Share.share({
                message: `${selectedEtab?.nom_etablissement || 'Établissement'} - Profil formations et admissions\n${publicProfileUrl}`,
                url: publicProfileUrl,
            });
        } catch {
            Alert.alert('Lien public', publicProfileUrl);
        }
    };

    if (loading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#2563EB" /><Text style={s.loadingText}>{t('orientationPartnerDashboard.chargement')}</Text></View>;
    }

    const renderVitrine = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {mineEtabs.length > 1 && (
                <>
                    <Text style={s.sectionTitle}>Établissement sélectionné</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
                        {mineEtabs.map((e) => (
                            <TouchableOpacity
                                key={e.id}
                                style={[s.etabChip, selectedEtabId === e.id && s.etabChipActive]}
                                onPress={() => {
                                    setSelectedEtabId(e.id);
                                    setLoading(true);
                                    loadData();
                                }}
                            >
                                <Text style={[s.etabChipText, selectedEtabId === e.id && s.etabChipTextActive]}>
                                    {e.nom_etablissement}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </>
            )}

            {showHigherEdMismatchWarning && (
                <View style={s.warningBox}>
                    <SafeIcon name="alert-triangle" size={18} color="#B45309" />
                    <View style={{ flex: 1 }}>
                        <Text style={s.warningTitle}>Vitrine « supérieur »</Text>
                        <Text style={s.warningText}>
                            Les filières et concours détaillés concernent surtout le supérieur. Pour le primaire/secondaire, utilisez l'onglet Programmes et Performances.'
                        </Text>
                    </View>
                </View>
            )}

            <View style={s.statsGrid}>
                {[
                    { label: isK12 ? 'Docs / suivis' : 'Formations', value: stats.totalPrograms, icon: 'book-open', color: '#2563EB' },
                    { label: 'Vues profil', value: stats.views, icon: 'eye', color: '#10B981' },
                    { label: isK12 ? 'Intérêt' : 'Recherches', value: stats.searches, icon: 'search', color: '#F59E0B' },
                    { label: 'Clics contact', value: stats.clicks, icon: 'mouse-pointer-click', color: '#8B5CF6' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            <Text style={s.sectionTitle}>Mini-site établissement</Text>
            <View style={s.publicCard}>
                <Text style={s.publicTitle}>{selectedEtab?.nom_etablissement || 'Mon établissement'}</Text>
                <Text style={s.publicSub}>
                    {selectedEtab?.ville || 'Ville non renseignée'}
                    {selectedEtab?.region ? `, ${selectedEtab.region}` : ''}
                </Text>
                <Text style={s.publicLink} numberOfLines={1}>{publicProfileUrl || 'Lien public indisponible'}</Text>
                <View style={s.publicRow}>
                    <NativeButton title="Voir profil public" onPress={() => selectedEtab?.id && (navigation as any).navigate('EtablissementDetails', { id: selectedEtab.id })} variant="primary" />
                    <NativeButton title="Partager le lien" onPress={sharePublicProfile} variant="outline" />
                </View>
            </View>

            <Text style={s.sectionTitle}>
                {isK12 ? 'Pays & cadre scolaire (primaire / secondaire)' : 'Adaptation pays & système supérieur'}
            </Text>
            <View style={s.countryCard}>
                <Text style={s.countryTitle}>Pays détecté: {countryCode}</Text>
                {isK12 ? (
                    <>
                        <Text style={s.countryLine}>Référence: {k12System.title}</Text>
                        <Text style={s.countryLine}>{k12System.note}</Text>
                    </>
                ) : (
                    <>
                        <Text style={s.countryLine}>Référence: {higherEduSystem.title}</Text>
                        <Text style={s.countryLine}>Structure: {higherEduSystem.structure}</Text>
                        <Text style={s.countryLine}>Accès: {higherEduSystem.access}</Text>
                    </>
                )}
                <Text style={s.countryHint}>
                    Le dashboard adapte automatiquement les recommandations selon le pays/GPS.
                </Text>
            </View>

            <Text style={s.sectionTitle}>Système 62 langues</Text>
            <View style={s.languageCard}>
                <Text style={s.languageLine}>
                    Couverture active: {SUPPORTED_LANGUAGES.length} langues.
                </Text>
                <Text style={s.languageLine}>
                    Langue auto suggérée ({countryCode}): {defaultCountryLanguage.toUpperCase()}
                </Text>
                <Text style={s.languageLine}>
                    Langues locales/officiales: {countryLanguages.slice(0, 5).map((l) => l.nativeName).join(', ') || '-'}
                </Text>
                <View style={s.languagePickerRow}>
                    <Text style={s.languagePickerLabel}>Changer la langue</Text>
                    <SmartLanguageSelector compact={true} showCountryHint={true} />
                </View>
            </View>

            <Text style={s.sectionTitle}>Actions rapides</Text>
            <View style={s.quickRow}>
                {[
                    { label: t('orientationPartnerDashboard.modifierEtablissement'), icon: 'edit', color: '#2563EB', onPress: () => (navigation as any).navigate('CreateEtablissement', { mode: 'edit', etablissementId: selectedEtab?.id }) },
                    ...(isK12
                        ? [
                            { label: 'Programmes (caméra ou fichier)', icon: 'file-up', color: '#10B981', onPress: navigateToProgrammeUpload },
                            { label: 'Liste programmes Yukpo', icon: 'book-open', color: '#F59E0B', onPress: () => (navigation as any).navigate('ProgrammesList', { etablissement_id: selectedEtab?.id }) },
                            { label: 'Stats & réussite', icon: 'trending-up', color: '#7C3AED', onPress: () => (navigation as any).navigate('CreateEtablissement', { etablissementId: selectedEtab?.id }) },
                        ]
                        : [
                            { label: 'Ajouter/éditer formations', icon: 'book-plus', color: '#10B981', onPress: () => (navigation as any).navigate('CreateEtablissement', { tab: 'programs' }) },
                            { label: 'Charger programmes (caméra / fichier)', icon: 'file-up', color: '#7C3AED', onPress: navigateToProgrammeUpload },
                            { label: 'Concours & programmes', icon: 'graduation-cap', color: '#F59E0B', onPress: () => (navigation as any).navigate('ProgrammesList') },
                        ]),
                    { label: 'Hub Orientation public', icon: 'compass', color: '#0EA5E9', onPress: () => (navigation as any).navigate('OrientationScolaireHub') },
                    { label: 'Portefeuille', icon: 'wallet', color: '#8B5CF6', onPress: () => (navigation as any).navigate('WalletFinancial') },
                    {
                        label: t('common.sortir'), icon: 'log-out', color: '#DC2626', onPress: () => {
                            Alert.alert(
                                t('common.deconnexion'),
                                t('common.confirmDeconnexion'),
                                [
                                    { text: t('common.cancel'), style: 'cancel' },
                                    { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }
                                ]
                            );
                        }
                    },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}>
                            <SafeIcon name={a.icon as any} size={22} color={a.color} />
                        </View>
                        <Text style={s.quickLabel} numberOfLines={2}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {selectedEtab && (
                <>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionTitle}>{isK12 ? 'Suivi établissement' : 'Informations clés publiées'}</Text>
                        <TouchableOpacity onPress={() => setActiveTab('admissions')}><Text style={s.seeAll}>Compléter</Text></TouchableOpacity>
                    </View>
                    <View style={s.keyInfoCard}>
                        <Text style={s.keyInfoLine}>Type: {selectedEtab.type_etablissement || 'non renseigné'}</Text>
                        {isK12 ? (
                            <>
                                <Text style={s.keyInfoLine}>
                                    GPS: {selectedEtab.gps ? 'renseigné' : 'à préciser sur la fiche'}
                                </Text>
                                <Text style={s.keyInfoLine}>
                                    Performances: {selectedEtab.statistiques_examens && Object.keys(selectedEtab.statistiques_examens).length > 0 ? 'publiées (aperçu)' : 'à renseigner'}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={s.keyInfoLine}>Frais d'inscription: {String(selectedEtab.frais_inscription ?? 'à renseigner')}</Text>'
                                <Text style={s.keyInfoLine}>
                                    Filières: {(selectedEtab.filieres || []).length > 0 ? selectedEtab.filieres?.slice(0, 3).join(', ') : 'à renseigner'}
                                </Text>
                                <Text style={s.keyInfoLine}>
                                    Conditions d'accès: {selectedEtab.conditions_acces ? 'disponibles' : 'à renseigner'}'
                                </Text>
                            </>
                        )}
                    </View>
                </>
            )}

            {programs.length === 0 && (
                <View style={s.emptyState}>
                    <SafeIcon name="graduation-cap" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{t('orientationPartnerDashboard.aucunProgramme')}</Text>
                    <Text style={s.emptyText}>
                        {isK12
                            ? 'Déposez vos programmes et listes officielles (PDF/Excel) et complétez vos statistiques de réussite depuis les actions rapides.'
                            : 'Configurez votre établissement supérieur pour publier la vitrine formations.'}
                    </Text>
                    <NativeButton title="Configurer" onPress={() => (navigation as any).navigate('CreateEtablissement')} style={{ marginTop: 16 }} />
                </View>
            )}
        </ScrollView>
    );

    const renderFormations = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {isK12 ? (
                <>
                    <Text style={{ fontSize: 14, color: '#4B5563', marginBottom: 12, lineHeight: 21 }}>
                        Le programme national (niveaux, matières) est défini par votre pays. Vous chargez ici les documents officiels de l'établissement : listes de manuels, emplois du temps, grilles, etc. (PDF ou Excel).'
                    </Text>
                    <NativeButton title="Envoyer programmes / listes (caméra, PDF, Excel…)" onPress={() => (navigation as any).navigate('EtablissementScolaire')} variant="primary" style={{ marginBottom: 12 }} />
                    <NativeButton title="Voir espace programmes orientation" onPress={() => (navigation as any).navigate('ProgrammesList', { etablissement_id: selectedEtab?.id })} variant="outline" style={{ marginBottom: 16 }} />
                </>
            ) : (
                <>
                    <NativeButton title="Ajouter une formation/filière" onPress={() => (navigation as any).navigate('CreateEtablissement', { tab: 'programs' })} variant="primary" style={{ marginBottom: 12 }} />
                    <NativeButton title="Charger brochure (photo ou fichier)" onPress={navigateToProgrammeUpload} variant="outline" style={{ marginBottom: 16 }} />
                </>
            )}
            {programs.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="book-open" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{isK12 ? 'Aucun document indexé' : t('orientationPartnerDashboard.aucunProgramme')}</Text>
                    <Text style={s.emptyText}>
                        {isK12
                            ? "Utilisez le bouton ci-dessus pour transmettre vos fichiers. Les indicateurs de réussite se gèrent dans l'onglet Performances."
                            : 'Ajoutez vos filières/specialités et publiez vos brochures pour la visibilité.'}
                    </Text>
                </View>
            ) : (
                programs.map((p, i) => (
                    <View key={i} style={s.programCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.programName}>{p.nom}</Text>
                            <Text style={s.programDetail}>
                                {p.niveau || ''}{p.duree ? ` · ${p.duree}` : ''}{p.places_disponibles ? ` · ${p.places_disponibles} places` : ''}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={{ backgroundColor: '#8B5CF620', borderRadius: 6, padding: 6, marginRight: 6 }}
                            onPress={() => {
                                const mp: ManagedProduct = {
                                    id: String(p.id || i),
                                    nom: p.nom,
                                    serviceId: String(selectedEtab?.id || selectedEtabId || ''),
                                    serviceTitre: selectedEtab?.nom_etablissement || 'Établissement',
                                    type: p.niveau,
                                    description: p.duree,
                                    product_index: i,
                                };
                                setStudioProduct(mp);
                                setShowStudioModal(true);
                            }}
                        >
                            <SafeIcon name="film" size={14} color="#8B5CF6" />
                        </TouchableOpacity>
                        <View style={[s.statusDot, { backgroundColor: p.is_active !== false ? '#10B981' : '#EF4444' }]} />
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderAdmissions = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {isK12 ? (
                <>
                    <Text style={{ fontSize: 14, color: '#4B5563', marginBottom: 14, lineHeight: 21 }}>
                        Saisissez les taux de réussite et résultats d'examens nationaux par année (aperçu public). Pas de filières à renseigner : le référentiel est national.'
                    </Text>
                    <View style={s.analyticsCard}>
                        <Text style={s.analyticsTitle}>Indicateurs académiques</Text>
                        {selectedEtab?.statistiques_examens && Object.keys(selectedEtab.statistiques_examens).length > 0 ? (
                            Object.entries(selectedEtab.statistiques_examens).slice(0, 5).map(([annee, st]: [string, any]) => (
                                <View key={annee} style={s.analyticsRow}>
                                    <Text style={s.analyticsLabel}>{annee}</Text>
                                    <Text style={s.analyticsValue}>
                                        {st?.taux_reussite != null ? `${st.taux_reussite}%` : '—'}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <Text style={{ color: '#6B7280', fontSize: 14 }}>Aucune statistique publiée pour l'instant.</Text>'
                        )}
                    </View>
                    <NativeButton title="Mettre à jour les statistiques" onPress={() => (navigation as any).navigate('CreateEtablissement', { etablissementId: selectedEtab?.id })} variant="primary" style={{ marginTop: 12 }} />
                </>
            ) : (
                <>
                    <View style={s.analyticsCard}>
                        <Text style={s.analyticsTitle}>Admissions & concours</Text>
                        <View style={s.analyticsRow}>
                            <View style={[s.analyticsDot, { backgroundColor: '#8B5CF6' }]} />
                            <Text style={s.analyticsLabel}>Concours publiés</Text>
                            <Text style={[s.analyticsValue, { color: '#8B5CF6' }]}>{Array.isArray(selectedEtab?.concours) ? selectedEtab?.concours?.length : 0}</Text>
                        </View>
                        <View style={s.analyticsRow}>
                            <View style={[s.analyticsDot, { backgroundColor: '#F59E0B' }]} />
                            <Text style={s.analyticsLabel}>Frais d'inscription</Text>'
                            <Text style={[s.analyticsValue, { color: '#F59E0B' }]}>{String(selectedEtab?.frais_inscription ?? 'N/A')}</Text>
                        </View>
                        <View style={s.analyticsRow}>
                            <View style={[s.analyticsDot, { backgroundColor: '#10B981' }]} />
                            <Text style={s.analyticsLabel}>Conditions d'accès</Text>'
                            <Text style={[s.analyticsValue, { color: '#10B981', fontSize: 13 }]}>
                                {selectedEtab?.conditions_acces ? 'Renseignées' : 'À compléter'}
                            </Text>
                        </View>
                    </View>
                    <NativeButton title="Éditer conditions & frais" onPress={() => (navigation as any).navigate('CreateEtablissement', { mode: 'edit', etablissementId: selectedEtab?.id })} variant="primary" style={{ marginTop: 12 }} />
                    <NativeButton title="Publier/mettre à jour concours" onPress={() => (navigation as any).navigate('ConcoursEntree')} variant="outline" style={{ marginTop: 10 }} />
                </>
            )}
        </ScrollView>
    );

    const renderAnalytics = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.analyticsCard}>
                <Text style={s.analyticsTitle}>Performance visibilité</Text>
                {[
                    { label: 'Vues du profil établissement', value: stats.views, color: '#10B981' },
                    { label: 'Recherches liées à vos formations', value: stats.searches, color: '#F59E0B' },
                    { label: 'Clics contact / candidature', value: stats.clicks, color: '#8B5CF6' },
                    { label: 'Programmes actifs', value: stats.activePrograms, color: '#2563EB' },
                ].map((item, i) => (
                    <View key={i} style={s.analyticsRow}>
                        <View style={[s.analyticsDot, { backgroundColor: item.color }]} />
                        <Text style={s.analyticsLabel}>{item.label}</Text>
                        <Text style={[s.analyticsValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                ))}
            </View>
            {!isK12 && (
                <NativeButton title="Comparer programmes IA" onPress={() => (navigation as any).navigate('OrientationAIComparePrograms')} variant="outline" style={{ marginTop: 16 }} />
            )}
            <NativeButton title="Explorer le hub public orientation" onPress={() => (navigation as any).navigate('OrientationScolaireHub')} variant="outline" style={{ marginTop: 10 }} />
        </ScrollView>
    );

    return (
        <View style={s.container}>
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>{t('orientationPartnerDashboard.dashboardEtablissement')}</Text>
                        <Text style={s.headerSub}>{user?.name || t('orientationPartnerDashboard.partenaire')}</Text>
                    </View>
                </View>
                <View style={s.tabRow}>
                    {TABS.map(t => (
                        <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabActive]} onPress={() => setActiveTab(t.key)}>
                            <SafeIcon name={t.icon as any} size={16} color={activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.6)'} />
                            <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>
            <View style={s.content}>
                {activeTab === 'vitrine' && renderVitrine()}
                {activeTab === 'formations' && renderFormations()}
                {activeTab === 'admissions' && renderAdmissions()}
                {activeTab === 'analytics' && renderAnalytics()}
            </View>
            <ProductVideoCreationModal
                visible={showStudioModal}
                primaryProduct={studioProduct}
                products={studioProduct ? [studioProduct] : []}
                onClose={() => { setShowStudioModal(false); setStudioProduct(null); }}
                onSuccess={() => { setShowStudioModal(false); setStudioProduct(null); }}
                navigation={navigation}
            />
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
    tabRow: { flexDirection: 'row', gap: 4 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 4 },
    tabActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
    tabLabelActive: { color: '#fff' },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 1 },
    statValue: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginTop: 6 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 20, marginBottom: 10 },
    chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
    etabChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
    etabChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
    etabChipText: { color: '#374151', fontSize: 12, fontWeight: '600' },
    etabChipTextActive: { color: '#1D4ED8' },
    warningBox: { marginTop: 8, backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: 'row', gap: 8 },
    warningTitle: { color: '#92400E', fontWeight: '700', fontSize: 13 },
    warningText: { color: '#92400E', fontSize: 12, marginTop: 2 },
    publicCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, elevation: 1, marginBottom: 6 },
    publicTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
    publicSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    publicLink: { fontSize: 12, color: '#2563EB', marginTop: 8 },
    publicRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
    countryCard: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#C7D2FE' },
    countryTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginBottom: 6 },
    countryLine: { fontSize: 12, color: '#1E3A8A', marginBottom: 3 },
    countryHint: { fontSize: 12, color: '#3730A3', marginTop: 6 },
    languageCard: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BBF7D0' },
    languageLine: { fontSize: 12, color: '#166534', marginBottom: 6 },
    languagePickerRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    languagePickerLabel: { fontSize: 13, fontWeight: '600', color: '#166534' },
    keyInfoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, elevation: 1 },
    keyInfoLine: { fontSize: 13, color: '#374151', marginBottom: 6 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
    seeAll: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
    quickRow: { flexDirection: 'row', gap: 10 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    programCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    programName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    programDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1 },
    analyticsTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    analyticsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    analyticsLabel: { flex: 1, fontSize: 14, color: '#374151' },
    analyticsValue: { fontSize: 18, fontWeight: '700' },
});

export default OrientationPartnerDashboardScreen;
