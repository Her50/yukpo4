// ✅ Hub pour orientation scolaire (Mobile) - Amélioré avec IA

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const OrientationScolaireHubScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasProfile, setHasProfile] = useState(false);
    const [profileId, setProfileId] = useState<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            checkProfile();
        }, [user])
    );

    const checkProfile = async () => {
        if (!user) return;
        try {
            const response = await apiGet<{ profile: any }>('/api/orientation/my-profile');
            if (response.profile || response.data?.profile) {
                setHasProfile(true);
                setProfileId(response.profile?.id || response.data?.profile?.id);
            }
        } catch (error) {
            // Pas de profil, c'est normal
            setHasProfile(false);
        }
    };

    const handleAnalyzeProfile = async () => {
        if (!profileId) {
            Alert.alert('Profil requis', 'Veuillez d\'abord créer votre profil étudiant');
            return;
        }
        try {
            setLoading(true);
            const response = await apiPost('/api/orientation/ai/analyze-profile', {
                profile_id: profileId,
            });
            if (response.success) {
                Alert.alert(
                    'Analyse terminée',
                    'Votre profil a été analysé avec succès. Consultez les recommandations !'
                );
            }
        } catch (error: any) {
            Alert.alert('Erreur', 'Impossible d\'analyser le profil');
        } finally {
            setLoading(false);
        }
    };

    const handleGetRecommendations = () => {
        if (!hasProfile) {
            Alert.alert('Profil requis', 'Veuillez d\'abord créer votre profil étudiant');
            return;
        }
        navigation.navigate('EtablissementSearch');
    };

    const handleComparePrograms = () => {
        if (!hasProfile) {
            Alert.alert('Profil requis', 'Veuillez d\'abord créer votre profil étudiant');
            return;
        }
        navigation.navigate('OrientationAIComparePrograms');
    };

    const etablissementTypes = [
        {
            id: 'primaire',
            name: 'Primaire',
            icon: '📚',
            color: '#10B981',
            route: 'EtablissementSearch',
            params: { type: 'primaire' },
        },
        {
            id: 'secondaire',
            name: 'Secondaire',
            icon: '🎓',
            color: '#3B82F6',
            route: 'EtablissementSearch',
            params: { type: 'secondaire' },
        },
        {
            id: 'superieur',
            name: 'Supérieur',
            icon: '🎓',
            color: '#8B5CF6',
            route: 'EtablissementSearch',
            params: { type: 'superieur' },
        },
    ];

    const quickActions = [
        {
            id: 'concours',
            name: 'Concours actifs',
            icon: '🏆',
            route: 'ConcoursList',
        },
        {
            id: 'conferences',
            name: 'Conférences',
            icon: '📺',
            route: 'ConferencesList',
        },
        {
            id: 'programmes',
            name: 'Programmes',
            icon: '📖',
            route: 'ProgrammesList',
        },
        {
            id: 'fournitures',
            name: 'Fournitures',
            icon: '✏️',
            route: 'FournituresList',
        },
    ];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Orientation Scolaire</Text>
                <Text style={styles.subtitle}>
                    Trouvez l'établissement idéal pour vous ou vos enfants
                </Text>
            </View>

            {/* Types d'établissements */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Types d'établissements</Text>
                <View style={styles.grid}>
                    {etablissementTypes.map((type) => (
                        <TouchableOpacity
                            key={type.id}
                            style={[styles.typeCard, { borderTopColor: type.color }]}
                            onPress={() => navigation.navigate(type.route, type.params)}
                        >
                            <Text style={styles.typeIcon}>{type.icon}</Text>
                            <Text style={styles.typeName}>{type.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Actions rapides */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actions rapides</Text>
                <View style={styles.actionsGrid}>
                    {quickActions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={styles.actionCard}
                            onPress={() => navigation.navigate(action.route)}
                        >
                            <Text style={styles.actionIcon}>{action.icon}</Text>
                            <Text style={styles.actionName}>{action.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Suggestions IA */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🤖 Intelligence Artificielle</Text>

                {!hasProfile && (
                    <NativeCard style={styles.profileCard}>
                        <Text style={styles.profileCardTitle}>📝 Créer votre profil</Text>
                        <Text style={styles.profileCardText}>
                            Créez votre profil étudiant pour obtenir des recommandations personnalisées
                        </Text>
                        <NativeButton
                            title="Créer mon profil"
                            onPress={() => navigation.navigate('ProfilEtudiant')}
                            variant="primary"
                            style={styles.profileButton}
                        />
                    </NativeCard>
                )}

                {hasProfile && (
                    <>
                        <NativeCard style={styles.aiCard}>
                            <View style={styles.aiCardHeader}>
                                <SafeIcon name="sparkles" size={24} color="#8B5CF6" />
                                <Text style={styles.aiCardTitle}>Analyse de profil IA</Text>
                            </View>
                            <Text style={styles.aiCardText}>
                                Analysez votre profil académique et obtenez des insights personnalisés
                            </Text>
                            <NativeButton
                                title={loading ? 'Analyse en cours...' : 'Analyser mon profil'}
                                onPress={handleAnalyzeProfile}
                                variant="primary"
                                disabled={loading}
                                style={styles.aiButton}
                            />
                        </NativeCard>

                        <NativeCard style={styles.aiCard}>
                            <View style={styles.aiCardHeader}>
                                <SafeIcon name="target" size={24} color="#10B981" />
                                <Text style={styles.aiCardTitle}>Recommandations IA</Text>
                            </View>
                            <Text style={styles.aiCardText}>
                                Obtenez des recommandations personnalisées d'établissements et programmes
                            </Text>
                            <NativeButton
                                title="Obtenir des recommandations"
                                onPress={handleGetRecommendations}
                                variant="secondary"
                                style={styles.aiButton}
                            />
                        </NativeCard>

                        <NativeCard style={styles.aiCard}>
                            <View style={styles.aiCardHeader}>
                                <SafeIcon name="git-compare" size={24} color="#3B82F6" />
                                <Text style={styles.aiCardTitle}>Comparer des programmes</Text>
                            </View>
                            <Text style={styles.aiCardText}>
                                Comparez deux programmes ou établissements avec l'IA
                            </Text>
                            <NativeButton
                                title="Comparer"
                                onPress={handleComparePrograms}
                                variant="outline"
                                style={styles.aiButton}
                            />
                        </NativeCard>
                    </>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    typeCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderTopWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    typeIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    typeName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    actionCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    actionIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    actionName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        textAlign: 'center',
    },
    suggestCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 2,
        borderColor: '#3B82F6',
    },
    suggestTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    suggestText: {
        fontSize: 14,
        color: '#6B7280',
    },
    profileCard: {
        marginBottom: 16,
        padding: 20,
        backgroundColor: '#F0F9FF',
        borderWidth: 2,
        borderColor: '#3B82F6',
    },
    profileCardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    profileCardText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    profileButton: {
        marginTop: 8,
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

export default OrientationScolaireHubScreen;

