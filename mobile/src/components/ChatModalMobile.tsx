import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useKeyboardBottomInset } from '../hooks/useKeyboardBottomInset';
import { useScreenContext } from '../hooks/useScreenContext';
import { useWebSocketChat } from '../hooks/useWebSocketChat';
import { apiGet, apiPost } from '../services/api';
import { chatbotIntelligentService, ChatbotResponse, IconReference } from '../services/chatbotIntelligentService';
import { intelligentChatService } from '../services/intelligentChatService';
import { modernColors } from '../theme/modernTheme';
import NegotiatedPriceModal from './chat/NegotiatedPriceModal';
import OrderDeliveryModal from './delivery/OrderDeliveryModal';
import InAppCallModal from './InAppCallModal';
import InlineMentionSuggestions from './InlineMentionSuggestions';
import LinkableText from './LinkableText';
import ProductCommentsSection from './ProductCommentsSection';
import ProductGalleryPickerModal from './ProductGalleryPickerModal';
import SafeIcon from './SafeIcon';
import UserMentionPicker from './UserMentionPicker';

interface ChatModalMobileProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    prestataireInfo: any;
    user: any;
    conversationId?: string;  // ✅ NOUVEAU : Pour conversations privées (format UUID)
    isPrivateConversation?: boolean;  // ✅ NOUVEAU : Flag pour conversation privée
    initialMessages?: any[];  // ✅ NOUVEAU : Messages initiaux pour les conversations historiques
}

interface Participant {
    user_id: number;
    user_name: string;
    user_email: string;
    user_avatar?: string;
    role: string;
    invited_by?: number;
    joined_at: string;
    can_remove: boolean;
}

