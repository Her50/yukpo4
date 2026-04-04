// AIChatScreen — YukpoIA
// Assistant intelligent Yukpo : tendances, community management, boutique, commandes.
// Accès direct aux modules spécialisés via actions rapides intégrées.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../services/api';
import SafeIcon from '../../components/SafeIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
    action?: ActionCard;
}

interface ActionCard {
    label: string;
    screen: string;
    params?: Record<string, unknown>;
    icon: string;
    color: string;
}

// ─── Raccourcis contextuels ────────────────────────────────────────────────────

const QUICK_ACTIONS = [
    { label: 'Tendances', screen: 'TrendPulseDashboard', icon: 'trending-up', color: '#8B5CF6' },
    { label: 'Community Manager', screen: 'SocialAI', icon: 'people', color: '#1877F2' },
    { label: 'Broadcast WA', screen: 'WhatsAppBroadcast', icon: 'logo-whatsapp', color: '#25D366' },
    { label: 'CRM Clients', screen: 'CRMLight', icon: 'person-circle', color: '#0EA5E9' },
    { label: 'Analytics', screen: 'SocialAnalyticsDashboard', icon: 'bar-chart', color: '#10B981' },
    { label: 'Réputation', screen: 'ReputationDashboard', icon: 'shield-checkmark', color: '#F59E0B' },
];

// Mots-clés → navigation directe
const NAV_TRIGGERS: { keywords: string[]; action: ActionCard }[] = [
    {
        keywords: ['trend', 'tendance', 'viral', 'populaire', 'trending', 'trendpulse', 'opportunité'],
        action: {
            label: 'Voir les tendances TrendPulse',
            screen: 'TrendPulseDashboard',
            icon: 'trending-up',
            color: '#8B5CF6',
        },
    },
    {
        keywords: ['reel', 'script', 'tiktok', 'shorts', 'scénario vidéo', 'script reel'],
        action: {
            label: 'Générer un script Reel/TikTok',
            screen: 'ReelScript',
            icon: 'film',
            color: '#8B5CF6',
        },
    },
    {
        keywords: ['planification', 'meilleure heure', 'optimal', 'smart schedule', 'quand publier', 'heure publier'],
        action: {
            label: 'Planification intelligente',
            screen: 'SmartScheduling',
            icon: 'calendar',
            color: '#7C3AED',
        },
    },
    {
        keywords: ['benchmark', 'comparaison', 'concurrent', 'secteur', 'performance secteur'],
        action: {
            label: 'Benchmark vs secteur',
            screen: 'BenchmarkAnalytics',
            icon: 'podium',
            color: '#6366F1',
        },
    },
    {
        keywords: ['community', 'manager', 'chatbot', 'bot', 'répondre', 'messenger', 'instagram dm', 'commentaire', 'inbox', 'automatique'],
        action: {
            label: 'Ouvrir Community Manager Yukpo',
            screen: 'SocialAI',
            icon: 'people',
            color: '#1877F2',
        },
    },
    {
        keywords: ['analytique', 'analytics', 'statistique', 'performance', 'engagement', 'rapport'],
        action: {
            label: 'Voir les analytics sociaux',
            screen: 'SocialAnalyticsDashboard',
            icon: 'bar-chart',
            color: '#10B981',
        },
    },
    {
        keywords: ['réputation', 'mention', 'crise', 'commentaire négatif', 'avis négatif', 'surveiller'],
        action: {
            label: 'Dashboard Réputation',
            screen: 'ReputationDashboard',
            icon: 'shield-checkmark',
            color: '#F59E0B',
        },
    },
    {
        keywords: ['voix', 'brand voice', 'ton de marque', 'style', 'signature', 'personnalité marque'],
        action: {
            label: 'Configurer la voix de marque',
            screen: 'BrandVoice',
            icon: 'mic',
            color: '#EC4899',
        },
    },
    {
        keywords: ['valider', 'validation', 'approuver', 'post en attente', 'contenu à valider', 'approuver post'],
        action: {
            label: 'Validation de contenu',
            screen: 'ContentApproval',
            icon: 'checkmark-circle',
            color: '#10B981',
        },
    },
    {
        keywords: ['email', 'emailing', 'newsletter', 'campagne email', 'email marketing'],
        action: {
            label: 'Email Marketing IA',
            screen: 'EmailCampaign',
            icon: 'mail',
            color: '#6366F1',
        },
    },
    {
        keywords: ['broadcast', 'envoyer à tous', 'message de masse', 'whatsapp broadcast', 'diffusion'],
        action: {
            label: 'WhatsApp Broadcast',
            screen: 'WhatsAppBroadcast',
            icon: 'logo-whatsapp',
            color: '#25D366',
        },
    },
    {
        keywords: ['panier abandonné', 'relance client', 'abandoned cart', 'récupérer client', 'relancer'],
        action: {
            label: 'Recovery paniers abandonnés',
            screen: 'WhatsAppBroadcast',
            params: { tab: 'recovery' },
            icon: 'cart',
            color: '#F59E0B',
        },
    },
    {
        keywords: ['crm', 'client', 'profil client', 'vip', 'fidélité', 'historique client'],
        action: {
            label: 'CRM Clients',
            screen: 'CRMLight',
            icon: 'person-circle',
            color: '#0EA5E9',
        },
    },
    {
        keywords: ['marketplace', 'vendre à partenaires', 'cross-vente', 'vitrine partenaires'],
        action: {
            label: 'Marketplace cross-partenaires',
            screen: 'Marketplace',
            icon: 'storefront',
            color: '#059669',
        },
    },
    {
        keywords: ['long format', 'article', 'blog', 'youtube script', 'linkedin article', 'podcast'],
        action: {
            label: 'Contenu long format',
            screen: 'LongformContent',
            icon: 'document-text',
            color: '#0EA5E9',
        },
    },
    {
        keywords: ['lien de paiement', 'payment link', 'payer whatsapp', 'paiement whatsapp'],
        action: {
            label: 'Créer un lien de paiement',
            screen: 'CRMLight',
            icon: 'card',
            color: '#7C3AED',
        },
    },
    {
        keywords: ['configurer', 'connecter', 'compte social', 'facebook connecter', 'whatsapp configurer', 'setup'],
        action: {
            label: 'Connecter mes comptes sociaux',
            screen: 'SocialAccountSetup',
            icon: 'link',
            color: '#1877F2',
        },
    },
];

