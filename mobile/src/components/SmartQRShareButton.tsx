// @ts-nocheck
// ✅ Composant intelligent de partage QR avec contexte automatique

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { useToaster } from '../components/ToasterProvider';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { smartQRShareService, SmartShareResult } from '../services/smartQRShareService';
import { modernColors, modernStyles } from '../theme/modernTheme';
import QRShareNotification from './QRShareNotification';

interface SmartQRShareButtonProps {
  deliveryId: string;
  userId: number;
  onShareComplete?: (result: SmartShareResult) => void;
  style?: any;
  showDetails?: boolean;
}

const SmartQRShareButton: React.FC<SmartQRShareButtonProps> = ({
  deliveryId,
  userId,
  onShareComplete,
  style,
  showDetails = true
}) => {
  const { t } = useLanguageSafe();
  const toaster = useToaster();

  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<'courier' | 'client' | 'admin'>('admin');
  const [shareResult, setShareResult] = useState<SmartShareResult | null>(null);
  const [notification, setNotification] = useState<{
    visible: boolean;
    type: 'whatsapp' | 'sms' | 'qr_generated' | 'share_native' | 'error';
    message: string;
    recipientName?: string;
  }>({
    visible: false,
    type: 'share_native',
    message: '',
  });

  // Feedback sonore et visuel
  const triggerFeedback = useCallback((type: 'success' | 'error' | 'info') => {
    // Vibration selon le type
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      switch (type) {
        case 'success':
          // Double vibration courte pour succès
          Vibration.vibrate([100, 50, 100]);
          break;
        case 'error':
          // Vibration longue pour erreur
          Vibration.vibrate(500);
          break;
        case 'info':
          // Vibration courte pour info
          Vibration.vibrate(100);
          break;
      }
    }
  }, []);

  // Afficher la notification améliorée
  const showNotification = useCallback((
    type: 'whatsapp' | 'sms' | 'qr_generated' | 'share_native' | 'error',
    message: string,
    recipientName?: string
  ) => {
    setNotification({
      visible: true,
      type,
      message,
      recipientName,
    });
  }, []);

  // Masquer la notification
  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, visible: false }));
  }, []);

  // Détecter automatiquement le rôle de l'utilisateur
  useEffect(() => {
    const detectRole = async () => {
      try {
        const role = await smartQRShareService.detectUserRole(deliveryId, userId);
        setUserRole(role);
        console.log('[SmartQRShareButton] Rôle détecté:', role);
      } catch (error) {
        console.error('[SmartQRShareButton] Erreur détection rôle:', error);
      }
    };

    detectRole();
  }, [deliveryId, userId]);

  // Partage intelligent
  const handleSmartShare = useCallback(async () => {
    setLoading(true);

    try {
      const result = await smartQRShareService.smartShare(deliveryId, userRole);
      setShareResult(result);

      if (result.success) {
        // Feedback sonore et visuel pour succès
        triggerFeedback('success');

        // Notification améliorée selon le type de partage
        const shareMethod = result.shareMethod || 'standard';
        let notificationType: 'whatsapp' | 'sms' | 'qr_generated' | 'share_native' = 'share_native';
        let recipientName: string | undefined;

        if (shareMethod === 'whatsapp') {
          notificationType = 'whatsapp';
          recipientName = result.recipientName;
        } else if (shareMethod === 'sms') {
          notificationType = 'sms';
          recipientName = result.recipientName;
        } else if (shareMethod === 'whatsapp_web') {
          notificationType = 'whatsapp';
          recipientName = result.recipientName;
        } else if (result.action === 'generate_qr') {
          notificationType = 'qr_generated';
        }

        // Afficher la notification améliorée
        showNotification(notificationType, result.message, recipientName);

        // Toaster simple en complément
        toaster?.show?.(result.message, 'success');

        // Action automatique selon le résultat
        if (result.shareUrl && result.action !== 'generate_qr') {
          // Partage direct du lien
          await handleDirectShare(result);
        } else if (result.action === 'generate_qr' && result.qrData) {
          // Afficher les options QR
          handleQRGenerated(result);
        }

        onShareComplete?.(result);
      } else {
        // Feedback sonore et visuel pour erreur
        triggerFeedback('error');
        showNotification('error', result.message);
        Alert.alert(t('smartQRShareButton.errorTitle'), result.message);
      }
    } catch (error: any) {
      console.error('[SmartQRShareButton] Erreur partage:', error);
      Alert.alert(t('smartQRShareButton.errorTitle'), t('smartQRShareButton.cannotShareDelivery'));
    } finally {
      setLoading(false);
    }
  }, [deliveryId, userRole, toaster, onShareComplete]);

  // Partage direct du lien
  const handleDirectShare = useCallback(async (result: SmartShareResult) => {
    try {
      const shareOptions = {
        message: `\uD83D\uDCE6 Yukpo Delivery - Suivi colis\n\n${result.message}\nLien: ${result.shareUrl}\n\nSuivez votre livraison en temps réel!`,
        url: result.shareUrl,
        title: 'Suivi Livraison Yukpo',
      };

      await Share.share(shareOptions);

      // Feedback de confirmation du partage natif
      triggerFeedback('info');
      showNotification('share_native', t('smartQRShareButton.linkSharedViaSystem'));
      toaster?.show?.(`\uD83D\uDCE4 ${t('smartQRShareButton.linkSharedViaSystem')}`, 'info');
    } catch (error: any) {
      console.error('[SmartQRShareButton] Erreur partage direct:', error);
      triggerFeedback('error');
    }
  }, []);

  // Options QR généré
  const handleQRGenerated = useCallback((result: SmartShareResult) => {
    Alert.alert(
      `\uD83D\uDCF1 ${t('smartQRShareButton.qrCodeGenerated')}`,
      result.message,
      [
        {
          text: `\uD83D\uDCE4 ${t('smartQRShareButton.shareQR')}`,
          onPress: () => handleDirectShare(result)
        },
        {
          text: `\uD83D\uDCCA ${t('smartQRShareButton.checkStatus')}`,
          onPress: () => handleCheckStatus()
        },
        {
          text: 'OK',
          style: 'cancel'
        }
      ]
    );
  }, [handleDirectShare, t]);

  // Vérifier le statut
  const handleCheckStatus = useCallback(async () => {
    try {
      const status = await smartQRShareService.checkShareStatus(deliveryId, shareResult?.qrData?.qr_id);

      Alert.alert(
        `\uD83D\uDCCA ${t('smartQRShareButton.shareStatus')}`,
        `${t('smartQRShareButton.statusLabel')}: ${status?.delivery_status || t('smartQRShareButton.unknown')}\n` +
        `${t('smartQRShareButton.recipient')}: ${status?.has_recipient ? '✅' : '❌'}\n` +
        `${t('smartQRShareButton.courier')}: ${status?.has_courier ? '✅' : '❌'}\n` +
        `${t('smartQRShareButton.pending')}: ${status?.dropoff_pending ? '⏳' : '✅'}`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      console.error('[SmartQRShareButton] Erreur vérification statut:', error);
    }
  }, [deliveryId, shareResult]);

  const getButtonText = () => {
    if (loading) return t('smartQRShareButton.loading');

    if (shareResult) {
      switch (shareResult.action) {
        case 'share_to_recipient':
          return `\uD83D\uDCE4 ${t('smartQRShareButton.shareToClient')}`;
        case 'share_to_courier':
          return `\uD83D\uDCCD ${t('smartQRShareButton.shareToCourier')}`;
        case 'generate_qr':
          return `\uD83D\uDCF1 ${t('smartQRShareButton.generateQR')}`;
        default:
          return `\uD83D\uDCE6 ${t('smartQRShareButton.shareDelivery')}`;
      }
    }

    switch (userRole) {
      case 'courier':
        return `\uD83D\uDCE4 ${t('smartQRShareButton.shareToClient')}`;
      case 'client':
        return `\uD83D\uDCCD ${t('smartQRShareButton.shareToCourier')}`;
      default:
        return `\uD83D\uDCE6 ${t('smartQRShareButton.shareDelivery')}`;
    }
  };

  // Obtenir la couleur selon le rôle
  const getButtonColor = () => {
    switch (userRole) {
      case 'courier':
        return '#059669'; // vert
      case 'client':
        return '#3B82F6'; // bleu
      default:
        return modernColors.primary;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {showDetails && (
        <View style={styles.contextInfo}>
          <Text style={styles.contextText}>
            {t('smartQRShareButton.role')}: {userRole === 'courier' ? `\uD83D\uDEB4 ${t('smartQRShareButton.roleCourier')}` : userRole === 'client' ? `\uD83D\uDC64 ${t('smartQRShareButton.roleClient')}` : `⚙️ ${t('smartQRShareButton.roleAdmin')}`}
          </Text>
          {shareResult && (
            <Text style={styles.resultText}>
              {t('smartQRShareButton.action')}: {shareResult.message}
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.shareButton,
          { backgroundColor: getButtonColor() }
        ]}
        onPress={handleSmartShare}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <SafeIcon name="share-2" size={20} color="#fff" />
            <Text style={styles.shareButtonText}>{getButtonText()}</Text>
          </>
        )}
      </TouchableOpacity>

      {shareResult?.shareUrl && (
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleDirectShare(shareResult)}
          >
            <SafeIcon name="smartphone" size={16} color={modernColors.primary} />
            <Text style={styles.quickActionText}>{t('smartQRShareButton.resend')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={handleCheckStatus}
          >
            <SafeIcon name="bar-chart-2" size={16} color={modernColors.primary} />
            <Text style={styles.quickActionText}>{t('smartQRShareButton.status')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notification améliorée */}
      <QRShareNotification
        visible={notification.visible}
        type={notification.type}
        message={notification.message}
        recipientName={notification.recipientName}
        onHide={hideNotification}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  contextInfo: {
    backgroundColor: modernColors.surface,
    padding: 12,
    borderRadius: modernStyles.borderRadius.md,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  contextText: {
    fontSize: 12,
    color: modernColors.textSecondary,
    marginBottom: 4,
  },
  resultText: {
    fontSize: 12,
    color: modernColors.primary,
    fontWeight: '500',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: modernStyles.borderRadius.md,
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: modernColors.surface,
    padding: 8,
    borderRadius: modernStyles.borderRadius.md,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickActionText: {
    fontSize: 12,
    color: modernColors.primary,
    fontWeight: '500',
  },
});

export default SmartQRShareButton;
