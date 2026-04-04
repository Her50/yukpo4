// TrendPulse Dashboard — Yukpo Social
// Tendances en temps réel, personnalisées, brouillons IA, prévisions J+3/J+7
// Endpoints: /api/trends/pulse, /api/trends/for-me, /api/trends/auto-drafts/:id,
//            /api/trends/forecast, /api/trends/search

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendTopic {
    topic: string;
    score: number;
    social_score?: number;
    opportunity_score?: number;
    trend_direction: 'rising' | 'stable' | 'declining' | 'peak';
    region: string;
    forecast_day3?: number;
    forecast_day7?: number;
    confidence?: number;
    categories: string[];
    sources?: string[];
}

interface PersonalizedTrend extends TrendTopic {
    opportunity_score: number;
    matching_products?: string[];
    recommended_action?: string;
}

interface AutoDraft {
    id: number;
    topic: string;
    region: string;
    opportunity_score: number;
    draft_caption: string;
    draft_instagram?: string;
    draft_facebook?: string;
    draft_tiktok?: string;
    status: string;
    generated_at: string;
}

interface Forecast {
    topic: string;
    region: string;
    forecast_day1: number;
    forecast_day3: number;
    forecast_day7: number;
    forecast_day14: number;
    confidence: number;
    trend_direction: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const REGIONS = [
    { code: 'CM', label: '🇨🇲 Cameroun' },
    { code: 'SN', label: '🇸🇳 Sénégal' },
    { code: 'CI', label: '🇨🇮 Côte d\'Ivoire' },
    { code: 'NG', label: '🇳🇬 Nigeria' },
    { code: 'ALL', label: '🌍 Afrique' },
];

const PERIODS = [
    { key: '24h', label: '24h' },
    { key: '7d', label: '7 jours' },
    { key: '30d', label: '30 jours' },
];

const CATEGORIES = ['food', 'fashion', 'tech', 'beauty', 'sports', 'music', 'politics', 'health'];

const DIR_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
    rising:   { color: '#10B981', icon: 'trending-up',   label: 'En hausse' },
    peak:     { color: '#F59E0B', icon: 'zap',           label: 'Pic' },
    stable:   { color: '#64748B', icon: 'minus',         label: 'Stable' },
    declining:{ color: '#EF4444', icon: 'trending-down', label: 'En baisse' },
};

const SCORE_COLOR = (score: number) =>
    score >= 70 ? '#10B981' : score >= 45 ? '#F59E0B' : '#EF4444';

type TabType = 'pulse' | 'forme' | 'drafts' | 'forecast';

// ─── Composant ────────────────────────────────────────────────────────────────

