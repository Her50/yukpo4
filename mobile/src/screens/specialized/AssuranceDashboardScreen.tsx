// @ts-nocheck
// Dashboard professionnel pour prestataires Assurance
// Digitalisation complète: produits, polices, sinistres, analytics IA

import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import assuranceService, {
    type CreateProductPayload,
    type DashboardStats,
    type InsuranceClaim,
    type InsurancePolicy,
    type InsuranceProduct,
} from '../../services/assuranceService';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

type TabType = 'overview' | 'products' | 'policies' | 'claims' | 'analytics';

const TYPES_ASSURANCE = [
    { key: 'auto', label: 'Automobile', icon: 'car', color: '#3B82F6' },
    { key: 'sante', label: t('assuranceDashboard.sante'), icon: 'heart', color: '#DC2626' },
    { key: 'habitation', label: 'Habitation', icon: 'home', color: '#10B981' },
    { key: 'vie', label: 'Vie', icon: 'shield', color: '#8B5CF6' },
    { key: 'voyage', label: 'Voyage', icon: 'plane', color: '#F59E0B' },
    { key: 'entreprise', label: 'Entreprise', icon: 'briefcase', color: '#6366F1' },
];

const SOUS_CATEGORIES: Record<string, string[]> = {
    auto: ['Tous risques', 'Tiers collision', t('assuranceDashboardScreen.responsabiliteCivile'), 'Vol/Incendie'],
    sante: ['Hospitalisation', 'Ambulatoire', t('assuranceDashboardScreen.maternite'), 'Dentaire', 'Optique'],
    habitation: ['Multirisque', 'Incendie', 'Vol', t('assuranceDashboardScreen.degatsDesEaux')],
    vie: [t('assuranceDashboardScreen.deces'), 'Épargne', 'Retraite', 'Mixte'],
    voyage: ['Annulation', 'Rapatriement', 'Bagages', 'Multi-garanties'],
    entreprise: ['RC Pro', 'Multirisque', t('assuranceDashboardScreen.hommeCle'), 'Flotte auto'],
};

const CLAIM_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    declare: { label: t('assuranceDashboard.declare'), color: '#D97706', bg: '#FEF3C7' },
    en_cours_instruction: { label: 'En instruction', color: '#2563EB', bg: '#DBEAFE' },
    expertise_demandee: { label: t('assuranceDashboard.expertiseDemandee'), color: '#7C3AED', bg: '#EDE9FE' },
    expertise_en_cours: { label: 'Expertise en cours', color: '#7C3AED', bg: '#EDE9FE' },
    en_attente_documents: { label: 'Attente documents', color: '#D97706', bg: '#FEF3C7' },
    approuve: { label: t('assuranceDashboard.approuve'), color: '#059669', bg: '#D1FAE5' },
    partiellement_approuve: { label: t('assuranceDashboard.partiellementApprouve'), color: '#059669', bg: '#D1FAE5' },
    refuse: { label: t('assuranceDashboard.refuse'), color: '#DC2626', bg: '#FEE2E2' },
    indemnise: { label: t('assuranceDashboard.indemnise'), color: '#059669', bg: '#D1FAE5' },
    clos: { label: 'Clos', color: '#6B7280', bg: '#F3F4F6' },
    conteste: { label: t('assuranceDashboard.conteste'), color: '#DC2626', bg: '#FEE2E2' },
};

const POLICY_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    brouillon: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
    en_attente: { label: t('assuranceDashboard.enAttente'), color: '#D97706', bg: '#FEF3C7' },
    active: { label: 'Active', color: '#059669', bg: '#D1FAE5' },
    suspendue: { label: 'Suspendue', color: '#D97706', bg: '#FEF3C7' },
    resiliee: { label: t('assuranceDashboard.resiliee'), color: '#DC2626', bg: '#FEE2E2' },
    expiree: { label: t('assuranceDashboard.expiree'), color: '#6B7280', bg: '#F3F4F6' },
    annulee: { label: t('assuranceDashboard.annulee'), color: '#DC2626', bg: '#FEE2E2' },
};

const AssuranceDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const serviceId = (route.params as any)?.serviceId || (route.params as any)?.service_id || 0;

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const [products, setProducts] = useState<InsuranceProduct[]>([]);
    const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
    const [claims, setClaims] = useState<InsuranceClaim[]>([]);
    const [dashStats, setDashStats] = useState<DashboardStats | null>(null);

    // Product creation modal
    const [showProductModal, setShowProductModal] = useState(false);
    const [newProduct, setNewProduct] = useState<Partial<CreateProductPayload>>({
        type_assurance: 'auto',
        sous_categorie: 'Tous risques',
    });

    const devise = getCurrencyIntelligently() || 'FCFA';

    const loadData = useCallback(async () => {
        try {
            const [prodRes, polRes, claimRes, statsRes] = await Promise.allSettled([
                assuranceService.listProducts(),
                assuranceService.listPolicies(),
                assuranceService.listClaims(),
                assuranceService.getDashboardStats(),
            ]);

            setProducts(prodRes.status === 'fulfilled' ? prodRes.value : []);
            setPolicies(polRes.status === 'fulfilled' ? polRes.value : []);
            setClaims(claimRes.status === 'fulfilled' ? claimRes.value : []);
            setDashStats(statsRes.status === 'fulfilled' ? statsRes.value : null);
        } catch (e) {
            console.error('[AssuranceDashboard] Error loading data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const handleCreateProduct = async () => {
        if (!newProduct.nom_produit?.trim()) {
            Alert.alert(t('message.error'), t('assuranceDashboard.productNameRequired'));
            return;
        }
        setActionLoading(true);
        try {
            const result = await assuranceService.createProduct({
                service_id: serviceId,
                nom_produit: newProduct.nom_produit!,
                type_assurance: newProduct.type_assurance || 'auto',
                sous_categorie: newProduct.sous_categorie || 'Tous risques',
                description: newProduct.description,
                compagnie: newProduct.compagnie,
                prime_mensuelle: newProduct.prime_mensuelle,
                prime_annuelle: newProduct.prime_annuelle,
                couverture_max: newProduct.couverture_max,
                franchise_montant: newProduct.franchise_montant,
                garanties: newProduct.garanties,
                exclusions: newProduct.exclusions,
                duree_contrat_mois: newProduct.duree_contrat_mois,
                age_min: newProduct.age_min,
                age_max: newProduct.age_max,
            });
            if (result.success) {
                Alert.alert(t('assuranceDashboard.productCreated'), t('assuranceDashboard.productCreatedMsg', { name: newProduct.nom_produit }));
                setShowProductModal(false);
                setNewProduct({ type_assurance: 'auto', sous_categorie: 'Tous risques' });
                loadData();
            } else {
                Alert.alert(t('message.error'), t('assuranceDashboard.cannotCreateProduct'));
            }
        } catch (e) {
            Alert.alert(t('message.error'), t('assuranceDashboard.genericError'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleProduct = async (id: number) => {
        const result = await assuranceService.toggleProduct(id);
        if (result.success) loadData();
    };

    const handleClaimAction = async (claim: InsuranceClaim, action: string) => {
        if (action === 'ai_analyze') {
            setActionLoading(true);
            try {
                const analysis = await assuranceService.aiAnalyzeClaim(claim.id);
                if (analysis) {
                    const score = analysis.fraud_score !== undefined ? `${(analysis.fraud_score * 100).toFixed(0)}%` : 'N/A';
                    Alert.alert(
                        t('assuranceDashboard.aiAnalysis', { score }),
                        `${t('assuranceDashboard.recommendedAction')}: ${analysis.recommended_action || 'N/A'}\n\n${analysis.action_justification || analysis.legitimacy_assessment || t('assuranceDashboard.fullAnalysisAvailable')}`,
                        [{ text: 'OK' }]
                    );
                    loadData();
                }
            } finally {
                setActionLoading(false);
            }
            return;
        }

        const statusMap: Record<string, string> = {
            instruire: 'en_cours_instruction',
            expertise: 'expertise_demandee',
            approuver: 'approuve',
            refuser: 'refuse',
            indemniser: 'indemnise',
            clore: 'clos',
        };
        const newStatus = statusMap[action];
        if (!newStatus) return;

        if (action === 'refuser') {
            Alert.prompt?.('Motif de refus', 'Indiquez le motif', async (motif: string) => {
                await assuranceService.updateClaimStatus(claim.id, newStatus, { motif_refus: motif });
                loadData();
            }) || Alert.alert(t('assuranceDashboard.refuse'), t('assuranceDashboard.confirmRefusal'), [
                { text: t('common.cancel') },
                {
                    text: t('common.confirm'), onPress: async () => {
                        await assuranceService.updateClaimStatus(claim.id, newStatus, { motif_refus: t('assuranceDashboardScreen.refuseParLassureur') });
                        loadData();
                    }
                },
            ]);
            return;
        }

        if (action === 'indemniser') {
            Alert.alert(t('assuranceDashboard.compensate'), t('assuranceDashboard.confirmCompensation'), [
                { text: t('common.cancel') },
                {
                    text: t('common.confirm'), onPress: async () => {
                        const montant = claim.montant_reclame ? parseFloat(claim.montant_reclame) : 0;
                        await assuranceService.updateClaimStatus(claim.id, newStatus, { montant_indemnise: montant });
                        loadData();
                    }
                },
            ]);
            return;
        }

        await assuranceService.updateClaimStatus(claim.id, newStatus);
        loadData();
    };

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'overview', label: t('assuranceDashboard.accueil'), icon: 'layout-dashboard' },
        { key: 'products', label: 'Produits', icon: 'package' },
        { key: 'policies', label: 'Polices', icon: 'file-text' },
        { key: 'claims', label: 'Sinistres', icon: 'alert-triangle' },
        { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
    ];

    if (loading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#6366F1" /><Text style={s.loadingText}>{t('assuranceDashboard.chargementDuDashboard')}</Text></View>;
    }

    const ps = dashStats?.products || { total: 0, actifs: 0, total_souscriptions: 0 };
    const pol = dashStats?.policies || { total: 0, actives: 0, suspendues: 0, expirees: 0, a_renouveler: 0 };
    const cl = dashStats?.claims || { total: 0, declares: 0, en_instruction: 0, en_expertise: 0, approuves: 0, indemnises: 0, refuses: 0 };

    const renderStatusBadge = (statut: string, map: Record<string, { label: string; color: string; bg: string }>) => {
        const info = map[statut] || { label: statut, color: '#6B7280', bg: '#F3F4F6' };
        return (
            <View style={[s.badge, { backgroundColor: info.bg }]}>
                <Text style={[s.badgeText, { color: info.color }]}>{info.label}</Text>
            </View>
        );
    };

    // ═══════ OVERVIEW ═══════
    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: t('assuranceDashboard.produitsActifs'), value: ps.actifs, icon: 'package', color: '#3B82F6' },
                    { label: 'Polices actives', value: pol.actives, icon: 'file-text', color: '#10B981' },
                    { label: 'Sinistres ouverts', value: cl.declares + cl.en_instruction + cl.en_expertise, icon: 'alert-triangle', color: '#F59E0B' },
                    { label: 'Souscriptions', value: ps.total_souscriptions, icon: 'users', color: '#8B5CF6' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            {pol.a_renouveler > 0 && (
                <TouchableOpacity style={s.alertBanner} onPress={() => setActiveTab('policies')}>
                    <SafeIcon name="alert-circle" size={18} color="#D97706" />
                    <Text style={s.alertText}>{pol.a_renouveler} police(s) à renouveler</Text>
                    <SafeIcon name="chevron-right" size={16} color="#D97706" />
                </TouchableOpacity>
            )}

            {cl.declares > 0 && (
                <TouchableOpacity style={[s.alertBanner, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]} onPress={() => setActiveTab('claims')}>
                    <SafeIcon name="alert-triangle" size={18} color="#DC2626" />
                    <Text style={[s.alertText, { color: '#DC2626' }]}>{cl.declares} sinistre(s) en attente de traitement</Text>
                    <SafeIcon name="chevron-right" size={16} color="#DC2626" />
                </TouchableOpacity>
            )}

            <Text style={s.sectionTitle}>Actions rapides</Text>
            <View style={s.quickRow}>
                {[
                    { label: t('assuranceDashboard.nouveauProduit'), icon: 'plus-circle', color: '#6366F1', onPress: () => setShowProductModal(true) },
                    { label: t('assuranceDashboard.emettrePolice'), icon: 'file-plus', color: '#10B981', onPress: () => setActiveTab('policies') },
                    { label: 'Sinistres', icon: 'alert-triangle', color: '#F59E0B', onPress: () => setActiveTab('claims') },
                    { label: 'Devis IA', icon: 'cpu', color: '#7C3AED', onPress: () => (navigation as any).navigate('InsuranceQuoteRequest') },
                    { label: 'Portefeuille', icon: 'wallet', color: '#10B981', onPress: () => (navigation as any).navigate('WalletFinancial') },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}>
                            <SafeIcon name={a.icon as any} size={22} color={a.color} />
                        </View>
                        <Text style={s.quickLabel} numberOfLines={2}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {claims.length > 0 && (
                <>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionTitle}>Derniers sinistres</Text>
                        <TouchableOpacity onPress={() => setActiveTab('claims')}><Text style={s.seeAll}>Tout voir</Text></TouchableOpacity>
                    </View>
                    {claims.slice(0, 3).map((c, i) => (
                        <View key={i} style={s.claimCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.claimNum}>{c.numero_sinistre}</Text>
                                <Text style={s.claimDetail}>{c.type_sinistre} - {c.nom_produit || ''}</Text>
                                <Text style={s.claimDate}>{c.date_sinistre}</Text>
                            </View>
                            {renderStatusBadge(c.statut, CLAIM_STATUS_LABELS)}
                        </View>
                    ))}
                </>
            )}

            {policies.length > 0 && (
                <>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionTitle}>{t('assuranceDashboard.dernieresPolices')}</Text>
                        <TouchableOpacity onPress={() => setActiveTab('policies')}><Text style={s.seeAll}>Tout voir</Text></TouchableOpacity>
                    </View>
                    {policies.slice(0, 3).map((p, i) => (
                        <View key={i} style={s.policyCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.policyNum}>{p.numero_police}</Text>
                                <Text style={s.policyDetail}>{p.client_nom} {p.client_prenom || ''} - {p.nom_produit || ''}</Text>
                            </View>
                            {renderStatusBadge(p.statut, POLICY_STATUS_LABELS)}
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    );

    // ═══════ PRODUCTS ═══════
    const renderProducts = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <TouchableOpacity style={s.addBtn} onPress={() => setShowProductModal(true)}>
                <SafeIcon name="plus-circle" size={20} color="#fff" />
                <Text style={s.addBtnText}>{t('assuranceDashboard.ajouterUnProduitDassurance')}</Text>
            </TouchableOpacity>

            {products.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="package" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{t('assuranceDashboard.aucunProduitDassurance')}</Text>
                    <Text style={s.emptyText}>{t('assuranceDashboard.creezVosProduitsPourQue')}</Text>
                </View>
            ) : (
                products.map((p) => (
                    <View key={p.id} style={s.productCard}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={s.productName}>{p.nom_produit}</Text>
                                {p.is_featured && <View style={s.featuredBadge}><Text style={s.featuredText}>Vedette</Text></View>}
                            </View>
                            <Text style={s.productType}>{p.type_assurance?.toUpperCase()} - {p.sous_categorie}</Text>
                            {p.compagnie && <Text style={s.productCompany}>{p.compagnie}</Text>}
                            <View style={s.productPriceRow}>
                                {p.prime_mensuelle && <Text style={s.productPrice}>{parseFloat(p.prime_mensuelle).toLocaleString()} {devise}/mois</Text>}
                                {p.prime_annuelle && <Text style={s.productPrice}>{parseFloat(p.prime_annuelle).toLocaleString()} {devise}/an</Text>}
                            </View>
                            {p.couverture_max && <Text style={s.productCoverage}>Couverture max: {parseFloat(p.couverture_max).toLocaleString()} {devise}</Text>}
                            <View style={s.productMeta}>
                                <Text style={s.productMetaText}>{p.souscriptions_count} souscription(s)</Text>
                                {p.note_moyenne && <Text style={s.productMetaText}>Note: {p.note_moyenne}/5</Text>}
                            </View>
                            {p.garanties && Array.isArray(p.garanties) && p.garanties.length > 0 && (
                                <View style={s.tagRow}>
                                    {(p.garanties as string[]).slice(0, 3).map((g, j) => (
                                        <View key={j} style={s.tag}><Text style={s.tagText}>{g}</Text></View>
                                    ))}
                                    {p.garanties.length > 3 && <Text style={s.tagMore}>+{p.garanties.length - 3}</Text>}
                                </View>
                            )}
                        </View>
                        <View style={{ alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity onPress={() => handleToggleProduct(p.id)} style={[s.toggleBtn, { backgroundColor: p.is_active ? '#D1FAE5' : '#FEE2E2' }]}>
                                <SafeIcon name={p.is_active ? 'toggle-right' : 'toggle-left'} size={20} color={p.is_active ? '#059669' : '#DC2626'} />
                            </TouchableOpacity>
                            <Text style={{ fontSize: 10, color: p.is_active ? '#059669' : '#DC2626' }}>{p.is_active ? 'Actif' : 'Inactif'}</Text>
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );

    // ═══════ POLICIES ═══════
    const renderPolicies = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {policies.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="file-text" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{t('assuranceDashboard.aucunePoliceEmise')}</Text>
                    <Text style={s.emptyText}>{t('assuranceDashboard.lesPolicesEmisesAVos')}</Text>
                </View>
            ) : (
                policies.map((p) => (
                    <View key={p.id} style={s.policyCardFull}>
                        <View style={s.policyHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.policyNum}>{p.numero_police}</Text>
                                <Text style={s.policyClient}>{p.client_nom} {p.client_prenom || ''}</Text>
                            </View>
                            {renderStatusBadge(p.statut, POLICY_STATUS_LABELS)}
                        </View>
                        <View style={s.policyBody}>
                            <Text style={s.policyInfo}>Produit: {p.nom_produit || 'N/A'} ({p.type_assurance})</Text>
                            {p.client_telephone && <Text style={s.policyInfo}>{t('assuranceDashboardScreen.phone')}: {p.client_telephone}</Text>}
                            <View style={s.policyDatesRow}>
                                <Text style={s.policyDate}>Du {p.date_effet || '?'}</Text>
                                <Text style={s.policyDate}>Au {p.date_expiration || '?'}</Text>
                            </View>
                            {p.prime_totale && <Text style={s.policyPrime}>Prime: {parseFloat(p.prime_totale).toLocaleString()} {devise}</Text>}
                        </View>
                        {p.statut === 'active' && (
                            <View style={s.policyActions}>
                                <TouchableOpacity style={s.policyActionBtn} onPress={() => {
                                    Alert.alert(t('assuranceDashboard.suspend'), t('assuranceDashboard.confirmSuspend'), [
                                        { text: t('common.no') },
                                        { text: t('common.yes'), onPress: async () => { await assuranceService.updatePolicyStatus(p.id, 'suspendue'); loadData(); } },
                                    ]);
                                }}>
                                    <Text style={[s.policyActionText, { color: '#D97706' }]}>Suspendre</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.policyActionBtn} onPress={() => {
                                    Alert.alert(t('assuranceDashboard.terminate'), t('assuranceDashboard.confirmTerminate'), [
                                        { text: t('common.no') },
                                        { text: t('common.yes'), style: 'destructive', onPress: async () => { await assuranceService.updatePolicyStatus(p.id, 'resiliee', 'Résiliation par l\'assureur'); loadData(); } },
                                    ]);
                                }}>
                                    <Text style={[s.policyActionText, { color: '#DC2626' }]}>{t('assuranceDashboard.resilier')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ))
            )}
        </ScrollView>
    );

    // ═══════ CLAIMS ═══════
    const renderClaims = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {claims.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="alert-triangle" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{t('assuranceDashboard.aucunSinistre')}</Text>
                    <Text style={s.emptyText}>{t('assuranceDashboard.lesDeclarationsDeSinistresDe')}</Text>
                </View>
            ) : (
                claims.map((c) => (
                    <View key={c.id} style={s.claimCardFull}>
                        <View style={s.claimHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.claimNum}>{c.numero_sinistre}</Text>
                                <Text style={s.claimType}>{c.type_sinistre}</Text>
                            </View>
                            {renderStatusBadge(c.statut, CLAIM_STATUS_LABELS)}
                        </View>
                        <View style={s.claimBody}>
                            <Text style={s.claimInfo}>Police: {c.numero_police || 'N/A'} - {c.nom_produit || ''}</Text>
                            <Text style={s.claimInfo}>Date sinistre: {c.date_sinistre || 'N/A'}</Text>
                            {c.lieu_sinistre && <Text style={s.claimInfo}>Lieu: {c.lieu_sinistre}</Text>}
                            {c.description_sinistre && <Text style={s.claimDesc} numberOfLines={2}>{c.description_sinistre}</Text>}
                            <View style={s.claimAmounts}>
                                {c.dommages_estimes && <Text style={s.claimAmount}>Dommages: {parseFloat(c.dommages_estimes).toLocaleString()} {devise}</Text>}
                                {c.montant_reclame && <Text style={s.claimAmount}>{t('assuranceDashboardScreen.claimed')}: {parseFloat(c.montant_reclame).toLocaleString()} {devise}</Text>}
                                {c.montant_indemnise && <Text style={[s.claimAmount, { color: '#059669', fontWeight: '700' }]}>{t('assuranceDashboardScreen.indemnise')} {parseFloat(c.montant_indemnise).toLocaleString()} {devise}</Text>}
                            </View>
                            {c.fraud_score && (
                                <View style={s.fraudRow}>
                                    <SafeIcon name="shield" size={14} color={parseFloat(c.fraud_score) > 0.5 ? '#DC2626' : '#059669'} />
                                    <Text style={[s.fraudText, { color: parseFloat(c.fraud_score) > 0.5 ? '#DC2626' : '#059669' }]}>
                                        Score fraude: {(parseFloat(c.fraud_score) * 100).toFixed(0)}%
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={s.claimActions}>
                            <TouchableOpacity style={s.claimActionBtn} onPress={() => handleClaimAction(c, 'ai_analyze')}>
                                <SafeIcon name="cpu" size={14} color="#7C3AED" />
                                <Text style={[s.claimActionText, { color: '#7C3AED' }]}>Analyse IA</Text>
                            </TouchableOpacity>
                            {c.statut === 'declare' && (
                                <TouchableOpacity style={s.claimActionBtn} onPress={() => handleClaimAction(c, 'instruire')}>
                                    <SafeIcon name="play" size={14} color="#2563EB" />
                                    <Text style={[s.claimActionText, { color: '#2563EB' }]}>Instruire</Text>
                                </TouchableOpacity>
                            )}
                            {(c.statut === 'en_cours_instruction' || c.statut === 'expertise_en_cours') && (
                                <>
                                    <TouchableOpacity style={s.claimActionBtn} onPress={() => handleClaimAction(c, 'approuver')}>
                                        <SafeIcon name="check" size={14} color="#059669" />
                                        <Text style={[s.claimActionText, { color: '#059669' }]}>Approuver</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={s.claimActionBtn} onPress={() => handleClaimAction(c, 'refuser')}>
                                        <SafeIcon name="x" size={14} color="#DC2626" />
                                        <Text style={[s.claimActionText, { color: '#DC2626' }]}>Refuser</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            {c.statut === 'approuve' && (
                                <TouchableOpacity style={s.claimActionBtn} onPress={() => handleClaimAction(c, 'indemniser')}>
                                    <SafeIcon name="dollar-sign" size={14} color="#059669" />
                                    <Text style={[s.claimActionText, { color: '#059669' }]}>Indemniser</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );

    // ═══════ ANALYTICS ═══════
    const renderAnalytics = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.analyticsCard}>
                <Text style={s.analyticsTitle}>Portefeuille produits</Text>
                {[
                    { label: t('assuranceDashboard.totalProduits'), value: ps.total, color: '#3B82F6' },
                    { label: t('assuranceDashboard.produitsActifs'), value: ps.actifs, color: '#10B981' },
                    { label: 'Souscriptions totales', value: ps.total_souscriptions, color: '#8B5CF6' },
                ].map((item, i) => (
                    <View key={i} style={s.analyticsRow}>
                        <View style={[s.analyticsDot, { backgroundColor: item.color }]} />
                        <Text style={s.analyticsLabel}>{item.label}</Text>
                        <Text style={[s.analyticsValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                ))}
            </View>

            <View style={[s.analyticsCard, { marginTop: 12 }]}>
                <Text style={s.analyticsTitle}>Polices</Text>
                {[
                    { label: 'Polices actives', value: pol.actives, color: '#10B981' },
                    { label: 'Suspendues', value: pol.suspendues, color: '#D97706' },
                    { label: t('assuranceDashboard.expirees'), value: pol.expirees, color: '#6B7280' },
                    { label: t('assuranceDashboard.aRenouveler'), value: pol.a_renouveler, color: '#DC2626' },
                ].map((item, i) => (
                    <View key={i} style={s.analyticsRow}>
                        <View style={[s.analyticsDot, { backgroundColor: item.color }]} />
                        <Text style={s.analyticsLabel}>{item.label}</Text>
                        <Text style={[s.analyticsValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                ))}
                {dashStats?.policies?.ca_total && (
                    <View style={s.caRow}>
                        <Text style={s.caLabel}>Chiffre d'affaires total</Text>
                        <Text style={s.caValue}>{parseFloat(dashStats.policies.ca_total).toLocaleString()} {devise}</Text>
                    </View>
                )}
            </View>

            <View style={[s.analyticsCard, { marginTop: 12 }]}>
                <Text style={s.analyticsTitle}>Sinistres</Text>
                {[
                    { label: t('assuranceDashboard.declaresEnAttente'), value: cl.declares, color: '#D97706' },
                    { label: 'En instruction', value: cl.en_instruction, color: '#2563EB' },
                    { label: 'En expertise', value: cl.en_expertise, color: '#7C3AED' },
                    { label: t('assuranceDashboard.approuves'), value: cl.approuves, color: '#059669' },
                    { label: t('assuranceDashboard.indemnises'), value: cl.indemnises, color: '#10B981' },
                    { label: t('assuranceDashboard.refuses'), value: cl.refuses, color: '#DC2626' },
                ].map((item, i) => (
                    <View key={i} style={s.analyticsRow}>
                        <View style={[s.analyticsDot, { backgroundColor: item.color }]} />
                        <Text style={s.analyticsLabel}>{item.label}</Text>
                        <Text style={[s.analyticsValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                ))}
                {(dashStats?.claims?.total_reclame || dashStats?.claims?.total_indemnise) && (
                    <View style={s.claimTotals}>
                        {dashStats.claims.total_reclame && <Text style={s.claimTotalText}>{t('assuranceDashboardScreen.totalReclame')} {parseFloat(dashStats.claims.total_reclame).toLocaleString()} {devise}</Text>}
                        {dashStats.claims.total_indemnise && <Text style={[s.claimTotalText, { color: '#059669' }]}>{t('assuranceDashboardScreen.totalIndemnise')} {parseFloat(dashStats.claims.total_indemnise).toLocaleString()} {devise}</Text>}
                    </View>
                )}
            </View>
        </ScrollView>
    );

    // ═══════ PRODUCT CREATION MODAL ═══════
    const renderProductModal = () => (
        <Modal visible={showProductModal} animationType="slide" transparent>
            <View style={s.modalOverlay}>
                <View style={s.modalContent}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>{t('assuranceDashboard.nouveauProduitDassurance')}</Text>
                        <TouchableOpacity onPress={() => setShowProductModal(false)}>
                            <SafeIcon name="x" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                        <Text style={s.fieldLabel}>{t('assuranceDashboard.nomDuProduit')}/Text>
                        <TextInput style={s.input} placeholder="Ex: Assurance Auto Tous Risques" value={newProduct.nom_produit || ''} onChangeText={v => setNewProduct(p => ({ ...p, nom_produit: v }))} />

                        <Text style={s.fieldLabel}>{t('assuranceDashboard.typeDassurance')}/Text>
                        <View style={s.typeSelector}>
                            {TYPES_ASSURANCE.map(t => (
                                <TouchableOpacity key={t.key}
                                    style={[s.typeSelectorItem, newProduct.type_assurance === t.key && { backgroundColor: t.color + '20', borderColor: t.color }]}
                                    onPress={() => setNewProduct(p => ({ ...p, type_assurance: t.key, sous_categorie: SOUS_CATEGORIES[t.key]?.[0] || '' }))}>
                                    <Text style={[s.typeSelectorText, newProduct.type_assurance === t.key && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={s.fieldLabel}>{t('assuranceDashboard.souscategorie')}</Text>
                        <View style={s.typeSelector}>
                            {(SOUS_CATEGORIES[newProduct.type_assurance || 'auto'] || []).map(sc => (
                                <TouchableOpacity key={sc}
                                    style={[s.typeSelectorItem, newProduct.sous_categorie === sc && { backgroundColor: '#6366F120', borderColor: '#6366F1' }]}
                                    onPress={() => setNewProduct(p => ({ ...p, sous_categorie: sc }))}>
                                    <Text style={[s.typeSelectorText, newProduct.sous_categorie === sc && { color: '#6366F1', fontWeight: '700' }]}>{sc}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={s.fieldLabel}>Compagnie</Text>
                        <TextInput style={s.input} placeholder={t('assuranceDashboard.nomDeLaCompagnie')} value={newProduct.compagnie || ''} onChangeText={v => setNewProduct(p => ({ ...p, compagnie: v }))} />

                        <Text style={s.fieldLabel}>Description</Text>
                        <TextInput style={[s.input, { height: 80 }]} placeholder={t('assuranceDashboardScreen.descriptionDuProduit')} multiline value={newProduct.description || ''} onChangeText={v => setNewProduct(p => ({ ...p, description: v }))} />

                        <View style={s.fieldRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.fieldLabel}>Prime mensuelle ({devise})</Text>
                                <TextInput style={s.input} placeholder="0" keyboardType="numeric" value={newProduct.prime_mensuelle?.toString() || ''} onChangeText={v => setNewProduct(p => ({ ...p, prime_mensuelle: v ? parseFloat(v) : undefined }))} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={s.fieldLabel}>Prime annuelle ({devise})</Text>
                                <TextInput style={s.input} placeholder="0" keyboardType="numeric" value={newProduct.prime_annuelle?.toString() || ''} onChangeText={v => setNewProduct(p => ({ ...p, prime_annuelle: v ? parseFloat(v) : undefined }))} />
                            </View>
                        </View>

                        <View style={s.fieldRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.fieldLabel}>Couverture max ({devise})</Text>
                                <TextInput style={s.input} placeholder="0" keyboardType="numeric" value={newProduct.couverture_max?.toString() || ''} onChangeText={v => setNewProduct(p => ({ ...p, couverture_max: v ? parseFloat(v) : undefined }))} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={s.fieldLabel}>Franchise ({devise})</Text>
                                <TextInput style={s.input} placeholder="0" keyboardType="numeric" value={newProduct.franchise_montant?.toString() || ''} onChangeText={v => setNewProduct(p => ({ ...p, franchise_montant: v ? parseFloat(v) : undefined }))} />
                            </View>
                        </View>

                        <View style={s.fieldRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.fieldLabel}>{t('assuranceDashboard.ageMin')}</Text>
                                <TextInput style={s.input} placeholder="18" keyboardType="numeric" value={newProduct.age_min?.toString() || ''} onChangeText={v => setNewProduct(p => ({ ...p, age_min: v ? parseInt(v) : undefined }))} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={s.fieldLabel}>{t('assuranceDashboard.ageMax')}</Text>
                                <TextInput style={s.input} placeholder="70" keyboardType="numeric" value={newProduct.age_max?.toString() || ''} onChangeText={v => setNewProduct(p => ({ ...p, age_max: v ? parseInt(v) : undefined }))} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={s.fieldLabel}>{t('assuranceDashboard.dureeMois')}</Text>
                                <TextInput style={s.input} placeholder="12" keyboardType="numeric" value={newProduct.duree_contrat_mois?.toString() || ''} onChangeText={v => setNewProduct(p => ({ ...p, duree_contrat_mois: v ? parseInt(v) : undefined }))} />
                            </View>
                        </View>
                    </ScrollView>
                    <TouchableOpacity style={s.createBtn} onPress={handleCreateProduct} disabled={actionLoading}>
                        {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.createBtnText}>{t('assuranceDashboard.creerLeProduit')}</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={s.container}>
            <LinearGradient colors={['#6366F1', '#4F46E5']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>{t('assuranceDashboard.dashboardAssurance')}/Text>
                        <Text style={s.headerSub}>{user?.name || t('assuranceDashboard.partenaire')}</Text>
                    </View>
                    <TouchableOpacity onPress={() => (navigation as any).navigate('InsuranceServicesSearch')} style={s.backBtn}>
                        <SafeIcon name="search" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
                    {TABS.map(t => (
                        <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabActive]} onPress={() => setActiveTab(t.key)}>
                            <SafeIcon name={t.icon as any} size={14} color={activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.6)'} />
                            <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </LinearGradient>
            <View style={s.content}>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'products' && renderProducts()}
                {activeTab === 'policies' && renderPolicies()}
                {activeTab === 'claims' && renderClaims()}
                {activeTab === 'analytics' && renderAnalytics()}
            </View>
            {renderProductModal()}
            {actionLoading && (
                <View style={s.loadingOverlay}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={s.loadingOverlayText}>Traitement en cours...</Text>
                </View>
            )}
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
    tabRow: { flexDirection: 'row' },
    tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, gap: 4, marginRight: 4 },
    tabActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
    tabLabelActive: { color: '#fff' },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 1 },
    statValue: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginTop: 6 },
    statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
    alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#FDE68A', gap: 8 },
    alertText: { flex: 1, fontSize: 13, color: '#D97706', fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 16, marginBottom: 8 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
    seeAll: { color: '#6366F1', fontSize: 13, fontWeight: '600' },
    quickRow: { flexDirection: 'row', gap: 10 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: '600' },
    // Products
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366F1', borderRadius: 12, padding: 14, gap: 8, marginBottom: 16 },
    addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    productCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    productName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
    productType: { fontSize: 11, color: '#6366F1', fontWeight: '600', marginTop: 2 },
    productCompany: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    productPriceRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    productPrice: { fontSize: 13, color: '#059669', fontWeight: '600' },
    productCoverage: { fontSize: 11, color: '#6B7280', marginTop: 2 },
    productMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
    productMetaText: { fontSize: 10, color: '#9CA3AF' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
    tag: { backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    tagText: { fontSize: 10, color: '#6366F1' },
    tagMore: { fontSize: 10, color: '#6B7280', alignSelf: 'center' },
    featuredBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    featuredText: { fontSize: 9, color: '#D97706', fontWeight: '700' },
    toggleBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    // Policies
    policyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    policyCardFull: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, elevation: 1, overflow: 'hidden' },
    policyHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    policyNum: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
    policyClient: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginTop: 2 },
    policyBody: { padding: 14 },
    policyInfo: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    policyDatesRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
    policyDate: { fontSize: 11, color: '#9CA3AF' },
    policyPrime: { fontSize: 14, fontWeight: '700', color: '#059669', marginTop: 6 },
    policyDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    policyActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    policyActionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    policyActionText: { fontSize: 12, fontWeight: '600' },
    // Claims
    claimCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    claimCardFull: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, elevation: 1, overflow: 'hidden' },
    claimHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    claimNum: { fontSize: 13, fontWeight: '700', color: '#D97706' },
    claimType: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginTop: 2 },
    claimBody: { padding: 14 },
    claimInfo: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    claimDesc: { fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' },
    claimDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    claimDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    claimAmounts: { marginTop: 6, gap: 2 },
    claimAmount: { fontSize: 12, color: '#374151' },
    fraudRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    fraudText: { fontSize: 12, fontWeight: '600' },
    claimActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6', flexWrap: 'wrap' },
    claimActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 14 },
    claimActionText: { fontSize: 12, fontWeight: '600' },
    // Analytics
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1 },
    analyticsTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
    analyticsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    analyticsLabel: { flex: 1, fontSize: 13, color: '#374151' },
    analyticsValue: { fontSize: 18, fontWeight: '700' },
    caRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    caLabel: { fontSize: 13, color: '#6B7280' },
    caValue: { fontSize: 20, fontWeight: '700', color: '#059669', marginTop: 4 },
    claimTotals: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 4 },
    claimTotalText: { fontSize: 13, color: '#374151', fontWeight: '600' },
    // Empty
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 4 },
    fieldRow: { flexDirection: 'row' },
    input: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, fontSize: 14, color: '#1F2937' },
    typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeSelectorItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
    typeSelectorText: { fontSize: 12, color: '#6B7280' },
    createBtn: { backgroundColor: '#6366F1', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
    createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    // Loading overlay
    loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    loadingOverlayText: { color: '#fff', fontSize: 14, marginTop: 10, fontWeight: '600' },
});

export default AssuranceDashboardScreen;
