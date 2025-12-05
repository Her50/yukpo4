// ✅ NOUVEAU 2025-01-28: Hub principal pour offres d'emploi (Mobile) - Amélioré avec IA
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface DashboardStats {
    total_offres?: number;
    total_candidatures?: number;
    candidatures_attente?: number;
    meilleurs_matchings?: number;
}

const OffresEmploiHubScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [])
    );

    const loadStats = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            if (user) {
                const response = await apiGet('/api/offres-emploi/dashboard/candidat');
                if (response.success) {
                    setStats(response.data);
                }
            }
        } catch (error) {
            console.error('[OffresEmploiHub] Erreur:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStats(true)} />}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Offres d'Emploi</Text>
                <Text style={styles.subtitle}>Trouvez votre emploi idéal</Text>
            </View>

            {/* Statistiques */}
            {stats && (
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.total_offres || 0}</Text>
                        <Text style={styles.statLabel}>Offres actives</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.total_candidatures || 0}</Text>
                        <Text style={styles.statLabel}>Candidatures</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.candidatures_attente || 0}</Text>
                        <Text style={styles.statLabel}>En attente</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.meilleurs_matchings || 0}</Text>
                        <Text style={styles.statLabel}>Matchings</Text>
                    </View>
                </View>
            )}

            {/* Barre de recherche */}
            <TouchableOpacity
                style={styles.searchBar}
                onPress={() => (navigation as any).navigate('OffreSearch')}
            >
                <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                <Text style={styles.searchPlaceholder}>Rechercher une offre...</Text>
            </TouchableOpacity>

            {/* Intelligence Artificielle */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🤖 Intelligence Artificielle</Text>

                <NativeCard style={styles.aiCard}>
                    <View style={styles.aiCardHeader}>
                        <SafeIcon name="file-text" size={24} color="#8B5CF6" />
                        <Text style={styles.aiCardTitle}>Analyse CV IA</Text>
                    </View>
                    <Text style={styles.aiCardText}>
                        Analysez votre CV avec l'IA pour obtenir des suggestions d'amélioration et identifier les compétences manquantes
                    </Text>
                    <NativeButton
                        title="Analyser mon CV"
                        onPress={() => {
                            // TODO: Navigation vers écran d'analyse CV
                            Alert.alert('À venir', 'Fonctionnalité d\'analyse CV IA à implémenter');
                        }}
                        variant="primary"
                        style={styles.aiButton}
                    />
                </NativeCard>

                <NativeCard style={styles.aiCard}>
                    <View style={styles.aiCardHeader}>
                        <SafeIcon name="graduation-cap" size={24} color="#10B981" />
                        <Text style={styles.aiCardTitle}>Suggestions Formations IA</Text>
                    </View>
                    <Text style={styles.aiCardText}>
                        Obtenez des suggestions de formations basées sur vos compétences manquantes et vos objectifs de carrière
                    </Text>
                    <NativeButton
                        title="Voir les formations"
                        onPress={() => {
                            // TODO: Navigation vers écran suggestions formations
                            Alert.alert('À venir', 'Fonctionnalité de suggestions formations IA à implémenter');
                        }}
                        variant="secondary"
                        style={styles.aiButton}
                    />
                </NativeCard>

                <NativeCard style={styles.aiCard}>
                    <View style={styles.aiCardHeader}>
                        <SafeIcon name="dollar-sign" size={24} color="#F59E0B" />
                        <Text style={styles.aiCardTitle}>Prédiction Salaire IA</Text>
                    </View>
                    <Text style={styles.aiCardText}>
                        Obtenez une estimation de salaire basée sur votre profil, expérience et le marché local
                    </Text>
                    <NativeButton
                        title="Estimer mon salaire"
                        onPress={() => {
                            // TODO: Navigation vers écran prédiction salaire
                            Alert.alert('À venir', 'Fonctionnalité de prédiction salaire IA à implémenter');
                        }}
                        variant="outline"
                        style={styles.aiButton}
                    />
                </NativeCard>
            </View>

            {/* Actions rapides - Candidat */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>👤 Espace Candidat</Text>
                <NativeCard style={styles.actionCard}>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('OffreMatching')}
                        style={styles.actionButton}
                    >
                        <SafeIcon name="target" size={24} color="#6366F1" type="lucide" />
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Offres Correspondantes</Text>
                            <Text style={styles.actionSubtitle}>Découvrez les offres qui vous correspondent</Text>
                        </View>
                    </TouchableOpacity>
                </NativeCard>

                <NativeCard style={styles.actionCard}>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('MesCandidatures')}
                        style={styles.actionButton}
                    >
                        <SafeIcon name="file-text" size={24} color="#10B981" type="lucide" />
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Mes Candidatures</Text>
                            <Text style={styles.actionSubtitle}>Suivez l'état de vos candidatures</Text>
                        </View>
                    </TouchableOpacity>
                </NativeCard>

                <NativeCard style={styles.actionCard}>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('ProfilCandidat')}
                        style={styles.actionButton}
                    >
                        <SafeIcon name="user" size={24} color="#F59E0B" type="lucide" />
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Mon Profil</Text>
                            <Text style={styles.actionSubtitle}>Complétez votre profil candidat</Text>
                        </View>
                    </TouchableOpacity>
                </NativeCard>
            </View>

            {/* Actions rapides - Employeur */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🏢 Espace Employeur</Text>
                <NativeCard style={styles.actionCard}>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('CreateOffre')}
                        style={styles.actionButton}
                    >
                        <SafeIcon name="plus" size={24} color="#8B5CF6" type="lucide" />
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Publier une Offre</Text>
                            <Text style={styles.actionSubtitle}>Créez une nouvelle offre d'emploi</Text>
                        </View>
                    </TouchableOpacity>
                </NativeCard>

                <NativeCard style={styles.actionCard}>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('MesOffres')}
                        style={styles.actionButton}
                    >
                        <SafeIcon name="briefcase" size={24} color="#EC4899" type="lucide" />
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Mes Offres</Text>
                            <Text style={styles.actionSubtitle}>Gérez vos offres publiées</Text>
                        </View>
                    </TouchableOpacity>
                </NativeCard>

                <NativeCard style={styles.actionCard}>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('DashboardEmploi')}
                        style={styles.actionButton}
                    >
                        <SafeIcon name="bar-chart" size={24} color="#06B6D4" type="lucide" />
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Tableau de Bord</Text>
                            <Text style={styles.actionSubtitle}>Statistiques et analyses</Text>
                        </View>
                    </TouchableOpacity>
                </NativeCard>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scrollContent: {
        padding: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: modernColors.textSecondary,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        gap: 12,
    },
    searchPlaceholder: {
        flex: 1,
        color: modernColors.textSecondary,
        fontSize: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 16,
    },
    actionCard: {
        marginBottom: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    actionSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    aiCard: {
        marginBottom: 16,
        padding: 20,
    },
    aiCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    aiCardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    aiCardText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
        lineHeight: 20,
    },
    aiButton: {
        marginTop: 8,
    },
});

export default OffresEmploiHubScreen;

