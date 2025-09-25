import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button, Card, Paragraph, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
// import { useGlobalIAStats } from '../components/intelligence/GlobalIAStats';
import ChatHistoryModal from '../components/ChatHistoryModal';
import NotificationHistoryModal from '../components/NotificationHistoryModal';
import { theme } from '../theme/theme';

const HomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    // const { stats, updateStats } = useGlobalIAStats();
    const [stats, setStats] = useState({ totalRequests: 0, lastActivity: null as Date | null });
    const [loading, setLoading] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isCreateService, setIsCreateService] = useState(false);
    const [showCreateServiceAlert, setShowCreateServiceAlert] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);

    const { width, height } = Dimensions.get('window');

    const handleSubmit = async () => {
        if (!inputText.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir une description');
            return;
        }

        try {
            setLoading(true);
            setStats({
                totalRequests: stats.totalRequests + 1,
                lastActivity: new Date(),
            });

            if (isCreateService) {
                setShowCreateServiceAlert(true);
                setLoading(false);
                return;
            }

            // Par défaut : RECHERCHE DIRECTE
            await handleSearch();

        } catch (err: any) {
            console.error('❌ Erreur Yukpo:', err);
            Alert.alert('Erreur', 'Une erreur est survenue lors du traitement');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        try {
            // Simuler l'appel API de recherche
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Rediriger vers les résultats de recherche
            navigation.navigate('ResultatBesoin' as never, {
                searchQuery: inputText,
                type: 'recherche_besoin'
            });
        } catch (err: any) {
            console.error('Erreur lors de la recherche:', err);
            Alert.alert('Erreur', 'Impossible d\'effectuer la recherche');
        }
    };

    const handleCreateService = async () => {
        try {
            // Simuler l'appel API de création de service
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Rediriger vers le formulaire de création
            navigation.navigate('FormulaireYukpoIntelligent' as never, {
                inputText: inputText,
                type: 'creation_service'
            });
        } catch (error) {
            console.error('Erreur lors de la création:', error);
            Alert.alert('Erreur', 'Impossible de créer le service');
        }
    };

    const confirmCreateService = () => {
        setLoading(true);
        handleCreateService();
        setShowCreateServiceAlert(false);
    };

    const cancelCreateService = () => {
        handleSearch();
        setShowCreateServiceAlert(false);
    };

    const YukpoBrand = () => (
        <Text style={styles.brandText}>Yukpomnang</Text>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header avec notifications et chat */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Title style={styles.welcomeText}>
                            Bonjour {user?.name || 'Utilisateur'} 👋
                        </Title>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setShowNotificationModal(true)}
                        >
                            <Ionicons name="notifications" size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setShowChatModal(true)}
                        >
                            <Ionicons name="chatbubbles" size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Contenu principal */}
                <View style={styles.mainContent}>
                    {/* Titre et description */}
                    <View style={styles.titleSection}>
                        <Title style={styles.title}>
                            <YukpoBrand />
                        </Title>
                        <Paragraph style={styles.subtitle}>
                            Créez ou trouvez un service en un instant.
                            {'\n'}Une description, une image, un audio ou un fichier suffit.
                        </Paragraph>
                    </View>

                    {/* Case à cocher pour création de service */}
                    <View style={styles.checkboxSection}>
                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setIsCreateService(!isCreateService)}
                        >
                            <View style={[styles.checkbox, isCreateService && styles.checkboxChecked]}>
                                {isCreateService && <Ionicons name="checkmark" size={16} color="white" />}
                            </View>
                            <Text style={styles.checkboxLabel}>
                                Je souhaite créer un service/prestation
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Zone de saisie */}
                    <Card style={styles.inputCard}>
                        <Card.Content>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Décrivez votre besoin ou service..."
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </Card.Content>
                    </Card>

                    {/* Bouton d'envoi moderne et responsive */}
                    <View style={[styles.submitContainer, { width: width - 32 }]}>
                        <Button
                            mode="contained"
                            onPress={handleSubmit}
                            loading={loading}
                            disabled={loading || !inputText.trim()}
                            style={[styles.submitButton, { width: width - 64 }]}
                            contentStyle={styles.submitButtonContent}
                            labelStyle={styles.submitButtonLabel}
                        >
                            {loading ? 'Traitement...' : (isCreateService ? 'Créer un service' : 'Rechercher')}
                        </Button>
                    </View>

                    {/* Indicateurs visuels */}
                    <View style={styles.featuresSection}>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>🎯</Text>
                            <Text style={styles.featureText}>Détection intelligente</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>⚡</Text>
                            <Text style={styles.featureText}>Traitement rapide</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>🔐</Text>
                            <Text style={styles.featureText}>100% sécurisé</Text>
                        </View>
                    </View>

                    {/* Actions rapides pour utilisateurs connectés */}
                    {user && (
                        <View style={styles.quickActions}>
                            <Title style={styles.quickActionsTitle}>Actions rapides</Title>
                            <View style={styles.actionsGrid}>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => navigation.navigate('MyServices' as never)}
                                >
                                    <Ionicons name="briefcase" size={32} color={theme.colors.primary} />
                                    <Text style={styles.actionText}>Mes Services</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => navigation.navigate('Profile' as never)}
                                >
                                    <Ionicons name="person" size={32} color={theme.colors.primary} />
                                    <Text style={styles.actionText}>Mon Profil</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => navigation.navigate('SoldeDetail' as never)}
                                >
                                    <Ionicons name="time" size={32} color={theme.colors.primary} />
                                    <Text style={styles.actionText}>Historique</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => navigation.navigate('RechargeTokens' as never)}
                                >
                                    <Ionicons name="card" size={32} color={theme.colors.primary} />
                                    <Text style={styles.actionText}>Recharger</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Alerte de confirmation pour création de service */}
            {showCreateServiceAlert && (
                <View style={styles.alertOverlay}>
                    <View style={styles.alertContainer}>
                        <Title style={styles.alertTitle}>
                            Confirmation de création de service
                        </Title>
                        <Paragraph style={styles.alertText}>
                            Êtes-vous sûr de vouloir créer un service/prestation sur la plateforme ?
                        </Paragraph>
                        <View style={styles.alertButtons}>
                            <Button
                                mode="outlined"
                                onPress={cancelCreateService}
                                disabled={loading}
                                style={styles.alertButton}
                            >
                                Non, rechercher
                            </Button>
                            <Button
                                mode="contained"
                                onPress={confirmCreateService}
                                loading={loading}
                                disabled={loading}
                                style={[styles.alertButton, styles.alertButtonPrimary]}
                            >
                                Oui, créer un service
                            </Button>
                        </View>
                    </View>
                </View>
            )}

            {/* Modales */}
            <NotificationHistoryModal
                isOpen={showNotificationModal}
                onClose={() => setShowNotificationModal(false)}
            />
            <ChatHistoryModal
                isOpen={showChatModal}
                onClose={() => setShowChatModal(false)}
                onOpenChat={(chatId: string) => {
                    console.log('Ouvrir chat:', chatId);
                    setShowChatModal(false);
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerLeft: {
        flex: 1,
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: theme.colors.surface,
    },
    mainContent: {
        flex: 1,
        alignItems: 'center',
    },
    titleSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    brandText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    checkboxSection: {
        marginBottom: 24,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        borderRadius: 4,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: theme.colors.primary,
    },
    checkboxLabel: {
        fontSize: 14,
        color: theme.colors.text,
    },
    inputCard: {
        width: '100%',
        marginBottom: 24,
        elevation: 2,
    },
    textInput: {
        fontSize: 16,
        color: theme.colors.text,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    submitContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    submitButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: 12,
        elevation: 4,
    },
    submitButtonContent: {
        paddingVertical: 12,
    },
    submitButtonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    featuresSection: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 32,
    },
    featureItem: {
        alignItems: 'center',
    },
    featureIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    featureText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    quickActions: {
        width: '100%',
    },
    quickActionsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    actionCard: {
        width: '48%',
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
        elevation: 2,
    },
    actionText: {
        fontSize: 14,
        color: theme.colors.text,
        marginTop: 8,
        textAlign: 'center',
    },
    alertOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertContainer: {
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    alertTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    alertText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 22,
    },
    alertButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    alertButton: {
        flex: 1,
    },
    alertButtonPrimary: {
        backgroundColor: theme.colors.primary,
    },
});

export default HomeScreen;






