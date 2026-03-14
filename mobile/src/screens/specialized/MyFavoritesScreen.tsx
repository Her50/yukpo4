// Écran de mes favoris immobiliers
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import ImmobilierResultCard from '../../components/specialized/ImmobilierResultCard';
import { immobilierService, RealEstateProperty } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';

const MyFavoritesScreen: React.FC = () => {
    const navigation = useNavigation();
    const [favorites, setFavorites] = useState<RealEstateProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFavorites = async () => {
        try {
            setError(null);
            const response = await immobilierService.getMyFavorites();
            if (response.success && response.data) {
                setFavorites((response as any).data);
            } else {
                setError('Erreur lors du chargement des favoris');
            }
        } catch (err: any) {
            console.error('[MyFavoritesScreen] Erreur:', err);
            setError(err.message || 'Erreur lors du chargement');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadFavorites();
        }, [])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadFavorites();
    };

    const handlePropertyPress = (property: RealEstateProperty) => {
        (navigation as any).navigate('ImmobilierDetails', {
            propertyId: property.id,
        });
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de vos favoris...</Text>
            </View>
        );
    }

    if (error && favorites.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={loadFavorites}
                >
                    <Text style={styles.retryButtonText}>Réessayer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="heart" size={24} color={modernColors.primary} />
                <Text style={styles.headerTitle}>Mes Favoris</Text>
                <Text style={styles.headerSubtitle}>
                    {favorites.length} bien{favorites.length > 1 ? 's' : ''} sauvegardé{favorites.length > 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={favorites}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <ImmobilierResultCard
                        property={item}
                        onPress={() => handlePropertyPress(item)}
                    />
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[modernColors.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="heart" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyText}>Aucun favori</Text>
                        <Text style={styles.emptySubtext}>
                            Ajoutez des biens à vos favoris pour les retrouver facilement
                        </Text>
                        <TouchableOpacity
                            style={styles.browseButton}
                            onPress={() => {
                                (navigation as any).navigate('ImmobilierSearch');
                            }}
                        >
                            <Text style={styles.browseButtonText}>Parcourir les biens</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    listContent: {
        padding: 16,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 24,
    },
    browseButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    browseButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default MyFavoritesScreen;

