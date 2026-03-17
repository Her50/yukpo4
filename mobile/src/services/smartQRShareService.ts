// @ts-nocheck
// ✅ Service intelligent de partage QR - Intégré au système delivery existant

import { apiGet, apiPost } from '../services/api';
import { smartShareService } from './smartShareService';

export interface DeliveryShareInfo {
  delivery_id: string;
  tracking_token: string;
  share_url?: string;
  dropoff_pending: boolean;
}

export interface DeliveryRecipient {
  user_id?: number;
  contact_name?: string;
  contact_phone?: string;
  allow_tracking?: boolean;
  allow_contact?: boolean;
  consent_granted?: boolean;
}

export interface DeliverySummary {
  id: string;
  status: string;
  recipient?: DeliveryRecipient;
  courier?: any;
  pickup: any;
  dropoff: any;
  metadata: any;
}

/**
 * Service intelligent qui connaît la chaîne de livraison et identifie
 * automatiquement le destinataire selon le contexte actuel
 */
class SmartQRShareService {

  /**
   * Analyse le contexte et identifie le destinataire approprié
   * selon le statut de la livraison et le rôle de l'utilisateur
   */
  async analyzeDeliveryContext(deliveryId: string, userRole: 'courier' | 'client' | 'admin'): Promise<{
    action: 'share_to_recipient' | 'share_to_courier' | 'generate_qr' | 'no_action';
    recipientInfo?: {
      name: string;
      phone?: string;
      userId?: number;
      shareUrl?: string;
    };
    reason: string;
  }> {
    try {
      // Récupérer le résumé de la livraison
      const response = await apiGet(`/api/deliveries/${deliveryId}`);
      const delivery: DeliverySummary = response.data || response;

      console.log('[SmartQRShare] Analyse contexte livraison:', {
        status: delivery.status,
        hasRecipient: !!delivery.recipient,
        hasCourier: !!delivery.courier,
        userRole
      });

      // Cas 1: Coursier veut partager au client/destinataire
      if (userRole === 'courier') {
        if (delivery.recipient) {
          // Le destinataire est déjà connu
          return {
            action: 'share_to_recipient',
            recipientInfo: {
              name: delivery.recipient.contact_name || 'Client',
              phone: delivery.recipient.contact_phone,
              userId: delivery.recipient.user_id
            },
            reason: 'Destinataire connu, partage direct possible'
          };
        } else {
          // Destinataire non encore défini, générer QR pour identification
          return {
            action: 'generate_qr',
            reason: 'Destinataire non encore défini, QR code requis'
          };
        }
      }

      // Cas 2: Client veut partager au coursier
      if (userRole === 'client') {
        if (delivery.courier) {
          // Coursier déjà assigné
          return {
            action: 'share_to_courier',
            recipientInfo: {
              name: delivery.courier.name || 'Coursier',
              userId: delivery.courier.user_id
            },
            reason: 'Coursier assigné, partage direct possible'
          };
        } else {
          // Pas encore de coursier, attendre le matching
          return {
            action: 'generate_qr',
            reason: 'Coursier non encore assigné, QR code pour tracking'
          };
        }
      }

      // Cas 3: Admin ou autre
      return {
        action: 'generate_qr',
        reason: 'Génération QR code par défaut'
      };

    } catch (error) {
      console.error('[SmartQRShare] Erreur analyse contexte:', error);
      return {
        action: 'generate_qr',
        reason: 'Erreur analyse, fallback vers QR code'
      };
    }
  }

  /**
   * Partage intelligent selon le contexte analysé
   */
  async smartShare(deliveryId: string, userRole: 'courier' | 'client' | 'admin'): Promise<{
    success: boolean;
    action: string;
    shareUrl?: string;
    qrData?: any;
    message: string;
  }> {
    const context = await this.analyzeDeliveryContext(deliveryId, userRole);

    switch (context.action) {
      case 'share_to_recipient':
        return this.shareToRecipient(deliveryId, context.recipientInfo!);

      case 'share_to_courier':
        return this.shareToCourier(deliveryId, context.recipientInfo!);

      case 'generate_qr':
        return this.generateShareableQR(deliveryId);

      default:
        return {
          success: false,
          action: 'no_action',
          message: context.reason
        };
    }
  }

