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
 */
export const generateSmartShareLink = (
  productId: string | number,
  serviceId: string | number
): string => {
  const baseUrl = process.env.EXPO_PUBLIC_SHARE_URL || 'https://yukpomnang.com';
  // Lien web unique qui sera géré par le backend pour la redirection intelligente
  // Format: /product/:productId?serviceId=:serviceId
  // Le backend détectera le User-Agent et redirigera vers l'app si mobile, ou affichera la page web si desktop
  return `${baseUrl}/product/${productId}?serviceId=${serviceId}`;
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

  // Lien intelligent unique (détecte automatiquement mobile/web)
  const smartLink = generateSmartShareLink(productId, serviceId);
  message += `\n🔗 Voir ce produit:\n${smartLink}`;

  return message;
};