const ChatModalMobile: React.FC<ChatModalMobileProps> = ({
    visible,
    onClose,
    service,
    prestataireInfo,
    user,
    conversationId: privateConversationId,
    isPrivateConversation = false,
    initialMessages
}) => {
    const extractActiveMentionQuery = (text: string): string | null => {
        if (!text) return null;
        const match = text.match(/(?:^|[\s([{])@([^@\n\r]*)$/);
        if (!match) return null;
        const query = match[1]
            .replace(/^[\s]+/, '')
            .replace(/[),!?;:]+$/, '')
            .trim();
        return query.length > 0 ? query : null;
    };

    const navigation = useNavigation();
    const { t, language } = useLanguageSafe();
    const keyboardBottomInset = useKeyboardBottomInset();
    // ✅ FIX BUG 1: Use full contextual screen awareness for the chatbot panel
    const screenContext = useScreenContext('ChatModalMobile');
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // ✅ NOUVEAU: États pour @mention
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [mentionedUsers, setMentionedUsers] = useState<number[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantsList, setShowParticipantsList] = useState(false);

    // États pour les médias
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
    const [selectedAudioUri, setSelectedAudioUri] = useState<string | null>(null);
    const [selectedDocuments, setSelectedDocuments] = useState<Array<{ base64: string; name: string; size?: number }>>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [showProductGalleryPicker, setShowProductGalleryPicker] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
    // ✅ NOUVEAU: États pour livraison et négociation de prix
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [showNegotiatePriceModal, setShowNegotiatePriceModal] = useState(false);
    const [selectedProductForDelivery, setSelectedProductForDelivery] = useState<{ product: any; productIndex: number } | null>(null);
    const [selectedProductForNegotiation, setSelectedProductForNegotiation] = useState<{ product: any; productIndex: number; originalPrice: number } | null>(null);
    // ✅ NOUVEAU 2026-01-23: État pour vérifier si la livraison est disponible
    const [hasDeliveryConfig, setHasDeliveryConfig] = useState<boolean>(false);
    const [deliveryEnabled, setDeliveryEnabled] = useState<boolean>(false);

    // ✅ FIX 2026-03-03: État pour ouvrir les commentaires produit en modal inline
    const [showCommentsModal, setShowCommentsModal] = useState(false);
    const [commentsServiceId, setCommentsServiceId] = useState<number | null>(null);

    // ✅ NOUVEAU: États pour le système de réponse/citation
    const [replyingTo, setReplyingTo] = useState<any | null>(null);

    // États pour les appels internes
    const [showCallModal, setShowCallModal] = useState(false);
    const [callType, setCallType] = useState<'audio' | 'video'>('audio');

    // États pour le panneau chatbot IA inline
    const [showChatbotPanel, setShowChatbotPanel] = useState(false);
    const [chatbotMessages, setChatbotMessages] = useState<Array<{ id: string; text: string; isUser: boolean; response?: ChatbotResponse & { suggestedActions?: any[]; nextSteps?: string[] } }>>([]);
    const [chatbotInput, setChatbotInput] = useState('');
    const [chatbotLoading, setChatbotLoading] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const chatbotScrollRef = useRef<ScrollView>(null);

    // ✅ Animated typing dots (3 dots with staggered pulsing)
    const typingDot1 = useRef(new Animated.Value(0.3)).current;
    const typingDot2 = useRef(new Animated.Value(0.3)).current;
    const typingDot3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (prestataireTyping || chatbotLoading) {
            const createPulse = (dot: Animated.Value, delay: number) =>
                Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
                        Animated.timing(dot, { toValue: 0.3, duration: 400, easing: Easing.ease, useNativeDriver: true }),
                    ])
                );
            const a1 = createPulse(typingDot1, 0);
            const a2 = createPulse(typingDot2, 150);
            const a3 = createPulse(typingDot3, 300);
            a1.start(); a2.start(); a3.start();
            return () => { a1.stop(); a2.stop(); a3.stop(); };
        } else {
            typingDot1.setValue(0.3); typingDot2.setValue(0.3); typingDot3.setValue(0.3);
        }
    }, [prestataireTyping, chatbotLoading]);

    const scrollViewRef = useRef<any>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (keyboardBottomInset <= 0) return;
        requestAnimationFrame(() => {
            scrollViewRef.current?.scrollToEnd?.({ animated: true });
            if (showChatbotPanel) {
                chatbotScrollRef.current?.scrollToEnd?.({ animated: true });
            }
        });
    }, [keyboardBottomInset, showChatbotPanel]);

    // ✅ NOUVEAU : Utiliser conversationId si conversation privée, sinon service.id
    const parsedConversationId = privateConversationId ? Number(privateConversationId) : NaN;
    const effectiveServiceId = isPrivateConversation && !Number.isNaN(parsedConversationId)
        ? parsedConversationId
        : (service?.id || 0);

    const prestataireUserId = Number(
        prestataireInfo?.user_id ?? prestataireInfo?.userId ?? 0,
    );

    // Utiliser le hook WebSocket
    const {
        messages,
        isConnected,
        isTyping: prestataireTyping,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead,
        setInitialMessages  // ✅ NOUVEAU: Récupérer la fonction pour définir les messages initiaux
    } = useWebSocketChat(
        effectiveServiceId,
        prestataireUserId,
        user?.id || 0
    );

    // Fonction utilitaire pour extraire la valeur d'un champ de service
    const getServiceFieldValue = (field: any): string => {
        if (!field) return t('chatModalMobile.nonSpecifie');
        if (typeof field === 'string') return field;
        if (field && typeof field === 'object') {
            if (field.valeur !== undefined) {
                const value = field.valeur;
                if (typeof value === 'string') return value;
                if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
                if (typeof value === 'number') return value.toString();
                if (Array.isArray(value)) return value.join(', ');
                return String(value);
            }
        }
        return t('chatModalMobile.nonSpecifie');
    };

    const nomPrestataire = prestataireInfo?.nom_complet || prestataireInfo?.nom || `Prestataire #${service?.user_id}`;
    const titreService = getServiceFieldValue(service?.data?.titre_service);
    const categorieService = getServiceFieldValue(service?.data?.category);

    // ✅ DEBUG: Log when modal opens
    useEffect(() => {
        if (visible) {
            console.log('[ChatModalMobile] Modal opened', {
                visible,
                hasService: !!service,
                serviceId: service?.id,
                hasPrestataire: !!prestataireInfo,
                prestataireName: nomPrestataire,
                hasInitialMessages: !!initialMessages,
                initialMessagesCount: initialMessages?.length || 0
            });

            // ✅ NOUVEAU: Utiliser les messages initiaux si fournis
            if (initialMessages && initialMessages.length > 0 && setInitialMessages) {
                console.log('[ChatModalMobile] Utilisation des messages initiaux:', initialMessages.length);
                // Convertir les messages initiaux au format attendu par useWebSocketChat
                const formattedMessages = initialMessages.map((msg: any) => ({
                    id: msg.id || String(Date.now() + Math.random()),
                    from: msg.isFromClient ? 'client' as const : 'prestataire' as const,
                    content: msg.message || msg.content || '',
                    timestamp: new Date(msg.timestamp || msg.created_at || Date.now()),
                    status: 'read' as const,
                    type: (msg.messageType || msg.type || 'text') as 'text' | 'audio' | 'image' | 'file',
                    editable: msg.isFromClient  // Seuls les messages du client sont éditables
                }));
                setInitialMessages(formattedMessages);
            }
        }
    }, [visible, service, prestataireInfo, nomPrestataire, initialMessages, setInitialMessages]);

    // Auto-scroll vers le bas
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

    // Marquer comme lu quand le modal s'ouvre
    useEffect(() => {
        if (visible) {
            markAsRead();
            loadParticipants();
        }
    }, [visible, markAsRead]);

    // ✅ NOUVEAU: Charger les participants de la conversation
    const loadParticipants = async () => {
        const convId = effectiveServiceId;
        if (!convId) return;

        try {
            const response = await apiGet<Participant[]>(`/api/conversations/${convId}/participants`);
            if (response.success && response.data) {
                setParticipants(response.data);
                console.log('[ChatModalMobile] Participants chargés:', response.data);
            }
        } catch (error) {
            console.error('[ChatModalMobile] Erreur chargement participants:', error);
        }
    };

    // ✅ NOUVEAU: Inviter un utilisateur dans la conversation
    const inviteUser = async (userId: number, context?: string) => {
        if (!service?.id) return;

        try {
            const response = await apiPost(`/api/conversations/${service.id}/invite`, {
                user_id: userId,
                context
            });

            if (response.success) {
                Alert.alert(
                    t('chatModalMobile.utilisateurInvite'),
                    t('chatModalMobile.lutilisateurAEteAjouteALaConversationEt'),
                    [{ text: 'OK' }]
                );
                loadParticipants(); // Recharger la liste
            }
        } catch (error) {
            console.error('[ChatModalMobile] Erreur invitation:', error);
            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.inviteError') || 'Impossible d\'inviter cet utilisateur');
        }
    };

    // ✅ NOUVEAU: Retirer un participant
    const removeParticipant = async (userId: number) => {
        if (!service?.id) return;

        Alert.alert(
            t('chatModalMobile.removeParticipantTitle') || 'Retirer le participant',
            t('chatModalMobile.etesvousSurDeVouloirRetirerCette'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Retirer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiPost(`/api/conversations/${service.id}/participants/${userId}`, {});
                            loadParticipants();
                            Alert.alert(t('chatModalMobile.succes'), t('chatModalMobile.participantRetireDeLaConversation'));
                        } catch (error) {
                            console.error('[ChatModalMobile] Erreur retrait participant:', error);
                            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.removeParticipantError') || 'Impossible de retirer ce participant');
                        }
                    }
                }
            ]
        );
    };

    // Handler pour le chatbot intelligent — panneau inline
    // ✅ FIX BUG 1: Uses intelligentChatService (1185 lines, full contextual awareness)
    // as PRIMARY, with chatbotIntelligentService as FALLBACK for service-specific queries
    const handleChatbotQuery = async (query: string) => {
        if (!query.trim() || chatbotLoading) return;

        const userMsg = { id: `user_${Date.now()}`, text: query, isUser: true };
        setChatbotMessages(prev => [...prev, userMsg]);
        setChatbotInput('');
        setChatbotLoading(true);

        try {
            // Build conversation history from chatbot messages
            const chatHistory = chatbotMessages
                .filter(m => m.text)
                .slice(-6)
                .map(m => ({
                    id: m.id,
                    text: m.text,
                    isUser: m.isUser,
                    timestamp: new Date(),
                    type: 'text' as const,
                }));

            // ✅ PRIMARY: Use intelligentChatService with full screen context
            // This gives the chatbot awareness of: current screen, available actions,
            // visible elements, user role, service data, navigation map (50+ destinations),
            // and specialized context (covoiturage, taxi, emploi, hotel, pharmacie, etc.)
            const enrichedContext = {
                ...screenContext,
                serviceData: {
                    ...screenContext.serviceData,
                    ...(service?.data || {}),
                    nom: service?.data?.titre_service?.valeur || service?.data?.titre_service || service?.nom || service?.name,
                    prix: service?.data?.prix?.valeur || service?.data?.prix || service?.prix,
                    description: service?.data?.description?.valeur || service?.data?.description,
                    products: service?.products || service?.produits || [],
                },
            };

            const intelligentResponse = await intelligentChatService.generateContextualResponse(
                query,
                enrichedContext,
                chatHistory,
                language,
            );

            // ✅ Streaming word-by-word effect (ChatGPT style)
            const fullText = intelligentResponse.message;
            const responseData = {
                message: fullText,
                icons: [] as IconReference[],
                quickReplies: intelligentResponse.nextSteps?.slice(0, 4) || [],
                suggestedActions: intelligentResponse.suggestedActions || [],
                nextSteps: intelligentResponse.nextSteps || [],
            } as ChatbotResponse & { suggestedActions?: any[]; nextSteps?: string[] };

            // Start streaming phase
            setChatbotLoading(false);
            setIsStreaming(true);
            setStreamingText('');

            const words = fullText.split(/(\s+)/); // preserve whitespace
            let accumulated = '';
            for (let i = 0; i < words.length; i++) {
                accumulated += words[i];
                setStreamingText(accumulated);
                chatbotScrollRef.current?.scrollToEnd({ animated: false });
                // Variable speed: faster for whitespace, slower for words
                const delay = words[i].trim() === '' ? 5 : (15 + Math.random() * 20);
                await new Promise(r => setTimeout(r, delay));
            }

            // Streaming complete — commit final message
            setIsStreaming(false);
            setStreamingText('');

            const botMsg = {
                id: `bot_${Date.now()}`,
                text: fullText,
                isUser: false,
                response: responseData,
            };
            setChatbotMessages(prev => [...prev, botMsg]);
            setTimeout(() => chatbotScrollRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (error) {
            console.error('[ChatModalMobile] intelligentChatService failed, trying fallback:', error);

            // ✅ FALLBACK: Use chatbotIntelligentService with chatbot history (not P2P messages)
            try {
                const recentMsgs = [...chatbotMessages, userMsg].slice(-8).map((m: any) => ({
                    isUser: m.isUser ?? (m.from === 'client'),
                    text: m.text || m.content || '',
                }));
                const fallbackResponse = await chatbotIntelligentService.generateChatbotResponse(
                    query, service, recentMsgs, language,
                );
                const botMsg = {
                    id: `bot_${Date.now()}`,
                    text: fallbackResponse.message,
                    isUser: false,
                    response: fallbackResponse,
                };
                setChatbotMessages(prev => [...prev, botMsg]);
                setTimeout(() => chatbotScrollRef.current?.scrollToEnd({ animated: true }), 100);
            } catch (fallbackError) {
                console.error('[ChatModalMobile] Both chatbot services failed:', fallbackError);
                setChatbotMessages(prev => [...prev, {
                    id: `err_${Date.now()}`,
                    text: t('intelligentChat.error') || 'Une erreur est survenue. Réessayez.',
                    isUser: false,
                }]);
            }
        } finally {
            setChatbotLoading(false);
        }
    };

    const openChatbotPanel = () => {
        if (!showChatbotPanel) {
            setShowChatbotPanel(true);
            if (chatbotMessages.length === 0) {
                const serviceName = service?.nom || service?.name || 'Yukpo';
                const welcomeText = t('intelligentChat.welcomeChat', { name: serviceName })
                    || `Je suis votre assistant IA pour "${serviceName}". Comment puis-je vous aider ?`;
                const defaultQuickReplies = [
                    t('chatbot.describeService') || 'Présenter ce service',
                    t('chatbot.seeProducts') || 'Voir les produits',
                    t('chatbot.negotiatePrice') || 'Négocier le prix',
                    t('chatbot.chatFeatures') || 'Fonctionnalités du chat',
                ];
                setChatbotMessages([{
                    id: `welcome_${Date.now()}`,
                    text: welcomeText,
                    isUser: false,
                    response: {
                        message: welcomeText,
                        icons: [
                            { icon: 'info', label: t('chatbot.details') || 'Détails', color: '#6366f1' },
                            { icon: 'message-circle', label: t('chatbot.contact') || 'Contact', color: '#10b981' },
                        ],
                        quickReplies: defaultQuickReplies,
                    },
                }]);
            }
        } else {
            setShowChatbotPanel(false);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        // ✅ NOUVEAU: Envoyer avec les IDs des utilisateurs mentionnés et le message cité
        await sendMessage(newMessage.trim(), 'text', {
            mentioned_users: mentionedUsers.length > 0 ? mentionedUsers : undefined,
            reply_to_id: replyingTo?.id || undefined,
            reply_to: replyingTo ? {
                id: replyingTo.id,
                sender_name: replyingTo.sender_name,
                content: replyingTo.content,
                content_type: replyingTo.content_type,
                imageUrl: replyingTo.imageUrl,
                audioUrl: replyingTo.audioUrl,
                fileUrl: replyingTo.fileUrl
            } : undefined
        });

        setNewMessage('');
        setShowEmojiPicker(false);
        setMentionedUsers([]); // Réinitialiser les mentions
        setReplyingTo(null); // ✅ Réinitialiser la réponse APRÈS l'envoi
    };

    const handleEditMessage = async () => {
        if (!editingContent.trim() || !editingMessageId) return;

        await editMessage(editingMessageId, editingContent.trim());
        setEditingMessageId(null);
        setEditingContent('');
    };

    // ✅ NOUVEAU: Handler pour envoyer des médias sélectionnés de la galerie
    const handleSelectGalleryMedia = (selectedUrls: string[]) => {
        if (selectedUrls.length === 0) return;

        // Ajouter les URLs sélectionnées aux images
        setSelectedImages([...selectedImages, ...selectedUrls]);
        console.log('[ChatModal] Médias de la galerie ajoutés:', selectedUrls.length);
    };

    const handleDeleteMessage = async (messageId: string) => {
        Alert.alert(
            t('chatModalMobile.deleteMessage') || 'Supprimer le message',
            t('chatModalMobile.etesvousSurDeVouloirSupprimerCe'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => deleteMessage(messageId)
                }
            ]
        );
    };

    const startEditing = (message: any) => {
        setEditingMessageId(message.id);
        setEditingContent(message.content);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditingContent('');
    };

    const handleCall = () => {
        const phoneNumber = getServiceFieldValue(service?.data?.telephone) ||
            getServiceFieldValue(service?.data?.whatsapp);

        if (phoneNumber && phoneNumber !== t('chatModalMobile.nonSpecifie')) {
            const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
            Alert.alert(
                t('chatModalMobile.callProvider') || 'Appeler le prestataire',
                t('chatModalMobile.callConfirm', { name: nomPrestataire, phone: phoneNumber }) || `Voulez-vous appeler ${nomPrestataire} au ${phoneNumber} ?`,
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('common.call'),
                        onPress: () => {
                            // Ici vous pouvez implémenter l'appel téléphonique
                            Linking.openURL(`tel:${cleanPhone}`);
                        }
                    }
                ]
            );
        } else {
            Alert.alert(t('chatModalMobile.contactTitle') || 'Contact', t('chatModalMobile.aucunNumeroDeTelephoneDisponiblePour'));
        }
    };

    const handleTyping = (text: string) => {
        console.log('[DEBUG MENTION] handleTyping appelé avec:', text);
        setNewMessage(text);

        const activeQuery = extractActiveMentionQuery(text);
        console.log('[DEBUG MENTION] activeQuery extrait:', activeQuery);
        if (activeQuery) {
            setMentionQuery(activeQuery);
            setShowMentionPicker(true);
            console.log('[DEBUG MENTION] @ détecté, query:', activeQuery, 'showMentionPicker:', true);
        } else {
            setShowMentionPicker(false);
            console.log('[DEBUG MENTION] Pas de @ détecté, showMentionPicker:', false);
        }

        // Simuler l'indication de frappe
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (text.trim()) {
            setIsTyping(true);
            typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
            }, 1000);
        } else {
            setIsTyping(false);
        }
    };

    // ✅ FIX: Insérer une mention dans le message
    const insertMention = (user: any) => {
        const lastAtIndex = newMessage.lastIndexOf('@');
        if (lastAtIndex === -1) return;

        const before = newMessage.substring(0, lastAtIndex);
        const newText = `${before}@${user.nom_complet} `;
        setNewMessage(newText);

        // Ajouter l'ID à la liste des mentions
        if (!mentionedUsers.includes(user.id)) {
            setMentionedUsers([...mentionedUsers, user.id]);
        }

        // Inviter l'utilisateur dans la conversation
        inviteUser(user.id, 'mention');

        setShowMentionPicker(false);
        setMentionQuery('');
    };

    const handleEmojiClick = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const formatMessageTime = (date: Date | string) => {
        try {
            const dateObj = typeof date === 'string' ? new Date(date) : date;
            if (isNaN(dateObj.getTime())) {
                return '--:--';
            }
            const locale = language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : language || 'fr-FR';
            return dateObj.toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '--:--';
        }
    };

    const popularEmojis = ['😊', '😂', '❤️', '👍', '👎', '😍', '🤔', '😢', '😮', '🔥', '💯', '🎉', '👏', '🙏', '💪'];

    // Fonction pour convertir fichier en base64 (React Native compatible)
    const convertFileToBase64 = async (uri: string): Promise<string> => {
        try {
            // Utiliser FileSystem d'Expo pour React Native
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // Déterminer le type MIME basé sur l'extension
            const extension = uri.split('.').pop()?.toLowerCase();
            let mimeType = 'application/octet-stream';

            switch (extension) {
                case 'pdf':
                    mimeType = 'application/pdf';
                    break;
                case 'doc':
                case 'docx':
                    mimeType = 'application/msword';
                    break;
                case 'xls':
                case 'xlsx':
                    mimeType = 'application/vnd.ms-excel';
                    break;
                case 'txt':
                    mimeType = 'text/plain';
                    break;
                case 'jpg':
                case 'jpeg':
                    mimeType = 'image/jpeg';
                    break;
                case 'png':
                    mimeType = 'image/png';
                    break;
                case 'mp3':
                    mimeType = 'audio/mpeg';
                    break;
                case 'mp4':
                    mimeType = 'video/mp4';
                    break;
            }

            return `data:${mimeType};base64,${base64}`;
        } catch (error) {
            console.error('Erreur conversion base64:', error);
            throw error;
        }
    };

    // Picker d'images
    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                const images64 = result.assets.map(asset =>
                    asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : ''
                ).filter(img => img);

                setSelectedImages([...selectedImages, ...images64]);
            }
        } catch (error) {
            console.error('Erreur sélection images:', error);
            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.loadImagesError') || 'Impossible de charger les images');
        }
    };

    // Picker de fichiers (UNIQUEMENT doc, pdf, excel - PAS d'images)
    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/plain'
                ],
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];

                // Vérifier la taille du fichier (max 10MB)
                if (file.size && file.size > 10 * 1024 * 1024) {
                    Alert.alert(t('chatModalMobile.fileTooLarge') || 'Fichier trop volumineux', t('chatModalMobile.maxFileSize') || 'La taille maximale est de 10MB');
                    return;
                }

                const base64 = await convertFileToBase64(file.uri);
                setSelectedDocuments([...selectedDocuments, { base64, name: file.name || 'document', size: file.size }]);
                console.log('[ChatModal] Fichier sélectionné:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);
            }
        } catch (error) {
            console.error('Erreur sélection fichier:', error);
            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.loadFileError') || 'Impossible de charger le fichier');
        }
    };

    // Enregistrer audio - VERSION ROBUSTE
    const startAudioRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert(t('chatModalMobile.permissionRequired') || 'Permission requise', t('chatModalMobile.permissionMicrophoneNecessaire'));
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync({
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                }
            });

            setRecording(newRecording);
            setIsRecording(true);
            setRecordingDuration(0);
        } catch (error) {
            console.error('Erreur enregistrement audio:', error);
            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.impossibleDeDemarrerL'));
            setIsRecording(false);
        }
    };

    const stopAudioRecording = async () => {
        if (!recording) return;

        try {
            setIsRecording(false);
            await recording.stopAndUnloadAsync();

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recording.getURI();
            if (uri) {
                const audioBase64 = await convertFileToBase64(uri);
                setSelectedAudio(audioBase64);
                setSelectedAudioUri(uri); // Sauvegarder l'URI pour la lecture
            }
            setRecording(null);
        } catch (error) {
            console.error('Erreur arrêt audio:', error);
            setRecording(null);
        }
    };

    // Fonction pour jouer/arrêter l'audio enregistré
    const togglePlayAudio = async () => {
        try {
            if (isPlayingAudio && audioSound) {
                // Arrêter la lecture
                await audioSound.stopAsync();
                await audioSound.unloadAsync();
                setAudioSound(null);
                setIsPlayingAudio(false);
            } else if (selectedAudioUri) {
                // Démarrer la lecture
                const { sound } = await Audio.Sound.createAsync(
                    { uri: selectedAudioUri },
                    { shouldPlay: true }
                );
                setAudioSound(sound);
                setIsPlayingAudio(true);

                // Arrêter automatiquement quand la lecture est terminée
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setIsPlayingAudio(false);
                        sound.unloadAsync();
                        setAudioSound(null);
                    }
                });
            }
        } catch (error) {
            console.error('Erreur lecture audio:', error);
            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.playAudioError') || 'Impossible de lire l\'audio');
            setIsPlayingAudio(false);
        }
    };

    // Fonction pour supprimer l'audio
    const deleteAudio = async () => {
        if (audioSound) {
            await audioSound.unloadAsync();
            setAudioSound(null);
        }
        setSelectedAudio(null);
        setSelectedAudioUri(null);
        setIsPlayingAudio(false);
    };

    // Envoyer message avec médias
    const handleSendWithMedia = async () => {
        if (!newMessage.trim() && selectedImages.length === 0 && !selectedAudio && selectedDocuments.length === 0) {
            Alert.alert(t('chatModalMobile.emptyMessage') || 'Message vide', t('chatModalMobile.ecrivezUnMessageOuAjoutezUn'));
            return;
        }

        const messageData = {
            content: newMessage.trim(),
            images: selectedImages.length > 0 ? selectedImages : undefined,
            audio: selectedAudio || undefined,
            documents: selectedDocuments.length > 0 ? selectedDocuments.map(doc => doc.base64) : undefined,
            mentioned_users: mentionedUsers.length > 0 ? mentionedUsers : undefined,
            reply_to_id: replyingTo?.id || undefined,
            reply_to: replyingTo ? {
                id: replyingTo.id,
                sender_name: replyingTo.sender_name,
                content: replyingTo.content,
                content_type: replyingTo.content_type,
                imageUrl: replyingTo.imageUrl,
                audioUrl: replyingTo.audioUrl,
                fileUrl: replyingTo.fileUrl
            } : undefined
        };

        // ✅ CORRIGÉ: Détecter automatiquement le type de message
        const messageType = selectedImages.length > 0 ? 'image' :
            selectedAudio ? 'audio' :
                selectedDocuments.length > 0 ? 'file' : 'text';

        await sendMessage(newMessage.trim() || '', messageType, messageData);

        // Nettoyer l'audio si présent
        if (audioSound) {
            await audioSound.unloadAsync();
            setAudioSound(null);
        }

        // Réinitialiser
        setNewMessage('');
        setSelectedImages([]);
        setSelectedAudio(null);
        setSelectedAudioUri(null);
        setSelectedDocuments([]);
        setIsPlayingAudio(false);
        setMentionedUsers([]); // ✅ Réinitialiser les mentions
        setReplyingTo(null); // ✅ Réinitialiser la réponse
    };

    // Nettoyer l'audio quand le modal se ferme
    useEffect(() => {
        return () => {
            if (audioSound) {
                audioSound.unloadAsync();
            }
        };
    }, [audioSound]);

    // ✅ NOUVEAU 2026-01-23: Vérifier si le service a une configuration de livraison (comme ProductCard)
    useEffect(() => {
        const checkDeliveryConfig = async () => {
            if (!service?.id) {
                setHasDeliveryConfig(false);
                setDeliveryEnabled(false);
                return;
            }

            try {
                // Vérifier si au moins un produit a une configuration de livraison
                const response = await apiGet(`/api/services/${service.id}/products`);
                if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                    // Vérifier la configuration pour le premier produit (ou tous les produits)
                    const productIndex = response.data[0]?.product_index ?? 0;
                    const configResponse = await apiGet(
                        `/api/delivery/product-config/${service.id}/${productIndex}`
                    );

                    if (configResponse.success && (configResponse.data as any)?.is_configured === true) {
                        setHasDeliveryConfig(true);
                        setDeliveryEnabled(true);
                    } else {
                        setHasDeliveryConfig(false);
                        setDeliveryEnabled(false);
                    }
                } else {
                    setHasDeliveryConfig(false);
                    setDeliveryEnabled(false);
                }
            } catch (error: any) {
                // Ne pas logger les erreurs 404 comme des erreurs critiques
                if (error?.message?.includes('404') || error?.response?.status === 404) {
                    console.log('[ChatModalMobile] ℹ️ Config livraison non trouvée (404)');
                    setHasDeliveryConfig(false);
                    setDeliveryEnabled(false);
                } else {
                    console.error('[ChatModalMobile] ❌ Erreur vérification config livraison:', error);
                    setHasDeliveryConfig(false);
                    setDeliveryEnabled(false);
                }
            }
        };

        checkDeliveryConfig();
    }, [service?.id]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View
                style={[styles.container, { paddingBottom: keyboardBottomInset }]}
            >
                {/* Header */}
                <View style={styles.header}>
                    {/* Première ligne : Bouton retour + Nom + Actions */}
                    <View style={styles.headerTop}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity style={styles.backButton} onPress={onClose}>
                                <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                            <View style={styles.headerInfo}>
                                <Text style={styles.prestataireName} numberOfLines={1}>{titreService || nomPrestataire}</Text>
                                <View style={styles.statusIndicator}>
                                    <View style={[
                                        styles.statusDot,
                                        { backgroundColor: isConnected ? modernColors.success : modernColors.textSecondary }
                                    ]} />
                                    <Text style={[
                                        styles.statusText,
                                        { color: isConnected ? modernColors.success : modernColors.textSecondary }
                                    ]}>
                                        {isConnected ? t('chatModalMobile.online') || 'En ligne' : t('chatModalMobile.offline') || 'Hors ligne'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.headerActions}>
                            {/* ✅ NOUVEAU: Bouton WhatsApp (prioritaire si disponible) */}
                            {(prestataireInfo?.whatsapp || service?.data?.whatsapp?.valeur || service?.data?.whatsapp || prestataireInfo?.telephone) && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.whatsappButton]}
                                    onPress={async () => {
                                        const whatsappNumber = prestataireInfo?.whatsapp ||
                                            service?.data?.whatsapp?.valeur ||
                                            service?.data?.whatsapp ||
                                            prestataireInfo?.telephone;

                                        if (!whatsappNumber) {
                                            Alert.alert('WhatsApp', t('chatModalMobile.numeroWhatsappNonDisponible'));
                                            // title 'WhatsApp' is a brand name, no translation needed
                                            return;
                                        }

                                        try {
                                            const phoneNumber = whatsappNumber.replace(/\s+/g, '').replace(/\+/g, '');
                                            // ✅ CORRIGÉ : Éviter le doublon du nom du prestataire dans le message
                                            // Si le titre du service contient déjà le nom du prestataire, on ne le répète pas
                                            const serviceName = titreService || 'votre service';

                                            // ✅ AMÉLIORÉ: Vérifier si le nom du prestataire est déjà dans le titre du service
                                            // Normaliser les noms pour la comparaison (enlever les accents, mettre en minuscule)
                                            const normalizeName = (name: string) => name.toLowerCase()
                                                .normalize('NFD')
                                                .replace(/[̀-ͯ]/g, '')
                                                .trim();

                                            const normalizedPrestataireName = normalizeName(nomPrestataire);
                                            const normalizedServiceName = normalizeName(serviceName);

                                            // Vérifier si le nom du prestataire est déjà dans le titre du service
                                            const nameInService = normalizedServiceName.includes(normalizedPrestataireName);

                                            // ✅ CORRIGÉ: Construire le message sans doublon
                                            let messageText: string;
                                            if (nameInService) {
                                                // Le nom est déjà dans le service, ne pas le répéter
                                                messageText = t('chatModalMobile.whatsappMsgNoName', { service: serviceName }) || `Bonjour, je souhaite discuter de ${serviceName}.`;
                                            } else {
                                                // Le nom n'est pas dans le service, l'inclure
                                                messageText = t('chatModalMobile.whatsappMsgWithName', { name: nomPrestataire, service: serviceName }) || `Bonjour ${nomPrestataire}, je souhaite discuter de ${serviceName}.`;
                                            }

                                            // ✅ DEBUG: Logger pour diagnostiquer
                                            if (__DEV__) {
                                                console.log('[ChatModalMobile] 📱 WhatsApp message debug:', {
                                                    nomPrestataire,
                                                    serviceName,
                                                    nameInService,
                                                    messageText,
                                                });
                                            }

                                            const message = encodeURIComponent(messageText);
                                            const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${message}`;

                                            const canOpen = await Linking.canOpenURL(whatsappUrl);
                                            if (canOpen) {
                                                await Linking.openURL(whatsappUrl);
                                            } else {
                                                Alert.alert('WhatsApp', t('chatModalMobile.estPasInstalleSurCetAppareil'));
                                            }
                                        } catch (error) {
                                            console.error('Erreur ouverture WhatsApp:', error);
                                            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.whatsappOpenError') || 'Impossible d\'ouvrir WhatsApp');
                                        }
                                    }}
                                >
                                    {/* ✅ CORRIGÉ : Logo WhatsApp officiel avec FontAwesome */}
                                    <View style={styles.whatsappIconContainer}>
                                        <FontAwesome name="whatsapp" size={16} color="#FFFFFF" />
                                    </View>
                                    <View style={styles.whatsappBadge}>
                                        <Text style={styles.whatsappBadgeText}>WA</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* ✅ Bouton liste des participants */}
                            <TouchableOpacity
                                style={[styles.actionButton, participants.length > 2 && styles.actionButtonHighlight]}
                                onPress={() => setShowParticipantsList(true)}
                            >
                                <SafeIcon name="users" size={20} color={participants.length > 2 ? modernColors.primary : modernColors.text} />
                                {participants.length > 2 && (
                                    <View style={styles.participantsBadge}>
                                        <Text style={styles.participantsBadgeText}>{participants.length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => {
                                    setCallType('audio');
                                    setShowCallModal(true);
                                }}
                            >
                                <SafeIcon name="phone" size={20} color={modernColors.success} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => {
                                    setCallType('video');
                                    setShowCallModal(true);
                                }}
                            >
                                <SafeIcon name="video" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Deuxième ligne : Nom du prestataire (uniquement si différent du titre service) */}
                    {titreService && nomPrestataire && titreService !== nomPrestataire && (
                        <View style={styles.headerBottom}>
                            <Text style={styles.serviceInfo} numberOfLines={1}>{nomPrestataire}</Text>
                        </View>
                    )}
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                >
                    {messages.map((message) => (
                        <View
                            key={message.id}
                            style={[
                                styles.messageContainer,
                                message.from === 'client' ? styles.messageContainerRight : styles.messageContainerLeft
                            ]}
                        >
                            <View style={[
                                styles.messageBubble,
                                message.from === 'client' ? styles.messageBubbleRight : styles.messageBubbleLeft
                            ]}>
                                {editingMessageId === message.id ? (
                                    <View style={styles.editContainer}>
                                        <TextInput
                                            style={styles.editInput}
                                            value={editingContent}
                                            onChangeText={setEditingContent}
                                            multiline
                                            autoFocus
                                        />
                                        <View style={styles.editActions}>
                                            <TouchableOpacity
                                                style={[styles.editButton, styles.saveButton]}
                                                onPress={handleEditMessage}
                                            >
                                                <SafeIcon name="check" size={16} color="#FFFFFF" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.editButton, styles.cancelEditButton]}
                                                onPress={cancelEditing}
                                            >
                                                <SafeIcon name="x" size={16} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        {/* ✅ NOUVEAU: Afficher lt('chatModalMobile.imageSiPresenteMessagetype')image' && message.imageUrl && (
                                            <Image
                                                source={{ uri: message.imageUrl }}
                                                style={styles.messageImage}
                                                resizeMode="cover"
                                            />
                                        )}

                                        {/* ✅ NOUVEAU: Afficher lt('chatModalMobile.audioSiPresentMessagetype')audio' && message.audioUrl && (
                                            <View style={styles.audioContainer}>
                                                <SafeIcon name="mic" size={20} color={message.from === 'client' ? '#FFFFFF' : modernColors.primary} />
                                                <Text style={[
                                                    styles.audioText,
                                                    message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                                ]}>
                                                    {t('chatModalMobile.voiceMessage') || 'Message vocal'}
                                                </Text>
                                            </View>
                                        )}

                                        {/* ✅ NOUVEAU: Afficher le fichier si présent */}
                                        {message.type === 'file' && message.fileUrl && (
                                            <View style={styles.fileContainer}>
                                                <SafeIcon name="file" size={20} color={message.from === 'client' ? '#FFFFFF' : modernColors.primary} />
                                                <Text style={[
                                                    styles.fileText,
                                                    message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                                ]}>
                                                    {t('chatModalMobile.document') || 'Document'}
                                                </Text>
                                            </View>
                                        )}

                                        {/* ✅ NOUVEAU: Afficher le message cité si présent */}
                                        {message.reply_to && (
                                            <View style={styles.quotedMessage}>
                                                <View style={styles.quotedMessageBar} />
                                                <View style={styles.quotedMessageContent}>
                                                    <Text style={styles.quotedMessageAuthor}>
                                                        {message.reply_to.sender_name || 'Message'}
                                                    </Text>
                                                    <Text style={styles.quotedMessageText} numberOfLines={2}>
                                                        {message.reply_to.content_type === 'text' ? message.reply_to.content : null}
                                                        {message.reply_to.content_type === 'audio' ? '🎤 Message audio' : null}
                                                        {message.reply_to.content_type === 'image' ? '🖼️ Image' : null}
                                                        {message.reply_to.content_type === 'file' ? '📄 Fichier' : null}
                                                        {message.reply_to.content_type === 'video' ? t('chatModalMobile.video') : null}
                                                    </Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* Afficher le texte pour les messages texte ou avec le texte */}
                                        {(message.type === 'text' || (message.content && !message.content.match(/^[📷🎤📎]/))) && (
                                            <LinkableText
                                                text={message.content}
                                                style={[
                                                    styles.messageText,
                                                    message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                                ]}
                                                onProductLinkPress={(serviceId, productIndex) => {
                                                    // Navigation vers le produit
                                                    (navigation as any).navigate('ServiceDetail', {
                                                        serviceId,
                                                        productIndex
                                                    });
                                                }}
                                                onReviewLinkPress={(serviceId) => {
                                                    // ✅ FIX 2026-03-03: Ouvrir les commentaires en modal inline au lieu de naviguer vers ServiceDetail
                                                    // ServiceDetail utilise /api/specialized-services/user qui ne retourne que les services de l'utilisateur connecté
                                                    setCommentsServiceId(serviceId);
                                                    setShowCommentsModal(true);
                                                }}
                                            />
                                        )}

                                        <View style={styles.messageFooter}>
                                            <View style={styles.messageFooterLeft}>
                                                <Text style={[
                                                    styles.messageTime,
                                                    message.from === 'client' ? styles.messageTimeRight : styles.messageTimeLeft
                                                ]}>
                                                    {formatMessageTime(message.timestamp)}
                                                    {message.edited && (
                                                        <Text style={styles.editedIndicator}>{t('chatModalMobile.modifie')}</Text>
                                                    )}
                                                </Text>

                                                {/* ✅ NOUVEAU: Bouton Répondre (toujours visible) */}
                                                <TouchableOpacity
                                                    style={styles.replyButton}
                                                    onPress={() => setReplyingTo({
                                                        id: message.id,
                                                        sender_name: message.from === 'client' ? user?.name : nomPrestataire,
                                                        content: message.content,
                                                        content_type: message.type || 'text',
                                                        imageUrl: message.imageUrl,
                                                        audioUrl: message.audioUrl,
                                                        fileUrl: message.fileUrl
                                                    })}
                                                >
                                                    <SafeIcon name="corner-down-left" size={14} color={modernColors.textSecondary} />
                                                    <Text style={styles.replyButtonText}>{t('chatModalMobile.repondre')}</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {message.from === 'client' && message.editable && (
                                                <View style={styles.messageActions}>
                                                    <TouchableOpacity
                                                        style={styles.messageActionButton}
                                                        onPress={() => startEditing(message)}
                                                    >
                                                        <SafeIcon name="edit" size={14} color={modernColors.primary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.messageActionButton}
                                                        onPress={() => handleDeleteMessage(message.id)}
                                                    >
                                                        <SafeIcon name="trash" size={14} color={modernColors.error} />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    ))}

                    {prestataireTyping && (
                        <View style={styles.typingContainer}>
                            <View style={styles.typingBubble}>
                                <View style={styles.typingDots}>
                                    <Animated.View style={[styles.typingDot, { opacity: typingDot1, transform: [{ scale: typingDot1 }] }]} />
                                    <Animated.View style={[styles.typingDot, { opacity: typingDot2, transform: [{ scale: typingDot2 }] }]} />
                                    <Animated.View style={[styles.typingDot, { opacity: typingDot3, transform: [{ scale: typingDot3 }] }]} />
                                </View>
                                <Text style={styles.typingText}>{t('chatModalMobile.enTrainDecrire')}</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Emoji picker */}
                {showEmojiPicker && (
                    <View style={styles.emojiPicker}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.emojiContainer}>
                                {popularEmojis.map((emoji) => (
                                    <TouchableOpacity
                                        key={emoji}
                                        style={styles.emojiButton}
                                        onPress={() => handleEmojiClick(emoji)}
                                    >
                                        <Text style={styles.emojiText}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* Input */}
                <View style={styles.inputContainer}>
                    {/* Preview des médias sélectionnés */}
                    {(selectedImages.length > 0 || selectedAudio || selectedDocuments.length > 0) && (
                        <ScrollView horizontal style={styles.mediaPreviewContainer} showsHorizontalScrollIndicator={false}>
                            {/* Images */}
                            {selectedImages.map((img, idx) => (
                                <View key={idx} style={styles.mediaPreviewItem}>
                                    <Image source={{ uri: img }} style={styles.previewImage} />
                                    <TouchableOpacity
                                        style={styles.removeMediaButton}
                                        onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}
                                    >
                                        <Text style={styles.removeMediaText}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {/* Audio */}
                            {selectedAudio && (
                                <View style={styles.mediaPreviewItem}>
                                    <View style={styles.audioPreview}>
                                        <TouchableOpacity
                                            style={styles.playAudioButton}
                                            onPress={togglePlayAudio}
                                        >
                                            <SafeIcon
                                                name={isPlayingAudio ? "pause" : "play"}
                                                size={24}
                                                color="#FFFFFF"
                                            />
                                        </TouchableOpacity>
                                        <View style={styles.audioInfo}>
                                            <SafeIcon name="mic" size={16} color="#FFFFFF" />
                                            <Text style={styles.audioPreviewText}>
                                                {isPlayingAudio ? (t('chatModalMobile.playing') || 'En lecture...') : t('chatModalMobile.audioEnregistre')}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeMediaButton}
                                        onPress={deleteAudio}
                                    >
                                        <SafeIcon name="trash-2" size={12} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Documents */}
                            {selectedDocuments.map((doc, idx) => (
                                <View key={idx} style={styles.mediaPreviewItem}>
                                    <View style={styles.documentPreview}>
                                        <SafeIcon name="file-text" size={20} color="#FFFFFF" />
                                        <Text style={styles.audioPreviewText} numberOfLines={1}>{doc.name}</Text>
                                        {doc.size ? (
                                            <Text style={styles.documentSize}>{(doc.size / 1024).toFixed(0)} KB</Text>
                                        ) : null}
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeMediaButton}
                                        onPress={() => setSelectedDocuments(selectedDocuments.filter((_, i) => i !== idx))}
                                    >
                                        <Text style={styles.removeMediaText}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Boutons d'actions média */}
                    <View style={styles.mediaActionsRow}>
                        <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                            <SafeIcon name="image" size={18} color={modernColors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.mediaButton, isRecording && styles.mediaButtonActive]}
                            onPress={isRecording ? stopAudioRecording : startAudioRecording}
                        >
                            <SafeIcon name={isRecording ? "stop-circle" : "mic"} size={18} color={isRecording ? "#EF4444" : modernColors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.mediaButton} onPress={pickDocument}>
                            <SafeIcon name="file-text" size={18} color={modernColors.primary} />
                        </TouchableOpacity>

                        {/* ✅ CORRIGÉ : Bouton galerie de produits/service avec icône valide */}
                        <TouchableOpacity
                            style={styles.mediaButton}
                            onPress={() => setShowProductGalleryPicker(true)}
                        >
                            <SafeIcon name="FolderOpen" size={18} color="#8B5CF6" type="lucide" />
                        </TouchableOpacity>

                        {/* ✅ NOUVEAU 2026-01-23: Bouton "Commander" avec texte (comme ProductCard) */}
                        {/* ✅ Utilise maintenant l'API /api/services/:id/products au lieu de l'ancien format JSONB */}
                        {/* ✅ Vérifie la configuration de livraison et prend en compte le prix négocié */}
                        {service?.id ? (
                            <TouchableOpacity
                                style={[
                                    styles.deliveryButton,
                                    !deliveryEnabled ? styles.deliveryButtonDisabled : undefined
                                ]}
                                onPress={async () => {
                                    if (!service?.id) {
                                        Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.serviceUnavailable') || 'Service non disponible');
                                        return;
                                    }

                                    if (!deliveryEnabled) {
                                        Alert.alert(
                                            t('chatModalMobile.deliveryUnavailable') || 'Livraison non disponible',
                                            t('chatModalMobile.laLivraisonNestPasActiveePourCeService')
                                        );
                                        return;
                                    }

                                    // ✅ CORRIGÉ: Charger les produits depuis service_products (nouveau système)
                                    try {
                                        // ✅ CORRIGÉ: Utiliser l'API service_products au lieu de l'ancien format JSONB
                                        const response = await apiGet(`/api/services/${service.id}/products`);
                                        if (response.success && Array.isArray(response.data)) {
                                            const products = response.data;

                                            if (products.length === 0) {
                                                Alert.alert(t('chatModalMobile.noProduct') || 'Aucun produit', t('chatModalMobile.noProductForDelivery') || 'Ce service n\'a pas de produits disponibles pour la livraison');
                                                return;
                                            }

                                            // ✅ CORRIGÉ: Utiliser product_name depuis le backend
                                            // Si un seul produit, ouvrir directement le modal
                                            if (products.length === 1) {
                                                const product = products[0];
                                                setSelectedProductForDelivery({
                                                    product: product.product_data || product,
                                                    productIndex: product.product_index || 0
                                                });
                                                setShowOrderModal(true);
                                            } else {
                                                // Si plusieurs produits, afficher un sélecteur
                                                const buttons: any = products.map((product: any) => ({
                                                    text: product.product_name || product.product_data?.product_name || product.product_data?.nom || `Produit ${product.product_index + 1}`,
                                                    onPress: () => {
                                                        setSelectedProductForDelivery({
                                                            product: product.product_data || product,
                                                            productIndex: product.product_index || 0
                                                        });
                                                        setShowOrderModal(true);
                                                    }
                                                }));
                                                buttons.push({ text: t('common.cancel'), style: 'cancel' });
                                                Alert.alert(t('chatModalMobile.selectionnerUnProduit'), t('chatModalMobile.choisissezLeProduitALivrer'), buttons);
                                            }
                                        } else {
                                            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.loadProductsError') || 'Impossible de charger les produits');
                                        }
                                    } catch (error) {
                                        console.error('[ChatModalMobile] Erreur chargement produits:', error);
                                        Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.loadProductsError') || 'Impossible de charger les produits');
                                    }
                                }}
                                disabled={!deliveryEnabled}
                                activeOpacity={0.7}
                            >
                                <SafeIcon
                                    name="truck"
                                    size={12}
                                    color={deliveryEnabled ? "#10B981" : "#9CA3AF"}
                                />
                                <Text style={[
                                    styles.deliveryButtonText,
                                    !deliveryEnabled ? styles.deliveryButtonTextDisabled : undefined
                                ]}>
                                    {t('chatModalMobile.orderDelivery') || 'Commander'}
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        {/* ✅ NOUVEAU 2026-01-23: Bouton "Envoyer lien avis" - Visible uniquement pour le propriétaire */}
                        {(() => {
                            // ✅ CORRECTION: Vérifier si l'utilisateur est propriétaire du service
                            const isOwner = user?.id && service?.user_id && Number(user.id) === Number(service.user_id);

                            if (!isOwner) {
                                return null; // Ne pas afficher le bouton si l'utilisateur n'est pas propriétaire
                            }

                            return (
                                <TouchableOpacity
                                    style={styles.mediaButton}
                                    onPress={async () => {
                                        if (!service?.id) {
                                            Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.serviceUnavailable') || 'Service non disponible');
                                            return;
                                        }

                                        // ✅ CORRIGÉ 2026-03-03: Utiliser deep link yukpo://reviews/ au lieu de https://yukpomnang.com/reviews/
                                        // yukpomnang.com est down (Cloudflare 522) et LinkableText détecte yukpo://reviews/ comme lien d'avis
                                        const reviewLink = `yukpo://reviews/${service.id}`;
                                        const productName = getServiceFieldValue(service?.data?.titre_service) ||
                                            getServiceFieldValue(service?.data?.nom_produit) ||
                                            'ce produit';

                                        // ✅ CORRIGÉ: Message plus clair avec le lien sur sa propre ligne
                                        const messageWithLink = t('chatModalMobile.reviewRequestMsg', { product: productName, link: reviewLink }) || `Bonjour, j'aimerais avoir votre avis sur ${productName}.\n\n${reviewLink}`;

                                        setNewMessage(messageWithLink);

                                        // Scroll vers le bas pour montrer le message
                                        setTimeout(() => {
                                            scrollViewRef.current?.scrollToEnd({ animated: true });
                                        }, 100);
                                    }}
                                >
                                    <SafeIcon name="star" size={18} color="#F59E0B" />
                                </TouchableOpacity>
                            );
                        })()}

                        {/* ✅ NOUVEAU: Bouton t('chatModalMobile.negocierLePrix') */}
                        <TouchableOpacity
                            style={styles.mediaButton}
                            onPress={async () => {
                                // Charger les produits du service pour permettre la sélection
                                try {
                                    if (!service?.id) {
                                        Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.serviceUnavailable') || 'Service non disponible');
                                        return;
                                    }

                                    const response = await apiGet(`/api/services/${service.id}`);
                                    if (response.success && response.data) {
                                        const serviceData = response.data;
                                        // ✅ FIX: Essayer plusieurs chemins pour trouver les produits
                                        const rawData = (serviceData as any)?.data || serviceData;
                                        const products = rawData?.data?.produits?.valeur ||
                                            rawData?.produits?.valeur ||
                                            rawData?.data?.produits ||
                                            rawData?.produits ||
                                            (serviceData as any)?.produits ||
                                            [];

                                        console.log('[ChatModalMobile] Produits trouvés:', products.length, 'serviceData keys:', Object.keys(serviceData || {}));

                                        if (products.length === 0) {
                                            Alert.alert(t('chatModalMobile.noProduct') || 'Aucun produit', t('chatModalMobile.noProductAvailable') || 'Ce service n\'a pas de produits disponibles');
                                            return;
                                        }

                                        // ✅ FIX: Helper pour extraire le prix numérique, y compris format {valeur: "5000"}
                                        const extractNumericPrice = (product: any): number => {
                                            const fields = [product.price, product.prix, product.prix_unitaire];
                                            for (const raw of fields) {
                                                if (raw == null) continue;
                                                // Nombre direct
                                                if (typeof raw === 'number' && raw > 0) return raw;
                                                // String directe
                                                if (typeof raw === 'string') {
                                                    const n = parseFloat(raw.replace(/[^\d.,]/g, '').replace(',', '.'));
                                                    if (!isNaN(n) && n > 0) return n;
                                                }
                                                // Format {valeur: "5000"} ou {valeur: 5000}
                                                if (typeof raw === 'object' && raw.valeur != null) {
                                                    const v = raw.valeur;
                                                    if (typeof v === 'number' && v > 0) return v;
                                                    if (typeof v === 'string') {
                                                        const n = parseFloat(v.replace(/[^\d.,]/g, '').replace(',', '.'));
                                                        if (!isNaN(n) && n > 0) return n;
                                                    }
                                                }
                                            }
                                            return 0;
                                        };

                                        // Filtrer les produits qui ont un prix valide (> 0)
                                        const productsWithPrice = products.filter((product: any) => extractNumericPrice(product) > 0);

                                        console.log('[ChatModalMobile] Produits avec prix:', productsWithPrice.length, '/', products.length);

                                        if (productsWithPrice.length === 0) {
                                            Alert.alert(t('chatModalMobile.noPrice') || 'Aucun prix', t('chatModalMobile.aDePrixDefiniPourLa'));
                                            return;
                                        }

                                        // Si un seul produit avec prix, ouvrir directement le modal
                                        if (productsWithPrice.length === 1) {
                                            const product = productsWithPrice[0];
                                            const originalPrice = extractNumericPrice(product);

                                            setSelectedProductForNegotiation({
                                                product,
                                                productIndex: products.indexOf(product),
                                                originalPrice
                                            });
                                            setShowNegotiatePriceModal(true);
                                        } else {
                                            // Si plusieurs produits, afficher un sélecteur
                                            const productName = (p: any) => p.name || p.titre || (p.titre_service?.valeur) || (typeof p.titre_service === 'string' ? p.titre_service : null) || 'Produit';
                                            Alert.alert(
                                                t('chatModalMobile.negocierLePrix'),
                                                t('chatModalMobile.choisissezLeProduitPourLequelVous'),
                                                productsWithPrice.map((product: any, index: number) => {
                                                    const originalPrice = extractNumericPrice(product);
                                                    return {
                                                        text: `${productName(product)} - ${originalPrice.toLocaleString('fr-FR')} FCFA`,
                                                        onPress: () => {
                                                            setSelectedProductForNegotiation({
                                                                product,
                                                                productIndex: products.indexOf(product),
                                                                originalPrice
                                                            });
                                                            setShowNegotiatePriceModal(true);
                                                        }
                                                    };
                                                }).concat([{ text: t('common.cancel'), style: 'cancel' } as any])
                                            );
                                        }
                                    } else {
                                        Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.loadProductsError') || 'Impossible de charger les produits');
                                    }
                                } catch (error) {
                                    console.error('[ChatModalMobile] Erreur chargement produits:', error);
                                    Alert.alert(t('common.error') || 'Erreur', t('chatModalMobile.loadProductsError') || 'Impossible de charger les produits');
                                }
                            }}
                        >
                            <SafeIcon name="dollar-sign" size={18} color={modernColors.secondary || '#8B5CF6'} />
                        </TouchableOpacity>
                    </View>

                    {/* ✅ NOUVEAU: Bandeau de citation quand on répond à un message */}
                    {replyingTo && (
                        <View style={styles.replyBanner}>
                            <View style={styles.replyContent}>
                                <View style={styles.replyHeader}>
                                    <SafeIcon name="corner-down-right" size={16} color={modernColors.primary} />
                                    <Text style={styles.replyLabel}>
                                        {t('chatModalMobile.replyTo') || 'Réponse à'} {replyingTo.sender_name || 'Message'}
                                    </Text>
                                </View>
                                <Text style={styles.replyText} numberOfLines={2}>
                                    {replyingTo.content_type === 'text' ? replyingTo.content : null}
                                    {replyingTo.content_type === 'audio' ? '🎤 Message audio' : null}
                                    {replyingTo.content_type === 'image' ? '🖼️ Image' : null}
                                    {replyingTo.content_type === 'file' ? '📄 Fichier' : null}
                                    {replyingTo.content_type === 'video' ? t('chatModalMobile.video') : null}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setReplyingTo(null)}
                                style={styles.replyCloseButton}
                            >
                                <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.inputRow}>
                        <TouchableOpacity
                            style={styles.emojiButton}
                            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <SafeIcon name="smile" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>

                        {/* Bouton d'assistance IA — ouvre le panneau chatbot inline */}
                        <TouchableOpacity
                            style={[styles.aiButton, showChatbotPanel && styles.aiButtonActive]}
                            onPress={openChatbotPanel}
                        >
                            <SafeIcon name={showChatbotPanel ? 'x' : 'bot'} size={20} color={showChatbotPanel ? modernColors.error : '#6366f1'} />
                        </TouchableOpacity>

                        <View style={{ flex: 1 }}>
                            {showMentionPicker && mentionQuery.length >= 1 && (
                                <InlineMentionSuggestions
                                    query={mentionQuery}
                                    visible={showMentionPicker}
                                    onSelect={(user) => {
                                        insertMention(user);
                                    }}
                                    maxHeight={160}
                                />
                            )}
                            <TextInput
                                style={styles.textInput}
                                value={newMessage}
                                onChangeText={(text) => handleTyping(text)}
                                onSelectionChange={(event) => {
                                    setCursorPosition(event.nativeEvent.selection.start);
                                }}
                                placeholder={replyingTo ? t('chatModalMobile.tapezVotreReponse') : (t('chatModalMobile.typePlaceholder') || "Tapez votre message... (@ pour mentionner, 🤖 pour l'aide)")}
                                placeholderTextColor={modernColors.textSecondary}
                                multiline
                                maxLength={2000}
                            />
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                (!newMessage.trim() && selectedImages.length === 0 && !selectedAudio && selectedDocuments.length === 0) && styles.sendButtonDisabled
                            ]}
                            onPress={handleSendWithMedia}
                            disabled={!newMessage.trim() && selectedImages.length === 0 && !selectedAudio && selectedDocuments.length === 0}
                        >
                            <SafeIcon name="send" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputFooter}>
                        <View style={styles.connectionStatus}>
                            <View style={[
                                styles.connectionDot,
                                { backgroundColor: isConnected ? modernColors.success : modernColors.textSecondary }
                            ]} />
                            <Text style={styles.connectionText}>
                                {isConnected ? t('chatModalMobile.connexionSecurisee') : (t('chatModalMobile.offlineMode') || 'Mode hors ligne')}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* ✅ Modal de sélection de médias de la galerie produit */}
            <ProductGalleryPickerModal
                visible={showProductGalleryPicker}
                onClose={() => setShowProductGalleryPicker(false)}
                service={service}
                onSelectMedia={handleSelectGalleryMedia}
            />

            {/* Modal d'appel interne (audio/vidéo) */}
            <InAppCallModal
                visible={showCallModal}
                onClose={() => setShowCallModal(false)}
                callType={callType}
                recipientName={nomPrestataire}
                recipientId={prestataireInfo?.userId || ''}
                currentUserId={user?.id || ''}
                serviceId={service?.id}
            />

            {/* ✅ NOUVEAU: Modal pour @mention */}
            <UserMentionPicker
                visible={showMentionPicker}
                onClose={() => setShowMentionPicker(false)}
                onSelectUser={insertMention}
                currentQuery={mentionQuery}
            />

            {/* ✅ CORRIGÉ 2026-01-23: Modal de commande de livraison */}
            <OrderDeliveryModal
                visible={showOrderModal}
                onClose={() => {
                    setShowOrderModal(false);
                    setSelectedProductForDelivery(null);
                }}
                serviceId={service?.id}
                productIndex={selectedProductForDelivery?.productIndex}
                // ✅ CORRIGÉ: Utiliser product_name depuis le backend
                productName={selectedProductForDelivery?.product?.product_name ||
                    selectedProductForDelivery?.product?.nom ||
                    selectedProductForDelivery?.product?.name ||
                    selectedProductForDelivery?.product?.titre ||
                    'Produit'}
                conversationId={effectiveServiceId}
                clientUserId={user?.id}
                onSuccess={(deliveryId) => {
                    console.log('[ChatModalMobile] Livraison créée:', deliveryId);
                    setShowOrderModal(false);
                    setSelectedProductForDelivery(null);
                }}
            />

            {/* ✅ NOUVEAU: Modal de négociation de prix */}
            {selectedProductForNegotiation && (
                <NegotiatedPriceModal
                    visible={showNegotiatePriceModal}
                    onClose={() => {
                        setShowNegotiatePriceModal(false);
                        setSelectedProductForNegotiation(null);
                    }}
                    conversationId={effectiveServiceId}
                    serviceId={service?.id || 0}
                    productIndex={selectedProductForNegotiation.productIndex}
                    originalPrice={selectedProductForNegotiation.originalPrice}
                    merchantUserId={prestataireUserId}
                    clientUserId={user?.id || 0}
                    onPriceNegotiated={() => {
                        console.log('[ChatModalMobile] Prix négocié');
                        // Optionnel: recharger les messages ou afficher une notification
                    }}
                />
            )}

            {/* ✅ FIX 2026-03-03: Modal commentaires/avis produit inline */}
            {showCommentsModal && commentsServiceId && (
                <Modal
                    visible={showCommentsModal}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={() => setShowCommentsModal(false)}
                >
                    <View style={styles.commentsModalContainer}>
                        <View style={styles.commentsModalHeader}>
                            <TouchableOpacity
                                onPress={() => setShowCommentsModal(false)}
                                style={styles.commentsModalClose}
                            >
                                <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                            <Text style={styles.commentsModalTitle}>{t('chatModalMobile.reviewsTitle') || 'Avis et commentaires'}</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <ProductCommentsSection
                            serviceId={commentsServiceId}
                            serviceTitle={
                                service?.data?.titre_service?.valeur ||
                                service?.data?.titre_service ||
                                service?.data?.nom_produit?.valeur ||
                                service?.data?.nom_produit ||
                                'Produit'
                            }
                            mode="full"
                            displayLimit={15}
                        />
                    </View>
                </Modal>
            )}

            {/* ✅ NOUVEAU: Modal liste des participants */}
            <Modal
                visible={showParticipantsList}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowParticipantsList(false)}
            >
                <View style={styles.participantsOverlay}>
                    <View style={styles.participantsContainer}>
                        <View style={styles.participantsHeader}>
                            <Text style={styles.participantsTitle}>
                                👥 Participants ({participants.length})
                            </Text>
                            <TouchableOpacity onPress={() => setShowParticipantsList(false)}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.participantsList}>
                            {participants.map((participant) => (
                                <View key={participant.user_id} style={styles.participantItem}>
                                    <View style={styles.participantInfo}>
                                        <View style={styles.participantAvatar}>
                                            {participant.user_avatar ? (
                                                <Image
                                                    source={{ uri: participant.user_avatar }}
                                                    style={styles.participantAvatarImage}
                                                />
                                            ) : (
                                                <View style={styles.participantAvatarPlaceholder}>
                                                    <Text style={styles.participantAvatarText}>
                                                        {participant.user_name.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                            {participant.role === 'owner' && (
                                                <View style={styles.ownerBadge}>
                                                    <SafeIcon name="star" size={10} color="#FFD700" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.participantDetails}>
                                            <Text style={styles.participantName}>{participant.user_name}</Text>
                                            <Text style={styles.participantRole}>
                                                {participant.role === 'owner' ? t('chatModalMobile.proprietaire') :
                                                    participant.invited_by ? t('chatModalMobile.invite') : '👥 Participant'}
                                            </Text>
                                        </View>
                                    </View>

                                    {participant.can_remove && participant.user_id !== user?.id && (
                                        <TouchableOpacity
                                            style={styles.removeParticipantButton}
                                            onPress={() => removeParticipant(participant.user_id)}
                                        >
                                            <SafeIcon name="user-minus" size={18} color={modernColors.error} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.participantsFooter}>
                            <TouchableOpacity
                                style={[styles.addParticipantButton, styles.addMemberButton]}
                                onPress={() => {
                                    setShowParticipantsList(false);
                                    setShowMentionPicker(true);
                                }}
                            >
                                <View style={styles.addMemberIconContainer}>
                                    <SafeIcon name="user-plus" size={18} color="#FFFFFF" />
                                    <View style={styles.addMemberPlus}>
                                        <Text style={styles.addMemberPlusText}>+</Text>
                                    </View>
                                </View>
                                <Text style={styles.addParticipantText}>{t('chatModalMobile.inviteSomeone') || 'Inviter quelqu\'un'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Panneau chatbot IA inline */}
            {showChatbotPanel && (
                <View style={[styles.chatbotOverlay, { bottom: keyboardBottomInset }]}>
                    <View style={styles.chatbotPanel}>
                        {/* Header du chatbot */}
                        <View style={styles.chatbotHeader}>
                            <View style={styles.chatbotHeaderLeft}>
                                <View style={styles.chatbotAvatar}>
                                    <SafeIcon name="cpu" size={16} color="#FFFFFF" />
                                </View>
                                <Text style={styles.chatbotTitle}>{t('intelligentChat.title')}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowChatbotPanel(false)} style={styles.chatbotCloseBtn}>
                                <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Messages du chatbot */}
                        <ScrollView
                            ref={chatbotScrollRef}
                            style={styles.chatbotMessages}
                            contentContainerStyle={styles.chatbotMessagesContent}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="interactive"
                            onContentSizeChange={() => chatbotScrollRef.current?.scrollToEnd({ animated: true })}
                        >
                            {chatbotMessages.map((msg) => (
                                <View key={msg.id} style={[
                                    styles.chatbotBubbleRow,
                                    msg.isUser ? styles.chatbotBubbleRowRight : styles.chatbotBubbleRowLeft,
                                ]}>
                                    <View style={[
                                        styles.chatbotBubble,
                                        msg.isUser ? styles.chatbotBubbleUser : styles.chatbotBubbleBot,
                                    ]}>
                                        <Text style={[
                                            styles.chatbotBubbleText,
                                            msg.isUser ? styles.chatbotBubbleTextUser : styles.chatbotBubbleTextBot,
                                        ]}>{msg.text}</Text>
                                    </View>

                                    {!msg.isUser && msg.response?.icons && msg.response.icons.length > 0 && (
                                        <View style={styles.chatbotIconsRow}>
                                            {msg.response.icons.map((ref: IconReference, idx: number) => (
                                                <View key={idx} style={[styles.chatbotIconChip, { borderColor: ref.color || modernColors.primary }]}>
                                                    <SafeIcon name={ref.icon} size={14} color={ref.color || modernColors.primary} />
                                                    <Text style={[styles.chatbotIconLabel, { color: ref.color || modernColors.primary }]}>{ref.label}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Quick replies */}
                                    {!msg.isUser && msg.response?.quickReplies && msg.response.quickReplies.length > 0 && (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chatbotQuickReplies}>
                                            {msg.response.quickReplies.map((qr, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={styles.chatbotQuickReplyBtn}
                                                    onPress={() => handleChatbotQuery(qr)}
                                                >
                                                    <Text style={styles.chatbotQuickReplyText}>{qr}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}

                                    {/* Navigation action buttons */}
                                    {!msg.isUser && msg.response?.suggestedActions && msg.response.suggestedActions.length > 0 && (() => {
                                        const navLinks = msg.response!.suggestedActions!.filter((a: any) => a.id?.startsWith('nav-'));
                                        const otherActions = msg.response!.suggestedActions!.filter((a: any) => !a.id?.startsWith('nav-'));
                                        return (
                                            <View style={styles.chatbotActionsRow}>
                                                {otherActions.map((action: any, idx: number) => (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={styles.chatbotActionBtn}
                                                        onPress={() => {
                                                            if (action.route) {
                                                                try {
                                                                    (navigation as any).navigate(action.route, action.params);
                                                                } catch { /* ignore */ }
                                                            } else {
                                                                handleChatbotQuery(action.label);
                                                            }
                                                        }}
                                                    >
                                                        <SafeIcon name={action.icon || 'arrow-right'} size={14} color="#6366f1" />
                                                        <Text style={styles.chatbotActionText}>{action.label}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                {navLinks.length > 0 && (
                                                    <>
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 8, marginBottom: 2, width: '100%' }}>{t('intelligentChat.quickAccess')}</Text>
                                                        {navLinks.map((action: any, idx: number) => (
                                                            <TouchableOpacity
                                                                key={`nav-${idx}`}
                                                                style={[styles.chatbotActionBtn, { backgroundColor: '#6366f1', borderColor: '#6366f1' }]}
                                                                onPress={() => {
                                                                    try { (navigation as any).navigate(action.route, action.params); } catch { /* ignore */ }
                                                                }}
                                                            >
                                                                <SafeIcon name={action.icon || 'arrow-right'} size={14} color="#fff" />
                                                                <Text style={[styles.chatbotActionText, { color: '#fff' }]}>{action.label}</Text>
                                                                <SafeIcon name="chevron-right" size={12} color="#fff" />
                                                            </TouchableOpacity>
                                                        ))}
                                                    </>
                                                )}
                                            </View>
                                        );
                                    })()}

                                    {/* Anticipated next questions */}
                                    {!msg.isUser && msg.response?.nextSteps && msg.response.nextSteps.length > 0 && (
                                        <View style={styles.chatbotNextSteps}>
                                            {msg.response.nextSteps.map((step: string, idx: number) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={styles.chatbotNextStepBtn}
                                                    onPress={() => handleChatbotQuery(step)}
                                                >
                                                    <SafeIcon name="message-circle" size={12} color="#8b5cf6" />
                                                    <Text style={styles.chatbotNextStepText}>{step}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ))}

                            {chatbotLoading && !isStreaming && (
                                <View style={[styles.chatbotBubbleRow, styles.chatbotBubbleRowLeft]}>
                                    <View style={[styles.chatbotBubble, styles.chatbotBubbleBot]}>
                                        <View style={styles.typingDots}>
                                            <Animated.View style={[styles.typingDotSmall, { opacity: typingDot1, transform: [{ scale: typingDot1 }] }]} />
                                            <Animated.View style={[styles.typingDotSmall, { opacity: typingDot2, transform: [{ scale: typingDot2 }] }]} />
                                            <Animated.View style={[styles.typingDotSmall, { opacity: typingDot3, transform: [{ scale: typingDot3 }] }]} />
                                        </View>
                                    </View>
                                </View>
                            )}
                            {isStreaming && streamingText.length > 0 && (
                                <View style={[styles.chatbotBubbleRow, styles.chatbotBubbleRowLeft]}>
                                    <View style={[styles.chatbotBubble, styles.chatbotBubbleBot]}>
                                        <Text style={styles.chatbotBubbleTextBot}>{streamingText}<Text style={styles.streamingCursor}>▊</Text></Text>
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        {/* Input du chatbot */}
                        <View style={styles.chatbotInputRow}>
                            <TextInput
                                style={styles.chatbotTextInput}
                                value={chatbotInput}
                                onChangeText={setChatbotInput}
                                placeholder={t('intelligentChat.placeholder')}
                                placeholderTextColor={modernColors.textSecondary}
                                onSubmitEditing={() => handleChatbotQuery(chatbotInput)}
                                returnKeyType="send"
                                editable={!chatbotLoading}
                            />
                            <TouchableOpacity
                                style={[styles.chatbotSendBtn, (!chatbotInput.trim() || chatbotLoading) && styles.chatbotSendBtnDisabled]}
                                onPress={() => handleChatbotQuery(chatbotInput)}
                                disabled={!chatbotInput.trim() || chatbotLoading}
                            >
                                <SafeIcon name="send" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerBottom: {
        paddingLeft: 48,
        paddingRight: 40,
        marginTop: 4,
    },
    headerInfo: {
        flex: 1,
        marginLeft: 8,
    },
    prestataireName: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    serviceInfo: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 20,
        position: 'relative',
    },
    actionButtonHighlight: {
        backgroundColor: modernColors.primary + '20', // 20% opacity
    },
    participantsBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: modernColors.primary,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    participantsBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    whatsappButton: {
        backgroundColor: '#E8F5E9',
        borderWidth: 2,
        borderColor: '#25D366',
    },
    whatsappIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#25D366',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ✅ SUPPRIMÉ : Style whatsappIcon n'est plus nécessaire car on utilise FontAwesome directement
    whatsappBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#25D366',
        borderRadius: 8,
        paddingHorizontal: 4,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    whatsappBadgeText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    addMemberButton: {
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        borderColor: '#1D4ED8',
    },
    addMemberIconContainer: {
        position: 'relative',
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addMemberPlus: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    addMemberPlusText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 20,
    },
    messageContainer: {
        marginBottom: 16,
    },
    messageContainerLeft: {
        alignItems: 'flex-start',
    },
    messageContainerRight: {
        alignItems: 'flex-end',
    },
    messageBubble: {
        maxWidth: '85%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    messageBubbleLeft: {
        backgroundColor: modernColors.surface,
        borderBottomLeftRadius: 4,
    },
    messageBubbleRight: {
        backgroundColor: '#8B9AFF', // ✅ CORRIGÉ: Couleur plus claire pour les messages envoyés (au lieu de modernColors.primary trop foncé)
        borderBottomRightRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    messageTextLeft: {
        color: modernColors.text,
    },
    messageTextRight: {
        color: '#FFFFFF',
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    messageTime: {
        fontSize: 11,
        opacity: 0.7,
    },
    messageTimeLeft: {
        color: modernColors.textSecondary,
    },
    messageTimeRight: {
        color: '#FFFFFF',
    },
    editedIndicator: {
        fontStyle: 'italic',
    },
    messageActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 8,
    },
    messageActionButton: {
        padding: 4,
    },
    editContainer: {
        gap: 8,
    },
    editInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 8,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    editActions: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'flex-end',
    },
    editButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    saveButton: {
        backgroundColor: modernColors.success,
    },
    cancelEditButton: {
        backgroundColor: modernColors.error,
    },
    typingContainer: {
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    typingBubble: {
        backgroundColor: modernColors.surface,
        padding: 12,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    typingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.primary,
    },
    typingDotSmall: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#8B5CF6',
    },
    streamingCursor: {
        color: '#8B5CF6',
        fontWeight: '700',
        fontSize: 14,
    },
    typingText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    emojiPicker: {
        backgroundColor: modernColors.surface,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        paddingVertical: 8,
    },
    emojiContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
    },
    emojiButton: {
        padding: 8,
        borderRadius: 8,
    },
    aiButton: {
        padding: 8,
        borderRadius: 8,
    },
    emojiText: {
        fontSize: 24,
    },
    inputContainer: {
        backgroundColor: modernColors.surface,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surfaceVariant,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 20,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 40,
        minHeight: 40,
    },
    sendButtonDisabled: {
        backgroundColor: modernColors.textSecondary,
        opacity: 0.5,
    },
    inputFooter: {
        marginTop: 8,
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    connectionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    connectionText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    mediaPreviewContainer: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        gap: 8,
    },
    mediaPreviewItem: {
        position: 'relative',
        marginRight: 8,
    },
    previewImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
    },
    audioPreview: {
        width: 140,
        height: 80,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    playAudioButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioInfo: {
        flex: 1,
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioPreviewText: {
        fontSize: 9,
        color: '#FFFFFF',
        marginTop: 4,
        textAlign: 'center',
    },
    documentPreview: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: '#F59E0B',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
    },
    documentSize: {
        fontSize: 8,
        color: '#FFFFFF',
        marginTop: 2,
        textAlign: 'center',
    },
    removeMediaButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeMediaText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    mediaActionsRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 8,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    mediaButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ✅ NOUVEAU 2026-01-23: Style pour le bouton "Commander" (comme ProductCard)
    deliveryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#10B981',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#059669',
        minWidth: 80,
    },
    deliveryButtonDisabled: {
        backgroundColor: '#E5E7EB',
        borderColor: '#D1D5DB',
    },
    deliveryButtonText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
    },
    deliveryButtonTextDisabled: {
        color: '#9CA3AF',
    },
    callButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    callButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaButtonActive: {
        backgroundColor: '#FEE2E2',
    },
    recordingTime: {
        position: 'absolute',
        bottom: -16,
        fontSize: 10,
        color: '#EF4444',
        fontWeight: 'bold',
    },
    // ✅ NOUVEAU: Styles pour les médias dans les messages
    messageImage: {
        width: 220,
        height: 165,
        borderRadius: 14,
        marginBottom: 8,
    },
    audioContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    audioText: {
        fontSize: 14,
        fontWeight: '500',
    },
    fileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    fileText: {
        fontSize: 14,
        fontWeight: '500',
    },
    // ✅ FIX 2026-03-03: Styles pour le modal de commentaires inline
    commentsModalContainer: {
        flex: 1,
        backgroundColor: modernColors.background,
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
    },
    commentsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    commentsModalClose: {
        padding: 8,
    },
    commentsModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    // ✅ NOUVEAU: Styles pour la liste des participants
    participantsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    participantsContainer: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        paddingBottom: 20,
    },
    participantsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    participantsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    participantsList: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    participantItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: modernColors.background,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    participantInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    participantAvatar: {
        position: 'relative',
        width: 48,
        height: 48,
    },
    participantAvatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    participantAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    participantAvatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    ownerBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: modernColors.surface,
    },
    participantDetails: {
        flex: 1,
    },
    participantName: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    participantRole: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    removeParticipantButton: {
        padding: 8,
        backgroundColor: modernColors.error + '15',
        borderRadius: 8,
    },
    participantsFooter: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    addParticipantButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        backgroundColor: modernColors.primary,
        borderRadius: 12,
    },
    addParticipantText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // ✅ NOUVEAU: Styles pour le système de réponse/citation
    replyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: modernColors.primary + '20',
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
        borderRadius: 8,
    },
    replyContent: {
        flex: 1,
        marginRight: 8,
    },
    replyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    replyLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    replyText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    replyCloseButton: {
        padding: 4,
    },
    quotedMessage: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 8,
        padding: 8,
        marginBottom: 8,
    },
    quotedMessageBar: {
        width: 3,
        backgroundColor: modernColors.primary,
        borderRadius: 2,
        marginRight: 8,
    },
    quotedMessageContent: {
        flex: 1,
    },
    quotedMessageAuthor: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 2,
    },
    quotedMessageText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    messageFooterLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    replyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    replyButtonText: {
        fontSize: 11,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    // Chatbot IA inline panel styles
    aiButtonActive: {
        backgroundColor: modernColors.error + '15',
        borderRadius: 20,
    },
    chatbotOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '55%',
        backgroundColor: 'transparent',
        zIndex: 100,
    },
    chatbotPanel: {
        flex: 1,
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 20,
        overflow: 'hidden',
    },
    chatbotHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        backgroundColor: '#6366F1',
    },
    chatbotHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    chatbotAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatbotTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    chatbotCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatbotMessages: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    chatbotMessagesContent: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    chatbotBubbleRow: {
        marginBottom: 8,
    },
    chatbotBubbleRowLeft: {
        alignItems: 'flex-start',
    },
    chatbotBubbleRowRight: {
        alignItems: 'flex-end',
    },
    chatbotBubble: {
        maxWidth: '90%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
    },
    chatbotBubbleUser: {
        backgroundColor: '#6366F1',
        borderBottomRightRadius: 4,
    },
    chatbotBubbleBot: {
        backgroundColor: modernColors.surface,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    chatbotBubbleText: {
        fontSize: 14,
        lineHeight: 20,
    },
    chatbotBubbleTextUser: {
        color: '#FFFFFF',
    },
    chatbotBubbleTextBot: {
        color: modernColors.text,
    },
    chatbotIconsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
        paddingLeft: 4,
    },
    chatbotIconChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1.5,
        backgroundColor: modernColors.surface,
    },
    chatbotIconLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    chatbotQuickReplies: {
        marginTop: 8,
        paddingLeft: 4,
    },
    chatbotQuickReplyBtn: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: '#6366F1' + '15',
        borderWidth: 1,
        borderColor: '#6366F1' + '40',
        marginRight: 8,
    },
    chatbotQuickReplyText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6366F1',
    },
    chatbotActionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
        paddingLeft: 4,
    },
    chatbotActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eef2ff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    chatbotActionText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6366f1',
    },
    chatbotNextSteps: {
        marginTop: 8,
        paddingLeft: 4,
        gap: 4,
    },
    chatbotNextStepBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: '#f5f3ff',
        gap: 6,
    },
    chatbotNextStepText: {
        fontSize: 12,
        color: '#8b5cf6',
        flex: 1,
    },
    chatbotInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    chatbotTextInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.background,
        maxHeight: 80,
    },
    chatbotSendBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatbotSendBtnDisabled: {
        backgroundColor: modernColors.textSecondary,
        opacity: 0.4,
    },
});

export default ChatModalMobile;
