import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    Button,
    Card,
    Divider,
    List,
    Paragraph,
    Switch,
    Text,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const SettingsScreen = () => {
    const navigation = useNavigation();
    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useTheme();

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [dataSavingEnabled, setDataSavingEnabled] = useState(false);

    const handleLogout = () => {
        Alert.alert(
            'Déconnexion',
            'Êtes-vous sûr de vouloir vous déconnecter ?',
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnexion', style: 'destructive', onPress: logout },
            ]
        );
    };

    const handleClearCache = () => {
        Alert.alert(
            'Vider le cache',
            'Cette action supprimera les données temporaires de l\'application.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Vider',
                    onPress: () => {
                        // TODO: Implémenter la suppression du cache
                        Alert.alert('Succès', 'Cache vidé avec succès');
                    },
                },
            ]
        );
    };

    const handleExportData = () => {
        Alert.alert(
            'Exporter les données',
            'Vos données seront exportées au format JSON.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Exporter',
                    onPress: () => {
                        // TODO: Implémenter l'export des données
                        Alert.alert('Succès', 'Données exportées avec succès');
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                {/* Header */}
                <View style={styles.header}>
                    <Title style={styles.title}>Paramètres</Title>
                    <Paragraph style={styles.subtitle}>
                        Personnalisez votre expérience
                    </Paragraph>
                </View>

                {/* Account Section */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Compte</Title>

                        <List.Item
                            title="Profil"
                            description="Modifier vos informations personnelles"
                            left={(props) => <List.Icon {...props} icon="account" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => navigation.navigate('EditProfile' as never)}
                        />

                        <Divider />

                        <List.Item
                            title="Sécurité"
                            description="Mot de passe et authentification"
                            left={(props) => <List.Icon {...props} icon="shield" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => navigation.navigate('Security' as never)}
                        />

                        <Divider />

                        <List.Item
                            title="Tokens IA"
                            description={`${user?.tokens || 0} tokens restants`}
                            left={(props) => <List.Icon {...props} icon="robot" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => navigation.navigate('Tokens' as never)}
                        />
                    </Card.Content>
                </Card>

                {/* App Settings */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Application</Title>

                        <List.Item
                            title="Notifications"
                            description="Recevoir des notifications push"
                            left={(props) => <List.Icon {...props} icon="bell" />}
                            right={() => (
                                <Switch
                                    value={notificationsEnabled}
                                    onValueChange={setNotificationsEnabled}
                                />
                            )}
                        />

                        <Divider />

                        <List.Item
                            title="Localisation"
                            description="Utiliser la géolocalisation"
                            left={(props) => <List.Icon {...props} icon="map-marker" />}
                            right={() => (
                                <Switch
                                    value={locationEnabled}
                                    onValueChange={setLocationEnabled}
                                />
                            )}
                        />

                        <Divider />

                        <List.Item
                            title="Mode sombre"
                            description="Activer le thème sombre"
                            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                            right={() => (
                                <Switch
                                    value={isDark}
                                    onValueChange={toggleTheme}
                                />
                            )}
                        />

                        <Divider />

                        <List.Item
                            title="Économie de données"
                            description="Réduire l'utilisation des données"
                            left={(props) => <List.Icon {...props} icon="wifi" />}
                            right={() => (
                                <Switch
                                    value={dataSavingEnabled}
                                    onValueChange={setDataSavingEnabled}
                                />
                            )}
                        />
                    </Card.Content>
                </Card>

                {/* Language & Region */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Langue et région</Title>

                        <List.Item
                            title="Langue"
                            description="Français"
                            left={(props) => <List.Icon {...props} icon="translate" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => navigation.navigate('Language' as never)}
                        />

                        <Divider />

                        <List.Item
                            title="Région"
                            description="Sénégal"
                            left={(props) => <List.Icon {...props} icon="earth" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => navigation.navigate('Region' as never)}
                        />
                    </Card.Content>
                </Card>

                {/* Data Management */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Gestion des données</Title>

                        <List.Item
                            title="Vider le cache"
                            description="Supprimer les données temporaires"
                            left={(props) => <List.Icon {...props} icon="delete" />}
                            onPress={handleClearCache}
                        />

                        <Divider />

                        <List.Item
                            title="Exporter les données"
                            description="Télécharger vos données"
                            left={(props) => <List.Icon {...props} icon="download" />}
                            onPress={handleExportData}
                        />
                    </Card.Content>
                </Card>

                {/* Support */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Support</Title>

                        <List.Item
                            title="Aide et FAQ"
                            description="Obtenir de l'aide"
                            left={(props) => <List.Icon {...props} icon="help-circle" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => navigation.navigate('Help' as never)}
                        />

                        <Divider />

                        <List.Item
                            title="Nous contacter"
                            description="Support technique"
                            left={(props) => <List.Icon {...props} icon="email" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => navigation.navigate('Contact' as never)}
                        />

                        <Divider />

                        <List.Item
                            title="À propos"
                            description="Version 1.0.0"
                            left={(props) => <List.Icon {...props} icon="information" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => navigation.navigate('About' as never)}
                        />
                    </Card.Content>
                </Card>

                {/* Logout */}
                <View style={styles.logoutContainer}>
                    <Button
                        mode="outlined"
                        onPress={handleLogout}
                        style={styles.logoutButton}
                        textColor="#dc2626"
                        icon="logout"
                    >
                        Se déconnecter
                    </Button>
                </View>

                {/* App Version */}
                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>Yukpomnang Mobile v1.0.0</Text>
                    <Text style={styles.buildText}>Build 1.0.0 (100)</Text>
                </View>
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
    sectionCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    logoutContainer: {
        padding: 20,
        paddingTop: 0,
    },
    logoutButton: {
        borderColor: '#dc2626',
    },
    versionContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    versionText: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 4,
    },
    buildText: {
        fontSize: 10,
        color: '#cbd5e1',
    },
});

export default SettingsScreen;

