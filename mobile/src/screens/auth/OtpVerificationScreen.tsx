// ✅ NOUVEAU 2026-02-25: Écran de vérification OTP par SMS/WhatsApp
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card, Paragraph, Title } from 'react-native-paper';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { useToaster } from '../../components/ToasterProvider';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../theme/theme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface OtpRouteParams {
  userId: number;
  phone: string;
  phoneCountry: string;
  email: string;
  token?: string;
}

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // secondes

const OtpVerificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as OtpRouteParams;
  const { updateUser } = useAuth();
  const toaster = useToaster();
    const { t } = useLanguageSafe();

  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Timer pour le cooldown de renvoi
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCooldown]);

  // Envoyer le premier OTP automatiquement
  useEffect(() => {
    sendOtp();
  }, []);

  const sendOtp = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: params.userId,
          phone: params.phone,
          country_code: params.phoneCountry,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Erreur lors de l\'envoi du code');
        return;
      }

      console.log('[OTP] Code envoyé à', data.phone_masked);
    } catch (err: any) {
      console.error('[OTP] Erreur envoi:', err);
      setError(t('otpVerificationScreen.impossibleDenvoyerLeCodeVerifiezVotreConnexion'));
    }
  }, [params]);

  const resendOtp = useCallback(async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendCooldown(RESEND_COOLDOWN);
    setCode(Array(OTP_LENGTH).fill(''));
    setError(null);
    await sendOtp();
    Alert.alert(t('otpVerificationScreen.codeRenvoye'), t('otpVerificationScreen.unNouveauCodeAEteEnvoye'));
  }, [canResend, sendOtp]);

  const handleCodeChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      // Gestion du collage d'un code complet
      const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
      const newCode = [...code];
      for (let i = 0; i < digits.length && i + index < OTP_LENGTH; i++) {
        newCode[i + index] = digits[i];
      }
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus sur le champ suivant
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [code]);

  const handleKeyPress = useCallback((index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  }, [code]);

  // Auto-submit quand les 6 chiffres sont saisis
  useEffect(() => {
    const fullCode = code.join('');
    if (fullCode.length === OTP_LENGTH && fullCode.match(/^\d{6}$/)) {
      verifyOtp(fullCode);
    }
  }, [code]);

  const verifyOtp = useCallback(async (otpCode: string) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: params.userId,
          phone: params.phone,
          code: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Code incorrect');
        // Réinitialiser le code en cas d'erreur
        setCode(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      // ✅ Succès — téléphone vérifié
      setVerified(true);
      Keyboard.dismiss();

      // Mettre à jour le contexte Auth
      if (params.token) {
        updateUser({ phone: params.phone });
      }

      // Rediriger après un court délai
      setTimeout(() => {
        toaster.success(t('otpVerificationScreen.bienvenueSurYukpoVotreCompteEst'));
        (navigation as any).reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }, 2000);

    } catch (err: any) {
      console.error('[OTP] Erreur vérification:', err);
      setError(t('otpVerification.erreurDeConnexionReessayez'));
    } finally {
      setLoading(false);
    }
  }, [loading, params, navigation, updateUser]);

  const skipVerification = useCallback(() => {
    Alert.alert(
      t('otpVerificationScreen.passerLaVerification'),
      t('otpVerificationScreen.vousPourrezVerifierVotreNumeroPlus'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Passer',
          onPress: () => {
            toaster.success(t('otpVerificationScreen.bienvenueSurYukpoVotreCompteEst'));
            (navigation as any).reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          },
        },
      ]
    );
  }, [navigation]);

  // Écran de succès
  if (verified) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Title style={styles.successTitle}>{t('otpVerification.numeroVerifie')}</Title>
          <Paragraph style={styles.successText}>
            Votre compte est maintenant activé. Redirection en cours...
          </Paragraph>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          {/* Header */}
          <Text style={styles.headerIcon}>\uD83D\uDCF1</Text>
          <Title style={styles.title}>{t('otpVerification.verificationDuTelephone')}</Title>
          <Paragraph style={styles.subtitle}>
            Un code à 6 chiffres a été envoyé par SMS/WhatsApp au numéro :
          </Paragraph>
          <Text style={styles.phoneNumber}>{params.phone}</Text>

          {/* Champs OTP */}
          <View style={styles.otpContainer}>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.otpInput,
                  code[index] ? styles.otpInputFilled : null,
                  error ? styles.otpInputError : null,
                ]}
                value={code[index]}
                onChangeText={(value) => handleCodeChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={index === 0 ? OTP_LENGTH : 1}
                selectTextOnFocus
                autoFocus={index === 0}
                editable={!loading}
              />
            ))}
          </View>

          {/* Message d'erreur */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ {error}</Text>
            </View>
          )}

          {/* Bouton vérifier */}
          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
            onPress={() => verifyOtp(code.join(''))}
            disabled={loading || code.join('').length < OTP_LENGTH}
          >
            <Text style={styles.verifyButtonText}>
              {loading ? t('otpVerificationScreen.verification') : t('otpVerificationScreen.verifier')}
            </Text>
          </TouchableOpacity>

          {/* Renvoyer le code */}
          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity onPress={resendOtp}>
                <Text style={styles.resendLink}>Renvoyer le code</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendText}>
                Renvoyer dans {resendCooldown}s
              </Text>
            )}
          </View>

          {/* Passer */}
          <TouchableOpacity style={styles.skipButton} onPress={skipVerification}>
            <Text style={styles.skipText}>{t('otpVerification.passerCetteEtape')}</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8DC',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    elevation: 4,
  },
  cardContent: {
    alignItems: 'center',
    padding: 24,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF8C00',
    marginBottom: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.colors.text,
    backgroundColor: '#F9FAFB',
  },
  otpInputFilled: {
    borderColor: '#FF8C00',
    backgroundColor: '#FFF8DC',
  },
  otpInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  resendContainer: {
    marginBottom: 16,
  },
  resendLink: {
    color: '#FF8C00',
    fontSize: 14,
    fontWeight: '600',
  },
  resendText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  // Succès
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default OtpVerificationScreen;
