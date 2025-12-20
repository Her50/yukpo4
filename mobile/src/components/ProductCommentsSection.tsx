import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { commentsApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';
import UserMentionPicker from './UserMentionPicker';

interface MentionCandidate {
    id: number;
    nom_complet: string;
    email: string;
    avatar_url?: string;
}

interface MentionUser {
    id: number;
    name: string;
    avatar_url?: string;
}

interface ProductComment {
    id: number;
    service_id: number;
    user_id: number;
    user_name: string;
    user_avatar?: string;
    parent_comment_id?: number | null;
    rating?: number | null;
    content: string;
    mentions: number[];
    mention_users: MentionUser[];
    reaction_counts: Record<string, number>;
    user_reactions: string[];
    created_at: string;
    updated_at: string;
    edited_at?: string | null;
    is_deleted: boolean;
    reply_count: number;
    can_edit: boolean;
    can_delete: boolean;
    replies: ProductComment[];
}

interface CommentStats {
    total_comments: number;
    rating_count: number;
    average_rating: number;
}

interface ProductCommentsSectionProps {
    serviceId: number;
    serviceTitle?: string;
    onOpenChat?: (userId: number, userName: string, userAvatar?: string | null) => void;
    mode?: 'inline' | 'full';
}

const REACTION_OPTIONS = [
    { type: 'like', label: "J'aime", emoji: '👍' },
    { type: 'love', label: "J'adore", emoji: '❤️' },
    { type: 'insightful', label: 'Pertinent', emoji: '💡' },
    { type: 'support', label: 'Soutien', emoji: '🤝' },
    { type: 'funny', label: 'Drôle', emoji: '😄' },
    { type: 'angry', label: "Pas d'accord", emoji: '😠' },
];

const formatDate = (iso: string): string => {
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

const parseMentions = (text: string): React.ReactNode[] => {
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
            <Text key={`text-${key++}`} style={styles.commentText}>
                {text.substring(lastIndex)}
            </Text>
        );
    }

    return parts;
};

const normalizeComments = (items: any[]): ProductComment[] =>
    (items || []).map((item) => ({
        id: item.id,
        service_id: item.service_id,
        user_id: item.user_id,
        user_name: item.user_name,
        user_avatar: item.user_avatar ?? undefined,
        parent_comment_id: item.parent_comment_id ?? null,
        rating: item.rating ?? null,
        content: item.content ?? '',
        mentions: item.mentions ?? [],
        mention_users: (item.mention_users || []).map((mention: any) => ({
            id: mention.id,
            name: mention.name,
            avatar_url: mention.avatar_url ?? undefined,
        })),
        reaction_counts: item.reaction_counts ?? {},
        user_reactions: item.user_reactions ?? [],
        created_at: item.created_at,
        updated_at: item.updated_at,
        edited_at: item.edited_at ?? null,
        is_deleted: Boolean(item.is_deleted),
        reply_count: item.reply_count ?? 0,
        can_edit: Boolean(item.can_edit),
        can_delete: Boolean(item.can_delete),
        replies: normalizeComments(item.replies || []),
    }));