export default function TrendPulseDashboardScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { user } = useAuth();

    const serviceId: number = route.params?.serviceId ?? 0;
    const serviceName: string = route.params?.serviceName ?? '';

    const [tab, setTab] = useState<TabType>('pulse');
    const [region, setRegion] = useState('CM');
    const [period, setPeriod] = useState('24h');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Pulse
    const [trends, setTrends] = useState<TrendTopic[]>([]);
    const [topPersonalities, setTopPersonalities] = useState<string[]>([]);
    const [topSectors, setTopSectors] = useState<string[]>([]);

    // Pour moi
    const [myTrends, setMyTrends] = useState<PersonalizedTrend[]>([]);
    const [highOppCount, setHighOppCount] = useState(0);

    // Drafts
    const [drafts, setDrafts] = useState<AutoDraft[]>([]);
    const [selectedDraft, setSelectedDraft] = useState<AutoDraft | null>(null);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [publishingDraft, setPublishingDraft] = useState(false);

    // Forecast
    const [forecastTopic, setForecastTopic] = useState('');
    const [forecast, setForecast] = useState<Forecast | null>(null);
    const [loadingForecast, setLoadingForecast] = useState(false);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const pulseAnim = useRef(new Animated.Value(0)).current;

    // ─── Chargement ─────────────────────────────────────────────────────────

    const loadPulse = useCallback(async () => {
        try {
            const params = new URLSearchParams({ region, period, limit: '20' });
            if (selectedCategory) params.set('category', selectedCategory);
            const data: any = await apiGet(`/api/trends/pulse?${params}`);
            setTrends(data.trends ?? []);
            setTopPersonalities(data.top_personalities ?? []);
            setTopSectors(data.top_sectors ?? []);
        } catch { }
    }, [region, period, selectedCategory]);

    const loadMyTrends = useCallback(async () => {
        if (tab !== 'forme') return;
        try {
            const data: any = await apiGet(`/api/trends/for-me?region=${region}&period=${period}&limit=15`);
            setMyTrends(data.personalized_trends ?? []);
            setHighOppCount(data.high_opportunity_count ?? 0);
        } catch { }
    }, [tab, region, period]);

    const loadDrafts = useCallback(async () => {
        if (tab !== 'drafts' || !serviceId) return;
        try {
            const data: any = await apiGet(`/api/trends/auto-drafts/${serviceId}`);
            setDrafts(data.drafts ?? []);
        } catch { }
    }, [tab, serviceId]);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([loadPulse(), loadMyTrends(), loadDrafts()]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [loadPulse, loadMyTrends, loadDrafts]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Animation pulse sur les trends "rising"
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    // ─── Actions ────────────────────────────────────────────────────────────

    const publishDraft = async (draftId: number, platform: string) => {
        setPublishingDraft(true);
        try {
            await apiPost(`/api/trends/auto-drafts/${draftId}/publish`, { platform });
            setDrafts(p => p.map(d => d.id === draftId ? { ...d, status: 'published' } : d));
            setShowDraftModal(false);
            Alert.alert('Publié !', `Post tendance publié sur ${platform}`);
        } catch {
            Alert.alert('Erreur', 'Publication échouée, réessayez.');
        } finally {
            setPublishingDraft(false);
        }
    };

    const dismissDraft = async (draftId: number) => {
        try {
            await apiPost(`/api/trends/auto-drafts/${draftId}/dismiss`, {});
            setDrafts(p => p.filter(d => d.id !== draftId));
        } catch { }
    };

    const loadForecast = async () => {
        if (!forecastTopic.trim()) return;
        setLoadingForecast(true);
        try {
            const data: any = await apiGet(`/api/trends/forecast?topic=${encodeURIComponent(forecastTopic)}&region=${region}`);
            setForecast(data.forecast ?? null);
        } catch {
            Alert.alert('Erreur', 'Prévision indisponible pour ce topic');
        } finally {
            setLoadingForecast(false);
        }
    };

    const generateFromTrend = (topicName: string) => {
        if (serviceId) {
            (navigation as any).navigate('SocialAI', {
                serviceId,
                serviceName,
                injectTrend: topicName,
            });
        } else {
            Alert.alert('Info', `Rendez-vous dans Yukpo Social pour créer un post sur #${topicName}`);
        }
    };

    // ─── Renders ─────────────────────────────────────────────────────────────

    const pendingDrafts = drafts.filter(d => d.status === 'draft');

    const renderTrendCard = (t: TrendTopic, i: number, showOpp = false) => {
        const dir = DIR_CONFIG[t.trend_direction] ?? DIR_CONFIG.stable;
        const score = showOpp ? (t as PersonalizedTrend).opportunity_score : t.score;
        const isRising = t.trend_direction === 'rising' || t.trend_direction === 'peak';
        const opacity = isRising ? pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) : 1;

        return (
            <Animated.View key={`${t.topic}-${i}`} style={[s.trendCard, { opacity: isRising ? opacity : 1 }]}>
                <View style={s.trendRow}>
                    {/* Rang */}
                    <View style={[s.rankBadge, { backgroundColor: i < 3 ? '#6366F1' : '#1E293B' }]}>
                        <Text style={s.rankText}>#{i + 1}</Text>
                    </View>

                    {/* Infos */}
                    <View style={s.trendInfo}>
                        <Text style={s.trendTopic}>#{t.topic}</Text>
                        <Text style={s.trendRegion}>{t.region} · {t.categories?.slice(0, 2).join(', ')}</Text>
                        {showOpp && (t as PersonalizedTrend).recommended_action && (
                            <Text style={s.recAction}>{(t as PersonalizedTrend).recommended_action}</Text>
                        )}
                    </View>

                    {/* Direction */}
                    <View style={[s.dirBadge, { backgroundColor: dir.color + '22' }]}>
                        <SafeIcon name={dir.icon} size={12} color={dir.color} />
                        <Text style={[s.dirText, { color: dir.color }]}>{dir.label}</Text>
                    </View>
                </View>

                {/* Barre de score */}
                <View style={s.scoreRow}>
                    <View style={s.scoreBarWrap}>
                        <View style={[s.scoreBarFill, { width: `${Math.min(score, 100)}%`, backgroundColor: SCORE_COLOR(score) }]} />
                    </View>
                    <Text style={[s.scoreNum, { color: SCORE_COLOR(score) }]}>{score?.toFixed(0)}</Text>
                    {t.forecast_day3 !== undefined && (
                        <Text style={s.forecastTag}>J+3: {t.forecast_day3?.toFixed(0)}</Text>
                    )}
                </View>

                {/* Sources */}
                {t.sources && t.sources.length > 0 && (
                    <View style={s.sourceRow}>
                        {t.sources.slice(0, 4).map(src => (
                            <View key={src} style={s.sourceChip}>
                                <Text style={s.sourceText}>{src}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Produits matchés (pour-moi) */}
                {showOpp && (t as PersonalizedTrend).matching_products?.length ? (
                    <Text style={s.matchProducts}>
                        🛍 {(t as PersonalizedTrend).matching_products!.slice(0, 2).join(', ')}
                    </Text>
                ) : null}

                {/* Action */}
                <TouchableOpacity style={s.genBtn} onPress={() => generateFromTrend(t.topic)}>
                    <SafeIcon name="edit-2" size={13} color="#6366F1" />
                    <Text style={s.genBtnText}>Générer un post</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderPulseTab = () => (
        <ScrollView
            contentContainerStyle={s.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#6366F1" />}
        >
            {/* Top secteurs */}
            {topSectors.length > 0 && (
                <View style={s.topRow}>
                    <Text style={s.topLabel}>Secteurs chauds :</Text>
                    {topSectors.slice(0, 4).map(s2 => (
                        <View key={s2} style={s.topChip}>
                            <Text style={s.topChipText}>{s2}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Filtre catégorie */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
                <View style={s.catRow}>
                    <TouchableOpacity
                        style={[s.catChip, !selectedCategory && s.catChipActive]}
                        onPress={() => setSelectedCategory(null)}
                    >
                        <Text style={[s.catText, !selectedCategory && s.catTextActive]}>Tout</Text>
                    </TouchableOpacity>
                    {CATEGORIES.map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[s.catChip, selectedCategory === c && s.catChipActive]}
                            onPress={() => setSelectedCategory(selectedCategory === c ? null : c)}
                        >
                            <Text style={[s.catText, selectedCategory === c && s.catTextActive]}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {trends.length === 0
                ? <Text style={s.empty}>Aucune tendance disponible pour cette région.</Text>
                : trends.map((t, i) => renderTrendCard(t, i, false))
            }
        </ScrollView>
    );

    const renderForMeTab = () => (
        <ScrollView
            contentContainerStyle={s.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#6366F1" />}
        >
            {highOppCount > 0 && (
                <View style={s.oppBanner}>
                    <SafeIcon name="zap" size={16} color="#F59E0B" />
                    <Text style={s.oppBannerText}>{highOppCount} opportunité(s) à fort potentiel pour votre boutique</Text>
                </View>
            )}
            {myTrends.length === 0
                ? (
                    <View style={s.emptyCenter}>
                        <SafeIcon name="user" size={40} color="#334155" />
                        <Text style={s.empty}>Connectez-vous pour voir vos tendances personnalisées.</Text>
                    </View>
                )
                : myTrends.map((t, i) => renderTrendCard(t, i, true))
            }
        </ScrollView>
    );

    const renderDraftsTab = () => (
        <ScrollView contentContainerStyle={s.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#6366F1" />}
        >
            <Text style={s.sectionHint}>
                Brouillons générés automatiquement quand une tendance dépasse le seuil d'opportunité de votre boutique.
            </Text>
            {pendingDrafts.length === 0 ? (
                <View style={s.emptyCenter}>
                    <SafeIcon name="file-text" size={40} color="#334155" />
                    <Text style={s.empty}>Aucun brouillon en attente.{'\n'}Abonnez-vous aux alertes pour en recevoir.</Text>
                </View>
            ) : (
                pendingDrafts.map(d => (
                    <TouchableOpacity
                        key={d.id}
                        style={s.draftCard}
                        onPress={() => { setSelectedDraft(d); setShowDraftModal(true); }}
                        activeOpacity={0.85}
                    >
                        <View style={s.draftHead}>
                            <View style={s.draftScore}>
                                <Text style={s.draftScoreNum}>{d.opportunity_score?.toFixed(0)}</Text>
                                <Text style={s.draftScoreLabel}>opp.</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.draftTopic}>#{d.topic}</Text>
                                <Text style={s.draftDate}>
                                    {d.region} · {new Date(d.generated_at).toLocaleDateString('fr-FR')}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => dismissDraft(d.id)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                <SafeIcon name="x" size={16} color="#475569" />
                            </TouchableOpacity>
                        </View>
                        <Text style={s.draftPreview} numberOfLines={2}>{d.draft_caption}</Text>
                        <View style={s.draftPlatforms}>
                            {(['instagram', 'facebook', 'tiktok'] as const).map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={s.publishBtn}
                                    onPress={(e) => { e.stopPropagation?.(); publishDraft(d.id, p); }}
                                >
                                    <Text style={s.publishBtnText}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableOpacity>
                ))
            )}

            {/* Drafts publiés */}
            {drafts.filter(d => d.status === 'published').length > 0 && (
                <>
                    <Text style={[s.sectionHint, { marginTop: 20 }]}>Déjà publiés</Text>
                    {drafts.filter(d => d.status === 'published').slice(0, 5).map(d => (
                        <View key={d.id} style={[s.draftCard, { opacity: 0.5 }]}>
                            <Text style={s.draftTopic}>#{d.topic}</Text>
                            <Text style={s.draftDate}>Publié le {new Date(d.generated_at).toLocaleDateString('fr-FR')}</Text>
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    );

    const renderForecastTab = () => (
        <ScrollView contentContainerStyle={s.tabContent}>
            <Text style={s.sectionHint}>Entrez un hashtag pour obtenir une prévision J+3 / J+7 / J+14.</Text>

            <View style={s.searchRow}>
                <TextInput
                    style={s.searchInput}
                    value={forecastTopic}
                    onChangeText={setForecastTopic}
                    placeholder="Ex: FIFA2026, BlackFriday, Noël..."
                    placeholderTextColor="#475569"
                    onSubmitEditing={loadForecast}
                    returnKeyType="search"
                />
                <TouchableOpacity style={s.searchBtn} onPress={loadForecast} disabled={loadingForecast}>
                    {loadingForecast
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <SafeIcon name="search" size={18} color="#fff" />
                    }
                </TouchableOpacity>
            </View>

            {/* Suggestions rapides issues des trends actuelles */}
            {trends.length > 0 && (
                <View>
                    <Text style={s.suggestLabel}>Tendances actuelles :</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={s.suggestRow}>
                            {trends.slice(0, 8).map(t => (
                                <TouchableOpacity
                                    key={t.topic}
                                    style={s.suggestChip}
                                    onPress={() => { setForecastTopic(t.topic); }}
                                >
                                    <Text style={s.suggestText}>#{t.topic}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            )}

            {forecast && (
                <View style={s.forecastCard}>
                    <View style={s.forecastHeader}>
                        <Text style={s.forecastTopic}>#{forecast.topic}</Text>
                        <View style={[s.dirBadge, { backgroundColor: (DIR_CONFIG[forecast.trend_direction]?.color ?? '#888') + '22' }]}>
                            <Text style={[s.dirText, { color: DIR_CONFIG[forecast.trend_direction]?.color ?? '#888' }]}>
                                {DIR_CONFIG[forecast.trend_direction]?.label ?? forecast.trend_direction}
                            </Text>
                        </View>
                    </View>
                    <Text style={s.forecastConf}>Confiance : {(forecast.confidence * 100).toFixed(0)}%</Text>

                    {/* Graphique bâtons */}
                    <View style={s.forecastBars}>
                        {[
                            { label: 'J+1', val: forecast.forecast_day1 },
                            { label: 'J+3', val: forecast.forecast_day3 },
                            { label: 'J+7', val: forecast.forecast_day7 },
                            { label: 'J+14', val: forecast.forecast_day14 },
                        ].map(bar => (
                            <View key={bar.label} style={s.barCol}>
                                <Text style={s.barVal}>{bar.val?.toFixed(0)}</Text>
                                <View style={s.barWrap}>
                                    <View style={[s.barFill, {
                                        height: `${Math.min(bar.val ?? 0, 100)}%`,
                                        backgroundColor: SCORE_COLOR(bar.val ?? 0),
                                    }]} />
                                </View>
                                <Text style={s.barLabel}>{bar.label}</Text>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity style={[s.genBtn, { marginTop: 12 }]} onPress={() => generateFromTrend(forecast.topic)}>
                        <SafeIcon name="edit-2" size={13} color="#6366F1" />
                        <Text style={s.genBtnText}>Créer un post sur cette tendance</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );

    // ─── Draft Modal ─────────────────────────────────────────────────────────

    const renderDraftModal = () => (
        <Modal visible={showDraftModal} transparent animationType="slide" onRequestClose={() => setShowDraftModal(false)}>
            <View style={s.modalOverlay}>
                <View style={s.modalSheet}>
                    <View style={s.modalHandle} />
                    <ScrollView>
                        <Text style={s.modalTitle}>#{selectedDraft?.topic}</Text>
                        <Text style={s.modalMeta}>
                            Score opportunité : {selectedDraft?.opportunity_score?.toFixed(0)} · {selectedDraft?.region}
                        </Text>

                        <Text style={s.modalSectionLabel}>Caption principale</Text>
                        <View style={s.captionBox}>
                            <Text style={s.captionText}>{selectedDraft?.draft_caption}</Text>
                        </View>

                        {selectedDraft?.draft_instagram && (
                            <>
                                <Text style={s.modalSectionLabel}>Version Instagram</Text>
                                <View style={[s.captionBox, { borderColor: '#E1306C44' }]}>
                                    <Text style={s.captionText}>{selectedDraft.draft_instagram}</Text>
                                </View>
                            </>
                        )}
                        {selectedDraft?.draft_facebook && (
                            <>
                                <Text style={s.modalSectionLabel}>Version Facebook</Text>
                                <View style={[s.captionBox, { borderColor: '#1877F244' }]}>
                                    <Text style={s.captionText}>{selectedDraft.draft_facebook}</Text>
                                </View>
                            </>
                        )}
                        {selectedDraft?.draft_tiktok && (
                            <>
                                <Text style={s.modalSectionLabel}>Version TikTok</Text>
                                <View style={[s.captionBox, { borderColor: '#010101' }]}>
                                    <Text style={s.captionText}>{selectedDraft.draft_tiktok}</Text>
                                </View>
                            </>
                        )}

                        <Text style={s.modalSectionLabel}>Publier sur</Text>
                        <View style={s.publishRowModal}>
                            {(['instagram', 'facebook', 'tiktok', 'whatsapp'] as const).map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={s.publishBtnModal}
                                    onPress={() => selectedDraft && publishDraft(selectedDraft.id, p)}
                                    disabled={publishingDraft}
                                >
                                    {publishingDraft
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <Text style={s.publishBtnModalText}>{p}</Text>
                                    }
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={s.closeModalBtn} onPress={() => setShowDraftModal(false)}>
                            <Text style={s.closeModalText}>Fermer</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    // ─── Main render ──────────────────────────────────────────────────────────

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View>
                    <Text style={s.headerTitle}>TrendPulse</Text>
                    <Text style={s.headerSub}>Tendances · Opportunités · Prévisions</Text>
                </View>
                {pendingDrafts.length > 0 && (
                    <TouchableOpacity style={s.draftBadge} onPress={() => setTab('drafts')}>
                        <SafeIcon name="zap" size={13} color="#fff" />
                        <Text style={s.draftBadgeText}>{pendingDrafts.length}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Région + Période */}
            <View style={s.filtersRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.filtersInner}>
                        {REGIONS.map(r => (
                            <TouchableOpacity
                                key={r.code}
                                style={[s.filterChip, region === r.code && s.filterChipActive]}
                                onPress={() => setRegion(r.code)}
                            >
                                <Text style={[s.filterChipText, region === r.code && s.filterChipTextActive]}>
                                    {r.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <View style={s.filterDivider} />
                        {PERIODS.map(p => (
                            <TouchableOpacity
                                key={p.key}
                                style={[s.filterChip, period === p.key && s.filterChipActive]}
                                onPress={() => setPeriod(p.key)}
                            >
                                <Text style={[s.filterChipText, period === p.key && s.filterChipTextActive]}>
                                    {p.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
                {([
                    { key: 'pulse',    label: 'Tendances',   icon: 'trending-up' },
                    { key: 'forme',    label: 'Pour moi',    icon: 'star' },
                    { key: 'drafts',   label: `Brouillons${pendingDrafts.length ? ` (${pendingDrafts.length})` : ''}`, icon: 'file-text' },
                    { key: 'forecast', label: 'Prévisions',  icon: 'bar-chart-2' },
                ] as const).map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[s.tab, tab === t.key && s.tabActive]}
                        onPress={() => setTab(t.key)}
                    >
                        <SafeIcon name={t.icon} size={14} color={tab === t.key ? '#6366F1' : '#475569'} />
                        <Text style={[s.tabText, tab === t.key && s.tabTextActive]} numberOfLines={1}>
                            {t.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Contenu */}
            {loading ? (
                <View style={s.loadingCenter}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={s.loadingText}>Analyse des tendances…</Text>
                </View>
            ) : (
                <>
                    {tab === 'pulse'    && renderPulseTab()}
                    {tab === 'forme'    && renderForMeTab()}
                    {tab === 'drafts'   && renderDraftsTab()}
                    {tab === 'forecast' && renderForecastTab()}
                </>
            )}

            {renderDraftModal()}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B1120' },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 12 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.5 },
    headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    draftBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F59E0B', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
    draftBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    // Filtres
    filtersRow: { paddingBottom: 8 },
    filtersInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 6 },
    filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
    filterChipActive: { backgroundColor: '#6366F133', borderColor: '#6366F1' },
    filterChipText: { color: '#64748B', fontSize: 12 },
    filterChipTextActive: { color: '#818CF8', fontWeight: '600' },
    filterDivider: { width: 1, height: 20, backgroundColor: '#334155', marginHorizontal: 4 },

    // Tabs
    tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
    tab: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1E293B' },
    tabActive: { backgroundColor: '#6366F122', borderWidth: 1, borderColor: '#6366F144' },
    tabText: { color: '#475569', fontSize: 10, textAlign: 'center' },
    tabTextActive: { color: '#818CF8', fontWeight: '600' },

    // Loading
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: '#475569', fontSize: 14 },

    // Tab content
    tabContent: { padding: 16, paddingBottom: 40 },

    // Trend cards
    trendCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
    trendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    rankText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    trendInfo: { flex: 1 },
    trendTopic: { color: '#F1F5F9', fontSize: 15, fontWeight: '700' },
    trendRegion: { color: '#64748B', fontSize: 11, marginTop: 2 },
    recAction: { color: '#818CF8', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
    dirBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    dirText: { fontSize: 10, fontWeight: '600' },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    scoreBarWrap: { flex: 1, height: 5, backgroundColor: '#0F172A', borderRadius: 3, overflow: 'hidden' },
    scoreBarFill: { height: '100%', borderRadius: 3 },
    scoreNum: { fontWeight: '700', fontSize: 13, minWidth: 28 },
    forecastTag: { color: '#10B981', fontSize: 11 },
    sourceRow: { flexDirection: 'row', gap: 5, marginBottom: 8 },
    sourceChip: { backgroundColor: '#0F172A', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
    sourceText: { color: '#64748B', fontSize: 10 },
    matchProducts: { color: '#94A3B8', fontSize: 11, marginBottom: 8 },
    genBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#6366F111', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#6366F133' },
    genBtnText: { color: '#818CF8', fontSize: 12, fontWeight: '600' },

    // Catégories
    catScroll: { marginBottom: 12 },
    catRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
    catChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
    catChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    catText: { color: '#64748B', fontSize: 12 },
    catTextActive: { color: '#fff', fontWeight: '600' },

    // Top row
    topRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    topLabel: { color: '#64748B', fontSize: 12 },
    topChip: { backgroundColor: '#F59E0B22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    topChipText: { color: '#F59E0B', fontSize: 11, fontWeight: '600' },

    // Opportunité banner
    oppBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F59E0B22', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#F59E0B44' },
    oppBannerText: { color: '#FDE68A', fontSize: 13, fontWeight: '600', flex: 1 },

    // Drafts
    sectionHint: { color: '#475569', fontSize: 12, lineHeight: 18, marginBottom: 12, textAlign: 'center' },
    draftCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#6366F1' },
    draftHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    draftScore: { alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 8, padding: 8, minWidth: 44 },
    draftScoreNum: { color: '#818CF8', fontWeight: '800', fontSize: 18 },
    draftScoreLabel: { color: '#475569', fontSize: 9 },
    draftTopic: { color: '#F1F5F9', fontWeight: '700', fontSize: 14 },
    draftDate: { color: '#64748B', fontSize: 11, marginTop: 2 },
    draftPreview: { color: '#94A3B8', fontSize: 13, lineHeight: 19, marginBottom: 10 },
    draftPlatforms: { flexDirection: 'row', gap: 8 },
    publishBtn: { flex: 1, backgroundColor: '#6366F1', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
    publishBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },

    // Empty
    empty: { color: '#475569', textAlign: 'center', fontSize: 13, lineHeight: 20, marginTop: 8 },
    emptyCenter: { alignItems: 'center', gap: 12, paddingTop: 40 },

    // Forecast tab
    searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    searchInput: { flex: 1, backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#F1F5F9', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
    searchBtn: { backgroundColor: '#6366F1', borderRadius: 10, width: 46, alignItems: 'center', justifyContent: 'center' },
    suggestLabel: { color: '#64748B', fontSize: 11, marginBottom: 8 },
    suggestRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
    suggestChip: { backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#334155' },
    suggestText: { color: '#818CF8', fontSize: 12 },
    forecastCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#334155' },
    forecastHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    forecastTopic: { color: '#F1F5F9', fontWeight: '800', fontSize: 18 },
    forecastConf: { color: '#64748B', fontSize: 12, marginBottom: 16 },
    forecastBars: { flexDirection: 'row', height: 120, alignItems: 'flex-end', gap: 12, marginBottom: 8 },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    barVal: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
    barWrap: { flex: 1, width: '100%', backgroundColor: '#0F172A', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill: { width: '100%', borderRadius: 4 },
    barLabel: { color: '#64748B', fontSize: 11 },

    // Draft modal
    modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#1E293B', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 20 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalTitle: { color: '#F1F5F9', fontSize: 20, fontWeight: '800', marginBottom: 4 },
    modalMeta: { color: '#64748B', fontSize: 12, marginBottom: 16 },
    modalSectionLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
    captionBox: { backgroundColor: '#0F172A', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 4 },
    captionText: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
    publishRowModal: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    publishBtnModal: { flex: 1, minWidth: '40%', backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    publishBtnModalText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    closeModalBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
    closeModalText: { color: '#64748B', fontSize: 14 },
});
