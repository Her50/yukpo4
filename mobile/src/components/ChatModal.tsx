// Migration vers Lucide React Native pour un design moderne
import { Check, CheckCheck, MoreVertical, Send, X } from 'lucide-react-native';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

    useEffect(() => {
        if (visible && service) {
            // Charger les messages existants
            loadMessages();
        }
    }, [visible, service]);

    const loadMessages = async () => {
        // TODO: Charger les messages depuis l'API
        // Pour l'instant, on simule quelques messages
        const mockMessages: Message[] = [
            {
                id: '1',
                content: 'Bonjour ! Je suis intéressé par votre service.',
                from: 'client',
                timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
                status: 'read'
            },
            {
                id: '2',
                content: 'Bonjour ! Merci pour votre intérêt. Comment puis-je vous aider ?',
                from: 'prestataire',
                timestamp: new Date(Date.now() - 1000 * 60 * 25), // 25 min ago
                status: 'read'
            },
            {
                id: '3',
                content: 'J\'aimerais en savoir plus sur les détails et le prix.',
                from: 'client',
                timestamp: new Date(Date.now() - 1000 * 60 * 20), // 20 min ago
                status: 'read'
            }
        ];
        setMessages(mockMessages);
    };

    const sendMessage = () => {
        if (!newMessage.trim() || !service) return;

        const message: Message = {
            id: Date.now().toString(),
            content: newMessage.trim(),
            from: 'client',
            timestamp: new Date(),
            status: 'sent'
        };

        setMessages(prev => [...prev, message]);
        setNewMessage('');

        // Simuler une réponse du prestataire
        setTimeout(() => {
            const response: Message = {
                id: (Date.now() + 1).toString(),
                content: 'Merci pour votre message. Je vous réponds dans les plus brefs délais.',
                from: 'prestataire',
                timestamp: new Date(),
                status: 'sent'
            };
            setMessages(prev => [...prev, response]);
        }, 2000);

        onSendMessage?.(newMessage.trim());
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
                return <CheckCheck size={12} color="#9E9E9E" />;
            case 'read':
                return <CheckCheck size={12} color="#4CAF50" />;
            default:
                return null;
        }
    };

    if (!visible || !service || !prestataire) return null;

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
                            label={prestataire.name?.charAt(0) || '?'}
                            style={[styles.avatar, prestataire.isOnline && styles.avatarOnline]}
                        />
                        <View style={styles.headerDetails}>
                            <Text style={styles.prestataireName}>{prestataire.name}</Text>
                            <View style={styles.statusContainer}>
                                <View style={[styles.statusDot, prestataire.isOnline ? styles.statusOnline : styles.statusOffline]} />
                                <Text style={styles.statusText}>
                                    {prestataire.isOnline ? 'En ligne' : 'Hors ligne'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.moreButton}>
                        <MoreVertical size={20} color={theme.colors.text} />
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
                            <Send size={20} color="white" />
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