const ProductCommentsSection: React.FC<ProductCommentsSectionProps> = ({
    serviceId,
    serviceTitle,
    onOpenChat,
    mode = 'inline',
}) => {
    const { user } = useAuth();
    const currentUserId = useMemo(() => {
        if (!user?.id) return undefined;
        const parsed = Number(user.id);
        return Number.isNaN(parsed) ? undefined : parsed;
    }, [user]);

    const [comments, setComments] = useState<ProductComment[]>([]);
    const [stats, setStats] = useState<CommentStats>({
        total_comments: 0,
        rating_count: 0,
        average_rating: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(mode === 'full');

    const [composerContent, setComposerContent] = useState('');
    const [composerRating, setComposerRating] = useState<number | null>(null);
    const [replyTarget, setReplyTarget] = useState<ProductComment | null>(null);
    const [editingTarget, setEditingTarget] = useState<ProductComment | null>(null);
    const [selectedMentions, setSelectedMentions] = useState<MentionCandidate[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // ✅ NOUVEAU: Liste d'émojis populaires pour le sélecteur
    const popularEmojis = [
        '😊', '😂', '❤️', '👍', '👎', '😍', '🤔', '😢', '😮', '🔥',
        '💯', '🎉', '👏', '🙏', '💪', '😎', '🤗', '😴', '🤩', '🥳',
        '😋', '😇', '🥰', '😘', '😃', '😄', '😁', '😆', '😅', '🤣',
        '☺️', '🙂', '🙃', '😉', '😌', '😏', '😒', '😞', '😔', '😟',
        '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😭', '😤',
        '😠', '😡', '🤯', '😳', '😱', '😨', '😰', '😥', '🤭', '🤫',
        '🤥', '😶', '😐', '😑', '🙄', '😯', '😦', '😧', '😲', '🤐',
    ];

    const isFullMode = mode === 'full' || modalVisible;

    const loadComments = useCallback(async () => {
        setError(null);
        if (!refreshing) setLoading(true);
        try {
            const response = await commentsApi.getProductComments(serviceId);
            if (response.success && response.data) {
                const payload: any = response.data;
                setComments(normalizeComments(payload.comments));
                setStats({
                    total_comments: payload.stats?.total_comments ?? payload.comments?.length ?? 0,
                    rating_count: payload.stats?.rating_count ?? 0,
                    average_rating: payload.stats?.average_rating ?? 0,
                });
            } else {
                setError(response.error || 'Impossible de charger les commentaires');
            }
        } catch (err) {
            console.error('[ProductCommentsSection] loadComments error', err);
            setError('Erreur lors du chargement des commentaires');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [serviceId, refreshing]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    const resetComposer = useCallback(() => {
        setComposerContent('');
        setComposerRating(null);
        setReplyTarget(null);
        setEditingTarget(null);
        setSelectedMentions([]);
        setMentionQuery('');
        setShowMentionPicker(false);
        setShowEmojiPicker(false);
    }, []);

    const handleSubmitComment = useCallback(async () => {
        if (!user?.token) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour commenter');
            return;
        }

        const trimmed = composerContent.trim();
        if (!trimmed) {
            Alert.alert('Champ requis', 'Veuillez saisir un commentaire');
            return;
        }

        if (!replyTarget && (composerRating === null || composerRating === undefined)) {
            Alert.alert('Note requise', 'Ajoutez une note (0-5) pour votre avis principal');
            return;
        }

        if (replyTarget && composerRating !== null) {
            setComposerRating(null);
        }

        setSubmitting(true);
        try {
            if (editingTarget) {
                const payload = {
                    content: trimmed,
                    rating: editingTarget.parent_comment_id ? undefined : composerRating,
                    mentions: selectedMentions.map((mention) => mention.id),
                };
                const response = await commentsApi.updateProductComment(editingTarget.id, payload);
                if (!response.success) {
                    Alert.alert('Erreur', response.error || 'Impossible de modifier le commentaire');
                } else {
                    await loadComments();
                    resetComposer();
                }
            } else {
                const payload = {
                    content: trimmed,
                    rating: replyTarget ? undefined : composerRating,
                    mentions: selectedMentions.map((mention) => mention.id),
                    parent_comment_id: replyTarget?.id,
                };
                const response = await commentsApi.createProductComment(serviceId, payload);
                if (!response.success) {
                    Alert.alert('Erreur', response.error || 'Impossible de publier le commentaire');
                } else {
                    await loadComments();
                    resetComposer();
                }
            }
        } catch (err) {
            console.error('[ProductCommentsSection] handleSubmitComment error', err);
            Alert.alert('Erreur', "Une erreur est survenue lors de l'envoi du commentaire");
        } finally {
            setSubmitting(false);
        }
    }, [
        composerContent,
        composerRating,
        loadComments,
        replyTarget,
        resetComposer,
        selectedMentions,
        serviceId,
        user?.token,
        editingTarget,
    ]);

    const handleDeleteComment = useCallback(
        async (comment: ProductComment) => {
            if (!user?.token) {
                Alert.alert('Connexion requise', 'Veuillez vous connecter pour effectuer cette action');
                return;
            }

            Alert.alert(
                'Supprimer le commentaire',
                'Êtes-vous sûr de vouloir supprimer ce commentaire ?',
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Supprimer',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const response = await commentsApi.deleteProductComment(comment.id);
                                if (!response.success) {
                                    Alert.alert('Erreur', response.error || 'Impossible de supprimer ce commentaire');
                                } else {
                                    await loadComments();
                                    if (editingTarget?.id === comment.id) {
                                        resetComposer();
                                    }
                                }
                            } catch (err) {
                                console.error('[ProductCommentsSection] handleDeleteComment error', err);
                                Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression');
                            }
                        },
                    },
                ]
            );
        },
        [loadComments, resetComposer, user?.token, editingTarget],
    );

    const handleToggleReaction = useCallback(
        async (comment: ProductComment, reactionType: string) => {
            if (!user?.token) {
                Alert.alert('Connexion requise', 'Veuillez vous connecter pour réagir à un commentaire');
                return;
            }
            try {
                const response = await commentsApi.toggleCommentReaction(comment.id, reactionType);
                if (!response.success) {
                    Alert.alert('Erreur', response.error || "Impossible d'enregistrer la réaction");
                } else {
                    await loadComments();
                }
            } catch (err) {
                console.error('[ProductCommentsSection] handleToggleReaction error', err);
                Alert.alert('Erreur', 'Une erreur est survenue lors de la réaction');
            }
        },
        [loadComments, user?.token],
    );

    const handleComposerChange = useCallback((text: string) => {
        setComposerContent(text);
        const lastAtIndex = text.lastIndexOf('@');
        if (lastAtIndex >= 0) {
            const textAfterAt = text.substring(lastAtIndex + 1);
            const spaceIndex = textAfterAt.indexOf(' ');
            if (spaceIndex === -1) {
                setMentionQuery(textAfterAt);
                setShowMentionPicker(true);
                setShowEmojiPicker(false); // Fermer le picker emoji quand on ouvre le picker mention
            } else {
                setShowMentionPicker(false);
            }
        } else {
            setShowMentionPicker(false);
        }
    }, []);

    // ✅ NOUVEAU: Fonction pour insérer un emoji dans le texte
    const handleEmojiClick = useCallback((emoji: string) => {
        setComposerContent(prev => prev + emoji);
        setShowEmojiPicker(false);
    }, []);

    const insertMention = useCallback(
        (userMention: MentionCandidate) => {
            const lastAtIndex = composerContent.lastIndexOf('@');
            if (lastAtIndex < 0) return;

            const beforeAt = composerContent.substring(0, lastAtIndex);
            const afterAt = composerContent.substring(lastAtIndex + 1);
            const spaceIndex = afterAt.indexOf(' ');
            const trailing = spaceIndex >= 0 ? afterAt.substring(spaceIndex) : ' ';

            const newContent = `${beforeAt}@${userMention.nom_complet}${trailing.startsWith(' ') ? trailing : ` ${trailing}`}`.trimEnd() + ' ';
            setComposerContent(newContent);

            setSelectedMentions((prev) => {
                if (prev.some((candidate) => candidate.id === userMention.id)) {
                    return prev;
                }
                return [...prev, userMention];
            });

            setMentionQuery('');
            setShowMentionPicker(false);
        },
        [composerContent],
    );

    const handleReply = useCallback(
        (comment: ProductComment) => {
            setReplyTarget(comment);
            setEditingTarget(null);
            setComposerRating(null);
            setComposerContent(`@${comment.user_name} `);
            setSelectedMentions([]);
            setTimeout(() => {
                setShowMentionPicker(false);
            }, 50);
            if (!modalVisible && mode === 'inline') {
                setModalVisible(true);
            }
        },
        [mode, modalVisible],
    );

    const handleEdit = useCallback((comment: ProductComment) => {
        if (comment.is_deleted) {
            Alert.alert('Impossible', 'Vous ne pouvez pas modifier un commentaire supprimé');
            return;
        }
        setEditingTarget(comment);
        setReplyTarget(null);
        setComposerContent(comment.content.replace('[Commentaire supprimé]', ''));
        setComposerRating(comment.parent_comment_id ? null : (comment.rating ?? null));
        setSelectedMentions(
            comment.mention_users.map((mention) => ({
                id: mention.id,
                nom_complet: mention.name,
                email: '',
                avatar_url: mention.avatar_url,
            })),
        );
        setShowMentionPicker(false);
        if (!modalVisible && mode === 'inline') {
            setModalVisible(true);
        }
    }, [mode, modalVisible]);

    const handleCancelComposer = useCallback(() => {
        resetComposer();
    }, [resetComposer]);

    const previewComments = useMemo(() => comments.slice(0, 2), [comments]);

    const renderCommentItem = useCallback(
        ({ item, depth }: { item: ProductComment; depth: number }) => (
            <View key={item.id} style={[styles.commentContainer, depth > 0 && { marginLeft: depth * 16 }]}>
                <View style={styles.commentHeader}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.commentAuthor}
                        onPress={() => onOpenChat?.(item.user_id, item.user_name, item.user_avatar)}
                    >
                        <View style={styles.avatarBubble}>
                            <Text style={styles.avatarInitials}>
                                {item.user_name ? item.user_name.charAt(0).toUpperCase() : '👤'}
                            </Text>
                        </View>
                        <View style={styles.authorInfo}>
                            <Text style={styles.authorName}>{item.user_name}</Text>
                            <Text style={styles.commentDate}>{formatDate(item.created_at)}</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.commentActions}>
                        {typeof item.rating === 'number' && !item.parent_comment_id && (
                            <View style={styles.ratingBadge}>
                                <Text style={styles.ratingEmoji}>⭐</Text>
                                <Text style={styles.ratingValue}>{item.rating.toFixed(0)}/5</Text>
                            </View>
                        )}
                        {item.can_edit && (
                            <TouchableOpacity
                                style={styles.actionIcon}
                                onPress={() => handleEdit(item)}
                            >
                                <SafeIcon name="edit-3" size={18} color={modernColors.primary} />
                            </TouchableOpacity>
                        )}
                        {item.can_delete && (
                            <TouchableOpacity
                                style={styles.actionIcon}
                                onPress={() => handleDeleteComment(item)}
                            >
                                <SafeIcon name="trash-2" size={18} color={modernColors.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.commentBody}>
                    {item.is_deleted ? (
                        <Text style={styles.deletedText}>Ce commentaire a été supprimé</Text>
                    ) : (
                        <Text style={styles.commentContent}>{parseMentions(item.content)}</Text>
                    )}

                    {item.mention_users.length > 0 && (
                        <View style={styles.mentionChips}>
                            {item.mention_users.map((mention) => (
                                <View key={`${item.id}-mention-${mention.id}`} style={styles.mentionChip}>
                                    <Text style={styles.mentionChipText}>@{mention.name}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.commentFooter}>
                    <View style={styles.reactionsRow}>
                        {REACTION_OPTIONS.map((reaction) => {
                            const count = item.reaction_counts[reaction.type] || 0;
                            const isActive = item.user_reactions.includes(reaction.type);
                            return (
                                <TouchableOpacity
                                    key={`${item.id}-${reaction.type}`}
                                    style={[
                                        styles.reactionButton,
                                        isActive && styles.reactionButtonActive,
                                    ]}
                                    onPress={() => handleToggleReaction(item, reaction.type)}
                                >
                                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                                    {count > 0 && (
                                        <Text style={styles.reactionCount}>{count}</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.commentFooterActions}>
                        <TouchableOpacity
                            style={styles.footerAction}
                            onPress={() => handleReply(item)}
                        >
                            <SafeIcon name="corner-up-right" size={16} color={modernColors.primary} />
                            <Text style={styles.footerActionText}>Répondre</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.footerAction}
                            onPress={() => onOpenChat?.(item.user_id, item.user_name, item.user_avatar)}
                            disabled={!onOpenChat}
                        >
                            <SafeIcon name="message-circle" size={16} color={modernColors.primary} />
                            <Text style={styles.footerActionText}>Chat</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {item.replies.length > 0 && (
                    <View style={styles.repliesContainer}>
                        {item.replies.map((reply) =>
                            renderCommentItem({ item: reply, depth: depth + 1 })
                        )}
                    </View>
                )}
            </View>
        ),
        [
            handleDeleteComment,
            handleEdit,
            handleReply,
            handleToggleReaction,
            onOpenChat,
        ],
    );

    // ✅ NOUVEAU: Fonction pour afficher le sélecteur d'émojis
    const renderEmojiPicker = useCallback(() => {
        if (!showEmojiPicker) return null;

        return (
            <View style={styles.emojiPickerContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.emojiPickerScroll}
                >
                    {popularEmojis.map((emoji, index) => (
                        <TouchableOpacity
                            key={`emoji-${index}`}
                            style={styles.emojiPickerButton}
                            onPress={() => handleEmojiClick(emoji)}
                        >
                            <Text style={styles.emojiPickerText}>{emoji}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    }, [showEmojiPicker, popularEmojis, handleEmojiClick]);

    const renderComposer = () => (
        <View style={styles.composerContainer}>
            {(replyTarget || editingTarget) && (
                <View style={styles.composerContext}>
                    <View style={styles.composerContextText}>
                        <SafeIcon name="info" size={16} color={modernColors.primary} />
                        <Text style={styles.composerContextLabel}>
                            {editingTarget
                                ? 'Modification du commentaire'
                                : `Réponse à ${replyTarget?.user_name}`}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handleCancelComposer}>
                        <SafeIcon name="x-circle" size={20} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>
            )}

            {!replyTarget && (
                <View style={styles.ratingSelector}>
                    {[1, 2, 3, 4, 5].map((value) => (
                        <TouchableOpacity
                            key={`rating-${value}`}
                            style={[
                                styles.ratingStar,
                                composerRating !== null && composerRating >= value && styles.ratingStarActive,
                            ]}
                            onPress={() => setComposerRating(value)}
                        >
                            <Text style={styles.ratingStarText}>
                                {composerRating !== null && composerRating >= value ? '⭐' : '☆'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* ✅ NOUVEAU: Sélecteur d'émojis */}
            {renderEmojiPicker()}

            <View style={styles.composerInputContainer}>
                <View style={styles.composerInputRow}>
                    <TextInput
                        value={composerContent}
                        onChangeText={handleComposerChange}
                        multiline
                        placeholder={
                            replyTarget
                                ? `Répondre à ${replyTarget.user_name}...`
                                : 'Partagez votre expérience...'
                        }
                        placeholderTextColor={modernColors.textSecondary}
                        style={styles.composerInput}
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={styles.emojiToggleButton}
                        onPress={() => {
                            setShowEmojiPicker(!showEmojiPicker);
                            setShowMentionPicker(false);
                        }}
                    >
                        <SafeIcon
                            name="smile"
                            size={22}
                            color={showEmojiPicker ? modernColors.primary : modernColors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {selectedMentions.length > 0 && (
                <View style={styles.selectedMentionsRow}>
                    {selectedMentions.map((mention) => (
                        <View key={`selected-${mention.id}`} style={styles.selectedMentionChip}>
                            <Text style={styles.selectedMentionText}>@{mention.nom_complet}</Text>
                            <TouchableOpacity
                                onPress={() =>
                                    setSelectedMentions((prev) =>
                                        prev.filter((candidate) => candidate.id != mention.id),
                                    )
                                }
                            >
                                <SafeIcon name="x" size={12} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.composerActions}>
                <NativeButton
                    title={editingTarget ? 'Mettre à jour' : 'Publier'}
                    onPress={handleSubmitComment}
                    disabled={submitting}
                />
            </View>
        </View>
    );

    const fullContent = (
        <View style={styles.fullContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.flexOne}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <LinearGradient
                    colors={['#EEF2FF', '#FFFFFF']}
                    style={styles.fullHeader}
                >
                    <View style={styles.fullHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitle}>
                                Commentaires & avis
                            </Text>
                            {serviceTitle ? (
                                <Text style={styles.sectionSubtitle}>{serviceTitle}</Text>
                            ) : null}
                        </View>
                        <View style={styles.statsCard}>
                            <Text style={styles.statsTitle}>⭐ {stats.average_rating.toFixed(1)}</Text>
                            <Text style={styles.statsSubtitle}>
                                {stats.rating_count} avis • {stats.total_comments} commentaires
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                <FlatList
                    data={comments}
                    keyExtractor={(item) => `comment-${item.id}`}
                    renderItem={({ item }) => renderCommentItem({ item, depth: 0 })}
                    contentContainerStyle={styles.commentsList}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadComments();
                            }}
                            tintColor={modernColors.primary}
                        />
                    }
                    ListEmptyComponent={
                        !loading && (
                            <View style={styles.emptyState}>
                                <SafeIcon name="message-circle" size={48} color={modernColors.textSecondary} />
                                <Text style={styles.emptyTitle}>Aucun commentaire pour l'instant</Text>
                                <Text style={styles.emptySubtitle}>
                                    Soyez le premier à partager votre expérience !
                                </Text>
                            </View>
                        )
                    }
                />

                <View style={styles.composerWrapper}>
                    {renderComposer()}
                </View>
            </KeyboardAvoidingView>
        </View>
    );

    if (mode === 'full') {
        return (
            <View style={styles.fullWrapper}>
                {loading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                    </View>
                ) : (
                    fullContent
                )}

                {showMentionPicker && (
                    <UserMentionPicker
                        visible={showMentionPicker}
                        onClose={() => setShowMentionPicker(false)}
                        onSelectUser={insertMention}
                        currentQuery={mentionQuery}
                    />
                )}
            </View>
        );
    }

    return (
        <View style={styles.sectionContainer}>
            <NativeCard style={styles.previewCard}>
                <LinearGradient
                    colors={['#EEF2FF', '#FFFFFF']}
                    style={styles.previewHeader}
                >
                    <View>
                        <Text style={styles.sectionTitle}>Commentaires clients</Text>
                        <Text style={styles.sectionSubtitle}>
                            {stats.total_comments} avis • {stats.average_rating.toFixed(1)}/5
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.viewAllButton}
                        onPress={() => setModalVisible(true)}
                    >
                        <SafeIcon name="message-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.viewAllText}>Ouvrir le fil</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {loading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="small" color={modernColors.primary} />
                    </View>
                ) : (
                    <>
                        {previewComments.length === 0 ? (
                            <View style={styles.emptyStatePreview}>
                                <SafeIcon name="message-circle" size={32} color={modernColors.textSecondary} />
                                <Text style={styles.emptyPreviewText}>
                                    Aucun commentaire pour l'instant. Lancez la discussion !
                                </Text>
                            </View>
                        ) : (
                            previewComments.map((comment) => (
                                <View key={`preview-${comment.id}`} style={styles.previewComment}>
                                    <Text style={styles.previewAuthor}>{comment.user_name}</Text>
                                    <Text style={styles.previewContent} numberOfLines={3}>
                                        {comment.content}
                                    </Text>
                                    <View style={styles.previewMeta}>
                                        <SafeIcon name="clock" size={12} color={modernColors.textSecondary} />
                                        <Text style={styles.previewDate}>{formatDate(comment.created_at)}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </>
                )}
            </NativeCard>

            <Modal
                visible={modalVisible}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Discussions & Avis</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>
                    {loading ? (
                        <View style={styles.loader}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                        </View>
                    ) : (
                        fullContent
                    )}
                </View>
                {showMentionPicker && (
                    <UserMentionPicker
                        visible={showMentionPicker}
                        onClose={() => setShowMentionPicker(false)}
                        onSelectUser={insertMention}
                        currentQuery={mentionQuery}
                    />
                )}
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    flexOne: { flex: 1 },
    sectionContainer: {
        marginTop: 16,
    },
    previewCard: {
        padding: 0,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 18,
        shadowColor: '#1E293B',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
    },
    previewHeader: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    viewAllButton: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 12,
        flexShrink: 0,
    },
    viewAllText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 13,
    },
    loader: {
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewComment: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: modernColors.border,
    },
    previewAuthor: {
        fontWeight: '600',
        fontSize: 14,
        color: modernColors.text,
    },
    previewContent: {
        fontSize: 13,
        color: modernColors.text,
        marginTop: 6,
        lineHeight: 18,
    },
    previewMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    previewDate: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    emptyStatePreview: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        alignItems: 'center',
        gap: 8,
    },
    emptyPreviewText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    fullWrapper: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    fullContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    fullHeader: {
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: modernColors.border,
    },
    fullHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statsCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: modernColors.border,
    },
    statsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    statsSubtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    commentsList: {
        padding: 20,
        paddingBottom: 140,
        gap: 16,
    },
    commentContainer: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    commentAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarBubble: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    authorInfo: {
        flexDirection: 'column',
        gap: 2,
    },
    authorName: {
        fontWeight: '600',
        fontSize: 14,
        color: modernColors.text,
    },
    commentDate: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionIcon: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7E6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
        gap: 4,
    },
    ratingEmoji: {
        fontSize: 12,
    },
    ratingValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#B45309',
    },
    commentBody: {
        gap: 8,
    },
    commentContent: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    commentText: {
        fontSize: 14,
        color: modernColors.text,
    },
    mentionText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    deletedText: {
        fontSize: 13,
        fontStyle: 'italic',
        color: modernColors.textSecondary,
    },
    mentionChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    mentionChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
    },
    mentionChipText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    commentFooter: {
        marginTop: 16,
        gap: 12,
    },
    reactionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    reactionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: '#FFFFFF',
    },
    reactionButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    reactionEmoji: {
        fontSize: 13,
    },
    reactionCount: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    commentFooterActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    footerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerActionText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    repliesContainer: {
        marginTop: 16,
        gap: 12,
    },
    composerWrapper: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: modernColors.border,
        padding: 20,
        backgroundColor: '#FFFFFF',
    },
    composerContainer: {
        gap: 12,
    },
    composerContext: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    composerContextText: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    composerContextLabel: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '600',
    },
    ratingSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    ratingStar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratingStarActive: {
        backgroundColor: '#FDE68A',
        borderColor: '#F59E0B',
    },
    ratingStarText: {
        fontSize: 16,
    },
    composerInputContainer: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
    },
    composerInputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    composerInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: modernColors.text,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    emojiToggleButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
        marginBottom: 8,
    },
    emojiPickerContainer: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 12,
        paddingVertical: 8,
        maxHeight: 120,
    },
    emojiPickerScroll: {
        paddingHorizontal: 8,
        gap: 4,
    },
    emojiPickerButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 2,
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiPickerText: {
        fontSize: 24,
    },
    selectedMentionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectedMentionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    selectedMentionText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    composerActions: {
        alignItems: 'flex-end',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    emptySubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    fullHeaderText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
});

export default ProductCommentsSection;
