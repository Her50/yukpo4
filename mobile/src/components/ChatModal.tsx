// @ts-nocheck
// Migration vers Lucide React Native pour un design moderne
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Check, DotsThreeVertical, Image as ImageIcon, Paperclip, PaperPlaneTilt, X } from 'phosphor-react-native';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Avatar } from 'react-native-paper';
import { API_ENDPOINTS } from '../config/api.config';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../services/api';
import { theme } from '../theme/theme';

interface Message {
    id: string;
    content: string;
    from: 'client' | 'prestataire';
    timestamp: Date;
    status: 'sent' | 'delivered' | 'read';
    type?: 'text' | 'image' | 'audio' | 'file';
    mediaUrl?: string;
    fileName?: string;
}

interface Service {
    id: string;
    titre: string;
    description: string;
    user_id: string;
    data?: any;
    [key: string]: any;
}

interface Prestataire {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    isOnline?: boolean;
    [key: string]: any;
}

interface ChatModalProps {
    visible: boolean;
    service: Service | null;
    prestataire: Prestataire | null;
    onClose: () => void;
    onSendMessage?: (message: string) => void;
}

const ChatModal: React.FC<ChatModalProps> = ({
    visible,
    service,
    prestataire,
    onClose,
    onSendMessage
}) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // CORRECTION: Normaliser le nom du prestataire (nom_complet au lieu de name)
    const normalizedPrestataire = prestataire ? {
        ...prestataire,
        name: (prestataire as any).nom_complet || prestataire.name || `Prestataire ${prestataire.id}`,
        avatar: (prestataire as any).avatar_url || (prestataire as any).photo_profil || prestataire.avatar
    } : null;

    useEffect(() => {
        if (visible && service) {
            // Charger les messages existants
            loadMessages();
        }
    }, [visible, service]);

    const loadMessages = async () => {
        // ✅ CORRECTION: Utiliser le bon endpoint backend
        try {
            if (!service || !user) return;

            // ✅ CORRIGÉ: Utilise apiGet
            const response = await apiGet(API_ENDPOINTS.SERVICES.INTERACTIONS(parseInt(service.id)));

            if (response.success && response.data) {
                const interactions = response.data;
                console.log('[ChatModal] Interactions chargées:', interactions);

                // ✅ Filtrer uniquement les messages texte et audio
                const loadedMessages: Message[] = (interactions || [])
                    .filter((interaction: any) => interaction.interaction_type === 'message' || interaction.interaction_type === 'audio')
                    .map((interaction: any) => ({
                        id: interaction._id || interaction.id || String(Date.now()),
                        content: interaction.metadata || interaction.content || '',
                        from: interaction.user_id === parseInt(user.id) ? 'client' : 'prestataire',
                        timestamp: new Date(interaction.created_at || interaction.timestamp || Date.now()),
                        status: 'read' // Les messages chargés sont considérés comme lus
                    }))
                    .sort((a: Message, b: Message) => a.timestamp.getTime() - b.timestamp.getTime());

                setMessages(loadedMessages);
                console.log('[ChatModal] ✅ Messages chargés:', loadedMessages.length);
            } else {
                console.warn('[ChatModal] Aucun message chargé, conversation vide');
                setMessages([]);
            }
        } catch (error) {
            console.error('[ChatModal] Erreur chargement messages:', error);
            // Initialiser avec une conversation vide
            setMessages([]);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !service || !user || !prestataire) return;

        const messageContent = newMessage.trim();
        const tempId = Date.now().toString();

        // Ajouter le message localement immédiatement pour UX réactive
        const tempMessage: Message = {
            id: tempId,
            content: messageContent,
            from: 'client',
            timestamp: new Date(),
            status: 'sent'
        };

        setMessages(prev => [...prev, tempMessage]);
        setNewMessage('');

        try {
            // ✅ CORRECTION: Utiliser le bon endpoint backend
            // ✅ CORRIGÉ: Utilise apiPost
            const response = await apiPost(`/api/services/${service.id}/message`, {
                content: messageContent
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[ChatModal] ✅ Message envoyé avec succès:', data);

                // Mettre à jour le message avec l'ID réel du serveur
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, id: data._id || data.id || tempId, status: 'delivered' }
                        : msg
                ));

                console.log('[ChatModal] ✅ Message sauvegardé et alerte prestataire créée');
                onSendMessage?.(messageContent);

            } else {
                // En cas d'erreur, marquer le message comme non envoyé
                const errorText = await response.text();
                console.error('[ChatModal] ❌ Erreur envoi message:', response.status, errorText);
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, status: 'sent' }
                        : msg
                ));
                Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer.');
            }
        } catch (error) {
            console.error('[ChatModal] ❌ Erreur envoi message:', error);
            Alert.alert('Erreur', 'Erreur lors de l\'envoi du message');
        }
    };

    // ✅ NOUVEAU : Fonction pour sélectionner une image
    const pickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.granted === false) {
                Alert.alert('Permission refusée', 'Permission d\'accès à la galerie refusée');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.7,
                base64: true
            });

            if (!result.canceled && result.assets[0]) {
                const imageUri = result.assets[0].uri;
                const base64 = result.assets[0].base64;
                setSelectedImage(imageUri);

                // Envoyer immédiatement l'image
                await sendMediaMessage('image', base64);
            }
        } catch (error) {
            console.error('[ChatModal] Erreur sélection image:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    // ✅ NOUVEAU : Fonction pour sélectionner un fichier
    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true
            });

            if (result.type === 'success') {
                Alert.alert('Fichier sélectionné', `${result.name} sera envoyé`);
                // TODO: Implémenter l'upload de fichier
            }
        } catch (error) {
            console.error('[ChatModal] Erreur sélection fichier:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner le fichier');
        }
    };

    // ✅ NOUVEAU : Fonction pour envoyer un média
    const sendMediaMessage = async (mediaType: 'image' | 'audio' | 'file', base64Data: string) => {
        if (!service || !user) return;

        setUploadingMedia(true);
        const tempId = Date.now().toString();

        try {
            // Ajouter le message localement avec preview
            const tempMessage: Message = {
                id: tempId,
                content: mediaType === 'image' ? 'Image' : 'Fichier',
                from: 'client',
                timestamp: new Date(),
                status: 'sent',
                type: mediaType,
                mediaUrl: mediaType === 'image' ? `data:image/jpeg;base64,${base64Data}` : undefined
            };

            setMessages(prev => [...prev, tempMessage]);
            setSelectedImage(null);

            // ✅ CORRIGÉ: Envoyer au backend via apiPost
            const endpoint = mediaType === 'audio' ? 'audio' : 'message';
            const response = await apiPost(`/api/services/${service.id}/${endpoint}`,
                mediaType === 'audio' ? {
                    audio_url: `data:audio/mp3;base64,${base64Data}`
                } : {
                    content: `[${mediaType.toUpperCase()}] data:${mediaType}/*;base64,${base64Data.substring(0, 100)}...`
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('[ChatModal] ✅ Média envoyé:', data);

                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, id: data._id || data.id || tempId, status: 'delivered' }
                        : msg
                ));
            } else {
                throw new Error('Erreur envoi média');
            }
        } catch (error) {
            console.error('[ChatModal] Erreur envoi média:', error);
            Alert.alert('Erreur', 'Impossible d\'envoyer le média');

            // Retirer le message en cas d'erreur
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
        } finally {
            setUploadingMedia(false);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'sent':
                return <Check size={12} color="#9E9E9E" />;
            case 'delivered':
                return <Check size={12} color="#4CAF50" weight="duotone" />;
            case 'read':
                return <Check size={12} color="#4CAF50" weight="fill" />;
            default:
                return null;
        }
    };

    if (!visible || !service || !normalizedPrestataire) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={theme.colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerInfo}>
                        <Avatar.Text
                            size={40}
                            label={normalizedPrestataire.name?.charAt(0) || '?'}
                            style={[styles.avatar, normalizedPrestataire.isOnline && styles.avatarOnline]}
                        />
                        <View style={styles.headerDetails}>
                            <Text style={styles.prestataireName}>{normalizedPrestataire.name}</Text>
                            <View style={styles.statusContainer}>
                                <View style={[styles.statusDot, normalizedPrestataire.isOnline ? styles.statusOnline : styles.statusOffline]} />
                                <Text style={styles.statusText}>
                                    {normalizedPrestataire.isOnline ? 'En ligne' : 'Hors ligne'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.moreButton}>
                        <DotsThreeVertical size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Service info */}
                <View style={styles.serviceInfo}>
                    <Text style={styles.serviceTitle}>{service.titre}</Text>
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                        {service.description}
                    </Text>
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.map((message) => (
                        <View
                            key={message.id}
                            style={[
                                styles.messageContainer,
                                message.from === 'client' ? styles.messageRight : styles.messageLeft
                            ]}
                        >
                            <View
                                style={[
                                    styles.messageBubble,
                                    message.from === 'client' ? styles.messageBubbleRight : styles.messageBubbleLeft
                                ]}
                            >
                                {/* ✅ NOUVEAU : Afficher l'image si c'est un message image */}
                                {message.type === 'image' && message.mediaUrl && (
                                    <Image
                                        source={{ uri: message.mediaUrl }}
                                        style={styles.messageImage}
                                        resizeMode="cover"
                                    />
                                )}

                                <Text style={[
                                    styles.messageText,
                                    message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                ]}>
                                    {message.content}
                                </Text>

                                <View style={styles.messageFooter}>
                                    <Text style={[
                                        styles.messageTime,
                                        message.from === 'client' ? styles.messageTimeRight : styles.messageTimeLeft
                                    ]}>
                                        {formatTime(message.timestamp)}
                                    </Text>
                                    {message.from === 'client' && (
                                        <View style={styles.statusIcon}>
                                            {getStatusIcon(message.status)}
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))}

                    {isTyping && (
                        <View style={[styles.messageContainer, styles.messageLeft]}>
                            <View style={[styles.messageBubble, styles.messageBubbleLeft]}>
                                <Text style={styles.typingText}>Prestataire en train d'écrire...</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Input */}
                <View style={styles.inputContainer}>
                    {/* ✅ NOUVEAU : Boutons pour les médias */}
                    <View style={styles.mediaButtons}>
                        <TouchableOpacity
                            style={styles.mediaButton}
                            onPress={pickImage}
                            disabled={uploadingMedia}
                        >
                            <ImageIcon size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.mediaButton}
                            onPress={pickDocument}
                            disabled={uploadingMedia}
                        >
                            <Paperclip size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputWrapper}>
                        {uploadingMedia ? (
                            <View style={styles.uploadingContainer}>
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                                <Text style={styles.uploadingText}>Envoi en cours...</Text>
                            </View>
                        ) : (
                            <>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Tapez votre message..."
                                    value={newMessage}
                                    onChangeText={setNewMessage}
                                    multiline
                                    maxLength={500}
                                />
                                <TouchableOpacity
                                    onPress={sendMessage}
                                    style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                                    disabled={!newMessage.trim()}
                                >
                                    <PaperPlaneTilt size={20} color="white" weight="fill" />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    closeButton: {
        padding: 8,
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    avatar: {
        backgroundColor: theme.colors.primary,
    },
    avatarOnline: {
        backgroundColor: '#4CAF50',
    },
    headerDetails: {
        marginLeft: 12,
        flex: 1,
    },
    prestataireName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    statusOnline: {
        backgroundColor: '#4CAF50',
    },
    statusOffline: {
        backgroundColor: '#9E9E9E',
    },
    statusText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    moreButton: {
        padding: 8,
    },
    serviceInfo: {
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    messagesContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    messagesContent: {
        paddingVertical: 16,
    },
    messageContainer: {
        marginBottom: 12,
    },
    messageLeft: {
        alignItems: 'flex-start',
    },
    messageRight: {
        alignItems: 'flex-end',
    },
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 18,
    },
    messageBubbleLeft: {
        backgroundColor: '#f1f3f4',
        borderBottomLeftRadius: 4,
    },
    messageBubbleRight: {
        backgroundColor: theme.colors.primary,
        borderBottomRightRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    messageTextLeft: {
        color: theme.colors.text,
    },
    messageTextRight: {
        color: 'white',
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    messageTime: {
        fontSize: 12,
    },
    messageTimeLeft: {
        color: theme.colors.textSecondary,
    },
    messageTimeRight: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    statusIcon: {
        marginLeft: 4,
    },
    typingText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontStyle: 'italic',
    },
    inputContainer: {
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#f8f9fa',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.text,
        maxHeight: 100,
        paddingVertical: 8,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    sendButtonDisabled: {
        backgroundColor: '#9E9E9E',
    },
    // ✅ NOUVEAU : Styles pour les médias
    mediaButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    mediaButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f3f4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadingContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    uploadingText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    messageImage: {
        width: 200,
        height: 150,
        borderRadius: 8,
        marginBottom: 8,
    },
});

export default ChatModal;












