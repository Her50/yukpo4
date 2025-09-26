import { Ionicons } from '@expo/vector-icons';
import {
    Linking,
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
    Text,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const AboutScreen = () => {
    const handleOpenLink = (url: string) => {
        Linking.openURL(url);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                {/* Header */}
                <View style={styles.header}>
                    <Title style={styles.title}>À propos</Title>
                    <Paragraph style={styles.subtitle}>
                        Yukpomnang Mobile
                    </Paragraph>
                </View>

                {/* App Info */}
                <Card style={styles.infoCard}>
                    <Card.Content style={styles.appInfo}>
                        <View style={styles.logoContainer}>
                            <Ionicons name="briefcase" size={64} color="#2563eb" />
                        </View>
                        <Title style={styles.appName}>Yukpomnang</Title>
                        <Paragraph style={styles.appDescription}>
                            La plateforme de services intelligente qui connecte les prestataires
                            et les clients grâce à l'intelligence artificielle.
                        </Paragraph>
                        <Text style={styles.versionText}>Version 1.0.0</Text>
                    </Card.Content>
                </Card>

                {/* Features */}
                <Card style={styles.featuresCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Fonctionnalités</Title>

                        <View style={styles.featureItem}>
                            <Ionicons name="search" size={20} color="#2563eb" />
                            <Text style={styles.featureText}>Recherche intelligente de services</Text>
                        </View>

                        <View style={styles.featureItem}>
                            <Ionicons name="robot" size={20} color="#10b981" />
                            <Text style={styles.featureText}>Assistant IA intégré</Text>
                        </View>

                        <View style={styles.featureItem}>
                            <Ionicons name="map-marker" size={20} color="#f59e0b" />
                            <Text style={styles.featureText}>Géolocalisation précise</Text>
                        </View>

                        <View style={styles.featureItem}>
                            <Ionicons name="chatbubble" size={20} color="#7c3aed" />
                            <Text style={styles.featureText}>Chat en temps réel</Text>
                        </View>

                        <View style={styles.featureItem}>
                            <Ionicons name="shield" size={20} color="#ef4444" />
                            <Text style={styles.featureText}>Sécurité et confidentialité</Text>
                        </View>
                    </Card.Content>
                </Card>

                {/* Team */}
                <Card style={styles.teamCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Équipe</Title>
                        <Paragraph style={styles.teamDescription}>
                            Développé avec ❤️ par l'équipe Yukpomnang pour connecter
                            les services et les personnes au Sénégal et en Afrique.
                        </Paragraph>
                    </Card.Content>
                </Card>

                {/* Links */}
                <Card style={styles.linksCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Liens utiles</Title>

                        <List.Item
                            title="Site web"
                            description="yukpomnang.com"
                            left={(props) => <List.Icon {...props} icon="web" />}
                            right={(props) => <List.Icon {...props} icon="open-in-new" />}
                            onPress={() => handleOpenLink('https://yukpomnang.com')}
                        />

                        <Divider />

                        <List.Item
                            title="Conditions d'utilisation"
                            description="Lire les conditions"
                            left={(props) => <List.Icon {...props} icon="file-document" />}
                            right={(props) => <List.Icon {...props} icon="open-in-new" />}
                            onPress={() => handleOpenLink('https://yukpomnang.com/terms')}
                        />

                        <Divider />

                        <List.Item
                            title="Politique de confidentialité"
                            description="Protection des données"
                            left={(props) => <List.Icon {...props} icon="shield" />}
                            right={(props) => <List.Icon {...props} icon="open-in-new" />}
                            onPress={() => handleOpenLink('https://yukpomnang.com/privacy')}
                        />
                    </Card.Content>
                </Card>

                {/* Contact */}
                <Card style={styles.contactCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Contact</Title>

                        <View style={styles.contactItem}>
                            <Ionicons name="mail" size={20} color="#2563eb" />
                            <Text style={styles.contactText}>contact@yukpomnang.com</Text>
                        </View>

                        <View style={styles.contactItem}>
                            <Ionicons name="call" size={20} color="#10b981" />
                            <Text style={styles.contactText}>+221 XX XXX XX XX</Text>
                        </View>

                        <View style={styles.contactItem}>
                            <Ionicons name="location" size={20} color="#f59e0b" />
                            <Text style={styles.contactText}>Dakar, Sénégal</Text>
                        </View>
                    </Card.Content>
                </Card>

                {/* Social Media */}
                <Card style={styles.socialCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Suivez-nous</Title>

                        <View style={styles.socialButtons}>
                            <Button
                                mode="outlined"
                                onPress={() => handleOpenLink('https://facebook.com/yukpomnang')}
                                icon="facebook"
                                style={styles.socialButton}
                            >
                                Facebook
                            </Button>

                            <Button
                                mode="outlined"
                                onPress={() => handleOpenLink('https://twitter.com/yukpomnang')}
                                icon="twitter"
                                style={styles.socialButton}
                            >
                                Twitter
                            </Button>

                            <Button
                                mode="outlined"
                                onPress={() => handleOpenLink('https://instagram.com/yukpomnang')}
                                icon="instagram"
                                style={styles.socialButton}
                            >
                                Instagram
                            </Button>
                        </View>
                    </Card.Content>
                </Card>

                {/* Copyright */}
                <View style={styles.copyrightContainer}>
                    <Text style={styles.copyrightText}>
                        © 2024 Yukpomnang. Tous droits réservés.
                    </Text>
                    <Text style={styles.copyrightText}>
                        Made with ❤️ in Senegal
                    </Text>
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
    infoCard: {
        margin: 20,
        marginTop: 10,
        elevation: 2,
    },
    appInfo: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    logoContainer: {
        marginBottom: 16,
    },
    appName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2563eb',
        marginBottom: 12,
    },
    appDescription: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 16,
    },
    versionText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
    },
    featuresCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 16,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 12,
    },
    teamCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    teamDescription: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
    },
    linksCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    contactCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    contactText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 12,
    },
    socialCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    socialButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    socialButton: {
        flex: 1,
        minWidth: 100,
    },
    copyrightContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    copyrightText: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 4,
    },
});

export default AboutScreen;

