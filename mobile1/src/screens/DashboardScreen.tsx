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
    Button,
    Card,
    Divider,
    ProgressBar,
    Text,
    Title
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { serviceService, userService } from '../services/api';

interface DashboardStats {
    totalServices: number;
    activeServices: number;
    totalViews: number;
    totalEarnings: number;
    tokensUsed: number;
    tokensRemaining: number;
}

const DashboardScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [stats, setStats] = useState<DashboardStats>({
        totalServices: 0,
        activeServices: 0,
        totalViews: 0,
        totalEarnings: 0,
        tokensUsed: 0,
        tokensRemaining: 0,
    });
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Charger les données utilisateur
            const userResponse = await userService.getProfile();
            const userData = userResponse.data;

            // Charger les services de l'utilisateur
            const servicesResponse = await serviceService.getUserServices();
            const userServices = servicesResponse.data.services || [];

            // Calculer les statistiques
            const newStats: DashboardStats = {
                totalServices: userServices.length,
                activeServices: userServices.filter((s: any) => s.status === 'active').length,
                totalViews: userServices.reduce((sum: number, s: any) => sum + (s.views || 0), 0),
                totalEarnings: userServices.reduce((sum: number, s: any) => sum + (s.earnings || 0), 0),
                tokensUsed: userData.tokensUsed || 0,
                tokensRemaining: userData.tokens || 0,
            };

            setStats(newStats);
        } catch (error) {
            console.error('Erreur lors du chargement du dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDashboardData();
        setRefreshing(false);
    };

    const StatCard = ({ title, value, icon, color = '#2563eb' }: {
        title: string;
        value: string | number;
        icon: string;
        color?: string;
    }) => (
        <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
                <View style={styles.statHeader}>
                    <Ionicons name={icon as any} size={24} color={color} />
                    <Text style={[styles.statValue, { color }]}>{value}</Text>
                </View>
                <Text style={styles.statTitle}>{title}</Text>
            </Card.Content>
        </Card>
    );

    const QuickActionButton = ({ title, icon, onPress, color = '#2563eb' }: {
        title: string;
        icon: string;
        onPress: () => void;
        color?: string;
    }) => (
        <Button
            mode="contained"
            onPress={onPress}
            style={[styles.quickActionButton, { backgroundColor: color }]}
            icon={icon}
        >
            {title}
        </Button>
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
                    <Title style={styles.title}>Tableau de bord</Title>
                    <Text style={styles.subtitle}>
                        Bonjour {user?.name}, voici un aperçu de votre activité
                    </Text>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                    <View style={styles.statsRow}>
                        <StatCard
                            title="Services totaux"
                            value={stats.totalServices}
                            icon="briefcase"
                            color="#2563eb"
                        />
                        <StatCard
                            title="Services actifs"
                            value={stats.activeServices}
                            icon="checkmark-circle"
                            color="#10b981"
                        />
                    </View>

                    <View style={styles.statsRow}>
                        <StatCard
                            title="Vues totales"
                            value={stats.totalViews}
                            icon="eye"
                            color="#f59e0b"
                        />
                        <StatCard
                            title="Gains (FCFA)"
                            value={stats.totalEarnings.toLocaleString()}
                            icon="cash"
                            color="#10b981"
                        />
                    </View>
                </View>

                {/* Tokens Section */}
                <Card style={styles.tokensCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Tokens IA</Title>
                        <View style={styles.tokensInfo}>
                            <View style={styles.tokenStat}>
                                <Text style={styles.tokenLabel}>Tokens restants</Text>
                                <Text style={styles.tokenValue}>{stats.tokensRemaining}</Text>
                            </View>
                            <View style={styles.tokenStat}>
                                <Text style={styles.tokenLabel}>Tokens utilisés</Text>
                                <Text style={styles.tokenValue}>{stats.tokensUsed}</Text>
                            </View>
                        </View>

                        <ProgressBar
                            progress={stats.tokensRemaining / (stats.tokensRemaining + stats.tokensUsed)}
                            color="#2563eb"
                            style={styles.progressBar}
                        />

                        <Button
                            mode="outlined"
                            onPress={() => navigation.navigate('RechargeTokens' as never)}
                            style={styles.rechargeButton}
                            icon="plus"
                        >
                            Recharger des tokens
                        </Button>
                    </Card.Content>
                </Card>

                {/* Quick Actions */}
                <View style={styles.quickActionsSection}>
                    <Title style={styles.sectionTitle}>Actions rapides</Title>

                    <View style={styles.quickActionsGrid}>
                        <QuickActionButton
                            title="Créer un service"
                            icon="plus"
                            onPress={() => navigation.navigate('CreateService' as never)}
                            color="#2563eb"
                        />
                        <QuickActionButton
                            title="Mes services"
                            icon="briefcase"
                            onPress={() => navigation.navigate('MyServices' as never)}
                            color="#10b981"
                        />
                    </View>

                    <View style={styles.quickActionsGrid}>
                        <QuickActionButton
                            title="Hub IA"
                            icon="robot"
                            onPress={() => navigation.navigate('AIHub' as never)}
                            color="#7c3aed"
                        />
                        <QuickActionButton
                            title="Paramètres"
                            icon="settings"
                            onPress={() => navigation.navigate('Settings' as never)}
                            color="#64748b"
                        />
                    </View>
                </View>

                {/* Recent Activity */}
                <Card style={styles.activityCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Activité récente</Title>

                        <View style={styles.activityItem}>
                            <Ionicons name="eye" size={20} color="#2563eb" />
                            <View style={styles.activityContent}>
                                <Text style={styles.activityTitle}>Nouvelle vue sur votre service</Text>
                                <Text style={styles.activityTime}>Il y a 2 heures</Text>
                            </View>
                        </View>

                        <Divider style={styles.activityDivider} />

                        <View style={styles.activityItem}>
                            <Ionicons name="chatbubble" size={20} color="#10b981" />
                            <View style={styles.activityContent}>
                                <Text style={styles.activityTitle}>Nouveau message reçu</Text>
                                <Text style={styles.activityTime}>Il y a 4 heures</Text>
                            </View>
                        </View>

                        <Divider style={styles.activityDivider} />

                        <View style={styles.activityItem}>
                            <Ionicons name="star" size={20} color="#f59e0b" />
                            <View style={styles.activityContent}>
                                <Text style={styles.activityTitle}>Nouvelle évaluation</Text>
                                <Text style={styles.activityTime}>Hier</Text>
                            </View>
                        </View>
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
    statsContainer: {
        padding: 20,
        paddingTop: 10,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        elevation: 2,
    },
    statContent: {
        padding: 16,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    statTitle: {
        fontSize: 14,
        color: '#64748b',
    },
    tokensCard: {
        margin: 20,
        marginTop: 0,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 16,
    },
    tokensInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    tokenStat: {
        alignItems: 'center',
    },
    tokenLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    tokenValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        marginBottom: 16,
    },
    rechargeButton: {
        marginTop: 8,
    },
    quickActionsSection: {
        padding: 20,
        paddingTop: 0,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 12,
    },
    quickActionButton: {
        flex: 1,
    },
    activityCard: {
        margin: 20,
        marginTop: 0,
        elevation: 2,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    activityContent: {
        marginLeft: 12,
        flex: 1,
    },
    activityTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1e293b',
        marginBottom: 2,
    },
    activityTime: {
        fontSize: 12,
        color: '#64748b',
    },
    activityDivider: {
        marginVertical: 4,
    },
});

export default DashboardScreen;

