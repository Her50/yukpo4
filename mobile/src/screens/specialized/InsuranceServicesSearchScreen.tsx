/**
 * Écran public Assurance — entrée depuis l’accueil (service spécialisé).
 * Aligné backend : recherche catalogue GET /api/assurance/search, parcours IA / devis, accès client polices & sinistres.
 */
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import assuranceService, { InsuranceResult } from '../../services/assuranceService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface SearchFilters {
    type_assurance?: string;
    compagnie?: string;
    ville?: string;
    quartier?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
    prix_min?: number;
    prix_max?: number;
}

const TYPES: { id: string; icon: string }[] = [
    { id: 'Auto', icon: 'car' },
    { id: 'Santé', icon: 'heart-pulse' },
    { id: 'Habitation', icon: 'home' },
    { id: 'Vie', icon: 'users' },
    { id: 'Voyage', icon: 'plane' },
    { id: 'Professionnelle', icon: 'briefcase' },
    { id: 'Responsabilité civile', icon: 'scale' },
];

const COMPAGNIE_SUGGESTIONS = ['AXA', 'Allianz', 'Sanlam', 'NSIA', 'Activa', 'GAT', 'Zenith', 'AAR'];

const InsuranceServicesSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { location } = useLocation();

    const [typeAssurance, setTypeAssurance] = useState('');
    const [compagnie, setCompagnie] = useState('');
    const [ville, setVille] = useState<LocationObject | string>('');
    const [quartier, setQuartier] = useState<LocationObject | string>('');
    const [gpsString, setGpsString] = useState('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [rayonKm, setRayonKm] = useState(15);
    const [prixMin, setPrixMin] = useState('');
    const [prixMax, setPrixMax] = useState('');
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [preview, setPreview] = useState<InsuranceResult[]>([]);
    const [previewLoading, setPreviewLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    React.useEffect(() => {
        if (location?.coords) {
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setGpsString(`${lat},${lng}`);
            setGpsData({ lat, lng });
        }
    }, [location]);

    const loadPreview = useCallback(async () => {
        try {
            setPreviewLoading(true);
            const rows = await assuranceService.searchInsurance({ limit: 12, offset: 0 });
            setPreview(Array.isArray(rows) ? rows : []);
        } catch {
            setPreview([]);
        } finally {
            setPreviewLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadPreview();
        }, [loadPreview]),
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadPreview();
    };

    const buildFilters = (): SearchFilters => {
        const filters: SearchFilters = {};
        if (typeAssurance.trim()) filters.type_assurance = typeAssurance.trim();
        if (compagnie.trim()) filters.compagnie = compagnie.trim();
        const villeStr =
            typeof ville === 'string'
                ? ville
                : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
        const quartierStr =
            typeof quartier === 'string'
                ? quartier
                : (quartier as LocationObject)?.components?.quartier || (quartier as LocationObject)?.place_name || '';
        if (villeStr.trim()) filters.ville = villeStr.trim();
        if (quartierStr.trim()) filters.quartier = quartierStr.trim();
        if (gpsData) {
            filters.gps_lat = gpsData.lat;
            filters.gps_lon = gpsData.lng;
            filters.rayon_km = rayonKm;
        }
        if (prixMin.trim()) filters.prix_min = parseFloat(prixMin);
        if (prixMax.trim()) filters.prix_max = parseFloat(prixMax);
        return filters;
    };

    const handleSearch = () => {
        hapticPress();
        setLoadingSearch(true);
        try {
            navigation.navigate('InsuranceServicesResults' as never, { filters: buildFilters() } as never);
        } finally {
            setLoadingSearch(false);
        }
    };

    const handleRequestQuote = () => {
        hapticPress();
        navigation.navigate('InsuranceQuoteRequest' as never, {
            typeAssurance,
            compagnie,
            ville,
            quartier,
        } as never);
    };

    const handleGPSSelect = (coordinates: string) => {
        setGpsString(coordinates);
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setGpsData({ lat, lng });
        }
        setShowGPSModal(false);
    };

    const goMesPolices = () => {
        hapticPress();
        navigation.navigate('MesPolicesAssurance' as never);
    };

    const goSuiviSinistres = () => {
        hapticPress();
        navigation.navigate('SuiviSinistre' as never);
    };

    const formatPreviewPrice = (p?: number) => {
        if (p == null || Number.isNaN(p)) return t('insurancePublic.surDevis', 'Sur devis');
        return `${Math.round(p).toLocaleString('fr-FR')} FCFA`;
    };

    const renderPreviewCard = ({ item }: { item: InsuranceResult }) => (
        <TouchableOpacity
            style={styles.previewCard}
            activeOpacity={0.85}
            onPress={() => {
                hapticPress();
                const f: SearchFilters = {};
                if (item.type_assurance) f.type_assurance = item.type_assurance;
                navigation.navigate('InsuranceServicesResults' as never, { filters: f } as never);
            }}
        >
            <View style={styles.previewIconWrap}>
                <SafeIcon name="shield-check" size={22} color="#4F46E5" type="lucide" />
            </View>
            <Text style={styles.previewTitle} numberOfLines={2}>
                {item.titre || t('insurancePublic.produitAssurance', 'Produit assurance')}
            </Text>
            {item.type_assurance ? (
                <Text style={styles.previewMeta} numberOfLines={1}>
                    {item.type_assurance}
                </Text>
            ) : null}
            <Text style={styles.previewPrice}>{formatPreviewPrice(item.prix)}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[modernColors.primary]} />
                }
            >
                <LinearGradient colors={['#0F172A', '#312E81', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                    <View style={styles.heroTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <SafeIcon name="arrow-left" size={22} color="#F8FAFC" type="lucide" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.heroTitle}>{t('insurancePublic.title', 'Assurance')}</Text>
                    <Text style={styles.heroSubtitle}>
                        {t(
                            'insurancePublic.subtitle',
                            'Comparez les offres des partenaires Yukpo, obtenez un devis intelligent et pilotez vos contrats.',
                        )}
                    </Text>
                </LinearGradient>

                <View style={styles.body}>
                    {/* Actions principales — parcours métier */}
                    <Text style={styles.sectionLabel}>{t('insurancePublic.sectionActions', 'Que souhaitez-vous faire ?')}</Text>
                    <View style={styles.actionGrid}>
                        <TouchableOpacity style={styles.actionCellPrimary} onPress={handleSearch} activeOpacity={0.9}>
                            <SafeIcon name="search" size={22} color="#FFFFFF" type="lucide" />
                            <Text style={styles.actionCellTitle}>{t('insurancePublic.actionCatalog', 'Parcourir le catalogue')}</Text>
                            <Text style={styles.actionCellHint}>{t('insurancePublic.actionCatalogHint', 'Recherche et filtres')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionCellAccent} onPress={handleRequestQuote} activeOpacity={0.9}>
                            <SafeIcon name="sparkles" size={22} color="#312E81" type="lucide" />
                            <Text style={[styles.actionCellTitle, styles.actionCellTitleDark]}>
                                {t('insurancePublic.actionQuote', 'Devis intelligent')}
                            </Text>
                            <Text style={styles.actionCellHintDark}>{t('insurancePublic.actionQuoteHint', 'Estimation IA')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionCellNeutral} onPress={goMesPolices} activeOpacity={0.85}>
                            <SafeIcon name="file-text" size={20} color="#475569" type="lucide" />
                            <Text style={styles.actionCellTitleDark}>{t('insurancePublic.actionPolicies', 'Mes polices')}</Text>
                            <Text style={styles.actionCellHintDark}>{t('insurancePublic.actionPoliciesHint', 'Contrats souscrits')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionCellNeutral} onPress={goSuiviSinistres} activeOpacity={0.85}>
                            <SafeIcon name="clipboard-list" size={20} color="#475569" type="lucide" />
                            <Text style={styles.actionCellTitleDark}>{t('insurancePublic.actionClaims', 'Suivi sinistres')}</Text>
                            <Text style={styles.actionCellHintDark}>{t('insurancePublic.actionClaimsHint', 'Dossiers en cours')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Types */}
                    <Text style={styles.sectionLabel}>{t('insurancePublic.sectionTypes', "Type d'assurance")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typesRow}>
                        {TYPES.map((row) => (
                            <TouchableOpacity
                                key={row.id}
                                style={[styles.typeChip, typeAssurance === row.id && styles.typeChipOn]}
                                onPress={() => {
                                    hapticPress();
                                    setTypeAssurance((prev) => (prev === row.id ? '' : row.id));
                                }}
                            >
                                <SafeIcon
                                    name={row.icon}
                                    size={16}
                                    color={typeAssurance === row.id ? '#FFFFFF' : '#475569'}
                                    type="lucide"
                                />
                                <Text style={[styles.typeChipText, typeAssurance === row.id && styles.typeChipTextOn]}>{row.id}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Aperçu marché (API publique) */}
                    <View style={styles.previewHeader}>
                        <Text style={styles.sectionLabel}>{t('insurancePublic.sectionPreview', 'Aperçu du marché')}</Text>
                        {previewLoading ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        ) : (
                            <Text style={styles.previewCount}>{preview.length}</Text>
                        )}
                    </View>
                    {previewLoading ? (
                        <View style={styles.previewSkeleton}>
                            <Text style={styles.skeletonText}>{t('insurancePublic.loadingOffers', 'Chargement des offres…')}</Text>
                        </View>
                    ) : preview.length === 0 ? (
                        <View style={styles.emptyPreview}>
                            <SafeIcon name="inbox" size={28} color="#CBD5E1" type="lucide" />
                            <Text style={styles.emptyPreviewText}>
                                {t('insurancePublic.noPreview', 'Aucune offre listée pour le moment. Utilisez la recherche ou le devis IA.')}
                            </Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewList}>
                            {preview.map((item) => (
                                <View key={String(item.id)}>{renderPreviewCard({ item })}</View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Filtres — carte unique */}
                    <View style={styles.card}>
                        <View style={styles.cardHead}>
                            <Text style={styles.cardTitle}>{t('insurancePublic.refineTitle', 'Affiner la recherche')}</Text>
                            <Text style={styles.cardSubtitle}>
                                {t('insurancePublic.refineSubtitle', 'Optionnel — précisez compagnie, zone et budget.')}
                            </Text>
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>{t('insurancePublic.labelCompany', 'Compagnie')}</Text>
                            <NativeInput
                                value={compagnie}
                                onChangeText={setCompagnie}
                                placeholder={t('insurancePublic.placeholderCompany', 'Nom de la compagnie')}
                            />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggScroll}>
                                {COMPAGNIE_SUGGESTIONS.map((c) => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.miniChip, compagnie === c && styles.miniChipOn]}
                                        onPress={() => {
                                            hapticPress();
                                            setCompagnie(compagnie === c ? '' : c);
                                        }}
                                    >
                                        <Text style={[styles.miniChipTxt, compagnie === c && styles.miniChipTxtOn]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <TouchableOpacity style={styles.advancedToggle} onPress={() => setAdvancedOpen(!advancedOpen)} activeOpacity={0.7}>
                            <Text style={styles.advancedToggleText}>
                                {advancedOpen
                                    ? t('insurancePublic.hideAdvanced', 'Masquer localisation & budget')
                                    : t('insurancePublic.showAdvanced', 'Localisation, GPS et budget')}
                            </Text>
                            <SafeIcon name={advancedOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" type="lucide" />
                        </TouchableOpacity>

                        {advancedOpen && (
                            <>
                                <LocationSelector
                                    label={t('insurancePublic.labelCity', 'Ville')}
                                    value={typeof ville === 'string' ? (ville ? { raw: ville, place_name: ville } : '') : ville}
                                    onSelect={(loc: LocationObject) => setVille(loc)}
                                    placeholder={t('insurancePublic.phCity', 'Ville ou région')}
                                    scope="all"
                                    enrichWithBackend={true}
                                />
                                <View style={{ height: 12 }} />
                                <LocationSelector
                                    label={t('insurancePublic.labelDistrict', 'Quartier (optionnel)')}
                                    value={
                                        typeof quartier === 'string'
                                            ? quartier
                                                ? { raw: quartier, place_name: quartier }
                                                : ''
                                            : quartier
                                    }
                                    onSelect={(loc: LocationObject) => setQuartier(loc)}
                                    placeholder={t('insurancePublic.phDistrict', 'Quartier, rue…')}
                                    scope="all"
                                    cityContext={
                                        typeof ville === 'string'
                                            ? ville
                                            : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || ''
                                    }
                                    enrichWithBackend={true}
                                />

                                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{t('insurancePublic.labelGps', 'Position')}</Text>
                                <TouchableOpacity style={styles.gpsRow} onPress={() => { hapticPress(); setShowGPSModal(true); }}>
                                    <SafeIcon name="map-pin" size={18} color="#4F46E5" type="lucide" />
                                    <Text style={styles.gpsRowText} numberOfLines={1}>
                                        {gpsString || t('insurancePublic.useGps', 'Choisir sur la carte ou GPS')}
                                    </Text>
                                    <SafeIcon name="chevron-right" size={18} color="#94A3B8" type="lucide" />
                                </TouchableOpacity>

                                {gpsData && (
                                    <View style={styles.rayonRow}>
                                        <Text style={styles.fieldLabel}>{t('insurancePublic.radius', 'Rayon')}</Text>
                                        <View style={styles.rayonControls}>
                                            <TouchableOpacity
                                                style={styles.rayonBtn}
                                                onPress={() => {
                                                    hapticPress();
                                                    setRayonKm((r) => Math.max(5, r - 5));
                                                }}
                                            >
                                                <SafeIcon name="minus" size={16} color="#FFFFFF" type="lucide" />
                                            </TouchableOpacity>
                                            <Text style={styles.rayonVal}>
                                                {rayonKm} km
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.rayonBtn}
                                                onPress={() => {
                                                    hapticPress();
                                                    setRayonKm((r) => Math.min(200, r + 5));
                                                }}
                                            >
                                                <SafeIcon name="plus" size={16} color="#FFFFFF" type="lucide" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.priceRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.fieldLabel}>{t('insurancePublic.priceMin', 'Prime min. (FCFA/an)')}</Text>
                                        <NativeInput value={prixMin} onChangeText={setPrixMin} placeholder="0" keyboardType="numeric" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.fieldLabel}>{t('insurancePublic.priceMax', 'Prime max. (FCFA/an)')}</Text>
                                        <NativeInput value={prixMax} onChangeText={setPrixMax} placeholder="∞" keyboardType="numeric" />
                                    </View>
                                </View>
                            </>
                        )}

                        <View style={styles.ctaRow}>
                            <NativeButton onPress={handleSearch} disabled={loadingSearch} variant="secondary" style={styles.ctaHalf}>
                                <View style={styles.ctaInner}>
                                    <SafeIcon name="search" size={18} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.ctaTxtOutline}>{t('insurancePublic.ctaSearch', 'Rechercher')}</Text>
                                </View>
                            </NativeButton>
                            <NativeButton onPress={handleRequestQuote} style={styles.ctaHalf}>
                                <View style={styles.ctaInner}>
                                    <SafeIcon name="sparkles" size={18} color="#FFFFFF" type="lucide" />
                                    <Text style={styles.ctaTxtFill}>{t('insurancePublic.ctaQuote', 'Devis IA')}</Text>
                                </View>
                            </NativeButton>
                        </View>
                    </View>

                    <View style={styles.tipCard}>
                        <SafeIcon name="lightbulb" size={18} color="#CA8A04" type="lucide" />
                        <Text style={styles.tipText}>
                            {t(
                                'insurancePublic.tip',
                                'Les garanties et exclusions varient selon les produits. Un devis personnalisé permet d’ajuster la couverture à votre profil.',
                            )}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={gpsString as any} />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9',
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    hero: {
        paddingTop: 16,
        paddingHorizontal: 20,
        paddingBottom: 28,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    backBtn: {
        padding: 4,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#F8FAFC',
        letterSpacing: -0.5,
    },
    heroSubtitle: {
        marginTop: 8,
        fontSize: 15,
        lineHeight: 22,
        color: 'rgba(248, 250, 252, 0.88)',
        maxWidth: 360,
    },
    body: {
        paddingHorizontal: 16,
        marginTop: -12,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 10,
        marginTop: 4,
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    actionCellPrimary: {
        width: '48%',
        flexGrow: 1,
        minWidth: '45%',
        backgroundColor: '#4F46E5',
        borderRadius: 16,
        padding: 14,
        minHeight: 108,
    },
    actionCellAccent: {
        width: '48%',
        flexGrow: 1,
        minWidth: '45%',
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        minHeight: 108,
    },
    actionCellNeutral: {
        width: '48%',
        flexGrow: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        minHeight: 96,
    },
    actionCellTitle: {
        marginTop: 10,
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    actionCellTitleDark: {
        marginTop: 8,
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
    },
    actionCellHint: {
        marginTop: 4,
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
    },
    actionCellHintDark: {
        marginTop: 4,
        fontSize: 12,
        color: '#64748B',
    },
    typesRow: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 16,
    },
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    typeChipOn: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },
    typeChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    typeChipTextOn: {
        color: '#FFFFFF',
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    previewCount: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
    },
    previewList: {
        gap: 10,
        paddingBottom: 8,
    },
    previewCard: {
        width: 156,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginRight: 10,
    },
    previewIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        minHeight: 36,
    },
    previewMeta: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    previewPrice: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: '800',
        color: '#4F46E5',
    },
    previewSkeleton: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    skeletonText: {
        fontSize: 13,
        color: '#94A3B8',
    },
    emptyPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12,
    },
    emptyPreviewText: {
        flex: 1,
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 8,
        marginBottom: 16,
    },
    cardHead: {
        marginBottom: 14,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    cardSubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
    },
    fieldBlock: {
        marginBottom: 8,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8,
    },
    suggScroll: {
        marginTop: 10,
        marginBottom: 4,
    },
    miniChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F1F5F9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    miniChipOn: {
        backgroundColor: '#EEF2FF',
        borderColor: '#A5B4FC',
    },
    miniChipTxt: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    miniChipTxtOn: {
        color: '#4338CA',
    },
    advancedToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        marginTop: 4,
        marginBottom: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    advancedToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    gpsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    gpsRowText: {
        flex: 1,
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
    },
    rayonRow: {
        marginTop: 14,
    },
    rayonControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 8,
    },
    rayonBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rayonVal: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        minWidth: 72,
        textAlign: 'center',
    },
    priceRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 14,
    },
    ctaRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    ctaHalf: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
    },
    ctaInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 4,
    },
    ctaTxtOutline: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.primary,
    },
    ctaTxtFill: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#FFFBEB',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        color: '#854D0E',
        lineHeight: 19,
    },
});

export default InsuranceServicesSearchScreen;
