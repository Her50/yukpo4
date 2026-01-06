// @ts-nocheck
// ✅ AMÉLIORATION UX: Écran de création partenaire modernisé avec design similaire à RegisterScreen
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { CheckCircle, XCircle, WarningCircle, Building, User, Envelope, Lock, LockKey, Phone, MapPin } from 'phosphor-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card, Paragraph, TextInput, Title } from 'react-native-paper';
import { authApi } from '../../services/api';
import { theme } from '../../theme/theme';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';

const PartnerRegisterScreen: React.FC = () => {
  const navigation = useNavigation();
  const [form, setForm] = useState({
    nom: '',
    email: '',
    password: '',
    confirmPassword: '',
    partner_type: '' as string,
    partner_name: '',
    partner_phone: '',
    partner_address: '',
    partner_city: null as LocationObject | null,
    partner_country: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    uppercase: false,
    number: false,
  });
  const [confirmPasswordMatch, setConfirmPasswordMatch] = useState<boolean | null>(null);

  // ✅ TOUS les types partenaires valides selon le backend
  const partnerTypes = [
    { value: 'pharmacie', label: 'Pharmacie' },
    { value: 'hopital', label: 'Hôpital/Clinique' },
    { value: 'laboratoire', label: 'Laboratoire' },
    { value: 'banquesang', label: 'Banque de Sang' }, // ✅ NOUVEAU: Type partenaire banque de sang
    { value: 'agence de voyage', label: 'Agence de Voyage' },
    { value: 'demenagement', label: 'Déménagement' },
    { value: 'transport', label: 'Transport' },
    { value: 'assureur', label: 'Assureur' },
    { value: 'supermarche', label: 'Supermarché' },
    { value: 'telecom', label: 'Télécom' },
  ];

  // ✅ Validation du mot de passe avec feedback visuel en temps réel
  const validatePassword = (password: string) => {
    const errors = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
    };
    setPasswordErrors(errors);
    return errors.length && errors.uppercase && errors.number;
  };

  const handlePasswordChange = (text: string) => {
    setForm({ ...form, password: text });
    if (text.length > 0) {
      validatePassword(text);
    } else {
      setPasswordErrors({ length: false, uppercase: false, number: false });
    }
    
    // ✅ Vérifier la correspondance avec le mot de passe de confirmation
    if (form.confirmPassword.length > 0) {
      setConfirmPasswordMatch(text === form.confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setForm({ ...form, confirmPassword: text });
    if (text.length > 0) {
      setConfirmPasswordMatch(text === form.password);
    } else {
      setConfirmPasswordMatch(null);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Validations
    if (!form.nom || !form.email || !form.password || !form.confirmPassword) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!validatePassword(form.password)) {
      setError('Le mot de passe ne respecte pas tous les critères requis');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!form.partner_type) {
      setError('Veuillez sélectionner un type de partenaire');
      return;
    }

    if (!form.partner_name) {
      setError('Le nom de votre établissement est obligatoire');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.register({
        nom: form.nom,
        prenom: '', // ✅ Supprimé : pas nécessaire pour une structure morale
        email: form.email,
        password: form.password,
        is_partner: true,
        partner_type: form.partner_type,
        partner_name: form.partner_name,
        partner_phone: form.partner_phone,
        partner_address: form.partner_address,
        partner_city: form.partner_city?.place_name || form.partner_city?.raw,
        partner_country: form.partner_country || form.partner_city?.components?.pays,
      });

      if (response.success || response.token) {
        Alert.alert(
          'Inscription réussie',
          'Votre compte partenaire est en attente de validation. Vous recevrez un email une fois approuvé.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login' as never) }]
        );
      } else {
        setError(response.error || 'Erreur lors de l\'inscription');
      }
    } catch (error: any) {
      console.error('[PartnerRegisterScreen] Erreur inscription:', error);
      
      // Détection des erreurs spécifiques
      let errorMessage = error.message || 'Erreur lors de l\'inscription';
      
      if (error.message?.includes('409') || error.message?.includes('deja utilise') || error.message?.includes('already exists')) {
        errorMessage = '❌ Cet email est déjà utilisé. Essayez de vous connecter ou utilisez un autre email.';
      } else if (error.message?.includes('400') || error.message?.includes('validation')) {
        errorMessage = '❌ Données invalides. Vérifiez vos informations.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = '❌ Problème de connexion. Vérifiez votre internet.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Title style={styles.title}>
            Devenir partenaire{' '}
            <Text style={styles.yukpoText}>Yukpo</Text>
          </Title>
          <Paragraph style={styles.subtitle}>
            Créez votre compte partenaire. Votre compte sera validé par un administrateur.
          </Paragraph>
        </View>

        {/* Messages d'erreur */}
        {error && (
          <Card style={styles.errorCard}>
            <Card.Content style={styles.errorContent}>
              <WarningCircle size={24} color="#F44336" />
              <Text style={styles.errorText}>{error}</Text>
            </Card.Content>
          </Card>
        )}

        {/* ✅ SECTION 1: Informations du responsable (personne physique) */}
        <Card style={styles.formCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <User size={20} color={theme.colors.primary} />
              <Title style={styles.sectionTitle}>Informations du responsable</Title>
            </View>
            <Paragraph style={styles.sectionSubtitle}>
              Vos informations personnelles (contact principal)
            </Paragraph>

            <TextInput
              label="Nom complet du responsable *"
              value={form.nom}
              onChangeText={(text) => setForm({ ...form, nom: text })}
              disabled={loading}
              style={styles.input}
              left={<TextInput.Icon icon={() => <User size={20} color={theme.colors.textSecondary} />} />}
            />

            <TextInput
              label="Adresse email *"
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              disabled={loading}
              style={styles.input}
              left={<TextInput.Icon icon={() => <Envelope size={20} color={theme.colors.textSecondary} />} />}
            />

            {/* ✅ Amélioration : Validation du mot de passe avec feedback visuel en temps réel */}
            <View style={styles.passwordContainer}>
              <TextInput
                label="Mot de passe *"
                value={form.password}
                onChangeText={handlePasswordChange}
                secureTextEntry
                disabled={loading}
                style={styles.input}
                left={<TextInput.Icon icon={() => <Lock size={20} color={theme.colors.textSecondary} />} />}
              />
              {form.password.length > 0 && (
                <View style={styles.passwordCriteria}>
                  <Text style={styles.criteriaTitle}>Critères du mot de passe :</Text>
                  <View style={styles.criteriaItem}>
                    {passwordErrors.length ? (
                      <CheckCircle size={16} color="#4CAF50" />
                    ) : (
                      <XCircle size={16} color="#F44336" />
                    )}
                    <Text style={[styles.criteriaText, passwordErrors.length && styles.criteriaTextValid]}>
                      Au moins 8 caractères
                    </Text>
                  </View>
                  <View style={styles.criteriaItem}>
                    {passwordErrors.uppercase ? (
                      <CheckCircle size={16} color="#4CAF50" />
                    ) : (
                      <XCircle size={16} color="#F44336" />
                    )}
                    <Text style={[styles.criteriaText, passwordErrors.uppercase && styles.criteriaTextValid]}>
                      Au moins 1 majuscule
                    </Text>
                  </View>
                  <View style={styles.criteriaItem}>
                    {passwordErrors.number ? (
                      <CheckCircle size={16} color="#4CAF50" />
                    ) : (
                      <XCircle size={16} color="#F44336" />
                    )}
                    <Text style={[styles.criteriaText, passwordErrors.number && styles.criteriaTextValid]}>
                      Au moins 1 chiffre
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.passwordContainer}>
              <TextInput
                label="Confirmer le mot de passe *"
                value={form.confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry
                disabled={loading}
                style={[
                  styles.input,
                  confirmPasswordMatch === false && styles.inputError,
                  confirmPasswordMatch === true && styles.inputValid,
                ]}
                left={<TextInput.Icon icon={() => <LockKey size={20} color={theme.colors.textSecondary} />} />}
              />
              {form.confirmPassword.length > 0 && confirmPasswordMatch === false && (
                <View style={styles.passwordMismatchContainer}>
                  <XCircle size={16} color="#F44336" />
                  <Text style={styles.passwordMismatchText}>
                    Les mots de passe ne correspondent pas
                  </Text>
                </View>
              )}
              {form.confirmPassword.length > 0 && confirmPasswordMatch === true && (
                <View style={styles.passwordMatchContainer}>
                  <CheckCircle size={16} color="#4CAF50" />
                  <Text style={styles.passwordMatchText}>
                    Les mots de passe correspondent
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* ✅ SECTION 2: Informations de l'établissement (structure) */}
        <Card style={styles.formCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Building size={20} color={theme.colors.primary} />
              <Title style={styles.sectionTitle}>Informations de votre établissement</Title>
            </View>
            <Paragraph style={styles.sectionSubtitle}>
              Détails de votre structure professionnelle
            </Paragraph>

            <Text style={styles.label}>Type d'établissement *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={form.partner_type}
                onValueChange={(value) => setForm({ ...form, partner_type: value })}
                style={styles.picker}
              >
                <Picker.Item label="Sélectionnez un type..." value="" />
                {partnerTypes.map((type) => (
                  <Picker.Item key={type.value} label={type.label} value={type.value} />
                ))}
              </Picker>
            </View>

            <TextInput
              label="Nom de l'établissement *"
              value={form.partner_name}
              onChangeText={(text) => setForm({ ...form, partner_name: text })}
              disabled={loading}
              style={styles.input}
              left={<TextInput.Icon icon={() => <Building size={20} color={theme.colors.textSecondary} />} />}
            />

            <TextInput
              label="Téléphone de l'établissement"
              value={form.partner_phone}
              onChangeText={(text) => setForm({ ...form, partner_phone: text })}
              keyboardType="phone-pad"
              disabled={loading}
              style={styles.input}
              left={<TextInput.Icon icon={() => <Phone size={20} color={theme.colors.textSecondary} />} />}
            />

            <TextInput
              label="Adresse complète"
              value={form.partner_address}
              onChangeText={(text) => setForm({ ...form, partner_address: text })}
              multiline
              numberOfLines={3}
              disabled={loading}
              style={[styles.input, styles.textArea]}
              left={<TextInput.Icon icon={() => <MapPin size={20} color={theme.colors.textSecondary} />} />}
            />

            <LocationSelector
              label="Ville"
              value={form.partner_city}
              onChange={(location) => setForm({ ...form, partner_city: location })}
              scope="city"
            />
          </Card.Content>
        </Card>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Inscription en cours...' : "S'inscrire comme partenaire"}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Vous avez déjà un compte ? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
            <Text style={styles.footerLink}>Connectez-vous</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8DC', // ✅ Fond jaune clair comme RegisterScreen
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: theme.colors.text,
  },
  yukpoText: {
    color: '#FF8C00', // ✅ Orange comme RegisterScreen
  },
  subtitle: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginBottom: 10,
  },
  formCard: {
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  input: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  inputError: {
    borderColor: '#F44336',
    borderWidth: 1,
  },
  inputValid: {
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: theme.colors.text,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: theme.colors.text,
  },
  passwordContainer: {
    marginBottom: 16,
  },
  passwordCriteria: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  criteriaTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  criteriaText: {
    marginLeft: 8,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  criteriaTextValid: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  passwordMismatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  passwordMismatchText: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '500',
  },
  passwordMatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  passwordMatchText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#FF8C00', // ✅ Orange comme RegisterScreen
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: '#FF8C00',
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
    borderWidth: 1,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  errorText: {
    marginLeft: 8,
    color: '#F44336',
    fontWeight: '500',
  },
});

export default PartnerRegisterScreen;
