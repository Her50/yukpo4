import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { commentsApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import UserMentionPicker from './UserMentionPicker';

interface MentionUser {
    id: number;
    nom_complet: string;
    avatar_url?: string;
}

interface ProductComment {
    id: number;
    user_id: number;
    user_name: string;
    user_avatar?: string;
    content: string;
    mentions: number[];
    mention_users: { id: number; name: string }[];
    created_at: string;
}

interface VideoCommentsModalProps {
    visible: boolean;
    onClose: () => void;
    serviceId: number;
    serviceTitle?: string;
}

const formatTimestamp = (iso: string): string => {
    try {
        const date = new Date(iso);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
};

const renderCommentContent = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /@([A-Za-zÀ-ÿ0-9_\-\s]+?)(?=\s|$|[.,!?])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(
                <Text key={`text-${key++}`} style={styles.commentText}>
                    {text.substring(lastIndex, match.index)}
                </Text>
            );
        }

        parts.push(
            <Text key={`mention-${key++}`} style={styles.mentionText}>
                @{match[1]}
            </Text>
        );

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push(
            <Text key={`tail-${key++}`} style={styles.commentText}>
                {text.substring(lastIndex)}
            </Text>
        );
    }

    return parts;
};

const VideoCommentsModal: React.FC<VideoCommentsModalProps> = ({
    visible,
    onClose,
    serviceId,
    serviceTitle,
}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [comments, setComments] = useState<ProductComment[]>([]);
    const [input, setInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mentionPickerVisible, setMentionPickerVisible] = useState(false);
    const [selectedMentions, setSelectedMentions] = useState<MentionUser[]>([]);

    const fetchComments = useCallback(async () => {
        try {
            setLoading(true);
            const response = await commentsApi.getProductComments(serviceId);
            if (response.success && Array.isArray(response.data)) {
                setComments(response.data as ProductComment[]);
            } else {
                setComments([]);
            }
        } catch (error) {
            console.error('[VideoCommentsModal] fetchComments error', error);
            setComments([]);
        } finally {
            setLoading(false);
        }
    }, [serviceId]);

    useEffect(() => {
        if (visible) {
            fetchComments().catch(() => undefined);
        }
    }, [visible, fetchComments]);

    const handleSelectMention = useCallback((user: any) => {
        const alreadySelected = selectedMentions.some((mention) => mention.id === user.id);
        if (!alreadySelected) {
            setSelectedMentions((prev) => [...prev, user]);
        }
        setInput((prev) => `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}@${user.nom_complet} `);
    }, [selectedMentions]);

    const handleSend = useCallback(async () => {
        if (!input.trim()) {
            return;
        }
        if (!user?.id) {
            return;
        }

        setIsSubmitting(true);
        try {
            const mentions = selectedMentions.map((mention) => mention.id);
            const response = await commentsApi.createProductComment(serviceId, {
                content: input.trim(),
                mentions,
            });
            if (response.success) {
                setInput('');
                setSelectedMentions([]);
                await fetchComments();
            }
        } catch (error) {
            console.error('[VideoCommentsModal] createComment error', error);
        } finally {
            setIsSubmitting(false);
        }
    }, [fetchComments, input, selectedMentions, serviceId, user?.id]);

    const mentionPreview = useMemo(() => {
        if (selectedMentions.length === 0) {
            return null;
        }
        return (
            <View style={styles.mentionPreview}>
                {selectedMentions.map((mention) => (
                    <View key={mention.id} style={styles.mentionChip}>
                        <Text style={styles.mentionChipText}>@{mention.nom_complet}</Text>
                        <TouchableOpacity
                            style={styles.mentionChipClose}
                            onPress={() =>
                                setSelectedMentions((prev) =>
                                    prev.filter((entry) => entry.id !== mention.id),
                                )
                            }
                        >
                            <SafeIcon name="x" size={12} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        );
    }, [selectedMentions]);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
            <View style={styles.modalOverlay}>
                <KeyboardAvoidingView
                    style={styles.modalContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={20} color="#0F172A" />
                        </TouchableOpacity>
                        <View style={styles.headerTitle}>
                            <Text style={styles.modalTitle}>Commentaires</Text>
                            {!!serviceTitle && (
                                <Text style={styles.modalSubtitle}>{serviceTitle}</Text>
                            )}
                        </View>
                        <View style={{ width: 36 }} />
                    </View>

                    {mentionPreview}

                    {loading ? (
                        <View style={styles.loader}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={comments}
                            keyExtractor={(item) => String(item.id)}
                            contentContainerStyle={styles.commentsList}
                            renderItem={({ item }) => (
                                <View style={styles.commentCard}>
                                    <View style={styles.commentHeader}>
                                        <Text style={styles.commentAuthor}>{item.user_name}</Text>
                                        <Text style={styles.commentDate}>
                                            {formatTimestamp(item.created_at)}
                                        </Text>
                                    </View>
                                    <Text style={styles.commentBody}>
                                        {renderCommentContent(item.content)}
                                    </Text>
                                </View>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <SafeIcon name="message-circle" size={32} color="#CBD5F5" />
                                    <Text style={styles.emptyTitle}>Aucun commentaire</Text>
                                    <Text style={styles.emptySubtitle}>
                                        Soyez le premier à lancer la discussion sur cette vidéo.
                                    </Text>
                                </View>
                            }
                        />
                    )}

                    <View style={styles.inputContainer}>
                        <TouchableOpacity
                            style={styles.mentionButton}
                            onPress={() => setMentionPickerVisible(true)}
                        >
                            <SafeIcon name="at-sign" size={18} color={modernColors.primary} />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.input}
                            value={input}
                            onChangeText={setInput}
                            placeholder="Écrire un commentaire..."
                            placeholderTextColor="#94A3B8"
                            multiline
                        />
                        <TouchableOpacity
                            style={styles.sendButton}
                            onPress={handleSend}
                            disabled={isSubmitting || !input.trim()}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <SafeIcon name="send" size={16} color="#FFF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>

                <UserMentionPicker
                    visible={mentionPickerVisible}
                    onClose={() => setMentionPickerVisible(false)}
                    onSelectUser={(user) => {
                        handleSelectMention({
                            id: user.id,
                            nom_complet: user.nom_complet,
                            avatar_url: user.avatar_url,
                        });
                        setMentionPickerVisible(false);
                    }}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: '92%',
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
    },
    headerTitle: {
        flex: 1,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    modalSubtitle: {
        marginTop: 4,
        fontSize: 12,
        color: '#6B7280',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    commentsList: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    commentCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    commentAuthor: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    commentDate: {
        fontSize: 12,
        color: '#94A3B8',
    },
    commentBody: {
        fontSize: 14,
        color: '#1F2937',
        lineHeight: 20,
    },
    commentText: {
        color: '#1F2937',
    },
    mentionText: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 48,
        paddingHorizontal: 24,
    },
    emptyTitle: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    emptySubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 12,
        gap: 12,
    },
    mentionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(79, 70, 229, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        maxHeight: 120,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: '#EEF2FF',
        fontSize: 14,
        color: '#0F172A',
        textAlignVertical: 'top',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
    },
    mentionPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 20,
    },
    mentionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(79, 70, 229, 0.12)',
        borderRadius: 16,
    },
    mentionChipText: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    mentionChipClose: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default VideoCommentsModal;

