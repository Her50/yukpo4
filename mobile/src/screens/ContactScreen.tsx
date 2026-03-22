// @ts-nocheck
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import { SafeNativeView } from '../components/SafeNativeView';
import { useLanguageSafe } from '../contexts/LanguageContext';

const ContactScreen: React.FC = () => {
      const { t } = useLanguageSafe();
const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      Alert.alert(t('contact.erreur'), t('contact.remplirTousChamps'));
      return;
    }

    try {
      // TODO: Implémenter l'envoi du message de contact
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert(
        t('contactScreen.messageEnvoye'),
        t('contactScreen.nousAvonsBienRecuVotreMessage')
      );
      // Réinitialiser le formulaire
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (error) {
      Alert.alert(t('contact.erreur'), t('contact.impossibleEnvoyer'));
    }
  };

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('contact.erreur'), t('contact.impossibleOuvrirLien'));
      }
    } catch (error) {
      Alert.alert(t('contact.erreur'), t('contact.impossibleOuvrirLien'));
    }
  };

  return (
    <SafeNativeView style={styles.container}>
      <KeyboardAwareScreen contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>📞 {t('contact.contactezNous')}</Text>
          <Text style={styles.subtitle}>
            {t('contact.nousSommesLa')}
          </Text>
        </View>

        {/* Formulaire de contact */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>✉️ {t('contact.envoyezMessage')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('contact.nomComplet')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('contact.votreNomComplet')}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('contact.emailLabel')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('contact.emailPlaceholder')}
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('contact.sujetLabel')}</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder={t('contact.sujetPlaceholder')}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('contact.messageLabel')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder={t('contact.decrivezVotreDemandeOuVotre')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>{t('contact.envoyerLeMessage')}</Text>
          </TouchableOpacity>
        </View>

        {/* Infos de contact rapide */}
        <View style={styles.quickContact}>
          <Text style={styles.quickContactTitle}>{t('contact.contactRapide')}</Text>

          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => openLink('mailto:contact@yukpomnang.com')}
          >
            <Text style={styles.contactIcon}>📧</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>{t('contact.emailTitle')}</Text>
              <Text style={styles.contactValue}>contact@yukpomnang.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => openLink('tel:+237699999999')}
          >
            <Text style={styles.contactIcon}>📞</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>{t('contact.telephone')}</Text>
              <Text style={styles.contactValue}>+237 699 999 999</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => openLink('https://wa.me/237699999999')}
          >
            <Text style={styles.contactIcon}>💬</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>WhatsApp</Text>
              <Text style={styles.contactValue}>{t('contact.chatDirect')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Informations supplémentaires */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>{t('contact.informations')}</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              • <Text style={styles.bold}>{t('contact.heuresOuverture')}</Text> {t('contact.heuresOuvertureValeur')}
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.bold}>{t('contact.tempsDeReponse')}</Text> {t('contact.tempsReponseValeur')}
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.bold}>{t('contact.supportTechnique')}</Text> {t('contact.supportValeur')}
            </Text>
          </View>
        </View>

        {/* Réseaux sociaux */}
        <View style={styles.socialSection}>
          <Text style={styles.infoTitle}>{t('contact.reseauxSociaux')}</Text>
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
      </KeyboardAwareScreen>
    </SafeNativeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#3498db',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickContact: {
    marginBottom: 25,
  },
  quickContactTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  infoSection: {
    marginBottom: 25,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  socialSection: {
    marginBottom: 25,
  },
  socialLinks: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  socialButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  socialIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  socialText: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
  },
});

export default ContactScreen;