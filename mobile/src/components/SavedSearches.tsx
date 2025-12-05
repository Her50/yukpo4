// ✅ NOUVEAU Phase 4.5: Composant pour afficher et gérer les recherches sauvegardées

import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';
import { apiDelete, apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface SavedSearch {
    id: number;
    name: string;
    query: string;
    specialized_type?: string;
    created_at: string;
    updated_at: string;
}

interface Props {
    onSelect: (query: string, specializedType?: string) => void;
    specializedType?: string;
}

const SavedSearches: React.FC<Props> = ({ onSelect, specializedType }) => {
    const [saved, setSaved] = useState<SavedSearch[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSaved();
    }, [specializedType]);

    const loadSaved = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/specialized-services/saved-searches');
            if (response.success && response.data) {
                const data = response.data as any;
                let items = data.saved_searches || [];
                // Filtrer par type si spécifié
                if (specializedType) {
                    items = items.filter(
                        (item: SavedSearch) => item.specialized_type === specializedType
                    );
                }
                setSaved(items);
            }
        } catch (error) {
            console.error('Erreur chargement recherches sauvegardées:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        Alert.alert(
            'Supprimer la recherche',
            `Êtes-vous sûr de vouloir supprimer "${name}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiDelete(`/api/specialized-services/saved-searches/${id}`);
                            loadSaved();
                        } catch (error) {
                            Alert.alert('Erreur', 'Impossible de supprimer la recherche');
                        }
                    },
                },
            ]
        );
    };

    if (saved.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="bookmark" size={18} color={modernColors.primary} type="lucide" />
                <Text style={styles.title}>Recherches sauvegardées</Text>
            </View>
            <FlatList
                data={saved}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <NativeCard style={styles.savedItem}>
                        <TouchableOpacity
                            style={styles.savedContent}
                            onPress={() => onSelect(item.query, item.specialized_type || undefined)}
                        >
                            <View style={styles.savedText}>
                                <Text style={styles.savedName}>{item.name}</Text>
                                <Text style={styles.savedQuery} numberOfLines={1}>
                                    {item.query}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => handleDelete(item.id, item.name)}
                                style={styles.deleteButton}
                            >
                                <SafeIcon name="trash-2" size={18} color={modernColors.error} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </NativeCard>
                )}
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
    savedItem: {
        padding: 12,
    },
    savedContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    savedText: {
        flex: 1,
    },
    savedName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    savedQuery: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    deleteButton: {
        padding: 4,
    },
});

export default SavedSearches;

