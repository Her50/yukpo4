import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    Card,
    Chip,
    Paragraph,
    ProgressBar,
    Text,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/api';

interface AIFeature {
    id: string;
    title: string;
    description: string;
    icon: string;
    color: string;
    available: boolean;
    tokensRequired: number;
}

const AIHubScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [userTokens, setUserTokens] = useState(0);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const aiFeatures: AIFeature[] = [
        {
            id: 'chat',
            title: 'Chat IA',
            description: 'Discutez avec notre IA pour obtenir des conseils et de l\'aide',
            icon: 'chatbubble',
            color: '#2563eb',
            available: true,
            tokensRequired: 5,
        },
        {
            id: 'search',
            title: 'Recherche intelligente',
            description: 'Trouvez des services avec des descriptions naturelles',
            icon: 'search',
            color: '#10b981',
            available: true,
            tokensRequired: 3,
        },
        {
            id: 'translation',
            title: 'Traduction',
            description: 'Traduisez du texte dans différentes langues',
            icon: 'language',
            color: '#f59e0b',
            available: true,
            tokensRequired: 2,
        },
        {
            id: 'suggestions',
            title: 'Suggestions de services',
            description: 'Obtenez des recommandations personnalisées',
            icon: 'lightbulb',
            color: '#7c3aed',
            available: true,
            tokensRequired: 4,
        },
        {
            id: 'content',
            title: 'Génération de contenu',
            description: 'Créez des descriptions de services automatiquement',
            icon: 'create',
            color: '#ef4444',
            available: true,
            tokensRequired: 8,
        },
    ];

    useEffect(() => {
        loadUserTokens();
    }, []);

    const loadUserTokens = async () => {
        try {
            setLoading(true);
            const response = await userService.getTokens();
            setUserTokens(response.data.tokens || 0);
        } catch (error) {
            console.error('Erreur lors du chargement des tokens:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadUserTokens();
        setRefreshing(false);
    };

    const handleFeaturePress = (feature: AIFeature) => {
        if (!feature.available) {
            return;
        }

        if (userTokens < feature.tokensRequired) {
            // Rediriger vers la page de recharge
            navigation.navigate('RechargeTokens' as never);
            return;
        }

        switch (feature.id) {
            case 'chat':
                navigation.navigate('AIChat' as never);
                break;
            case 'search':
                navigation.navigate('Search' as never);
                break;
            case 'translation':
                navigation.navigate('Translation' as never);
                break;
            case 'suggestions':
                navigation.navigate('Suggestions' as never);
                break;
            case 'content':
                navigation.navigate('ContentGeneration' as never);
                break;
        }
    };

    const FeatureCard = ({ feature }: { feature: AIFeature }) => (
        <Card
            style={[
                styles.featureCard,
                !feature.available && styles.disabledCard
            ]}
            onPress={() => handleFeaturePress(feature)}
        >
            <Card.Content style={styles.featureContent}>
                <View style={styles.featureHeader}>
                    <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
                        <Ionicons name={feature.icon as any} size={24} color="#ffffff" />
                    </View>
                    <View style={styles.featureInfo}>
                        <Title style={styles.featureTitle}>{feature.title}</Title>
                        <View style={styles.tokenInfo}>
                            <Ionicons name="diamond" size={16} color="#2563eb" />
                            <Text style={styles.tokenText}>{feature.tokensRequired} tokens</Text>
                        </View>
                    </View>
                </View>

                <Paragraph style={styles.featureDescription}>
                    {feature.description}
                </Paragraph>

                {!feature.available && (
                    <Chip mode="outlined" style={styles.comingSoonChip}>
                        Bientôt disponible
                    </Chip>
                )}
            </Card.Content>
        </Card>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Title style={styles.title}>Hub IA</Title>
                    <Paragraph style={styles.subtitle}>
                        Découvrez les fonctionnalités d'intelligence artificielle
                    </Paragraph>
                </View>

                {/* Tokens Status */}
                <Card style={styles.tokensCard}>
                    <Card.Content>
                        <View style={styles.tokensHeader}>
                            <Title style={styles.tokensTitle}>Mes tokens IA</Title>
                            <Button
                                mode="outlined"
                                onPress={() => navigation.navigate('RechargeTokens' as never)}
                                compact
                            >
                                Recharger
                            </Button>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="small" color="#2563eb" />
                        ) : (
                            <>
                                <Text style={styles.tokensCount}>{userTokens} tokens</Text>
                                <ProgressBar
                                    progress={userTokens / 100} // Assuming 100 is max
                                    color="#2563eb"
                                    style={styles.progressBar}
                                />
                                <Text style={styles.tokensDescription}>
                                    Utilisez vos tokens pour accéder aux fonctionnalités IA
                                </Text>
                            </>
                        )}
                    </Card.Content>
                </Card>

                {/* AI Features */}
                <View style={styles.featuresSection}>
                    <Title style={styles.sectionTitle}>Fonctionnalités disponibles</Title>

                    {aiFeatures.map((feature) => (
                        <FeatureCard key={feature.id} feature={feature} />
                    ))}
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActionsSection}>
                    <Title style={styles.sectionTitle}>Actions rapides</Title>

                    <View style={styles.quickActionsGrid}>
                        <Button
                            mode="contained"
                            onPress={() => navigation.navigate('AIChat' as never)}
                            style={styles.quickActionButton}
                            icon="chat"
                        >
                            Chat IA
                        </Button>

                        <Button
                            mode="outlined"
                            onPress={() => navigation.navigate('Search' as never)}
                            style={styles.quickActionButton}
                            icon="search"
                        >
                            Recherche
                        </Button>
                    </View>
                </View>

                {/* Tips */}
                <Card style={styles.tipsCard}>
                    <Card.Content>
                        <Title style={styles.tipsTitle}>💡 Conseils</Title>
                        <Paragraph style={styles.tipText}>
                            • Utilisez des descriptions détaillées pour de meilleurs résultats
                        </Paragraph>
                        <Paragraph style={styles.tipText}>
                            • Les tokens sont débités à chaque utilisation
                        </Paragraph>
                        <Paragraph style={styles.tipText}>
                            • Rechargez vos tokens pour continuer à utiliser l'IA
                        </Paragraph>
                    </Card.Content>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
    },
    tokensCard: {
        margin: 20,
        marginTop: 10,
        elevation: 2,
    },
    tokensHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    tokensTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    tokensCount: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2563eb',
        marginBottom: 8,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        marginBottom: 8,
    },
    tokensDescription: {
        fontSize: 14,
        color: '#64748b',
    },
    featuresSection: {
        padding: 20,
        paddingTop: 0,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 16,
    },
    featureCard: {
        marginBottom: 16,
        elevation: 2,
    },
    disabledCard: {
        opacity: 0.6,
    },
    featureContent: {
        padding: 16,
    },
    featureHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureInfo: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tokenText: {
        fontSize: 12,
        color: '#2563eb',
        marginLeft: 4,
        fontWeight: '500',
    },
    featureDescription: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
    },
    comingSoonChip: {
        alignSelf: 'flex-start',
    },
    quickActionsSection: {
        padding: 20,
        paddingTop: 0,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    quickActionButton: {
        flex: 1,
    },
    tipsCard: {
        margin: 20,
        marginTop: 0,
        elevation: 2,
    },
    tipsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 12,
    },
    tipText: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
    },
});

export default AIHubScreen;

