// Social AI Engine — Dashboard partenaire
// Onglets: Contenu IA | Chatbot CM | Publicités | Inbox | Calendrier

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost, apiPut } from '../../services/api';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = 'content' | 'chatbot' | 'ads' | 'inbox' | 'calendar';

interface GeneratedPost {
    caption_a: string;
    caption_b?: string;
    hashtags: string[];
    story_text?: string;
    platform_variants: { facebook: string; instagram: string; whatsapp: string };
    tone_used: string;
}

interface InboxThread {
    id: number;
    thread_id: number;
    platform: string;
    sender_name?: string;
    last_message_preview?: string;
    last_message_at?: string;
    unread_count: number;
    is_escalated: boolean;
    status: string;
}

interface Campaign {
    id: number;
    name: string;
    type: string;
    status: string;
    budget_daily_fcfa?: number;
    impressions: number;
    clicks: number;
    spent_fcfa: number;
    roas?: number;
    conversions: number;
}

interface CalendarEntry {
    id: number;
    scheduled_at: string;
    platform: string;
    product_name?: string;
    caption_preview: string;
    status: string;
    tone: string;
}

interface Product {
    id: number;
    nom: string;
    prix: number;
    sale_price?: number;
    image_url?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    facebook: { icon: 'facebook', color: '#1877F2', label: 'Facebook' },
    instagram: { icon: 'instagram', color: '#E1306C', label: 'Instagram' },
    whatsapp: { icon: 'message-circle', color: '#25D366', label: 'WhatsApp' },
    messenger: { icon: 'message-square', color: '#0084FF', label: 'Messenger' },
    instagram_dm: { icon: 'instagram', color: '#E1306C', label: 'Instagram DM' },
};

const TONES = [
    { key: 'professional', label: 'Professionnel', icon: 'briefcase' },
    { key: 'casual', label: 'Décontracté', icon: 'smile' },
    { key: 'promotional', label: 'Promotionnel', icon: 'tag' },
    { key: 'urgent', label: 'Urgence', icon: 'zap' },
];

// ─── Composant principal ──────────────────────────────────────────────────────

const SocialAIScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { user } = useAuth();
    const devise = getCurrencyIntelligently() || 'FCFA';

    const serviceId: number = route.params?.serviceId ?? 0;
    const serviceName: string = route.params?.serviceName ?? 'Ma boutique';

    const [activeTab, setActiveTab] = useState<TabType>('content');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Content AI
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedPlatform, setSelectedPlatform] = useState('facebook');
    const [selectedTone, setSelectedTone] = useState('professional');
    const [generating, setGenerating] = useState(false);
    const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
    const [showPostModal, setShowPostModal] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');

    // Chatbot
    const [botActive, setBotActive] = useState(true);
    const [botName, setBotName] = useState('Assistant');
    const [welcomeMsg, setWelcomeMsg] = useState('');
    const [awayMsg, setAwayMsg] = useState('');
    const [escalationWords, setEscalationWords] = useState('plainte, arnaque, remboursement, responsable');
    const [replyDelay, setReplyDelay] = useState(1500);
    const [savingBot, setSavingBot] = useState(false);
    const [botLanguage, setBotLanguage] = useState('fr');

    // Ads
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [adAccountId, setAdAccountId] = useState('');
    const [adAccessToken, setAdAccessToken] = useState('');
    const [adBudget, setAdBudget] = useState('5000');
    const [showAdAccountModal, setShowAdAccountModal] = useState(false);
    const [savingAdAccount, setSavingAdAccount] = useState(false);
    const [creatingCampaign, setCreatingCampaign] = useState(false);
    const [selectedPromoProduct, setSelectedPromoProduct] = useState<Product | null>(null);

    // Inbox
    const [threads, setThreads] = useState<InboxThread[]>([]);
    const [inboxFilter, setInboxFilter] = useState('all');
    const [inboxStats, setInboxStats] = useState<any>(null);
    const [selectedThread, setSelectedThread] = useState<any>(null);
    const [showThreadModal, setShowThreadModal] = useState(false);
    const [threadMessages, setThreadMessages] = useState<any[]>([]);

    // Calendar
    const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);

    // ─── Chargement ─────────────────────────────────────────────────────────

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([loadProducts(), loadCampaigns(), loadInbox(), loadCalendar()]);
        } finally {
            setLoading(false);
        }
    }, [serviceId]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const loadProducts = async () => {
        try {
            const resp: any = await apiGet(`/api/supermarkets/${serviceId}/products?limit=100`);
            const raw = resp?.data?.products ?? [];
            setProducts(raw.map((p: any) => ({
                id: parseInt(p.id), nom: p.name || p.nom || 'Produit',
                prix: p.price || 0, sale_price: p.sale_price || p.prix_promo,
                image_url: p.image_url,
            })));
        } catch { setProducts([]); }
    };

    const loadCampaigns = async () => {
        try {
            const resp: any = await apiGet(`/api/social-ai/ads/campaigns/${serviceId}`);
            setCampaigns(resp?.campaigns ?? []);
        } catch { setCampaigns([]); }
    };

    const loadInbox = async () => {
        try {
            const resp: any = await apiGet(`/api/social-ai/inbox/${serviceId}?filter=${inboxFilter}`);
            setThreads(resp?.threads ?? []);
            setInboxStats(resp?.stats ?? null);
        } catch { setThreads([]); }
    };

    const loadCalendar = async () => {
        try {
            const resp: any = await apiGet(`/api/social-ai/content/calendar/${serviceId}?days=14`);
            setCalendarEntries(resp?.calendar ?? []);
        } catch { setCalendarEntries([]); }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    };

    // ─── Génération contenu ──────────────────────────────────────────────────

    const handleGeneratePost = async () => {
        if (!selectedProduct) {
            Alert.alert('', 'Sélectionnez un produit');
            return;
        }
        setGenerating(true);
        try {
            const resp: any = await apiPost('/api/social-ai/content/generate', {
                service_id: serviceId,
                product_id: selectedProduct.id,
                platform: selectedPlatform,
                tone: selectedTone,
            });
            setGeneratedPost(resp);
            setShowPostModal(true);
        } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? 'Génération impossible');
        } finally {
            setGenerating(false);
        }
    };

    const handleSchedulePost = async () => {
        if (!generatedPost || !selectedProduct) return;
        try {
            await apiPost('/api/social-ai/content/generate', {
                service_id: serviceId,
                product_id: selectedProduct.id,
                platform: selectedPlatform,
                tone: selectedTone,
                schedule_at: scheduleDate || new Date(Date.now() + 3600000).toISOString(),
            });
            setShowPostModal(false);
            Alert.alert('✅ Planifié', 'Le post a été ajouté au calendrier');
            await loadCalendar();
        } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? 'Planification impossible');
        }
    };

    // ─── Chatbot ─────────────────────────────────────────────────────────────

    const handleSaveChatbot = async () => {
        setSavingBot(true);
        try {
            await apiPut(`/api/social-ai/chatbot/config/${serviceId}`, {
                is_active: botActive,
                bot_name: botName,
                welcome_message: welcomeMsg || null,
                away_message: awayMsg || null,
                escalation_trigger_words: escalationWords.split(',').map(w => w.trim()).filter(Boolean),
                reply_delay_ms: replyDelay,
                language: botLanguage,
            });
            Alert.alert('✅ Sauvegardé', 'Configuration chatbot enregistrée');
        } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? 'Impossible de sauvegarder');
        } finally {
            setSavingBot(false);
        }
    };

    // ─── Ads ──────────────────────────────────────────────────────────────────

    const handleSaveAdAccount = async () => {
        if (!adAccountId.trim() || !adAccessToken.trim()) {
            Alert.alert('', 'Renseignez l\'Ad Account ID et le token d\'accès');
            return;
        }
        setSavingAdAccount(true);
        try {
            await apiPost('/api/social-ai/ads/account', {
                service_id: serviceId,
                ad_account_id: adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`,
                access_token: adAccessToken,
                monthly_budget_fcfa: 50000,
            });
            setShowAdAccountModal(false);
            Alert.alert('✅ Enregistré', 'Compte publicitaire connecté');
        } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? 'Connexion impossible');
        } finally {
            setSavingAdAccount(false);
        }
    };

    const handleCreatePromoCampaign = async () => {
        if (!selectedPromoProduct) {
            Alert.alert('', 'Sélectionnez un produit en promotion');
            return;
        }
        setCreatingCampaign(true);
        try {
            const resp: any = await apiPost('/api/social-ai/ads/campaign/promo', {
                service_id: serviceId,
                product_id: selectedPromoProduct.id,
                budget_daily_fcfa: parseInt(adBudget) || 5000,
                countries: ['CM'],
            });
            Alert.alert('✅ Campagne créée !', `Campagne active pour "${selectedPromoProduct.nom}". ID: ${resp?.campaign_id}`);
            await loadCampaigns();
        } catch (e: any) {
            const msg = e?.message ?? '';
            if (msg.includes('non configuré')) {
                Alert.alert(
                    'Compte publicitaire requis',
                    'Configurez votre Ad Account ID Meta d\'abord.',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Configurer', onPress: () => setShowAdAccountModal(true) },
                    ]
                );
            } else {
                Alert.alert('Erreur', msg || 'Création impossible');
            }
        } finally {
            setCreatingCampaign(false);
        }
    };

    const handleCreateDPA = async () => {
        Alert.alert(
            'Dynamic Product Ads',
            'Cette campagne de retargeting cible les visiteurs qui ont vu vos produits sans acheter. Nécessite votre Catalog ID Facebook.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Créer (5 000 FCFA/jour)',
                    onPress: async () => {
                        try {
                            const catalog = await apiGet('/api/social/accounts');
                            const fbAccount = (catalog as any)?.find?.((a: any) => a.platform === 'facebook');
                            const catalogId = fbAccount?.metadata?.catalog_id;
                            if (!catalogId) {
                                Alert.alert('Catalog ID manquant', 'Synchronisez votre catalogue Facebook d\'abord depuis l\'écran Diffusion.');
                                return;
                            }
                            await apiPost('/api/social-ai/ads/dpa', {
                                service_id: serviceId,
                                catalog_id: catalogId,
                                budget_daily_fcfa: 5000,
                                countries: ['CM'],
                            });
                            Alert.alert('✅ DPA actives', 'Le retargeting catalogue est maintenant actif !');
                            await loadCampaigns();
                        } catch (e: any) {
                            Alert.alert('Erreur', e?.message ?? 'Erreur création DPA');
                        }
                    }
                },
            ]
        );
    };

    // ─── Inbox ────────────────────────────────────────────────────────────────

    const handleOpenThread = async (thread: InboxThread) => {
        try {
            const resp: any = await apiGet(`/api/social-ai/inbox/thread/${thread.thread_id}`);
            setSelectedThread(resp?.conversation?.thread ?? thread);
            setThreadMessages(resp?.conversation?.messages ?? []);
            setShowThreadModal(true);
        } catch {
            Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation');
        }
    };

    const handleEscalate = async (threadId: number) => {
        try {
            await apiPost(`/api/social-ai/inbox/thread/${threadId}/escalate`, {
                reason: 'Escalade manuelle depuis l\'app',
            });
            Alert.alert('✅ Escaladé', 'La conversation a été transmise à votre équipe');
            await loadInbox();
        } catch { }
    };

    // ─── Renders ─────────────────────────────────────────────────────────────

    const renderContentTab = () => (
        <ScrollView
            contentContainerStyle={styles.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        >
            <Text style={styles.sectionTitle}>Générer du contenu IA</Text>
            <Text style={styles.sectionSubtitle}>
                GPT-4o crée automatiquement des posts adaptés à chaque plateforme avec votre ton de marque.
            </Text>

            {/* Sélection produit */}
            <Text style={styles.fieldLabel}>Produit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScroll}>
                {products.slice(0, 15).map((p) => (
                    <TouchableOpacity
                        key={p.id}
                        style={[styles.productChip, selectedProduct?.id === p.id && styles.productChipSelected]}
                        onPress={() => setSelectedProduct(p)}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.productChipText, selectedProduct?.id === p.id && styles.productChipTextSel]} numberOfLines={1}>
                            {p.nom}
                        </Text>
                        {p.sale_price && <View style={styles.promoDotp} />}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Plateforme cible */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Plateforme</Text>
            <View style={styles.platformRow}>
                {['facebook', 'instagram', 'whatsapp'].map((plt) => {
                    const cfg = PLATFORM_CONFIG[plt];
                    const active = selectedPlatform === plt;
                    return (
                        <TouchableOpacity
                            key={plt}
                            style={[styles.platformChip, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                            onPress={() => setSelectedPlatform(plt)}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name={cfg.icon as any} size={14} color={active ? '#fff' : '#9CA3AF'} />
                            <Text style={[styles.platformChipText, active && { color: '#fff' }]}>{cfg.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Ton */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Ton</Text>
            <View style={styles.toneRow}>
                {TONES.map((t) => (
                    <TouchableOpacity
                        key={t.key}
                        style={[styles.toneChip, selectedTone === t.key && styles.toneChipActive]}
                        onPress={() => setSelectedTone(t.key)}
                        activeOpacity={0.8}
                    >
                        <SafeIcon name={t.icon as any} size={13} color={selectedTone === t.key ? '#8B5CF6' : '#6B7280'} />
                        <Text style={[styles.toneChipText, selectedTone === t.key && styles.toneChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Bouton générer */}
            <TouchableOpacity
                style={[styles.generateBtn, (!selectedProduct || generating) && styles.generateBtnDisabled]}
                onPress={handleGeneratePost}
                disabled={!selectedProduct || generating}
                activeOpacity={0.85}
            >
                {generating ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <SafeIcon name="zap" size={18} color="#fff" />
                        <Text style={styles.generateBtnText}>
                            {selectedProduct ? `Générer pour "${selectedProduct.nom}"` : 'Sélectionnez un produit'}
                        </Text>
                    </>
                )}
            </TouchableOpacity>

            {/* Info box */}
            <View style={styles.infoBox}>
                <SafeIcon name="info" size={14} color="#8B5CF6" />
                <Text style={styles.infoText}>
                    Yukpo génère 3 variantes (Facebook, Instagram, WhatsApp) + une variante A/B pour tester le meilleur message.
                    Tous les liens incluent un tunnel UTM vers votre boutique.
                </Text>
            </View>
        </ScrollView>
    );

    const renderChatbotTab = () => (
        <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionTitle}>Community Manager IA</Text>
            <Text style={styles.sectionSubtitle}>
                Yukpo répond automatiquement à vos clients sur Messenger, Instagram DM et WhatsApp Business — 24h/24, 7j/7.
            </Text>

            {/* Activer/désactiver */}
            <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Bot actif</Text>
                    <Text style={styles.settingDesc}>
                        {botActive ? '🤖 Réponses automatiques activées' : 'Bot désactivé — pas de réponse automatique'}
                    </Text>
                </View>
                <Switch
                    value={botActive}
                    onValueChange={setBotActive}
                    trackColor={{ false: '#374151', true: '#8B5CF6' }}
                    thumbColor="#fff"
                />
            </View>

            {/* Nom du bot */}
            <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Nom de l'assistant</Text>
                <TextInput
                    style={styles.textInput}
                    value={botName}
                    onChangeText={setBotName}
                    placeholder="Ex: Marie, Assistant Boutique..."
                    placeholderTextColor="#6B7280"
                />
            </View>

            {/* Langue */}
            <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Langue principale</Text>
                <View style={styles.langRow}>
                    {['fr', 'en'].map((l) => (
                        <TouchableOpacity
                            key={l}
                            style={[styles.langChip, botLanguage === l && styles.langChipActive]}
                            onPress={() => setBotLanguage(l)}
                        >
                            <Text style={[styles.langText, botLanguage === l && styles.langTextActive]}>
                                {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 Anglais'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Message de bienvenue */}
            <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Message de bienvenue (optionnel)</Text>
                <TextInput
                    style={[styles.textInput, styles.textInputMulti]}
                    value={welcomeMsg}
                    onChangeText={setWelcomeMsg}
                    placeholder={`Bonjour ! Je suis ${botName}, comment puis-je vous aider ?`}
                    placeholderTextColor="#6B7280"
                    multiline
                    numberOfLines={3}
                />
            </View>

            {/* Message hors horaires */}
            <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Message hors horaires</Text>
                <TextInput
                    style={[styles.textInput, styles.textInputMulti]}
                    value={awayMsg}
                    onChangeText={setAwayMsg}
                    placeholder="Merci pour votre message ! Nous sommes actuellement fermés..."
                    placeholderTextColor="#6B7280"
                    multiline
                    numberOfLines={3}
                />
            </View>

            {/* Mots d'escalade */}
            <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Mots-clés d'escalade (virgule)</Text>
                <TextInput
                    style={styles.textInput}
                    value={escalationWords}
                    onChangeText={setEscalationWords}
                    placeholder="plainte, arnaque, remboursement, responsable"
                    placeholderTextColor="#6B7280"
                />
                <Text style={styles.fieldHint}>
                    Si ces mots apparaissent, la conversation est transmise à votre équipe.
                </Text>
            </View>

            {/* Délai de réponse */}
            <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Délai avant réponse (ms)</Text>
                <View style={styles.stepperRow}>
                    {[500, 1000, 1500, 3000, 5000].map((d) => (
                        <TouchableOpacity
                            key={d}
                            style={[styles.stepperBtn, replyDelay === d && styles.stepperBtnActive]}
                            onPress={() => setReplyDelay(d)}
                        >
                            <Text style={[styles.stepperText, replyDelay === d && styles.stepperTextActive]}>
                                {d / 1000}s
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Statut webhooks */}
            <View style={styles.webhookCard}>
                <SafeIcon name="link" size={16} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                    <Text style={styles.webhookTitle}>Configuration webhooks Meta</Text>
                    <Text style={styles.webhookDesc}>
                        Dans Facebook Business Manager, configurez les webhooks:{'\n'}
                        • Messenger: POST /api/social-ai/webhook/messenger{'\n'}
                        • Instagram: POST /api/social-ai/webhook/instagram{'\n'}
                        • WhatsApp: POST /api/social-ai/webhook/whatsapp{'\n'}
                        Token de vérification: {`yukpo_webhook_2026`}
                    </Text>
                </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChatbot} disabled={savingBot}>
                {savingBot ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.saveBtnText}>Sauvegarder la configuration</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );

    const renderAdsTab = () => {
        const promoProducts = products.filter(p => p.sale_price && p.sale_price < p.prix);
        const totalSpent = campaigns.reduce((s, c) => s + (c.spent_fcfa || 0), 0);
        const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);

        return (
            <ScrollView contentContainerStyle={styles.tabContent}>
                <Text style={styles.sectionTitle}>Publicités Meta automatiques</Text>

                {/* KPIs */}
                {campaigns.length > 0 && (
                    <View style={styles.kpiRow}>
                        <View style={styles.kpiCard}>
                            <Text style={styles.kpiValue}>{campaigns.length}</Text>
                            <Text style={styles.kpiLabel}>Campagnes</Text>
                        </View>
                        <View style={styles.kpiCard}>
                            <Text style={[styles.kpiValue, { color: '#EF4444' }]}>{totalSpent.toLocaleString()}</Text>
                            <Text style={styles.kpiLabel}>Dépensés FCFA</Text>
                        </View>
                        <View style={styles.kpiCard}>
                            <Text style={[styles.kpiValue, { color: '#10B981' }]}>{totalConversions}</Text>
                            <Text style={styles.kpiLabel}>Conversions</Text>
                        </View>
                    </View>
                )}

                {/* Connexion compte pub */}
                <TouchableOpacity style={styles.adAccountBtn} onPress={() => setShowAdAccountModal(true)}>
                    <SafeIcon name="plus-circle" size={16} color="#1877F2" />
                    <Text style={styles.adAccountBtnText}>
                        {adAccountId ? `Compte: act_${adAccountId.replace('act_', '')}` : 'Connecter un compte publicitaire Meta'}
                    </Text>
                </TouchableOpacity>

                {/* Campagne promo auto */}
                <View style={styles.adsCard}>
                    <View style={styles.adsCardHeader}>
                        <SafeIcon name="tag" size={18} color="#F59E0B" />
                        <Text style={styles.adsCardTitle}>Campagne Promotion</Text>
                    </View>
                    <Text style={styles.adsCardDesc}>
                        Créez automatiquement une campagne Facebook/Instagram pour un produit en promotion.
                        Yukpo génère le visuel, le texte et cible votre audience.
                    </Text>

                    {/* Sélection produit promo */}
                    <Text style={styles.fieldLabel}>Produit en promo</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        {promoProducts.slice(0, 8).map((p) => (
                            <TouchableOpacity
                                key={p.id}
                                style={[styles.promoProductChip, selectedPromoProduct?.id === p.id && styles.promoProductChipSel]}
                                onPress={() => setSelectedPromoProduct(p)}
                            >
                                <Text style={[styles.promoProductText, selectedPromoProduct?.id === p.id && { color: '#fff' }]}>
                                    {p.nom} — {p.sale_price?.toLocaleString()} {devise}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        {promoProducts.length === 0 && (
                            <Text style={styles.noPromoText}>Aucun produit en promo actuellement</Text>
                        )}
                    </ScrollView>

                    {/* Budget */}
                    <Text style={styles.fieldLabel}>Budget journalier (FCFA)</Text>
                    <View style={styles.stepperRow}>
                        {['2000', '5000', '10000', '20000'].map((b) => (
                            <TouchableOpacity
                                key={b}
                                style={[styles.stepperBtn, adBudget === b && styles.stepperBtnActive]}
                                onPress={() => setAdBudget(b)}
                            >
                                <Text style={[styles.stepperText, adBudget === b && styles.stepperTextActive]}>
                                    {parseInt(b).toLocaleString()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.createCampaignBtn, creatingCampaign && { opacity: 0.6 }]}
                        onPress={handleCreatePromoCampaign}
                        disabled={creatingCampaign}
                    >
                        {creatingCampaign ? <ActivityIndicator size="small" color="#fff" /> : (
                            <Text style={styles.createCampaignBtnText}>🚀 Lancer la campagne</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Dynamic Product Ads */}
                <View style={styles.adsCard}>
                    <View style={styles.adsCardHeader}>
                        <SafeIcon name="refresh-cw" size={18} color="#8B5CF6" />
                        <Text style={styles.adsCardTitle}>Dynamic Product Ads (Retargeting)</Text>
                    </View>
                    <Text style={styles.adsCardDesc}>
                        Ciblez automatiquement les personnes qui ont visité votre boutique Yukpo sans acheter.
                        Nécessite votre catalogue Facebook synchronisé.
                    </Text>
                    <TouchableOpacity style={styles.dpaBtn} onPress={handleCreateDPA}>
                        <Text style={styles.dpaBtnText}>Activer le retargeting</Text>
                    </TouchableOpacity>
                </View>

                {/* Liste campagnes */}
                {campaigns.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Mes campagnes</Text>
                        {campaigns.map((c) => {
                            const statusColor = c.status === 'active' ? '#10B981' : c.status === 'paused' ? '#F59E0B' : '#6B7280';
                            return (
                                <View key={c.id} style={styles.campaignCard}>
                                    <View style={styles.campaignHeader}>
                                        <Text style={styles.campaignName} numberOfLines={1}>{c.name}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                                            <Text style={[styles.statusText, { color: statusColor }]}>{c.status}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.campaignMetrics}>
                                        <View style={styles.metricItem}>
                                            <Text style={styles.metricValue}>{(c.impressions || 0).toLocaleString()}</Text>
                                            <Text style={styles.metricLabel}>Impressions</Text>
                                        </View>
                                        <View style={styles.metricItem}>
                                            <Text style={styles.metricValue}>{c.clicks || 0}</Text>
                                            <Text style={styles.metricLabel}>Clics</Text>
                                        </View>
                                        <View style={styles.metricItem}>
                                            <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                                                {(c.spent_fcfa || 0).toLocaleString()}
                                            </Text>
                                            <Text style={styles.metricLabel}>FCFA dépensés</Text>
                                        </View>
                                        <View style={styles.metricItem}>
                                            <Text style={[styles.metricValue, { color: '#10B981' }]}>
                                                {c.roas ? c.roas.toFixed(1) : '—'}x
                                            </Text>
                                            <Text style={styles.metricLabel}>ROAS</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}
            </ScrollView>
        );
    };

    const renderInboxTab = () => (
        <View style={{ flex: 1 }}>
            {/* Stats inbox */}
            {inboxStats && (
                <View style={styles.inboxStatsRow}>
                    <View style={styles.inboxStat}>
                        <Text style={styles.inboxStatValue}>{inboxStats.total_conversations}</Text>
                        <Text style={styles.inboxStatLabel}>Total</Text>
                    </View>
                    <View style={styles.inboxStat}>
                        <Text style={[styles.inboxStatValue, { color: '#F59E0B' }]}>{inboxStats.unread_conversations}</Text>
                        <Text style={styles.inboxStatLabel}>Non lus</Text>
                    </View>
                    <View style={styles.inboxStat}>
                        <Text style={[styles.inboxStatValue, { color: '#EF4444' }]}>{inboxStats.escalated}</Text>
                        <Text style={styles.inboxStatLabel}>Escaladés</Text>
                    </View>
                    <View style={styles.inboxStat}>
                        <Text style={[styles.inboxStatValue, { color: '#10B981' }]}>{inboxStats.bot_handled_today}</Text>
                        <Text style={styles.inboxStatLabel}>Bot aujourd'hui</Text>
                    </View>
                </View>
            )}

            {/* Filtres */}
            <View style={styles.inboxFilterRow}>
                {['all', 'unread', 'escalated', 'starred'].map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterChip, inboxFilter === f && styles.filterChipActive]}
                        onPress={() => { setInboxFilter(f); loadInbox(); }}
                    >
                        <Text style={[styles.filterChipText, inboxFilter === f && styles.filterChipTextActive]}>
                            {f === 'all' ? 'Tous' : f === 'unread' ? 'Non lus' : f === 'escalated' ? 'Escaladés' : 'Étoilés'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={threads}
                keyExtractor={(t) => String(t.id)}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
                renderItem={({ item }) => {
                    const plt = PLATFORM_CONFIG[item.platform] ?? PLATFORM_CONFIG['messenger'];
                    return (
                        <TouchableOpacity
                            style={[styles.threadRow, item.is_escalated && styles.threadRowEscalated]}
                            onPress={() => handleOpenThread(item)}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.threadIcon, { backgroundColor: plt.color + '22' }]}>
                                <SafeIcon name={plt.icon as any} size={20} color={plt.color} />
                            </View>
                            <View style={styles.threadMeta}>
                                <View style={styles.threadHeaderRow}>
                                    <Text style={styles.threadSender} numberOfLines={1}>
                                        {item.sender_name ?? 'Utilisateur inconnu'}
                                    </Text>
                                    {item.last_message_at && (
                                        <Text style={styles.threadTime}>
                                            {new Date(item.last_message_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.threadPreview} numberOfLines={1}>
                                    {item.last_message_preview ?? 'Aucun message'}
                                </Text>
                                <View style={styles.threadTags}>
                                    <Text style={[styles.threadPlatformTag, { color: plt.color }]}>{plt.label}</Text>
                                    {item.is_escalated && (
                                        <View style={styles.escalatedTag}>
                                            <Text style={styles.escalatedTagText}>⚠️ Escaladé</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            {item.unread_count > 0 && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyInbox}>
                        <SafeIcon name="inbox" size={48} color="#374151" />
                        <Text style={styles.emptyTitle}>Inbox vide</Text>
                        <Text style={styles.emptyDesc}>
                            Les messages de vos clients apparaîtront ici une fois les webhooks configurés.
                        </Text>
                    </View>
                }
            />
        </View>
    );

    const renderCalendarTab = () => (
        <ScrollView
            contentContainerStyle={styles.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        >
            <Text style={styles.sectionTitle}>Calendrier éditorial</Text>
            <Text style={styles.sectionSubtitle}>Posts planifiés et publiés par Yukpo AI</Text>

            {calendarEntries.length === 0 ? (
                <View style={styles.emptyCalendar}>
                    <SafeIcon name="calendar" size={48} color="#374151" />
                    <Text style={styles.emptyTitle}>Aucun post planifié</Text>
                    <Text style={styles.emptyDesc}>
                        Activez la distribution automatique dans l'onglet Diffusion ou générez un post manuellement.
                    </Text>
                </View>
            ) : (
                calendarEntries.map((entry) => {
                    const plt = PLATFORM_CONFIG[entry.platform] ?? PLATFORM_CONFIG['facebook'];
                    const statusColor = entry.status === 'published' ? '#10B981' : entry.status === 'scheduled' ? '#F59E0B' : '#6B7280';
                    const d = new Date(entry.scheduled_at);
                    return (
                        <View key={entry.id} style={styles.calendarCard}>
                            <View style={styles.calendarDate}>
                                <Text style={styles.calendarDay}>{d.getDate()}</Text>
                                <Text style={styles.calendarMonth}>
                                    {d.toLocaleDateString('fr-FR', { month: 'short' })}
                                </Text>
                                <Text style={styles.calendarHour}>{d.getHours()}h</Text>
                            </View>
                            <View style={styles.calendarContent}>
                                <View style={styles.calendarHeader}>
                                    <SafeIcon name={plt.icon as any} size={14} color={plt.color} />
                                    <Text style={styles.calendarPlatform}>{plt.label}</Text>
                                    <View style={[styles.calendarStatus, { backgroundColor: statusColor + '22' }]}>
                                        <Text style={[styles.calendarStatusText, { color: statusColor }]}>{entry.status}</Text>
                                    </View>
                                </View>
                                {entry.product_name && (
                                    <Text style={styles.calendarProduct}>{entry.product_name}</Text>
                                )}
                                <Text style={styles.calendarCaption} numberOfLines={2}>{entry.caption_preview}</Text>
                                <Text style={styles.calendarTone}>Ton: {entry.tone}</Text>
                            </View>
                        </View>
                    );
                })
            )}
        </ScrollView>
    );

    // ─── Modals ───────────────────────────────────────────────────────────────

    const renderPostModal = () => (
        <Modal visible={showPostModal} transparent animationType="slide" onRequestClose={() => setShowPostModal(false)}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
                    <ScrollView>
                        <Text style={styles.modalTitle}>Post généré ✨</Text>
                        {generatedPost && (
                            <>
                                <Text style={styles.modalSectionLabel}>Version principale</Text>
                                <View style={styles.captionBox}>
                                    <Text style={styles.captionText}>{generatedPost.caption_a}</Text>
                                </View>

                                {generatedPost.caption_b && (
                                    <>
                                        <Text style={[styles.modalSectionLabel, { color: '#F59E0B' }]}>Variante A/B</Text>
                                        <View style={[styles.captionBox, { borderColor: '#F59E0B44' }]}>
                                            <Text style={styles.captionText}>{generatedPost.caption_b}</Text>
                                        </View>
                                    </>
                                )}

                                {generatedPost.story_text && (
                                    <>
                                        <Text style={styles.modalSectionLabel}>Story / Status</Text>
                                        <View style={[styles.captionBox, { borderColor: '#E1306C44' }]}>
                                            <Text style={styles.captionText}>{generatedPost.story_text}</Text>
                                        </View>
                                    </>
                                )}

                                <Text style={styles.modalSectionLabel}>Hashtags ({generatedPost.hashtags.length})</Text>
                                <Text style={styles.hashtagsText}>
                                    {generatedPost.hashtags.map(h => `#${h}`).join(' ')}
                                </Text>
                            </>
                        )}
                    </ScrollView>

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPostModal(false)}>
                            <Text style={styles.modalCancelText}>Fermer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSchedulePost}>
                            <Text style={styles.modalSaveText}>Planifier</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderAdAccountModal = () => (
        <Modal visible={showAdAccountModal} transparent animationType="slide" onRequestClose={() => setShowAdAccountModal(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalSheet}>
                    <Text style={styles.modalTitle}>Compte publicitaire Meta</Text>
                    <Text style={styles.modalSubtitle}>
                        Trouvez votre Ad Account ID dans Meta Business Manager → Comptes publicitaires
                    </Text>
                    <TextInput
                        style={styles.textInput}
                        value={adAccountId}
                        onChangeText={setAdAccountId}
                        placeholder="Ex: act_1234567890"
                        placeholderTextColor="#6B7280"
                        autoFocus
                    />
                    <Text style={[styles.modalSubtitle, { marginTop: 10 }]}>Token d'accès (Marketing API)</Text>
                    <TextInput
                        style={styles.textInput}
                        value={adAccessToken}
                        onChangeText={setAdAccessToken}
                        placeholder="Token d'accès long-lived"
                        placeholderTextColor="#6B7280"
                        secureTextEntry
                    />
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAdAccountModal(false)}>
                            <Text style={styles.modalCancelText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalSaveBtn, savingAdAccount && { opacity: 0.6 }]}
                            onPress={handleSaveAdAccount}
                            disabled={savingAdAccount}
                        >
                            {savingAdAccount ? <ActivityIndicator size="small" color="#fff" /> : (
                                <Text style={styles.modalSaveText}>Connecter</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderThreadModal = () => (
        <Modal visible={showThreadModal} transparent animationType="slide" onRequestClose={() => setShowThreadModal(false)}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
                    <Text style={styles.modalTitle}>
                        {selectedThread?.sender_name ?? 'Conversation'}
                    </Text>
                    <ScrollView style={{ maxHeight: 300, marginBottom: 12 }}>
                        {threadMessages.map((m: any) => (
                            <View
                                key={m.id}
                                style={[
                                    styles.msgBubble,
                                    m.direction === 'outbound' ? styles.msgBubbleOut : styles.msgBubbleIn,
                                ]}
                            >
                                <Text style={[styles.msgText, m.direction === 'outbound' && { color: '#fff' }]}>
                                    {m.content}
                                </Text>
                                <Text style={styles.msgMeta}>
                                    {m.sender_type === 'bot' ? '🤖' : m.sender_type === 'human_agent' ? '👤' : '💬'}
                                    {' '}{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                    <View style={styles.modalActions}>
                        {selectedThread?.is_escalated ? (
                            <TouchableOpacity
                                style={[styles.modalSaveBtn, { backgroundColor: '#10B981' }]}
                                onPress={async () => {
                                    await apiPost(`/api/social-ai/inbox/thread/${selectedThread?.thread_id}/resolve`, {});
                                    setShowThreadModal(false);
                                    await loadInbox();
                                }}
                            >
                                <Text style={styles.modalSaveText}>✅ Résoudre</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.modalSaveBtn, { backgroundColor: '#EF4444' }]}
                                onPress={() => {
                                    setShowThreadModal(false);
                                    handleEscalate(selectedThread?.thread_id);
                                }}
                            >
                                <Text style={styles.modalSaveText}>⚠️ Escalader</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowThreadModal(false)}>
                            <Text style={styles.modalCancelText}>Fermer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // ─── Layout ───────────────────────────────────────────────────────────────

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'content', label: 'Contenu', icon: 'edit-3' },
        { key: 'chatbot', label: 'Chatbot', icon: 'message-circle' },
        { key: 'ads', label: 'Pubs', icon: 'trending-up' },
        { key: 'inbox', label: 'Inbox', icon: 'inbox' },
        { key: 'calendar', label: 'Calendrier', icon: 'calendar' },
    ];

    const unreadCount = threads.filter(t => t.unread_count > 0).length;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#F9FAFB" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Social AI Engine</Text>
                    <Text style={styles.headerSub} numberOfLines={1}>{serviceName}</Text>
                </View>
                {unreadCount > 0 && (
                    <View style={styles.unreadHeaderBadge}>
                        <Text style={styles.unreadHeaderBadgeText}>{unreadCount}</Text>
                    </View>
                )}
            </View>

            {/* Tab bar */}
            <View style={styles.tabBar}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
                        onPress={() => setActiveTab(tab.key)}
                        activeOpacity={0.75}
                    >
                        <View style={{ position: 'relative' }}>
                            <SafeIcon name={tab.icon as any} size={15} color={activeTab === tab.key ? '#8B5CF6' : '#6B7280'} />
                            {tab.key === 'inbox' && unreadCount > 0 && (
                                <View style={styles.tabDot} />
                            )}
                        </View>
                        <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Contenu */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {activeTab === 'content' && renderContentTab()}
                    {activeTab === 'chatbot' && renderChatbotTab()}
                    {activeTab === 'ads' && renderAdsTab()}
                    {activeTab === 'inbox' && renderInboxTab()}
                    {activeTab === 'calendar' && renderCalendarTab()}
                </View>
            )}

            {renderPostModal()}
            {renderAdAccountModal()}
            {renderThreadModal()}
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111827' },
    // Header
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#1F2937', borderBottomWidth: 1, borderBottomColor: '#374151' },
    backBtn: { padding: 4, marginRight: 8 },
    headerCenter: { flex: 1 },
    headerTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
    headerSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    unreadHeaderBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    unreadHeaderBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    // Tabs
    tabBar: { flexDirection: 'row', backgroundColor: '#1F2937', borderBottomWidth: 1, borderBottomColor: '#374151', paddingBottom: 2 },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#8B5CF6' },
    tabLabel: { color: '#6B7280', fontSize: 10, fontWeight: '500' },
    tabLabelActive: { color: '#8B5CF6' },
    tabDot: { position: 'absolute', top: -2, right: -3, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' },
    // Loading
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: '#9CA3AF', fontSize: 14 },
    // Common
    tabContent: { padding: 16, paddingBottom: 40 },
    sectionTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    sectionSubtitle: { color: '#9CA3AF', fontSize: 13, lineHeight: 18, marginBottom: 16 },
    fieldLabel: { color: '#E5E7EB', fontSize: 13, fontWeight: '600', marginBottom: 8 },
    fieldHint: { color: '#6B7280', fontSize: 11, marginTop: 4 },
    infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#8B5CF622', borderRadius: 10, padding: 12, marginTop: 12, alignItems: 'flex-start' },
    infoText: { color: '#C4B5FD', fontSize: 12, lineHeight: 17, flex: 1 },
    // Content AI
    productScroll: { marginBottom: 4 },
    productChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#374151', marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
    productChipSelected: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
    productChipText: { color: '#9CA3AF', fontSize: 12 },
    productChipTextSel: { color: '#fff' },
    promoDotp: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
    platformRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    platformChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#374151' },
    platformChipText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
    toneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    toneChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#374151' },
    toneChipActive: { borderColor: '#8B5CF6', backgroundColor: '#8B5CF611' },
    toneChipText: { color: '#6B7280', fontSize: 12 },
    toneChipTextActive: { color: '#8B5CF6', fontWeight: '600' },
    generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 15, marginTop: 16 },
    generateBtnDisabled: { backgroundColor: '#374151' },
    generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    // Chatbot
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F2937', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#374151' },
    settingInfo: { flex: 1 },
    settingLabel: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', marginBottom: 4 },
    settingDesc: { color: '#9CA3AF', fontSize: 12 },
    inputGroup: { marginBottom: 14 },
    textInput: { backgroundColor: '#1F2937', color: '#F9FAFB', borderRadius: 10, padding: 12, fontSize: 13, borderWidth: 1, borderColor: '#374151' },
    textInputMulti: { minHeight: 80, textAlignVertical: 'top' },
    langRow: { flexDirection: 'row', gap: 10 },
    langChip: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
    langChipActive: { borderColor: '#8B5CF6', backgroundColor: '#8B5CF611' },
    langText: { color: '#9CA3AF', fontSize: 13 },
    langTextActive: { color: '#8B5CF6', fontWeight: '600' },
    stepperRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    stepperBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
    stepperBtnActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
    stepperText: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },
    stepperTextActive: { color: '#fff' },
    webhookCard: { flexDirection: 'row', gap: 10, backgroundColor: '#F59E0B11', borderRadius: 10, padding: 12, marginBottom: 16, alignItems: 'flex-start', borderWidth: 1, borderColor: '#F59E0B33' },
    webhookTitle: { color: '#FDE68A', fontSize: 13, fontWeight: '600', marginBottom: 4 },
    webhookDesc: { color: '#FDE68A', fontSize: 11, lineHeight: 17, opacity: 0.8 },
    saveBtn: { backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    // Ads
    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    kpiCard: { flex: 1, backgroundColor: '#1F2937', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
    kpiValue: { color: '#F9FAFB', fontSize: 20, fontWeight: '800', marginBottom: 2 },
    kpiLabel: { color: '#9CA3AF', fontSize: 10, textAlign: 'center' },
    adAccountBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1877F222', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#1877F244' },
    adAccountBtnText: { color: '#1877F2', fontSize: 13, fontWeight: '600', flex: 1 },
    adsCard: { backgroundColor: '#1F2937', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#374151' },
    adsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    adsCardTitle: { color: '#F9FAFB', fontSize: 14, fontWeight: '700' },
    adsCardDesc: { color: '#9CA3AF', fontSize: 12, lineHeight: 17, marginBottom: 12 },
    promoProductChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EF444444', marginRight: 8 },
    promoProductChipSel: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    promoProductText: { color: '#EF4444', fontSize: 12 },
    noPromoText: { color: '#6B7280', fontSize: 12, paddingVertical: 8 },
    createCampaignBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1877F2', borderRadius: 10, paddingVertical: 12, marginTop: 10 },
    createCampaignBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    dpaBtn: { backgroundColor: '#8B5CF622', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#8B5CF644' },
    dpaBtnText: { color: '#8B5CF6', fontSize: 13, fontWeight: '600' },
    campaignCard: { backgroundColor: '#1F2937', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#374151' },
    campaignHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    campaignName: { color: '#F9FAFB', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
    statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '600' },
    campaignMetrics: { flexDirection: 'row', justifyContent: 'space-between' },
    metricItem: { alignItems: 'center' },
    metricValue: { color: '#F9FAFB', fontSize: 14, fontWeight: '700' },
    metricLabel: { color: '#6B7280', fontSize: 10, marginTop: 2 },
    // Inbox
    inboxStatsRow: { flexDirection: 'row', backgroundColor: '#1F2937', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#374151' },
    inboxStat: { flex: 1, alignItems: 'center' },
    inboxStatValue: { color: '#F9FAFB', fontSize: 18, fontWeight: '800' },
    inboxStatLabel: { color: '#6B7280', fontSize: 10, marginTop: 2 },
    inboxFilterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6, backgroundColor: '#1F2937', borderBottomWidth: 1, borderBottomColor: '#374151' },
    filterChip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: '#374151' },
    filterChipActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
    filterChipText: { color: '#9CA3AF', fontSize: 12 },
    filterChipTextActive: { color: '#fff', fontWeight: '600' },
    threadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 10 },
    threadRowEscalated: { backgroundColor: '#EF444408' },
    threadIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    threadMeta: { flex: 1 },
    threadHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    threadSender: { color: '#F9FAFB', fontSize: 13, fontWeight: '600', flex: 1 },
    threadTime: { color: '#6B7280', fontSize: 11 },
    threadPreview: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    threadTags: { flexDirection: 'row', gap: 6, marginTop: 4 },
    threadPlatformTag: { fontSize: 10, fontWeight: '600' },
    escalatedTag: { backgroundColor: '#EF444422', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    escalatedTagText: { color: '#EF4444', fontSize: 10, fontWeight: '600' },
    unreadBadge: { backgroundColor: '#8B5CF6', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    emptyInbox: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
    emptyTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
    emptyDesc: { color: '#6B7280', fontSize: 13, textAlign: 'center', lineHeight: 18 },
    // Calendar
    calendarCard: { flexDirection: 'row', backgroundColor: '#1F2937', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#374151', gap: 12 },
    calendarDate: { alignItems: 'center', minWidth: 44 },
    calendarDay: { color: '#F9FAFB', fontSize: 22, fontWeight: '800' },
    calendarMonth: { color: '#9CA3AF', fontSize: 11, textTransform: 'uppercase' },
    calendarHour: { color: '#8B5CF6', fontSize: 12, fontWeight: '600', marginTop: 2 },
    calendarContent: { flex: 1 },
    calendarHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    calendarPlatform: { color: '#9CA3AF', fontSize: 12, flex: 1 },
    calendarStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    calendarStatusText: { fontSize: 10, fontWeight: '600' },
    calendarProduct: { color: '#F9FAFB', fontSize: 13, fontWeight: '600', marginBottom: 2 },
    calendarCaption: { color: '#9CA3AF', fontSize: 12, lineHeight: 16 },
    calendarTone: { color: '#6B7280', fontSize: 10, marginTop: 4 },
    emptyCalendar: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
    // Messages chat
    msgBubble: { maxWidth: '80%', padding: 10, borderRadius: 12, marginBottom: 6 },
    msgBubbleIn: { backgroundColor: '#1F2937', alignSelf: 'flex-start' },
    msgBubbleOut: { backgroundColor: '#8B5CF6', alignSelf: 'flex-end' },
    msgText: { color: '#F9FAFB', fontSize: 13, lineHeight: 18 },
    msgMeta: { color: '#9CA3AF', fontSize: 10, marginTop: 3 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#1F2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
    modalTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    modalSubtitle: { color: '#9CA3AF', fontSize: 12, marginBottom: 10 },
    modalSectionLabel: { color: '#E5E7EB', fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 6 },
    captionBox: { backgroundColor: '#111827', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#374151' },
    captionText: { color: '#F9FAFB', fontSize: 13, lineHeight: 20 },
    hashtagsText: { color: '#8B5CF6', fontSize: 12, lineHeight: 18 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
    modalCancelText: { color: '#9CA3AF', fontWeight: '600' },
    modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#8B5CF6', alignItems: 'center' },
    modalSaveText: { color: '#fff', fontWeight: '700' },
});

export default SocialAIScreen;
