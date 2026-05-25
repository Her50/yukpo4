/**
 * Service de partage intelligent pour Yukpo (Frontend React Web)
 * Génère automatiquement les deep links et liens web appropriés
 * Compatible avec le service mobile pour partage croisé
 */

export interface ShareProductParams {
  productName: string;
  productDescription?: string;
  price?: string;
  location?: string;
  serviceId: string | number;
  productIndex?: number;
  productId?: string;
  imageUrl?: string;
}

export interface ShareServiceParams {
  serviceName: string;
  serviceDescription?: string;
  serviceId: string | number;
  imageUrl?: string;
}

class SmartShareService {
  private readonly WEB_BASE_URL = process.env.NEXT_PUBLIC_SHARE_URL || window.location.origin;
  private readonly DEEP_LINK_SCHEME = 'yukpomnang';
  
  /**
   * Génère un deep link pour un produit
   */
  private generateProductDeepLink(serviceId: string | number, productIndex?: number): string {
    if (productIndex !== undefined) {
      return `${this.DEEP_LINK_SCHEME}://product/${serviceId}/${productIndex}`;
    }
    return `${this.DEEP_LINK_SCHEME}://service/${serviceId}`;
  }

  /**
   * Génère un lien web pour un produit
   */
  private generateProductWebLink(serviceId: string | number, productIndex?: number): string {
    if (productIndex !== undefined) {
      return `${this.WEB_BASE_URL}/product/${serviceId}?index=${productIndex}`;
    }
    return `${this.WEB_BASE_URL}/service/${serviceId}`;
  }

  /**
   * Génère un deep link pour un service
   */
  private generateServiceDeepLink(serviceId: string | number): string {
    return `${this.DEEP_LINK_SCHEME}://service/${serviceId}`;
  }

  /**
   * Génère un lien web pour un service
   */
  private generateServiceWebLink(serviceId: string | number): string {
    return `${this.WEB_BASE_URL}/service/${serviceId}`;
  }

  /**
   * Détecte si l'utilisateur est sur mobile (via User-Agent)
   */
  private isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * Génère les URLs des stores selon la plateforme
   */
  private getStoreUrls(deepLink: string): { android: string; ios: string } {
    const encodedLink = encodeURIComponent(deepLink);
    
    // ⚠️ APP_STORE_ID: À remplacer par l'ID réel après publication sur l'App Store
    const appStoreId = process.env.REACT_APP_APP_STORE_ID || 'YOUR_APP_STORE_ID';
    const packageName = 'com.yukpomnang.mobile'; // Package name depuis app.config.js
    
    return {
      android: `https://play.google.com/store/apps/details?id=${packageName}&referrer=${encodedLink}`,
      ios: `https://apps.apple.com/app/id${appStoreId}?ct=${encodedLink}`
    };
  }

  /**
   * Partage un produit (web - React)
   */
  async shareProductWeb(params: ShareProductParams): Promise<void> {
    try {
      const { productName, productDescription, price, location, serviceId, productIndex } = params;
      
      // Générer les liens
      const deepLink = this.generateProductDeepLink(serviceId, productIndex);
      const webLink = this.generateProductWebLink(serviceId, productIndex);
      
      // Construire le message de partage
      let shareText = `🛍️ ${productName}\n\n`;
      
      if (productDescription) {
        shareText += `${productDescription}\n\n`;
      }
      
      if (price) {
        shareText += `💰 Prix: ${price}\n`;
      }
      
      if (location) {
        shareText += `📍 ${location}\n\n`;
      }
      
      // Ajouter les deux liens
      shareText += `📱 Voir dans l'app: ${deepLink}\n`;
      shareText += `🌐 Voir en ligne: ${webLink}`;
      
      // Utiliser Web Share API si disponible
      if (navigator.share) {
        try {
          await navigator.share({
            title: productName,
            text: shareText,
            url: webLink,
          });
          console.log('[SmartShareService] ✅ Produit partagé via Web Share API');
        } catch (shareError: any) {
          // Si l'utilisateur annule, ne pas afficher d'erreur
          if (shareError.name !== 'AbortError') {
            throw shareError;
          }
        }
      } else {
        // Fallback: Copier dans le presse-papiers
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareText);
          // Afficher une notification (à adapter selon votre système de notifications)
          if (typeof window !== 'undefined' && (window as any).toast) {
            (window as any).toast({
              title: 'Lien copié !',
              description: 'Le lien a été copié dans le presse-papiers',
            });
          } else {
            alert('Lien copié dans le presse-papiers !');
          }
          console.log('[SmartShareService] ✅ Lien copié dans le presse-papiers');
        } else {
          // Fallback final : afficher le lien
          alert(`Lien de partage:\n\n${shareText}`);
        }
      }
    } catch (error) {
      console.error('[SmartShareService] ❌ Erreur partage produit web:', error);
      throw error;
    }
  }

  /**
   * Partage un service (web - React)
   */
  async shareServiceWeb(params: ShareServiceParams): Promise<void> {
    try {
      const { serviceName, serviceDescription, serviceId } = params;
      
      // Générer les liens
      const deepLink = this.generateServiceDeepLink(serviceId);
      const webLink = this.generateServiceWebLink(serviceId);
      
      // Construire le message de partage
      let shareText = `🏢 ${serviceName}\n\n`;
      
      if (serviceDescription) {
        shareText += `${serviceDescription}\n\n`;
      }
      
      // Ajouter les deux liens
      shareText += `📱 Voir dans l'app: ${deepLink}\n`;
      shareText += `🌐 Voir en ligne: ${webLink}`;
      
      // Utiliser Web Share API si disponible
      if (navigator.share) {
        try {
          await navigator.share({
            title: serviceName,
            text: shareText,
            url: webLink,
          });
          console.log('[SmartShareService] ✅ Service partagé via Web Share API');
        } catch (shareError: any) {
          if (shareError.name !== 'AbortError') {
            throw shareError;
          }
        }
      } else {
        // Fallback: Copier dans le presse-papiers
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareText);
          if (typeof window !== 'undefined' && (window as any).toast) {
            (window as any).toast({
              title: 'Lien copié !',
              description: 'Le lien a été copié dans le presse-papiers',
            });
          } else {
            alert('Lien copié dans le presse-papiers !');
          }
          console.log('[SmartShareService] ✅ Lien copié dans le presse-papiers');
        } else {
          alert(`Lien de partage:\n\n${shareText}`);
        }
      }
    } catch (error) {
      console.error('[SmartShareService] ❌ Erreur partage service web:', error);
      throw error;
    }
  }

  /**
   * Partage intelligent (détecte automatiquement la plateforme)
   */
  async shareProduct(params: ShareProductParams): Promise<void> {
    return this.shareProductWeb(params);
  }

  /**
   * Partage intelligent de service (détecte automatiquement la plateforme)
   */
  async shareService(params: ShareServiceParams): Promise<void> {
    return this.shareServiceWeb(params);
  }

  /**
   * Génère les liens de partage (pour affichage ou utilisation personnalisée)
   */
  getShareLinks(serviceId: string | number, productIndex?: number): {
    deepLink: string;
    webLink: string;
  } {
    return {
      deepLink: productIndex !== undefined 
        ? this.generateProductDeepLink(serviceId, productIndex)
        : this.generateServiceDeepLink(serviceId),
      webLink: productIndex !== undefined
        ? this.generateProductWebLink(serviceId, productIndex)
        : this.generateServiceWebLink(serviceId),
    };
  }
}

export const smartShareService = new SmartShareService();

