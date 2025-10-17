// @ts-nocheck
// Migration vers Lucide React Native pour un design moderne
import { Check, DotsThreeVertical, PaperPlaneTilt, X } from 'phosphor-react-native';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Avatar } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';

interface Message {
    id: string;
    content: string;
    from: 'client' | 'prestataire';
    timestamp: Date;
    status: 'sent' | 'delivered' | 'read';
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
        // Charger les messages depuis l'API
        try {
            if (!service || !user) return;

            const response = await fetch(`https://yukpomnang.onrender.com/api/chat/messages/${service.id}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const loadedMessages: Message[] = data.messages?.map((msg: any) => ({
                    id: msg.id,
                    content: msg.content || msg.message,
                    from: msg.sender_id === user.id ? 'client' : 'prestataire',
                    timestamp: new Date(msg.created_at || msg.timestamp),
                    status: msg.status || 'read'
                })) || [];

                setMessages(loadedMessages);
                console.log('[ChatModal] Messages chargés:', loadedMessages.length);
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
            // Envoyer le message à l'API
            const response = await fetch(`https://yukpomnang.onrender.com/api/chat/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    service_id: service.id,
                    receiver_id: service.user_id,
                    sender_id: user.id,
                    content: messageContent,
                    type: 'text'
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[ChatModal] Message envoyé avec succès:', data);

                // Mettre à jour le message avec l'ID réel du serveur
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, id: data.message_id || data.id, status: 'delivered' }
                        : msg
                ));

                // ✅ NOUVEAU: Envoyer une push notification au prestataire
                try {
                    const pushResponse = await fetch('https://yukpomnang.onrender.com/api/chat/notify-message', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${user.token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            recipient_id: service.user_id,
                            sender_id: user.id,
                            sender_name: user.name || user.email || 'Utilisateur',
                            message_preview: messageContent.substring(0, 100),
                            service_id: service.id,
                            service_title: service.titre || 'Service'
                        })
                    });
                    
                    if (pushResponse.ok) {
                        console.log('[ChatModal] ✅ Push notification envoyée au destinataire');
                    } else {
                        console.warn('[ChatModal] ⚠️ Erreur push notification:', pushResponse.status);
                    }
                } catch (pushError) {
                    console.warn('[ChatModal] ⚠️ Erreur push notification (message envoyé quand même):', pushError);
                }

                console.log('[ChatModal] Message et notification envoyés');
                onSendMessage?.(messageContent);

            } else {
                // En cas d'erreur, marquer le message comme non envoyé
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, status: 'sent' }
                        : msg
                ));
                Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer.');
            }
        } catch (error) {
            console.error('[ChatModal] Erreur envoi message:', error);
            Alert.alert('Erreur', 'Erreur lors de l\'envoi du message');
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
                    <View style={styles.inputWrapper}>
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
});

export default ChatModal;












