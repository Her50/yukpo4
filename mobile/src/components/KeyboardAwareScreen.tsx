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
   * @default 100
   */
  extraScrollHeight?: number;
  /**
   * Si true, le clavier sera fermé lors du scroll
   * @default 'handled'
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
  extraScrollHeight = 100,
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
      // ✅ Configuration Android (crucial pour résoudre le problème)
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      extraHeight={Platform.OS === 'android' ? 100 : 0}
      extraScrollHeight={Platform.OS === 'ios' ? extraScrollHeight : 0}
      // ✅ Configuration iOS
      enableResetScrollToCoords={false}
      keyboardOpeningTime={0}
      // ✅ Configuration générale
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      scrollEnabled={true}
      bounces={Platform.OS === 'ios'}
      // ✅ Désactiver le padding automatique sur Android (géré par extraHeight)
      contentInsetAdjustmentBehavior="never"
      // ✅ Améliorer la réactivité
      keyboardDismissMode="interactive"
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
    paddingBottom: Platform.OS === 'android' ? 100 : 50, // ✅ Plus d'espace en bas pour Android
  },
});

export default KeyboardAwareScreen;

