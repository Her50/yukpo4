// Social Account Setup — Yukpo Social
// Connexion guidée des comptes sociaux : 1 clic Facebook/Instagram via OAuth,
// WhatsApp Business manuel, statut en temps réel.

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Linking,
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConnectedAccount {
    platform: string;
    account_handle?: string;
    connected_at?: string;
    expires_at?: string;
    is_expired?: boolean;
}

interface PlatformConfig {
    key: string;
    label: string;
    icon: string;
    color: string;
    description: string;
    method: 'oauth' | 'manual' | 'business_manager';
    manualLabel?: string;
    manualPlaceholder?: string;
    manualHint?: string;
    covers?: string[];
}

// ─── Config plateformes ───────────────────────────────────────────────────────

const PLATFORMS: PlatformConfig[] = [
    {
        key: 'facebook',
        label: 'Facebook & Instagram',
        icon: 'logo-facebook',
        color: '#1877F2',
        description: '1 clic suffit pour Facebook ET Instagram.\n\nYukpoIA découvre automatiquement vos Pages, récupère les tokens individuels et détecte vos comptes Instagram liés. Si vous n\'avez pas encore de Page Facebook, Yukpo en crée une pour vous.',
        method: 'oauth',
        covers: ['facebook', 'instagram'],
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp Business',
        icon: 'logo-whatsapp',
        color: '#25D366',
        description: 'Nécessite un compte WhatsApp Business API via Meta Business Manager. Entrez votre Phone Number ID.',
        method: 'manual',
        manualLabel: 'Phone Number ID',
        manualPlaceholder: '1234567890123456',
        manualHint: 'Trouvez-le dans Meta Business Manager → WhatsApp → numéros de téléphone',
    },
    {
        key: 'tiktok',
        label: 'TikTok',
        icon: 'logo-tiktok',
        color: '#010101',
        description: 'Connexion TikTok for Business via OAuth. YukpoIA peut publier des Reels et vidéos.',
        method: 'oauth',
    },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function SocialAccountSetupScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { token } = useAuth();
    const serviceId: number = route.params?.service_id ?? route.params?.serviceId ?? 0;
    const onComplete: (() => void) | undefined = route.params?.onComplete;

    const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [manualValues, setManualValues] = useState<Record<string, string>>({});
    const [savingManual, setSavingManual] = useState<string | null>(null);

    // WhatsApp guided setup state
    const [waStep, setWaStep] = useState<0 | 1 | 2 | 3>(0); // 0=idle 1=token 2=verifying 3=done
    const [waToken, setWaToken] = useState('');
    const [waPhoneHint, setWaPhoneHint] = useState(''); // optionnel — si auto-discover échoue
    const [waResult, setWaResult] = useState<{ phone_number_id: string; display_phone: string } | null>(null);
    const [waError, setWaError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await apiGet('/api/social/accounts', token);
            setAccounts(Array.isArray(data) ? data : []);
        } catch {
            setAccounts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    // Écoute le deep link de retour OAuth (yukpo://oauth/success?platform=facebook)
    useEffect(() => {
        const sub = Linking.addEventListener('url', ({ url }) => {
            if (url.includes('oauth/success')) {
                setConnecting(null);
                load();
                Alert.alert('✅ Connecté !', 'Votre compte a été connecté avec succès.');
            } else if (url.includes('oauth/error') || url.includes('oauth/cancel')) {
                setConnecting(null);
                Alert.alert('Connexion annulée', 'La connexion OAuth a été annulée ou a échoué.');
            }
        });
        return () => sub.remove();
    }, [load]);

    const connectOAuth = async (platformKey: string) => {
        setConnecting(platformKey);
        try {
            // Facebook/Instagram utilisent le même endpoint OAuth
            // Facebook et Instagram : même endpoint OAuth (Facebook couvre les deux)
        const endpoint = platformKey === 'tiktok'
                ? '/api/social/accounts/tiktok/authorize'
                : '/api/social/facebook/authorize'; // découvre Pages + Instagram automatiquement

            const data = await apiGet(endpoint, token);
            const authUrl: string = data?.authorization_url;
            if (!authUrl) throw new Error('URL OAuth non reçue');

            const canOpen = await Linking.canOpenURL(authUrl);
            if (!canOpen) throw new Error('Impossible d\'ouvrir le navigateur');

            await Linking.openURL(authUrl);
            // Le deep link yukpo://oauth/success renverra dans l'app via l'event listener ci-dessus
        } catch (e: any) {
            setConnecting(null);
            Alert.alert('Erreur', e?.message ?? 'Connexion impossible. Réessayez.');
        }
    };

    const saveManual = async (platformKey: string) => {
        const value = manualValues[platformKey]?.trim();
        if (!value) {
            Alert.alert('Champ requis', 'Entrez votre Phone Number ID.');
            return;
        }
        setSavingManual(platformKey);
        try {
            await apiPost('/api/social/accounts/connect', {
                platform: platformKey,
                metadata: { phone_number_id: value },
                account_handle: value,
            }, token);
            await load();
            Alert.alert('✅ WhatsApp configuré', 'Votre numéro WhatsApp Business a été enregistré.');
            setManualValues(prev => ({ ...prev, [platformKey]: '' }));
        } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? 'Enregistrement impossible.');
        } finally {
            setSavingManual(null);
        }
    };

    const runGuidedSetup = async () => {
        if (!waToken.trim()) {
            setWaError('Collez votre token d\'accès WhatsApp Business.');
            return;
        }
        setWaStep(2);
        setWaError(null);
        try {
            const data: any = await apiPost(
                '/api/social/accounts/whatsapp/setup-guided',
                { wa_token: waToken.trim(), phone_number_id: waPhoneHint.trim() || undefined },
                token,
            );
            setWaResult({ phone_number_id: data.phone_number_id, display_phone: data.display_phone });
            setWaStep(3);
            await load();
        } catch (e: any) {
            setWaError(e?.message ?? 'Impossible de configurer WhatsApp. Vérifiez votre token.');
            setWaStep(1);
        }
    };

    const disconnect = (platformKey: string) => {
        Alert.alert(
            'Déconnecter ce compte ?',
            'Yukpo ne pourra plus publier sur cette plateforme.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Déconnecter',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiPost(`/api/social/accounts/${platformKey}/disconnect`, {}, token);
                            await load();
                        } catch {
                            Alert.alert('Erreur', 'Déconnexion impossible.');
                        }
                    },
                },
            ],
        );
    };

    const onRefresh = () => { setRefreshing(true); load(); };

    const isConnected = (platformKey: string) => {
        const covers = PLATFORMS.find(p => p.key === platformKey)?.covers;
        if (covers) return covers.some(c => accounts.find(a => a.platform === c));
        return !!accounts.find(a => a.platform === platformKey);
    };

    const getAccount = (platformKey: string): ConnectedAccount | undefined => {
        const covers = PLATFORMS.find(p => p.key === platformKey)?.covers;
        if (covers) {
            for (const c of covers) {
                const found = accounts.find(a => a.platform === c);
                if (found) return found;
            }
        }
        return accounts.find(a => a.platform === platformKey);
    };

    const connectedCount = PLATFORMS.filter(p => isConnected(p.key)).length;
    const allConnected = connectedCount === PLATFORMS.length;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={s.headerInfo}>
                    <Text style={s.headerTitle}>Connexion comptes sociaux</Text>
                    <Text style={s.headerSub}>{connectedCount}/{PLATFORMS.length} plateforme{connectedCount > 1 ? 's' : ''} connectée{connectedCount > 1 ? 's' : ''}</Text>
                </View>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={s.body}
            >
                {/* Bandeau d'information clé */}
                <View style={s.infoBanner}>
                    <SafeIcon name="information-circle" size={18} color="#6366F1" />
                    <Text style={s.infoBannerText}>
                        <Text style={{ fontWeight: '700' }}>1 connexion Facebook = Facebook + Instagram.</Text>
                        {' '}Ils partagent le même écosystème Meta — vous n'avez pas à entrer de token manuellement.
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 40 }} />
                ) : (
                    PLATFORMS.map(platform => {
                        const connected = isConnected(platform.key);
                        const account = getAccount(platform.key);
                        const isConnecting = connecting === platform.key;
                        const isSaving = savingManual === platform.key;

                        return (
                            <View key={platform.key} style={[s.card, connected && s.cardConnected]}>
                                {/* Card header */}
                                <View style={s.cardHeader}>
                                    <View style={[s.iconCircle, { backgroundColor: platform.color + '22' }]}>
                                        <SafeIcon name={platform.icon as any} size={26} color={platform.color} />
                                    </View>
                                    <View style={s.cardInfo}>
                                        <Text style={s.cardTitle}>{platform.label}</Text>
                                        {connected && account?.account_handle && (
                                            <Text style={s.cardHandle}>@{account.account_handle}</Text>
                                        )}
                                        {connected && account?.is_expired && (
                                            <Text style={s.expiredTag}>Token expiré — reconnecter</Text>
                                        )}
                                    </View>
                                    {connected ? (
                                        <View style={s.connectedBadge}>
                                            <SafeIcon name="checkmark-circle" size={16} color="#10B981" />
                                            <Text style={s.connectedText}>Connecté</Text>
                                        </View>
                                    ) : (
                                        <View style={s.pendingBadge}>
                                            <SafeIcon name="ellipse-outline" size={16} color="#64748B" />
                                            <Text style={s.pendingText}>Non connecté</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Description */}
                                <Text style={s.cardDesc}>{platform.description}</Text>

                                {/* Couverture platforms */}
                                {platform.covers && (
                                    <View style={s.coversRow}>
                                        {platform.covers.map(c => (
                                            <View key={c} style={[s.coverChip, { borderColor: platform.color }]}>
                                                <Text style={[s.coverChipText, { color: platform.color }]}>{c}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Action */}
                                {platform.method === 'oauth' ? (
                                    <View style={s.actionRow}>
                                        {connected ? (
                                            <>
                                                {account?.is_expired && (
                                                    <TouchableOpacity
                                                        style={[s.actionBtn, { backgroundColor: platform.color }]}
                                                        onPress={() => connectOAuth(platform.key)}
                                                        disabled={isConnecting}
                                                    >
                                                        {isConnecting
                                                            ? <ActivityIndicator size="small" color="#fff" />
                                                            : <Text style={s.actionBtnText}>Reconnecter</Text>
                                                        }
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity
                                                    style={s.disconnectBtn}
                                                    onPress={() => disconnect(platform.key)}
                                                >
                                                    <Text style={s.disconnectText}>Déconnecter</Text>
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: platform.color }, isConnecting && { opacity: 0.7 }]}
                                                onPress={() => connectOAuth(platform.key)}
                                                disabled={isConnecting}
                                            >
                                                {isConnecting ? (
                                                    <>
                                                        <ActivityIndicator size="small" color="#fff" />
                                                        <Text style={s.actionBtnText}>Ouverture navigateur…</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <SafeIcon name="link" size={16} color="#fff" />
                                                        <Text style={s.actionBtnText}>
                                                            Connecter via {platform.label.split(' ')[0]}
                                                        </Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : (
                                    /* WhatsApp — wizard guidé */
                                    !connected ? (
                                        <View style={s.waWizard}>
                                            {/* Étapes visuelles */}
                                            <View style={s.waSteps}>
                                                {['Token', 'Vérification', 'Webhook ✓'].map((label, i) => (
                                                    <View key={i} style={s.waStepItem}>
                                                        <View style={[
                                                            s.waStepDot,
                                                            waStep > i && s.waStepDone,
                                                            waStep === i + 1 && s.waStepActive,
                                                        ]}>
                                                            {waStep > i
                                                                ? <SafeIcon name="checkmark" size={10} color="#fff" />
                                                                : <Text style={s.waStepNum}>{i + 1}</Text>
                                                            }
                                                        </View>
                                                        <Text style={[s.waStepLabel, waStep === i + 1 && { color: '#25D366' }]}>{label}</Text>
                                                        {i < 2 && <View style={s.waStepLine} />}
                                                    </View>
                                                ))}
                                            </View>

                                            {waStep === 0 && (
                                                <TouchableOpacity
                                                    style={s.waStartBtn}
                                                    onPress={() => setWaStep(1)}
                                                >
                                                    <SafeIcon name="logo-whatsapp" size={18} color="#fff" />
                                                    <Text style={s.waStartBtnText}>Configurer WhatsApp en 1 minute</Text>
                                                </TouchableOpacity>
                                            )}

                                            {(waStep === 1 || waError) && (
                                                <View style={s.waForm}>
                                                    {/* Comment obtenir le token */}
                                                    <TouchableOpacity
                                                        style={s.waHowTo}
                                                        onPress={() => Linking.openURL('https://developers.facebook.com/docs/whatsapp/cloud-api/get-started')}
                                                    >
                                                        <SafeIcon name="help-circle-outline" size={14} color="#25D366" />
                                                        <Text style={s.waHowToText}>Comment obtenir mon token WhatsApp Business ?</Text>
                                                        <SafeIcon name="open-outline" size={12} color="#25D366" />
                                                    </TouchableOpacity>

                                                    <Text style={s.waFieldLabel}>Token d'accès WhatsApp Business</Text>
                                                    <TextInput
                                                        style={s.waInput}
                                                        value={waToken}
                                                        onChangeText={setWaToken}
                                                        placeholder="EAAxxxx…"
                                                        placeholderTextColor="#475569"
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                        multiline
                                                        numberOfLines={3}
                                                    />

                                                    <Text style={s.waFieldLabel}>
                                                        Phone Number ID{' '}
                                                        <Text style={{ color: '#64748B', fontWeight: '400' }}>(optionnel — auto-détecté)</Text>
                                                    </Text>
                                                    <TextInput
                                                        style={[s.waInput, { height: 44 }]}
                                                        value={waPhoneHint}
                                                        onChangeText={setWaPhoneHint}
                                                        placeholder="1234567890 (laissez vide pour auto-détection)"
                                                        placeholderTextColor="#475569"
                                                        keyboardType="number-pad"
                                                    />

                                                    {waError && (
                                                        <View style={s.waErrorBox}>
                                                            <SafeIcon name="alert-circle" size={14} color="#EF4444" />
                                                            <Text style={s.waErrorText}>{waError}</Text>
                                                        </View>
                                                    )}

                                                    <TouchableOpacity
                                                        style={s.waSubmitBtn}
                                                        onPress={runGuidedSetup}
                                                    >
                                                        <SafeIcon name="flash" size={16} color="#fff" />
                                                        <Text style={s.waSubmitBtnText}>Configurer automatiquement</Text>
                                                    </TouchableOpacity>
                                                    <Text style={s.waPrivacyNote}>
                                                        Yukpo enregistre votre webhook automatiquement — vous n'avez pas à ouvrir Meta Business Manager.
                                                    </Text>
                                                </View>
                                            )}

                                            {waStep === 2 && (
                                                <View style={s.waVerifying}>
                                                    <ActivityIndicator size="large" color="#25D366" />
                                                    <Text style={s.waVerifyText}>Vérification du token…</Text>
                                                    <Text style={s.waVerifySubText}>Détection du numéro · Enregistrement webhook</Text>
                                                </View>
                                            )}

                                            {waStep === 3 && waResult && (
                                                <View style={s.waSuccess}>
                                                    <SafeIcon name="checkmark-circle" size={32} color="#25D366" />
                                                    <Text style={s.waSuccessTitle}>WhatsApp Business configuré !</Text>
                                                    <Text style={s.waSuccessPhone}>{waResult.display_phone}</Text>
                                                    <View style={s.waSuccessRow}>
                                                        <SafeIcon name="checkmark" size={14} color="#10B981" />
                                                        <Text style={s.waSuccessItem}>Webhook enregistré automatiquement</Text>
                                                    </View>
                                                    <View style={s.waSuccessRow}>
                                                        <SafeIcon name="checkmark" size={14} color="#10B981" />
                                                        <Text style={s.waSuccessItem}>Prêt à recevoir des messages</Text>
                                                    </View>
                                                    <View style={s.waSuccessRow}>
                                                        <SafeIcon name="checkmark" size={14} color="#10B981" />
                                                        <Text style={s.waSuccessItem}>Bot Community Manager activable</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    ) : (
                                        <View style={s.actionRow}>
                                            <TouchableOpacity
                                                style={s.disconnectBtn}
                                                onPress={() => disconnect(platform.key)}
                                            >
                                                <Text style={s.disconnectText}>Déconnecter</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )
                                )}
                            </View>
                        );
                    })
                )}

                {/* Webhooks — info simplifiée */}
                <View style={s.webhookCard}>
                    <SafeIcon name="git-network-outline" size={16} color="#10B981" />
                    <View style={{ flex: 1 }}>
                        <Text style={s.webhookTitle}>Webhooks Meta — configuration automatique</Text>
                        <Text style={s.webhookDesc}>
                            WhatsApp : enregistré automatiquement lors du setup guidé ci-dessus.{'\n'}
                            Facebook & Instagram : configurés automatiquement lors de la connexion OAuth.{'\n\n'}
                            Si vous avez besoin de le configurer manuellement :{'\n'}
                            Token de vérification: <Text style={{ color: '#F59E0B', fontFamily: 'monospace' }}>yukpo_webhook_2026</Text>
                        </Text>
                        <TouchableOpacity
                            style={s.metaBMBtn}
                            onPress={() => Linking.openURL('https://business.facebook.com/settings/webhooks')}
                        >
                            <SafeIcon name="open-outline" size={14} color="#F59E0B" />
                            <Text style={s.metaBMBtnText}>Ouvrir Meta Business Manager</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Continuer si tout connecté */}
                {connectedCount > 0 && (
                    <TouchableOpacity
                        style={s.continueBtn}
                        onPress={() => {
                            if (onComplete) onComplete();
                            else navigation.goBack();
                        }}
                    >
                        <SafeIcon name="checkmark-circle" size={18} color="#fff" />
                        <Text style={s.continueBtnText}>
                            {allConnected ? 'Tout est configuré — accéder à Yukpo Social' : 'Continuer avec les comptes connectés'}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
        backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155',
    },
    headerInfo: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
    headerSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
    body: { padding: 16, gap: 14 },
    infoBanner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        backgroundColor: '#1E293B', borderRadius: 12,
        padding: 14, borderLeftWidth: 3, borderLeftColor: '#6366F1',
    },
    infoBannerText: { flex: 1, color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
    card: {
        backgroundColor: '#1E293B', borderRadius: 16,
        padding: 16, gap: 12,
        borderWidth: 1, borderColor: '#334155',
    },
    cardConnected: { borderColor: '#10B98133' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    cardTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '700' },
    cardHandle: { color: '#64748B', fontSize: 12, marginTop: 2 },
    expiredTag: { color: '#EF4444', fontSize: 11, marginTop: 2 },
    connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    connectedText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
    pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pendingText: { color: '#64748B', fontSize: 12 },
    cardDesc: { color: '#94A3B8', fontSize: 13, lineHeight: 19 },
    coversRow: { flexDirection: 'row', gap: 8 },
    coverChip: {
        borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    },
    coverChipText: { fontSize: 12, fontWeight: '600' },
    actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderRadius: 10, paddingVertical: 12,
    },
    actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    disconnectBtn: {
        borderWidth: 1, borderColor: '#EF4444', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 10,
    },
    disconnectText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
    manualSection: { gap: 8 },
    manualLabel: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
    manualHint: { color: '#64748B', fontSize: 11, lineHeight: 16 },
    manualRow: { flexDirection: 'row', gap: 8 },
    manualInput: {
        flex: 1, backgroundColor: '#0F172A', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        color: '#E2E8F0', fontSize: 14,
        borderWidth: 1, borderColor: '#334155',
    },
    guideBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start',
    },
    guideBtnText: { color: '#25D366', fontSize: 12, fontWeight: '600' },
    webhookCard: {
        flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        backgroundColor: '#1E293B', borderRadius: 14,
        padding: 14, borderLeftWidth: 3, borderLeftColor: '#F59E0B',
    },
    webhookTitle: { color: '#F1F5F9', fontSize: 13, fontWeight: '700', marginBottom: 6 },
    webhookDesc: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
    metaBMBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 8,
    },
    metaBMBtnText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
    continueBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: '#6366F1', borderRadius: 14, paddingVertical: 16,
        marginTop: 4,
    },
    continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    // ── WhatsApp Wizard ──────────────────────────────────────────────────────
    waWizard: { gap: 16 },
    waSteps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
    waStepItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    waStepDot: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center',
    },
    waStepDone: { backgroundColor: '#10B981' },
    waStepActive: { backgroundColor: '#25D366' },
    waStepNum: { color: '#64748B', fontSize: 11, fontWeight: '700' },
    waStepLabel: { color: '#64748B', fontSize: 11, fontWeight: '600', marginRight: 2 },
    waStepLine: { width: 16, height: 1, backgroundColor: '#334155', marginHorizontal: 2 },
    waStartBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14,
    },
    waStartBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    waForm: { gap: 10 },
    waHowTo: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#0F2D1A', borderRadius: 10, padding: 10,
        borderWidth: 1, borderColor: '#25D36633',
    },
    waHowToText: { flex: 1, color: '#25D366', fontSize: 12, fontWeight: '600' },
    waFieldLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
    waInput: {
        backgroundColor: '#0F172A', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        color: '#E2E8F0', fontSize: 13,
        borderWidth: 1, borderColor: '#334155',
        minHeight: 80,
    },
    waErrorBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: '#2D0F0F', borderRadius: 10, padding: 10,
        borderWidth: 1, borderColor: '#EF444433',
    },
    waErrorText: { flex: 1, color: '#FCA5A5', fontSize: 12, lineHeight: 17 },
    waSubmitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14,
    },
    waSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    waPrivacyNote: { color: '#475569', fontSize: 11, textAlign: 'center', lineHeight: 16 },
    waVerifying: { alignItems: 'center', gap: 12, paddingVertical: 20 },
    waVerifyText: { color: '#E2E8F0', fontSize: 15, fontWeight: '600' },
    waVerifySubText: { color: '#64748B', fontSize: 12 },
    waSuccess: { alignItems: 'center', gap: 8, paddingVertical: 12 },
    waSuccessTitle: { color: '#E2E8F0', fontSize: 16, fontWeight: '700', marginTop: 4 },
    waSuccessPhone: { color: '#25D366', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
    waSuccessRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    waSuccessItem: { color: '#94A3B8', fontSize: 13 },
});
