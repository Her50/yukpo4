/**
 * performanceMonitor - Utilitaire pour monitorer les performances
 * Intégration avec React DevTools Profiler
 */

// ✅ Configuration
let isEnabled = __DEV__;
let performanceData: Map<string, number[]> = new Map();

export const enablePerformanceMonitoring = () => {
    isEnabled = true;
    console.log('[performanceMonitor] ✅ Monitoring activé');
};

export const disablePerformanceMonitoring = () => {
    isEnabled = false;
    console.log('[performanceMonitor] ⏸️ Monitoring désactivé');
};

export const clearPerformanceData = () => {
    performanceData.clear();
    console.log('[performanceMonitor] \uD83D\uDDD1️ Données effacées');
};

/**
 * Mesurer le temps d'exécution d'une fonction
 */
export const measurePerformance = async <T>(
    label: string,
    fn: () => T | Promise<T>
): Promise<T> => {
    if (!isEnabled) {
        return await fn();
    }

    const start = performance.now();
    try {
        const result = await fn();
        const end = performance.now();
        const duration = end - start;

        // ✅ Stocker les données
        if (!performanceData.has(label)) {
            performanceData.set(label, []);
        }
        performanceData.get(label)!.push(duration);

        // ✅ Logger si trop lent (>100ms)
        if (duration > 100) {
            console.warn(
                `[performanceMonitor] ⚠️ ${label} a pris ${duration.toFixed(2)}ms`
            );
        }

        return result;
    } catch (error) {
        const end = performance.now();
        const duration = end - start;
        console.error(
            `[performanceMonitor] ❌ ${label} a échoué après ${duration.toFixed(2)}ms:`,
            error
        );
        throw error;
    }
};

/**
 * Obtenir les statistiques de performance
 */
export const getPerformanceStats = (label?: string) => {
    if (label) {
        const data = performanceData.get(label);
        if (!data || data.length === 0) {
            return null;
        }

        const sorted = [...data].sort((a, b) => a - b);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];

        return {
            label,
            count: data.length,
            avg: avg.toFixed(2),
            min: min.toFixed(2),
            max: max.toFixed(2),
            median: median.toFixed(2),
        };
    }

    const stats: Record<string, any> = {};
    performanceData.forEach((data, label) => {
        const sorted = [...data].sort((a, b) => a - b);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];

        stats[label] = {
            count: data.length,
            avg: avg.toFixed(2),
            min: min.toFixed(2),
            max: max.toFixed(2),
            median: median.toFixed(2),
        };
    });

    return stats;
};

/**
 * Afficher les statistiques de performance
 */
export const printPerformanceStats = () => {
    if (!isEnabled) {
        console.log('[performanceMonitor] ⚠️ Monitoring désactivé');
        return;
    }

    const stats = getPerformanceStats();
    if (!stats || Object.keys(stats).length === 0) {
        console.log('[performanceMonitor] \uD83D\uDCCA Aucune donnée disponible');
        return;
    }

    console.group('\uD83D\uDCCA Statistiques de performance');
    Object.entries(stats)
        .sort((a, b) => parseFloat(b[1].avg) - parseFloat(a[1].avg))
        .forEach(([label, data]: [string, any]) => {
            console.log(
                `%c${label}`,
                'font-weight: bold; color: #6366F1',
                `- Appels: ${data.count} | Moyenne: ${data.avg}ms | Min: ${data.min}ms | Max: ${data.max}ms | Médiane: ${data.median}ms`
            );
        });
    console.groupEnd();
};

// ✅ Exposer globalement pour accès depuis console
if (typeof global !== 'undefined') {
    (global as any).performanceMonitor = {
        enable: enablePerformanceMonitoring,
        disable: disablePerformanceMonitoring,
        clear: clearPerformanceData,
        stats: getPerformanceStats,
        print: printPerformanceStats,
    };
}

