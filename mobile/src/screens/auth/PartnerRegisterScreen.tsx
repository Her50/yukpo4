import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle, XCircle } from 'phosphor-react-native';
import { authApi } from '../../services/api';
import { modernColors, modernStyles } from '../../theme/modernTheme';
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
  const [error, setError] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    uppercase: false,
    number: false,
  });

  // ✅ TOUS les types partenaires valides selon le backend
  const partnerTypes = [
    { value: 'pharmacie', label: 'Pharmacie' },
    { value: 'hopital', label: 'Hôpital/Clinique' },
    { value: 'laboratoire', label: 'Laboratoire' },
    { value: 'agence de voyage', label: 'Agence de Voyage' },
    { value: 'demenagement', label: 'Déménagement' },
    { value: 'transport', label: 'Transport' },
    { value: 'assureur', label: 'Assureur' },
    { value: 'supermarche', label: 'Supermarché' },
    { value: 'telecom', label: 'Télécom' },
  ];

  // ✅ Validation du mot de passe avec feedback visuel
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
  };

  const handleSubmit = async () => {
    setError('');

    // Validations
    if (!form.nom || !form.email || !form.password) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!validatePassword(form.password)) {
      setError('Le mot de passe ne respecte pas tous les critères requis');
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
      setError(error.message || 'Erreur lors de l\'inscription');
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
          <Text style={styles.title}>Devenir partenaire Yukpo</Text>
          <Text style={styles.subtitle}>
            Créez votre compte partenaire. Votre compte sera validé par un administrateur.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Informations personnelles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom complet *"
            value={form.nom}
            onChangeText={(text) => setForm({ ...form, nom: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          {/* ✅ Amélioration : Validation du mot de passe avec feedback visuel */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.input}
              placeholder="Mot de passe *"
              value={form.password}
              onChangeText={handlePasswordChange}
              secureTextEntry
            />
            {form.password.length > 0 && (
              <View style={styles.passwordCriteria}>
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

          <TextInput
            style={styles.input}
            placeholder="Confirmer le mot de passe *"
            value={form.confirmPassword}
            onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
            secureTextEntry
          />
          {form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
            <Text style={styles.passwordMismatchText}>
              Les mots de passe ne correspondent pas
            </Text>
          )}
        </View>

        {/* Informations partenaire */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de votre établissement</Text>

          <Text style={styles.label}>Type d'établissement *</Text>
          {/* ✅ Amélioration : Liste déroulante au lieu de chips */}
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
            style={styles.input}
            placeholder="Nom de l'établissement *"
            value={form.partner_name}
            onChangeText={(text) => setForm({ ...form, partner_name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Téléphone"
            value={form.partner_phone}
            onChangeText={(text) => setForm({ ...form, partner_phone: text })}
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Adresse"
            value={form.partner_address}
            onChangeText={(text) => setForm({ ...form, partner_address: text })}
            multiline
            numberOfLines={3}
          />

          <LocationSelector
            label="Ville"
            value={form.partner_city}
            onChange={(location) => setForm({ ...form, partner_city: location })}
            scope="city"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Inscription...' : "S'inscrire comme partenaire"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Retour à la connexion</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: modernColors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: modernColors.text,
  },
  input: {
    backgroundColor: modernColors.surface,
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    color: modernColors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: modernColors.text,
  },
  // ✅ Nouveau : Styles pour le picker
  pickerContainer: {
    backgroundColor: modernColors.surface,
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: modernColors.text,
  },
  // ✅ Nouveau : Styles pour la validation du mot de passe
  passwordContainer: {
    marginBottom: 12,
  },
  passwordCriteria: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    backgroundColor: modernColors.surface + '80',
    borderRadius: 8,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  criteriaText: {
    marginLeft: 8,
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  criteriaTextValid: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  passwordMismatchText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: modernColors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    color: modernColors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: modernColors.error + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: modernColors.error,
    fontSize: 14,
  },
});

export default PartnerRegisterScreen;
