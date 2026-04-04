// Écran de distribution multi-canaux pour partenaires supermarché / e-commerce
// Tabs: Plateformes | Diffuser | Auto | Stats

import React, { useCallback, useEffect, useState } from 'react';
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TabType = 'platforms' | 'distribute' | 'auto' | 'stats';

interface SocialAccount {
    id: number;
    platform: string;
    account_handle: string | null;
    expires_at: string | null;
    metadata: Record<string, any>;
}

interface Product {
    id: number;
    nom: string;
    prix: number;
    categorie: string;
    en_promotion: boolean;
    prix_promo?: number;
    image_url?: string;
}

interface DistributionRules {
    auto_distribute: boolean;
    frequency: string;
    products_per_day: number;
    schedule_hour: number;
    target_platforms: string[];
    filter: string;
}

interface PlatformStat {
    platform: string;
    total_posts: number;
    completed: number;
    failed: number;
    clicks_back: number;
    last_post_at: string | null;
}

interface RecentJob {
    id: number;
    platform: string;
    status: string;
    product_name: string | null;
    clicks_back: number;
    created_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config plateformes
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORMS_CONFIG = [
    {
        key: 'facebook',
        label: 'Facebook Page',
        icon: 'facebook',
        color: '#1877F2',
        description: 'Publie sur ta Page Business + boutique Facebook Shop',
        oauthEndpoint: '/api/social/facebook/authorize',
        hasOAuth: true,
    },
    {
        key: 'instagram',
        label: 'Instagram Business',
        icon: 'instagram',
        color: '#E1306C',
        description: 'Posts produits + Shopping tags Instagram',
        oauthEndpoint: '/api/social/instagram/authorize',
        hasOAuth: true,
    },
    {
        key: 'youtube',
        label: 'YouTube',
        icon: 'youtube',
        color: '#FF0000',
        description: 'Uploads vidéos produits sur ta chaîne',
        oauthEndpoint: '/api/social/youtube/authorize',
        hasOAuth: true,
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp Business',
        icon: 'message-circle',
        color: '#25D366',
        description: 'Catalogue WhatsApp Business visible par tes contacts',
        oauthEndpoint: '/api/social/whatsapp/info',
        hasOAuth: false,
    },
    {
        key: 'google_shopping',
        label: 'Google Shopping',
        icon: 'shopping-bag',
        color: '#4285F4',
        description: 'Flux XML auto pour Google Merchant Center',
        oauthEndpoint: null,
        hasOAuth: false,
        isFeed: true,
    },
    {
        key: 'jumia',
        label: 'Jumia / Marchés',
        icon: 'download',
        color: '#F68B1E',
        description: 'Export CSV au format Jumia Seller Center',
        oauthEndpoint: null,
        hasOAuth: false,
        isFeed: true,
    },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

const SocialDistributionScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { user } = useAuth();
    const devise = getCurrencyIntelligently() || 'FCFA';

    const serviceId: number = route.params?.serviceId ?? 0;
    const serviceName: string = route.params?.serviceName ?? 'Ma boutique';
    const partnerId: number = serviceId;

    const [activeTab, setActiveTab] = useState<TabType>('platforms');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Plateformes connectées
    const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
    const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

    // Distribution manuelle
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
    const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
        new Set(['facebook', 'whatsapp'])
    );
    const [messageTemplate, setMessageTemplate] = useState('');
    const [distributing, setDistributing] = useState(false);
    const [showTemplateEditor, setShowTemplateEditor] = useState(false);

    // Règles automatiques
    const [rules, setRules] = useState<DistributionRules>({
        auto_distribute: false,
        frequency: 'daily',
        products_per_day: 5,
        schedule_hour: 18,
        target_platforms: ['facebook', 'whatsapp'],
        filter: 'all',
    });
    const [savingRules, setSavingRules] = useState(false);

    // Stats
    const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
    const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

    // ─── Chargement données ──────────────────────────────────────────────────

