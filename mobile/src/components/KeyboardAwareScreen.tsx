/**
 * KeyboardAwareScreen - Composant wrapper pour gérer automatiquement le clavier mobile
 * 
 * Ce composant résout le problème où le clavier virtuel masque les champs de saisie.
 * Il utilise react-native-keyboard-aware-scroll-view pour remonter automatiquement
 * le contenu lorsque le clavier s'ouvre.
 * 
 * Usage:
 * ```tsx
 * <KeyboardAwareScreen>
 *   <YourContent />
 * </KeyboardAwareScreen>
 * ```
 */

import React, { ReactNode, Ref } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface KeyboardAwareScreenProps {
  children: ReactNode;
  /**
   * Référence au ScrollView (pour contrôle programmatique)
   */
  innerRef?: Ref<KeyboardAwareScrollView>;
  /**
   * Si true, le ScrollView sera désactivé (utile pour les écrans sans scroll)
   * @default false
   */
  disableScroll?: boolean;
  /**
   * Offset vertical supplémentaire pour iOS (en pixels)
   * @default 0
   */
  extraScrollHeight?: number;
  /**
   * Si true, le clavier sera fermé lors du scroll
   * @default true
   */
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /**
   * Style personnalisé pour le conteneur
   */
  style?: any;
  /**
   * Style personnalisé pour le contenu
   */
  contentContainerStyle?: any;
  /**
   * Si true, affiche un indicateur de scroll
   * @default false
   */
  showsVerticalScrollIndicator?: boolean;
}

/**
 * Composant wrapper qui gère automatiquement le clavier mobile
 */
export const KeyboardAwareScreen: React.FC<KeyboardAwareScreenProps> = ({
  children,
  innerRef,
  disableScroll = false,
  extraScrollHeight = 0,
  keyboardShouldPersistTaps = 'handled',
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
}) => {
  // Si le scroll est désactivé, utiliser un simple View avec KeyboardAvoidingView
  if (disableScroll) {
    return (
      <View style={[styles.container, style]}>
        {children}
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      ref={innerRef}
      style={[styles.scrollView, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      enableOnAndroid={true} // ✅ Activer sur Android aussi
      enableAutomaticScroll={true} // ✅ Scroll automatique vers le champ actif
      extraScrollHeight={extraScrollHeight} // ✅ Espace supplémentaire au-dessus du clavier
      keyboardShouldPersistTaps={keyboardShouldPersistTaps} // ✅ Permettre les interactions pendant que le clavier est ouvert
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      // ✅ Configuration spécifique iOS
      enableResetScrollToCoords={true}
      resetScrollToCoords={{ x: 0, y: 0 }}
      // ✅ Configuration spécifique Android
      extraHeight={Platform.OS === 'android' ? 20 : 0} // ✅ Espace supplémentaire pour Android
      keyboardOpeningTime={0} // ✅ Pas de délai pour l'ouverture du clavier
      // ✅ Comportement du scroll
      scrollEnabled={true}
      bounces={false} // ✅ Désactiver le bounce pour un comportement plus prévisible
    >
      {children}
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20, // ✅ Espace en bas pour éviter que le contenu soit coupé
  },
});

export default KeyboardAwareScreen;

