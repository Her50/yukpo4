// @ts-nocheck
// ✅ AMÉLIORATION UX: Écran de création partenaire modernisé avec design similaire à RegisterScreen
import { useNavigation, useRoute } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { CheckCircle, XCircle, WarningCircle, Building, Envelope, Lock, LockKey, Phone, MapPin, Image as ImageIcon } from 'phosphor-react-native';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { Card, Paragraph, TextInput, Title } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { authApi } from '../../services/api';
import { theme } from '../../theme/theme';
import ModernGPSModal from '../../components/ModernGPSModal';

const PartnerRegisterScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // ✅ NOUVEAU: Lire le paramètre partner_type depuis la route
  const routeParams = (route.params as any) || {};
  const initialPartnerType = routeParams.partner_type || '';
  
  const [form, setForm] = useState({
    partner_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    partner_type: initialPartnerType as string,
    partner_phone: '',
    partner_address: '',
    partner_gps: null as { lat: number; lng: number } | null,
    partner_country: '',
    partner_logo: null as string | null, // ✅ NOUVEAU: Logo du partenaire (base64)
    // ✅ NOUVEAU: Champs spécifiques pour établissementscolaire
    etablissement_type: '' as string, // primaire, secondaire, superieur, formation
    filieres: [] as string[],
    programmes_scolaires: [] as string[],
    concours_organises: [] as string[],
    anciennes_epreuves: [] as string[],
    // ✅ NOUVEAU: Champs spécifiques pour chauffeur
    driver_license_number: '' as string,
    driver_license_expiry: '' as string, // Format: YYYY-MM-DD
    driver_license_photo: null as string | null, // Photo du permis de conduire (base64)
    driver_id_photo: null as string | null, // Photo de la carte d'identité (base64)
    driver_vehicle_type: '' as string, // taxi, covoiturage, les_deux
    driver_experience_years: '' as string,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    uppercase: false,
    number: false,
  });
  const [confirmPasswordMatch, setConfirmPasswordMatch] = useState<boolean | null>(null);
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ✅ NOUVEAU: Mettre à jour le partner_type si fourni via les paramètres de route
  useEffect(() => {
    if (initialPartnerType && initialPartnerType !== form.partner_type) {
      setForm(prev => ({ ...prev, partner_type: initialPartnerType }));
    }
  }, [initialPartnerType]);

  // ✅ TOUS les types partenaires valides selon le backend
  // ✅ TRIÉ PAR ORDRE ALPHABÉTIQUE pour faciliter la recherche
  const partnerTypes = [
    { value: 'agence de voyage', label: 'Agence de Voyage' },
    { value: 'assureur', label: 'Assureur' },
    { value: 'banquesang', label: 'Banque de Sang' },
    { value: 'chauffeur', label: 'Chauffeur (Taxi/Covoiturage)' }, // ✅ NOUVEAU: Type partenaire chauffeur
    { value: 'demenagement', label: 'Déménagement' },
    { value: 'etablissementscolaire', label: 'Établissement Scolaire' }, // ✅ NOUVEAU: Type partenaire établissement scolaire
    { value: 'hopital', label: 'Hôpital/Clinique' },
    { value: 'laboratoire', label: 'Laboratoire' },
    { value: 'livraison', label: 'Livraison' }, // ✅ NOUVEAU: Type partenaire livraison générale
    { value: 'livraison_courses_marche', label: 'Livraison - Courses au marché' }, // ✅ NOUVEAU: Type partenaire pour courses au marché (coursier spécialisé)
    { value: 'pharmacie', label: 'Pharmacie' },
    { value: 'supermarche', label: 'Supermarché' },
    { value: 'telecom', label: 'Télécom' },
    { value: 'transport', label: 'Transport' },
  ].sort((a, b) => {
    // ✅ TRI ALPHABÉTIQUE: Comparer les labels en ignorant la casse et les accents
    const normalize = (str: string) => str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Supprimer les accents
    
    return normalize(a.label).localeCompare(normalize(b.label));
  });

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

  // ✅ NOUVEAU: Fonction pour sélectionner et uploader le logo
  const handlePickLogo = async () => {
    try {
      setUploadingLogo(true);
      
      // Demander les permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission refusée',
          'Vous devez autoriser l\'accès à la galerie pour ajouter un logo.'
        );
        setUploadingLogo(false);
        return;
      }

      // Lancer le sélecteur d'image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1], // Logo carré
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const imageBase64 = `data:image/jpeg;base64,${asset.base64}`;
          setForm({ ...form, partner_logo: imageBase64 });
        }
      }
    } catch (error: any) {
      console.error('[PartnerRegisterScreen] Erreur sélection logo:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Validations
    if (!form.partner_name || !form.email || !form.password || !form.confirmPassword) {
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

    // ✅ RENFORCÉ: Validation stricte du type de partenaire
    if (!form.partner_type || form.partner_type.trim() === '') {
      setError('⚠️ Le type d\'établissement est obligatoire. Veuillez sélectionner un type de partenaire.');
      return;
    }

    // ✅ Validation spécifique pour établissementscolaire
    if (form.partner_type === 'etablissementscolaire' && !form.etablissement_type) {
      setError('Veuillez sélectionner le type d\'établissement scolaire');
      return;
    }

    // ✅ NOUVEAU: Validation spécifique pour chauffeur
    if (form.partner_type === 'chauffeur') {
      if (!form.driver_license_number?.trim()) {
        setError('Veuillez renseigner le numéro de permis de conduire');
        return;
      }
      if (!form.driver_license_expiry?.trim()) {
        setError('Veuillez renseigner la date d\'expiration du permis');
        return;
      }
      if (!form.driver_license_photo) {
        setError('Veuillez télécharger la photo du permis de conduire');
        return;
      }
      if (!form.driver_id_photo) {
        setError('Veuillez télécharger la photo de la carte d\'identité');
        return;
      }
      if (!form.driver_vehicle_type) {
        setError('Veuillez sélectionner le type de service (Taxi/Covoiturage)');
        return;
      }
    }

    setLoading(true);
    try {
      const registerData: any = {
        nom: form.partner_name, // Nom du partenaire utilisé comme nom de compte
        prenom: '', // Pas nécessaire pour une structure morale
        email: form.email,
        password: form.password,
        is_partner: true,
        partner_type: form.partner_type,
        partner_name: form.partner_name,
        partner_phone: form.partner_phone,
        partner_address: form.partner_address,
        partner_country: form.partner_country,
      };

      // Ajouter les coordonnées GPS si disponibles
      if (form.partner_gps) {
        registerData.partner_lat = form.partner_gps.lat;
        registerData.partner_lng = form.partner_gps.lng;
      }

      // ✅ NOUVEAU: Ajouter le logo si disponible
      if (form.partner_logo) {
        registerData.partner_logo = form.partner_logo;
      }

      // ✅ Ajouter les champs spécifiques pour établissementscolaire
      if (form.partner_type === 'etablissementscolaire') {
        registerData.etablissement_type = form.etablissement_type;
        registerData.filieres = form.filieres;
        registerData.programmes_scolaires = form.programmes_scolaires;
        registerData.concours_organises = form.concours_organises;
      }

      // ✅ NOUVEAU: Ajouter les champs spécifiques pour chauffeur
      if (form.partner_type === 'chauffeur') {
        registerData.driver_license_number = form.driver_license_number;
        registerData.driver_license_expiry = form.driver_license_expiry;
        registerData.driver_license_photo = form.driver_license_photo;
        registerData.driver_id_photo = form.driver_id_photo;
        registerData.driver_vehicle_type = form.driver_vehicle_type;
        registerData.driver_experience_years = form.driver_experience_years;
      }

      const response = await authApi.register(registerData);

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
    <>
    <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.scrollContent}>
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

        {/* ✅ SECTION: Informations du partenaire */}
        <Card style={styles.formCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Building size={20} color={theme.colors.primary} />
              <Title style={styles.sectionTitle}>Informations de votre établissement</Title>
            </View>
            <Paragraph style={styles.sectionSubtitle}>
              Détails de votre structure professionnelle
            </Paragraph>

            <Text style={styles.label}>
              Type d'établissement <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={[styles.pickerContainer, !form.partner_type && styles.pickerContainerRequired]}>
              <Picker
                selectedValue={form.partner_type}
                onValueChange={(value) => setForm({ ...form, partner_type: value })}
                style={styles.picker}
                required
              >
                <Picker.Item label="Sélectionnez un type..." value="" />
                {partnerTypes.map((type) => (
                  <Picker.Item key={type.value} label={type.label} value={type.value} />
                ))}
              </Picker>
            </View>
            {!form.partner_type && (
              <Text style={styles.helperText}>
                ⚠️ Ce champ est obligatoire. Vous devez sélectionner un type d'établissement pour créer un compte partenaire.
              </Text>
            )}

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

            {/* ✅ NOUVEAU: Champ de téléchargement de logo */}
            <Text style={styles.label}>Logo de l'établissement</Text>
            <TouchableOpacity
              onPress={handlePickLogo}
              disabled={loading || uploadingLogo}
              style={[styles.logoUploadButton, uploadingLogo && styles.logoUploadButtonDisabled]}
            >
              {form.partner_logo ? (
                <View style={styles.logoPreview}>
                  <Image source={{ uri: form.partner_logo }} style={styles.logoImage} />
                  <TouchableOpacity
                    onPress={() => setForm({ ...form, partner_logo: null })}
                    style={styles.removeLogoButton}
                  >
                    <Text style={styles.removeLogoText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.logoPlaceholder}>
                  <ImageIcon size={40} color={theme.colors.textSecondary} />
                  <Text style={styles.logoPlaceholderText}>
                    {uploadingLogo ? 'Chargement...' : 'Télécharger un logo'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ✅ Adresse avec GPS moderne */}
            <TouchableOpacity
              onPress={() => setShowGPSModal(true)}
              disabled={loading}
              style={[styles.input, styles.gpsButton]}
            >
              <View style={styles.gpsButtonContent}>
                <MapPin size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.gpsButtonText, !form.partner_address && styles.gpsButtonTextPlaceholder]}>
                  {form.partner_address || 'Sélectionner l\'adresse avec GPS *'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Informations de connexion du partenaire */}
            <View style={styles.divider} />

            <TextInput
              label="Adresse email du partenaire *"
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

            {/* ✅ NOUVEAU: Champs conditionnels pour établissementscolaire */}
            {form.partner_type === 'etablissementscolaire' && (
              <>
                <Text style={styles.label}>Type d'établissement scolaire *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.etablissement_type}
                    onValueChange={(value) => setForm({ ...form, etablissement_type: value })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Sélectionnez..." value="" />
                    <Picker.Item label="Primaire" value="primaire" />
                    <Picker.Item label="Secondaire" value="secondaire" />
                    <Picker.Item label="Supérieur (Université)" value="superieur" />
                    <Picker.Item label="École de Formation" value="formation" />
                  </Picker>
                </View>

                <TextInput
                  label="Filières proposées (séparées par des virgules)"
                  value={form.filieres.join(', ')}
                  onChangeText={(text) => setForm({ ...form, filieres: text.split(',').map(f => f.trim()).filter(Boolean) })}
                  placeholder="Ex: Sciences, Littérature, Technique, Commerce..."
                  multiline
                  numberOfLines={2}
                  disabled={loading}
                  style={[styles.input, styles.textArea]}
                />

                <TextInput
                  label="Programmes scolaires (séparés par des virgules)"
                  value={form.programmes_scolaires.join(', ')}
                  onChangeText={(text) => setForm({ ...form, programmes_scolaires: text.split(',').map(p => p.trim()).filter(Boolean) })}
                  placeholder="Ex: Baccalauréat, BTS, Licence, Master..."
                  multiline
                  numberOfLines={2}
                  disabled={loading}
                  style={[styles.input, styles.textArea]}
                />

                <TextInput
                  label="Concours organisés (séparés par des virgules)"
                  value={form.concours_organises.join(', ')}
                  onChangeText={(text) => setForm({ ...form, concours_organises: text.split(',').map(c => c.trim()).filter(Boolean) })}
                  placeholder="Ex: Concours d'entrée en 6ème, Concours d'entrée en 1ère..."
                  multiline
                  numberOfLines={2}
                  disabled={loading}
                  style={[styles.input, styles.textArea]}
                />
              </>
            )}

            {/* ✅ NOUVEAU: Champs conditionnels pour chauffeur - Informations personnelles */}
            {form.partner_type === 'chauffeur' && (
              <>
                <View style={styles.divider} />
                <View style={styles.sectionHeader}>
                  <Building size={20} color={theme.colors.primary} />
                  <Title style={styles.sectionTitle}>Informations personnelles</Title>
                </View>
                <Paragraph style={styles.sectionSubtitle}>
                  Ces informations sont nécessaires pour la validation de votre compte par les administrateurs
                </Paragraph>

                <TextInput
                  label="Numéro de permis de conduire *"
                  value={form.driver_license_number}
                  onChangeText={(text) => setForm({ ...form, driver_license_number: text })}
                  placeholder="Ex: AB123456789"
                  disabled={loading}
                  style={styles.input}
                />

                <TextInput
                  label="Date d'expiration du permis (YYYY-MM-DD) *"
                  value={form.driver_license_expiry}
                  onChangeText={(text) => setForm({ ...form, driver_license_expiry: text })}
                  placeholder="Ex: 2025-12-31"
                  disabled={loading}
                  style={styles.input}
                />

                <Text style={styles.label}>Photo du permis de conduire *</Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      setUploadingLogo(true);
                      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!permissionResult.granted) {
                        Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la galerie');
                        return;
                      }
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: 'images' as any,
                        allowsEditing: true,
                        aspect: [3, 2],
                        quality: 0.8,
                        base64: true,
                      });
                      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].base64) {
                        setForm({ ...form, driver_license_photo: `data:image/jpeg;base64,${result.assets[0].base64}` });
                      }
                    } catch (error: any) {
                      Alert.alert('Erreur', 'Impossible de sélectionner la photo');
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                  disabled={loading || uploadingLogo}
                  style={[styles.logoUploadButton, uploadingLogo && styles.logoUploadButtonDisabled]}
                >
                  {form.driver_license_photo ? (
                    <View style={styles.logoPreview}>
                      <Image source={{ uri: form.driver_license_photo }} style={styles.logoImage} />
                      <TouchableOpacity
                        onPress={() => setForm({ ...form, driver_license_photo: null })}
                        style={styles.removeLogoButton}
                      >
                        <Text style={styles.removeLogoText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <ImageIcon size={40} color={theme.colors.textSecondary} />
                      <Text style={styles.logoPlaceholderText}>
                        {uploadingLogo ? 'Chargement...' : 'Télécharger photo du permis'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.label}>Photo de la carte d'identité *</Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      setUploadingLogo(true);
                      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!permissionResult.granted) {
                        Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la galerie');
                        return;
                      }
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: 'images' as any,
                        allowsEditing: true,
                        aspect: [3, 2],
                        quality: 0.8,
                        base64: true,
                      });
                      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].base64) {
                        setForm({ ...form, driver_id_photo: `data:image/jpeg;base64,${result.assets[0].base64}` });
                      }
                    } catch (error: any) {
                      Alert.alert('Erreur', 'Impossible de sélectionner la photo');
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                  disabled={loading || uploadingLogo}
                  style={[styles.logoUploadButton, uploadingLogo && styles.logoUploadButtonDisabled]}
                >
                  {form.driver_id_photo ? (
                    <View style={styles.logoPreview}>
                      <Image source={{ uri: form.driver_id_photo }} style={styles.logoImage} />
                      <TouchableOpacity
                        onPress={() => setForm({ ...form, driver_id_photo: null })}
                        style={styles.removeLogoButton}
                      >
                        <Text style={styles.removeLogoText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <ImageIcon size={40} color={theme.colors.textSecondary} />
                      <Text style={styles.logoPlaceholderText}>
                        {uploadingLogo ? 'Chargement...' : 'Télécharger photo de la carte d\'identité'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.label}>Type de service *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.driver_vehicle_type}
                    onValueChange={(value) => setForm({ ...form, driver_vehicle_type: value })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Sélectionnez..." value="" />
                    <Picker.Item label="Taxi uniquement" value="taxi" />
                    <Picker.Item label="Covoiturage uniquement" value="covoiturage" />
                    <Picker.Item label="Taxi et Covoiturage" value="les_deux" />
                  </Picker>
                </View>

                <TextInput
                  label="Années d'expérience"
                  value={form.driver_experience_years}
                  onChangeText={(text) => setForm({ ...form, driver_experience_years: text })}
                  placeholder="Ex: 5"
                  keyboardType="numeric"
                  disabled={loading}
                  style={styles.input}
                />
              </>
            )}
          </Card.Content>
        </Card>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || !form.partner_type || form.partner_type.trim() === ''}
          style={[
            styles.submitButton, 
            (loading || !form.partner_type || form.partner_type.trim() === '') && styles.submitButtonDisabled
          ]}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Inscription en cours...' : 
             (!form.partner_type || form.partner_type.trim() === '') ? 
             'Sélectionnez un type d\'établissement' : 
             "S'inscrire comme partenaire"}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Vous avez déjà un compte ? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
            <Text style={styles.footerLink}>Connectez-vous</Text>
          </TouchableOpacity>
        </View>
    </KeyboardAwareScreen>

      {/* Modal GPS moderne pour sélectionner l'adresse */}
      <ModernGPSModal
        visible={showGPSModal}
        onClose={() => setShowGPSModal(false)}
        onSelect={async (coordinatesString) => {
          try {
            // Parser les coordonnées depuis le format string "lat,lng"
            const firstPoint = coordinatesString.split('|')[0].split(',');
            if (firstPoint.length === 2) {
              const lat = parseFloat(firstPoint[0]);
              const lng = parseFloat(firstPoint[1]);
              
              if (!isNaN(lat) && !isNaN(lng)) {
                // Stocker les coordonnées GPS
                setForm({ ...form, partner_gps: { lat, lng } });
                
                // Faire un géocodage inverse pour obtenir l'adresse
                try {
                  const geocodeResult = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
                  if (geocodeResult.length > 0) {
                    const address = geocodeResult[0];
                    const formattedAddress = `${address.street || ''} ${address.streetNumber || ''}, ${address.city || ''}, ${address.region || ''}, ${address.country || ''}`.trim();
                    setForm({ ...form, partner_address: formattedAddress, partner_gps: { lat, lng } });
                    if (address.country) {
                      setForm(prev => ({ ...prev, partner_country: address.country || '' }));
                    }
                  } else {
                    // Fallback si pas de résultat de géocodage
                    setForm({ ...form, partner_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, partner_gps: { lat, lng } });
                  }
                } catch (geocodeError) {
                  console.warn('[PartnerRegisterScreen] Erreur géocodage inverse:', geocodeError);
                  // Fallback avec coordonnées
                  setForm({ ...form, partner_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, partner_gps: { lat, lng } });
                }
              }
            }
            setShowGPSModal(false);
          } catch (error) {
            console.error('[PartnerRegisterScreen] Erreur sélection GPS:', error);
            Alert.alert('Erreur', 'Impossible de traiter la localisation sélectionnée');
          }
        }}
        currentLocation={form.partner_gps}
        title="Sélectionner l'adresse de l'établissement"
        allowZoneSelection={false}
      />
    </>
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
  pickerContainerRequired: {
    borderColor: '#F44336',
    borderWidth: 2,
    backgroundColor: '#FFEBEE',
  },
  requiredAsterisk: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: '#F44336',
    fontStyle: 'italic',
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
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 20,
  },
  gpsButton: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 0,
    minHeight: 56,
    justifyContent: 'center',
  },
  gpsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gpsButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  gpsButtonTextPlaceholder: {
    color: theme.colors.textSecondary,
  },
  logoUploadButton: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  logoUploadButtonDisabled: {
    opacity: 0.5,
  },
  logoPreview: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeLogoButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#F44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLogoText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});

export default PartnerRegisterScreen;
