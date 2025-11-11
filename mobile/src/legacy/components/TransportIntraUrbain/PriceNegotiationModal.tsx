/**
 * Modal de négociation de prix dynamique entre client et chauffeur
 * Utilise WebSocket pour l'échange instantané
 */
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../SafeIcon';

interface Message {
    id: string;
    type: 'price_offer' | 'price_counter' | 'message' | 'system';
    sender: 'client' | 'driver' | 'system';
    content: string;
    price?: number;
    timestamp: Date;
}

interface PriceNegotiationModalProps {
    visible: boolean;
    onClose: () => void;
    driverName: string;
    driverId: string;
    initialPrice?: number;
    distance: number;
    unpavedDistance?: number;
    onPriceAccepted: (finalPrice: number) => void;
    userRole: 'client' | 'driver';
}

const PriceNegotiationModal: React.FC<PriceNegotiationModalProps> = ({
    visible,
    onClose,
    driverName,
    driverId,
    initialPrice,
    distance,
    unpavedDistance,
    onPriceAccepted,
    userRole,
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [proposedPrice, setProposedPrice] = useState('');
    const [currentOffer, setCurrentOffer] = useState<number | null>(initialPrice || null);
    const [negotiationStatus, setNegotiationStatus] = useState<'open' | 'accepted' | 'rejected'>('open');
    const scrollViewRef = useRef<ScrollView>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Connexion WebSocket pour négociation en temps réel
    useEffect(() => {
        if (visible) {
            connectWebSocket();

            // Message système initial
            addSystemMessage(`Distance totale: ${distance.toFixed(1)} km${unpavedDistance ? ` (dont ${unpavedDistance.toFixed(1)} km non goudronnés)` : ''}`);

            if (initialPrice && userRole === 'client') {
                addSystemMessage(`${driverName} propose ${initialPrice} FCFA`);
            }
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [visible]);

    const connectWebSocket = () => {
        try {
            // Utiliser le même système WebSocket que pour les messages
            const negotiationId = `negotiation_${driverId}_${Date.now()}`;
            wsRef.current = new WebSocket(`wss://yukpomnang.onrender.com/ws/price-negotiation/${negotiationId}`);

            wsRef.current.onopen = () => {
                console.log('[PriceNegotiation] WebSocket connecté');
            };

            wsRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleIncomingMessage(data);
            };

            wsRef.current.onerror = (error) => {
                console.error('[PriceNegotiation] WebSocket erreur:', error);
            };

            wsRef.current.onclose = () => {
                console.log('[PriceNegotiation] WebSocket fermé');
            };
        } catch (error) {
            console.error('[PriceNegotiation] Erreur connexion:', error);
        }
    };

    const handleIncomingMessage = (data: any) => {
        if (data.type === 'price_offer' || data.type === 'price_counter') {
            const message: Message = {
                id: Date.now().toString(),
                type: data.type,
                sender: data.sender,
                content: data.content,
                price: data.price,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, message]);
            setCurrentOffer(data.price);
        } else if (data.type === 'message') {
            const message: Message = {
                id: Date.now().toString(),
                type: 'message',
                sender: data.sender,
                content: data.content,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, message]);
        } else if (data.type === 'accepted') {
            setNegotiationStatus('accepted');
            addSystemMessage('Prix accepté ! Commande confirmée.');
        } else if (data.type === 'rejected') {
            setNegotiationStatus('rejected');
            addSystemMessage('Offre refusée.');
        }
    };

    const addSystemMessage = (content: string) => {
        const message: Message = {
            id: Date.now().toString(),
            type: 'system',
            sender: 'system',
            content,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, message]);
    };

    const sendMessage = () => {
        if (!inputText.trim()) return;

        const message: Message = {
            id: Date.now().toString(),
            type: 'message',
            sender: userRole,
            content: inputText,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, message]);

        // Envoyer via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message',
                sender: userRole,
                content: inputText,
            }));
        }

        setInputText('');
    };

    const proposePrice = () => {
        const price = parseFloat(proposedPrice);
        if (isNaN(price) || price <= 0) {
            Alert.alert('Erreur', 'Veuillez entrer un prix valide');
            return;
        }

        const message: Message = {
            id: Date.now().toString(),
            type: currentOffer ? 'price_counter' : 'price_offer',
            sender: userRole,
            content: `${userRole === 'client' ? 'Je propose' : 'Mon prix est'} ${price} FCFA`,
            price,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, message]);
        setCurrentOffer(price);

        // Envoyer via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: currentOffer ? 'price_counter' : 'price_offer',
                sender: userRole,
                content: message.content,
                price,
            }));
        }

        setProposedPrice('');
    };

    const acceptCurrentOffer = () => {
        if (!currentOffer) {
            Alert.alert('Erreur', 'Aucune offre à accepter');
            return;
        }

        setNegotiationStatus('accepted');
        addSystemMessage(`Prix accepté: ${currentOffer} FCFA`);

        // Envoyer via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'accepted',
                price: currentOffer,
            }));
        }

        setTimeout(() => {
            onPriceAccepted(currentOffer);
        }, 1000);
    };

    const rejectCurrentOffer = () => {
        setNegotiationStatus('rejected');
        addSystemMessage('Offre refusée');

        // Envoyer via WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'rejected',
            }));
        }
    };

    const renderMessage = (message: Message) => {
        if (message.type === 'system') {
            return (
                <View key={message.id} style={styles.systemMessage}>
                    <Text style={styles.systemMessageText}>{message.content}</Text>
                </View>
            );
        }

        const isOwnMessage = message.sender === userRole;

        return (
            <View
                key={message.id}
                style={[
                    styles.messageContainer,
                    isOwnMessage ? styles.ownMessage : styles.otherMessage,
                ]}
            >
                <View style={[
                    styles.messageBubble,
                    isOwnMessage ? styles.ownBubble : styles.otherBubble,
                ]}>
                    {(message.type === 'price_offer' || message.type === 'price_counter') && message.price && (
                        <View style={styles.priceTag}>
                            <SafeIcon name="dollar-sign" size={16} color="#F59E0B" />
                            <Text style={styles.priceText}>{message.price} FCFA</Text>
                        </View>
                    )}
                    <Text style={[
                        styles.messageText,
                        isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                    ]}>
                        {message.content}
                    </Text>
                    <Text style={styles.messageTime}>
                        {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>💰 Négociation du prix</Text>
                        <Text style={styles.headerSubtitle}>
                            avec {userRole === 'client' ? driverName : 'le client'}
                        </Text>
                    </View>
                    {currentOffer && (
                        <View style={styles.currentOfferBadge}>
                            <Text style={styles.currentOfferText}>{currentOffer} FCFA</Text>
                        </View>
                    )}
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.map(renderMessage)}
                </ScrollView>

                {/* Actions */}
                {negotiationStatus === 'open' && (
                    <>
                        {/* Accepter/Refuser l'offre actuelle */}
                        {currentOffer && (
                            <View style={styles.offerActions}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.rejectButton]}
                                    onPress={rejectCurrentOffer}
                                >
                                    <SafeIcon name="x-circle" size={16} color="#EF4444" />
                                    <Text style={styles.rejectButtonText}>Refuser</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.acceptButton]}
                                    onPress={acceptCurrentOffer}
                                >
                                    <SafeIcon name="check-circle" size={16} color="#FFFFFF" />
                                    <Text style={styles.acceptButtonText}>Accepter</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Proposer un prix */}
                        <View style={styles.priceInputContainer}>
                            <TextInput
                                style={styles.priceInput}
                                placeholder="Proposer un prix..."
                                placeholderTextColor="#9CA3AF"
                                value={proposedPrice}
                                onChangeText={setProposedPrice}
                                keyboardType="numeric"
                            />
                            <TouchableOpacity style={styles.proposePriceButton} onPress={proposePrice}>
                                <SafeIcon name="send" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Chat */}
                        <View style={styles.chatInputContainer}>
                            <TextInput
                                style={styles.chatInput}
                                placeholder="Envoyer un message..."
                                placeholderTextColor="#9CA3AF"
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                            />
                            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                                <SafeIcon name="send" size={20} color="#F59E0B" />
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                {negotiationStatus === 'accepted' && (
                    <View style={styles.statusContainer}>
                        <SafeIcon name="check-circle" size={48} color="#10B981" />
                        <Text style={styles.statusTitle}>Prix accepté !</Text>
                        <Text style={styles.statusSubtitle}>{currentOffer} FCFA</Text>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    closeButton: {
        marginRight: 15,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    currentOfferBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    currentOfferText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400E',
    },
    messagesContainer: {
        flex: 1,
        padding: 15,
    },
    systemMessage: {
        alignItems: 'center',
        marginVertical: 10,
    },
    systemMessageText: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
        textAlign: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    messageContainer: {
        marginVertical: 5,
        maxWidth: '80%',
    },
    ownMessage: {
        alignSelf: 'flex-end',
    },
    otherMessage: {
        alignSelf: 'flex-start',
    },
    messageBubble: {
        padding: 12,
        borderRadius: 16,
    },
    ownBubble: {
        backgroundColor: '#F59E0B',
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
    },
    priceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
        gap: 6,
    },
    priceText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#F59E0B',
    },
    messageText: {
        fontSize: 14,
    },
    ownMessageText: {
        color: '#FFFFFF',
    },
    otherMessageText: {
        color: '#1F2937',
    },
    messageTime: {
        fontSize: 10,
        color: '#9CA3AF',
        marginTop: 4,
    },
    offerActions: {
        flexDirection: 'row',
        padding: 15,
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    acceptButton: {
        backgroundColor: '#10B981',
    },
    acceptButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    rejectButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    rejectButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EF4444',
    },
    priceInputContainer: {
        flexDirection: 'row',
        padding: 15,
        paddingTop: 0,
        gap: 10,
        backgroundColor: '#FFFFFF',
    },
    priceInput: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1F2937',
    },
    proposePriceButton: {
        backgroundColor: '#F59E0B',
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatInputContainer: {
        flexDirection: 'row',
        padding: 15,
        paddingTop: 0,
        gap: 10,
        backgroundColor: '#FFFFFF',
    },
    chatInput: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1F2937',
        maxHeight: 100,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF3C7',
    },
    statusContainer: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#FFFFFF',
    },
    statusTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#10B981',
        marginTop: 15,
    },
    statusSubtitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginTop: 5,
    },
});

export default PriceNegotiationModal;
