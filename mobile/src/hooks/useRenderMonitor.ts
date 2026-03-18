/**
 * useRenderMonitor - Hook pour monitorer les re-renders avec React DevTools
 * Gain estimé: Identification rapide des problèmes de performance
 * 
 * Usage:
 *   const MyComponent = () => {
 *     useRenderMonitor('MyComponent');
 *     // ...
 *   };
 */

import { useEffect, useRef } from 'react';

interface RenderInfo {
    componentName: string;
    renderCount: number;
    lastRenderTime: number;
    propsChanged: string[];
    stateChanged: boolean;
}

// ✅ Stockage global pour les stats de rendu
const renderStats = new Map<string, RenderInfo>();

// ✅ Configuration pour activer/désactiver le monitoring
let isMonitoringEnabled = __DEV__; // Activé uniquement en développement par défaut

export const enableRenderMonitoring = () => {
    isMonitoringEnabled = true;
    console.log('[useRenderMonitor] ✅ Monitoring activé');
};

export const disableRenderMonitoring = () => {
    isMonitoringEnabled = false;
    console.log('[useRenderMonitor] ⏸️ Monitoring désactivé');
};

export const getRenderStats = (componentName?: string): RenderInfo[] => {
    if (componentName) {
        const stats = renderStats.get(componentName);
        return stats ? [stats] : [];
    }
    return Array.from(renderStats.values());
};

export const clearRenderStats = () => {
    renderStats.clear();
    console.log('[useRenderMonitor] \uD83D\uDDD1️ Stats effacées');
};

export const printRenderStats = () => {
    if (!isMonitoringEnabled) {
        console.log('[useRenderMonitor] ⚠️ Monitoring désactivé');
        return;
    }

    const stats = Array.from(renderStats.values());
    if (stats.length === 0) {
        console.log('[useRenderMonitor] \uD83D\uDCCA Aucune statistique disponible');
        return;
    }

    console.group('\uD83D\uDCCA Statistiques de rendu');
    stats
        .sort((a, b) => b.renderCount - a.renderCount)
        .forEach((stat) => {
            console.log(
                `%c${stat.componentName}`,
                'font-weight: bold; color: #6366F1',
                `- Renders: ${stat.renderCount} | Dernier: ${new Date(stat.lastRenderTime).toLocaleTimeString()}`
            );
            if (stat.propsChanged.length > 0) {
                console.log(`  Props changés: ${stat.propsChanged.join(', ')}`);
            }
        });
    console.groupEnd();
};

/**
 * Hook pour monitorer les re-renders d'un composant
 * @param componentName - Nom du composant à monitorer
 * @param props - Props du composant (optionnel, pour détecter les changements)
 */
export const useRenderMonitor = (
    componentName: string,
    props?: Record<string, any>
) => {
    const renderCountRef = useRef(0);
    const prevPropsRef = useRef<Record<string, any> | undefined>(props);
    const mountTimeRef = useRef(Date.now());

    useEffect(() => {
        if (!isMonitoringEnabled) {
            return;
        }

        renderCountRef.current += 1;
        const now = Date.now();
        const timeSinceMount = now - mountTimeRef.current;

        // ✅ Détecter les changements de props
        const propsChanged: string[] = [];
        if (props && prevPropsRef.current) {
            Object.keys(props).forEach((key) => {
                if (props[key] !== prevPropsRef.current![key]) {
                    propsChanged.push(key);
                }
            });
        }

        // ✅ Mettre à jour les stats
        const stats: RenderInfo = {
            componentName,
            renderCount: renderCountRef.current,
            lastRenderTime: now,
            propsChanged,
            stateChanged: propsChanged.length > 0,
        };

        renderStats.set(componentName, stats);

        // ✅ Logger uniquement si plus de 3 renders (potentiel problème)
        if (renderCountRef.current > 3) {
            console.warn(
                `[useRenderMonitor] ⚠️ ${componentName} a rendu ${renderCountRef.current} fois`,
                propsChanged.length > 0
                    ? `(Props changés: ${propsChanged.join(', ')})`
                    : ''
            );
        } else if (renderCountRef.current === 1) {
            console.log(
                `[useRenderMonitor] ✅ ${componentName} monté (${timeSinceMount}ms)`
            );
        }

        prevPropsRef.current = props;
    });

    // ✅ Cleanup au démontage
    useEffect(() => {
        return () => {
            if (isMonitoringEnabled) {
                console.log(
                    `[useRenderMonitor] \uD83D\uDDD1️ ${componentName} démonté après ${renderCountRef.current} renders`
                );
            }
        };
    }, [componentName]);
};

/**
 * Hook pour monitorer les re-renders avec comparaison de props détaillée
 * @param componentName - Nom du composant
 * @param props - Props à comparer
 * @param options - Options de monitoring
 */
export const useDetailedRenderMonitor = (
    componentName: string,
    props: Record<string, any>,
    options?: {
        logOnEveryRender?: boolean;
        logPropsChanges?: boolean;
        threshold?: number; // Nombre de renders avant d'avertir
    }
) => {
    const renderCountRef = useRef(0);
    const prevPropsRef = useRef<Record<string, any>>(props);
    const threshold = options?.threshold ?? 5;

    useEffect(() => {
        if (!isMonitoringEnabled) {
            return;
        }

        renderCountRef.current += 1;

        // ✅ Comparaison détaillée des props
        const propsChanged: string[] = [];
        const allKeys = new Set([
            ...Object.keys(props),
            ...Object.keys(prevPropsRef.current),
        ]);

        allKeys.forEach((key) => {
            const currentValue = props[key];
            const prevValue = prevPropsRef.current[key];

            if (currentValue !== prevValue) {
                propsChanged.push(key);
                if (options?.logPropsChanges) {
                    console.log(
                        `[useDetailedRenderMonitor] \uD83D\uDD04 ${componentName}.${key} changé:`,
                        prevValue,
                        '→',
                        currentValue
                    );
                }
            }
        });

        // ✅ Logger selon les options
        if (options?.logOnEveryRender || renderCountRef.current > threshold) {
            console.group(
                `[useDetailedRenderMonitor] \uD83D\uDCCA ${componentName} - Render #${renderCountRef.current}`
            );
            if (propsChanged.length > 0) {
                console.log('Props changés:', propsChanged);
            } else {
                console.log('Aucun changement de props détecté');
            }
            console.groupEnd();
        }

        prevPropsRef.current = props;
    });
};

// ✅ Export par défaut pour compatibilité
export default useRenderMonitor;

