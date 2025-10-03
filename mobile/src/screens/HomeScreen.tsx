import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

const HomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    // Fonctions de navigation simples
    const handleSearch = () => {
        (navigation as any).navigate('Search');
    };

    const handleCreateService = () => {
        (navigation as any).navigate('Create');
    };

    const handleServices = () => {
        (navigation as any).navigate('Services');
    };

    const handleProfile = () => {
        (navigation as any).navigate('Account');
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header avec informations utilisateur */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View>
                            <Text style={styles.greetingText}>Bonjour 👋</Text>
                            <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
                            <View style={styles.balanceContainer}>
                                <Text style={styles.walletIcon}>💰</Text>
                                <Text style={styles.balanceText}>{user?.credits?.toLocaleString() || 0} tokens</Text>
                            </View>
                        </View>
                        <View style={styles.headerButtons}>
                            <TouchableOpacity style={styles.headerButton}>
                                <Text style={styles.notificationIcon}>🔔</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerButton}>
                                <Text style={styles.chatIcon}>💬</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Titre principal */}
                <View style={styles.titleContainer}>
                    <View style={styles.brandContainer}>
                        <Text style={styles.brandEmoji}>🏠</Text>
                        <Text style={styles.brandTitle}>
                            <Text style={styles.brandYuk}>Yukpo</Text>
                            <Text style={styles.brandMnang}>mnang</Text>
                        </Text>
                    </View>
                    <Text style={styles.subtitle}>
                        Créez ou trouvez un service en un instant.{'\n'}
                        Une description, une image, un audio ou un fichier suffit.
                    </Text>
                </View>

                {/* Actions principales */}
                <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleSearch}>
                        <Text style={styles.actionEmoji}>🔍</Text>
                        <Text style={styles.actionText}>Rechercher un service</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={handleCreateService}>
                        <Text style={styles.actionEmoji}>➕</Text>
                        <Text style={styles.actionText}>Créer un service</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={handleServices}>
                        <Text style={styles.actionEmoji}>📋</Text>
                        <Text style={styles.actionText}>Mes services</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={handleProfile}>
                        <Text style={styles.actionEmoji}>👤</Text>
                        <Text style={styles.actionText}>Mon profil</Text>
                    </TouchableOpacity>
                </View>

                {/* Section Comment ça marche */}
                <View style={styles.howItWorksSection}>
                    <Text style={styles.sectionTitle}>Comment ça marche ?</Text>

                    <View style={styles.stepCard}>
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>1</Text>
                        </View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Décrivez votre besoin</Text>
                            <Text style={styles.stepDescription}>
                                Texte, photo, audio ou fichier
                            </Text>
                        </View>
                    </View>

                    <View style={styles.stepCard}>
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>2</Text>
                        </View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>L'IA analyse</Text>
                            <Text style={styles.stepDescription}>
                                Résultats personnalisés instantanés
                            </Text>
                        </View>
                    </View>

                    <View style={styles.stepCard}>
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>3</Text>
                        </View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Connectez-vous</Text>
                            <Text style={styles.stepDescription}>
                                Contact direct avec les prestataires
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Section informations */}
                <View style={styles.infoSection}>
                    <Text style={styles.infoTitle}>À propos de Yukpomnang</Text>
                    <Text style={styles.infoText}>
                        Yukpomnang est votre plateforme de services ultra-moderne.
                        Trouvez ou proposez des services en toute simplicité, grâce à notre IA intelligente.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    scrollContent: {
        paddingBottom: 32,
    },
    header: {
        backgroundColor: '#FFF',
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 24,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greetingText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    balanceText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6366F1',
        marginLeft: 6,
    },
    walletIcon: {
        fontSize: 16,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationIcon: {
        fontSize: 24,
    },
    chatIcon: {
        fontSize: 24,
    },
    titleContainer: {
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    brandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    brandEmoji: {
        fontSize: 50,
        marginRight: 12,
    },
    brandTitle: {
        fontSize: 42,
        fontWeight: 'bold',
    },
    brandYuk: {
        color: '#6366F1',
        fontWeight: 'bold',
    },
    brandMnang: {
        color: '#1A1A1A',
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginHorizontal: 20,
        marginBottom: 32,
        gap: 16,
    },
    actionButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        width: '48%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    actionEmoji: {
        fontSize: 40,
        marginBottom: 12,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
    howItWorksSection: {
        marginHorizontal: 20,
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 20,
    },
    stepCard: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    stepNumber: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    stepNumberText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
    },
    stepContent: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 6,
    },
    stepDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    infoSection: {
        backgroundColor: '#E8F0FE',
        borderRadius: 20,
        padding: 24,
        marginHorizontal: 20,
        marginBottom: 20,
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#3B82F6',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 16,
        color: '#555',
        lineHeight: 24,
    },
});

export default HomeScreen;