import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
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
    TextInput,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const ContactScreen = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [loading, setLoading] = useState(false);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs');
            return;
        }

        try {
            setLoading(true);

            // TODO: Implémenter l'envoi du message
            await new Promise(resolve => setTimeout(resolve, 2000));

            Alert.alert(
                'Succès',
                'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setFormData({ name: '', email: '', subject: '', message: '' });
                        },
                    },
                ]
            );
        } catch (error) {
            Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
            >
                <ScrollView style={styles.scrollView}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Title style={styles.title}>Contact</Title>
                        <Paragraph style={styles.subtitle}>
                            Nous sommes là pour vous aider
                        </Paragraph>
                    </View>

                    {/* Contact Info */}
                    <Card style={styles.contactInfoCard}>
                        <Card.Content>
                            <Title style={styles.sectionTitle}>Informations de contact</Title>

                            <View style={styles.contactItem}>
                                <Ionicons name="mail" size={20} color="#2563eb" />
                                <View style={styles.contactDetails}>
                                    <Text style={styles.contactLabel}>Email</Text>
                                    <Text style={styles.contactValue}>contact@yukpomnang.com</Text>
                                </View>
                            </View>

                            <View style={styles.contactItem}>
                                <Ionicons name="call" size={20} color="#10b981" />
                                <View style={styles.contactDetails}>
                                    <Text style={styles.contactLabel}>Téléphone</Text>
                                    <Text style={styles.contactValue}>+221 XX XXX XX XX</Text>
                                </View>
                            </View>

                            <View style={styles.contactItem}>
                                <Ionicons name="location" size={20} color="#f59e0b" />
                                <View style={styles.contactDetails}>
                                    <Text style={styles.contactLabel}>Adresse</Text>
                                    <Text style={styles.contactValue}>Dakar, Sénégal</Text>
                                </View>
                            </View>

                            <View style={styles.contactItem}>
                                <Ionicons name="time" size={20} color="#7c3aed" />
                                <View style={styles.contactDetails}>
                                    <Text style={styles.contactLabel}>Heures d'ouverture</Text>
                                    <Text style={styles.contactValue}>Lun - Ven: 8h00 - 18h00</Text>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>

                    {/* Contact Form */}
                    <Card style={styles.formCard}>
                        <Card.Content>
                            <Title style={styles.sectionTitle}>Envoyez-nous un message</Title>

                            <TextInput
                                label="Nom complet *"
                                value={formData.name}
                                onChangeText={(value) => handleInputChange('name', value)}
                                mode="outlined"
                                style={styles.input}
                            />

                            <TextInput
                                label="Email *"
                                value={formData.email}
                                onChangeText={(value) => handleInputChange('email', value)}
                                mode="outlined"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={styles.input}
                            />

                            <TextInput
                                label="Sujet *"
                                value={formData.subject}
                                onChangeText={(value) => handleInputChange('subject', value)}
                                mode="outlined"
                                style={styles.input}
                            />

                            <TextInput
                                label="Message *"
                                value={formData.message}
                                onChangeText={(value) => handleInputChange('message', value)}
                                mode="outlined"
                                multiline
                                numberOfLines={6}
                                style={styles.input}
                            />

                            <Button
                                mode="contained"
                                onPress={handleSubmit}
                                loading={loading}
                                disabled={loading}
                                style={styles.submitButton}
                                icon="send"
                            >
                                Envoyer le message
                            </Button>
                        </Card.Content>
                    </Card>

                    {/* FAQ */}
                    <Card style={styles.faqCard}>
                        <Card.Content>
                            <Title style={styles.sectionTitle}>Questions fréquentes</Title>

                            <List.Item
                                title="Comment créer un compte ?"
                                description="Cliquez sur 'S'inscrire' et suivez les étapes"
                                left={(props) => <List.Icon {...props} icon="help-circle" />}
                            />

                            <Divider />

                            <List.Item
                                title="Comment publier un service ?"
                                description="Allez dans 'Mes services' et cliquez sur 'Créer'"
                                left={(props) => <List.Icon {...props} icon="help-circle" />}
                            />

                            <Divider />

                            <List.Item
                                title="Comment recharger mes tokens ?"
                                description="Allez dans 'Tokens IA' et suivez les instructions"
                                left={(props) => <List.Icon {...props} icon="help-circle" />}
                            />

                            <Divider />

                            <List.Item
                                title="Comment contacter le support ?"
                                description="Utilisez ce formulaire ou envoyez un email"
                                left={(props) => <List.Icon {...props} icon="help-circle" />}
                            />
                        </Card.Content>
                    </Card>

                    {/* Social Media */}
                    <Card style={styles.socialCard}>
                        <Card.Content>
                            <Title style={styles.sectionTitle}>Suivez-nous</Title>
                            <Paragraph style={styles.socialDescription}>
                                Restez connecté avec nous sur les réseaux sociaux pour les dernières nouvelles et mises à jour.
                            </Paragraph>

                            <View style={styles.socialButtons}>
                                <Button
                                    mode="outlined"
                                    icon="facebook"
                                    style={styles.socialButton}
                                >
                                    Facebook
                                </Button>

                                <Button
                                    mode="outlined"
                                    icon="twitter"
                                    style={styles.socialButton}
                                >
                                    Twitter
                                </Button>

                                <Button
                                    mode="outlined"
                                    icon="instagram"
                                    style={styles.socialButton}
                                >
                                    Instagram
                                </Button>
                            </View>
                        </Card.Content>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    keyboardAvoidingView: {
        flex: 1,
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
    contactInfoCard: {
        margin: 20,
        marginTop: 10,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 16,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    contactDetails: {
        marginLeft: 12,
        flex: 1,
    },
    contactLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 2,
    },
    contactValue: {
        fontSize: 14,
        color: '#1e293b',
        fontWeight: '500',
    },
    formCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    input: {
        marginBottom: 16,
    },
    submitButton: {
        marginTop: 8,
    },
    faqCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    socialCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        elevation: 2,
    },
    socialDescription: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 16,
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
});

export default ContactScreen;

