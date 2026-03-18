// @ts-nocheck
// ✅ Service de partage WhatsApp/SMS intelligent avec validation téléphone

import { Share, Alert, Linking } from 'react-native';
import { apiGet, apiPost } from '../services/api';

export interface PhoneValidationResult {
  phone: string;
  country: string;
  isVerified: boolean;
  canReceiveWhatsApp: boolean;
  canReceiveSMS: boolean;
}

export interface ShareOptions {
  method: 'whatsapp' | 'sms' | 'share' | 'auto';
  phone?: string;
  message: string;
  url?: string;
}

/**
 * Service intelligent de partage avec validation téléphone
 */
class SmartShareService {
  
  /**
   * Valide le numéro de téléphone et détecte les capacités
   */
  async validatePhoneNumber(userId: number): Promise<PhoneValidationResult> {
    try {
      const response = await apiGet(`/api/users/${userId}/phone-status`);
      const data = response.data || response;
      
      return {
        phone: data.phone || '',
        country: data.phone_country || 'CM',
        isVerified: data.phone_verified || false,
        canReceiveWhatsApp: this.canReceiveWhatsApp(data.phone, data.phone_country),
        canReceiveSMS: !!data.phone
      };
    } catch (error) {
      console.error('[SmartShareService] Erreur validation téléphone:', error);
      return {
        phone: '',
        country: 'CM',
        isVerified: false,
        canReceiveWhatsApp: false,
        canReceiveSMS: false
      };
    }
  }
  
  /**
   * Détecte si un numéro peut recevoir WhatsApp
   */
  private canReceiveWhatsApp(phone?: string, country?: string): boolean {
    if (!phone) return false;
    
    // WhatsApp disponible dans la plupart des pays africains
    const whatsappCountries = ['CM', 'CI', 'SN', 'CD', 'GA', 'TG', 'BJ', 'BF', 'ML', 'NE', 'TD'];
    
    return whatsappCountries.includes(country || 'CM') && phone.length >= 9;
  }
  
  /**
   * Partage intelligent selon les capacités du téléphone
   */
  async smartShare(options: ShareOptions, userId?: number): Promise<{
    success: boolean;
    method: string;
    message: string;
  }> {
    // Si un userId est fourni, valider le téléphone
    if (userId) {
      const phoneStatus = await this.validatePhoneNumber(userId);
      
      // Choix automatique de la meilleure méthode
      if (phoneStatus.isVerified && phoneStatus.canReceiveWhatsApp && options.method !== 'sms') {
        return this.shareViaWhatsApp(options.message, options.url, phoneStatus.phone);
      } else if (phoneStatus.canReceiveSMS && options.method !== 'whatsapp') {
        return this.shareViaSMS(options.message, options.url, phoneStatus.phone);
      } else {
        // Fallback vers partage natif
        return this.shareNative(options.message, options.url);
      }
    }
    
    // Pas de validation - utiliser la méthode demandée
    switch (options.method) {
      case 'whatsapp':
        return this.shareViaWhatsApp(options.message, options.url, options.phone);
      case 'sms':
        return this.shareViaSMS(options.message, options.url, options.phone);
      case 'auto':
        if (options.phone) {
          const result = await this.shareViaWhatsApp(options.message, options.url, options.phone);
          if (result.success) return result;
          return this.shareViaSMS(options.message, options.url, options.phone);
        }
        return this.shareNative(options.message, options.url);
      default:
        return this.shareNative(options.message, options.url);
    }
  }
  
