/**
 * safeChildren - Utilitaire pour nettoyer les children React et éviter les erreurs de rendu
 * ✅ RÉÉCRIT COMPLÈTEMENT - Version simplifiée et sûre
 */

import React from 'react';
import { Text } from 'react-native';

/**
 * Nettoie les children pour éviter les erreurs de rendu React Native
 * ✅ CRITIQUE: Ne retourne JAMAIS un objet, toujours un ReactNode valide
 */
export const cleanChildren = (children: React.ReactNode, keyPrefix: string = ''): React.ReactNode => {
    // ✅ Gérer null/undefined
    if (children == null) {
        return null;
    }

    // ✅ Gérer les booléens
    if (typeof children === 'boolean') {
        return null; // React Native ne peut pas rendre false
    }

    // ✅ Gérer les strings/nombres - wrapper dans Text
    if (typeof children === 'string' || typeof children === 'number') {
        const str = String(children);
        // Filtrer les strings booléennes
        if (str === 'false' || str === 'true') {
            return null;
        }
        return <Text key={keyPrefix}>{str}</Text>;
    }

    // ✅ Gérer les tableaux
    if (Array.isArray(children)) {
        const cleaned = children
            .map((child, index) => {
                try {
                    return cleanChildren(child, `${keyPrefix}-${index}`);
                } catch (e) {
                    console.warn('[safeChildren] Erreur lors du nettoyage d\'un enfant:', e);
                    return null;
                }
            })
            .filter(child => {
                // ✅ CRITIQUE: Filtrer null, undefined, false, et les objets non-React
                if (child == null || child === false) {
                    return false;
                }
                // ✅ CRITIQUE: Vérifier que c'est un élément React valide
                if (React.isValidElement(child)) {
                    return true;
                }
                // ✅ CRITIQUE: Si ce n'est pas un élément React valide, ne pas l'inclure
                if (__DEV__) {
                    console.warn('[safeChildren] Élément non-React filtré:', typeof child, child);
                }
                return false;
            });

        return cleaned.length > 0 ? cleaned : null;
    }

    // ✅ Gérer les éléments React valides
    if (React.isValidElement(children)) {
        const props = (children as any).props;
        if (props && props.children !== undefined) {
            try {
                const cleanedChildren = cleanChildren(props.children, `${keyPrefix}-child`);
                // ✅ CRITIQUE: Seulement cloner si les children ont changé et sont valides
                if (cleanedChildren !== props.children && cleanedChildren != null) {
                    return React.cloneElement(children as React.ReactElement, {
                        ...props,
                        children: cleanedChildren
                    });
                }
            } catch (e) {
                console.warn('[safeChildren] Erreur lors du nettoyage des children:', e);
                // Retourner l'élément original si le nettoyage échoue
            }
        }
        return children;
    }

    // ✅ Fallback: convertir en string et wrapper dans Text
    try {
        const str = String(children);
        if (str === 'false' || str === 'true' || str === '[object Object]') {
            if (__DEV__) {
                console.warn('[safeChildren] Valeur invalide filtrée:', str);
            }
            return null;
        }
        return <Text key={keyPrefix}>{str}</Text>;
    } catch (e) {
        console.warn('[safeChildren] Erreur dans le fallback:', e);
        return null;
    }
};

/**
 * Version optimisée pour useMemo
 */
export const useCleanChildren = (children: React.ReactNode): React.ReactNode => {
    return React.useMemo(() => cleanChildren(children), [children]);
};

export default cleanChildren;
