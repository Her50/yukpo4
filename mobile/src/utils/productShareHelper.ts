/**
 * Fonction utilitaire pour générer un message de partage de produit uniforme
 * avec un lien intelligent qui détecte automatiquement mobile/web
 */

/** Liens HTTPS produits (universal links) : toujours le site public, pas l'URL API (EXPO_PUBLIC_SHARE_URL). */
export const PUBLIC_PRODUCT_SHARE_WEB_BASE = 'https://yukpomnang.com';

export interface ProductShareData {
  productName: string;
  productDescription?: string;
  price?: number | string;
  devise?: string;
  location?: string;
  productId: string | number;
  serviceId: string | number;
}

/**
 * Génère un lien intelligent de partage qui détecte automatiquement mobile/web
 * Le lien web sera géré par le backend pour rediriger vers l'app si mobile, ou afficher la page web si desktop
 * 
 * ✅ AMÉLIORATION: Le lien HTTPS sera intercepté directement par l'app Android via intentFilters
 * si le backend ne répond pas, l'app peut toujours intercepter le lien
 */
export const generateSmartShareLink = (
  productId: string | number,
  serviceId: string | number
): string => {
  return `${PUBLIC_PRODUCT_SHARE_WEB_BASE}/product/${productId}?serviceId=${serviceId}`;
};

/**
 * ✅ NOUVEAU: Génère un deep link direct pour l'app (à utiliser en complément du lien web)
 * Ce lien peut être inclus dans le message de partage pour une ouverture directe de l'app
 */
export const generateDirectDeepLink = (
  productId: string | number,
  serviceId: string | number
): string => {
  return `yukpomnang://product/${productId}?serviceId=${serviceId}`;
};

/**
 * Génère un message de partage formaté uniforme pour les produits
 * Format: Nom > Description > Prix > Lieu > Lien intelligent
 */
export const generateProductShareMessage = (data: ProductShareData): string => {
  const { productName, productDescription, price, devise, location, productId, serviceId } = data;

  // Construire le message avec le format optimal
  let message = `\uD83D\uDECD️ ${productName}\n\n`;

  // Description (si disponible)
  if (productDescription && productDescription.trim()) {
    message += `${productDescription.trim()}\n\n`;
  }

  // Prix (si disponible)
  if (price) {
    const priceStr = typeof price === 'number'
      ? price.toLocaleString()
      : price;
    const deviseStr = devise || 'XAF';
    message += `\uD83D\uDCB0 Prix: ${priceStr} ${deviseStr}\n`;
  }

  // Lieu (si disponible)
  if (location && location.trim()) {
    message += `\uD83D\uDCCD ${location.trim()}\n`;
  }

  // ✅ CORRIGÉ: Utiliser UN SEUL lien intelligent qui détecte automatiquement mobile/web
  // Le lien web intelligent sera intercepté par l'app mobile si installée (via intentFilters)
  // Sinon, il ouvrira la page web. Le backend peut aussi rediriger vers l'app si mobile.
  const smartLink = generateSmartShareLink(productId, serviceId);

  // ✅ UN SEUL lien intelligent qui fonctionne sur tous les appareils
  message += `\n\uD83D\uDD17 Voir ce produit:\n${smartLink}`;

  return message;
};

