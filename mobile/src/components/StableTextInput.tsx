/**
 * ✅ COMPOSANT STABLE POUR INPUT TEXT
 * Évite les sauts de curseur en gérant l'état local et en évitant les re-renders pendant la saisie.
 *
 * ⚠️ RÈGLE ANTI-REGRESSION (FormulaireYukpoIntelligentScreen) :
 * - Le React.memo en bas de fichier NE DOIT PAS comparer `style` (prevProps.style === nextProps.style).
 * - Le parent passe style={[styles.x, ...]} → nouvelle ref à chaque render → si on compare style,
 *   tous les inputs re-rendent et le curseur saute du champ. Ne pas réintroduire cette comparaison.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface StableTextInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value?: string;
  onChangeText?: (text: string) => void;
  debounceMs?: number;
}

/**
 * Composant TextInput stable qui évite les sauts de curseur
 * - Gère l'état local pour éviter les re-renders du parent pendant la saisie
 * - Synchronise avec la valeur externe seulement quand l'input n'est pas focus
 * - Utilise useState pour la valeur locale afin que l'input se mette à jour visuellement
 */
const StableTextInput: React.FC<StableTextInputProps> = ({
  value: externalValue = '',
  onChangeText,
  debounceMs = 0,
  ...props
}) => {
  // ✅ État local pour la valeur - permet la mise à jour visuelle sans re-render du parent
      const { t } = useLanguageSafe();
const [localValue, setLocalValue] = useState<string>(externalValue);
  const inputRef = useRef<TextInput>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFocusedRef = useRef<boolean>(false);
  const lastExternalValueRef = useRef<string>(externalValue);

  // ✅ Synchroniser la valeur externe seulement si l'input n'est pas focus
  // Cela évite les sauts de curseur pendant la saisie
  useEffect(() => {
    // Si la valeur externe change et que l'input n'est pas focus
    if (!isFocusedRef.current && externalValue !== lastExternalValueRef.current) {
      setLocalValue(externalValue);
      lastExternalValueRef.current = externalValue;
    }
  }, [externalValue]);

  // ✅ CORRECTION CRITIQUE: Initialiser la valeur locale au montage
  useEffect(() => {
    if (localValue !== externalValue && !isFocusedRef.current) {
      setLocalValue(externalValue);
      lastExternalValueRef.current = externalValue;
    }
  }, []);

  // ✅ Handler pour le focus - NE PAS écraser localValue avec externalValue
  // Écraser au focus provoque des sauts de curseur / clavier quand le parent n'a pas encore mis à jour
  const handleFocus = useCallback((e: any) => {
    isFocusedRef.current = true;
    lastExternalValueRef.current = externalValue;
    props.onFocus?.(e);
  }, [props.onFocus, externalValue]);

  // ✅ Handler pour les changements de texte
  const handleChangeText = useCallback((text: string) => {
    // Mettre à jour la valeur locale immédiatement pour l'affichage
    setLocalValue(text);

    // Si pas de debounce, appeler onChangeText immédiatement
    if (debounceMs <= 0) {
      onChangeText?.(text);
      return;
    }

    // Sinon, débouncer l'appel pour éviter les re-renders fréquents du parent
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      onChangeText?.(text);
    }, debounceMs);
  }, [onChangeText, debounceMs]);

  // ✅ Handler pour le blur - NE PAS écraser localValue ici (le parent met à jour en async)
  // La synchro se fera au prochain render via useEffect quand externalValue aura été mis à jour
  const handleBlur = useCallback((e: any) => {
    isFocusedRef.current = false;
    props.onBlur?.(e);
  }, [props.onBlur]);

  // ✅ Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // ✅ Utiliser la valeur locale pour l'affichage
  // Cela évite les re-renders causés par les changements de la valeur externe pendant la saisie
  // ✅ CORRECTION CRITIQUE: Pour les textarea multiline, ne pas appliquer le style par défaut qui pourrait interférer
  const isMultiline = props.multiline === true;
  const inputStyle = isMultiline 
    ? props.style // Pour multiline, utiliser uniquement le style passé en props
    : [styles.input, props.style]; // Pour les inputs normaux, combiner avec le style par défaut
  
  return (
    <TextInput
      {...props}
      ref={inputRef}
      value={localValue}
      onChangeText={handleChangeText}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={inputStyle}
      // ✅ CORRECTION CRITIQUE: S'assurer que l'input peut recevoir le focus
      editable={props.editable !== false}
      // ✅ CORRECTION CRITIQUE: Éviter les problèmes de clavier sur Android
      showSoftInputOnFocus={true}
      // ✅ CORRECTION CRITIQUE: Empêcher le blur automatique qui cause le saut de curseur
      blurOnSubmit={props.multiline ? false : props.blurOnSubmit}
      // ✅ CORRECTION CRITIQUE: S'assurer que le clavier peut s'afficher
      keyboardType={props.keyboardType || 'default'}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: modernColors.surface,
    fontSize: 16,
    color: modernColors.text,
  },
});

// ✅ Mémoriser le composant pour éviter les re-renders inutiles du parent
// CORRECTION CRITIQUE: Ne PAS comparer style (prevProps.style === nextProps.style).
// Le parent passe souvent style={[styles.x, ...]} donc une nouvelle ref à chaque render,
// ce qui forçait un re-render de tous les inputs et faisait sauter le curseur (perte de focus).
// On compare uniquement les props qui changent la valeur/affichage; le style est appliqué au prochain render naturel (ex. au blur).
export default React.memo(StableTextInput, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value &&
         prevProps.placeholder === nextProps.placeholder &&
         prevProps.keyboardType === nextProps.keyboardType &&
         prevProps.multiline === nextProps.multiline &&
         prevProps.editable === nextProps.editable;
});

