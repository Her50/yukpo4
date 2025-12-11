/**
 * useWhyDidYouUpdate - Hook pour identifier pourquoi un composant a re-rendu
 * Inspiré de why-did-you-render mais plus léger et intégré
 * 
 * Usage:
 *   const MyComponent = ({ prop1, prop2 }) => {
 *     useWhyDidYouUpdate('MyComponent', { prop1, prop2 });
 *     // ...
 *   };
 */

import { useEffect, useRef } from 'react';

interface UpdateInfo {
    componentName: string;
    changedProps: Record<string, { from: any; to: any }>;
    unchangedProps: string[];
}

let isEnabled = __DEV__; // Activé uniquement en développement par défaut

export const enableWhyDidYouUpdate = () => {
    isEnabled = true;
    console.log('[useWhyDidYouUpdate] ✅ Activé');
};

export const disableWhyDidYouUpdate = () => {
    isEnabled = false;
    console.log('[useWhyDidYouUpdate] ⏸️ Désactivé');
};

/**
 * Hook pour identifier pourquoi un composant a re-rendu
 * @param componentName - Nom du composant
 * @param props - Props à comparer
 */
export const useWhyDidYouUpdate = (
    componentName: string,
    props: Record<string, any>
) => {
    const prevPropsRef = useRef<Record<string, any>>();

    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        if (prevPropsRef.current) {
            const changedProps: Record<string, { from: any; to: any }> = {};
            const unchangedProps: string[] = [];

            // ✅ Comparer toutes les props
            const allKeys = new Set([
                ...Object.keys(props),
                ...Object.keys(prevPropsRef.current),
            ]);

            allKeys.forEach((key) => {
                const currentValue = props[key];
                const prevValue = prevPropsRef.current![key];

                if (currentValue !== prevValue) {
                    changedProps[key] = { from: prevValue, to: currentValue };
                } else {
                    unchangedProps.push(key);
                }
            });

            // ✅ Logger uniquement s'il y a des changements
            if (Object.keys(changedProps).length > 0) {
                console.group(
                    `[useWhyDidYouUpdate] 🔄 ${componentName} a re-rendu`
                );
                Object.entries(changedProps).forEach(([key, { from, to }]) => {
                    console.log(
                        `  ${key}:`,
                        from,
                        '→',
                        to,
                        typeof from !== typeof to
                            ? `(type changé: ${typeof from} → ${typeof to})`
                            : ''
                    );
                });
                console.groupEnd();
            }
        }

        prevPropsRef.current = props;
    });
};

export default useWhyDidYouUpdate;

