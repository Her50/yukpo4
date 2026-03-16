import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCodeScanner from '../../components/QRCodeScanner';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiPost } from '../../services/api';
import { immobilierService } from '../../services/immobilierService';
import { modernColors, modernStyles } from '../../theme/modernTheme';

type HotelQRScannerRouteParams = {
  propertyId?: number;
  propertyName?: string;
};

type HotelQRScannerRouteProp = {
  params?: HotelQRScannerRouteParams;
};

type ScanResponse = {
  reservation_id: number;
  property_id: number;
  property_name: string;
  unit_number?: string | null;
  client_name: string;
  date_arrivee: string;
  date_depart: string;
  payment_status: string;
  montant_avance: string;
  montant_total: string;
  montant_restant: string;
  status: string;
  can_check_in: boolean;
  can_check_out: boolean;
  qr_type?: 'main' | 'guest';
  guest_label?: string | null;
};

const HotelQRScannerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute() as any;
  const { t } = useLanguageSafe();
  const [scannerVisible, setScannerVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [rawCode, setRawCode] = useState<string | null>(null);

  const propertyName = route.params?.propertyName || t('hotelQRScanner.votreEtablissement');

  const handleScan = useCallback(
    async (qrData: string) => {
      setRawCode(qrData);
      setLoading(true);
      try {
        const response = await apiPost('/api/hotel/reservations/scan-qr', {
          qr_code: qrData,
        });

        const resData = (response?.data || response) as any;
        if (resData?.success && resData?.data) {
          setScanData(resData.data as ScanResponse);
          Alert.alert(t('message.success'), t('hotelQR.reservationFound'));
          setScannerVisible(false);
        } else {
          Alert.alert(
            t('message.error'),
            resData?.message || resData?.error ||
            t('hotelQR.cannotFindReservation')
          );
        }
      } catch (error: any) {
        console.error('[HotelQRScannerScreen] Erreur scan:', error);
        Alert.alert(
          t('message.error'),
          error?.message || t('hotelQR.qrValidationError')
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleCloseScanner = useCallback(() => {
    setScannerVisible(false);
    if (!scanData) {
      navigation.goBack();
    }
  }, [navigation, scanData]);

  const handleRescan = useCallback(() => {
    setScanData(null);
    setRawCode(null);
    setScannerVisible(true);
  }, []);

  const handleCheckIn = useCallback(async () => {
    if (!scanData) return;
    try {
      const res = await immobilierService.checkInReservation(scanData.reservation_id);
      const rd = (res?.data || res) as any;
      if (rd?.success) {
        Alert.alert(t('message.success'), t('hotelQR.checkInDone', { name: scanData.client_name }));
        setScanData({ ...scanData, status: 'checked_in', can_check_in: false, can_check_out: true });
      } else {
        Alert.alert(t('message.error'), rd?.message || t('hotelQR.checkInError'));
      }
    } catch (e: any) {
      Alert.alert(t('message.error'), e.message || t('hotelQR.cannotCheckIn'));
    }
  }, [scanData]);

  const handleCheckOut = useCallback(() => {
    if (!scanData) return;
    Alert.alert(t('hotelQR.confirmCheckOut'), t('hotelQR.checkOutConfirmMsg', { name: scanData.client_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'), onPress: async () => {
          try {
            const res = await immobilierService.checkOutReservation(scanData.reservation_id);
            const rd = (res?.data || res) as any;
            if (rd?.success) {
              Alert.alert(t('message.success'), t('hotelQR.checkOutDone'));
              setScanData({ ...scanData, status: 'checked_out', can_check_in: false, can_check_out: false });
            } else {
              Alert.alert(t('message.error'), rd?.message || t('hotelQR.checkOutError'));
            }
          } catch (e: any) {
            Alert.alert(t('message.error'), e.message || t('hotelQR.cannotCheckOut'));
          }
        }
      }
    ]);
  }, [scanData]);

  const formatAmount = (value: string | number) => {
    const n =
      typeof value === 'string'
        ? Number(value)
        : typeof value === 'number'
          ? value
          : 0;
    if (isNaN(n)) return value;
    return `${n.toLocaleString('fr-FR')} FCFA`;
  };

  const renderStatusBadge = (status: string) => {
    let label = status;
    let bg = '#E5E7EB';
    let color = '#111827';

    switch (status) {
      case 'pending':
        label={t('hotelQRScanner.enAttente')};
        bg = '#FEF3C7';
        color = '#92400E';
        break;
      case 'confirmed':
        label={t('hotelQRScanner.confirmee')};
        bg = '#DBEAFE';
        color = '#1D4ED8';
        break;
      case 'checked_in':
        label={t('hotelQRScanner.clientEnSejour')};
        bg = '#DCFCE7';
        color = '#166534';
        break;
      case 'checked_out':
        label={t('hotelQRScanner.sejourTermine')};
        bg = '#E5E7EB';
        color = '#4B5563';
        break;
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  const renderPaymentStatusBadge = (status: string) => {
    let label = status;
    let bg = '#E5E7EB';
    let color = '#111827';

    switch (status) {
      case 'pending':
        label = 'Paiement en attente';
        bg = '#FEF3C7';
        color = '#92400E';
        break;
      case 'advance_paid':
        label={t('hotelQRScanner.avancePayee')};
        bg = '#DBEAFE';
        color = '#1D4ED8';
        break;
      case 'fully_paid':
        label={t('hotelQRScanner.totalementSoldee')};
        bg = '#DCFCE7';
        color = '#166534';
        break;
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  const renderQrTypeBadge = (qr_type?: string, guest_label?: string | null) => {
    const type = qr_type || 'main';

    if (type === 'guest') {
      return (
        <View style={[styles.badge, { backgroundColor: '#F3E8FF' }]}>
          <Text style={[styles.badgeText, { color: '#7C3AED' }]}>
            {guest_label && guest_label.trim().length > 0
              ? guest_label
              : t('hotelQRScannerScreen.qrInviteCochambrier')}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.badge, { backgroundColor: '#E0F2FE' }]}>
        <Text style={[styles.badgeText, { color: '#0369A1' }]}>
          QR titulaire
        </Text>
      </View>
    );
  };

  return (
    <SafeNativeView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SafeIcon
            name="arrow-left"
            size={24}
            color="#111827"
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{t('hotelQRScanner.scanQrReservation')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {propertyName}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {!scanData && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>
              Scannez le QR code du client à l'accueil
            </Text>
            <Text style={styles.infoText}>
              Le système vous indiquera automatiquement :
            </Text>
            <Text style={styles.infoBullet}>
              • Le statut de la réservation et du paiement
            </Text>
            <Text style={styles.infoBullet}>
              • Le montant avancé et le montant restant à payer
            </Text>
            <Text style={styles.infoBullet}>
              • Les dates de séjour et, si disponible, le numéro de chambre
            </Text>
          </View>
        )}

        {scanData && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>
                Réservation #{scanData.reservation_id}
              </Text>
              <View style={styles.resultHeaderBadges}>
                {renderStatusBadge(scanData.status)}
                {renderQrTypeBadge(scanData.qr_type, scanData.guest_label)}
              </View>
            </View>
            <Text style={styles.propertyName}>{scanData.property_name}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client</Text>
              <View style={styles.row}>
                <SafeIcon name="user" size={18} color="#4B5563" />
                <Text style={styles.rowText}>{scanData.client_name}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('hotelQRScanner.sejour')}</Text>
              <View style={styles.row}>
                <SafeIcon name="calendar" size={18} color="#4B5563" />
                <Text style={styles.rowText}>
                  Arrivée : {scanData.date_arrivee}
                </Text>
              </View>
              <View style={styles.row}>
                <SafeIcon name="calendar" size={18} color="#4B5563" />
                <Text style={styles.rowText}>
                  Départ : {scanData.date_depart}
                </Text>
              </View>
              {scanData.unit_number && (
                <View style={styles.row}>
                  <SafeIcon name="hash" size={18} color="#4B5563" />
                  <Text style={styles.rowText}>
                    Chambre / Unité : {scanData.unit_number}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Paiement</Text>
                {renderPaymentStatusBadge(scanData.payment_status)}
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>{t('hotelQRScanner.montantTotal')}</Text>
                <Text style={styles.amountValue}>
                  {formatAmount(scanData.montant_total)}
                </Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>{t('hotelQRScanner.avancePayee')}</Text>
                <Text style={styles.amountValue}>
                  {formatAmount(scanData.montant_avance)}
                </Text>
              </View>
              <View style={[styles.amountRow, styles.amountRowStrong]}>
                <Text style={styles.amountLabelStrong}>{t('hotelQRScanner.resteAPayer')}</Text>
                <Text style={styles.amountValueStrong}>
                  {formatAmount(scanData.montant_restant)}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={styles.actionsRow}>
                <NativeButton
                  title="Check-in"
                  variant={scanData.can_check_in ? 'primary' : 'secondary'}
                  disabled={!scanData.can_check_in}
                  onPress={handleCheckIn}
                  style={styles.actionButton}
                />
                <NativeButton
                  title="Check-out"
                  variant={scanData.can_check_out ? 'primary' : 'secondary'}
                  disabled={!scanData.can_check_out}
                  onPress={handleCheckOut}
                  style={styles.actionButton}
                />
              </View>
            </View>

            {rawCode && (
              <View style={styles.rawCodeContainer}>
                <Text style={styles.rawCodeLabel}>{t('hotelQRScanner.codeBrutScanne')}</Text>
                <Text style={styles.rawCodeValue} numberOfLines={2}>
                  {rawCode}
                </Text>
              </View>
            )}

            <View style={styles.footerButtons}>
              <NativeButton
                title="Scanner un autre QR"
                variant="secondary"
                onPress={handleRescan}
                style={styles.footerButton}
              />
              <NativeButton
                title={t('hotelQRScannerScreen.fermer')}
                variant="outline"
                onPress={() => navigation.goBack()}
                style={styles.footerButton}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <QRCodeScanner
        visible={scannerVisible}
        onClose={handleCloseScanner}
        onScan={handleScan}
        onError={(msg) => Alert.alert(t('message.error'), msg)}
      />
    </SafeNativeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D4ED8',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 4,
  },
  infoBullet: {
    fontSize: 13,
    color: '#374151',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    ...modernStyles.shadowLight,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  propertyName: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rowText: {
    fontSize: 14,
    color: '#374151',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  amountRowStrong: {
    marginTop: 10,
  },
  amountLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  amountLabelStrong: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  amountValueStrong: {
    fontSize: 16,
    fontWeight: '700',
    color: modernColors.primary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  rawCodeContainer: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  rawCodeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  rawCodeValue: {
    fontSize: 12,
    color: '#111827',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  footerButton: {
    flex: 1,
  },
});

export default HotelQRScannerScreen;


