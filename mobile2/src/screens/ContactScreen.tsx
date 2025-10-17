import React, { useState } from 'react';
import { 
  Alert, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  Linking
} from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';

const ContactScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !message) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implémenter l'envoi du message de contact
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert(
        'Message envoyé', 
        'Nous avons bien reçu votre message et vous répondrons dans les plus brefs délais.'
      );
      // Réinitialiser le formulaire
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le lien');
    });
  };

  return (
    <SafeNativeView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📞 Contactez-nous</Text>
          <Text style={styles.subtitle}>
            L'équipe <Text style={styles.brandYuk}>Yuk</Text>
            <Text style={styles.brandPo}>po</Text> est là pour vous aider
          </Text>
        </View>

        {/* Infos de contact rapide */}
        <View style={styles.quickContact}>
          <TouchableOpacity 
            style={styles.contactCard}
            onPress={() => openLink('mailto:contact@yukpomnang.com')}
          >
            <Text style={styles.contactIcon}>📧</Text>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactValue}>contact@yukpomnang.com</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactCard}
            onPress={() => openLink('tel:+237699999999')}
          >
            <Text style={styles.contactIcon}>📱</Text>
            <Text style={styles.contactLabel}>Téléphone</Text>
            <Text style={styles.contactValue}>+237 6 99 99 99 99</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactCard}
            onPress={() => openLink('https://wa.me/237699999999')}
          >
            <Text style={styles.contactIcon}>💬</Text>
            <Text style={styles.contactLabel}>WhatsApp</Text>
            <Text style={styles.contactValue}>Chat direct</Text>
          </TouchableOpacity>
        </View>

        {/* Formulaire de contact */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Envoyez-nous un message</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nom complet *</Text>
            <TextInput
              style={styles.input}
              placeholder="Votre nom"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="votre@email.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Sujet</Text>
            <TextInput
              style={styles.input}
              placeholder="Objet de votre message"
              placeholderTextColor="#999"
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Message *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez votre demande..."
              placeholderTextColor="#999"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitText}>
              {loading ? 'Envoi en cours...' : 'Envoyer le message'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Informations supplémentaires */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>🕐 Horaires de disponibilité</Text>
          <Text style={styles.infoText}>
            Lundi - Vendredi: 8h00 - 18h00{'\n'}
            Samedi: 9h00 - 13h00{'\n'}
            Dimanche: Fermé
          </Text>

          <Text style={styles.infoTitle}>📍 Localisation</Text>
          <Text style={styles.infoText}>
            Douala, Cameroun{'\n'}
            Akwa - Centre-ville
          </Text>

          <Text style={styles.infoTitle}>⚡ Réseaux sociaux</Text>
          <View style={styles.socialLinks}>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://facebook.com/yukpomnang')}
            >
              <Text style={styles.socialIcon}>📘</Text>
              <Text style={styles.socialText}>Facebook</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://twitter.com/yukpomnang')}
            >
              <Text style={styles.socialIcon}>🐦</Text>
              <Text style={styles.socialText}>Twitter</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => openLink('https://linkedin.com/company/yukpomnang')}
            >
              <Text style={styles.socialIcon}>💼</Text>
              <Text style={styles.socialText}>LinkedIn</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeNativeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 32,
    marginBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  brandYuk: {
    color: '#FFC107',
    fontWeight: 'bold',
  },
  brandPo: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  quickContact: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 11,
    color: '#1A1A1A',
    fontWeight: '600',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  submitButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  infoSection: {
    marginHorizontal: 20,
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  socialButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  socialIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  socialText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
});

export default ContactScreen;
