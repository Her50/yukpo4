/**
 * Modal de chat live pour sessions LiveKit
 * Chat temps réel avec messages, emojis, gifts
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { getPopularStickers, Sticker } from '../../data/stickersLibrary';
import { LiveKitChatMessage, liveKitService } from '../../services/liveKitService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { GiftSelector } from './GiftSelector';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface LiveChatModalProps {
    visible: boolean;
    sessionId: string;
    userId?: number;
    onClose: () => void;
}

export const LiveChatModal: React.FC<LiveChatModalProps> = ({
    visible,
    sessionId,
    userId,
    onClose,
}) => {
        const { t } = useLanguageSafe();
const [messages, setMessages] = useState<LiveKitChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [showStickers, setShowStickers] = useState(false);
    const [showGifts, setShowGifts] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (visible && sessionId && userId) {
            connectToChat();
        } else {
            disconnectFromChat();
        }
    }, [visible, sessionId, userId]);

    const connectToChat = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            await liveKitService.joinRoom(
                sessionId,
                userId,
                (message) => {
                    setMessages(prev => [...prev, message]);
                    // Auto-scroll vers le bas
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                },
                (identity) => {
                    console.log('[LiveChatModal] Participant joint:', identity);
                },
                (identity) => {
                    console.log('[LiveChatModal] Participant parti:', identity);
                }
            );
            setLoading(false);
        } catch (error) {
            console.error('[LiveChatModal] Erreur connexion chat:', error);
            setLoading(false);
        }
    };

    const disconnectFromChat = async () => {
        try {
            await liveKitService.leaveRoom();
            setMessages([]);
        } catch (error) {
            console.error('[LiveChatModal] Erreur déconnexion:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;

        try {
            await liveKitService.sendChatMessage(inputText.trim());
            setInputText('');
        } catch (error) {
            console.error('[LiveChatModal] Erreur envoi message:', error);
        }
    };

    const handleSendSticker = async (sticker: Sticker) => {
        try {
            await liveKitService.sendChatMessage(sticker.emoji || sticker.name, 'emoji');
            setShowStickers(false);
        } catch (error) {
            console.error('[LiveChatModal] Erreur envoi sticker:', error);
        }
    };

    const handleSendGift = async (giftId: string, amount: number) => {
        try {
            await liveKitService.sendGift(giftId, amount);
            setShowGifts(false);
        } catch (error) {
            console.error('[LiveChatModal] Erreur envoi gift:', error);
        }
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    if (!visible) {
        return null;
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chat Live</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <SafeIcon name="x" size={20} color="#FFF" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('liveChat.connexionAuChat')}</Text>
                </View>
            ) : (
                <>
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        style={styles.messagesList}
                        contentContainerStyle={styles.messagesContent}
                        renderItem={({ item }) => (
                            <View style={styles.messageItem}>
                                <Text style={styles.messageIdentity}>{item.participant_identity}</Text>
                                <Text style={styles.messageText}>{item.message}</Text>
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>{t('liveChat.aucunMessagePourLinstant')}</Text>
                                <Text style={styles.emptySubtext}>{t('liveChat.soyezLePremierAEcrire')}</Text>
                            </View>
                        }
                    />

                    {showStickers && (
                        <StickerPicker
                            onSelect={handleSendSticker}
                            onClose={() => setShowStickers(false)}
                        />
                    )}

                    {showGifts && (
                        <GiftSelector
                            onSelect={handleSendGift}
                            onClose={() => setShowGifts(false)}
                        />
                    )}

                    <View style={styles.inputContainer}>
                        <TouchableOpacity
                            style={styles.stickerButton}
                            onPress={() => {
                                setShowStickers(!showStickers);
                                setShowGifts(false);
                            }}
                        >
                            <SafeIcon name="smile" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.giftButton}
                            onPress={() => {
                                setShowGifts(!showGifts);
                                setShowStickers(false);
                            }}
                        >
                            <SafeIcon name="gift" size={20} color={modernColors.accent} />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.input}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder={t('liveChat.tapezUnMessage')}
                            placeholderTextColor="#9CA3AF"
                            multiline
                            onSubmitEditing={handleSendMessage}
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                            onPress={handleSendMessage}
                            disabled={!inputText.trim()}
                        >
                            <SafeIcon name="send" size={18} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </KeyboardAvoidingView>
    );
};

/**
 * Composant de sélection de stickers
 */
const StickerPicker: React.FC<{
    onSelect: (sticker: Sticker) => void;
    onClose: () => void;
}> = ({ onSelect, onClose }) => {
    const popularStickers = getPopularStickers();

    return (
        <View style={styles.stickerPickerContainer}>
            <View style={styles.stickerPickerHeader}>
                <Text style={styles.stickerPickerTitle}>Stickers</Text>
                <TouchableOpacity onPress={onClose}>
                    <SafeIcon name="x" size={18} color="#1F2937" />
                </TouchableOpacity>
            </View>
            <FlatList
                data={popularStickers}
                numColumns={4}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.stickerItem}
                        onPress={() => onSelect(item)}
                    >
                        <Text style={styles.stickerEmoji}>{item.emoji || item.name}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1F2937',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFF',
        marginTop: 16,
        fontSize: 14,
    },
    messagesList: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
    },
    messageItem: {
        marginBottom: 12,
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
    },
    messageIdentity: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    messageText: {
        color: '#FFF',
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '600',
    },
    emptySubtext: {
        color: '#4B5563',
        fontSize: 14,
        marginTop: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#111827',
        borderTopWidth: 1,
        borderTopColor: '#374151',
        gap: 8,
    },
    stickerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    giftButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#374151',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: '#FFF',
        fontSize: 14,
        maxHeight: 100,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    stickerPickerContainer: {
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        maxHeight: 200,
    },
    stickerPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    stickerPickerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    stickerItem: {
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stickerEmoji: {
        fontSize: 32,
    },
});


