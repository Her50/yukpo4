// Composant de monitoring des performances pour détecter les problèmes de crash
import React, { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { CRASH_PREVENTION_CONFIG } from '../config/gpsConfig';

interface PerformanceMetrics {
    renderTime: number;
    memoryUsage?: number;
    componentName: string;
    timestamp: Date;
}

class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: PerformanceMetrics[] = [];
    private maxMetrics = 100; // Limiter le nombre de métriques stockées

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    startRender(componentName: string): () => void {
        const startTime = performance.now();

        return () => {
            const endTime = performance.now();
            const renderTime = endTime - startTime;

            this.recordMetric({
                renderTime,
                componentName,
                timestamp: new Date()
            });

            // Alerter si le rendu est trop lent
            if (renderTime > 100) { // Plus de 100ms
                console.warn(`[PerformanceMonitor] Rendu lent détecté: ${componentName} - ${renderTime.toFixed(2)}ms`);
            }
        };
    }

    recordMetric(metric: PerformanceMetrics): void {
        this.metrics.push(metric);

        // Garder seulement les dernières métriques
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }

    getMetrics(): PerformanceMetrics[] {
        return [...this.metrics];
    }

    getAverageRenderTime(componentName?: string): number {
        const filtered = componentName
            ? this.metrics.filter(m => m.componentName === componentName)
            : this.metrics;

        if (filtered.length === 0) return 0;

        const total = filtered.reduce((sum, m) => sum + m.renderTime, 0);
        return total / filtered.length;
    }

    clearMetrics(): void {
        this.metrics = [];
    }
}

// Hook pour utiliser le monitoring des performances
export const usePerformanceMonitor = (componentName: string) => {
    const monitor = PerformanceMonitor.getInstance();
    const renderCount = useRef(0);

    useEffect(() => {
        if (!CRASH_PREVENTION_CONFIG.ENABLE_PERFORMANCE_MONITORING) {
            return;
        }

        renderCount.current += 1;

        // Alerter si trop de re-renders
        if (renderCount.current > 50) {
            console.warn(`[PerformanceMonitor] Trop de re-renders détectés: ${componentName} - ${renderCount.current} renders`);
        }
    });

    const startRender = () => {
        return monitor.startRender(componentName);
    };

    return { startRender, renderCount: renderCount.current };
};

// Composant wrapper pour monitoring automatique
interface PerformanceWrapperProps {
    children: React.ReactNode;
    componentName: string;
}

export const PerformanceWrapper: React.FC<PerformanceWrapperProps> = ({
    children,
    componentName
}) => {
    const { startRender } = usePerformanceMonitor(componentName);
    const endRender = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (CRASH_PREVENTION_CONFIG.ENABLE_PERFORMANCE_MONITORING) {
            endRender.current = startRender();
        }

        return () => {
            if (endRender.current) {
                endRender.current();
            }
        };
    });

    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
    const safeChildren = React.Children.map(children, (child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
            return <Text key={index}>{String(child)}</Text>;
        }
        if (child == null) {
            return null;
        }
        return child;
    });
    return <>{safeChildren}</>;
};

export default PerformanceMonitor;