    const loadAll = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            await Promise.all([
                loadAccounts(),
                loadProducts(),
                loadRules(),
                loadStats(),
            ]);
        } finally {
            setLoading(false);
        }
    }, [user, serviceId]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const loadAccounts = async () => {
        try {
            const resp: any = await apiGet('/api/social/accounts');
            setConnectedAccounts(Array.isArray(resp) ? resp : (resp?.data ?? []));
        } catch {
            setConnectedAccounts([]);
        }
    };

    const loadProducts = async () => {
        if (!serviceId) return;
        try {
            const resp: any = await apiGet(`/api/supermarkets/${serviceId}/products?limit=200`);
            const raw = resp?.data?.products ?? [];
            setProducts(
                raw.map((p: any) => ({
                    id: parseInt(p.id) || 0,
                    nom: p.name || p.nom || 'Produit',
                    prix: p.price || p.prix || 0,
                    categorie: p.category || p.categorie || 'autres',
                    en_promotion: p.is_promotion || false,
                    prix_promo: p.is_promotion ? (p.price || p.prix) : undefined,
                    image_url: p.image_url,
                }))
            );
        } catch {
            setProducts([]);
        }
    };

    const loadRules = async () => {
        if (!serviceId) return;
        try {
            const resp: any = await apiGet(`/api/social/products/rules/${serviceId}`);
            const data = resp?.data ?? resp;
            if (data && data.frequency) setRules(data);
        } catch {
            // garder les valeurs par défaut
        }
    };

    const loadStats = async () => {
        if (!serviceId) return;
        try {
            const resp: any = await apiGet(`/api/social/products/history/${serviceId}`);
            const data = resp?.data ?? resp;
            setPlatformStats(data?.by_platform ?? []);
            setRecentJobs(data?.recent_jobs ?? []);
        } catch {
            setPlatformStats([]);
            setRecentJobs([]);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    };

    // ─── OAuth / Connexion plateforme ────────────────────────────────────────

    const handleConnect = async (platform: typeof PLATFORMS_CONFIG[number]) => {
        if (platform.isFeed) {
            // Plateformes feed: afficher le lien à copier
            showFeedModal(platform.key as string);
            return;
        }

        if (!platform.hasOAuth) {
            // WhatsApp: info
            try {
                const resp: any = await apiGet(platform.oauthEndpoint!);
                const info = resp?.data ?? resp;
                Alert.alert(
                    'WhatsApp Business',
                    `${info.guide}\n\nURL: ${info.setup_url}`,
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Ouvrir Business Manager',
                            onPress: () => Linking.openURL(info.setup_url),
                        },
                    ]
                );
            } catch {
                Alert.alert('Erreur', 'Impossible de charger les infos WhatsApp');
            }
            return;
        }

        // OAuth flow
        setConnectingPlatform(platform.key);
        try {
            const resp: any = await apiGet(platform.oauthEndpoint!);
            const data = resp?.data ?? resp;
            const authUrl: string = data?.authorization_url;
            if (!authUrl) throw new Error('URL OAuth manquante');

            // Écouter le retour dans l'app (deep link ou focus app)
            const appStateListener = ({ nextAppState }: { nextAppState: string }) => {
                if (nextAppState === 'active') {
                    // L'utilisateur est revenu dans l'app après le navigateur OAuth
                    loadAccounts().finally(() => {
                        setConnectingPlatform(null);
                    });
                    appStateListener._remove?.();
                }
            };

            // Fallback : si AppState n'est pas dispo, polling robuste après 4s
            const timeout = setTimeout(async () => {
                await loadAccounts();
                setConnectingPlatform(null);
            }, 4000);

            // Écoute de retour via Linking (deep link yukpo://oauth/success)
            const linkingListener = Linking.addEventListener('url', (event: { url: string }) => {
                if (event.url.includes('oauth') || event.url.includes('social')) {
                    clearTimeout(timeout);
                    loadAccounts().finally(() => {
                        setConnectingPlatform(null);
                        linkingListener.remove();
                    });
                }
            });

            await Linking.openURL(authUrl);
        } catch (e: any) {
            setConnectingPlatform(null);
            Alert.alert('Erreur', `Impossible de lancer OAuth: ${e?.message ?? ''}`);
        }
    };

    // ─── Catalog sync & catalog_id ───────────────────────────────────────────

    const [syncingCatalog, setSyncingCatalog] = useState(false);
    const [showCatalogIdModal, setShowCatalogIdModal] = useState(false);
    const [catalogIdInput, setCatalogIdInput] = useState('');
    const [savingCatalogId, setSavingCatalogId] = useState(false);

    const handleSyncCatalog = async () => {
        if (!serviceId) return;
        setSyncingCatalog(true);
        try {
            const resp: any = await apiPost('/api/social/catalog/sync', { service_id: serviceId });
            const data = resp?.data ?? resp;
            Alert.alert(
                '✅ Synchronisation terminée',
                `${data?.synced ?? 0} produit(s) synchronisés vers Facebook + WhatsApp Business.\n\n${data?.errors?.length > 0 ? `Erreurs: ${data.errors.join(', ')}` : ''}`,
            );
        } catch (e: any) {
            const msg = e?.message ?? 'Erreur';
            if (msg.includes('catalog_id')) {
                Alert.alert(
                    'Catalog ID requis',
                    'Renseignez votre Catalog ID Facebook pour synchroniser votre catalogue.',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Renseigner', onPress: () => setShowCatalogIdModal(true) },
                    ]
                );
            } else {
                Alert.alert('Erreur', msg);
            }
        } finally {
            setSyncingCatalog(false);
        }
    };

    const handleSaveCatalogId = async () => {
        if (!catalogIdInput.trim()) return;
        setSavingCatalogId(true);
        try {
            await apiPut('/api/social/accounts/catalog-id', { catalog_id: catalogIdInput.trim() });
            setShowCatalogIdModal(false);
            Alert.alert('✅ Enregistré', 'Catalog ID sauvegardé. Vous pouvez maintenant synchroniser votre catalogue.');
        } catch {
            Alert.alert('Erreur', 'Impossible de sauvegarder le Catalog ID');
        } finally {
            setSavingCatalogId(false);
        }
    };

    const showFeedModal = (platformKey: string) => {
        const baseUrl = 'https://yukpomnang.com';
        if (platformKey === 'google_shopping') {
            const feedUrl = `${baseUrl}/api/feeds/${partnerId}/google.xml`;
            Alert.alert(
                'Google Shopping Feed',
                `Copiez cette URL dans Google Merchant Center → "Produits" → "Flux" → "Ajouter un flux":\n\n${feedUrl}\n\nGoogle importera automatiquement vos produits.`,
                [
                    { text: 'Fermer', style: 'cancel' },
                    {
                        text: 'Copier l\'URL',
                        onPress: async () => {
                            try {
                                const Clipboard = await import('expo-clipboard');
                                await Clipboard.setStringAsync(feedUrl);
                                Alert.alert('Copié !', 'URL copiée dans le presse-papier');
                            } catch {
                                Alert.alert('URL', feedUrl);
                            }
                        },
                    },
                    {
                        text: 'Ouvrir Merchant Center',
                        onPress: () => Linking.openURL('https://merchants.google.com/'),
                    },
                ]
            );
        } else if (platformKey === 'jumia') {
            const csvUrl = `${baseUrl}/api/feeds/${partnerId}/export.csv?format=jumia`;
            Alert.alert(
                'Export Jumia / Marchés',
                `Téléchargez votre catalogue au format CSV prêt pour Jumia Seller Center:\n\n${csvUrl}`,
                [
                    { text: 'Fermer', style: 'cancel' },
                    {
                        text: 'Ouvrir dans le navigateur',
                        onPress: () => Linking.openURL(csvUrl),
                    },
                ]
            );
        }
    };

    const isConnected = (platformKey: string) =>
        connectedAccounts.some((a) => a.platform === platformKey);

    const getAccount = (platformKey: string) =>
        connectedAccounts.find((a) => a.platform === platformKey);

    // ─── Distribution manuelle ───────────────────────────────────────────────

    const toggleProduct = (id: number) => {
        setSelectedProductIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const togglePlatform = (key: string) => {
        setSelectedPlatforms((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const handleDistribute = async () => {
        if (selectedProductIds.size === 0) {
            Alert.alert('', 'Sélectionnez au moins un produit');
            return;
        }
        if (selectedPlatforms.size === 0) {
            Alert.alert('', 'Sélectionnez au moins une plateforme');
            return;
        }

        setDistributing(true);
        try {
            const resp: any = await apiPost('/api/social/products/distribute', {
                service_id: serviceId,
                product_ids: Array.from(selectedProductIds),
                platforms: Array.from(selectedPlatforms),
                message_template: messageTemplate || null,
            });
            const data = resp?.data ?? resp;
            const count = data?.jobs_created ?? 0;
            Alert.alert(
                '✅ Distribution lancée !',
                `${count} publication(s) programmée(s) vers ${data?.platforms?.join(', ')}`,
                [{ text: 'OK', onPress: () => { setSelectedProductIds(new Set()); setActiveTab('stats'); } }]
            );
            await loadStats();
        } catch (e: any) {
            Alert.alert('Erreur', `Distribution impossible: ${e?.message ?? 'Erreur serveur'}`);
        } finally {
            setDistributing(false);
        }
    };

    const selectAll = () => setSelectedProductIds(new Set(products.map((p) => p.id)));
    const clearAll = () => setSelectedProductIds(new Set());

    // ─── Règles automatiques ─────────────────────────────────────────────────

    const handleSaveRules = async () => {
        setSavingRules(true);
        try {
            await apiPut(`/api/social/products/rules/${serviceId}`, rules);
            Alert.alert('✅ Enregistré', 'Règles de distribution sauvegardées');
        } catch {
            Alert.alert('Erreur', 'Impossible de sauvegarder les règles');
        } finally {
            setSavingRules(false);
        }
    };

    const toggleRulePlatform = (key: string) => {
        const current = rules.target_platforms;
        const updated = current.includes(key)
            ? current.filter((p) => p !== key)
            : [...current, key];
        setRules((r) => ({ ...r, target_platforms: updated }));
    };

    // ─── Renders ─────────────────────────────────────────────────────────────

    const renderPlatformsTab = () => (
        <ScrollView
            contentContainerStyle={styles.tabContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        >
            <Text style={styles.sectionTitle}>Connecter mes plateformes</Text>
            <Text style={styles.sectionSubtitle}>
                Chaque connexion permet à Yukpo de publier automatiquement vos produits.
                Tous les liens pointent vers votre boutique Yukpo.
            </Text>

            {PLATFORMS_CONFIG.map((platform) => {
                const connected = isConnected(platform.key);
                const account = getAccount(platform.key);
                const isConnecting = connectingPlatform === platform.key;
                const isFeed = (platform as any).isFeed;

                return (
                    <View key={platform.key} style={styles.platformCard}>
                        <View style={[styles.platformIcon, { backgroundColor: platform.color + '22' }]}>
                            <SafeIcon name={platform.icon as any} size={26} color={platform.color} />
                        </View>
                        <View style={styles.platformInfo}>
                            <View style={styles.platformHeader}>
                                <Text style={styles.platformName}>{platform.label}</Text>
                                {(connected || isFeed) && (
                                    <View style={[
                                        styles.statusBadge,
                                        { backgroundColor: isFeed ? '#F59E0B22' : '#10B98122' }
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            { color: isFeed ? '#F59E0B' : '#10B981' }
                                        ]}>
                                            {isFeed ? 'Feed' : '● Connecté'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.platformDesc}>{platform.description}</Text>
                            {connected && account?.account_handle && (
                                <Text style={styles.platformHandle}>
                                    📄 {account.account_handle}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.connectBtn,
                                { backgroundColor: connected ? '#1F2937' : platform.color },
                            ]}
                            onPress={() => handleConnect(platform as any)}
                            disabled={isConnecting}
                            activeOpacity={0.75}
                        >
                            {isConnecting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.connectBtnText}>
                                    {connected ? 'Reconnect' : isFeed ? 'Config.' : 'Connecter'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                );
            })}

            {/* Synchronisation catalogue Facebook → WhatsApp */}
            {isConnected('facebook') && (
                <View style={styles.syncCatalogCard}>
                    <View style={styles.syncCatalogHeader}>
                        <SafeIcon name="refresh-cw" size={18} color="#1877F2" />
                        <Text style={styles.syncCatalogTitle}>Synchroniser le catalogue</Text>
                    </View>
                    <Text style={styles.syncCatalogDesc}>
                        Envoyez tous vos produits vers Facebook Commerce Manager.
                        Ils seront automatiquement visibles dans votre boutique Facebook et WhatsApp Business.
                    </Text>
                    <View style={styles.syncCatalogActions}>
                        <TouchableOpacity
                            style={styles.catalogIdBtn}
                            onPress={() => setShowCatalogIdModal(true)}
                            activeOpacity={0.75}
                        >
                            <SafeIcon name="edit-2" size={13} color="#9CA3AF" />
                            <Text style={styles.catalogIdBtnText}>Catalog ID</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.syncBtn, syncingCatalog && styles.syncBtnDisabled]}
                            onPress={handleSyncCatalog}
                            disabled={syncingCatalog}
                            activeOpacity={0.8}
                        >
                            {syncingCatalog ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <SafeIcon name="upload-cloud" size={14} color="#fff" />
                                    <Text style={styles.syncBtnText}>
                                        Synchroniser ({products.length} produits)
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Section lien de tracking */}
            <View style={styles.infoBox}>
                <SafeIcon name="info" size={16} color="#8B5CF6" />
                <Text style={styles.infoText}>
                    Chaque publication inclut automatiquement un lien UTM retour vers Yukpo.
                    Les clics sont comptabilisés dans l'onglet Stats.
                </Text>
            </View>
        </ScrollView>
    );

    const renderDistributeTab = () => (
        <View style={styles.flex1}>
            {/* Sélection plateformes cibles */}
            <View style={styles.platformTargetRow}>
                {PLATFORMS_CONFIG.slice(0, 4).map((p) => (
                    <TouchableOpacity
                        key={p.key}
                        style={[
                            styles.targetChip,
                            selectedPlatforms.has(p.key) && { backgroundColor: p.color, borderColor: p.color },
                        ]}
                        onPress={() => togglePlatform(p.key)}
                        activeOpacity={0.75}
                    >
                        <SafeIcon
                            name={p.icon as any}
                            size={14}
                            color={selectedPlatforms.has(p.key) ? '#fff' : '#9CA3AF'}
                        />
                        <Text style={[
                            styles.targetChipText,
                            selectedPlatforms.has(p.key) && { color: '#fff' },
                        ]}>
                            {p.label.split(' ')[0]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Bouton message personnalisé */}
            <TouchableOpacity
                style={styles.templateBtn}
                onPress={() => setShowTemplateEditor(true)}
                activeOpacity={0.8}
            >
                <SafeIcon name="edit-2" size={14} color="#8B5CF6" />
                <Text style={styles.templateBtnText}>
                    {messageTemplate ? 'Message personnalisé ✓' : 'Personnaliser le message (optionnel)'}
                </Text>
            </TouchableOpacity>

            {/* Sélection produits */}
            <View style={styles.productListHeader}>
                <Text style={styles.productListTitle}>
                    Produits ({selectedProductIds.size}/{products.length} sélectionnés)
                </Text>
                <View style={styles.selectActions}>
                    <TouchableOpacity onPress={selectAll}>
                        <Text style={styles.selectActionText}>Tout</Text>
                    </TouchableOpacity>
                    <Text style={styles.selectSep}>|</Text>
                    <TouchableOpacity onPress={clearAll}>
                        <Text style={styles.selectActionText}>Aucun</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={products}
                keyExtractor={(item) => String(item.id)}
                style={styles.productList}
                renderItem={({ item }) => {
                    const selected = selectedProductIds.has(item.id);
                    return (
                        <TouchableOpacity
                            style={[styles.productRow, selected && styles.productRowSelected]}
                            onPress={() => toggleProduct(item.id)}
                            activeOpacity={0.75}
                        >
                            <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                                {selected && <SafeIcon name="check" size={12} color="#fff" />}
                            </View>
                            <View style={styles.productMeta}>
                                <Text style={styles.productName} numberOfLines={1}>{item.nom}</Text>
                                <Text style={styles.productPrice}>
                                    {item.en_promotion && item.prix_promo
                                        ? `${item.prix_promo.toLocaleString()} ${devise} 🔥`
                                        : `${item.prix.toLocaleString()} ${devise}`}
                                </Text>
                            </View>
                            {item.en_promotion && (
                                <View style={styles.promoBadge}>
                                    <Text style={styles.promoText}>Promo</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>Aucun produit dans votre catalogue</Text>
                }
            />

            {/* Bouton distribuer */}
            <TouchableOpacity
                style={[
                    styles.distributeBtn,
                    (selectedProductIds.size === 0 || selectedPlatforms.size === 0) && styles.distributeBtnDisabled,
                ]}
                onPress={handleDistribute}
                disabled={distributing || selectedProductIds.size === 0 || selectedPlatforms.size === 0}
                activeOpacity={0.8}
            >
                {distributing ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <SafeIcon name="send" size={18} color="#fff" />
                        <Text style={styles.distributeBtnText}>
                            Diffuser {selectedProductIds.size > 0 ? `(${selectedProductIds.size} produits)` : ''}
                        </Text>
                    </>
                )}
            </TouchableOpacity>

            {/* Modal template */}
            <Modal visible={showTemplateEditor} transparent animationType="slide" onRequestClose={() => setShowTemplateEditor(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Message de publication</Text>
                        <Text style={styles.modalSubtitle}>
                            Variables disponibles: {'{nom}'}, {'{prix}'}, {'{boutique}'}, {'{url}'}
                        </Text>
                        <TextInput
                            style={styles.templateInput}
                            value={messageTemplate}
                            onChangeText={setMessageTemplate}
                            placeholder={`🛒 {nom} — {prix}\n📍 {boutique}\n👉 {url}`}
                            placeholderTextColor="#6B7280"
                            multiline
                            numberOfLines={5}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => { setMessageTemplate(''); setShowTemplateEditor(false); }}
                            >
                                <Text style={styles.modalCancelText}>Réinitialiser</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSaveBtn}
                                onPress={() => setShowTemplateEditor(false)}
                            >
                                <Text style={styles.modalSaveText}>Valider</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );

    const renderAutoTab = () => (
        <ScrollView contentContainerStyle={styles.tabContent}>
            <Text style={styles.sectionTitle}>Distribution automatique</Text>
            <Text style={styles.sectionSubtitle}>
                Yukpo publie automatiquement vos produits chaque jour sur vos plateformes connectées.
            </Text>

            {/* Activer/désactiver */}
            <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Distribution automatique</Text>
                    <Text style={styles.settingDesc}>
                        {rules.auto_distribute ? 'Active — Yukpo publie automatiquement' : 'Désactivée'}
                    </Text>
                </View>
                <Switch
                    value={rules.auto_distribute}
                    onValueChange={(v) => setRules((r) => ({ ...r, auto_distribute: v }))}
                    trackColor={{ false: '#374151', true: '#8B5CF6' }}
                    thumbColor="#fff"
                />
            </View>

            {/* Produits par jour */}
            <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Produits publiés par jour</Text>
                <View style={styles.stepperRow}>
                    {[1, 3, 5, 10, 20].map((n) => (
                        <TouchableOpacity
                            key={n}
                            style={[
                                styles.stepperBtn,
                                rules.products_per_day === n && styles.stepperBtnActive,
                            ]}
                            onPress={() => setRules((r) => ({ ...r, products_per_day: n }))}
                        >
                            <Text style={[
                                styles.stepperText,
                                rules.products_per_day === n && styles.stepperTextActive,
                            ]}>
                                {n}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Heure de publication */}
            <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Heure de publication</Text>
                <View style={styles.stepperRow}>
                    {[8, 12, 15, 18, 20].map((h) => (
                        <TouchableOpacity
                            key={h}
                            style={[
                                styles.stepperBtn,
                                rules.schedule_hour === h && styles.stepperBtnActive,
                            ]}
                            onPress={() => setRules((r) => ({ ...r, schedule_hour: h }))}
                        >
                            <Text style={[
                                styles.stepperText,
                                rules.schedule_hour === h && styles.stepperTextActive,
                            ]}>
                                {h}h
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Filtrer les produits */}
            <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Quels produits publier ?</Text>
                {[
                    { key: 'all', label: 'Tous les produits', icon: 'layers' },
                    { key: 'promotions', label: 'Promotions uniquement', icon: 'tag' },
                    { key: 'new', label: 'Nouveautés récentes', icon: 'star' },
                ].map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[
                            styles.filterOption,
                            rules.filter === f.key && styles.filterOptionActive,
                        ]}
                        onPress={() => setRules((r) => ({ ...r, filter: f.key }))}
                        activeOpacity={0.75}
                    >
                        <SafeIcon
                            name={f.icon as any}
                            size={16}
                            color={rules.filter === f.key ? '#8B5CF6' : '#9CA3AF'}
                        />
                        <Text style={[
                            styles.filterLabel,
                            rules.filter === f.key && styles.filterLabelActive,
                        ]}>
                            {f.label}
                        </Text>
                        {rules.filter === f.key && (
                            <SafeIcon name="check-circle" size={16} color="#8B5CF6" />
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Plateformes cibles auto */}
            <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Plateformes cibles</Text>
                <View style={styles.targetPlatformsGrid}>
                    {PLATFORMS_CONFIG.slice(0, 4).map((p) => {
                        const active = rules.target_platforms.includes(p.key);
                        return (
                            <TouchableOpacity
                                key={p.key}
                                style={[
                                    styles.targetPlatformBtn,
                                    active && { backgroundColor: p.color + '22', borderColor: p.color },
                                ]}
                                onPress={() => toggleRulePlatform(p.key)}
                                activeOpacity={0.75}
                            >
                                <SafeIcon
                                    name={p.icon as any}
                                    size={18}
                                    color={active ? p.color : '#6B7280'}
                                />
                                <Text style={[
                                    styles.targetPlatformText,
                                    active && { color: p.color },
                                ]}>
                                    {p.label.split(' ')[0]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Résumé règles */}
            {rules.auto_distribute && (
                <View style={styles.rulesSummary}>
                    <SafeIcon name="zap" size={14} color="#F59E0B" />
                    <Text style={styles.rulesSummaryText}>
                        {rules.products_per_day} produit(s) publiés chaque jour à {rules.schedule_hour}h
                        sur {rules.target_platforms.join(', ')} — filtre: {rules.filter}
                    </Text>
                </View>
            )}

            <TouchableOpacity style={styles.saveRulesBtn} onPress={handleSaveRules} disabled={savingRules}>
                {savingRules ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.saveRulesBtnText}>Enregistrer les règles</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );

    const renderStatsTab = () => {
        const totalClicks = platformStats.reduce((s, p) => s + p.clicks_back, 0);
        const totalPosts = platformStats.reduce((s, p) => s + p.total_posts, 0);

        return (
            <ScrollView
                contentContainerStyle={styles.tabContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
            >
                {/* KPIs résumé */}
                <View style={styles.kpiRow}>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiValue}>{totalPosts}</Text>
                        <Text style={styles.kpiLabel}>Publications</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={[styles.kpiValue, { color: '#10B981' }]}>{totalClicks}</Text>
                        <Text style={styles.kpiLabel}>Clics → Yukpo</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={[styles.kpiValue, { color: '#8B5CF6' }]}>{platformStats.length}</Text>
                        <Text style={styles.kpiLabel}>Plateformes</Text>
                    </View>
                </View>

                {/* Stats par plateforme */}
                {platformStats.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Performance par canal</Text>
                        {platformStats.map((stat) => {
                            const cfg = PLATFORMS_CONFIG.find((p) => p.key === stat.platform);
                            const successRate = stat.total_posts > 0
                                ? Math.round((stat.completed / stat.total_posts) * 100)
                                : 0;
                            return (
                                <View key={stat.platform} style={styles.statCard}>
                                    <View style={styles.statHeader}>
                                        <View style={[
                                            styles.statIcon,
                                            { backgroundColor: (cfg?.color ?? '#6B7280') + '22' }
                                        ]}>
                                            <SafeIcon
                                                name={(cfg?.icon ?? 'share-2') as any}
                                                size={20}
                                                color={cfg?.color ?? '#6B7280'}
                                            />
                                        </View>
                                        <View style={styles.statMeta}>
                                            <Text style={styles.statPlatformName}>
                                                {cfg?.label ?? stat.platform}
                                            </Text>
                                            <Text style={styles.statDate}>
                                                {stat.last_post_at
                                                    ? `Dernier post: ${new Date(stat.last_post_at).toLocaleDateString('fr-FR')}`
                                                    : 'Aucun post encore'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.statNumbers}>
                                        <View style={styles.statNum}>
                                            <Text style={styles.statNumValue}>{stat.total_posts}</Text>
                                            <Text style={styles.statNumLabel}>Posts</Text>
                                        </View>
                                        <View style={styles.statNum}>
                                            <Text style={[styles.statNumValue, { color: '#10B981' }]}>
                                                {stat.clicks_back}
                                            </Text>
                                            <Text style={styles.statNumLabel}>Clics Yukpo</Text>
                                        </View>
                                        <View style={styles.statNum}>
                                            <Text style={[styles.statNumValue, { color: '#F59E0B' }]}>
                                                {successRate}%
                                            </Text>
                                            <Text style={styles.statNumLabel}>Succès</Text>
                                        </View>
                                    </View>
                                    {/* Barre succès */}
                                    <View style={styles.progressBar}>
                                        <View style={[styles.progressFill, { width: `${successRate}%`, backgroundColor: cfg?.color ?? '#8B5CF6' }]} />
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}

                {/* Jobs récents */}
                {recentJobs.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Publications récentes</Text>
                        {recentJobs.map((job) => {
                            const cfg = PLATFORMS_CONFIG.find((p) => p.key === job.platform);
                            const statusColor = job.status === 'completed' ? '#10B981'
                                : job.status === 'failed' ? '#EF4444'
                                    : '#F59E0B';
                            return (
                                <View key={job.id} style={styles.jobRow}>
                                    <SafeIcon
                                        name={(cfg?.icon ?? 'share-2') as any}
                                        size={16}
                                        color={cfg?.color ?? '#6B7280'}
                                    />
                                    <View style={styles.jobMeta}>
                                        <Text style={styles.jobProduct} numberOfLines={1}>
                                            {job.product_name ?? 'Produit inconnu'}
                                        </Text>
                                        <Text style={styles.jobDate}>
                                            {job.created_at
                                                ? new Date(job.created_at).toLocaleDateString('fr-FR', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                })
                                                : ''}
                                        </Text>
                                    </View>
                                    <View style={styles.jobRight}>
                                        <View style={[styles.jobStatus, { backgroundColor: statusColor + '22' }]}>
                                            <Text style={[styles.jobStatusText, { color: statusColor }]}>
                                                {job.status === 'completed' ? '✓' : job.status === 'failed' ? '✗' : '…'}
                                            </Text>
                                        </View>
                                        {job.clicks_back > 0 && (
                                            <Text style={styles.jobClicks}>{job.clicks_back} clics</Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}

                {platformStats.length === 0 && recentJobs.length === 0 && (
                    <View style={styles.emptyStats}>
                        <SafeIcon name="bar-chart-2" size={48} color="#374151" />
                        <Text style={styles.emptyTitle}>Aucune distribution encore</Text>
                        <Text style={styles.emptyDesc}>
                            Connectez vos plateformes et distribuez vos premiers produits
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyActionBtn}
                            onPress={() => setActiveTab('platforms')}
                        >
                            <Text style={styles.emptyActionText}>Connecter mes plateformes</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        );
    };

    // ─── Layout principal ─────────────────────────────────────────────────────

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'platforms', label: 'Plateformes', icon: 'link' },
        { key: 'distribute', label: 'Diffuser', icon: 'send' },
        { key: 'auto', label: 'Auto', icon: 'zap' },
        { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
    ];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#F9FAFB" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Diffusion Multi-Canaux</Text>
                    <Text style={styles.headerSub} numberOfLines={1}>{serviceName}</Text>
                </View>
                <View style={styles.headerRight}>
                    {connectedAccounts.length > 0 && (
                        <View style={styles.connectedBadge}>
                            <Text style={styles.connectedBadgeText}>{connectedAccounts.length}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
                        onPress={() => setActiveTab(tab.key)}
                        activeOpacity={0.75}
                    >
                        <SafeIcon
                            name={tab.icon as any}
                            size={15}
                            color={activeTab === tab.key ? '#8B5CF6' : '#6B7280'}
                        />
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
                <View style={styles.flex1}>
                    {activeTab === 'platforms' && renderPlatformsTab()}
                    {activeTab === 'distribute' && renderDistributeTab()}
                    {activeTab === 'auto' && renderAutoTab()}
                    {activeTab === 'stats' && renderStatsTab()}
                </View>
            )}

            {/* Modal Catalog ID */}
            <Modal
                visible={showCatalogIdModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCatalogIdModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Catalog ID Facebook</Text>
                        <Text style={styles.modalSubtitle}>
                            Trouvez votre Catalog ID dans{'\n'}
                            Facebook Commerce Manager → Catalogue → Paramètres du catalogue
                        </Text>
                        <TextInput
                            style={styles.catalogIdInput}
                            value={catalogIdInput}
                            onChangeText={setCatalogIdInput}
                            placeholder="Ex: 1234567890123456"
                            placeholderTextColor="#6B7280"
                            keyboardType="numeric"
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowCatalogIdModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalSaveBtn,
                                    (savingCatalogId || !catalogIdInput.trim()) && { opacity: 0.5 },
                                ]}
                                onPress={handleSaveCatalogId}
                                disabled={savingCatalogId || !catalogIdInput.trim()}
                            >
                                {savingCatalogId ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalSaveText}>Enregistrer</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111827' },
    flex1: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 52,
        paddingBottom: 14,
        paddingHorizontal: 16,
        backgroundColor: '#1F2937',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    backBtn: { padding: 4, marginRight: 8 },
    headerCenter: { flex: 1 },
    headerTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
    headerSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    headerRight: { alignItems: 'center', justifyContent: 'center', width: 32 },
    connectedBadge: {
        backgroundColor: '#10B981',
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    // Tab bar
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#1F2937',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
        paddingBottom: 2,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        gap: 3,
    },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#8B5CF6' },
    tabLabel: { color: '#6B7280', fontSize: 11, fontWeight: '500' },
    tabLabelActive: { color: '#8B5CF6' },

    // Loading
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: '#9CA3AF', fontSize: 14 },

    // Tab content
    tabContent: { padding: 16, paddingBottom: 40 },
    sectionTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    sectionSubtitle: { color: '#9CA3AF', fontSize: 13, lineHeight: 18, marginBottom: 16 },

    // Platform cards
    platformCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#374151',
        gap: 10,
    },
    platformIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    platformInfo: { flex: 1 },
    platformHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    platformName: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '600' },
    platformDesc: { color: '#9CA3AF', fontSize: 12, lineHeight: 16 },
    platformHandle: { color: '#6B7280', fontSize: 11, marginTop: 2 },
    connectBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    connectBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Info box
    infoBox: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#8B5CF622',
        borderRadius: 10,
        padding: 12,
        marginTop: 8,
        alignItems: 'flex-start',
    },
    infoText: { color: '#C4B5FD', fontSize: 12, lineHeight: 17, flex: 1 },

    // Distribute tab
    platformTargetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#1F2937',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    targetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#374151',
    },
    targetChipText: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },
    templateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#1F2937',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    templateBtnText: { color: '#8B5CF6', fontSize: 12 },
    productListHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#1F2937',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    productListTitle: { color: '#F9FAFB', fontSize: 13, fontWeight: '600' },
    selectActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    selectActionText: { color: '#8B5CF6', fontSize: 12 },
    selectSep: { color: '#374151', fontSize: 12 },
    productList: { flex: 1 },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        gap: 10,
    },
    productRowSelected: { backgroundColor: '#8B5CF611' },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#374151',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
    productMeta: { flex: 1 },
    productName: { color: '#F9FAFB', fontSize: 13, fontWeight: '500' },
    productPrice: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
    promoBadge: {
        backgroundColor: '#EF444422',
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    promoText: { color: '#EF4444', fontSize: 10, fontWeight: '600' },
    emptyText: { color: '#6B7280', textAlign: 'center', marginTop: 32, fontSize: 13 },
    distributeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#8B5CF6',
        margin: 12,
        paddingVertical: 14,
        borderRadius: 12,
    },
    distributeBtnDisabled: { backgroundColor: '#374151' },
    distributeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    // Template modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#1F2937',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 36,
    },
    modalTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    modalSubtitle: { color: '#9CA3AF', fontSize: 12, marginBottom: 12 },
    templateInput: {
        backgroundColor: '#111827',
        color: '#F9FAFB',
        borderRadius: 10,
        padding: 12,
        fontSize: 13,
        minHeight: 110,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#374151',
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
    },
    modalCancelText: { color: '#9CA3AF', fontWeight: '600' },
    modalSaveBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#8B5CF6',
        alignItems: 'center',
    },
    modalSaveText: { color: '#fff', fontWeight: '700' },

    // Auto tab
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#374151',
    },
    settingInfo: { flex: 1 },
    settingLabel: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', marginBottom: 4 },
    settingDesc: { color: '#9CA3AF', fontSize: 12 },
    settingSection: { marginBottom: 16 },
    stepperRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    stepperBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    stepperBtnActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
    stepperText: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
    stepperTextActive: { color: '#fff' },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#1F2937',
        borderRadius: 10,
        padding: 12,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#374151',
    },
    filterOptionActive: { borderColor: '#8B5CF6', backgroundColor: '#8B5CF611' },
    filterLabel: { flex: 1, color: '#9CA3AF', fontSize: 13 },
    filterLabelActive: { color: '#F9FAFB', fontWeight: '600' },
    targetPlatformsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    targetPlatformBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
    },
    targetPlatformText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
    rulesSummary: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#F59E0B11',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
    },
    rulesSummaryText: { flex: 1, color: '#FDE68A', fontSize: 12, lineHeight: 17 },
    saveRulesBtn: {
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveRulesBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    // Stats tab
    kpiRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#374151',
    },
    kpiValue: { color: '#F9FAFB', fontSize: 24, fontWeight: '800', marginBottom: 4 },
    kpiLabel: { color: '#9CA3AF', fontSize: 11, textAlign: 'center' },
    statCard: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#374151',
    },
    statHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    statIcon: {
        width: 38,
        height: 38,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statMeta: { flex: 1 },
    statPlatformName: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
    statDate: { color: '#6B7280', fontSize: 11, marginTop: 2 },
    statNumbers: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
    statNum: { alignItems: 'center' },
    statNumValue: { color: '#F9FAFB', fontSize: 18, fontWeight: '700' },
    statNumLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
    progressBar: {
        height: 4,
        backgroundColor: '#374151',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: { height: 4, borderRadius: 2 },
    jobRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    jobMeta: { flex: 1 },
    jobProduct: { color: '#F9FAFB', fontSize: 13, fontWeight: '500' },
    jobDate: { color: '#6B7280', fontSize: 11, marginTop: 2 },
    jobRight: { alignItems: 'flex-end', gap: 3 },
    jobStatus: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    jobStatusText: { fontSize: 11, fontWeight: '700' },
    jobClicks: { color: '#10B981', fontSize: 10 },
    emptyStats: { alignItems: 'center', paddingTop: 48, gap: 10 },
    emptyTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
    emptyDesc: { color: '#6B7280', fontSize: 13, textAlign: 'center', lineHeight: 18 },
    emptyActionBtn: {
        marginTop: 8,
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    emptyActionText: { color: '#fff', fontWeight: '600' },

    // Sync catalogue card
    syncCatalogCard: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 14,
        marginTop: 10,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: '#1877F244',
    },
    syncCatalogHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    syncCatalogTitle: { color: '#F9FAFB', fontSize: 14, fontWeight: '700' },
    syncCatalogDesc: { color: '#9CA3AF', fontSize: 12, lineHeight: 17, marginBottom: 12 },
    syncCatalogActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    catalogIdBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    catalogIdBtnText: { color: '#9CA3AF', fontSize: 12 },
    syncBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: '#1877F2',
    },
    syncBtnDisabled: { backgroundColor: '#374151' },
    syncBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    // Catalog ID input
    catalogIdInput: {
        backgroundColor: '#111827',
        color: '#F9FAFB',
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#374151',
        marginBottom: 4,
        letterSpacing: 1,
    },
});

export default SocialDistributionScreen;
