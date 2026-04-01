// @ts-nocheck
// ✅ AMÉLIORATION UX: Écran de création partenaire modernisé avec design similaire à RegisterScreen
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Building, CheckCircle, Envelope, Image as ImageIcon, Lock, LockKey, MapPin, Phone, WarningCircle, XCircle } from 'phosphor-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card, Paragraph, TextInput, Title } from 'react-native-paper';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import ModernGPSModal from '../../components/ModernGPSModal';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { authApi } from '../../services/api';
import { theme } from '../../theme/theme';
import { getAllCountryDialCodes } from '../../utils/countryDialCodes';

const PartnerRegisterScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguageSafe();
  // ✅ NOUVEAU: Lire le paramètre partner_type depuis la route
  const routeParams = (route.params as any) || {};
  const initialPartnerType = routeParams.partner_type || '';

  // ✅ Moyens de paiement pour recevoir les reversements
  const [paymentMtnEnabled, setPaymentMtnEnabled] = useState(false);
  const [paymentMtnPhone, setPaymentMtnPhone] = useState('');
  const [paymentOrangeEnabled, setPaymentOrangeEnabled] = useState(false);
  const [paymentOrangePhone, setPaymentOrangePhone] = useState('');

  const [form, setForm] = useState({
    partner_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    partner_type: initialPartnerType as string,
    partner_phone: '',
    partner_address: '',
    partner_gps: null as { lat: number; lng: number } | null,
    /** Code ISO pays (ex. CM) — aligné sur l’indicatif téléphonique */
    partner_country: 'CM',
    partner_logo: null as string | null, // ✅ NOUVEAU: Logo du partenaire (base64)
    // ✅ NOUVEAU: Champs spécifiques pour chauffeur
    driver_license_number: '' as string,
    driver_license_expiry: '' as string, // Format: YYYY-MM-DD
    driver_license_photo: null as string | null, // Photo du permis de conduire (base64)
    driver_id_photo: null as string | null, // Photo de la carte d'identité (base64)
    driver_vehicle_type: '' as string, // taxi, covoiturage, les_deux
    driver_experience_years: '' as string,
    // ✅ NOUVEAU: Documents administratifs entreprise (Cameroun)
    rccm: '' as string,              // Registre du Commerce et du Crédit Mobilier
    numero_contribuable: '' as string, // Numéro contribuable/fiscal
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [partnerPhoneCountryCode, setPartnerPhoneCountryCode] = useState('+237');

  const countryCodeOptions = useMemo(() => getAllCountryDialCodes('CM'), []);

  // ✅ NOUVEAU: Mettre à jour le partner_type si fourni via les paramètres de route
  useEffect(() => {
    if (initialPartnerType && initialPartnerType !== form.partner_type) {
      setForm(prev => ({ ...prev, partner_type: initialPartnerType }));
    }
  }, [initialPartnerType]);

  // ✅ TOUS les types partenaires valides selon le backend
  // ✅ TRIÉ PAR ORDRE ALPHABÉTIQUE pour faciliter la recherche
  const partnerTypes = [
    { value: 'agence de voyage', label: t('partnerRegister.agenceDeVoyage') },
    { value: 'assureur', label: 'Assureur' },
    { value: 'banquesang', label: 'Banque de Sang' },
    { value: 'chauffeur', label: 'Chauffeur (Taxi/Covoiturage)' }, // ✅ NOUVEAU: Type partenaire chauffeur
    { value: 'demenagement', label: t('partnerRegister.demenagement') },
    { value: 'etablissementscolaire', label: t('partnerRegister.etablissementScolaire') }, // ✅ NOUVEAU: Type partenaire établissement scolaire
    { value: 'hotel', label: t('partnerRegister.hotel') },
    { value: 'hopital', label: t('partnerRegister.hopitalclinique') },
    { value: 'laboratoire', label: 'Laboratoire' },
    { value: 'livraison', label: t('partnerRegister.livraison') }, // ✅ NOUVEAU: Type partenaire livraison générale
    { value: 'livraison_courses_marche', label: t('partnerRegister.livraisonCoursesAuMarche') }, // ✅ NOUVEAU: Type partenaire pour courses au marché (coursier spécialisé)
    { value: 'meuble', label: t('partnerRegister.meubleLocationMeublee') },
    { value: 'pharmacie', label: 'Pharmacie' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'supermarche', label: t('partnerRegister.supermarche') },
    { value: 'telecom', label: t('partnerRegister.telecom') },
    { value: 'transport', label: 'Transport' },
  ].sort((a, b) => {
    // ✅ TRI ALPHABÉTIQUE: Comparer les labels en ignorant la casse et les accents
    const normalize = (str: string) => str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, ''); // Supprimer les accents

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
          t('partnerRegister.permissionDenied'),
          t('partnerRegister.galleryAccessRequired')
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
      Alert.alert(t('message.error'), t('partnerRegister.cannotSelectLogo'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Validations
    if (!form.partner_name || !form.email || !form.password || !form.confirmPassword) {
      setError(t('partnerRegisterScreen.veuillezRemplirTousLesChampsObligatoires'));
      return;
    }

    if (!validatePassword(form.password)) {
      setError(t('partnerRegister.leMotDePasseNe'));
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError(t('partnerRegister.lesMotsDePasseNe'));
      return;
    }

    // ✅ RENFORCÉ: Validation stricte du type de partenaire
    if (!form.partner_type || form.partner_type.trim() === '') {
      setError(t('partnerRegister.leTypeDetablissementEstObligatoireVeuillezSelectionner'));
      return;
    }

    // ✅ Validation WhatsApp obligatoire
    if (!form.partner_phone || form.partner_phone.trim() === '') {
      setError(t('partnerRegister.leNumeroWhatsAppEstObligatoire', 'Le numéro WhatsApp de l\'établissement est obligatoire'));
      return;
    }

    // ✅ Validation spécifique pour établissementscolaire
    if (form.partner_type === 'etablissementscolaire' && !form.etablissement_type) {
      setError(t('partnerRegister.veuillezSelectionnerLeTypeDetablissementScolaire'));
      return;
    }

    // ✅ NOUVEAU: Validation spécifique pour chauffeur
    if (form.partner_type === 'chauffeur') {
      if (!form.driver_license_number?.trim()) {
        setError(t('partnerRegister.veuillezRenseignerLeNumeroDe'));
        return;
      }
      if (!form.driver_license_expiry?.trim()) {
        setError('Veuillez renseigner la date d\'expiration du permis');
        return;
      }
      if (!form.driver_license_photo) {
        setError(t('partnerRegister.veuillezTelechargerLaPhotoDu'));
        return;
      }
      if (!form.driver_id_photo) {
        setError(t('partnerRegister.veuillezTelechargerLaPhotoDeLaCarte'));
        return;
      }
      if (!form.driver_vehicle_type) {
        setError(t('partnerRegister.veuillezSelectionnerLeTypeDe'));
        return;
      }
    }

    // ✅ NOUVEAU: Validation documents administratifs pour structures commerciales
    if (form.partner_type && form.partner_type !== 'chauffeur') {
      if (!form.rccm?.trim()) {
        setError('Le numéro RCCM est obligatoire pour les partenaires professionnels');
        return;
      }
      if (!form.numero_contribuable?.trim()) {
        setError('Le numéro contribuable est obligatoire pour les partenaires professionnels');
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
        partner_phone: form.partner_phone
          ? `${partnerPhoneCountryCode}${form.partner_phone.replace(/\D/g, '')}`
          : '',
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

      // ✅ NOUVEAU: Ajouter les champs spécifiques pour chauffeur
      if (form.partner_type === 'chauffeur') {
        registerData.driver_license_number = form.driver_license_number;
        registerData.driver_license_expiry = form.driver_license_expiry;
        registerData.driver_license_photo = form.driver_license_photo;
        registerData.driver_id_photo = form.driver_id_photo;
        registerData.driver_vehicle_type = form.driver_vehicle_type;
        registerData.driver_experience_years = form.driver_experience_years;
      }

      // ✅ NOUVEAU: Documents administratifs entreprise
      if (form.partner_type !== 'chauffeur') {
        registerData.rccm = form.rccm.trim();
        registerData.numero_contribuable = form.numero_contribuable.trim();
      }

      // ✅ Ajouter les moyens de paiement si configurés
      const paymentMethods: any = {};
      if (paymentMtnEnabled && paymentMtnPhone.trim()) {
        paymentMethods.mtn_money = { phone: paymentMtnPhone.trim(), verified: false };
      }
      if (paymentOrangeEnabled && paymentOrangePhone.trim()) {
        paymentMethods.orange_money = { phone: paymentOrangePhone.trim(), verified: false };
      }
      if (Object.keys(paymentMethods).length > 0) {
        registerData.payment_methods = paymentMethods;
      }

      const response = await authApi.register(registerData);

      if (response.success || response.token) {
        Alert.alert(
          t('partnerRegister.registrationSuccess'),
          t('partnerRegister.pendingValidation'),
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
        errorMessage = t('partnerRegisterScreen.cetEmailEstDejaUtiliseEssayez');
      } else if (error.message?.includes('400') || error.message?.includes('validation')) {
        errorMessage = t('partnerRegisterScreen.donneesInvalidesVerifiezVosInformations');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = t('partnerRegisterScreen.problemeDeConnexionVerifiezVotreInternet');
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
            <Text style={styles.brandYuk}>Yuk</Text><Text style={styles.brandPo}>po</Text>
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
              <Title style={styles.sectionTitle}>{t('partnerRegister.informationsDeVotreEtablissement')}</Title>
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
                <Picker.Item label={t('partnerRegister.selectionnezUnType')} value="" />
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
              label={`${t('partnerRegister.nomDeLEtablissement')} *`}
              value={form.partner_name}
              onChangeText={(text) => setForm({ ...form, partner_name: text })}
              disabled={loading}
              style={styles.input}
              left={<TextInput.Icon icon={() => <Building size={20} color={theme.colors.textSecondary} />} />}
            />

            <Text style={styles.label}>
              {t('partnerRegister.numeroWhatsAppEtablissement', 'Numéro WhatsApp de l\'établissement')}{' '}
              <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.phoneRow}>
              <View style={styles.phoneCountryPickerWrap}>
                <Picker
                  selectedValue={partnerPhoneCountryCode}
                  onValueChange={(value) => {
                    const prefix = String(value);
                    setPartnerPhoneCountryCode(prefix);
                    const opt = countryCodeOptions.find((c) => c.prefix === prefix);
                    setForm((prev) => ({ ...prev, partner_country: opt?.code || prev.partner_country }));
                  }}
                  style={styles.phoneCountryPicker}
                >
                  {countryCodeOptions.map((country) => (
                    <Picker.Item key={country.code} label={`${country.label} (${country.prefix})`} value={country.prefix} />
                  ))}
                </Picker>
              </View>
              <TextInput
                label={t('partnerRegister.numeroWhatsApp', 'Numéro WhatsApp')}
                value={form.partner_phone}
                onChangeText={(text) => setForm({ ...form, partner_phone: text.replace(/\D/g, '') })}
                keyboardType="phone-pad"
                placeholder="6XXXXXXXX"
                disabled={loading}
                style={[styles.input, styles.phoneNumberInput]}
                left={<TextInput.Icon icon={() => <Phone size={20} color={theme.colors.textSecondary} />} />}
              />
            </View>

            {/* ✅ NOUVEAU: Champ de téléchargement de logo */}
            <Text style={styles.label}>{t('partnerRegister.logoDeLetablissement')}</Text>
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
                    {uploadingLogo ? 'Chargement...' : t('partnerRegisterScreen.telechargerUnLogo')}
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
                  {form.partner_address || t('partnerRegister.selectionnerLadresseAvecGps')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Informations de connexion du partenaire */}
            <View style={styles.divider} />

            <TextInput
              label={t('partnerRegisterScreen.adresseEmailDuPartenaire')}
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
                label={t('partnerRegister.motDePasse')}
                value={form.password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                disabled={loading}
                style={styles.input}
                left={<TextInput.Icon icon={() => <Lock size={20} color={theme.colors.textSecondary} />} />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
              />
              {form.password.length > 0 && (
                <View style={styles.passwordCriteria}>
                  <Text style={styles.criteriaTitle}>{t('partnerRegister.criteresDuMotDePasse')}</Text>
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
                label={t('partnerRegisterScreen.confirmerLeMotDePasse')}
                value={form.confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={!showConfirmPassword}
                disabled={loading}
                style={[
                  styles.input,
                  confirmPasswordMatch === false && styles.inputError,
                  confirmPasswordMatch === true && styles.inputValid,
                ]}
                left={<TextInput.Icon icon={() => <LockKey size={20} color={theme.colors.textSecondary} />} />}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowConfirmPassword((v) => !v)}
                  />
                }
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

            {form.partner_type === 'etablissementscolaire' && (
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  {t(
                  'partnerRegister.etablissementScolaireHint',
                  'Après validation de votre compte, complétez filières, programmes et concours depuis votre tableau de bord orientation.',
                )}
                </Text>
              </View>
            )}

            {/* ✅ NOUVEAU: Champs conditionnels pour chauffeur - Informations personnelles */}
            {form.partner_type === 'chauffeur' && (
              <>
                <View style={styles.divider} />
                <View style={styles.sectionHeader}>
                  <Building size={20} color={theme.colors.primary} />
                  <Title style={styles.sectionTitle}>{t('partnerRegister.informationsPersonnelles')}</Title>
                </View>
                <Paragraph style={styles.sectionSubtitle}>
                  Ces informations sont nécessaires pour la validation de votre compte par les administrateurs
                </Paragraph>

                <TextInput
                  label={t('partnerRegister.numeroDePermisDeConduire')}
                  value={form.driver_license_number}
                  onChangeText={(text) => setForm({ ...form, driver_license_number: text })}
                  placeholder="Ex:AB123456789"
                  disabled={loading}
                  style={styles.input}
                />

                <TextInput
                  label={`${t('partnerRegisterScreen.dateDExpirationDuPermis')} *`}
                  value={form.driver_license_expiry}
                  onChangeText={(text) => setForm({ ...form, driver_license_expiry: text })}
                  placeholder="Ex: 2025-12-31"
                  disabled={loading}
                  style={styles.input}
                />

                <Text style={styles.label}>{t('partnerRegister.photoDuPermisDeConduire')}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      setUploadingLogo(true);
                      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!permissionResult.granted) {
                        Alert.alert(t('partnerRegister.permissionDenied'), t('partnerRegister.galleryAccessRequired'));
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
                      Alert.alert(t('message.error'), t('partnerRegister.cannotSelectPhoto'));
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
                        {uploadingLogo ? 'Chargement...' : t('partnerRegisterScreen.telechargerPhotoDuPermis')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.label}>{t('partnerRegister.photoDeLaCarteDidentite')}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      setUploadingLogo(true);
                      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!permissionResult.granted) {
                        Alert.alert(t('partnerRegister.permissionDenied'), t('partnerRegister.galleryAccessRequired'));
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
                      Alert.alert(t('message.error'), t('partnerRegister.cannotSelectPhoto'));
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
                        {uploadingLogo ? 'Chargement...' : t('partnerRegisterScreen.telechargerPhotoDeLaCarteDidentite')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.label}>{t('partnerRegister.typeDeService')}</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.driver_vehicle_type}
                    onValueChange={(value) => setForm({ ...form, driver_vehicle_type: value })}
                    style={styles.picker}
                  >
                    <Picker.Item label={t('partnerRegister.selectionnez')} value="" />
                    <Picker.Item label="Taxi uniquement" value="taxi" />
                    <Picker.Item label="Covoiturage uniquement" value="covoiturage" />
                    <Picker.Item label="Taxi et Covoiturage" value="les_deux" />
                  </Picker>
                </View>

                <TextInput
                  label={`${t('partnerRegister.anneesDExperience')}`}
                  value={form.driver_experience_years}
                  onChangeText={(text) => setForm({ ...form, driver_experience_years: text })}
                  placeholder="Ex: 5"
                  keyboardType="numeric"
                  disabled={loading}
                  style={styles.input}
                />
              </>
            )}

            {/* ✅ NOUVEAU: Section documents administratifs — pour toutes structures non-chauffeur */}
            {form.partner_type !== '' && form.partner_type !== 'chauffeur' && (
              <>
                <View style={styles.divider} />
                <View style={styles.sectionHeader}>
                  <Building size={20} color={theme.colors.primary} />
                  <Title style={styles.sectionTitle}>Documents administratifs</Title>
                </View>
                <Paragraph style={styles.sectionSubtitle}>
                  Documents obligatoires pour les partenaires professionnels au Cameroun
                </Paragraph>

                <TextInput
                  label="Numéro RCCM *"
                  value={form.rccm}
                  onChangeText={(text) => setForm({ ...form, rccm: text })}
                  placeholder="Ex: RC/DLA/2024/B/12345"
                  disabled={loading}
                  style={styles.input}
                />
                <Text style={styles.helperText}>
                  Registre du Commerce et du Crédit Mobilier — délivré au greffe du tribunal de commerce
                </Text>

                <TextInput
                  label="Numéro contribuable *"
                  value={form.numero_contribuable}
                  onChangeText={(text) => setForm({ ...form, numero_contribuable: text })}
                  placeholder="Ex: M012345678901A"
                  disabled={loading}
                  style={styles.input}
                />
                <Text style={styles.helperText}>
                  Numéro d'Identifiant Unique (NIU) délivré par la Direction Générale des Impôts
                </Text>
              </>
            )}
          </Card.Content>
        </Card>

        {/* ✅ SECTION: Moyens de paiement (pour recevoir les reversements) */}
        <Card style={styles.formCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Phone size={20} color={theme.colors.primary} />
              <Title style={styles.sectionTitle}>{t('partnerRegister.paymentMethods') || 'Moyens de paiement'}</Title>
            </View>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
              {t('partnerRegister.paymentMethodsHint') || t('partnerRegisterScreen.configurezVosCoordonneesMobileMoneyPour')}
            </Text>

            {/* MTN Mobile Money */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontWeight: '600', fontSize: 14 }}>📱 MTN Mobile Money</Text>
              <TouchableOpacity
                onPress={() => setPaymentMtnEnabled(!paymentMtnEnabled)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: paymentMtnEnabled ? '#FBBF24' : '#E5E7EB' }}
              >
                <Text style={{ color: paymentMtnEnabled ? '#92400E' : '#6B7280', fontWeight: '600', fontSize: 12 }}>
                  {paymentMtnEnabled ? t('partnerRegisterScreen.active') : t('partnerRegisterScreen.desactive')}
                </Text>
              </TouchableOpacity>
            </View>
            {paymentMtnEnabled && (
              <TextInput
                label={t('partnerRegister.mtnNumber') || t('partnerRegister.numeroMtnMoney')}
                value={paymentMtnPhone}
                onChangeText={setPaymentMtnPhone}
                placeholder="6XX XX XX XX"
                keyboardType="phone-pad"
                maxLength={15}
                disabled={loading}
                style={styles.input}
              />
            )}

            {/* Orange Money */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 }}>
              <Text style={{ fontWeight: '600', fontSize: 14 }}>📱 Orange Money</Text>
              <TouchableOpacity
                onPress={() => setPaymentOrangeEnabled(!paymentOrangeEnabled)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: paymentOrangeEnabled ? '#F97316' : '#E5E7EB' }}
              >
                <Text style={{ color: paymentOrangeEnabled ? '#7C2D12' : '#6B7280', fontWeight: '600', fontSize: 12 }}>
                  {paymentOrangeEnabled ? t('partnerRegisterScreen.active') : t('partnerRegisterScreen.desactive')}
                </Text>
              </TouchableOpacity>
            </View>
            {paymentOrangeEnabled && (
              <TextInput
                label={t('partnerRegister.orangeNumber') || t('partnerRegister.numeroOrangeMoney')}
                value={paymentOrangePhone}
                onChangeText={setPaymentOrangePhone}
                placeholder="6XX XX XX XX"
                keyboardType="phone-pad"
                maxLength={15}
                disabled={loading}
                style={styles.input}
              />
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
                t('partnerRegisterScreen.selectionnezUnTypeDetablissement') :
                "S'inscrire comme partenaire"}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('partnerRegister.vousAvezDejaUnCompte')}</Text>
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
                setForm((prev) => ({ ...prev, partner_gps: { lat, lng } }));

                try {
                  const { reverseGeocodeWithRetry } = await import('../../utils/reverseGeocoding');
                  const geocodeResult = await reverseGeocodeWithRetry(lat, lng);
                  if (geocodeResult) {
                    setForm((prev) => ({
                      ...prev,
                      partner_address: geocodeResult.address,
                      partner_gps: { lat, lng },
                    }));
                  } else {
                    setForm((prev) => ({
                      ...prev,
                      partner_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                      partner_gps: { lat, lng },
                    }));
                  }
                } catch (geocodeError) {
                  console.warn('[PartnerRegisterScreen] Erreur géocodage inverse:', geocodeError);
                  setForm((prev) => ({
                    ...prev,
                    partner_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                    partner_gps: { lat, lng },
                  }));
                }
              }
            }
            setShowGPSModal(false);
          } catch (error) {
            console.error('[PartnerRegisterScreen] Erreur sélection GPS:', error);
            Alert.alert(t('message.error'), t('partnerRegister.cannotProcessLocation'));
          }
        }}
        currentLocation={form.partner_gps}
        title={t('partnerRegister.selectionnerLAdresseDeLEtablissement')}
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
  brandYuk: {
    color: '#3B82F6', // Bleu (cohérent avec le logo officiel)
  },
  brandPo: {
    color: '#7C3AED', // Violet (cohérent avec le logo officiel)
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
  requiredStar: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  optionalHint: {
    fontSize: 13,
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  phoneCountryPickerWrap: {
    flex: 0.42,
    minWidth: 118,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    marginRight: 8,
    justifyContent: 'center',
  },
  phoneCountryPicker: {
    height: 56,
    color: theme.colors.text,
  },
  phoneNumberInput: {
    flex: 1,
    marginBottom: 16,
  },
  infoBanner: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#B3D9F2',
  },
  infoBannerText: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
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
