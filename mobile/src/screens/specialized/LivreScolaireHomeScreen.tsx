// ✅ Écran Bourse du Livre — en-tête (retour + titre + libraire), corps : liste à proximité + seul CTA « Vendre/Troquer » → BookUploadV2

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet } from '../../services/api';
import { bourseLivreV2Api } from '../../services/bourseLivreV2Api';
import { LivreScolaire, livreScolaireService, SearchLivresFilters } from '../../services/livreScolaireService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

/** Même logique métier que `getPartnerDashboardScreen` (libraire → LivreScolaireForm). */
const LIBRAIRE_PARTNER_TYPES = new Set(['librairie', 'libraire', 'livrescolaire', 'livre_scolaire']);

const LivreScolaireHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const { user } = useAuth();

    const isLibrairePartner = useMemo(() => {
        const pt = user?.partner_type?.toLowerCase();
        return pt ? LIBRAIRE_PARTNER_TYPES.has(pt) : false;
    }, [user?.partner_type]);

    const [livres, setLivres] = useState<LivreScolaire[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [opsLoading, setOpsLoading] = useState(false);
    const [opsStats, setOpsStats] = useState({
        achatsEnCours: 0,
        paquetsARecevoir: 0,
        paquetsAEnvoyer: 0,
        besoinsActifs: 0,
        trocsEnCours: 0,
    });

    // Charger les livres proches à l'ouverture
    useEffect(() => {
        loadNearbyBooks();
    }, []);

    useEffect(() => {
        loadOperationsDashboard();
    }, []);

    const loadNearbyBooks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const filters: SearchLivresFilters = {
                limit: 20,
                offset: 0,
            };

            // Ajouter GPS si disponible
            if (location?.coords) {
                filters.gps_lat = location.coords.latitude;
                filters.gps_lon = location.coords.longitude;
                filters.rayon_km = 20; // 20 km de rayon
            }

            const response = await livreScolaireService.searchLivres(filters);

            const r = response.data as any;
            if (response.success && r?.livres) {
                const livresData = r.livres.map((item: any) => ({
                    ...item.livre,
                    distance_km: item.distance_km,
                }));
                setLivres(livresData);
            } else {
                setError(t('livreScolaireHome.aucunLivreTrouveAProximite'));
                setLivres([]);
            }
        } catch (err: any) {
            console.error('[LivreScolaireHomeScreen] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement');
            setLivres([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [location, t]);

    const formatDistance = (distance?: number) => {
        if (!distance) return '';
        if (distance < 1) return `${Math.round(distance * 1000)}m`;
        return `${distance.toFixed(1)} km`;
    };

    const loadOperationsDashboard = useCallback(async () => {
        setOpsLoading(true);
        try {
            const [dashboard, requests, trocsResp] = await Promise.all([
                bourseLivreV2Api.getUserBookDashboard(),
                bourseLivreV2Api.getMyDonationRequests(),
                apiGet('/api/troc-livres/my-trocs'),
            ]);

            const besoinsActifs = (requests || []).filter((r: any) => r.statut !== 'livre' && r.statut !== 'annule').length;
            const trocsRaw = (trocsResp as any)?.data?.trocs || (trocsResp as any)?.trocs || [];
            const trocsEnCours = (trocsRaw || []).filter(
                (tr: any) => !['complete', 'refuse', 'annule'].includes(String(tr?.statut || '').toLowerCase())
            ).length;

            setOpsStats({
                achatsEnCours: dashboard?.achats_en_cours?.length || 0,
                paquetsARecevoir: dashboard?.paquets_a_recevoir?.length || 0,
                paquetsAEnvoyer: dashboard?.paquets_a_envoyer?.length || 0,
                besoinsActifs,
                trocsEnCours,
            });
        } catch (e) {
            console.warn('[LivreScolaireHomeScreen] dashboard ops error', e);
        } finally {
            setOpsLoading(false);
        }
    }, []);

    const safeNavigate = useCallback((routeName: string, params?: any) => {
        try {
            hapticPress();
            (navigation as any).navigate(routeName, params);
        } catch (err) {
            console.error(`[LivreScolaireHomeScreen] Navigation error to ${routeName}:`, err);
            Alert.alert(
                t('message.error'),
                t('livreScolaireHome.ecranMomentanementIndisponible', "Cet écran est momentanément indisponible.")
            );
        }
    }, [navigation, t]);

    const onLibraireHeaderPress = useCallback(() => {
        hapticPress();
        if (isLibrairePartner) {
            safeNavigate('LivreScolaireForm');
        } else {
            safeNavigate('LibrairieRegistration');
        }
    }, [isLibrairePartner, safeNavigate]);

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#D97706', '#F59E0B', '#FBBF24']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerTopRow}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {t('livreScolaireHome.bourseDuLivre')}
                        </Text>
                    </View>
                    <View style={styles.headerButtonsRow}>
                        <TouchableOpacity
                            onPress={onLibraireHeaderPress}
                            style={styles.libraireHeaderBtn}
                            activeOpacity={0.85}
                        >
                            <SafeIcon
                                name={isLibrairePartner ? 'layout-dashboard' : 'store'}
                                size={16}
                                color="#B45309"
                                type="lucide"
                            />
                            <Text style={styles.libraireHeaderBtnText} numberOfLines={1}>
                                {isLibrairePartner
                                    ? t('bourseLivre.maLibrairie', 'Ma librairie')
                                    : t('bourseLivre.devenirLibraire', 'Devenir libraire')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => safeNavigate('EtablissementScolaire')}
                            style={styles.etablissementHeaderBtn}
                            activeOpacity={0.85}
                        >
                            <SafeIcon
                                name="school"
                                size={16}
                                color="#059669"
                                type="lucide"
                            />
                            <Text style={styles.etablissementHeaderBtnText} numberOfLines={1}>
                                {t('bourseLivre.etablissementScolaire', 'Établissement scolaire')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>

            <View style={styles.primaryActionsRow}>
                <TouchableOpacity
                    style={[styles.primaryActionButton, styles.primaryActionSell]}
                    onPress={() => safeNavigate('BookUploadV2')}
                    activeOpacity={0.88}
                >
                    <View style={styles.primaryActionIconWrap}>
                        <SafeIcon name="camera" size={22} color="#047857" type="lucide" />
                    </View>
                    <View style={styles.primaryActionTextWrap}>
                        <Text style={[styles.primaryActionTitle, { color: '#047857' }]} numberOfLines={2}>
                            {t('livreScolaireHome.vendreTroquerTitle', 'Mettez vos livres en circulation')}
                        </Text>
                        <Text style={[styles.primaryActionSubtitle, { color: '#065F46' }]} numberOfLines={2}>
                            {t(
                                'livreScolaireHome.vendreTroquerSubtitle',
                                'Vente, troc ou don — précisez à l\'étape suivante'
                            )}
                        </Text>
                    </View>
                    <SafeIcon name="chevron-right" size={18} color="#047857" type="lucide" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryActionButton, styles.primaryActionBuy]}
                    onPress={() => safeNavigate('ProgrammeBesoinsSelector')}
                    activeOpacity={0.88}
                >
                    <View style={[styles.primaryActionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <SafeIcon name="book-check" size={22} color="#2563EB" type="lucide" />
                    </View>
                    <View style={styles.primaryActionTextWrap}>
                        <Text style={[styles.primaryActionTitle, { color: '#1E40AF' }]} numberOfLines={2}>
                            {t('livreScolaireHome.acheterLivresTitle', 'Trouvez votre liste scolaire')}
                        </Text>
                        <Text style={[styles.primaryActionSubtitle, { color: '#1E3A8A' }]} numberOfLines={2}>
                            {t('livreScolaireHome.acheterLivresSubtitle', 'Cochez vos besoins, arbitrez neuf / occasion')}
                        </Text>
                    </View>
                    <SafeIcon name="chevron-right" size={18} color="#2563EB" type="lucide" />
                </TouchableOpacity>
            </View>

            <View style={styles.dashboardSection}>
                <View style={styles.dashboardHeader}>
                    <Text style={styles.dashboardTitle}>
                        {t('livreScolaireHome.dashboardOps', 'Dashboard des operations')}
                    </Text>
                    <View style={styles.dashboardHeaderActions}>
                        <TouchableOpacity
                            style={styles.iconHeaderBtn}
                            onPress={() => safeNavigate('QRCodeShare', { mode: 'scan' })}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="qr-code" size={16} color="#0F766E" type="lucide" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconHeaderBtn} onPress={loadOperationsDashboard} activeOpacity={0.8}>
                            <SafeIcon name={opsLoading ? 'loader' : 'refresh-cw'} size={16} color="#0F766E" type="lucide" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{opsStats.achatsEnCours}</Text>
                        <Text style={styles.statLabel}>{t('livreScolaireHome.statAchatsEnCours', 'Achats en cours')}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{opsStats.paquetsARecevoir}</Text>
                        <Text style={styles.statLabel}>{t('livreScolaireHome.statPaquetsRecevoir', 'Paquets à recevoir')}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{opsStats.paquetsAEnvoyer}</Text>
                        <Text style={styles.statLabel}>{t('livreScolaireHome.statPaquetsEnvoyer', 'Paquets à envoyer')}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{opsStats.trocsEnCours}</Text>
                        <Text style={styles.statLabel}>{t('livreScolaireHome.statTrocsEnCours', 'Trocs en cours')}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{opsStats.besoinsActifs}</Text>
                        <Text style={styles.statLabel}>{t('livreScolaireHome.statBesoins', 'Besoins actifs')}</Text>
                    </View>
                </View>
                <View style={styles.trackActionsRow}>
                    <TouchableOpacity style={styles.trackActionBtn} onPress={() => safeNavigate('BookPackages')}>
                        <SafeIcon name="package" size={14} color="#1D4ED8" type="lucide" />
                        <Text style={styles.trackActionText}>{t('livreScolaireHome.suivrePaquets', 'Suivre mes paquets')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.trackActionBtn} onPress={() => safeNavigate('MesTrocs')}>
                        <SafeIcon name="repeat" size={14} color="#1D4ED8" type="lucide" />
                        <Text style={styles.trackActionText}>{t('livreScolaireHome.suivreTrocs', 'Suivre mes trocs')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.trackActionBtn} onPress={() => safeNavigate('MesBesoinsLivres')}>
                        <SafeIcon name="list-checks" size={14} color="#1D4ED8" type="lucide" />
                        <Text style={styles.trackActionText}>{t('livreScolaireHome.mesBesoins', 'Mes besoins')}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.qrHintText}>
                    {t('livreScolaireHome.qrHint', 'Scannez le QR du coursier a son arrivee pour valider la livraison.')}
                </Text>
            </View>

            {/* Liste des livres */}
            {loading && livres.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('livreScolaireHome.rechercheDeLivresAProximite')}</Text>
                </View>
            ) : error && livres.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="book" size={64} color="#9CA3AF" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={loadNearbyBooks}
                    >
                        <Text style={styles.retryButtonText}>{t('livreScolaireHome.reessayer')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={livres}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <BookCard
                            livre={item}
                            onPress={() => navigation.navigate('LivreScolaireDetails' as never, { livreId: item.id } as never)}
                            formatDistance={formatDistance}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadNearbyBooks();
                            }}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="book" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>{t('livreScolaireHome.aucunLivreTrouve')}</Text>
                        </View>
                    }
                />
            )}
        </SafeNativeView>
    );
};

