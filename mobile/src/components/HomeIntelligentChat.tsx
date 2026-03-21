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
import { ChatMessage, intelligentChatService } from '../services/intelligentChatService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width, height } = Dimensions.get('window');

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
                suggestedActions: quickSuggestions.map(s => ({
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

    const handleActionPress = useCallback(async (action: ActionDescriptor) => {
        // Ajouter l'action comme message utilisateur
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            text: action.label,
            isUser: true,
            timestamp: new Date(),
            type: 'action_suggestion'
        };
        setMessages(prev => [...prev, userMessage]);

        setIsLoading(true);
        setShowSuggestions(false);

        try {
            // Détecter si c'est une question contextuelle
            const delegation = intelligentChatService.detectContextualDelegation(action.label);

            let response: ChatMessage;

            if (delegation) {
                // Question contextuelle : déléguer au module spécialisé
                const chatResponse = intelligentChatService.generateContextualDelegationResponse(action.label, delegation);

                response = {
                    id: (Date.now() + 1).toString(),
                    text: chatResponse.message,
                    isUser: false,
                    timestamp: new Date(),
                    type: chatResponse.type,
                    suggestedActions: chatResponse.suggestedActions,
                    nextSteps: chatResponse.nextSteps
                };
            } else {
                // Question générale : réponse du HomeScreen
                const chatResponse = await intelligentChatService.getContextualResponse(
                    action.label,
                    'Home',
                    'home',
                    messages,
                    user
                );

                response = {
                    id: (Date.now() + 1).toString(),
                    text: chatResponse.message,
                    isUser: false,
                    timestamp: new Date(),
                    type: chatResponse.type,
                    suggestedActions: chatResponse.suggestedActions,
                    visualElements: chatResponse.visualElements,
                    nextSteps: chatResponse.nextSteps
                };
            }

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

    const handleSendMessage = useCallback(async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            text: inputText.trim(),
            isUser: true,
            timestamp: new Date(),
            type: 'text'
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);
        setShowSuggestions(false);

        try {
            // Détecter si c'est une question contextuelle
            const delegation = intelligentChatService.detectContextualDelegation(userMessage.text);

            let response: ChatMessage;

            if (delegation) {
                // Question contextuelle : déléguer au module spécialisé
                const chatResponse = intelligentChatService.generateContextualDelegationResponse(userMessage.text, delegation);

                response = {
                    id: (Date.now() + 1).toString(),
                    text: chatResponse.message,
                    isUser: false,
                    timestamp: new Date(),
                    type: chatResponse.type,
                    suggestedActions: chatResponse.suggestedActions,
                    nextSteps: chatResponse.nextSteps
                };
            } else {
                // Question générale : réponse du HomeScreen
                const chatResponse = await intelligentChatService.getContextualResponse(
                    userMessage.text,
                    'Home',
                    'home',
                    messages,
                    user
                );

                response = {
                    id: (Date.now() + 1).toString(),
                    text: chatResponse.message,
                    isUser: false,
                    timestamp: new Date(),
                    type: chatResponse.type,
                    suggestedActions: chatResponse.suggestedActions,
                    visualElements: chatResponse.visualElements,
                    nextSteps: chatResponse.nextSteps
                };
            }

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
    }, [inputText, isLoading, messages, user, t]);

    const handleNavigateToScreen = useCallback((route: string, params?: any) => {
        onClose(); // Fermer le chat d'abord
        // @ts-ignore
        navigation.navigate(route, params);
    }, [navigation, onClose]);

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
                    <Text style={[
                        styles.messageText,
                        isUserMessage ? styles.userText : styles.assistantText
                    ]}>
                        {message.text}
                    </Text>

                    {/* Actions suggérées */}
                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                        <View style={styles.suggestedActionsContainer}>
                            {message.suggestedActions.map((action, actionIndex) => (
                                <TouchableOpacity
                                    key={actionIndex}
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
                        </View>
                    )}

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
    }, [handleActionPress, handleNavigateToScreen]);

    const renderQuickSuggestions = useCallback(() => {
        if (!showSuggestions || messages.length > 1) return null;

        return (
            <View style={styles.quickSuggestionsContainer}>
                <Text style={styles.suggestionsTitle}>💡 Suggestions rapides:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.suggestionsScroll}>
                        {quickSuggestions.map((suggestion, index) => (
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
                            {t('intelligentChat.title') || 'Assistant IA'}
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
                                { opacity: inputText.trim() && !isLoading ? 1 : 0.5 }
                            ]}
                            onPress={handleSendMessage}
                            disabled={!inputText.trim() || isLoading}
                        >
                            <SafeIcon
                                name="send"
                                size={20}
                                color={inputText.trim() && !isLoading ? '#FFFFFF' : modernColors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </Modal>
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
});

export default HomeIntelligentChat;
