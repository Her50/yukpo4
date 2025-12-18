// ✅ Liste des livres scolaires de l'utilisateur (Mobile)

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface LivreScolaire {
    id: number;
    titre: string;
    auteur?: string;
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    etat_livre: string;
    images_urls?: string[];
    is_available: boolean;
    is_active: boolean;
    created_at: string;
}

const MesLivresScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [livres, setLivres] = useState<LivreScolaire[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadLivres();
        }, [])
    );

    const loadLivres = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await apiGet('/api/livres-scolaires/mes-livres');

            if (response.success && response.data) {
                setLivres(response.data.livres || []);
            } else {
                Alert.alert('Erreur', 'Impossible de charger vos livres');
            }
        } catch (error: any) {
            console.error('[MesLivresScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger vos livres');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleToggleAvailability = async (livre: LivreScolaire) => {
        try {
            const response = await apiPost(`/api/livres-scolaires/${livre.id}/availability`, {
                is_available: !livre.is_available,
            });

            if (response.success) {
                loadLivres();
                Alert.alert('Succès', 'Disponibilité mise à jour');
            } else {
                Alert.alert('Erreur', 'Impossible de mettre à jour la disponibilité');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        }
    };

    const handleDelete = (livre: LivreScolaire) => {
        Alert.alert(
            'Supprimer le livre',
            `Êtes-vous sûr de vouloir supprimer "${livre.titre}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await apiPost(`/api/livres-scolaires/${livre.id}`, {}, 'DELETE');
                            if (response.success) {
                                loadLivres();
                                Alert.alert('Succès', 'Livre supprimé');
                            }
                        } catch (error: any) {
                            Alert.alert('Erreur', 'Impossible de supprimer le livre');
                        }
                    },
                },
            ]
        );
    };

    const renderLivre = ({ item }: { item: LivreScolaire }) => {
        const firstImage = item.images_urls?.[0];

        return (
            <NativeCard style={styles.livreCard}>
                <View style={styles.livreContent}>
                    {firstImage && (
                        <Image source={{ uri: firstImage }} style={styles.livreImage} />
                    )}
                    <View style={styles.livreInfo}>
                        <Text style={styles.livreTitre} numberOfLines={2}>
                            {item.titre}
                        </Text>
                        {item.auteur && (
                            <Text style={styles.livreAuteur} numberOfLines={1}>
                                {item.auteur}
                            </Text>
                        )}
                        <View style={styles.livreMeta}>
                            <Text style={styles.metaText}>
                                📚 {item.classe_actuelle} → {item.classe_souhaitee}
                            </Text>
                            <Text style={styles.metaText}>📖 {item.matiere}</Text>
                        </View>
                        <View style={styles.statusRow}>
                            <View style={[
                                styles.statusBadge,
                                {
                                    backgroundColor: item.is_available
                                        ? modernColors.success + '20'
                                        : modernColors.warning + '20'
                                }
                            ]}>
                                <Text style={[
                                    styles.statusText,
                                    {
                                        color: item.is_available
                                            ? modernColors.success
                                            : modernColors.warning
                                    }
                                ]}>
                                    {item.is_available ? 'Disponible' : 'Indisponible'}
                                </Text>
                            </View>
                            <View style={[
                                styles.etatBadge,
                                { backgroundColor: getEtatColor(item.etat_livre) + '20' }
                            ]}>
                                <Text style={[
                                    styles.etatText,
                                    { color: getEtatColor(item.etat_livre) }
                                ]}>
                                    {item.etat_livre}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => {
                                    navigation.navigate('LivreScolaireForm' as never, {
                                        livreId: item.id,
                                        mode: 'edit',
                                    } as never);
                                }}
                            >
                                <SafeIcon name="edit" size={18} color={modernColors.primary} />
                                <Text style={styles.actionText}>Modifier</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleToggleAvailability(item)}
                            >
                                <SafeIcon
                                    name={item.is_available ? 'eye-off' : 'eye'}
                                    size={18}
                                    color={modernColors.textSecondary}
                                />
                                <Text style={styles.actionText}>
                                    {item.is_available ? 'Masquer' : 'Afficher'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.deleteButton]}
                                onPress={() => handleDelete(item)}
                            >
                                <SafeIcon name="trash-2" size={18} color={modernColors.error} />
                                <Text style={[styles.actionText, styles.deleteText]}>Supprimer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </NativeCard>
        );
    };

    const getEtatColor = (etat: string): string => {
        switch (etat) {
            case 'Neuf': return modernColors.success;
            case 'Très bon': return '#10B981';
            case 'Bon': return modernColors.warning;
            case 'Acceptable': return modernColors.error;
            default: return modernColors.textSecondary;
        }
    };

    if (loading && livres.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Mes Livres</Text>
                <TouchableOpacity
                    onPress={() => {
                        navigation.navigate('LivreScolaireForm' as never, { mode: 'create' } as never);
                    }}
                    style={styles.addButton}
                >
                    <SafeIcon name="plus" size={24} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {livres.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="book-open" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucun livre publié</Text>
                    <Text style={styles.emptySubtext}>
                        Créez votre premier livre scolaire pour commencer à échanger
                    </Text>
                    <NativeButton
                        title="➕ Créer un livre"
                        variant="primary"
                        onPress={() => {
                            navigation.navigate('LivreScolaireForm' as never, { mode: 'create' } as never);
                        }}
                        style={styles.createButton}
                    />
                </View>
            ) : (
                <FlatList
                    data={livres}
                    renderItem={renderLivre}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadLivres(true)}
                        />
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        flex: 1,
        marginLeft: 12,
    },
    addButton: {
        padding: 4,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    livreCard: {
        marginBottom: 12,
    },
    livreContent: {
        flexDirection: 'row',
        gap: 12,
    },
    livreImage: {
        width: 80,
        height: 120,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
    },
    livreInfo: {
        flex: 1,
        gap: 8,
    },
    livreTitre: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    livreAuteur: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    livreMeta: {
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    statusRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    etatBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    etatText: {
        fontSize: 12,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    actionText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    deleteButton: {
        marginLeft: 'auto',
    },
    deleteText: {
        color: modernColors.error,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    createButton: {
        marginTop: 8,
    },
});

export default MesLivresScreen;

