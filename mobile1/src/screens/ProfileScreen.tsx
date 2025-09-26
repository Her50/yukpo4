import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    Avatar,
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

const ProfileScreen = () => {
    const navigation = useNavigation();
    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useTheme();

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);

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

    const ProfileMenuItem = ({
        title,
        subtitle,
        icon,
        onPress,
        right
    }: {
        title: string;
        subtitle?: string;
        icon: string;
        onPress?: () => void;
        right?: React.ReactNode;
    }) => (
        <List.Item
            title={title}
            description={subtitle}
            left={(props) => <List.Icon {...props} icon={icon} />}
            right={right}
            onPress={onPress}
            style={styles.menuItem}
        />
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                {/* Profile Header */}
                <Card style={styles.profileCard}>
                    <Card.Content style={styles.profileContent}>
                        <Avatar.Text
                            size={80}
                            label={user?.name?.charAt(0) || 'U'}
                            style={styles.avatar}
                        />
                        <View style={styles.profileInfo}>
                            <Title style={styles.profileName}>{user?.name}</Title>
                            <Paragraph style={styles.profileEmail}>{user?.email}</Paragraph>
                            <Chip mode="outlined" style={styles.roleChip}>
                                {user?.role || 'Utilisateur'}
                            </Chip>
                        </View>
                    </Card.Content>
                </Card>

                {/* Account Section */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Compte</Title>

                        <ProfileMenuItem
                            title="Mon profil"
                            subtitle="Modifier vos informations"
                            icon="account"
                            onPress={() => navigation.navigate('EditProfile' as never)}
                        />

                        <Divider />

                        <ProfileMenuItem
                            title="Mes services"
                            subtitle="Gérer vos services"
                            icon="briefcase"
                            onPress={() => navigation.navigate('MyServices' as never)}
                        />

                        <Divider />

                        <ProfileMenuItem
                            title="Historique des commandes"
                            subtitle="Voir vos commandes"
                            icon="history"
                            onPress={() => navigation.navigate('OrderHistory' as never)}
                        />

                        <Divider />

                        <ProfileMenuItem
                            title="Tokens IA"
                            subtitle={`${user?.tokens || 0} tokens restants`}
                            icon="robot"
                            onPress={() => navigation.navigate('Tokens' as never)}
                        />
                    </Card.Content>
                </Card>

                {/* Settings Section */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Paramètres</Title>

                        <ProfileMenuItem
                            title="Notifications"
                            subtitle="Recevoir des notifications"
                            icon="bell"
                            right={
                                <Switch
                                    value={notificationsEnabled}
                                    onValueChange={setNotificationsEnabled}
                                />
                            }
                        />

                        <Divider />

                        <ProfileMenuItem
                            title="Localisation"
                            subtitle="Utiliser la géolocalisation"
                            icon="map-marker"
                            right={
                                <Switch
                                    value={locationEnabled}
                                    onValueChange={setLocationEnabled}
                                />
                            }
                        />

                        <Divider />

                        <ProfileMenuItem
                            title="Mode sombre"
                            subtitle="Activer le thème sombre"
                            icon="theme-light-dark"
                            right={
                                <Switch
                                    value={isDark}
                                    onValueChange={toggleTheme}
                                />
                            }
                        />

                        <Divider />

                        <ProfileMenuItem
                            title="Langue"
                            subtitle="Français"
                            icon="translate"
                            onPress={() => navigation.navigate('Language' as never)}
                        />
                    </Card.Content>
                </Card>

                {/* Support Section */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Support</Title>

                        <ProfileMenuItem
                            title="Aide et FAQ"
                            subtitle="Obtenir de l'aide"
                            icon="help-circle"
                            onPress={() => navigation.navigate('Help' as never)}
                        />

                        <Divider />

                        <ProfileMenuItem
                            title="Nous contacter"
                            subtitle="Support technique"
                            icon="email"
                            onPress={() => navigation.navigate('Contact' as never)}
                        />

                        <Divider />

                        <ProfileMenuItem
                            title="À propos"
                            subtitle="Version 1.0.0"
                            icon="information"
                            onPress={() => navigation.navigate('About' as never)}
                        />
                    </Card.Content>
                </Card>

                {/* Logout Button */}
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
    profileCard: {
        margin: 20,
        marginBottom: 16,
        elevation: 2,
    },
    profileContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        backgroundColor: '#2563eb',
        marginRight: 16,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
    },
    roleChip: {
        alignSelf: 'flex-start',
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
    menuItem: {
        paddingVertical: 8,
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
    },
});

export default ProfileScreen;

