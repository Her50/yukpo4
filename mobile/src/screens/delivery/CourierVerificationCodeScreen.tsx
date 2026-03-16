/**
 * CourierVerificationCodeScreen
 * 
 * Écran côté COURSIER : affiche le code PIN et le QR code
 * que le coursier doit montrer au prestataire à l'arrivée au point de pickup.
 * Le prestataire scanne le QR ou saisit le PIN pour vérifier l'identité du coursier.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface ProductToPickup {
  product_index: number;
  product_name: string;
  product_price?: number;
  quantity: number;
  image_url?: string;
  notes?: string;
}

interface VerificationCodeData {
  id: string;
  verification_code: string;
  qr_code_data?: string;
  expires_at: string;
  verified_at?: string;
}

interface CourierVerificationCodeScreenProps {
  route: {
    params: {
      deliveryId: string;
    };
  };
  navigation: any;
}

const CourierVerificationCodeScreen: React.FC<CourierVerificationCodeScreenProps> = ({
  route,
  navigation,
}) => {
  const { deliveryId } = route.params;
      const { t } = useLanguageSafe();
const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<VerificationCodeData | null>(null);
  const [products, setProducts] = useState<ProductToPickup[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const loadVerificationCode = useCallback(async () => {
    try {
      setError(null);
      const response: any = await deliveryApi.getMyVerificationCode(deliveryId);
      if (response?.success && response?.data) {
        const data = response.data;
        setVerificationCode(data.verification_code || null);
        setProducts(data.products_to_pickup || []);
      } else if (response?.data) {
        setVerificationCode(response.data.verification_code || null);
        setProducts(response.data.products_to_pickup || []);
      } else {
        setError(t('courierVerificationCode.aucunCodeDeVerificationTrouve'));
      }
    } catch (err: any) {
      console.error('[CourierVerificationCode] Erreur:', err);
      setError(err?.message || 'Erreur lors du chargement du code');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    loadVerificationCode();
  }, [loadVerificationCode]);

  // Countdown timer pour l'expiration
  useEffect(() => {
    if (!verificationCode?.expires_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(verificationCode.expires_at).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expiré');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}min`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [verificationCode?.expires_at]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadVerificationCode();
  }, [loadVerificationCode]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={modernColors.primary} />
        <Text style={styles.loadingText}>{t('courierVerificationCode.chargementDuCodeDeVerification')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadVerificationCode}>
          <Text style={styles.retryButtonText}>{t('courierVerificationCode.reessayer')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pinDigits = verificationCode?.verification_code?.split('') || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <SafeIcon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('courierVerificationCode.monCodeDeVerification')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Instructions */}
        <View style={styles.instructionCard}>
          <SafeIcon name="shield-check" size={28} color={modernColors.primary} />
          <Text style={styles.instructionTitle}>
            Montrez ce code au prestataire
          </Text>
          <Text style={styles.instructionText}>
            À votre arrivée, le prestataire doit scanner votre QR code ou saisir votre code PIN pour confirmer votre identité.
          </Text>
        </View>

        {/* Code PIN affiché en gros */}
        {verificationCode && (
          <View style={styles.pinContainer}>
            <Text style={styles.pinLabel}>CODE PIN</Text>
            <View style={styles.pinDigitsRow}>
              {pinDigits.map((digit, index) => (
                <View key={index} style={styles.pinDigitBox}>
                  <Text style={styles.pinDigitText}>{digit}</Text>
                </View>
              ))}
            </View>

            {/* Expiration */}
            <View style={styles.expirationRow}>
              <SafeIcon name="clock" size={16} color={modernColors.textSecondary} />
              <Text style={styles.expirationText}>
                Expire dans : {timeLeft}
              </Text>
            </View>
          </View>
        )}

        {/* QR Code */}
        {verificationCode?.qr_code_data && (
          <View style={styles.qrContainer}>
            <Text style={styles.qrLabel}>OU SCANNER CE QR CODE</Text>
            <View style={styles.qrCodeBox}>
              {/* Utiliser une API externe pour générer l'image QR */}
              <View style={styles.qrPlaceholder}>
                <SafeIcon name="maximize" size={120} color={modernColors.primary} />
                <Text style={styles.qrDataText}>
                  {verificationCode.verification_code}
                </Text>
              </View>
            </View>
            <Text style={styles.qrHint}>
              Le prestataire peut scanner ce QR code avec son téléphone
            </Text>
          </View>
        )}

        {/* Vérification réussie */}
        {verificationCode?.verified_at && (
          <View style={styles.verifiedBanner}>
            <SafeIcon name="check-circle" size={24} color="#fff" />
            <Text style={styles.verifiedText}>
              Identité vérifiée avec succès !
            </Text>
          </View>
        )}

        {/* Liste des produits à récupérer */}
        {products.length > 0 && (
          <View style={styles.productsSection}>
            <Text style={styles.productsSectionTitle}>
              Produits à récupérer ({products.length})
            </Text>
            {products.map((product, index) => (
              <View key={index} style={styles.productCard}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.product_name}</Text>
                  <View style={styles.productDetails}>
                    <Text style={styles.productQuantity}>
                      Qté: {product.quantity}
                    </Text>
                    {product.product_price != null && (
                      <Text style={styles.productPrice}>
                        {product.product_price.toLocaleString()} FCFA
                      </Text>
                    )}
                  </View>
                  {product.notes && (
                    <Text style={styles.productNotes}>{product.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: modernColors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: modernColors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  instructionCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: modernColors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  pinContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pinLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.textSecondary,
    letterSpacing: 2,
    marginBottom: 16,
  },
  pinDigitsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pinDigitBox: {
    width: 48,
    height: 60,
    backgroundColor: modernColors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDigitText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  expirationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  expirationText: {
    fontSize: 13,
    color: modernColors.textSecondary,
  },
  qrContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  qrCodeBox: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: modernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
  },
  qrPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrDataText: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.primary,
    marginTop: 8,
    letterSpacing: 4,
  },
  qrHint: {
    fontSize: 12,
    color: modernColors.textTertiary,
    marginTop: 12,
    textAlign: 'center',
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: modernColors.success,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  verifiedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  productsSection: {
    marginTop: 4,
  },
  productsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: modernColors.text,
  },
  productDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  productQuantity: {
    fontSize: 13,
    color: modernColors.textSecondary,
    fontWeight: '500',
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
    fontStyle: 'italic',
  },
});

export default CourierVerificationCodeScreen;