function detectAction(text: string): ActionCard | undefined {
    const lower = text.toLowerCase();
    for (const trigger of NAV_TRIGGERS) {
        if (trigger.keywords.some(kw => lower.includes(kw))) {
            return trigger.action;
        }
    }
    return undefined;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const AIChatScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { token } = useAuth();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '0',
            text: 'Bonjour ! Je suis YukpoIA, votre assistant intelligent.\n\nVoici ce que je peux faire pour vous :\n\n📈 TENDANCES\n• Voir les tendances de votre secteur → dites "tendances"\n• Générer un script Reel/TikTok → dites "script reel"\n• Trouver la meilleure heure de publication → dites "quand publier"\n• Comparer vos performances vs la concurrence → dites "benchmark"\n\n🤖 COMMUNITY MANAGER\n• Configurer le chatbot 24/7 → dites "chatbot"\n• Envoyer un broadcast WhatsApp → dites "broadcast"\n• Gérer vos clients VIP → dites "CRM clients"\n• Campagnes email IA → dites "email marketing"\n• Récupérer paniers abandonnés → dites "panier abandonné"\n• Marketplace cross-partenaires → dites "marketplace"\n• Surveiller votre réputation → dites "réputation"\n• Configurer votre voix de marque → dites "brand voice"\n\nUtilisez aussi les raccourcis rapides ci-dessus ↑',
            isUser: false,
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);

    const sendMessage = useCallback(async () => {
        const text = inputText.trim();
        if (!text || loading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text,
            isUser: true,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        // Détection locale d'intention pour navigation directe
        const detectedAction = detectAction(text);

        try {
            const resp = await apiPost('/api/ai/chat', { message: text }, token);
            const replyText: string = resp?.message ?? resp?.data?.message ?? 'Je n\'ai pas pu traiter votre demande.';

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                isUser: false,
                timestamp: new Date(),
                action: detectedAction ?? detectAction(replyText),
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch {
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Une erreur est survenue. Réessayez ou utilisez les raccourcis ci-dessus.',
                isUser: false,
                timestamp: new Date(),
                action: detectedAction,
            };
            setMessages(prev => [...prev, aiMsg]);
        } finally {
            setLoading(false);
        }
    }, [inputText, loading, token]);

    useEffect(() => {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages]);

    const renderMessage = ({ item }: { item: Message }) => (
        <View style={[s.row, item.isUser && s.rowUser]}>
            {!item.isUser && (
                <View style={s.avatar}>
                    <Text style={s.avatarText}>Y</Text>
                </View>
            )}
            <View style={[s.bubble, item.isUser ? s.bubbleUser : s.bubbleAI]}>
                <Text style={[s.bubbleText, item.isUser && s.bubbleTextUser]}>
                    {item.text}
                </Text>
                <Text style={[s.time, item.isUser && { color: '#FFD70088' }]}>
                    {item.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.action && (
                    <TouchableOpacity
                        style={[s.actionCard, { borderColor: item.action.color }]}
                        onPress={() => navigation.navigate(item.action!.screen, item.action!.params)}
                    >
                        <SafeIcon name={item.action.icon as any} size={16} color={item.action.color} />
                        <Text style={[s.actionLabel, { color: item.action.color }]}>
                            {item.action.label}
                        </Text>
                        <SafeIcon name="chevron-forward" size={14} color={item.action.color} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <SafeIcon name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={s.headerInfo}>
                    <Text style={s.headerTitle}>YukpoIA</Text>
                    <Text style={s.headerSub}>Assistant intelligent · Toujours disponible</Text>
                </View>
                <View style={s.onlineDot} />
            </View>

            {/* Raccourcis rapides — scroll horizontal */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.quickBar}
                contentContainerStyle={s.quickBarContent}
            >
                {QUICK_ACTIONS.map(qa => (
                    <TouchableOpacity
                        key={qa.screen}
                        style={[s.quickBtn, { borderColor: qa.color + '44' }]}
                        onPress={() => navigation.navigate(qa.screen)}
                    >
                        <SafeIcon name={qa.icon as any} size={14} color={qa.color} />
                        <Text style={[s.quickLabel, { color: qa.color }]}>{qa.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Suggestions questions — scroll horizontal */}
            {messages.length === 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={s.suggestBar}
                    contentContainerStyle={s.suggestBarContent}
                >
                    {[
                        'Quelles sont les tendances de mon secteur ?',
                        'Comment configurer le chatbot ?',
                        'Envoyer un broadcast WhatsApp',
                        'Générer un script Reel',
                        'Voir mes clients VIP',
                        'Créer une campagne email',
                        'Récupérer paniers abandonnés',
                        'Comparer mes stats vs concurrents',
                    ].map(q => (
                        <TouchableOpacity
                            key={q}
                            style={s.suggestChip}
                            onPress={() => setInputText(q)}
                        >
                            <Text style={s.suggestText}>{q}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                contentContainerStyle={s.list}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Typing indicator */}
            {loading && (
                <View style={s.typingRow}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>Y</Text>
                    </View>
                    <View style={s.typingDots}>
                        <Text style={s.typingText}>YukpoIA rédige…</Text>
                    </View>
                </View>
            )}

            {/* Input */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={s.inputBar}>
                    <TextInput
                        style={s.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Posez votre question…"
                        placeholderTextColor="#475569"
                        multiline
                        returnKeyType="send"
                        onSubmitEditing={sendMessage}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        style={[s.sendBtn, (!inputText.trim() || loading) && s.sendBtnDisabled]}
                        onPress={sendMessage}
                        disabled={!inputText.trim() || loading}
                    >
                        <SafeIcon name="send" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
        backgroundColor: '#1E293B',
        borderBottomWidth: 1, borderBottomColor: '#334155',
    },
    backBtn: { padding: 4 },
    headerInfo: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
    headerSub: { color: '#64748B', fontSize: 12 },
    onlineDot: {
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: '#10B981',
    },
    quickBar: {
        backgroundColor: '#1E293B',
        borderBottomWidth: 1, borderBottomColor: '#334155',
        maxHeight: 52,
    },
    quickBarContent: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: 10,
    },
    suggestBar: {
        backgroundColor: '#0F172A',
        maxHeight: 48,
        borderBottomWidth: 1, borderBottomColor: '#1E293B',
    },
    suggestBarContent: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: 8,
    },
    suggestChip: {
        borderWidth: 1, borderColor: '#334155', borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: '#1E293B',
    },
    suggestText: { color: '#94A3B8', fontSize: 12 },
    quickBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        borderWidth: 1, borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: '#0F172A',
    },
    quickLabel: { fontSize: 12, fontWeight: '600' },
    list: { padding: 16, gap: 12 },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    rowUser: { justifyContent: 'flex-end' },
    avatar: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#6366F1',
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    bubble: {
        maxWidth: '80%', borderRadius: 16, padding: 12,
        gap: 4,
    },
    bubbleAI: {
        backgroundColor: '#1E293B',
        borderTopLeftRadius: 4,
    },
    bubbleUser: {
        backgroundColor: '#FFD700',
        borderTopRightRadius: 4,
    },
    bubbleText: { color: '#E2E8F0', fontSize: 15, lineHeight: 22 },
    bubbleTextUser: { color: '#0F172A' },
    time: { color: '#94A3B8', fontSize: 11 },
    actionCard: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 8,
        marginTop: 6,
        backgroundColor: '#0F172A',
    },
    actionLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
    typingRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingBottom: 8,
    },
    typingDots: {
        backgroundColor: '#1E293B', borderRadius: 16,
        paddingHorizontal: 14, paddingVertical: 10,
    },
    typingText: { color: '#64748B', fontSize: 13, fontStyle: 'italic' },
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
        paddingHorizontal: 12, paddingVertical: 12,
        backgroundColor: '#1E293B',
        borderTopWidth: 1, borderTopColor: '#334155',
    },
    input: {
        flex: 1, backgroundColor: '#0F172A',
        borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
        color: '#E2E8F0', fontSize: 15,
        maxHeight: 100,
        borderWidth: 1, borderColor: '#334155',
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#6366F1',
        alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#334155' },
});

export default AIChatScreen;
