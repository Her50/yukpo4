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
import { useNavigation } from '@react-navigation/native';
import { authApi } from '../../services/api';
import { modernColors, modernStyles } from '../../theme/modernTheme';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';

const PartnerRegisterScreen: React.FC = () => {
  const navigation = useNavigation();
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    confirmPassword: '',
    partner_type: '' as 'pharmacie' | 'hopital' | 'laboratoire' | 'agence de voyage' | '',
    partner_name: '',
    partner_phone: '',
    partner_address: '',
    partner_city: null as LocationObject | null,
    partner_country: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const partnerTypes = [
    { value: 'pharmacie', label: 'Pharmacie' },
    { value: 'hopital', label: 'Hôpital/Clinique' },
    { value: 'laboratoire', label: 'Laboratoire' },
    { value: 'agence de voyage', label: 'Agence de Voyage' },
  ];

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

    if (!form.partner_type) {
      setError('Veuillez sélectionner un type de partenaire');
      return;
    }

    if (!form.partner_name) {
      setError('Le nom de votre établissement est obligatoire');
      return;
    }

    // Validation du mot de passe
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setError('Mot de passe trop faible : 8 caractères, 1 majuscule, 1 chiffre minimum.');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.register({
        nom: form.nom,
        prenom: form.prenom,
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
            placeholder="Nom *"
            value={form.nom}
            onChangeText={(text) => setForm({ ...form, nom: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Prénom *"
            value={form.prenom}
            onChangeText={(text) => setForm({ ...form, prenom: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe *"
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Confirmer le mot de passe *"
            value={form.confirmPassword}
            onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
            secureTextEntry
          />
        </View>

        {/* Informations partenaire */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de votre établissement</Text>

          <Text style={styles.label}>Type d'établissement *</Text>
          <View style={styles.chipsContainer}>
            {partnerTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.chip,
                  form.partner_type === type.value && styles.chipSelected,
                ]}
                onPress={() => setForm({ ...form, partner_type: type.value as any })}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.partner_type === type.value && styles.chipTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: modernColors.surface,
    borderWidth: 1,
    borderColor: modernColors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  chipText: {
    fontSize: 14,
    color: modernColors.text,
  },
  chipTextSelected: {
    color: '#FFF',
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

