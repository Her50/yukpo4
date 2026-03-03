// ✅ Écran de recherche et affichage des conférences et lives scolaires (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';

interface Conference {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    titre: string;
    description?: string;
    date_debut: string;
    date_fin?: string;
    livekit_room_name: string;
    is_active: boolean;
    created_at: string;
}

const ConferencesLivesScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const route = useRoute();
    const programmeesOnly = (route.params as any)?.programmees === true;

    const [loading, setLoading] = useState(false);
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (programmeesOnly) {
            loadConferencesProgrammees();
        } else {
            searchConferences();
        }
    }, [programmeesOnly, page]);

    const loadConferencesProgrammees = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            const response = await apiGet(`/api/orientation-scolaire/conferences/programmees?${params}`);
            const data = (response?.data || response) as any;

            if (data?.success) {
                setConferences(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ConferencesLives] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchConferences = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            const response = await apiGet(`/api/orientation-scolaire/conferences/search?${params}`);
            const data = (response?.data || response) as any;

            if (data?.success) {
                setConferences(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ConferencesLives] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinConference = async (conferenceId: number) => {
        if (!user) {
            Alert.alert('Connexion requise', 'Vous devez être connecté pour rejoindre une conférence');
            return;
        }

        try {
            const response = await apiGet(`/api/orientation-scolaire/conferences/${conferenceId}/join`);
            const data = (response?.data || response) as any;

            if (data?.success && data.data?.token) {
                // Note: L'implémentation complète nécessiterait l'intégration LiveKit mobile
                Alert.alert(
                    'Conférence',
                    `Token généré pour ${data.data.room_name}. L'intégration LiveKit mobile sera disponible prochainement.`
                );
            }
        } catch (error) {
            console.error('[ConferencesLives] Erreur join:', error);
            Alert.alert('Erreur', 'Impossible de rejoindre la conférence');
        }
    };

    const isUpcoming = (dateStr: string) => {
        return new Date(dateStr) > new Date();
    };

    const isLive = (dateDebut: string, dateFin?: string) => {
        const now = new Date();
        const debut = new Date(dateDebut);
        const fin = dateFin ? new Date(dateFin) : null;
        return debut <= now && (!fin || fin >= now);
    };

    const renderConference = ({ item }: { item: Conference }) => {
        const upcoming = isUpcoming(item.date_debut);
        const live = isLive(item.date_debut, item.date_fin);

        return (
            <View style={[styles.card, live && styles.cardLive]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.titre}</Text>
                    {live && (
                        <View style={styles.liveBadge}>
                            <Text style={styles.liveText}>🔴 EN DIRECT</Text>
                        </View>
                    )}
                    {upcoming && !live && (
                        <View style={styles.upcomingBadge}>
                            <Text style={styles.upcomingText}>À venir</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.cardSubtitle}>
                    📍 {item.nom_etablissement || `Établissement #${item.etablissement_id}`}
                </Text>
                <Text style={styles.cardSubtitle}>
                    📅 {new Date(item.date_debut).toLocaleString('fr-FR')}
                </Text>
                {item.date_fin && (
                    <Text style={styles.cardSubtitle}>
                        ⏰ Fin: {new Date(item.date_fin).toLocaleString('fr-FR')}
                    </Text>
                )}
                {item.description && (
                    <Text style={styles.description} numberOfLines={3}>
                        {item.description}
                    </Text>
                )}
                <View style={styles.actionsContainer}>
                    {(live || upcoming) && user && (
                        <TouchableOpacity
                            style={[styles.joinButton, live && styles.joinButtonLive]}
                            onPress={() => handleJoinConference(item.id)}
                        >
                            <Text style={styles.joinButtonText}>
                                {live ? '🔴 Rejoindre' : 'Rejoindre'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {item.etablissement_id && (
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={() => navigation.navigate('EtablissementDetails', { id: item.etablissement_id })}
                        >
                            <Text style={styles.linkButtonText}>Voir établissement</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : conferences.length > 0 ? (
                <>
                    <Text style={styles.resultsCount}>
                        {total} conférence{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
                    </Text>
                    <FlatList
                        data={conferences}
                        renderItem={renderConference}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.list}
                        onEndReached={() => {
                            if (page * 20 < total) {
                                setPage((p) => p + 1);
                            }
                        }}
                        onEndReachedThreshold={0.5}
                    />
                </>
            ) : (
                <View style={styles.centerContainer}>
                    <Text style={styles.emptyText}>Aucune conférence trouvée</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    resultsCount: {
        padding: 16,
        color: '#6B7280',
        fontSize: 14,
    },
    list: {
        padding: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardLive: {
        borderWidth: 2,
        borderColor: '#EF4444',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    liveBadge: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    liveText: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: '600',
    },
    upcomingBadge: {
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    upcomingText: {
        color: '#1E40AF',
        fontSize: 12,
        fontWeight: '500',
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    description: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 8,
        marginBottom: 12,
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    joinButton: {
        flex: 1,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    joinButtonLive: {
        backgroundColor: '#EF4444',
    },
    joinButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    linkButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    linkButtonText: {
        color: '#111827',
        fontSize: 14,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: '#6B7280',
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
    },
});

export default ConferencesLivesScreen;

