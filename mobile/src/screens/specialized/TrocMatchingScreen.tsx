// ✅ Résultats de matching de troc (direct + chaînes) (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface MatchingDirect {
    livre_offert_id: number;
    livre_souhaite_id: number;
    participant_id: number;
    distance_km?: number;
    score_proximite: number;
    livre_offert?: any;
    livre_souhaite?: any;
}

interface MatchingChaine {
    chaine_id?: number;
    participants: Array<{
        user_id: number;
        livre_offert_id: number;
        livre_souhaite_id: number;
        ordre: number;
    }>;
    distance_totale_km: number;
    score_proximite: number;
    nombre_participants: number;
    livres?: any[];
}

const TrocMatchingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { t } = useLanguageSafe();
    const params = route.params as any;
    const livreId = params?.livreId as number;
    const initialMatchings = params?.matchings as any;

    const [loading, setLoading] = useState(!initialMatchings);
    const [directMatches, setDirectMatches] = useState<MatchingDirect[]>([]);
    const [chainMatches, setChainMatches] = useState<MatchingChaine[]>([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (initialMatchings) {
            setDirectMatches(initialMatchings.matches || []);
            setChainMatches(initialMatchings.chaines || []);
        } else if (livreId) {
            loadMatchings();
        }
    }, [livreId, initialMatchings]);

    const loadMatchings = async () => {
        try {
            setLoading(true);
            const response = await apiPost('/api/troc-livres/match', {
                livre_id: livreId,
                include_chaines: true,
                max_participants: 5,
            });

            const r = response.data as any;
            if (response.success && r?.matchings) {
                const matchings = r.matchings;
                setDirectMatches(matchings.matches || []);
                setChainMatches(matchings.chaines || []);
            } else {
                Alert.alert(t('message.error'), t('trocMatching.noMatchings'));
            }
        } catch (error: any) {
            console.error('[TrocMatchingScreen] Erreur:', error);
            Alert.alert(t('message.error'), error.message || t('trocMatching.cannotLoadMatchings'));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDirectTroc = async (match: MatchingDirect) => {
        try {
            setCreating(true);
            const response = await apiPost('/api/troc-livres/direct', {
                livre_offert_id: match.livre_offert_id,
                livre_souhaite_id: match.livre_souhaite_id,
                participant_id: match.participant_id,
            });

            if (response.success) {
                Alert.alert(
                    t('message.success'),
                    t('trocMatching.trocProposed'),
                    [
                        {
                            text: t('trocMatchingScreen.voirMesTrocs'),
                            onPress: () => {
                                navigation.navigate('MesTrocs' as never);
                            },
                        },
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert(t('message.error'), response.error || t('trocMatching.cannotCreateTroc'));
            }
        } catch (error: any) {
            Alert.alert(t('message.error'), error.message || t('trocMatching.genericError'));
        } finally {
            setCreating(false);
        }
    };

    const handleCreateChaineTroc = async (chaine: MatchingChaine) => {
        try {
            setCreating(true);
            const response = await apiPost('/api/troc-livres/chaine', {
                participants: chaine.participants,
            });

            if (response.success) {
                Alert.alert(
                    t('message.success'),
                    t('trocMatching.chainCreated', { count: chaine.nombre_participants }),
                    [
                        {
                            text: t('trocMatchingScreen.voirMesTrocs'),
                            onPress: () => {
                                navigation.navigate('MesTrocs' as never);
                            },
                        },
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert(t('message.error'), response.error || t('trocMatching.cannotCreateChain'));
            }
        } catch (error: any) {
            Alert.alert(t('message.error'), error.message || t('trocMatching.genericError'));
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('trocMatching.rechercheDeMatchings')}</Text>
            </View>
        );
    }

    const totalMatches = directMatches.length + chainMatches.length;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>
                    {totalMatches} matching{totalMatches > 1 ? 's' : ''} trouvé{totalMatches > 1 ? 's' : ''}
                </Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {totalMatches === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="search-x" size={64} color={modernColors.textSecondary} />
                        <Text style={styles.emptyText}>{t('trocMatching.aucunMatchingTrouve')}</Text>
                        <Text style={styles.emptySubtext}>
                            Aucun livre ne correspond à vos critères pour le moment.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Troc Direct */}
                        {directMatches.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>
                                    🔄 Troc Direct ({directMatches.length})
                                </Text>
                                {directMatches.map((match, index) => (
                                    <NativeCard key={index} style={styles.matchCard}>
                                        <View style={styles.matchHeader}>
                                            <View style={styles.matchInfo}>
                                                <Text style={styles.matchTitle}>
                                                    {match.livre_offert?.titre || t('trocMatching.livreOffert')} ↔
                                                </Text>
                                                <Text style={styles.matchSubtitle}>
                                                    {match.livre_souhaite?.titre || t('trocMatching.livreSouhaite')}
                                                </Text>
                                            </View>
                                            <View style={styles.scoreContainer}>
                                                <Text style={styles.scoreText}>
                                                    {Math.round(match.score_proximite * 100)}%
                                                </Text>
                                                <Text style={styles.scoreLabel}>Match</Text>
                                            </View>
                                        </View>
                                        <View style={styles.matchMeta}>
                                            {match.distance_km && (
                                                <Text style={styles.metaText}>
                                                    📍 {match.distance_km.toFixed(1)} km
                                                </Text>
                                            )}
                                            <Text style={styles.metaText}>
                                                👤 {match.livre_souhaite?.user_id ? 'Utilisateur' : 'Participant'}
                                            </Text>
                                        </View>
                                        <NativeButton
                                            title="💬 Proposer ce troc"
                                            variant="primary"
                                            onPress={() => handleCreateDirectTroc(match)}
                                            style={styles.actionButton}
                                            disabled={creating}
                                        />
                                    </NativeCard>
                                ))}
                            </View>
                        )}

                        {/* Chaînes de troc */}
                        {chainMatches.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>
                                    🔗 Chaînes de Troc ({chainMatches.length})
                                </Text>
                                {chainMatches.map((chaine, index) => (
                                    <NativeCard key={index} style={styles.matchCard}>
                                        <View style={styles.matchHeader}>
                                            <View style={styles.matchInfo}>
                                                <Text style={styles.matchTitle}>
                                                    Chaîne de {chaine.nombre_participants} personnes
                                                </Text>
                                                <Text style={styles.matchSubtitle}>
                                                    Distance totale: {chaine.distance_totale_km.toFixed(1)} km
                                                </Text>
                                            </View>
                                            <View style={styles.scoreContainer}>
                                                <Text style={styles.scoreText}>
                                                    {Math.round(chaine.score_proximite * 100)}%
                                                </Text>
                                                <Text style={styles.scoreLabel}>Score</Text>
                                            </View>
                                        </View>
                                        <View style={styles.chainPreview}>
                                            {chaine.livres?.slice(0, 3).map((livre: any, i: number) => (
                                                <View key={i} style={styles.chainItem}>
                                                    <Text style={styles.chainItemText} numberOfLines={1}>
                                                        {livre.titre || `Livre ${i + 1}`}
                                                    </Text>
                                                </View>
                                            ))}
                                            {chaine.nombre_participants > 3 && (
                                                <Text style={styles.chainMore}>
                                                    +{chaine.nombre_participants - 3} autres
                                                </Text>
                                            )}
                                        </View>
                                        <NativeButton
                                            title={t('trocMatching.creerCetteChaine')}
                                            variant="outline"
                                            onPress={() => handleCreateChaineTroc(chaine)}
                                            style={styles.actionButton}
                                            disabled={creating}
                                        />
                                    </NativeCard>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
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
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        flex: 1,
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
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        gap: 24,
    },
    section: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    matchCard: {
        padding: 16,
        marginBottom: 12,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    matchInfo: {
        flex: 1,
        gap: 4,
    },
    matchTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    matchSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    scoreContainer: {
        alignItems: 'center',
        backgroundColor: modernColors.primary + '20',
        padding: 8,
        borderRadius: 8,
        minWidth: 60,
    },
    scoreText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    scoreLabel: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    matchMeta: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    metaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    chainPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    chainItem: {
        flex: 1,
        minWidth: 100,
    },
    chainItemText: {
        fontSize: 12,
        color: '#374151',
    },
    chainMore: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    actionButton: {
        marginTop: 8,
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
});

export default TrocMatchingScreen;

