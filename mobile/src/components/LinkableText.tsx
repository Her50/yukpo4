/**
 * LinkableText - Composant pour rendre les liens cliquables dans le texte
 * Détecte les URLs et les liens vers produits/avis et les rend cliquables
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Linking, StyleSheet, Text, TextProps, TouchableOpacity, View } from 'react-native';
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
// ✅ NOUVEAU 2026-03-03: Pattern pour les liens HTTPS vers reviews sur yukpomnang.com
const HTTPS_REVIEW_PATTERN = /https?:\/\/(?:www\.)?yukpomnang\.com\/reviews\/(\d+)/g;

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

    // ✅ NOUVEAU 2026-03-03: Chercher les liens HTTPS vers reviews (yukpomnang.com/reviews/...)
    const httpsReviewRegex = /https?:\/\/(?:www\.)?yukpomnang\.com\/reviews\/(\d+)/g;
    while ((match = httpsReviewRegex.exec(text)) !== null) {
      // Éviter les doublons si déjà capturé par un autre pattern
      const alreadyMatched = allMatches.some(m => m.index === match!.index);
      if (!alreadyMatched) {
        allMatches.push({
          index: match.index,
          length: match[0].length,
          url: `yukpo://reviews/${match[1]}`,
          type: 'review',
          serviceId: parseInt(match[1], 10),
        });
      }
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

      // ✅ CORRIGÉ 2026-03-03: Ignorer les URLs déjà capturées comme review HTTPS
      if (url.includes('yukpomnang.com/reviews/')) {
        continue;
      }

      // Éviter les doublons (URL déjà capturée par un autre pattern)
      const alreadyCaptured = allMatches.some(m => m.index === match!.index);
      if (alreadyCaptured) continue;

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
      // ✅ CORRIGÉ 2026-03-03: Labels lisibles pour tous les types de liens
      const isReview = linkMatch.type === 'review';
      const isProduct = linkMatch.type === 'product';
      const linkLabel = isProduct && !linkText.startsWith('http')
        ? '📦 Voir le produit'
        : isProduct && linkText.startsWith('http')
          ? '📦 Voir le produit'
          : isReview
            ? '⭐ Laisser un avis'
            : linkText;

      // ✅ CORRIGÉ 2026-03-03: Affichage en carte pour les liens spéciaux (produit, avis)
      if (isReview || isProduct) {
        parts.push(
          <TouchableOpacity
            key={`link-${key++}`}
            onPress={() => handleLinkPress(linkMatch.url)}
            activeOpacity={0.7}
            style={styles.specialLinkCard}
          >
            <Text style={styles.specialLinkText}>
              {linkLabel}
            </Text>
            <Text style={styles.specialLinkHint}>
              Appuyez pour ouvrir
            </Text>
          </TouchableOpacity>
        );
      } else {
        // Liens HTTP/HTTPS standard
        parts.push(
          <TouchableOpacity
            key={`link-${key++}`}
            onPress={() => handleLinkPress(linkMatch.url)}
            activeOpacity={0.7}
          >
            <Text style={[style, styles.linkText]} numberOfLines={2}>
              {linkLabel}
            </Text>
          </TouchableOpacity>
        );
      }

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

  // ✅ CORRIGÉ 2026-03-03: Vérifier si le contenu contient des liens spéciaux (carte)
  // Si oui, utiliser View au lieu de Text comme wrapper pour éviter les conflits de layout
  const hasSpecialLinks = Array.isArray(parsedContent) && parsedContent.some(
    (el: any) => React.isValidElement(el) && el.type === TouchableOpacity
  );

  if (hasSpecialLinks) {
    return (
      <View style={styles.linkableContainer}>
        {parsedContent}
      </View>
    );
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
    fontWeight: '500',
    fontSize: 14,
  },
  specialLinkCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 6,
    alignItems: 'center',
  },
  specialLinkText: {
    color: modernColors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  specialLinkHint: {
    color: modernColors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  linkableContainer: {
    flexDirection: 'column',
  },
});

export default LinkableText;

