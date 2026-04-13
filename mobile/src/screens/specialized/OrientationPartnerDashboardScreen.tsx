// Dashboard partenaire établissement scolaire — refonte UX 2026-04-11
// UX claire : cartes d'action larges, blocs manuels/programmes mis en avant,
// pas de blocs inutiles (62 langues, adaptation pays).

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
import { NativeButton } from '../../components/SafeNativeDesign';
import { ManagedProduct } from '../../types/ManagedProduct';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { orientationScolaireApi } from '../../services/orientationScolaireApi';

type TabType = 'accueil' | 'programmes' | 'resultats' | 'stats';

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
    statistiques_examens?: Record<string, any>;
    gps?: string;
}

const TYPE_LABELS: Record<string, string> = {
    primaire: 'Primaire',
    secondaire: 'Secondaire',
    superieur: 'Universitaire',
    formation: 'École de formation',
};

const OrientationPartnerDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user, logout } = useAuth();
    const { t } = useLanguageSafe();

    const [activeTab, setActiveTab] = useState<TabType>('accueil');
    const [showStudioModal, setShowStudioModal] = useState(false);
    const [studioProduct, setStudioProduct] = useState<ManagedProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [mineEtabs, setMineEtabs] = useState<Array<{ id: number; nom_etablissement: string; ville: string }>>([]);
    const [selectedEtabId, setSelectedEtabId] = useState<number | null>(null);
    const [selectedEtab, setSelectedEtab] = useState<PartnerEtab | null>(null);
    const [analytics, setAnalytics] = useState<any>(null);

    const extractPrograms = (payload: any): Program[] => {
        const raw = payload?.programs || payload?.formations || payload?.data?.programs || payload?.data?.formations || [];
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

    const loadData = useCallback(async () => {
        setLoading(true);
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
            setPrograms(extractPrograms(etabData));
        } catch (e) {
            console.error('[OrientationPartnerDashboard] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedEtabId]);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const typeEtab = (selectedEtab?.type_etablissement || '').toLowerCase();
    const isK12 = typeEtab === 'primaire' || typeEtab === 'secondaire';
    const isHigher = typeEtab === 'superieur' || typeEtab === 'formation';

    const navigateToProgrammeUpload = useCallback(() => {
        (navigation as any).navigate('EtablissementScolaire', {
            etablissementId: selectedEtab?.id,
            nomEtablissement: selectedEtab?.nom_etablissement,
            typeEtablissement: selectedEtab?.type_etablissement,
        });
    }, [navigation, selectedEtab]);

    const sharePublicProfile = async () => {
        if (!selectedEtab?.id) return;
        const url = `https://yukpomnang.com/orientation/etablissement/${selectedEtab.id}`;
        try {
            await Share.share({ message: `${selectedEtab.nom_etablissement} — Profil Yukpo\n${url}`, url });
        } catch {
            Alert.alert('Lien public', url);
        }
    };

    const analyticsStats = {
        views: Number(analytics?.summary?.views || analytics?.summary?.profile_views || 0),
        searches: Number(analytics?.summary?.searches || analytics?.summary?.search_hits || 0),
        clicks: Number(analytics?.summary?.cta_clicks || analytics?.summary?.contact_clicks || 0),
    };

    if (loading) {
        return (
            <View style={s.loadingScreen}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={s.loadingText}>Chargement…</Text>
            </View>
        );
    }

    // ─── Aucun établissement : écran de création ──────────────────────────────
    if (!selectedEtab && mineEtabs.length === 0) {
        return (
            <View style={s.container}>
                <LinearGradient colors={['#2563EB', '#1D4ED8']} style={s.header}>
                    <View style={s.headerRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                            <SafeIcon name="arrow-left" size={22} color="#fff" />
                        </TouchableOpacity>
                        <Text style={s.headerTitle}>Mon établissement</Text>
                    </View>
                </LinearGradient>
                <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
                    <SafeIcon name="school" size={64} color="#2563EB" style={{ marginTop: 20 }} />
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E40AF', marginTop: 16, textAlign: 'center' }}>
                        Bienvenue, {user?.name || 'Partenaire'} !
                    </Text>
                    <Text style={{ fontSize: 14, color: '#4B5563', textAlign: 'center', marginTop: 10, lineHeight: 21 }}>
                        Créez la fiche de votre établissement pour apparaître sur Yukpo, déposer vos programmes et alimenter la Bourse du Livre.
                    </Text>
                    <NativeButton
                        title="Créer la fiche de mon établissement"
                        onPress={() => (navigation as any).navigate('CreateEtablissement')}
                        style={{ marginTop: 24, width: '100%' }}
                    />
                    <TouchableOpacity onPress={logout} style={{ marginTop: 24 }}>
                        <Text style={{ color: '#EF4444', fontSize: 14 }}>Se déconnecter</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'accueil', label: 'Accueil', icon: 'home' },
        { key: 'programmes', label: isK12 ? 'Manuels' : 'Formations', icon: 'book-open' },
        { key: 'resultats', label: isK12 ? 'Résultats' : 'Admissions', icon: 'trending-up' },
        { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
    ];

    // ─── Onglet Accueil ───────────────────────────────────────────────────────
    const renderAccueil = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>

            {/* Sélecteur si plusieurs établissements */}
            {mineEtabs.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    {mineEtabs.map((e) => (
                        <TouchableOpacity key={e.id}
                            style={[s.etabChip, selectedEtabId === e.id && s.etabChipActive]}
                            onPress={() => { setSelectedEtabId(e.id); setLoading(true); loadData(); }}>
                            <Text style={[s.etabChipText, selectedEtabId === e.id && s.etabChipTextActive]}>
                                {e.nom_etablissement}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Alerte type non défini */}
            {selectedEtab && !selectedEtab.type_etablissement && (
                <TouchableOpacity style={s.alertCard}
                    onPress={() => (navigation as any).navigate('CreateEtablissement', { mode: 'edit', etablissementId: selectedEtab.id })}>
                    <SafeIcon name="alert-triangle" size={20} color="#B45309" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.alertTitle}>Complétez votre fiche</Text>
                        <Text style={s.alertText}>Le type d'établissement n'est pas défini. Appuyez pour le renseigner.</Text>
                    </View>
                    <SafeIcon name="chevron-right" size={18} color="#B45309" />
                </TouchableOpacity>
            )}

            {/* Carte fiche établissement */}
            <View style={s.ficheCard}>
                <View style={s.ficheHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.ficheName}>{selectedEtab?.nom_etablissement || 'Mon établissement'}</Text>
                        <Text style={s.ficheVille}>
                            {[selectedEtab?.ville, selectedEtab?.region].filter(Boolean).join(', ') || 'Ville non renseignée'}
                        </Text>
                        {selectedEtab?.type_etablissement && (
                            <View style={s.typeBadge}>
                                <Text style={s.typeBadgeText}>
                                    {TYPE_LABELS[typeEtab] || selectedEtab.type_etablissement}
                                </Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity style={s.editBtn}
                        onPress={() => (navigation as any).navigate('CreateEtablissement', { mode: 'edit', etablissementId: selectedEtab?.id })}>
                        <SafeIcon name="edit-2" size={16} color="#2563EB" />
                        <Text style={s.editBtnText}>Modifier</Text>
                    </TouchableOpacity>
                </View>
                <View style={s.ficheRow}>
                    <SafeIcon name="map-pin" size={14} color={selectedEtab?.gps ? '#10B981' : '#F59E0B'} />
                    <Text style={[s.ficheDetail, { color: selectedEtab?.gps ? '#065F46' : '#92400E' }]}>
                        GPS : {selectedEtab?.gps ? 'Renseigné' : 'Non renseigné — à compléter'}
                    </Text>
                </View>
                <TouchableOpacity style={s.profileLinkRow} onPress={sharePublicProfile}>
                    <SafeIcon name="share-2" size={14} color="#2563EB" />
                    <Text style={s.profileLinkText}>Partager le profil public</Text>
                </TouchableOpacity>
            </View>

            {/* ── Bloc manuels / programmes (K12) ── */}
            {isK12 && (
                <>
                    <Text style={s.sectionTitle}>📚 Manuels & programmes scolaires</Text>
                    <View style={s.manuelCard}>
                        <Text style={s.manuelDesc}>
                            Photographiez ou importez vos listes de manuels, programmes et emplois du temps.
                            Ces documents alimentent la <Text style={{ fontWeight: '700' }}>Bourse du Livre Yukpo</Text> — les parents peuvent préparer la rentrée directement depuis l'appli.
                        </Text>
                        <TouchableOpacity style={s.actionCardPrimary} onPress={navigateToProgrammeUpload}>
                            <View style={s.actionCardIcon}>
                                <SafeIcon name="camera" size={24} color="#fff" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.actionCardTitle}>Ajouter des manuels / programmes</Text>
                                <Text style={s.actionCardSub}>Caméra · Galerie · PDF · Excel</Text>
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.actionCardOutline}
                            onPress={() => (navigation as any).navigate('ProgrammesList', { etablissement_id: selectedEtab?.id })}>
                            <SafeIcon name="list" size={20} color="#2563EB" />
                            <Text style={s.actionCardOutlineText}>Voir les documents déjà déposés</Text>
                            <SafeIcon name="chevron-right" size={18} color="#2563EB" />
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* ── Formations (supérieur / formation) ── */}
            {isHigher && (
                <>
                    <Text style={s.sectionTitle}>🎓 Formations & filières</Text>
                    <TouchableOpacity style={s.actionCardPrimary}
                        onPress={() => (navigation as any).navigate('CreateEtablissement', { mode: 'edit', etablissementId: selectedEtab?.id })}>
                        <View style={[s.actionCardIcon, { backgroundColor: '#7C3AED' }]}>
                            <SafeIcon name="book-plus" size={24} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.actionCardTitle}>Gérer les filières / formations</Text>
                            <Text style={s.actionCardSub}>
                                {(selectedEtab?.filieres || []).length > 0
                                    ? `${selectedEtab?.filieres?.length} filière(s) publiée(s)`
                                    : 'Aucune filière — appuyez pour en ajouter'}
                            </Text>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionCardPrimary, { backgroundColor: '#0EA5E9', marginTop: 10 }]}
                        onPress={navigateToProgrammeUpload}>
                        <View style={[s.actionCardIcon, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                            <SafeIcon name="file-up" size={24} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.actionCardTitle}>Charger brochure / prospectus</Text>
                            <Text style={s.actionCardSub}>Photo · PDF · Excel</Text>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color="#fff" />
                    </TouchableOpacity>
                </>
            )}

            {/* ── Autres actions ── */}
            <Text style={s.sectionTitle}>Autres actions</Text>
            <View style={s.otherActionsGrid}>
                {[
                    {
                        icon: 'trending-up', color: '#10B981', bg: '#ECFDF5',
                        label: isK12 ? 'Résultats & examens' : 'Admissions & concours',
                        onPress: () => setActiveTab('resultats'),
                    },
                    {
                        icon: 'bar-chart-2', color: '#F59E0B', bg: '#FFFBEB',
                        label: 'Statistiques de visibilité',
                        onPress: () => setActiveTab('stats'),
                    },
                    {
                        icon: 'compass', color: '#0EA5E9', bg: '#EFF6FF',
                        label: 'Hub orientation public',
                        onPress: () => (navigation as any).navigate('OrientationScolaireHub'),
                    },
                    {
                        icon: 'wallet', color: '#8B5CF6', bg: '#F5F3FF',
                        label: 'Portefeuille',
                        onPress: () => (navigation as any).navigate('WalletFinancial'),
                    },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={[s.otherCard, { backgroundColor: a.bg }]} onPress={a.onPress}>
                        <SafeIcon name={a.icon as any} size={22} color={a.color} />
                        <Text style={[s.otherCardLabel, { color: a.color }]} numberOfLines={2}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Déconnexion */}
            <TouchableOpacity style={s.logoutRow} onPress={() =>
                Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Déconnecter', style: 'destructive', onPress: logout },
                ])}>
                <SafeIcon name="log-out" size={16} color="#EF4444" />
                <Text style={s.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    // ─── Onglet Programmes / Manuels ─────────────────────────────────────────
    const renderProgrammes = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {isK12 ? (
                <>
                    <View style={s.infoBox}>
                        <SafeIcon name="info" size={16} color="#1E40AF" />
                        <Text style={s.infoBoxText}>
                            Le programme national est défini par l'État. Vous déposez ici vos listes de manuels, emplois du temps et grilles officielles (PDF, Excel ou photo).
                        </Text>
                    </View>
                    <TouchableOpacity style={[s.actionCardPrimary, { marginBottom: 10 }]} onPress={navigateToProgrammeUpload}>
                        <View style={s.actionCardIcon}>
                            <SafeIcon name="camera" size={22} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.actionCardTitle}>Déposer un document</Text>
                            <Text style={s.actionCardSub}>Caméra · Galerie · PDF · Excel</Text>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionCardOutline}
                        onPress={() => (navigation as any).navigate('ProgrammesList', { etablissement_id: selectedEtab?.id })}>
                        <SafeIcon name="folder-open" size={20} color="#2563EB" />
                        <Text style={s.actionCardOutlineText}>Voir tous les documents déposés</Text>
                        <SafeIcon name="chevron-right" size={18} color="#2563EB" />
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <View style={s.infoBox}>
                        <SafeIcon name="info" size={16} color="#1E40AF" />
                        <Text style={s.infoBoxText}>
                            Publiez vos filières, spécialités et brochures pour apparaître dans les recommandations IA Yukpo.
                        </Text>
                    </View>
                    <TouchableOpacity style={[s.actionCardPrimary, { marginBottom: 10 }]}
                        onPress={() => (navigation as any).navigate('CreateEtablissement', { mode: 'edit', etablissementId: selectedEtab?.id })}>
                        <View style={[s.actionCardIcon, { backgroundColor: '#7C3AED' }]}>
                            <SafeIcon name="plus-circle" size={22} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.actionCardTitle}>Ajouter / modifier une filière</Text>
                            <Text style={s.actionCardSub}>{(selectedEtab?.filieres || []).length} filière(s) publiée(s)</Text>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionCardOutline} onPress={navigateToProgrammeUpload}>
                        <SafeIcon name="file-up" size={20} color="#2563EB" />
                        <Text style={s.actionCardOutlineText}>Charger une brochure ou prospectus</Text>
                        <SafeIcon name="chevron-right" size={18} color="#2563EB" />
                    </TouchableOpacity>
                </>
            )}

            {/* Liste des programmes déjà dans la base */}
            {programs.length > 0 && (
                <>
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>
                        {isK12 ? 'Documents indexés' : 'Filières publiées'} ({programs.length})
                    </Text>
                    {programs.map((p, i) => (
                        <View key={i} style={s.programCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.programName}>{p.nom}</Text>
                                {(p.niveau || p.duree) && (
                                    <Text style={s.programDetail}>
                                        {[p.niveau, p.duree].filter(Boolean).join(' · ')}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity style={s.videoBtn}
                                onPress={() => {
                                    setStudioProduct({
                                        id: String(p.id || i), nom: p.nom,
                                        serviceId: String(selectedEtab?.id || selectedEtabId || ''),
                                        serviceTitre: selectedEtab?.nom_etablissement || '',
                                        type: p.niveau, description: p.duree, product_index: i,
                                    });
                                    setShowStudioModal(true);
                                }}>
                                <SafeIcon name="film" size={14} color="#8B5CF6" />
                            </TouchableOpacity>
                            <View style={[s.statusDot, { backgroundColor: p.is_active !== false ? '#10B981' : '#D1D5DB' }]} />
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    );

    // ─── Onglet Résultats / Admissions ────────────────────────────────────────
    const renderResultats = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {isK12 ? (
                <>
                    <Text style={s.cardTitle}>Résultats aux examens nationaux</Text>
                    {selectedEtab?.statistiques_examens && Object.keys(selectedEtab.statistiques_examens).length > 0 ? (
                        Object.entries(selectedEtab.statistiques_examens).slice(0, 6).map(([annee, st]: [string, any]) => (
                            <View key={annee} style={s.resultRow}>
                                <Text style={s.resultAnnee}>{annee}</Text>
                                <View style={s.resultBarBg}>
                                    <View style={[s.resultBar, { width: `${Math.min(st?.taux_reussite || 0, 100)}%` }]} />
                                </View>
                                <Text style={s.resultPct}>{st?.taux_reussite != null ? `${st.taux_reussite}%` : '—'}</Text>
                            </View>
                        ))
                    ) : (
                        <View style={s.emptySmall}>
                            <Text style={s.emptySmallText}>Aucun résultat publié pour l'instant.</Text>
                        </View>
                    )}
                    <TouchableOpacity style={[s.actionCardPrimary, { marginTop: 16 }]}
                        onPress={() => (navigation as any).navigate('CreateEtablissement', { mode: 'edit', etablissementId: selectedEtab?.id })}>
                        <View style={[s.actionCardIcon, { backgroundColor: '#10B981' }]}>
                            <SafeIcon name="edit-2" size={20} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.actionCardTitle}>Mettre à jour les résultats</Text>
                            <Text style={s.actionCardSub}>Taux de réussite, classement national…</Text>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color="#fff" />
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <Text style={s.cardTitle}>Admissions & concours</Text>
                    <View style={s.admCard}>
                        <View style={s.admRow}>
                            <Text style={s.admLabel}>Concours publiés</Text>
                            <Text style={s.admValue}>{Array.isArray(selectedEtab?.concours) ? selectedEtab?.concours?.length : 0}</Text>
                        </View>
                        <View style={s.admRow}>
                            <Text style={s.admLabel}>Frais d'inscription</Text>
                            <Text style={s.admValue}>{String(selectedEtab?.frais_inscription ?? '—')}</Text>
                        </View>
                        <View style={s.admRow}>
                            <Text style={s.admLabel}>Conditions d'accès</Text>
                            <Text style={[s.admValue, { color: selectedEtab?.conditions_acces ? '#10B981' : '#EF4444' }]}>
                                {selectedEtab?.conditions_acces ? 'Renseignées' : 'À compléter'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity style={[s.actionCardPrimary, { marginTop: 12 }]}
                        onPress={() => (navigation as any).navigate('CreateEtablissement', { mode: 'edit', etablissementId: selectedEtab?.id })}>
                        <View style={[s.actionCardIcon, { backgroundColor: '#8B5CF6' }]}>
                            <SafeIcon name="edit-2" size={20} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.actionCardTitle}>Modifier les conditions & frais</Text>
                            <Text style={s.actionCardSub}>Frais, dossier, concours d'entrée…</Text>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionCardOutline, { marginTop: 10 }]}
                        onPress={() => (navigation as any).navigate('ConcoursEntree')}>
                        <SafeIcon name="award" size={20} color="#2563EB" />
                        <Text style={s.actionCardOutlineText}>Publier / mettre à jour les concours</Text>
                        <SafeIcon name="chevron-right" size={18} color="#2563EB" />
                    </TouchableOpacity>
                </>
            )}
        </ScrollView>
    );

    // ─── Onglet Stats ─────────────────────────────────────────────────────────
    const renderStats = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <Text style={s.cardTitle}>Visibilité de votre profil</Text>
            {[
                { label: 'Vues du profil', value: analyticsStats.views, icon: 'eye', color: '#10B981' },
                { label: 'Recherches associées', value: analyticsStats.searches, icon: 'search', color: '#F59E0B' },
                { label: 'Clics contact / candidature', value: analyticsStats.clicks, icon: 'mouse-pointer-click', color: '#8B5CF6' },
                { label: isK12 ? 'Documents déposés' : 'Formations publiées', value: programs.length, icon: 'book-open', color: '#2563EB' },
            ].map((item, i) => (
                <View key={i} style={s.statRow}>
                    <View style={[s.statRowIcon, { backgroundColor: item.color + '20' }]}>
                        <SafeIcon name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <Text style={s.statRowLabel}>{item.label}</Text>
                    <Text style={[s.statRowValue, { color: item.color }]}>{item.value}</Text>
                </View>
            ))}
            {!isK12 && (
                <TouchableOpacity style={[s.actionCardOutline, { marginTop: 20 }]}
                    onPress={() => (navigation as any).navigate('OrientationAIComparePrograms')}>
                    <SafeIcon name="cpu" size={20} color="#2563EB" />
                    <Text style={s.actionCardOutlineText}>Comparer avec d'autres formations (IA)</Text>
                    <SafeIcon name="chevron-right" size={18} color="#2563EB" />
                </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.actionCardOutline, { marginTop: 10 }]}
                onPress={() => (navigation as any).navigate('OrientationScolaireHub')}>
                <SafeIcon name="compass" size={20} color="#2563EB" />
                <Text style={s.actionCardOutlineText}>Explorer le hub orientation public</Text>
                <SafeIcon name="chevron-right" size={18} color="#2563EB" />
            </TouchableOpacity>
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
                        <Text style={s.headerTitle} numberOfLines={1}>
                            {selectedEtab?.nom_etablissement || 'Mon établissement'}
                        </Text>
                        <Text style={s.headerSub}>
                            {selectedEtab?.ville || ''}
                            {selectedEtab?.type_etablissement ? `  ·  ${TYPE_LABELS[typeEtab] || selectedEtab.type_etablissement}` : ''}
                        </Text>
                    </View>
                </View>
                <View style={s.tabRow}>
                    {TABS.map(tb => (
                        <TouchableOpacity key={tb.key}
                            style={[s.tab, activeTab === tb.key && s.tabActive]}
                            onPress={() => setActiveTab(tb.key)}>
                            <SafeIcon name={tb.icon as any} size={15} color={activeTab === tb.key ? '#fff' : 'rgba(255,255,255,0.55)'} />
                            <Text style={[s.tabLabel, activeTab === tb.key && s.tabLabelActive]}>{tb.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            <View style={s.content}>
                {activeTab === 'accueil' && renderAccueil()}
                {activeTab === 'programmes' && renderProgrammes()}
                {activeTab === 'resultats' && renderResultats()}
                {activeTab === 'stats' && renderStats()}
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
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },

    // Header
    header: { paddingTop: 50, paddingBottom: 4, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
    tabRow: { flexDirection: 'row', gap: 2, marginBottom: 6 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 4 },
    tabActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
    tabLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600' },
    tabLabelActive: { color: '#fff' },
    content: { flex: 1 },
    tabContent: { padding: 16, paddingBottom: 100 },

    // Selector chips
    etabChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 18, paddingVertical: 7, paddingHorizontal: 14 },
    etabChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
    etabChipText: { color: '#374151', fontSize: 12, fontWeight: '600' },
    etabChipTextActive: { color: '#1D4ED8' },

    // Alert card
    alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12, padding: 14, marginBottom: 14 },
    alertTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
    alertText: { fontSize: 12, color: '#B45309', marginTop: 2 },

    // Fiche card
    ficheCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    ficheHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    ficheName: { fontSize: 17, fontWeight: '800', color: '#111827' },
    ficheVille: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    typeBadge: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    typeBadgeText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    editBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
    ficheRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    ficheDetail: { fontSize: 13 },
    profileLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    profileLinkText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },

    // Manuel card
    manuelCard: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, padding: 14, marginBottom: 16 },
    manuelDesc: { fontSize: 13, color: '#1E40AF', lineHeight: 19, marginBottom: 12 },

    // Action cards
    actionCardPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', borderRadius: 12, padding: 14, gap: 12, marginBottom: 0 },
    actionCardIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    actionCardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
    actionCardSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
    actionCardOutline: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#BFDBFE', borderRadius: 12, padding: 14, gap: 12, marginTop: 8 },
    actionCardOutlineText: { flex: 1, color: '#1D4ED8', fontSize: 14, fontWeight: '600' },

    // Other actions grid
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 20, marginBottom: 10 },
    otherActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    otherCard: { width: '47%', borderRadius: 12, padding: 14, gap: 8, elevation: 1 },
    otherCardLabel: { fontSize: 13, fontWeight: '600', lineHeight: 17 },

    // Logout
    logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 28, paddingVertical: 12 },
    logoutText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },

    // Programs list
    programCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    programName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    programDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    videoBtn: { backgroundColor: '#8B5CF620', borderRadius: 6, padding: 6, marginRight: 8 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },

    // Resultats
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 14 },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    resultAnnee: { width: 44, fontSize: 13, fontWeight: '600', color: '#374151' },
    resultBarBg: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
    resultBar: { height: 8, backgroundColor: '#10B981', borderRadius: 4 },
    resultPct: { width: 36, fontSize: 13, fontWeight: '700', color: '#065F46', textAlign: 'right' },
    emptySmall: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 16, alignItems: 'center' },
    emptySmallText: { color: '#6B7280', fontSize: 13 },

    // Admissions
    admCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, elevation: 1, marginBottom: 4 },
    admRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    admLabel: { fontSize: 14, color: '#374151' },
    admValue: { fontSize: 15, fontWeight: '700', color: '#1F2937' },

    // Stats
    statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    statRowIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    statRowLabel: { flex: 1, fontSize: 13, color: '#374151' },
    statRowValue: { fontSize: 22, fontWeight: '800' },

    // Info box
    infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 14 },
    infoBoxText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 19 },
});

export default OrientationPartnerDashboardScreen;
