// ✅ NOUVEAU Phase 4.4: Composant pour afficher l'historique de recherches

import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface SearchHistoryItem {
    id: number;
    query: string;
    specialized_type?: string;
    results_count: number;
    searched_at: string;
}

interface Props {
    onSelect: (query: string, specializedType?: string) => void;
    specializedType?: string;
    maxItems?: number;
}

const SearchHistory: React.FC<Props> = ({ onSelect, specializedType, maxItems = 10 }) => {
        const { t } = useLanguageSafe();
const [history, setHistory] = useState<SearchHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadHistory();
    }, [specializedType]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const response = await apiGet(
                `/api/specialized-services/search-history?limit=${maxItems}`
            );
            if (response.success && response.data) {
                const data = response.data as any;
                let items = data.history || [];
                // Filtrer par type si spécifié
                if (specializedType) {
                    items = items.filter(
                        (item: SearchHistoryItem) => item.specialized_type === specializedType
                    );
                }
                setHistory(items);
            }
        } catch (error) {
            console.error('Erreur chargement historique:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return t('searchHistory.aL')instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)} h`;
        return `Il y a ${Math.floor(diffMins / 1440)} j`;
    };

    if (history.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="clock" size={18} color={modernColors.textSecondary} type="lucide" />
                <Text style={styles.title}>{t('searchHistory.recherchesRecentes')}</Text>
            </View>
            <FlatList
                data={history}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => onSelect(item.query, item.specialized_type || undefined)}
                    >
                        <NativeCard style={styles.historyItem}>
                            <View style={styles.historyContent}>
                                <SafeIcon
                                    name="search"
                                    size={16}
                                    color={modernColors.primary}
                                    type="lucide"
                                />
                                <View style={styles.historyText}>
                                    <Text style={styles.historyQuery} numberOfLines={1}>
                                        {item.query}
                                    </Text>
                                    <Text style={styles.historyMeta}>
                                        {formatDate(item.searched_at)} • {item.results_count} résultat(s)
                                    </Text>
                                </View>
                            </View>
                        </NativeCard>
                    </TouchableOpacity>
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    listContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    historyItem: {
        padding: 12,
        minWidth: 200,
    },
    historyContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    historyText: {
        flex: 1,
    },
    historyQuery: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    historyMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
});

export default SearchHistory;

