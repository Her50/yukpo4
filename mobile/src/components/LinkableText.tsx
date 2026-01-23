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
// Pattern pour détecter les liens vers produits (yukpo://product/serviceId/productIndex)
const PRODUCT_LINK_PATTERN = /yukpo:\/\/product\/(\d+)(?:\/(\d+))?/g;
// Pattern pour détecter les liens vers avis (yukpo://reviews/serviceId)
const REVIEW_LINK_PATTERN = /yukpo:\/\/reviews\/(\d+)/g;

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
      // Vérifier si c'est un lien yukpo://
      if (url.startsWith('yukpo://')) {
        // Lien vers produit
        const productMatch = url.match(/yukpo:\/\/product\/(\d+)(?:\/(\d+))?/);
        if (productMatch) {
          const serviceId = parseInt(productMatch[1], 10);
          const productIndex = productMatch[2] ? parseInt(productMatch[2], 10) : undefined;
          
          if (onProductLinkPress) {
            onProductLinkPress(serviceId, productIndex);
          } else {
            // Navigation par défaut vers le produit
            (navigation as any).navigate('ServiceDetail', { serviceId, productIndex });
          }
          return;
        }

        // Lien vers avis
        const reviewMatch = url.match(/yukpo:\/\/reviews\/(\d+)/);
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

    // Chercher les liens produits
    let match;
    while ((match = PRODUCT_LINK_PATTERN.exec(text)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        url: match[0],
        type: 'product',
        serviceId: parseInt(match[1], 10),
        productIndex: match[2] ? parseInt(match[2], 10) : undefined,
      });
    }

    // Chercher les liens avis
    while ((match = REVIEW_LINK_PATTERN.exec(text)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        url: match[0],
        type: 'review',
        serviceId: parseInt(match[1], 10),
      });
    }

    // Chercher les URLs HTTP/HTTPS
    while ((match = URL_PATTERN.exec(text)) !== null) {
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
      const linkLabel = linkMatch.type === 'product'
        ? 'Voir le produit'
        : linkMatch.type === 'review'
        ? 'Voir les avis'
        : linkText;

      parts.push(
        <TouchableOpacity
          key={`link-${key++}`}
          onPress={() => {
            if (linkMatch.type === 'product' && linkMatch.serviceId) {
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

