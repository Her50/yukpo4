/**
 * ProviderCourierVerificationScreen
 * 
 * Écran côté PRESTATAIRE : permet de vérifier l'identité du coursier
 * qui arrive au point de pickup. Le prestataire peut :
 * 1. Scanner le QR code du coursier
 * 2. Saisir manuellement le code PIN à 6 chiffres
 * 
 * Après vérification réussie, affiche la liste des produits à remettre au coursier.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCodeScanner from '../../components/QRCodeScanner';
import SafeIcon from '../../components/SafeIcon';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface ProductToPickup {
  product_index: number;
  product_name: string;
  product_price?: number;
  quantity: number;
  image_url?: string;
  notes?: string;
}

interface VerificationResult {
  is_valid: boolean;
  courier_id?: string;
  courier_name?: string;
  courier_avatar_url?: string;
  courier_vehicle_type?: string;
  delivery_id?: string;
  order_id?: string;
  message: string;
  products_to_pickup: ProductToPickup[];
  pickup_address?: string;
  dropoff_address?: string;
  client_name?: string;
  delivery_price?: number;
  insurance_cost?: number;
}

interface ProviderCourierVerificationScreenProps {
  route: {
    params: {
      deliveryId: string;
    };
  };
  navigation: any;
}

const ProviderCourierVerificationScreen: React.FC<ProviderCourierVerificationScreenProps> = ({
  route,
  navigation,
}) => {
  const { deliveryId } = route.params;
  const [mode, setMode] = useState<'choose' | 'pin' | 'scan'>('choose');

    const { t } = useLanguageSafe();  const [pinCode, setPinCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  const pinInputRefs = useRef<(TextInput | null)[]>([]);

  const handleVerify = useCallback(async (code: string, method: string) => {
    try {
      setVerifying(true);
      setError(null);

      const response: any = await deliveryApi.verifyCourier(deliveryId, code, method);

      if (response?.success && response?.data) {
        const data = response.data;
        const result: VerificationResult = data.result || data;

        setVerificationResult(result);

        if (result.is_valid) {
          Alert.alert(
            t('providerCourierVerificationScreen.coursierVerifie'),
            t('providerCourierVerificationScreen.estBienLeCoursierEnvoyePar', { result_courier_name || 'Coursier': result.courier_name || 'Coursier' }),
          );
        } else {
          setError(result.message || t('providerCourierVerification.codeDeVerificationInvalide'));
        }
      } else {
        setError(t('providerCourierVerification.erreurLorsDeLaVerification'));
      }
    } catch (err: any) {
      console.error('[ProviderVerification] Erreur:', err);
      setError(err?.message || t('providerCourierVerification.erreurLorsDeLaVerification'));
    } finally {
      setVerifying(false);
    }
  }, [deliveryId]);

  const handlePinSubmit = useCallback(() => {
    const code = pinCode.join('');
    if (code.length !== 6) {
      setError(t('providerCourierVerificationScreen.veuillezSaisirLes6ChiffresDu'));
      return;
    }
    handleVerify(code, 'pin_code');
  }, [pinCode, handleVerify]);

  const handleQRScan = useCallback((qrData: string) => {
    setScannerVisible(false);
    try {
      const parsed = JSON.parse(qrData);
      if (parsed.type === 'courier_verification' && parsed.code) {
        handleVerify(parsed.code, 'qr_scan');
      } else {
        setError('QR code invalide. Ce n\t('providerCourierVerificationScreen.estPasUnCodeDeVerification'));
        setMode('choose');
      }
    } catch {
      // Peut-être un code brut (juste le PIN)
      if (/^\d{6}$/.test(qrData)) {
        handleVerify(qrData, 'qr_scan');
      } else {
        setError('QR code non reconnu');
        setMode('choose');
      }
    }
  }, [handleVerify]);

  const handlePinDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Paste support: distribute digits across inputs
      const digits = value.replace(/\D/g, '').split('').slice(0, 6);
      const newPin = [...pinCode];
      digits.forEach((d, i) => {
        if (index + i < 6) newPin[index + i] = d;
      });
      setPinCode(newPin);
      const nextIndex = Math.min(index + digits.length, 5);
      pinInputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newPin = [...pinCode];
    newPin[index] = digit;
    setPinCode(newPin);

    // Auto-focus next input
    if (digit && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !pinCode[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
      const newPin = [...pinCode];
      newPin[index - 1] = '';
      setPinCode(newPin);
    }
  };

  // Si vérification réussie, afficher le résultat
  if (verificationResult?.is_valid) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <SafeIcon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('providerCourierVerification.verificationReussie')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Bannière succès */}
          <View style={styles.successBanner}>
            <SafeIcon name="check-circle" size={48} color="#fff" />
            <Text style={styles.successTitle}>{t('providerCourierVerification.coursierVerifie')}</Text>
            <Text style={styles.successSubtitle}>
              Vous pouvez remettre les produits en toute confiance
            </Text>
          </View>

          {/* Info coursier */}
          <View style={styles.courierInfoCard}>
            <View style={styles.courierAvatarContainer}>
              {verificationResult.courier_avatar_url ? (
                <Image
                  source={{ uri: verificationResult.courier_avatar_url }}
                  style={styles.courierAvatar}
                />
              ) : (
                <View style={styles.courierAvatarPlaceholder}>
                  <SafeIcon name="user" size={32} color={modernColors.primary} />
                </View>
              )}
            </View>
            <View style={styles.courierDetails}>
              <Text style={styles.courierName}>
                {verificationResult.courier_name || 'Coursier'}
              </Text>
              {verificationResult.courier_vehicle_type && (
                <View style={styles.vehicleBadge}>
                  <SafeIcon name="truck" size={14} color={modernColors.textSecondary} />
                  <Text style={styles.vehicleText}>
                    {verificationResult.courier_vehicle_type}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Adresses */}
          {(verificationResult.pickup_address || verificationResult.dropoff_address) && (
            <View style={styles.addressCard}>
              {verificationResult.pickup_address && (
                <View style={styles.addressRow}>
                  <View style={[styles.addressDot, { backgroundColor: modernColors.success }]} />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>Pickup</Text>
                    <Text style={styles.addressText}>{verificationResult.pickup_address}</Text>
                  </View>
                </View>
              )}
              {verificationResult.dropoff_address && (
                <View style={styles.addressRow}>
                  <View style={[styles.addressDot, { backgroundColor: modernColors.error }]} />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>{t('providerCourierVerification.livraison')}/Text>
                    <Text style={styles.addressText}>{verificationResult.dropoff_address}</Text>
                  </View>
                </View>
              )}
              {verificationResult.client_name && (
                <View style={styles.addressRow}>
                  <View style={[styles.addressDot, { backgroundColor: modernColors.info }]} />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>Client</Text>
                    <Text style={styles.addressText}>{verificationResult.client_name}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Liste des produits à remettre */}
          {verificationResult.products_to_pickup.length > 0 && (
            <View style={styles.productsSection}>
              <Text style={styles.productsSectionTitle}>
                📦 Produits à remettre ({verificationResult.products_to_pickup.length})
              </Text>
              {verificationResult.products_to_pickup.map((product, index) => (
                <View key={index} style={styles.productCard}>
                  <View style={styles.productIndexBadge}>
                    <Text style={styles.productIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.product_name}</Text>
                    <View style={styles.productMeta}>
                      <Text style={styles.productQuantity}>
                        Quantité : {product.quantity}
                      </Text>
                      {product.product_price != null && (
                        <Text style={styles.productPrice}>
                          {product.product_price.toLocaleString()} FCFA
                        </Text>
                      )}
                    </View>
                    {product.notes && (
                      <Text style={styles.productNotes}>📝 {product.notes}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Résumé des prix - même structure que estimate_delivery_costs */}
          {(verificationResult.products_to_pickup.length > 0 || verificationResult.delivery_price || verificationResult.insurance_cost) && (
            <View style={styles.priceSummaryCard}>
              <Text style={styles.priceSummaryTitle}>{t('providerCourierVerification.resumeDesCouts')}</Text>

              {/* Total des produits */}
              {verificationResult.products_to_pickup.length > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    Produits ({verificationResult.products_to_pickup.length})
                  </Text>
                  <Text style={styles.priceValue}>
                    {verificationResult.products_to_pickup
                      .reduce((sum, product) => sum + (product.product_price || 0) * product.quantity, 0)
                      .toLocaleString()} FCFA
                  </Text>
                </View>
              )}

              {/* Prix de livraison */}
              {verificationResult.delivery_price && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{t('providerCourierVerification.livraison')}/Text>
                  <Text style={styles.priceValue}>
                    {verificationResult.delivery_price.toLocaleString()} FCFA
                  </Text>
                </View>
              )}

              {/* Frais d'assurance */}
              {verificationResult.insurance_cost && verificationResult.insurance_cost > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>🛡️ Assurance</Text>
                  <Text style={styles.priceValue}>
                    {verificationResult.insurance_cost.toLocaleString()} FCFA
                  </Text>
                </View>
              )}

              {/* Total général */}
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>{t('providerCourierVerification.totalAPayer')}</Text>
                <Text style={styles.totalValue}>
                  {(
                    verificationResult.products_to_pickup
                      .reduce((sum, product) => sum + (product.product_price || 0) * product.quantity, 0) +
                    (verificationResult.delivery_price || 0) +
                    (verificationResult.insurance_cost || 0)
                  ).toLocaleString()} FCFA
                </Text>
              </View>
            </View>
          )}

          {/* Bouton confirmer remise */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => {
              Alert.alert(
                'Confirmer la remise',
                'Confirmez-vous avoir remis tous les produits au coursier ?',
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.confirm'),
                    onPress: () => navigation.goBack(),
                  },
                ],
              );
            }}
          >
            <SafeIcon name="check" size={20} color="#fff" />
            <Text style={styles.confirmButtonText}>
              Confirmer la remise des produits
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Écran de choix de méthode / saisie PIN
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (mode !== 'choose') {
              setMode('choose');
              setError(null);
              setPinCode(['', '', '', '', '', '']);
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backButton}
        >
          <SafeIcon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('providerCourierVerification.verifierLeCoursier')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Erreur */}
        {error && (
          <View style={styles.errorBanner}>
            <SafeIcon name="alert-triangle" size={20} color={modernColors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {mode === 'choose' && (
          <>
            {/* Instruction */}
            <View style={styles.instructionCard}>
              <SafeIcon name="shield" size={40} color={modernColors.primary} />
              <Text style={styles.instructionTitle}>
                Vérifiez l'identité du coursier
              </Text>
              <Text style={styles.instructionText}>
                Avant de remettre les produits, vérifiez que le coursier est bien celui envoyé par l'application Yukpo.
              </Text>
            </View>

            {/* Option 1 : Scanner QR */}
            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => {
                setError(null);
                setScannerVisible(true);
              }}
            >
              <View style={[styles.methodIcon, { backgroundColor: '#EEF2FF' }]}>
                <SafeIcon name="maximize" size={28} color={modernColors.primary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Scanner le QR code</Text>
                <Text style={styles.methodDescription}>
                  Scannez le QR code affiché sur le téléphone du coursier
                </Text>
              </View>
              <SafeIcon name="chevron-right" size={20} color={modernColors.textTertiary} />
            </TouchableOpacity>

            {/* Option 2 : Saisir PIN */}
            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => {
                setError(null);
                setMode('pin');
              }}
            >
              <View style={[styles.methodIcon, { backgroundColor: '#F0FDF4' }]}>
                <SafeIcon name="hash" size={28} color={modernColors.success} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Saisir le code PIN</Text>
                <Text style={styles.methodDescription}>
                  Demandez au coursier son code à 6 chiffres et saisissez-le
                </Text>
              </View>
              <SafeIcon name="chevron-right" size={20} color={modernColors.textTertiary} />
            </TouchableOpacity>
          </>
        )}

        {mode === 'pin' && (
          <>
            <Text style={styles.pinTitle}>
              Saisissez le code à 6 chiffres
            </Text>
            <Text style={styles.pinSubtitle}>
              Demandez au coursier de vous donner son code PIN
            </Text>

            {/* Inputs PIN */}
            <View style={styles.pinInputRow}>
              {pinCode.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { pinInputRefs.current[index] = ref; }}
                  style={[
                    styles.pinInput,
                    digit ? styles.pinInputFilled : {},
                  ]}
                  value={digit}
                  onChangeText={(value) => handlePinDigitChange(index, value)}
                  onKeyPress={({ nativeEvent }) => handlePinKeyPress(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              ))}
            </View>

            {/* Bouton vérifier */}
            <TouchableOpacity
              style={[
                styles.verifyButton,
                pinCode.join('').length !== 6 && styles.verifyButtonDisabled,
              ]}
              onPress={handlePinSubmit}
              disabled={verifying || pinCode.join('').length !== 6}
            >
              {verifying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <SafeIcon name="shield-check" size={20} color="#fff" />
                  <Text style={styles.verifyButtonText}>{t('providerCourierVerification.verifier')}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Scanner QR modal */}
      <QRCodeScanner
        visible={scannerVisible}
        onClose={() => {
          setScannerVisible(false);
          setMode('choose');
        }}
        onScan={handleQRScan}
        onError={(err) => {
          setError(err);
          setScannerVisible(false);
          setMode('choose');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
    backgroundColor: modernColors.primary,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: modernColors.error,
    fontWeight: '500',
  },
  instructionCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: modernColors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  methodCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  methodIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: modernColors.text,
  },
  methodDescription: {
    fontSize: 13,
    color: modernColors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  pinTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: modernColors.text,
    textAlign: 'center',
    marginTop: 24,
  },
  pinSubtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  pinInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  pinInput: {
    width: 48,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: modernColors.text,
  },
  pinInputFilled: {
    borderColor: modernColors.primary,
    backgroundColor: '#F0F4FF',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: modernColors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginHorizontal: 16,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  successBanner: {
    backgroundColor: modernColors.success,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
  },
  successSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  courierInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  courierAvatarContainer: {
    marginRight: 14,
  },
  courierAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  courierAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  courierDetails: {
    flex: 1,
  },
  courierName: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  vehicleText: {
    fontSize: 13,
    color: modernColors.textSecondary,
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 14,
    color: modernColors.text,
    marginTop: 2,
  },
  productsSection: {
    marginBottom: 20,
  },
  productsSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  productIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: modernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productIndexText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: modernColors.text,
  },
  productMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  productQuantity: {
    fontSize: 13,
    color: modernColors.textSecondary,
  },
  productPrice: {
    fontSize: 13,
    color: modernColors.primary,
    fontWeight: '600',
  },
  productNotes: {
    fontSize: 12,
    color: modernColors.textTertiary,
    marginTop: 4,
  },
  priceSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  priceSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: modernColors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: modernColors.text,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: modernColors.primary,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: modernColors.success,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ProviderCourierVerificationScreen;
