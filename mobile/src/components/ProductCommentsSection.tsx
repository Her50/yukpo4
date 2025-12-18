import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
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
import { ENVIRONMENT } from '../config/environment';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { commentsApi } from '../services/api';
import { mediaService } from '../services/mediaService';
import { modernColors } from '../theme/modernTheme';
import { triggerHaptic } from '../utils/hapticFeedback';
import { NativeButton, NativeCard } from './SafeNativeDesign';
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
    // ✅ NOUVEAU: Champs pour améliorations UX
    media_urls?: string[];
    is_verified_purchase?: boolean;
    is_regular_customer?: boolean;
    helpful_count?: number;
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

// ✅ NOUVEAU: Types pour filtres et tri
type SortOption = 'recent' | 'helpful' | 'oldest' | 'highest_rating' | 'lowest_rating';
type FilterOption = 'all' | 'with_media' | 'verified_only' | '5_stars' | '4_stars' | '3_stars' | '2_stars' | '1_star';

const REACTION_OPTIONS = [
    { type: 'like', label: 'J’aime', emoji: '👍' },
    { type: 'love', label: 'J’adore', emoji: '❤️' },
    { type: 'insightful', label: 'Pertinent', emoji: '💡' },
    { type: 'support', label: 'Soutien', emoji: '🤝' },
    { type: 'funny', label: 'Drôle', emoji: '😄' },
    { type: 'angry', label: 'Pas d’accord', emoji: '😠' },
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

// ✅ FONCTION UTILITAIRE : Nettoyer le nom utilisateur pour éviter les doublons
const cleanUserName = (name: string | undefined | null): string => {
    if (!name) return 'Utilisateur';
    const trimmed = name.trim();

    // ✅ CORRECTION : Détecter et supprimer les doublons (ex: "LELE Hernandez LELE Hernandez" -> "LELE Hernandez")
    // Méthode 1: Vérifier si le nom est répété exactement (mots séparés par espace)
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
        const midPoint = Math.ceil(words.length / 2);
        const firstHalf = words.slice(0, midPoint).join(' ');
        const secondHalf = words.slice(midPoint).join(' ');

        // Si les deux moitiés sont identiques, retourner seulement la première
        if (firstHalf === secondHalf) {
            return firstHalf;
        }

        // Méthode 2: Vérifier si le nom complet est répété (ex: "LELE Hernandez LELE Hernandez")
        // Diviser en deux parties égales et comparer
        const fullLength = trimmed.length;
        if (fullLength % 2 === 0) {
            const firstPart = trimmed.substring(0, fullLength / 2).trim();
            const secondPart = trimmed.substring(fullLength / 2).trim();
            if (firstPart === secondPart) {
                return firstPart;
            }
        }
    }

    // Méthode 3: Détecter les patterns répétitifs (ex: "Nom Nom" ou "Nom Nom Nom")
    // Si le nom contient le même mot plusieurs fois consécutivement, ne garder qu'une occurrence
    const uniqueWords: string[] = [];
    let lastWord = '';
    for (const word of words) {
        if (word !== lastWord) {
            uniqueWords.push(word);
            lastWord = word;
        }
    }

    // Si on a réduit le nombre de mots, c'est qu'il y avait des répétitions
    if (uniqueWords.length < words.length && uniqueWords.length > 0) {
        return uniqueWords.join(' ');
    }

    return trimmed;
};