  /**
   * Partage direct au destinataire connu avec WhatsApp/SMS intelligent
   */
  private async shareToRecipient(deliveryId: string, recipient: any): Promise<any> {
    try {
      // Utiliser le système de partage existant
      const response = await apiPost(`/api/delivery/${deliveryId}/share-dropoff`);
      const shareInfo: DeliveryShareInfo = response.data || response;

      console.log('[SmartQRShare] Partage destinataire:', {
        recipientName: recipient.name,
        shareUrl: shareInfo.share_url
      });

      // Formater le message pour le partage intelligent
      const message = this.formatDeliveryMessage(shareInfo, recipient.name);

      // Partage intelligent via WhatsApp/SMS
      const shareResult = await smartShareService.smartShare({
        method: 'auto', // Laisser le service choisir la meilleure méthode
        phone: recipient.contact_phone,
        message: message,
        url: shareInfo.share_url
      });

      return {
        success: shareResult.success,
        action: 'share_to_recipient',
        shareUrl: shareInfo.share_url,
        shareMethod: shareResult.method,
        recipientName: recipient.name,
        message: shareResult.message || `Lien envoyé à ${recipient.name}`
      };
    } catch (error) {
      console.error('[SmartQRShare] Erreur partage destinataire:', error);
      return {
        success: false,
        action: 'generate_qr',
        message: 'Erreur lors de la génération du QR code'
      };
    }
  }

  /**
   * Partage direct au coursier assigné avec WhatsApp/SMS intelligent
   */
  private async shareToCourier(deliveryId: string, courier: any): Promise<any> {
    try {
      // Pour le coursier, on utilise le tracking token
      const response = await apiPost(`/api/delivery/${deliveryId}/share-dropoff`);
      const shareInfo: DeliveryShareInfo = response.data || response;

      console.log('[SmartQRShare] Partage coursier:', {
        courierName: courier.name,
        shareUrl: shareInfo.share_url
      });

      // Formater le message pour le coursier
      const message = this.formatCourierMessage(shareInfo, courier.name);

      // Partage intelligent via WhatsApp/SMS
      const shareResult = await smartShareService.smartShare({
        method: 'auto',
        phone: courier.contact_phone,
        message: message,
        url: shareInfo.share_url
      });

      return {
        success: shareResult.success,
        action: 'share_to_courier',
        shareUrl: shareInfo.share_url,
        shareMethod: shareResult.method,
        recipientName: courier.name,
        message: shareResult.message || `Lien envoyé à ${courier.name}`
      };
    } catch (error) {
      console.error('[SmartQRShare] Erreur partage coursier:', error);
      return {
        success: false,
        action: 'share_to_courier',
        message: 'Erreur lors du partage au coursier'
      };
    }
  }

  /**
   * Génère un QR code partageable pour la livraison
   */
  private async generateShareableQR(deliveryId: string): Promise<any> {
    try {
      const response = await apiPost(`/api/delivery/${deliveryId}/generate-qr`);
      const data = response.data || response;
      
      return {
        success: true,
        action: 'generate_qr',
        qrData: data,
        shareUrl: data.share_url || data.qr_url,
        message: `QR Code généré pour la livraison. Lien: ${data.share_url || data.qr_url || ''}`
      };
    } catch (error) {
      console.error('[SmartQRShare] Erreur génération QR:', error);
      // Fallback: générer un lien de tracking simple
      const trackingUrl = `https://yukpo.cm/track/${deliveryId}`;
      return {
        success: true,
        action: 'generate_qr',
        shareUrl: trackingUrl,
        message: `Lien de suivi: ${trackingUrl}`
      };
    }
  }

  /**
   * Vérifie le statut d'un QR code ou d'un partage
   */
  async checkShareStatus(deliveryId: string, qrId?: string): Promise<any> {
    try {
      if (qrId) {
        // Vérifier statut QR code
        const response = await apiGet(`/api/librairie-network/qrcode/${qrId}/status`);
        return response.data || response;
      } else {
        // Vérifier statut livraison
        const response = await apiGet(`/api/deliveries/${deliveryId}`);
        const delivery: DeliverySummary = response.data || response;

        return {
          delivery_status: delivery.status,
          has_recipient: !!delivery.recipient,
          has_courier: !!delivery.courier,
          dropoff_pending: delivery.metadata?.dropoff_pending
        };
      }
    } catch (error) {
      console.error('[SmartQRShare] Erreur vérification statut:', error);
      return null;
    }
  }

