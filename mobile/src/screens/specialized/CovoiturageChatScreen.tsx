import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { covoiturageService, CovoiturageMessage } from '../../services/covoiturageService';

type RouteParams = {
    covoiturageId: number;
    conducteurId: number;
    conducteurName: string;
    trajetDepart?: string;
    trajetDestination?: string;
};

export default function CovoiturageChatScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const {
        covoiturageId,
        conducteurId,
        conducteurName,
        trajetDepart,
        trajetDestination,
    } = (route.params as RouteParams) || {};

    const [messages, setMessages] = useState<CovoiturageMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadMessages = useCallback(async () => {
        try {
            const res = await covoiturageService.getMessages(covoiturageId);
            if (res?.data) {
                setMessages(res.data);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [covoiturageId]);

    useEffect(() => {
        loadMessages();
        intervalRef.current = setInterval(loadMessages, 5000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loadMessages]);

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;
        setSending(true);
        try {
            await covoiturageService.sendMessage(covoiturageId, newMessage.trim());
            setNewMessage('');
            await loadMessages();
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch {
            // silent
        } finally {
            setSending(false);
        }
    };

    const currentUserId = user?.id ? (typeof user.id === 'string' ? parseInt(user.id, 10) : user.id) : 0;

    const renderMessage = ({ item }: { item: CovoiturageMessage }) => {
        const isOwn = item.sender_id === currentUserId;
        return (
            <View style={[styles.msgRow, isOwn ? styles.msgRowRight : styles.msgRowLeft]}>
                <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                    {!isOwn && (
                        <Text style={styles.senderName}>{item.sender_name || conducteurName}</Text>
                    )}
                    <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>{item.message}</Text>
                    <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{conducteurName || 'Conducteur'}</Text>
                    {trajetDepart && trajetDestination && (
                        <Text style={styles.headerSubtitle} numberOfLines={1}>
                            {trajetDepart} → {trajetDestination}
                        </Text>
                    )}
                </View>
            </View>

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>Aucun message. Démarrez la conversation !</Text>
                            </View>
                        }
                    />
                )}

                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        placeholder="Écrire un message..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
                        onPress={handleSend}
                        disabled={!newMessage.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <SafeIcon name="send" size={20} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backBtn: { marginRight: 12, padding: 4 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    messagesList: { padding: 16, paddingBottom: 8 },
    msgRow: { marginBottom: 12, maxWidth: '80%' },
    msgRowRight: { alignSelf: 'flex-end' },
    msgRowLeft: { alignSelf: 'flex-start' },
    bubble: {
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    bubbleOwn: { backgroundColor: modernColors.primary, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: '#E5E7EB', borderBottomLeftRadius: 4 },
    senderName: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
    msgText: { fontSize: 15, color: '#111827' },
    msgTextOwn: { color: '#fff' },
    msgTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },
    msgTimeOwn: { color: 'rgba(255,255,255,0.7)' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyText: { color: '#9CA3AF', fontSize: 15 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: '#111827',
        maxHeight: 120,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
});