  /**
   * Partage via WhatsApp (utilise le schéma WhatsApp)
   */
  private async shareViaWhatsApp(message: string, url?: string, phone?: string): Promise<any> {
    try {
      const fullMessage = url ? `${message}\n\n${url}` : message;
      
      // Format pour WhatsApp
      let whatsappUrl = `whatsapp://send?text=${encodeURIComponent(fullMessage)}`;
      
      if (phone) {
        // Numéro spécifique
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        whatsappUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(fullMessage)}`;
      }
      
      // Vérifier si WhatsApp est installé
      const canOpenWhatsApp = await this.canOpenURL(whatsappUrl);
      
      if (canOpenWhatsApp) {
        await this.openURL(whatsappUrl);
        return {
          success: true,
          method: 'whatsapp',
          message: phone ? `Message envoyé via WhatsApp à ${phone}` : 'WhatsApp ouvert avec le message'
        };
      } else {
        // WhatsApp non installé, fallback vers web
        const webUrl = url ? `https://wa.me/?text=${encodeURIComponent(fullMessage)}` : `https://wa.me/`;
        await this.openURL(webUrl);
        
        return {
          success: true,
          method: 'whatsapp_web',
          message: 'WhatsApp Web ouvert (application non installée)'
        };
      }
    } catch (error) {
      console.error('[SmartShareService] Erreur WhatsApp:', error);
      return {
        success: false,
        method: 'whatsapp',
        message: 'Impossible d\'ouvrir WhatsApp'
      };
    }
  }
  
  /**
   * Partage via SMS (utilise le schéma SMS)
   */
  private async shareViaSMS(message: string, url?: string, phone?: string): Promise<any> {
    try {
      const fullMessage = url ? `${message}\n\n${url}` : message;
      
      if (phone) {
        // SMS direct à un numéro
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(fullMessage)}`;
        
        await this.openURL(smsUrl);
        return {
          success: true,
          method: 'sms',
          message: `Message SMS prêt pour ${phone}`
        };
      } else {
        // SMS sans destinataire (choix du système)
        const smsUrl = `sms:?body=${encodeURIComponent(fullMessage)}`;
        await this.openURL(smsUrl);
        
        return {
          success: true,
          method: 'sms',
          message: 'Application SMS ouverte avec le message'
        };
      }
    } catch (error) {
      console.error('[SmartShareService] Erreur SMS:', error);
      return {
        success: false,
        method: 'sms',
        message: 'Impossible d\'ouvrir l\'application SMS'
      };
    }
  }
  
  /**
   * Partage natif (fallback)
   */
  private async shareNative(message: string, url?: string): Promise<any> {
    try {
      const shareOptions = {
        message: url ? `${message}\n\n${url}` : message,
        url: url,
        title: 'Yukpo - Partage',
      };
      
      await Share.share(shareOptions);
      
      return {
        success: true,
        method: 'native',
        message: 'Message partagé via le système natif'
      };
    } catch (error) {
      console.error('[SmartShareService] Erreur partage natif:', error);
      return {
        success: false,
        method: 'native',
        message: 'Partage annulé ou erreur système'
      };
    }
  }
  
  private async canOpenURL(url: string): Promise<boolean> {
    try {
      return await Linking.canOpenURL(url);
    } catch (error) {
      return false;
    }
  }
  
  private async openURL(url: string): Promise<void> {
    try {
      await Linking.openURL(url);
    } catch (error) {
      throw new Error(`Impossible d'ouvrir l'URL: ${url}`);
    }
  }
  
  /**
   * Demande la validation du numéro de téléphone
   */
  async requestPhoneVerification(userId: number, phone: string, country: string = 'CM'): Promise<{
    success: boolean;
    message: string;
    requiresOTP?: boolean;
  }> {
    try {
      const response = await apiPost('/api/users/request-phone-verification', {
        user_id: userId,
        phone: phone,
        country: country
      });
      
      const data = response.data || response;
      
      if (data.success) {
        return {
          success: true,
          message: 'Code de vérification envoyé',
          requiresOTP: true
        };
      } else {
        return {
          success: false,
          message: data.message || 'Erreur lors de l\'envoi du code'
        };
      }
    } catch (error: any) {
      console.error('[SmartShareService] Erreur demande vérification:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Erreur serveur'
      };
    }
  }
  
  /**
   * Vérifie le code OTP
   */
  async verifyPhoneCode(userId: number, code: string): Promise<{
    success: boolean;
    message: string;
    phone?: string;
  }> {
    try {
      const response = await apiPost('/api/users/verify-phone-code', {
        user_id: userId,
        code: code
      });
      
      const data = response.data || response;
      
      if (data.success) {
        return {
          success: true,
          message: 'Téléphone vérifié avec succès',
          phone: data.phone
        };
      } else {
        return {
          success: false,
          message: data.message || 'Code invalide'
        };
      }
    } catch (error: any) {
      console.error('[SmartShareService] Erreur vérification code:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Erreur serveur'
      };
    }
  }
  
  /**
   * Formate le message de partage QR code
   */
  private static readonly APP_DOWNLOAD_URL = 'https://yukpo.cm/download';

  formatQRShareMessage(qrData: any, recipientName?: string): string {
    const greeting = recipientName ? `Bonjour ${recipientName}` : 'Bonjour';
    
    return `\uD83D\uDCE6 ${greeting},

Voici votre code de livraison Yukpo:

\uD83D\uDD38 QR ID: ${qrData.qr_id}
\uD83D\uDD38 Valide jusqu'au: ${new Date(qrData.valide_jusqua).toLocaleString('fr-FR')}
\uD83D\uDD38 Lien direct: ${qrData.share_url}

Scannez ce QR code ou cliquez sur le lien pour valider la réception de votre colis.

\uD83D\uDCF2 Téléchargez l'app Yukpo: ${SmartShareService.APP_DOWNLOAD_URL}

Merci d'utiliser Yukpo! \uD83D\uDE80`;
  }
  
  formatTrackingMessage(deliveryInfo: any, recipientName?: string): string {
    const greeting = recipientName ? `Cher ${recipientName}` : 'Bonjour';
    
    return `\uD83D\uDCCD ${greeting},

Suivez votre livraison Yukpo en temps réel:

\uD83D\uDD38 Numéro: ${deliveryInfo.tracking_token}
\uD83D\uDD38 Statut: ${deliveryInfo.status}
\uD83D\uDD38 Lien tracking: ${deliveryInfo.share_url}

Cliquez sur le lien pour suivre votre colis en temps réel.

\uD83D\uDCF2 Téléchargez l'app Yukpo: ${SmartShareService.APP_DOWNLOAD_URL}

Merci de votre confiance! \uD83D\uDCE6`;
  }
}

// Export singleton
export const smartShareService = new SmartShareService();

// Types pour les composants
export interface SmartShareButtonProps {
  deliveryId?: string;
  qrData?: any;
  userId?: number;
  recipientName?: string;
  onShareComplete?: (result: any) => void;
  preferredMethod?: 'whatsapp' | 'sms' | 'auto';
}