  private static readonly APP_DOWNLOAD_URL = 'https://yukpo.cm/download';
  private static readonly PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.yukpo.app';

  formatDeliveryMessage(shareInfo: DeliveryShareInfo, recipientName?: string, locale: string = 'fr'): string {
    if (locale === 'en') {
      const greeting = recipientName ? `Hello ${recipientName}` : 'Hello';
      return `📦 ${greeting},

Your Yukpo delivery is ready:

🔸 Tracking number: ${shareInfo.tracking_token}
🔸 Tracking link: ${shareInfo.share_url}
🔸 Status: Awaiting confirmation

Click the link to track your package in real time.

📲 Download Yukpo: ${SmartQRShareService.APP_DOWNLOAD_URL}

Thank you for your trust! 🚀`;
    }

    const greeting = recipientName ? `Bonjour ${recipientName}` : 'Bonjour';
    return `📦 ${greeting},

Votre livraison Yukpo est prête:

🔸 Numéro de suivi: ${shareInfo.tracking_token}
🔸 Lien de tracking: ${shareInfo.share_url}
🔸 Statut: En attente de confirmation

Cliquez sur le lien pour suivre votre colis en temps réel.

📲 Téléchargez l'app Yukpo: ${SmartQRShareService.APP_DOWNLOAD_URL}

Merci de votre confiance! 🚀`;
  }

  formatCourierMessage(shareInfo: DeliveryShareInfo, courierName?: string, locale: string = 'fr'): string {
    if (locale === 'en') {
      const greeting = courierName ? `Hello ${courierName}` : 'Hello';
      return `🚴 ${greeting},

New Yukpo delivery assigned:

🔸 Tracking token: ${shareInfo.tracking_token}
🔸 Tracking link: ${shareInfo.share_url}
🔸 Status: Awaiting pickup

Click the link to start the delivery.

📲 Download Yukpo: ${SmartQRShareService.APP_DOWNLOAD_URL}

Have a safe trip! 📦`;
    }

    const greeting = courierName ? `Bonjour ${courierName}` : 'Bonjour';
    return `🚴 ${greeting},

Nouvelle livraison Yukpo assignée:

🔸 Token tracking: ${shareInfo.tracking_token}
🔸 Lien de suivi: ${shareInfo.share_url}
🔸 Statut: En attente de récupération

Cliquez sur le lien pour commencer la livraison.

📲 Téléchargez l'app Yukpo: ${SmartQRShareService.APP_DOWNLOAD_URL}

Bonne route! 📦`;
  }

  /**
   * Détecte automatiquement le rôle de l'utilisateur selon le contexte
   */
  async detectUserRole(deliveryId: string, userId: number): Promise<'courier' | 'client' | 'admin'> {
    try {
      const response = await apiGet(`/api/deliveries/${deliveryId}`);
      const delivery: DeliverySummary = response.data || response;

      // Si l'utilisateur est le coursier assigné
      if (delivery.courier?.user_id === userId) {
        return 'courier';
      }

      // Si l'utilisateur est le destinataire
      if (delivery.recipient?.user_id === userId) {
        return 'client';
      }

      // Sinon, considérer comme admin (propriétaire de la livraison)
      return 'admin';
    } catch (error) {
      console.error('[SmartQRShare] Erreur détection rôle:', error);
      return 'admin';
    }
  }
}

// Export singleton
export const smartQRShareService = new SmartQRShareService();

// Types pour l'intégration mobile
export interface SmartShareResult {
  success: boolean;
  action: 'share_to_recipient' | 'share_to_courier' | 'generate_qr' | 'no_action';
  shareUrl?: string;
  qrData?: any;
  message: string;
  recipientName?: string;
  nextAction?: 'share_via_whatsapp' | 'share_via_sms' | 'scan_qr' | 'wait';
}
