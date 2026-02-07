/**
 * Fonction utilitaire pour générer un message de partage de produit uniforme
 * avec un lien intelligent qui détecte automatiquement mobile/web
 */

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
  const baseUrl = process.env.EXPO_PUBLIC_SHARE_URL || 'https://yukpomnang.com';
  // Lien web unique qui sera géré par le backend pour la redirection intelligente
  // Format: /product/:productId?serviceId=:serviceId
  // Le backend détectera le User-Agent et redirigera vers l'app si mobile, ou affichera la page web si desktop
  // ✅ IMPORTANT: Sur Android, les intentFilters dans app.config.js permettront à l'app d'intercepter
  // directement ce lien HTTPS même si le backend ne répond pas
  return `${baseUrl}/product/${productId}?serviceId=${serviceId}`;
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
  let message = `🛍️ ${productName}\n\n`;

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
    message += `💰 Prix: ${priceStr} ${deviseStr}\n`;
  }

  // Lieu (si disponible)
  if (location && location.trim()) {
    message += `📍 ${location.trim()}\n`;
  }

  // ✅ AMÉLIORATION: Inclure à la fois le lien web (pour compatibilité) et le deep link direct
  // Le lien web sera intercepté par l'app Android via intentFilters, et le deep link fonctionne directement
  const smartLink = generateSmartShareLink(productId, serviceId);
  const deepLink = generateDirectDeepLink(productId, serviceId);
  
  // Sur mobile, le deep link sera utilisé en priorité
  // Le lien web sert de fallback et sera intercepté par l'app si installée
  message += `\n🔗 Voir ce produit:\n${smartLink}`;
  
  // ✅ Optionnel: Ajouter aussi le deep link direct pour une ouverture immédiate
  // (peut être commenté si on veut seulement le lien web)
  // message += `\n📱 Ouvrir dans l'app:\n${deepLink}`;

  return message;
};

