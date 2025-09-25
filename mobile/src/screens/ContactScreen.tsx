import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, Paragraph, Button, TextInput, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme/theme';

interface ContactForm {
  nom: string;
  email: string;
  message: string;
}

const ContactScreen: React.FC = () => {
  const navigation = useNavigation();
  const [form, setForm] = useState<ContactForm>({ 
    nom: '', 
    email: '', 
    message: '' 
  });
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof ContactForm, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async () => {
    if (!form.nom || !form.email || !form.message) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
    setLoading(true);
      
      // Simuler l'envoi du formulaire
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    setSuccess(true);
      setForm({ nom: '', email: '', message: '' });
      
      Alert.alert(
        'Message envoyé',
        'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer.');
    } finally {
    setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Title style={styles.title}>📬 Contactez-nous</Title>
          <Paragraph style={styles.subtitle}>
              Une question ? Une collaboration ? Écrivez-nous simplement ici.
          </Paragraph>
          </View>

        {/* Formulaire de contact */}
        <Card style={styles.formCard}>
          <Card.Content>
            <View style={styles.formContainer}>
              <TextInput
                label="Votre nom *"
                value={form.nom}
                onChangeText={(text) => handleChange('nom', text)}
                style={styles.input}
                mode="outlined"
                disabled={loading}
              />

              <TextInput
                label="Votre email *"
                value={form.email}
                onChangeText={(text) => handleChange('email', text)}
                style={styles.input}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                disabled={loading}
              />

              <TextInput
                label="Votre message *"
              value={form.message}
                onChangeText={(text) => handleChange('message', text)}
                style={styles.messageInput}
                mode="outlined"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                disabled={loading}
              />

              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.submitButton}
                contentStyle={styles.submitButtonContent}
              >
                {loading ? 'Envoi en cours...' : 'Envoyer le message'}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Informations de contact */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.infoTitle}>Autres moyens de contact</Title>
            
            <View style={styles.contactItem}>
              <Ionicons name="mail" size={24} color={theme.colors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>contact@yukpomnang.com</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <Ionicons name="phone" size={24} color={theme.colors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Téléphone</Text>
                <Text style={styles.contactValue}>+237 6XX XXX XXX</Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <Ionicons name="location" size={24} color={theme.colors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Adresse</Text>
                <Text style={styles.contactValue}>
                  Douala, Cameroun
                </Text>
              </View>
            </View>

            <View style={styles.contactItem}>
              <Ionicons name="time" size={24} color={theme.colors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Horaires</Text>
                <Text style={styles.contactValue}>
                  Lun - Ven: 8h00 - 18h00
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* FAQ rapide */}
        <Card style={styles.faqCard}>
          <Card.Content>
            <Title style={styles.faqTitle}>Questions fréquentes</Title>
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>
                Comment puis-je créer un service sur Yukpo ?
              </Text>
              <Text style={styles.faqAnswer}>
                Utilisez le formulaire de création de service depuis votre tableau de bord ou la page d'accueil.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>
                Comment recharger mes tokens ?
              </Text>
              <Text style={styles.faqAnswer}>
                Allez dans "Recharger Tokens" depuis votre profil pour ajouter des crédits à votre compte.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>
                Puis-je annuler une transaction ?
              </Text>
              <Text style={styles.faqAnswer}>
                Les transactions peuvent être annulées dans les 24h suivant leur réalisation.
              </Text>
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
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  formCard: {
    marginBottom: 24,
    elevation: 4,
  },
  formContainer: {
    paddingVertical: 8,
  },
  input: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  messageInput: {
    marginBottom: 24,
    backgroundColor: theme.colors.surface,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  infoCard: {
    marginBottom: 24,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contactInfo: {
    marginLeft: 16,
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  faqCard: {
    marginBottom: 24,
    elevation: 2,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  faqItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

export default ContactScreen;