/**
 * HomeIntelligentChat - Chat intelligent pour le HomeScreen avec délégation contextuelle
 * 
 * Ce composant :
 * 1. Détecte les questions contextuelles qui doivent déléguer aux modules spécialisés
 * 2. Donne les grands axes et boutons d'action vers les écrans spécifiques
 * 3. Garde un chat général pour les questions non-contextuelles
 */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { ActionDescriptor } from '../hooks/useScreenContext';
import { navigateToMesServicesHub } from '../navigation/mesServicesNavigation';
import { ChatMessage, intelligentChatService } from '../services/intelligentChatService';
import { modernColors } from '../theme/modernTheme';
import {
    buildExportBaseNameFromChat,
    exportChatTextAsPdf,
    exportChatTextAsWordDoc,
    openOrDownloadRemoteFile,
    stripSimpleMarkdownForExport,
} from '../utils/chatExportUtils';
import { FormattedChatText } from '../utils/chatMarkdown';
import {
    cancelAudioRecording,
    pickDocumentForYukpoIa,
    pickImageForYukpoIa,
    startAudioRecordingForYukpoIa,
    stopAudioRecordingForYukpoIa,
    type YukpoIaAttachmentPayload
} from '../utils/yukpoIaAttachments';
import GlobalShareModal, { GlobalSharePayload } from './GlobalShareModal';
import SafeIcon from './SafeIcon';

const { width, height } = Dimensions.get('window');

const DEFAULT_SHARE_WEB = 'https://yukpomnang.com';

const orderAndCapAssistantActions = (
    actions: any[] | undefined,
    max = 3,
): { navLinks: any[]; otherActions: any[] } => {
    if (!actions?.length) return { navLinks: [], otherActions: [] };
    const recharge = actions.find((a) => a.id === 'yukpo-ia-recharge');
    const rest = actions.filter((a) => a.id !== 'yukpo-ia-recharge');
    const nav = rest.filter((a: any) => a.id?.startsWith('nav-'));
    const other = rest.filter((a: any) => !a.id?.startsWith('nav-'));
    const ordered = [...(recharge ? [recharge] : []), ...nav, ...other].slice(0, max);
    return {
        navLinks: ordered.filter((a: any) => a.id?.startsWith('nav-')),
        otherActions: ordered.filter((a: any) => !a.id?.startsWith('nav-')),
    };
};

interface HomeIntelligentChatProps {
    visible: boolean;
    onClose: () => void;
}