const normalizeComments = (items: any[]): ProductComment[] =>
    (items || []).map((item) => ({
        id: item.id,
        service_id: item.service_id,
        user_id: item.user_id,
        user_name: cleanUserName(item.user_name), // ✅ CORRECTION : Nettoyer le nom pour éviter les doublons
        user_avatar: item.user_avatar ?? undefined,
        parent_comment_id: item.parent_comment_id ?? null,
        rating: item.rating ?? null,
        content: item.content ?? '',
        mentions: item.mentions ?? [],
        mention_users: (item.mention_users || []).map((mention: any) => ({
            id: mention.id,
            name: cleanUserName(mention.name), // ✅ CORRECTION : Nettoyer aussi les noms dans les mentions
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

// ✅ FINALISÉ: Fonction pour obtenir les couleurs selon le mode
const getColors = (isDark: boolean) => ({
    background: isDark ? '#0F172A' : '#FFFFFF',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    surfaceVariant: isDark ? '#334155' : '#F1F5F9',
    text: isDark ? '#F1F5F9' : '#1E293B',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    textTertiary: isDark ? '#64748B' : '#94A3B8',
    border: isDark ? '#334155' : '#E2E8F0',
    borderLight: isDark ? '#1E293B' : '#F1F5F9',
    card: isDark ? '#1E293B' : '#FFFFFF',
    headerGradient: isDark ? ['#1E293B', '#0F172A'] : ['#EEF2FF', '#FFFFFF'],
    previewGradient: isDark ? ['#1E293B', '#0F172A'] : ['#EEF2FF', '#FFFFFF'],
});

const ProductCommentsSection: React.FC<ProductCommentsSectionProps> = ({
    serviceId,
    serviceTitle,
    onOpenChat,
    mode = 'inline',
}) => {
    const { user } = useAuth();
    const theme = useTheme();
    const isDarkMode = theme.isDark;
    const colors = useMemo(() => getColors(isDarkMode), [isDarkMode]);
    const currentUserId = useMemo(() => {
        if (!user?.id) return undefined;
        const parsed = Number(user.id);
        return Number.isNaN(parsed) ? undefined : parsed;
    }, [user]);

    // ✅ NOUVEAU 2025-12-03: Initialiser mediaService pour CDN avec fallback
    useEffect(() => {
        mediaService.initialize(ENVIRONMENT.API_URL).catch(() => {
            // Ignorer erreurs d'initialisation
        });
    }, []);

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
    // ✅ NOUVEAU: États pour pagination infinie
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    // ✅ NOUVEAU: États pour médias
    const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
    const [showMediaPicker, setShowMediaPicker] = useState(false);
    // ✅ NOUVEAU: États pour suggestions
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    // ✅ NOUVEAU: États pour gamification
    const [userPoints, setUserPoints] = useState(0);
    const [userRank, setUserRank] = useState<string>('Débutant');

    const [composerContent, setComposerContent] = useState('');
    const [composerRating, setComposerRating] = useState<number | null>(null);
    const [replyTarget, setReplyTarget] = useState<ProductComment | null>(null);
    const [editingTarget, setEditingTarget] = useState<ProductComment | null>(null);
    const [selectedMentions, setSelectedMentions] = useState<MentionCandidate[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    // ✅ NOUVEAU: État pour vérifier si l'utilisateur a déjà donné un avis
    const [userHasRated, setUserHasRated] = useState(false);
    // ✅ NOUVEAU: États pour filtres et tri
    const [sortOption, setSortOption] = useState<SortOption>('recent');
    const [filterOption, setFilterOption] = useState<FilterOption>('all');
    const [showFilters, setShowFilters] = useState(false);
    // ✅ NOUVEAU: Animations
    const reactionAnimations = useRef<Record<number, Animated.Value>>({});
    const cardAnimations = useRef<Record<number, Animated.Value>>({});

    const isFullMode = mode === 'full' || modalVisible;

    const loadComments = useCallback(async (reset: boolean = false) => {
        setError(null);
        if (reset) {
            setNextCursor(null);
            setHasMore(true);
            setLoading(true);
        } else if (!refreshing) {
            setLoading(true);
        }
        try {
            const params: any = {
                limit: 50,
                sort: sortOption,
            };
            if (!reset && nextCursor) {
                params.cursor = nextCursor;
            }

            const response = await commentsApi.getProductComments(serviceId, params);
            if (response.success && response.data) {
                const payload: any = response.data;
                const normalizedComments = normalizeComments(payload.comments);

                if (reset) {
                    setComments(normalizedComments);
                } else {
                    setComments(prev => [...prev, ...normalizedComments]);
                }

                setStats({
                    total_comments: payload.stats?.total_comments ?? payload.comments?.length ?? 0,
                    rating_count: payload.stats?.rating_count ?? 0,
                    average_rating: payload.stats?.average_rating ?? 0,
                });

                // ✅ FINALISÉ: Gestion du cursor pour pagination
                setNextCursor(payload.next_cursor ?? null);
                setHasMore(payload.has_more ?? false);

                // ✅ NOUVEAU: Vérifier si l'utilisateur a déjà donné un avis (rating non null)
                if (currentUserId) {
                    const userHasRating = normalizedComments.some(
                        (comment) => comment.user_id === currentUserId && comment.rating !== null && comment.rating !== undefined
                    );
                    setUserHasRated(userHasRating);
                }
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
    }, [serviceId, refreshing, currentUserId, sortOption, nextCursor]);

    // ✅ FINALISÉ: Fonction pour charger plus de commentaires
    const loadMoreComments = useCallback(async () => {
        if (loadingMore || !hasMore || loading) return;

        setLoadingMore(true);
        try {
            await loadComments(false);
        } catch (err) {
            console.error('[ProductCommentsSection] loadMoreComments error', err);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, loading, loadComments]);

    useEffect(() => {
        loadComments(true); // Reset au chargement initial
    }, [serviceId, sortOption, filterOption]);

    // ✅ FINALISÉ: Recharger quand les filtres changent
    useEffect(() => {
        if (comments.length > 0) {
            loadComments(true);
        }
    }, [sortOption, filterOption]);

    const resetComposer = useCallback(() => {
        setComposerContent('');
        setComposerRating(null);
        setReplyTarget(null);
        setEditingTarget(null);
        setSelectedMentions([]);
        setMentionQuery('');
        setShowMentionPicker(false);
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

        // ✅ CORRIGÉ: Exiger un rating seulement si c'est le premier avis de l'utilisateur
        if (!replyTarget && !userHasRated && (composerRating === null || composerRating === undefined)) {
            Alert.alert('Note requise', 'Ajoutez une note (0-5) pour votre premier avis');
            return;
        }

        if (replyTarget && composerRating !== null) {
            setComposerRating(null);
        }

        // ✅ FINALISÉ 100%: Optimistic update - Sauvegarder l'état actuel pour rollback
        const previousComments = [...comments];
        const previousStats = { ...stats };
        const previousUserHasRated = userHasRated;

        // ✅ FINALISÉ 100%: Créer le commentaire optimiste
        const optimisticComment: ProductComment = {
            id: Date.now(), // ID temporaire
            service_id: serviceId,
            user_id: currentUserId || 0,
            user_name: user?.name || 'Vous',
            user_avatar: user?.photo,
            parent_comment_id: replyTarget?.id || null,
            rating: replyTarget ? null : composerRating,
            content: trimmed,
            mentions: selectedMentions.map(m => m.id),
            mention_users: selectedMentions.map(m => ({
                id: m.id,
                name: m.nom_complet,
                avatar_url: m.avatar_url,
            })),
            reaction_counts: {},
            user_reactions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            edited_at: null,
            is_deleted: false,
            reply_count: 0,
            can_edit: true,
            can_delete: true,
            replies: [],
        };

        // ✅ FINALISÉ 100%: Mettre à jour l'UI immédiatement (optimistic)
        if (editingTarget) {
            setComments(prev => prev.map(c =>
                c.id === editingTarget.id
                    ? { ...c, content: trimmed, rating: editingTarget.parent_comment_id ? c.rating : composerRating }
                    : c
            ));
        } else {
            setComments(prev => {
                if (replyTarget) {
                    // Ajouter comme réponse
                    return prev.map(c =>
                        c.id === replyTarget.id
                            ? { ...c, replies: [...(c.replies || []), optimisticComment], reply_count: (c.reply_count || 0) + 1 }
                            : c
                    );
                } else {
                    // Ajouter comme nouveau commentaire racine
                    return [optimisticComment, ...prev];
                }
            });

            // ✅ FINALISÉ 100%: Mettre à jour les stats optimistiquement
            setStats(prev => ({
                total_comments: prev.total_comments + 1,
                rating_count: composerRating ? prev.rating_count + 1 : prev.rating_count,
                average_rating: composerRating
                    ? ((prev.average_rating * prev.rating_count + composerRating) / (prev.rating_count + 1))
                    : prev.average_rating,
            }));

            if (composerRating !== null && composerRating !== undefined) {
                setUserHasRated(true);
            }
        }

        triggerHaptic('success');
        resetComposer();
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
                    // ✅ FINALISÉ 100%: Rollback en cas d'erreur
                    setComments(previousComments);
                    setStats(previousStats);
                    setUserHasRated(previousUserHasRated);
                    Alert.alert('Erreur', response.error || 'Impossible de modifier le commentaire');
                    triggerHaptic('error');
                } else {
                    // ✅ FINALISÉ 100%: Recharger pour avoir les vraies données
                    await loadComments(true);
                    triggerHaptic('success');
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
                    // ✅ FINALISÉ 100%: Rollback en cas d'erreur
                    setComments(previousComments);
                    setStats(previousStats);
                    setUserHasRated(previousUserHasRated);
                    Alert.alert('Erreur', response.error || 'Impossible de publier le commentaire');
                    triggerHaptic('error');
                } else {
                    // ✅ FINALISÉ 100%: Recharger pour avoir les vraies données
                    await loadComments(true);
                    triggerHaptic('success');
                }
            }
        } catch (err) {
            console.error('[ProductCommentsSection] handleSubmitComment error', err);
            // ✅ FINALISÉ 100%: Rollback en cas d'exception
            setComments(previousComments);
            setStats(previousStats);
            setUserHasRated(previousUserHasRated);
            Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi du commentaire');
            triggerHaptic('error');
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
        comments,
        stats,
        userHasRated,
        currentUserId,
        user,
    ]);

    const handleDeleteComment = useCallback(
        async (comment: ProductComment) => {
            if (!user?.token) {
                Alert.alert('Connexion requise', 'Veuillez vous connecter pour effectuer cette action');
                return;
            }

            // ✅ FINALISÉ 100%: Sauvegarder l'état pour rollback
            const previousComments = [...comments];
            const previousStats = { ...stats };

            Alert.alert(
                'Supprimer le commentaire',
                'Êtes-vous sûr de vouloir supprimer ce commentaire ?',
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Supprimer',
                        style: 'destructive',
                        onPress: async () => {
                            // ✅ FINALISÉ 100%: Optimistic update - Supprimer immédiatement de l'UI
                            setComments(prev => {
                                if (comment.parent_comment_id) {
                                    // Supprimer une réponse
                                    return prev.map(c =>
                                        c.id === comment.parent_comment_id
                                            ? { ...c, replies: c.replies.filter(r => r.id !== comment.id), reply_count: Math.max(0, (c.reply_count || 0) - 1) }
                                            : c
                                    );
                                } else {
                                    // Supprimer un commentaire racine
                                    return prev.filter(c => c.id !== comment.id);
                                }
                            });

                            // ✅ FINALISÉ 100%: Mettre à jour les stats
                            setStats(prev => ({
                                total_comments: Math.max(0, prev.total_comments - 1),
                                rating_count: comment.rating ? Math.max(0, prev.rating_count - 1) : prev.rating_count,
                                average_rating: comment.rating && prev.rating_count > 1
                                    ? ((prev.average_rating * prev.rating_count - comment.rating) / (prev.rating_count - 1))
                                    : prev.average_rating,
                            }));

                            triggerHaptic('success');

                            if (editingTarget?.id === comment.id) {
                                resetComposer();
                            }

                            try {
                                const response = await commentsApi.deleteProductComment(comment.id);
                                if (!response.success) {
                                    // ✅ FINALISÉ 100%: Rollback en cas d'erreur
                                    setComments(previousComments);
                                    setStats(previousStats);
                                    Alert.alert('Erreur', response.error || 'Impossible de supprimer ce commentaire');
                                    triggerHaptic('error');
                                } else {
                                    // ✅ FINALISÉ 100%: Recharger pour synchroniser
                                    await loadComments(true);
                                    triggerHaptic('success');
                                }
                            } catch (err) {
                                console.error('[ProductCommentsSection] handleDeleteComment error', err);
                                // ✅ FINALISÉ 100%: Rollback en cas d'exception
                                setComments(previousComments);
                                setStats(previousStats);
                                Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression');
                                triggerHaptic('error');
                            }
                        },
                    },
                ]
            );
        },
        [loadComments, resetComposer, user?.token, editingTarget, comments, stats],
    );

    const handleToggleReaction = useCallback(
        async (comment: ProductComment, reactionType: string) => {
            if (!user?.token) {
                Alert.alert('Connexion requise', 'Veuillez vous connecter pour réagir à un commentaire');
                return;
            }

            // ✅ NOUVEAU: Haptic feedback et animation
            triggerHaptic('light');

            // ✅ NOUVEAU: Animation de bounce pour la réaction
            if (!reactionAnimations.current[comment.id]) {
                reactionAnimations.current[comment.id] = new Animated.Value(1);
            }
            const anim = reactionAnimations.current[comment.id];

            Animated.sequence([
                Animated.spring(anim, {
                    toValue: 1.3,
                    useNativeDriver: true,
                    tension: 300,
                    friction: 3,
                }),
                Animated.spring(anim, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 300,
                    friction: 3,
                }),
            ]).start();

            // ✅ FINALISÉ 100%: Optimistic update - Sauvegarder l'état
            const previousComments = [...comments];
            const isCurrentlyActive = comment.user_reactions.includes(reactionType);
            const currentCount = comment.reaction_counts[reactionType] || 0;

            // ✅ FINALISÉ 100%: Mettre à jour l'UI immédiatement
            setComments(prev => prev.map(c => {
                if (c.id === comment.id) {
                    const newReactions = isCurrentlyActive
                        ? c.user_reactions.filter(r => r !== reactionType)
                        : [...c.user_reactions, reactionType];
                    const newCounts = {
                        ...c.reaction_counts,
                        [reactionType]: isCurrentlyActive ? Math.max(0, currentCount - 1) : currentCount + 1,
                    };
                    return {
                        ...c,
                        user_reactions: newReactions,
                        reaction_counts: newCounts,
                    };
                }
                // ✅ FINALISÉ 100%: Mettre à jour aussi dans les réponses
                if (c.replies && c.replies.some(r => r.id === comment.id)) {
                    return {
                        ...c,
                        replies: c.replies.map(r => {
                            if (r.id === comment.id) {
                                const newReactions = isCurrentlyActive
                                    ? r.user_reactions.filter(re => re !== reactionType)
                                    : [...r.user_reactions, reactionType];
                                const newCounts = {
                                    ...r.reaction_counts,
                                    [reactionType]: isCurrentlyActive ? Math.max(0, currentCount - 1) : currentCount + 1,
                                };
                                return {
                                    ...r,
                                    user_reactions: newReactions,
                                    reaction_counts: newCounts,
                                };
                            }
                            return r;
                        }),
                    };
                }
                return c;
            }));

            try {
                const response = await commentsApi.toggleCommentReaction(comment.id, reactionType);
                if (!response.success) {
                    // ✅ FINALISÉ 100%: Rollback en cas d'erreur
                    setComments(previousComments);
                    Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer la réaction');
                    triggerHaptic('error');
                } else {
                    // ✅ FINALISÉ 100%: Recharger pour synchroniser (en arrière-plan, sans bloquer)
                    loadComments(true).catch(err => {
                        console.error('[ProductCommentsSection] Erreur rechargement après réaction:', err);
                    });
                    triggerHaptic('success');
                }
            } catch (err) {
                console.error('[ProductCommentsSection] handleToggleReaction error', err);
                // ✅ FINALISÉ 100%: Rollback en cas d'exception
                setComments(previousComments);
                Alert.alert('Erreur', 'Une erreur est survenue lors de la réaction');
                triggerHaptic('error');
            }
        },
        [loadComments, user?.token, comments],
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

    // ✅ AMÉLIORÉ: Prévisualisation enrichie avec 2-3 commentaires
    const previewComments = useMemo(() => {
        const sorted = [...comments].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA; // Plus récent en premier
        });
        return sorted.slice(0, 3);
    }, [comments]);

    // ✅ NOUVEAU: Filtrer et trier les commentaires
    const filteredAndSortedComments = useMemo(() => {
        let filtered = [...comments];

        // Appliquer les filtres
        if (filterOption === 'with_media') {
            filtered = filtered.filter(c => c.media_urls && c.media_urls.length > 0);
        } else if (filterOption === 'verified_only') {
            filtered = filtered.filter(c => c.is_verified_purchase);
        } else if (filterOption.startsWith('_stars')) {
            const rating = parseInt(filterOption[0]);
            filtered = filtered.filter(c => c.rating === rating);
        }

        // Appliquer le tri
        filtered.sort((a, b) => {
            switch (sortOption) {
                case 'recent':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'oldest':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'helpful':
                    const helpfulA = a.helpful_count || 0;
                    const helpfulB = b.helpful_count || 0;
                    return helpfulB - helpfulA;
                case 'highest_rating':
                    const ratingA = a.rating || 0;
                    const ratingB = b.rating || 0;
                    return ratingB - ratingA;
                case 'lowest_rating':
                    const ratingA2 = a.rating || 0;
                    const ratingB2 = b.rating || 0;
                    return ratingA2 - ratingB2;
                default:
                    return 0;
            }
        });

        return filtered;
    }, [comments, filterOption, sortOption]);

    // ✅ NOUVEAU: Distribution des notes pour histogramme
    const ratingDistribution = useMemo(() => {
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        comments.forEach(comment => {
            if (comment.rating && comment.rating >= 1 && comment.rating <= 5) {
                distribution[comment.rating as keyof typeof distribution]++;
            }
        });
        const maxCount = Math.max(...Object.values(distribution));
        return { distribution, maxCount };
    }, [comments]);

    const renderCommentItem = useCallback(
        ({ item, depth }: { item: ProductComment; depth: number }) => {
            // ✅ NOUVEAU: Initialiser l'animation si nécessaire
            if (!cardAnimations.current[item.id]) {
                cardAnimations.current[item.id] = new Animated.Value(0);
                Animated.timing(cardAnimations.current[item.id], {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            }

            const cardOpacity = cardAnimations.current[item.id];
            const reactionScale = reactionAnimations.current[item.id] || new Animated.Value(1);

            return (
                <Animated.View
                    key={item.id}
                    style={[
                        styles.commentContainer,
                        depth > 0 && { marginLeft: depth * 16 },
                        { opacity: cardOpacity }
                    ]}
                >
                    <View style={styles.commentHeader}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.commentAuthor}
                            onPress={() => {
                                triggerHaptic('light');
                                onOpenChat?.(item.user_id, item.user_name, item.user_avatar);
                            }}
                        >
                            <View style={styles.avatarBubble}>
                                {item.user_avatar ? (
                                    <View style={styles.avatarImageContainer}>
                                        {/* TODO: Ajouter Image component pour avatar */}
                                        <Text style={styles.avatarInitials}>
                                            {item.user_name ? item.user_name.charAt(0).toUpperCase() : '👤'}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={styles.avatarInitials}>
                                        {item.user_name ? item.user_name.charAt(0).toUpperCase() : '👤'}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.authorInfo}>
                                <View style={styles.authorNameRow}>
                                    <Text style={styles.authorName}>{item.user_name}</Text>
                                    {/* ✅ NOUVEAU: Badges utilisateur */}
                                    {item.is_verified_purchase && (
                                        <View style={styles.verifiedBadge}>
                                            <SafeIcon name="check-circle" size={14} color="#10B981" />
                                            <Text style={styles.verifiedBadgeText}>Achat vérifié</Text>
                                        </View>
                                    )}
                                    {item.is_regular_customer && (
                                        <View style={styles.regularBadge}>
                                            <SafeIcon name="star" size={12} color="#F59E0B" />
                                            <Text style={styles.regularBadgeText}>Client régulier</Text>
                                        </View>
                                    )}
                                </View>
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
                                    onPress={() => {
                                        triggerHaptic('light');
                                        handleEdit(item);
                                    }}
                                >
                                    <SafeIcon name="edit-3" size={18} color={modernColors.primary} />
                                </TouchableOpacity>
                            )}
                            {item.can_delete && (
                                <TouchableOpacity
                                    style={styles.actionIcon}
                                    onPress={() => {
                                        triggerHaptic('medium');
                                        handleDeleteComment(item);
                                    }}
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

                        {/* ✅ NOUVEAU: Aperçu des médias si disponibles avec CDN */}
                        {item.media_urls && item.media_urls.length > 0 && (
                            <View style={styles.mediaPreview}>
                                {item.media_urls.slice(0, 3).map((url, idx) => {
                                    // ✅ NOUVEAU 2025-12-03: Utiliser mediaService pour CDN avec fallback
                                    const mediaUrl = url.startsWith('http://') || url.startsWith('https://')
                                        ? url
                                        : mediaService.getImageUrl(url);
                                    return (
                                        <TouchableOpacity
                                            key={`media-${item.id}-${idx}`}
                                            style={styles.mediaThumbnail}
                                            onPress={() => {
                                                triggerHaptic('light');
                                                // TODO: Ouvrir galerie de médias
                                            }}
                                        >
                                            <Image
                                                source={{ uri: mediaUrl }}
                                                style={styles.mediaThumbnailImage}
                                                resizeMode="cover"
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                                {item.media_urls.length > 3 && (
                                    <View style={styles.mediaMore}>
                                        <Text style={styles.mediaMoreText}>+{item.media_urls.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {item.mention_users.length > 0 && (
                            <View style={styles.mentionChips}>
                                {item.mention_users.map((mention) => (
                                    <TouchableOpacity
                                        key={`${item.id}-mention-${mention.id}`}
                                        style={styles.mentionChip}
                                        onPress={() => {
                                            triggerHaptic('light');
                                            onOpenChat?.(mention.id, mention.name, mention.avatar_url);
                                        }}
                                    >
                                        <Text style={styles.mentionChipText}>@{mention.name}</Text>
                                    </TouchableOpacity>
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
                                    <Animated.View
                                        key={`${item.id}-${reaction.type}`}
                                        style={{ transform: [{ scale: reactionScale }] }}
                                    >
                                        <TouchableOpacity
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
                                    </Animated.View>
                                );
                            })}
                        </View>

                        <View style={styles.commentFooterActions}>
                            <TouchableOpacity
                                style={styles.footerAction}
                                onPress={() => {
                                    triggerHaptic('light');
                                    handleReply(item);
                                }}
                            >
                                <SafeIcon name="corner-up-right" size={16} color={modernColors.primary} />
                                <Text style={styles.footerActionText}>Répondre</Text>
                            </TouchableOpacity>
                            {item.reply_count > 0 && (
                                <Text style={styles.replyCountText}>
                                    {item.reply_count} {item.reply_count === 1 ? 'réponse' : 'réponses'}
                                </Text>
                            )}
                            <TouchableOpacity
                                style={styles.footerAction}
                                onPress={() => {
                                    triggerHaptic('light');
                                    onOpenChat?.(item.user_id, item.user_name, item.user_avatar);
                                }}
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
                </Animated.View>
            );
        },
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

            <View style={styles.composerInputContainer}>
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
                    colors={isDarkMode ? ['#1E293B', '#0F172A'] : ['#EEF2FF', '#FFFFFF'] as [string, string]}
                    style={styles.fullHeader}
                >
                    <View style={styles.fullHeaderRow}>
                        <View style={styles.headerLeft}>
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

                    {/* ✅ NOUVEAU: Distribution des notes (histogramme) */}
                    {stats.rating_count > 0 && (
                        <View style={styles.ratingDistribution}>
                            {[5, 4, 3, 2, 1].map((rating) => {
                                const count = ratingDistribution.distribution[rating as keyof typeof ratingDistribution.distribution];
                                const percentage = ratingDistribution.maxCount > 0
                                    ? (count / ratingDistribution.maxCount) * 100
                                    : 0;
                                return (
                                    <View key={rating} style={styles.ratingBarRow}>
                                        <Text style={styles.ratingBarLabel}>{rating}⭐</Text>
                                        <View style={styles.ratingBarContainer}>
                                            <View
                                                style={[
                                                    styles.ratingBar,
                                                    { width: `${percentage}%`, backgroundColor: rating >= 4 ? '#10B981' : rating >= 3 ? '#F59E0B' : '#EF4444' }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.ratingBarCount}>{count}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Filtres et tri */}
                    <View style={styles.filtersRow}>
                        <TouchableOpacity
                            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                            onPress={() => {
                                triggerHaptic('light');
                                setShowFilters(!showFilters);
                            }}
                        >
                            <SafeIcon name="filter" size={16} color={showFilters ? '#FFFFFF' : modernColors.primary} />
                            <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
                                Filtres
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.sortButtons}>
                            {(['recent', 'helpful', 'highest_rating'] as SortOption[]).map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    style={[
                                        styles.sortButton,
                                        sortOption === option && styles.sortButtonActive
                                    ]}
                                    onPress={() => {
                                        triggerHaptic('selection');
                                        setSortOption(option);
                                    }}
                                >
                                    <Text style={[
                                        styles.sortButtonText,
                                        sortOption === option && styles.sortButtonTextActive
                                    ]}>
                                        {option === 'recent' ? 'Récent' : option === 'helpful' ? 'Utile' : 'Note ↑'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* ✅ NOUVEAU: Panneau de filtres déroulant */}
                    {showFilters && (
                        <View style={styles.filtersPanel}>
                            <Text style={styles.filtersPanelTitle}>Filtrer par :</Text>
                            <View style={styles.filtersGrid}>
                                {([
                                    { key: 'all', label: 'Tous' },
                                    { key: 'with_media', label: 'Avec médias' },
                                    { key: 'verified_only', label: 'Achats vérifiés' },
                                    { key: '5_stars', label: '5 ⭐' },
                                    { key: '4_stars', label: '4 ⭐' },
                                ] as { key: FilterOption; label: string }[]).map((filter) => (
                                    <TouchableOpacity
                                        key={filter.key}
                                        style={[
                                            styles.filterChip,
                                            filterOption === filter.key && styles.filterChipActive
                                        ]}
                                        onPress={() => {
                                            triggerHaptic('selection');
                                            setFilterOption(filter.key);
                                        }}
                                    >
                                        <Text style={[
                                            styles.filterChipText,
                                            filterOption === filter.key && styles.filterChipTextActive
                                        ]}>
                                            {filter.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </LinearGradient>

                <FlatList
                    data={filteredAndSortedComments}
                    keyExtractor={(item) => `comment-${item.id}`}
                    renderItem={({ item }) => renderCommentItem({ item, depth: 0 })}
                    contentContainerStyle={styles.commentsList}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadComments(true);
                            }}
                            tintColor={modernColors.primary}
                        />
                    }
                    // ✅ FINALISÉ: Pagination infinie
                    onEndReached={loadMoreComments}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.loadMoreContainer}>
                                <ActivityIndicator size="small" color={modernColors.primary} />
                                <Text style={styles.loadMoreText}>Chargement...</Text>
                            </View>
                        ) : hasMore ? (
                            <View style={styles.loadMoreContainer}>
                                <Text style={styles.loadMoreText}>Faites défiler pour charger plus</Text>
                            </View>
                        ) : comments.length > 0 ? (
                            <View style={styles.loadMoreContainer}>
                                <Text style={styles.loadMoreText}>Tous les commentaires ont été chargés</Text>
                            </View>
                        ) : null
                    }
                    // ✅ FINALISÉ: Optimisations de performance
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={50}
                    windowSize={10}
                    initialNumToRender={10}
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
                    colors={isDarkMode ? ['#1E293B', '#0F172A'] : ['#EEF2FF', '#FFFFFF'] as [string, string]}
                    style={styles.previewHeader}
                >
                    <View>
                        <Text style={styles.sectionTitle}>Commentaires clients</Text>
                        <Text style={styles.sectionSubtitle}>
                            {stats.total_comments > 0 ? `${stats.total_comments} ${stats.total_comments === 1 ? 'avis' : 'avis'}` : 'Aucun avis'} • {stats.rating_count > 0 ? `⭐ ${stats.average_rating.toFixed(1)}/5` : 'Pas encore noté'}
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
                                    Aucun commentaire pour l’instant. Lancez la discussion !
                                </Text>
                            </View>
                        ) : (
                            previewComments.map((comment) => (
                                <TouchableOpacity
                                    key={`preview-${comment.id}`}
                                    style={styles.previewComment}
                                    onPress={() => {
                                        triggerHaptic('light');
                                        setModalVisible(true);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.previewCommentHeader}>
                                        <View style={styles.previewAvatar}>
                                            <Text style={styles.previewAvatarText}>
                                                {comment.user_name ? comment.user_name.charAt(0).toUpperCase() : '👤'}
                                            </Text>
                                        </View>
                                        <View style={styles.previewCommentInfo}>
                                            <View style={styles.previewAuthorRow}>
                                                <Text style={styles.previewAuthor}>{comment.user_name}</Text>
                                                {comment.is_verified_purchase && (
                                                    <SafeIcon name="check-circle" size={12} color="#10B981" />
                                                )}
                                                {typeof comment.rating === 'number' && (
                                                    <Text style={styles.previewRating}>
                                                        {'⭐'.repeat(comment.rating)}{'☆'.repeat(5 - comment.rating)}
                                                    </Text>
                                                )}
                                            </View>
                                            <Text style={styles.previewContent} numberOfLines={2}>
                                                {comment.content}
                                            </Text>
                                            <View style={styles.previewMeta}>
                                                <SafeIcon name="clock" size={12} color={modernColors.textSecondary} />
                                                <Text style={styles.previewDate}>{formatDate(comment.created_at)}</Text>
                                                {comment.reply_count > 0 && (
                                                    <>
                                                        <Text style={styles.previewSeparator}>•</Text>
                                                        <Text style={styles.previewReplies}>
                                                            {comment.reply_count} {comment.reply_count === 1 ? 'réponse' : 'réponses'}
                                                        </Text>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
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
        marginTop: 12,
    },
    previewCard: {
        padding: 0,
        overflow: 'visible',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: modernColors.border,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        shadowColor: '#1E293B',
        shadowOpacity: 0.03,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
    },
    previewHeader: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        rowGap: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    viewAllButton: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 12,
        flexShrink: 1,
        justifyContent: 'center',
        alignSelf: 'flex-start',
    },
    viewAllText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 12,
    },
    loader: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewComment: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: modernColors.border,
    },
    previewAuthor: {
        fontWeight: '600',
        fontSize: 13,
        color: modernColors.text,
    },
    previewContent: {
        fontSize: 12,
        color: modernColors.text,
        marginTop: 6,
        lineHeight: 16,
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
        paddingHorizontal: 18,
        paddingVertical: 18,
        alignItems: 'center',
        gap: 8,
    },
    emptyPreviewText: {
        fontSize: 12,
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
        backgroundColor: modernColors.surface,
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
    fullHeaderText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    // ✅ NOUVEAU: Styles pour badges
    authorNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    verifiedBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#10B981',
    },
    regularBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    regularBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#F59E0B',
    },
    // ✅ NOUVEAU: Styles pour médias
    mediaPreview: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        flexWrap: 'wrap',
    },
    mediaThumbnail: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: modernColors.surfaceVariant,
        marginRight: 8,
    },
    mediaThumbnailImage: {
        width: '100%',
        height: '100%',
    },
    mediaPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.surfaceVariant,
    },
    mediaMore: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mediaMoreText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    // ✅ NOUVEAU: Styles pour distribution des notes
    ratingDistribution: {
        marginTop: 16,
        gap: 8,
    },
    ratingBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    ratingBarLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        width: 30,
    },
    ratingBarContainer: {
        flex: 1,
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
    },
    ratingBar: {
        height: '100%',
        borderRadius: 4,
    },
    ratingBarCount: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        width: 30,
        textAlign: 'right',
    },
    // ✅ NOUVEAU: Styles pour filtres et tri
    headerLeft: {
        flex: 1,
    },
    filtersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        flexWrap: 'wrap',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: '#FFFFFF',
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
    },
    filterButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
        flex: 1,
    },
    sortButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    sortButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    sortButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    sortButtonTextActive: {
        color: '#FFFFFF',
    },
    filtersPanel: {
        marginTop: 12,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    filtersPanelTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    filtersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    // ✅ NOUVEAU: Styles pour prévisualisation enrichie
    previewCommentHeader: {
        flexDirection: 'row',
        gap: 12,
    },
    previewAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewAvatarText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    previewCommentInfo: {
        flex: 1,
        gap: 4,
    },
    previewAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    previewRating: {
        fontSize: 10,
    },
    previewSeparator: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginHorizontal: 4,
    },
    previewReplies: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    replyCountText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    avatarImageContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
        overflow: 'hidden',
    },
    // ✅ FINALISÉ: Styles pour pagination infinie
    loadMoreContainer: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadMoreText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 8,
    },
});

export default ProductCommentsSection;

