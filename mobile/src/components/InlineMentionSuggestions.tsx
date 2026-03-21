// Composant dropdown inline pour suggestions de mentions (@mention)
// S'affiche directement sous le TextInput quand l'utilisateur tape @
import React, { useEffect, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

export interface MentionSuggestion {
    id: number;
    nom_complet: string;
    email: string;
    avatar_url?: string;
    is_provider?: boolean;
    role?: string;
}

interface InlineMentionSuggestionsProps {
    query: string;
    visible: boolean;
    onSelect: (user: MentionSuggestion) => void;
    maxHeight?: number;
}

const InlineMentionSuggestions: React.FC<InlineMentionSuggestionsProps> = ({
    query,
    visible,
    onSelect,
    maxHeight = 200,
}) => {
    const [results, setResults] = useState<MentionSuggestion[]>([]);
    const [loading, setLoading] = useState(false);

    const normalizeForSearch = (value?: string): string => {
        if (!value) return '';
        try {
            return value
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        } catch {
            return value.toLowerCase().trim();
        }
    };

    const searchUsers = async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        console.log('[DEBUG MENTION] InlineMentionSuggestions.searchUsers appelé avec query:', q);

        try {
            setLoading(true);
            const response = await apiGet<any>(
                `/api/conversations/search-users?query=${encodeURIComponent(q.trim())}&limit=12&search_type=all`
            );

            console.log('[DEBUG MENTION] InlineMentionSuggestions réponse API:', response);

            if (response.success && response.data) {
                const backendResp = response.data as any;
                const users: MentionSuggestion[] = backendResp?.data || (Array.isArray(backendResp) ? backendResp : []);

                console.log('[DEBUG MENTION] InlineMentionSuggestions utilisateurs parsés:', users.length, users);
                setResults(users);
            } else {
                console.log('[DEBUG MENTION] InlineMentionSuggestions réponse invalide, résultats vidés');
                setResults([]);
            }
        } catch (error) {
            console.error('[DEBUG MENTION] InlineMentionSuggestions erreur API:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!visible) {
            setResults([]);
            return;
        }

        const timer = setTimeout(() => {
            searchUsers(query);
        }, 150);

        return () => clearTimeout(timer);
    }, [query, visible, searchUsers]);

    if (!visible) return null;

    if (loading && results.length === 0) {
        return (
            <View style={[styles.container, { maxHeight }]}>
                <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Recherche...</Text>
                </View>
            </View>
        );
    }

    if (!loading && results.length === 0 && query.trim().length >= 1) {
        return (
            <View style={[styles.container, { maxHeight }]}>
                <View style={styles.emptyRow}>
                    <SafeIcon name="user-x" size={16} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucun utilisateur pour "{query}"</Text>
                </View>
            </View>
        );
    }

    if (results.length === 0) return null;

    return (
        <View style={[styles.container, { maxHeight }]}>
            <FlatList
                data={results}
                keyExtractor={(item) => `suggestion-${item.id}`}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.userRow}
                        onPress={() => onSelect(item)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.avatar}>
                            {item.avatar_url ? (
                                <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarText}>
                                        {(item.nom_complet || '?').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            {item.is_provider && (
                                <View style={styles.providerDot} />
                            )}
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName} numberOfLines={1}>
                                {item.nom_complet || item.email}
                            </Text>
                            {item.email && item.nom_complet && (
                                <Text style={styles.userEmail} numberOfLines={1}>
                                    {item.email}
                                </Text>
                            )}
                        </View>
                        {item.is_provider && (
                            <View style={styles.providerBadge}>
                                <Text style={styles.providerBadgeText}>Pro</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 8,
        marginHorizontal: 4,
        marginBottom: 4,
        overflow: 'hidden',
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    loadingText: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    emptyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    emptyText: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: modernColors.border,
    },
    avatar: {
        position: 'relative',
        width: 36,
        height: 36,
    },
    avatarImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    providerDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: modernColors.success,
        borderWidth: 2,
        borderColor: modernColors.surface,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    userEmail: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 1,
    },
    providerBadge: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    providerBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: modernColors.primary,
    },
});

export default InlineMentionSuggestions;