const HomeIntelligentChat: React.FC<HomeIntelligentChatProps> = ({
    visible,
    onClose
}) => {
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const navigation = useNavigation();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [sharePayload, setSharePayload] = useState<GlobalSharePayload | null>(null);
    const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
    const [pendingAttachments, setPendingAttachments] = useState<YukpoIaAttachmentPayload[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Suggestions rapides pour le HomeScreen
    const quickSuggestions = [
        {
            id: 'discover',
            text: t('intelligentChat.discoveryQuery') || 'Qu\'est-ce que Yukpo ? Montre-moi toutes les fonctionnalités',
            icon: 'rocket',
            color: modernColors.primary
        },
        {
            id: 'search',
            text: t('intelligentChat.quickActions') || 'Comment rechercher un service ou produit ?',
            icon: 'search',
            color: modernColors.accent
        },
        {
            id: 'create',
            text: t('intelligentChat.createService') || 'Comment créer mon service ou vendre mes produits ?',
            icon: 'plus',
            color: modernColors.success
        },
        {
            id: 'navigation',
            text: t('intelligentChat.nav.gps') || 'Comment utiliser la navigation GPS intelligente ?',
            icon: 'map',
            color: modernColors.warning
        },
        {
            id: 'health',
            text: t('intelligentChat.nav.health') || 'Services santé : pharmacies, hôpitaux, IA médicale',
            icon: 'heart',
            color: '#EF4444'
        },
        {
            id: 'delivery',
            text: t('intelligentChat.nav.delivery') || 'Livraison de colis et courses à domicile',
            icon: 'truck',
            color: '#8B5CF6'
        }
    ];

    React.useEffect(() => {
        if (visible) {
            // Animation d'entrée
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true
            }).start();

            // Message de bienvenue
            const welcomeMessage: ChatMessage = {
                id: 'welcome',
                text: user?.name
                    ? t('intelligentChat.welcomeHomeUser', { name: user.name })
                    : t('intelligentChat.welcomeHome'),
                isUser: false,
                timestamp: new Date(),
                type: 'text',
                suggestedActions: quickSuggestions.slice(0, 3).map(s => ({
                    id: s.id,
                    label: s.text,
                    icon: s.icon,
                    route: 'Home', // Reste sur HomeScreen
                    category: 'help' as const,
                    description: '',
                    color: s.color // Ajouter la couleur
                }))
            };
            setMessages([welcomeMessage]);
        } else {
            // Animation de sortie
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true
            }).start();
        }
    }, [visible, user?.name, t]);

    // Logique unifiée pour traiter un message (suggestion cliquée ou texte tapé)
    const processMessage = useCallback(async (text: string, attachments?: YukpoIaAttachmentPayload[]) => {
        setIsLoading(true);
        setShowSuggestions(false);

        try {
            // getContextualResponse gère tout : détection de délégation, appel backend, fallback
            const chatResponse = await intelligentChatService.getContextualResponse(
                text, 'Home', 'home', messages, user,
                attachments?.length ? { yukpoIaAttachments: attachments } : undefined,
            );

            const response: ChatMessage = {
                id: (Date.now() + 1).toString(),
                text: chatResponse.message,
                isUser: false,
                timestamp: new Date(),
                type: chatResponse.type,
                suggestedActions: chatResponse.suggestedActions,
                visualElements: chatResponse.visualElements,
                nextSteps: chatResponse.nextSteps,
                attachments: chatResponse.attachments,
                metadata: {
                    billing: chatResponse.billing,
                    assistantBrand: chatResponse.assistantBrand,
                },
            };
            setMessages(prev => [...prev, response]);
        } catch (error) {
            console.error('[HomeIntelligentChat] Erreur:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                text: t('intelligentChat.error') || 'Désolé, je rencontre des difficultés. Veuillez réessayer.',
                isUser: false,
                timestamp: new Date(),
                type: 'text'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [messages, user, t]);

    const handleActionPress = useCallback(async (action: ActionDescriptor) => {
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            text: action.label,
            isUser: true,
            timestamp: new Date(),
            type: 'action_suggestion'
        };
        setMessages(prev => [...prev, userMessage]);
        await processMessage(action.label);
    }, [processMessage]);

    const handleSendMessage = useCallback(async () => {
        if ((!inputText.trim() && pendingAttachments.length === 0) || isLoading) return;
        const text = inputText.trim() || (t('yukpoIa.analyzeThis') as string);
        const atts = [...pendingAttachments];
        setPendingAttachments([]);

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            text: atts.length ? `${text}${atts.length ? ` \n📎×${atts.length}` : ''}` : text,
            isUser: true,
            timestamp: new Date(),
            type: 'text'
        };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        await processMessage(text, atts.length ? atts : undefined);
    }, [inputText, isLoading, processMessage, pendingAttachments, t]);

    const handleNavigateToScreen = useCallback((route: string, params?: any) => {
        onClose(); // Fermer le chat d'abord
        if (route === 'MesServices' || route === 'Services') {
            navigateToMesServicesHub(navigation as any);
            return;
        }
        // @ts-ignore
        navigation.navigate(route, params);
    }, [navigation, onClose]);

    const openShareAssistant = useCallback(
        (message: ChatMessage) => {
            setSharePayload({
                title: (t('intelligentChat.shareTitle') as string) || 'Réponse Yukpo',
                description: stripSimpleMarkdownForExport(message.text).slice(0, 4000),
                shareUrl: DEFAULT_SHARE_WEB,
                contentType: 'chat_message',
                extraData: { source: 'home_intelligent_chat', messageId: message.id },
            });
            setShareModalVisible(true);
        },
        [t],
    );

    const promptExportAssistant = useCallback(
        (message: ChatMessage) => {
            const base = buildExportBaseNameFromChat(message.text, 'reponse-yukpo-ia');
            Alert.alert(
                (t('intelligentChat.exportTitle') as string) || 'Enregistrer la réponse',
                (t('intelligentChat.exportSubtitle') as string) || '',
                [
                    {
                        text: (t('intelligentChat.exportPdf') as string) || 'PDF',
                        onPress: () => { void exportChatTextAsPdf(message.text, base, { withYukpoIaFooter: true }); },
                    },
                    {
                        text: (t('intelligentChat.exportWord') as string) || 'Word (.doc)',
                        onPress: () => { void exportChatTextAsWordDoc(message.text, base, { withYukpoIaFooter: true }); },
                    },
                    { text: (t('message.cancel') as string) || 'Annuler', style: 'cancel' },
                ],
            );
        },
        [t],
    );

    const toggleReactionHome = useCallback((messageId: string, emoji: string) => {
        setMessageReactions((prev) => {
            const n = { ...prev };
            if (n[messageId] === emoji) delete n[messageId];
            else n[messageId] = emoji;
            return n;
        });
    }, []);

    const renderMessage = useCallback((message: ChatMessage, index: number) => {
        const isUserMessage = message.isUser;

        return (
            <View key={message.id} style={[
                styles.messageContainer,
                isUserMessage ? styles.userMessage : styles.assistantMessage
            ]}>
                <View style={[
                    styles.messageBubble,
                    isUserMessage ? styles.userBubble : styles.assistantBubble
                ]}>
                    {isUserMessage ? (
                        <Text style={[styles.messageText, styles.userText]}>{message.text}</Text>
                    ) : (
                        <FormattedChatText
                            text={message.text}
                            baseStyle={[styles.messageText, styles.assistantText]}
                        />
                    )}

                    {!isUserMessage && message.metadata?.billing?.enabled && message.metadata?.billing?.tokens_charged > 0 && !message.metadata?.billing?.insufficient_balance && (
                        <Text style={styles.billingChip}>
                            {message.metadata.billing.from_free_quota
                                ? t('yukpoIa.billingNoticeFree', { charged: message.metadata.billing.tokens_charged, remaining: (message.metadata.billing.monthly_free_remaining ?? message.metadata.billing.daily_free_remaining) ?? '?' })
                                : message.metadata.billing.units_from_wallet > 0
                                    ? t('yukpoIa.billingNoticePaid', { charged: message.metadata.billing.tokens_charged, balance: message.metadata.billing.balance_after ?? '?' })
                                    : t('yukpoIa.billingNoticeGeneric', { charged: message.metadata.billing.tokens_charged })
                                    || String(message.metadata.billing.notice)}
                        </Text>
                    )}

                    {!isUserMessage && message.attachments && message.attachments.length > 0 && (
                        <View style={styles.attachmentsWrap}>
                            {message.attachments.map((att) => (
                                <TouchableOpacity
                                    key={att.id}
                                    style={styles.attachmentRow}
                                    onPress={() => void openOrDownloadRemoteFile(att.url, att.filename)}
                                >
                                    <Text style={styles.attachmentIcon}>📎</Text>
                                    <Text style={styles.attachmentName} numberOfLines={1}>{att.filename}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Actions suggérées */}
                    {message.suggestedActions && message.suggestedActions.length > 0 && (() => {
                        const { navLinks, otherActions } = orderAndCapAssistantActions(message.suggestedActions, 3);
                        return (
                            <View style={styles.suggestedActionsContainer}>
                                {otherActions.map((action, actionIndex) => (
                                    <TouchableOpacity
                                        key={`action-${actionIndex}`}
                                        style={[
                                            styles.suggestedAction,
                                            { borderLeftColor: action.color || modernColors.primary }
                                        ]}
                                        onPress={() => {
                                            if (action.route) {
                                                handleNavigateToScreen(action.route, action.params);
                                            } else {
                                                handleActionPress(action);
                                            }
                                        }}
                                    >
                                        <View style={styles.actionIcon}>
                                            <SafeIcon
                                                name={action.icon || 'help-circle'}
                                                size={16}
                                                color={action.color || modernColors.primary}
                                            />
                                        </View>
                                        <Text style={styles.actionText}>{action.label}</Text>
                                        {action.description && (
                                            <Text style={styles.actionDescription}>{action.description}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                                {navLinks.length > 0 && (
                                    <>
                                        <Text style={styles.navLinksTitle}>{t('intelligentChat.quickAccess')}</Text>
                                        {navLinks.map((action, actionIndex) => (
                                            <TouchableOpacity
                                                key={`nav-${actionIndex}`}
                                                style={styles.navLinkButton}
                                                onPress={() => handleNavigateToScreen(action.route!, action.params)}
                                            >
                                                <SafeIcon
                                                    name={action.icon || 'arrow-right'}
                                                    size={16}
                                                    color="#fff"
                                                />
                                                <Text style={styles.navLinkText}>{action.label}</Text>
                                                <SafeIcon name="chevron-right" size={14} color="#fff" />
                                            </TouchableOpacity>
                                        ))}
                                    </>
                                )}
                            </View>
                        );
                    })()}

                    {/* Next steps */}
                    {message.nextSteps && message.nextSteps.length > 0 && (
                        <View style={styles.nextStepsContainer}>
                            <Text style={styles.nextStepsTitle}>📍 Prochaines étapes:</Text>
                            {message.nextSteps.map((step, stepIndex) => (
                                <Text key={stepIndex} style={styles.nextStepText}>
                                    • {step}
                                </Text>
                            ))}
                        </View>
                    )}
                </View>

                <Text style={styles.messageTime}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    }, [handleActionPress, handleNavigateToScreen, openShareAssistant, promptExportAssistant, toggleReactionHome, messageReactions, t]);

    const renderQuickSuggestions = useCallback(() => {
        if (!showSuggestions || messages.length > 1) return null;

        return (
            <View style={styles.quickSuggestionsContainer}>
                <Text style={styles.suggestionsTitle}>💡 Suggestions rapides:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.suggestionsScroll}>
                        {quickSuggestions.slice(0, 3).map((suggestion, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.suggestionChip,
                                    { backgroundColor: `${suggestion.color}15` }
                                ]}
                                onPress={() => handleActionPress({
                                    id: suggestion.id,
                                    label: suggestion.text,
                                    icon: suggestion.icon,
                                    route: 'Home',
                                    category: 'help',
                                    description: '',
                                    color: suggestion.color // Ajouter la couleur
                                })}
                            >
                                <SafeIcon name={suggestion.icon} size={16} color={suggestion.color} />
                                <Text style={[styles.suggestionText, { color: suggestion.color }]}>
                                    {suggestion.text.length > 30
                                        ? suggestion.text.substring(0, 30) + '...'
                                        : suggestion.text
                                    }
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>
        );
    }, [showSuggestions, messages.length, quickSuggestions, handleActionPress]);

    return (
        <>
            <Modal
                visible={visible}
                animationType="fade"
                presentationStyle="fullScreen"
                onRequestClose={onClose}
            >
                <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                    {/* En-tête */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.textPrimary} />
                        </TouchableOpacity>

                        <View style={styles.headerContent}>
                            <SafeIcon name="message-circle" size={20} color={modernColors.primary} />
                            <Text style={styles.headerTitle}>
                                {t('yukpoIa.brandName') || t('intelligentChat.title') || 'YukpoIA'}
                            </Text>
                            <Text style={styles.headerSubtitle}>
                                {t('intelligentChat.welcomeScreen', { screen: 'Accueil' })}
                            </Text>
                        </View>
                    </View>

                    {/* Messages */}
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.messagesContainer}
                        contentContainerStyle={styles.messagesContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {messages.map(renderMessage)}
                        {isLoading && (
                            <View style={[styles.messageContainer, styles.assistantMessage]}>
                                <View style={[styles.messageBubble, styles.assistantBubble]}>
                                    <Text style={styles.thinkingText}>
                                        {t('intelligentChat.thinking') || 'Réflexion en cours...'} 🤔
                                    </Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Suggestions rapides */}
                    {renderQuickSuggestions()}

                    {/* Input */}
                    <View style={styles.inputContainer}>
                        {pendingAttachments.length > 0 && (
                            <Text style={styles.pendingAttHint}>
                                📎 {pendingAttachments.length} — {t('yukpoIa.billingLabel')}
                            </Text>
                        )}
                        <View style={styles.mediaToolbar}>
                            <TouchableOpacity
                                style={styles.mediaToolBtn}
                                onPress={async () => {
                                    const a = await pickImageForYukpoIa();
                                    if (a) setPendingAttachments((p) => [...p, a]);
                                }}
                                disabled={isLoading}
                            >
                                <SafeIcon name="image" size={22} color={modernColors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.mediaToolBtn}
                                onPress={async () => {
                                    const a = await pickDocumentForYukpoIa();
                                    if (a) setPendingAttachments((p) => [...p, a]);
                                }}
                                disabled={isLoading}
                            >
                                <SafeIcon name="paperclip" size={22} color={modernColors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.mediaToolBtn, isRecording && { backgroundColor: '#fee2e2' }]}
                                onPress={async () => {
                                    if (isRecording) {
                                        const a = await stopAudioRecordingForYukpoIa();
                                        setIsRecording(false);
                                        if (a) setPendingAttachments((p) => [...p, a]);
                                    } else {
                                        const ok = await startAudioRecordingForYukpoIa();
                                        setIsRecording(ok);
                                    }
                                }}
                                onLongPress={() => {
                                    if (isRecording) {
                                        cancelAudioRecording();
                                        setIsRecording(false);
                                    }
                                }}
                                disabled={isLoading}
                            >
                                <SafeIcon name={isRecording ? 'square' : 'mic'} size={22} color={isRecording ? '#dc2626' : modernColors.primary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.textInput}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder={t('intelligentChat.placeholder') || 'Posez votre question...'}
                                placeholderTextColor={modernColors.textSecondary}
                                multiline
                                maxLength={500}
                                editable={!isLoading}
                                onSubmitEditing={handleSendMessage}
                            />
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    {
                                        opacity:
                                            (inputText.trim() || pendingAttachments.length > 0) && !isLoading
                                                ? 1
                                                : 0.5,
                                    },
                                ]}
                                onPress={handleSendMessage}
                                disabled={(!inputText.trim() && pendingAttachments.length === 0) || isLoading}
                            >
                                <SafeIcon
                                    name="send"
                                    size={20}
                                    color={
                                        (inputText.trim() || pendingAttachments.length > 0) && !isLoading
                                            ? '#FFFFFF'
                                            : modernColors.textSecondary
                                    }
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </Modal>
            <GlobalShareModal
                visible={shareModalVisible}
                onClose={() => {
                    setShareModalVisible(false);
                    setSharePayload(null);
                }}
                payload={sharePayload}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    closeButton: {
        padding: 8,
        marginRight: 12,
    },
    headerContent: {
        flex: 1,
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.textPrimary,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    messagesContainer: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    messagesContent: {
        padding: 20,
    },
    messageContainer: {
        marginBottom: 16,
    },
    userMessage: {
        alignItems: 'flex-end',
    },
    assistantMessage: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        maxWidth: width * 0.8,
        padding: 16,
        borderRadius: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    userBubble: {
        backgroundColor: modernColors.primary,
        borderBottomRightRadius: 4,
    },
    assistantBubble: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 24,
    },
    userText: {
        color: '#FFFFFF',
    },
    assistantText: {
        color: modernColors.textPrimary,
    },
    messageTime: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        marginHorizontal: 8,
    },
    suggestedActionsContainer: {
        marginTop: 12,
    },
    suggestedAction: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderLeftWidth: 4,
    },
    actionIcon: {
        marginRight: 12,
    },
    actionText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
    },
    actionDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    navLinksTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.textSecondary,
        marginTop: 12,
        marginBottom: 6,
    },
    navLinkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 6,
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        gap: 8,
    },
    navLinkText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    nextStepsContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F0F9FF',
        borderRadius: 8,
    },
    nextStepsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 8,
    },
    nextStepText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    quickSuggestionsContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    suggestionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
        marginBottom: 8,
    },
    suggestionsScroll: {
        flexDirection: 'row',
        paddingVertical: 4,
    },
    suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    suggestionText: {
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 6,
    },
    inputContainer: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    pendingAttHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 6,
    },
    mediaToolbar: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    mediaToolBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    billingChip: {
        marginTop: 8,
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#F3F4F6',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: modernColors.textPrimary,
        maxHeight: 100,
        marginRight: 12,
    },
    sendButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
    },
    thinkingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    attachmentsWrap: {
        marginTop: 10,
        gap: 6,
    },
    attachmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        alignSelf: 'flex-start',
        maxWidth: '100%',
    },
    attachmentIcon: {
        fontSize: 14,
    },
    attachmentName: {
        flex: 1,
        fontSize: 13,
        color: modernColors.textPrimary,
    },
    assistantExtras: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    toolbarHome: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    iconBtnHome: {
        padding: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
    },
    iconBtnTxt: {
        fontSize: 16,
    },
    reactionsHome: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
    },
    reactionLabelHome: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginRight: 4,
    },
    reactionBtnHome: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
    },
    reactionBtnHomeOn: {
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
});

export default HomeIntelligentChat;
