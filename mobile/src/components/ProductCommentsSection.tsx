/**
 * ProductCommentsSection - Version reconstruite intégralement
 * Toutes fonctionnalités : commentaires, avis, réactions, mentions, audio, emojis
 */

import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { commentsApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';
import UserMentionPicker from './UserMentionPicker';
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    productIndex?: number; // ✅ NOUVEAU 2026-03-02: Filtrer les commentaires par produit spécifique
    serviceTitle?: string;
    onOpenChat?: (userId: number, userName: string, userAvatar?: string | null) => void;
    mode?: 'inline' | 'full';
    compact?: boolean; // ✅ NOUVEAU 2026-01-13: Mode compact pour réduire la taille
    displayLimit?: number; // ✅ FIX 2026-03-03: Limite d'affichage initiale des commentaires
}

const REACTION_OPTIONS = [
    { type: 'like', label: 'J\'aime', emoji: '👍' },
    { type: 'love', label: 'J\'adore', emoji: '❤️' },
    { type: 'insightful', label: 'Pertinent', emoji: '💡' },
    { type: 'support', label: 'Soutien', emoji: '🤝' },
    { type: 'funny', label: 'Drôle', emoji: '😄' },
    { type: 'angry', label: 'Pas d\'accord', emoji: '😠' },
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

// ✅ CORRIGÉ 2026-01-24: Fonction pour nettoyer le contenu du commentaire et supprimer le nom d'utilisateur en doublon
const cleanCommentContent = (content: string, userName: string): string => {
    if (!content || !userName) return content;

    const trimmedContent = content.trim();
    const userNameLower = userName.toLowerCase().trim();

    // Vérifier si le contenu commence par le nom de l'utilisateur suivi de ":" ou "@"
    const patterns = [
        new RegExp(`^${userNameLower}\\s*[:]\\s*`, 'i'), // "Nom Utilisateur: "
        new RegExp(`^@${userNameLower}\\s+`, 'i'), // "@Nom Utilisateur "
        new RegExp(`^${userNameLower}\\s+`, 'i'), // "Nom Utilisateur "
    ];

    let cleaned = trimmedContent;
    for (const pattern of patterns) {
        if (pattern.test(cleaned)) {
            cleaned = cleaned.replace(pattern, '').trim();
            break;
        }
    }

    return cleaned || trimmedContent; // Retourner le contenu original si le nettoyage le vide
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
    productIndex,
    serviceTitle,
    onOpenChat,
    mode = 'inline',
    compact = false,
    displayLimit = 10, // ✅ FIX 2026-03-03: Limite d'affichage par défaut
}) => {
    const { user } = useAuth();
    const currentUserId = useMemo(() => {
        if (!user?.id) return undefined;
        const parsed = Number(user.id);
        return Number.isNaN(parsed) ? undefined : parsed;
    }, [user]);

    const [comments, setComments] = useState<ProductComment[]>([]);

    const { t } = useLanguageSafe();    const [stats, setStats] = useState<CommentStats>({
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

    const [composerAudio, setComposerAudio] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // ✅ FIX 2026-03-03: Gestion de la limite d'affichage avec "Voir plus"
    const [displayedCount, setDisplayedCount] = useState(displayLimit);

    const isFullMode = mode === 'full' || modalVisible;

    const loadComments = useCallback(async () => {
        setError(null);
        if (!refreshing) setLoading(true);
        try {
            const response = await commentsApi.getProductComments(serviceId, { product_index: productIndex, limit: 50 });
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
    }, [serviceId, productIndex, refreshing]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    const convertFileToBase64 = async (uri: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('[ProductCommentsSection] Erreur conversion base64:', error);
            throw error;
        }
    };

    const startAudioRecording = useCallback(async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission requise', 'Permission microphone nécessaire');
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
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            } as Audio.RecordingOptions);

            setRecording(newRecording);
            setIsRecording(true);
            setRecordingDuration(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('[ProductCommentsSection] Erreur enregistrement audio:', error);
            Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement audio');
            setIsRecording(false);
        }
    }, []);

    const stopAudioRecording = useCallback(async () => {
        if (!recording) return;

        try {
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }

            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recording.getURI();
            if (uri) {
                const audioBase64 = await convertFileToBase64(uri);
                setComposerAudio(audioBase64);
            }
            setRecording(null);
            setRecordingDuration(0);
        } catch (error) {
            console.error('[ProductCommentsSection] Erreur arrêt audio:', error);
            setRecording(null);
            setIsRecording(false);
        }
    }, [recording]);

    const cancelAudioRecording = useCallback(async () => {
        if (recording) {
            try {
                await recording.stopAndUnloadAsync();
                // Note: deleteAsync n'existe plus dans les versions récentes d'expo-av
                if (typeof (recording as any).deleteAsync === 'function') {
                    await (recording as any).deleteAsync();
                }
            } catch (error) {
                console.error('[ProductCommentsSection] Erreur annulation audio:', error);
            }
        }
        setRecording(null);
        setIsRecording(false);
        setRecordingDuration(0);
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    }, [recording]);

    const insertEmoji = useCallback((emoji: string) => {
        setComposerContent(prev => prev + emoji);
        setShowEmojiPicker(false);
    }, []);

    const popularEmojis = ['😀', '😂', '❤️', '👍', '👎', '😊', '😍', '🤔', '😮', '😢', '😡', '🎉', '🔥', '💯', '✨', '🙏', '👏', '🎯', '💪', '🚀'];

    const resetComposer = useCallback(() => {
        setComposerContent('');
        setComposerRating(null);
        setReplyTarget(null);
        setEditingTarget(null);
        setSelectedMentions([]);
        setMentionQuery('');
        setShowMentionPicker(false);
        setComposerAudio(null);
        if (recording) {
            recording.stopAndUnloadAsync().catch(console.error);
        }
        setRecording(null);
        setIsRecording(false);
        setRecordingDuration(0);
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setShowEmojiPicker(false);
    }, [recording]);

    const handleSubmitComment = useCallback(async () => {
        if (!user?.token) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour commenter');
            return;
        }

        const trimmed = composerContent.trim();
        const hasAudio = !!composerAudio;

        if (!trimmed && !hasAudio && !replyTarget && (composerRating === null || composerRating === undefined)) {
            Alert.alert('Champ requis', 'Veuillez saisir un commentaire, enregistrer un audio ou sélectionner une note');
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
                // ✅ CORRIGÉ 2026-03-02: Envoyer content comme "" (string vide) au lieu de undefined
                // pour éviter que le champ soit absent du JSON (ce qui causait 422 côté backend)
                const payload: any = {
                    content: trimmed || '',
                    rating: replyTarget ? undefined : composerRating,
                    mentions: selectedMentions.map((mention) => mention.id),
                    parent_comment_id: replyTarget?.id,
                    product_index: productIndex ?? null,
                };
                console.log('[ProductCommentsSection] 📤 Envoi commentaire:', {
                    serviceId,
                    productIndex,
                    contentLength: payload.content.length,
                    hasRating: payload.rating !== undefined && payload.rating !== null,
                    rating: payload.rating,
                    hasMentions: payload.mentions?.length > 0,
                    isReply: !!payload.parent_comment_id,
                });
                const response = await commentsApi.createProductComment(serviceId, payload);
                if (!response.success) {
                    // ✅ CORRIGÉ 2026-03-02: Afficher plus de détails sur l'erreur
                    const status = (response as any).status;
                    const errorDetail = response.error || 'Erreur inconnue';
                    console.error('[ProductCommentsSection] ❌ Erreur création commentaire:', {
                        status,
                        error: errorDetail,
                        data: (response as any).data,
                    });
                    let userMessage = 'Impossible de publier le commentaire';
                    if (status === 422) {
                        userMessage = 'Le format du commentaire est invalide. Vérifiez que vous avez saisi un texte ou une note.';
                    } else if (status === 401) {
                        userMessage = 'Vous devez être connecté pour commenter.';
                    } else if (status === 400) {
                        userMessage = 'Veuillez saisir un commentaire ou sélectionner une note.';
                    } else if (status >= 500) {
                        userMessage = 'Erreur serveur. Réessayez dans quelques instants.';
                    } else if (errorDetail && errorDetail !== 'Erreur inconnue') {
                        userMessage = errorDetail;
                    }
                    Alert.alert('Erreur', userMessage);
                } else {
                    await loadComments();
                    resetComposer();
                }
            }
        } catch (err: any) {
            console.error('[ProductCommentsSection] handleSubmitComment error:', err?.message || err);
            Alert.alert('Erreur', `Une erreur est survenue lors de l'envoi du commentaire.\n\nDétail : ${err?.message || 'Erreur inconnue'}`);
        } finally {
            setSubmitting(false);
        }
    }, [
        composerContent,
        composerRating,
        composerAudio,
        loadComments,
        replyTarget,
        resetComposer,
        selectedMentions,
        serviceId,
        productIndex,
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
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('common.delete'),
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
                    Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer la réaction');
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
            } else {
                setShowMentionPicker(false);
            }
        } else {
            setShowMentionPicker(false);
        }
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

    // ✅ OPTIMISÉ 2026-01-13: Réduire le nombre de commentaires en mode compact
    const previewComments = useMemo(() => {
        if (compact) {
            return comments.slice(0, 1); // Un seul commentaire en mode compact
        }
        return comments.slice(0, 2); // Deux commentaires en mode normal
    }, [comments, compact]);

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
                        <Text style={styles.commentContent}>
                            {parseMentions(cleanCommentContent(item.content, item.user_name))}
                        </Text>
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

            {composerAudio && !isRecording && (
                <View style={styles.audioPreviewContainer}>
                    <SafeIcon name="mic" size={20} color={modernColors.primary} />
                    <Text style={styles.audioPreviewText}>
                        Audio enregistré ({Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')})
                    </Text>
                    <TouchableOpacity
                        onPress={() => {
                            setComposerAudio(null);
                            setRecordingDuration(0);
                        }}
                    >
                        <SafeIcon name="x" size={18} color={modernColors.error} />
                    </TouchableOpacity>
                </View>
            )}

            {isRecording && (
                <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>
                        Enregistrement... {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </Text>
                    <TouchableOpacity
                        style={styles.stopRecordingButton}
                        onPress={stopAudioRecording}
                    >
                        <Text style={styles.stopRecordingText}>Arrêter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.cancelRecordingButton}
                        onPress={cancelAudioRecording}
                    >
                        <SafeIcon name="x" size={18} color={modernColors.error} />
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.composerInputContainer}>
                <TextInput
                    value={composerContent}
                    onChangeText={handleComposerChange}
                    multiline
                    placeholder={
                        replyTarget
                            ? 'Tapez votre réponse...'
                            : 'Partagez votre expérience...'
                    }
                    placeholderTextColor={modernColors.textSecondary}
                    style={styles.composerInput}
                    maxLength={1000}
                />
                <View style={styles.composerInputActions}>
                    <TouchableOpacity
                        style={[styles.composerActionButton, isRecording && styles.composerActionButtonActive]}
                        onPress={isRecording ? stopAudioRecording : startAudioRecording}
                    >
                        <SafeIcon
                            name={isRecording ? "mic-off" : "mic"}
                            size={20}
                            color={isRecording ? modernColors.error : modernColors.primary}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.composerActionButton}
                        onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                        <Text style={styles.emojiButtonText}>😀</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={[
                            styles.composerSendButton,
                            (composerContent.trim() || composerAudio || (composerRating !== null && composerRating !== undefined))
                                ? styles.composerSendButtonActive
                                : undefined,
                        ]}
                        onPress={handleSubmitComment}
                        disabled={submitting}
                        activeOpacity={0.7}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <SafeIcon name="send" size={18} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {showEmojiPicker && (
                <View style={styles.emojiPickerContainer}>
                    <View style={styles.emojiPickerHeader}>
                        <Text style={styles.emojiPickerTitle}>Emojis</Text>
                        <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                            <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.emojiGrid}>
                        {popularEmojis.map((emoji, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.emojiButton}
                                onPress={() => insertEmoji(emoji)}
                            >
                                <Text style={styles.emojiText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

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
                    data={comments.slice(0, displayedCount)}
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
                    ListFooterComponent={
                        comments.length > displayedCount ? (
                            <TouchableOpacity
                                style={styles.loadMoreButton}
                                onPress={() => setDisplayedCount(prev => prev + displayLimit)}
                            >
                                <SafeIcon name="chevron-down" size={16} color={modernColors.primary} />
                                <Text style={styles.loadMoreText}>
                                    Voir plus ({comments.length - displayedCount} restant{comments.length - displayedCount > 1 ? 's' : ''})
                                </Text>
                            </TouchableOpacity>
                        ) : null
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
                                    <Text style={styles.previewContent} numberOfLines={compact ? 2 : 3}>
                                        {cleanCommentContent(comment.content, comment.user_name)}
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
        overflow: 'visible',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 18,
        shadowColor: '#1E293B',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
    },
    previewHeader: {
        paddingHorizontal: 12, // ✅ RÉDUIT 2026-01-13: 20 -> 12
        paddingVertical: 8, // ✅ RÉDUIT 2026-01-13: 16 -> 8
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 14, // ✅ RÉDUIT 2026-01-13: 18 -> 14
        fontWeight: '700',
        color: modernColors.text,
    },
    sectionSubtitle: {
        fontSize: 11, // ✅ RÉDUIT 2026-01-13: 13 -> 11
        color: modernColors.textSecondary,
        marginTop: 2, // ✅ RÉDUIT 2026-01-13: 4 -> 2
    },
    viewAllButton: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 12,
        flexShrink: 0,
        minWidth: 130,
        justifyContent: 'center',
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
        paddingHorizontal: 12, // ✅ RÉDUIT 2026-01-13: 20 -> 12
        paddingVertical: 8, // ✅ RÉDUIT 2026-01-13: 16 -> 8
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: modernColors.border,
    },
    previewAuthor: {
        fontWeight: '600',
        fontSize: 12, // ✅ RÉDUIT 2026-01-13: 14 -> 12
        color: modernColors.text,
    },
    previewContent: {
        fontSize: 11, // ✅ RÉDUIT 2026-01-13: 13 -> 11
        color: modernColors.text,
        marginTop: 4, // ✅ RÉDUIT 2026-01-13: 6 -> 4
        lineHeight: 16, // ✅ RÉDUIT 2026-01-13: 18 -> 16
    },
    previewMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4, // ✅ RÉDUIT 2026-01-13: 6 -> 4
        marginTop: 4, // ✅ RÉDUIT 2026-01-13: 8 -> 4
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
    composerInput: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: modernColors.text,
        minHeight: 80,
        textAlignVertical: 'top',
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
    audioPreviewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.primary,
        marginBottom: 8,
    },
    audioPreviewText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.error,
        marginBottom: 8,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: modernColors.error,
    },
    recordingText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.error,
        fontWeight: '600',
    },
    stopRecordingButton: {
        backgroundColor: modernColors.error,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    stopRecordingText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    cancelRecordingButton: {
        padding: 4,
    },
    composerInputActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    composerActionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    composerActionButtonActive: {
        backgroundColor: '#FEE2E2',
        borderColor: modernColors.error,
    },
    composerSendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    composerSendButtonActive: {
        backgroundColor: modernColors.primary,
    },
    emojiButtonText: {
        fontSize: 20,
    },
    emojiPickerContainer: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        padding: 12,
        marginTop: 8,
        maxHeight: 200,
    },
    emojiPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    emojiPickerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    emojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    emojiButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiText: {
        fontSize: 24,
    },
    // ✅ FIX 2026-03-03: Style pour le bouton "Voir plus"
    loadMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 10,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    loadMoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default ProductCommentsSection;
