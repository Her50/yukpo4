/**
 * safeChildren - Utilitaire pour nettoyer les children React et éviter les erreurs de rendu
 * Corrige les problèmes "Text strings must be rendered within a <Text> component"
 */

import React from 'react';
import { Text } from 'react-native';

/**
 * Nettoie les children pour éviter les erreurs de rendu React Native
 * - Filtre les booléens false (retourne null)
 * - Wrappe les strings/nombres dans <Text>
 * - Gère les tableaux récursivement
 */
export const cleanChildren = (children: React.ReactNode, keyPrefix: string = ''): React.ReactNode => {
    // ✅ CRITIQUE: Gérer null/undefined
    if (children == null) {
        return null;
    }

    // ✅ CRITIQUE: Si c'est un boolean, retourner null AVANT toute conversion
    if (typeof children === 'boolean') {
        // Ne pas logger en production pour éviter le spam
        if (__DEV__ && !children) {
            console.warn('[safeChildren] ⚠️ Boolean false détecté et filtré');
        }
        return null; // Toujours null pour boolean (React Native ne peut pas rendre false)
    }

    // ✅ CRITIQUE: Si c'est une string/number, vérifier si c'est "false" ou "true" (booléen converti)
    if (typeof children === 'string' || typeof children === 'number') {
        const str = String(children);
        // ✅ CRITIQUE: Si c'est "false" ou "true", c'est probablement un booléen converti en string
        if (str === 'false' || str === 'true') {
            if (__DEV__) {
                console.warn('[safeChildren] ⚠️ String booléenne détectée et filtrée:', str);
            }
            return null; // Ne pas rendre "false" ou "true" comme string
        }
        // ✅ CRITIQUE: Wrapper les autres strings/nombres dans Text
        return <Text key={ keyPrefix }> { str } </Text>;
    }

    // ✅ CRITIQUE: Si c'est un tableau, traiter chaque élément
    if (Array.isArray(children)) {
        const cleaned = children
            .map((child, index) => cleanChildren(child, `${keyPrefix}-${index}`))
            .filter(child => child != null && child !== false); // Filtrer null, undefined et false

        return cleaned.length > 0 ? cleaned : null;
    }

    // ✅ CRITIQUE: Si c'est un élément React valide, vérifier récursivement ses children
    if (React.isValidElement(children)) {
        const props = (children as any).props;
        if (props && props.children !== undefined) {
            // ✅ CRITIQUE: Nettoyer les children de l'élément
            const cleanedChildren = cleanChildren(props.children, `${keyPrefix}-child`);

            // Si les children ont changé, cloner l'élément avec les nouveaux children
            if (cleanedChildren !== props.children) {
                return React.cloneElement(children as React.ReactElement, {
                    ...props,
                    children: cleanedChildren
                });
            }
        }
        return children;
    }

    // ✅ CRITIQUE: Fallback - convertir en string et wrapper dans Text
    const str = String(children);
    // ✅ CRITIQUE: Vérifier si c'est "false" ou "true" avant de wrapper
    if (str === 'false' || str === 'true') {
        if (__DEV__) {
            console.warn('[safeChildren] ⚠️ Valeur booléenne détectée dans fallback et filtrée:', str);
        }
        return null;
    }
    return <Text key={ keyPrefix }> { str } </Text>;
};

/**
 * Version optimisée pour useMemo
 */
export const useCleanChildren = (children: React.ReactNode): React.ReactNode => {
    return React.useMemo(() => cleanChildren(children), [children]);
};

export default cleanChildren;