// Composant Card pour un livre
interface BookCardProps {
    livre: LivreScolaire;
    onPress: () => void;
    formatDistance: (distance?: number) => string;
}

const BookCard: React.FC<BookCardProps> = ({ livre, onPress, formatDistance }) => {
    return (
        <TouchableOpacity style={styles.bookCard} onPress={onPress} activeOpacity={0.7}>
            {livre.images_urls && livre.images_urls.length > 0 ? (
                <Image
                    source={{ uri: livre.images_urls[0] }}
                    style={styles.bookImage}
                    resizeMode="cover"
                />
            ) : (
                <View style={styles.bookImagePlaceholder}>
                    <SafeIcon name="book" size={32} color="#9CA3AF" />
                </View>
            )}
            <View style={styles.bookInfo}>
                <Text style={styles.bookTitle} numberOfLines={2}>
                    {livre.titre}
                </Text>
                {livre.auteur && (
                    <Text style={styles.bookAuthor} numberOfLines={1}>
                        {livre.auteur}
                    </Text>
                )}
                <View style={styles.bookMeta}>
                    <View style={styles.bookMetaItem}>
                        <SafeIcon name="graduation-cap" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.bookMetaText}>
                            {livre.classe_actuelle} → {livre.classe_souhaitee}
                        </Text>
                    </View>
                    <View style={styles.bookMetaItem}>
                        <SafeIcon name="book-open" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.bookMetaText}>{livre.matiere}</Text>
                    </View>
                </View>
                <View style={styles.bookFooter}>
                    <View style={styles.bookLocation}>
                        {livre.ville && (
                            <Text style={styles.bookLocationText} numberOfLines={1}>
                                {livre.quartier && `${livre.quartier}, `}
                                {livre.ville}
                            </Text>
                        )}
                        {livre.distance_km && (
                            <Text style={styles.bookDistance}>
                                {formatDistance(livre.distance_km)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.bookStateBadge}>
                        <Text style={styles.bookStateText}>{livre.etat_livre}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
    },
    headerGradient: {
        paddingTop: 18,
        paddingBottom: 14,
        paddingHorizontal: 16,
        gap: 12,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 10,
        padding: 2,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
        flex: 1,
        letterSpacing: 0.3,
    },
    headerButtonsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    libraireHeaderBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 2,
    },
    libraireHeaderBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#92400E',
    },
    etablissementHeaderBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 2,
    },
    etablissementHeaderBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#047857',
    },
    primaryActionsRow: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        backgroundColor: '#F9FAFB',
        gap: 10,
    },
    primaryActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 12,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    primaryActionSell: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        shadowColor: '#059669',
    },
    primaryActionBuy: {
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        shadowColor: '#2563EB',
    },
    primaryActionIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryActionTextWrap: {
        flex: 1,
        gap: 2,
    },
    primaryActionTitle: {
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 18,
    },
    primaryActionSubtitle: {
        fontSize: 11,
        lineHeight: 15,
        opacity: 0.8,
    },
    dashboardSection: {
        marginHorizontal: 16,
        marginTop: 2,
        marginBottom: 6,
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    dashboardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    dashboardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    dashboardHeaderActions: {
        flexDirection: 'row',
        gap: 8,
    },
    iconHeaderBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#ECFEFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#A5F3FC',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statCard: {
        width: '48%',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    statLabel: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 4,
    },
    trackActionsRow: {
        marginTop: 10,
        gap: 8,
    },
    trackActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    trackActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E3A8A',
    },
    qrHintText: {
        marginTop: 10,
        fontSize: 11,
        color: '#0F766E',
        fontWeight: '600',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#F59E0B',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    // Book Card styles
    bookCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        gap: 12,
    },
    bookImage: {
        width: 100,
        height: 140,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    bookImagePlaceholder: {
        width: 100,
        height: 140,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookInfo: {
        flex: 1,
    },
    bookTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    bookAuthor: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    bookMeta: {
        gap: 6,
        marginBottom: 12,
    },
    bookMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    bookMetaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    bookFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
    },
    bookLocation: {
        flex: 1,
    },
    bookLocationText: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    bookDistance: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    bookStateBadge: {
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    bookStateText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#065F46',
    },
});

export default LivreScolaireHomeScreen;

