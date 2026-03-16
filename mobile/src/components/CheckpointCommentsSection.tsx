/**
 * CheckpointCommentsSection - Commentaires sur les alertes/checkpoints de navigation
 * Composant léger inline : affiche les commentaires et permet d'en ajouter
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface CheckpointComment {
    id: number;
    content: string;
    user_id: number;
    user_name: string;
    user_avatar?: string;
    created_at: string;
}

interface Props {
    checkpointId: string;
    visible: boolean;
}

const CheckpointCommentsSection: React.FC<Props> = ({ checkpointId, visible }) => {
    const { user } = useAuth();
        const { t } = useLanguageSafe();
const [comments, setComments] = useState<CheckpointComment[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [content, setContent] = useState('');

    const loadComments = useCallback(async () => {
        if (!checkpointId) return;
        setLoading(true);
        try {
            const res = await apiGet(`/api/navigation/checkpoints/${checkpointId}/comments?limit=30`) as any;
            const data = res?.data as any;
            const arr = Array.isArray(data?.comments) ? data.comments
                : Array.isArray(data?.data?.comments) ? data.data.comments
                : [];
            setComments(arr);
            setTotal(data?.total ?? data?.data?.total ?? arr.length);
        } catch (e: any) {
            console.warn('[CheckpointComments] loadComments error:', e?.message || e);
        } finally {
            setLoading(false);
        }
    }, [checkpointId]);

    useEffect(() => {
        if (visible && checkpointId) {
            loadComments();
        }
    }, [visible, checkpointId, loadComments]);

    const handleSubmit = useCallback(async () => {
        const trimmed = content.trim();
        if (!trimmed) return;
        if (!user?.token) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour commenter');
            return;
        }
        setSubmitting(true);
        try {
            const res = await apiPost(`/api/navigation/checkpoints/${checkpointId}/comments`, { content: trimmed }) as any;
            const data = res?.data as any;
            const newComment = data?.comment ?? data?.data?.comment;
            if (newComment) {
                setComments(prev => [newComment, ...prev]);
                setTotal(prev => prev + 1);
            }
            setContent('');
        } catch (e: any) {
            console.error('[CheckpointComments] submit error:', e?.message || e);
            Alert.alert('Erreur', 'Impossible d\'envoyer le commentaire');
        } finally {
            setSubmitting(false);
        }
    }, [content, checkpointId, user]);

    const formatTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        if (diff < 60000) return 'à l\'instant';
        if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`;
        return `il y a ${Math.floor(diff / 86400000)}j`;
    };

    if (!visible) return null;

    const renderComment = ({ item }: { item: CheckpointComment }) => (
        <View style={styles.commentItem}>
            <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>
                    {(item.user_name || 'U').charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.commentBody}>
                <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor} numberOfLines={1}>{item.user_name}</Text>
                    <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
                </View>
                <Text style={styles.commentContent}>{item.content}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="message-circle" size={14} color={modernColors.primary} />
                <Text style={styles.headerText}>
                    {total > 0 ? `${total} commentaire${total > 1 ? 's' : ''}` : 'Commentaires'}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator size="small" color={modernColors.primary} style={{ padding: 12 }} />
            ) : comments.length === 0 ? (
                <Text style={styles.emptyText}>{t('checkpointCommentsSection.aucunCommentaireSoyezLePremier')}</Text>
            ) : (
                <FlatList
                    data={comments}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderComment}
                    scrollEnabled={false}
                    style={styles.list}
                />
            )}

            <View style={styles.inputRow}>
                <TextInput
                    value={content}
                    onChangeText={setContent}
                    placeholder={t('checkpointCommentsSection.ajouterUnCommentaire')}
                    placeholderTextColor={modernColors.textSecondary}
                    style={styles.input}
                    maxLength={500}
                    multiline
                />
                <TouchableOpacity
                    style={[styles.sendButton, content.trim() ? styles.sendButtonActive : undefined]}
                    onPress={handleSubmit}
                    disabled={submitting || !content.trim()}
                    activeOpacity={0.7}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <SafeIcon name="send" size={16} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerText: {
        fontSize: 12,
        fontWeight: '700',
        color: modernColors.primary,
    },
    emptyText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        padding: 12,
        fontStyle: 'italic',
    },
    list: {
        maxHeight: 200,
    },
    commentItem: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
    },
    commentAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentAvatarText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    commentBody: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    commentAuthor: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textPrimary,
        flex: 1,
    },
    commentTime: {
        fontSize: 10,
        color: modernColors.textSecondary,
        marginLeft: 8,
    },
    commentContent: {
        fontSize: 13,
        color: modernColors.textPrimary,
        lineHeight: 18,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    input: {
        flex: 1,
        fontSize: 13,
        color: modernColors.textPrimary,
        backgroundColor: '#F3F4F6',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 8,
        maxHeight: 80,
    },
    sendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonActive: {
        backgroundColor: modernColors.primary,
    },
});

export default CheckpointCommentsSection;
