/**
 * LinkableText - Composant pour rendre les liens cliquables dans le texte
 * Détecte les URLs et les liens vers produits/avis et les rend cliquables
 */

import React from 'react';
import { Linking, StyleSheet, Text, TextProps, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { modernColors } from '../theme/modernTheme';

interface LinkableTextProps extends TextProps {
  text: string;
  onProductLinkPress?: (serviceId: number, productIndex?: number) => void;
  onReviewLinkPress?: (serviceId: number) => void;
}

// Pattern pour détecter les URLs
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
// Pattern pour détecter les liens vers produits (yukpomnang://product/productId?serviceId=serviceId ou yukpo://product/serviceId/productIndex)
const PRODUCT_LINK_PATTERN = /(?:yukpomnang|yukpo):\/\/product\/([^?\s]+)(?:\?serviceId=(\d+))?(?:\/(\d+))?/g;
// Pattern pour détecter les liens vers avis (yukpo://reviews/serviceId ou yukpomnang://reviews/serviceId)
const REVIEW_LINK_PATTERN = /(?:yukpomnang|yukpo):\/\/reviews\/(\d+)/g;

const LinkableText: React.FC<LinkableTextProps> = ({
  text,
  onProductLinkPress,
  onReviewLinkPress,
  style,
  ...textProps
}) => {
  const navigation = useNavigation();

  const handleLinkPress = async (url: string) => {
    try {
      // ✅ CORRIGÉ: Vérifier si c'est un lien yukpomnang:// ou yukpo://
      if (url.startsWith('yukpomnang://') || url.startsWith('yukpo://')) {
        // Lien vers produit (format: yukpomnang://product/productId?serviceId=serviceId)
        const productMatch = url.match(/(?:yukpomnang|yukpo):\/\/product\/([^?\s]+)(?:\?serviceId=(\d+))?(?:\/(\d+))?/);
        if (productMatch) {
          const productId = productMatch[1];
          const serviceId = productMatch[2] ? parseInt(productMatch[2], 10) : (productMatch[3] ? parseInt(productMatch[3], 10) : undefined);
          const productIndex = productMatch[3] ? parseInt(productMatch[3], 10) : undefined;
          
          if (onProductLinkPress && serviceId) {
            onProductLinkPress(serviceId, productIndex);
          } else {
            // Navigation par défaut vers le produit
            if (serviceId) {
              (navigation as any).navigate('ServiceDetail', { serviceId, productIndex });
            } else {
              // Essayer de naviguer avec le productId
              (navigation as any).navigate('ProductDetail', { productId });
            }
          }
          return;
        }

        // Lien vers avis
        const reviewMatch = url.match(/(?:yukpomnang|yukpo):\/\/reviews\/(\d+)/);
        if (reviewMatch) {
          const serviceId = parseInt(reviewMatch[1], 10);
          
          if (onReviewLinkPress) {
            onReviewLinkPress(serviceId);
          } else {
            // Navigation par défaut vers les avis
            (navigation as any).navigate('ServiceDetail', { 
              serviceId, 
              showReviews: true 
            });
          }
          return;
        }
      }

      // ✅ CORRIGÉ: Pour les liens HTTPS vers yukpomnang.com/product/..., essayer d'abord d'ouvrir le deep link
      // Si l'app est installée, elle interceptera le lien via intentFilters
      if (url.includes('yukpomnang.com/product/')) {
        // Extraire productId et serviceId du lien HTTPS
        const httpsMatch = url.match(/yukpomnang\.com\/product\/([^?]+)(?:\?serviceId=(\d+))?/);
        if (httpsMatch) {
          const productId = httpsMatch[1];
          const serviceId = httpsMatch[2];
          
          // Essayer d'abord d'ouvrir le deep link (si l'app est installée)
          const deepLink = serviceId 
            ? `yukpomnang://product/${productId}?serviceId=${serviceId}`
            : `yukpomnang://product/${productId}`;
          
          try {
            const canOpenDeepLink = await Linking.canOpenURL(deepLink);
            if (canOpenDeepLink) {
              await Linking.openURL(deepLink);
              return;
            }
          } catch (e) {
            // Si le deep link ne fonctionne pas, continuer avec le lien HTTPS
            console.log('[LinkableText] Deep link non disponible, utilisation du lien HTTPS');
          }
        }
      }

      // Lien HTTP/HTTPS standard
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.warn('[LinkableText] Impossible d\'ouvrir le lien:', url);
      }
    } catch (error) {
      console.error('[LinkableText] Erreur ouverture lien:', error);
    }
  };

  // Parser le texte et créer les éléments
  const parseText = (): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // D'abord, trouver tous les liens (produits, avis, URLs)
    const allMatches: Array<{
      index: number;
      length: number;
      url: string;
      type: 'product' | 'review' | 'url';
      serviceId?: number;
      productIndex?: number;
    }> = [];

    // Chercher les liens produits (yukpomnang:// ou yukpo://)
    let match;
    // Réinitialiser le regex pour éviter les problèmes de global
    const productRegex = /(?:yukpomnang|yukpo):\/\/product\/([^?\s]+)(?:\?serviceId=(\d+))?(?:\/(\d+))?/g;
    while ((match = productRegex.exec(text)) !== null) {
      const productId = match[1];
      const serviceId = match[2] ? parseInt(match[2], 10) : (match[3] ? parseInt(match[3], 10) : undefined);
      const productIndex = match[3] ? parseInt(match[3], 10) : undefined;
      
      allMatches.push({
        index: match.index,
        length: match[0].length,
        url: match[0],
        type: 'product',
        serviceId: serviceId,
        productIndex: productIndex,
      });
    }

    // Chercher les liens avis (yukpomnang:// ou yukpo://)
    const reviewRegex = /(?:yukpomnang|yukpo):\/\/reviews\/(\d+)/g;
    while ((match = reviewRegex.exec(text)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        url: match[0],
        type: 'review',
        serviceId: parseInt(match[1], 10),
      });
    }

    // Chercher les URLs HTTP/HTTPS (yukpomnang.com/product/... sera traité comme un lien produit intelligent)
    while ((match = URL_PATTERN.exec(text)) !== null) {
      const url = match[0];
      // ✅ CORRIGÉ: Détecter les liens HTTPS vers yukpomnang.com/product/ comme des liens produits intelligents
      if (url.includes('yukpomnang.com/product/')) {
        const httpsProductMatch = url.match(/yukpomnang\.com\/product\/([^?\s]+)(?:\?serviceId=(\d+))?/);
        if (httpsProductMatch) {
          const productId = httpsProductMatch[1];
          const serviceId = httpsProductMatch[2] ? parseInt(httpsProductMatch[2], 10) : undefined;
          
          allMatches.push({
            index: match.index,
            length: match[0].length,
            url: match[0],
            type: 'product',
            serviceId: serviceId,
            productIndex: undefined,
          });
          continue;
        }
      }
      
      // Autres URLs HTTP/HTTPS standard
      allMatches.push({
        index: match.index,
        length: match[0].length,
        url: match[0],
        type: 'url',
      });
    }

    // Trier par index
    allMatches.sort((a, b) => a.index - b.index);

    // Construire les éléments
    allMatches.forEach((linkMatch) => {
      // Texte avant le lien
      if (linkMatch.index > lastIndex) {
        parts.push(
          <Text key={`text-${key++}`} style={style}>
            {text.substring(lastIndex, linkMatch.index)}
          </Text>
        );
      }

      // Le lien
      const linkText = linkMatch.url;
      // ✅ CORRECTION: Pour les liens produits HTTPS, afficher l'URL complète pour qu'elle soit visible et cliquable
      // Pour les deep links, afficher un label plus court
      const linkLabel = linkMatch.type === 'product' && !linkText.startsWith('http')
        ? 'Voir le produit'
        : linkMatch.type === 'product' && linkText.startsWith('http')
        ? linkText // ✅ Afficher l'URL complète pour les liens HTTPS produits (lien intelligent)
        : linkMatch.type === 'review'
        ? 'Voir les avis'
        : linkText; // ✅ Afficher l'URL complète pour les autres liens HTTP/HTTPS

      parts.push(
        <TouchableOpacity
          key={`link-${key++}`}
          onPress={() => {
            if (linkMatch.type === 'product') {
              handleLinkPress(linkMatch.url);
            } else if (linkMatch.type === 'review' && linkMatch.serviceId) {
              handleLinkPress(linkMatch.url);
            } else {
              handleLinkPress(linkMatch.url);
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[style, styles.linkText]}>
            {linkLabel}
          </Text>
        </TouchableOpacity>
      );

      lastIndex = linkMatch.index + linkMatch.length;
    });

    // Texte restant
    if (lastIndex < text.length) {
      parts.push(
        <Text key={`text-${key++}`} style={style}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    // Si aucun lien trouvé, retourner le texte tel quel
    if (parts.length === 0) {
      return <Text style={style} {...textProps}>{text}</Text>;
    }

    return parts;
  };

  const parsedContent = parseText();

  // Si c'est un seul élément Text, le retourner directement
  if (React.isValidElement(parsedContent) && parsedContent.type === Text) {
    return parsedContent;
  }

  // Sinon, wrapper dans un Text
  return (
    <Text style={style} {...textProps}>
      {parsedContent}
    </Text>
  );
};

const styles = StyleSheet.create({
  linkText: {
    color: modernColors.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default LinkableText;

