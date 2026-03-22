import Constants from 'expo-constants';
import { AppState, AppStateStatus } from 'react-native';

let Sentry: any = null;
try {
    Sentry = require('sentry-expo');
} catch {}

type ObservabilityConfig = {
    fpsSampleInterval?: number;
    fpsWarningThreshold?: number;
    fpsWarningDebounce?: number;
    traceSampleRate?: number;
};

type MetricUnit =
    | 'none'
    | 'millisecond'
    | 'second'
    | 'hertz'
    | 'byte'
    | 'kilobyte';

type SentryMetricEmitter = {
    distribution?: (
        name: string,
        value: number,
        options?: { unit?: MetricUnit; tags?: Record<string, string> },
    ) => void;
    gauge?: (
        name: string,
        value: number,
        options?: { unit?: MetricUnit; tags?: Record<string, string> },
    ) => void;
    increment?: (
        name: string,
        value?: number,
        options?: { unit?: MetricUnit; tags?: Record<string, string> },
    ) => void;
};

const getMetricsEmitter = (): SentryMetricEmitter | undefined => {
    try {
        return Sentry?.metrics;
    } catch {
        return undefined;
    }
};

let initialized = false;
let fpsInterval: NodeJS.Timer | null = null;
let rafId: number | null = null;
let frameCount = 0;
let lowFpsCounter = 0;
let fpsConfig: Required<Pick<ObservabilityConfig, 'fpsSampleInterval' | 'fpsWarningThreshold' | 'fpsWarningDebounce'>> =
{
    fpsSampleInterval: 6000,
    fpsWarningThreshold: 45,
    fpsWarningDebounce: 2,
};

let appStateSubscription:
    | {
        remove: () => void;
    }
    | null = null;

const collectFrames = () => {
    frameCount += 1;
    rafId = requestAnimationFrame(collectFrames);
};

const stopFrameCollection = () => {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
};

const recordMetric = (name: string, value: number, unit: MetricUnit, tags?: Record<string, string>) => {
    const metrics = getMetricsEmitter();
    if (metrics?.distribution) {
        metrics.distribution(name, value, { unit, tags });
        return;
    }
    if (metrics?.gauge) {
        metrics.gauge(name, value, { unit, tags });
        return;
    }
    // ✅ CORRIGÉ: Vérifier si Sentry.Native est disponible avant utilisation
    if (Sentry?.Native && typeof Sentry.Native.addBreadcrumb === 'function') {
        try {
            Sentry.Native.addBreadcrumb({
                category: 'metrics',
                level: 'info',
                message: `${name}=${value}`,
                data: { unit, ...tags },
            });
        } catch (error) {
            // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
            // Sentry n'est pas critique pour le fonctionnement de l'app
            if (__DEV__) {
                console.log('[observability] ⏱️ Sentry non disponible pour métriques (non-bloquant)');
            }
        }
    }
};

const startFpsMonitor = () => {
    stopFrameCollection();
    collectFrames();

    if (fpsInterval) {
        clearInterval(fpsInterval as any);
    }

    fpsInterval = setInterval(() => {
        const fps = (frameCount / fpsConfig.fpsSampleInterval) * 1000;
        frameCount = 0;

        recordMetric('mobile.performance.fps', fps, 'hertz');

        if (fps < fpsConfig.fpsWarningThreshold) {
            lowFpsCounter += 1;
        } else {
            lowFpsCounter = 0;
        }

        if (lowFpsCounter >= fpsConfig.fpsWarningDebounce) {
            // ✅ CORRIGÉ: Vérifier si Sentry.Native est disponible avant utilisation
            if (Sentry?.Native && typeof Sentry.Native.captureMessage === 'function') {
                try {
                    Sentry.Native.captureMessage(
                        `[Performance] FPS moyen ${fps.toFixed(
                            1,
                        )} durant ${fpsConfig.fpsSampleInterval / 1000}s (seuil ${fpsConfig.fpsWarningThreshold})`,
                        'warning',
                    );
                } catch (error) {
                    // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
                    if (__DEV__) {
                        console.log('[observability] ⏱️ Sentry non disponible pour FPS (non-bloquant)');
                    }
                }
            }
            lowFpsCounter = 0;
        }
    }, fpsConfig.fpsSampleInterval);
};

const stopFpsMonitor = () => {
    if (fpsInterval) {
        clearInterval(fpsInterval as any);
        fpsInterval = null;
    }
    stopFrameCollection();
    frameCount = 0;
};

const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
        startFpsMonitor();
    } else {
        stopFpsMonitor();
    }
};

const readExtra = () => {
    const expoExtra =
        (Constants.expoConfig?.extra as Record<string, any> | undefined) ??
        ((Constants as unknown as { manifest?: { extra?: Record<string, any> } }).manifest?.extra ?? {});
    return expoExtra ?? {};
};

export const initObservability = () => {
    if (initialized) {
        return;
    }

    try {
        const extra = readExtra();
        const envName =
            extra.environment ||
            extra.eas?.branch ||
            process.env.EXPO_PUBLIC_APP_ENV ||
            (__DEV__ ? 'development' : 'production');
        const dsn = extra.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN;
        const observabilityConfig = extra.observability ?? {};

        fpsConfig = {
            fpsSampleInterval: observabilityConfig.fpsSampleInterval ?? 6000,
            fpsWarningThreshold: observabilityConfig.fpsWarningThreshold ?? 45,
            fpsWarningDebounce: observabilityConfig.fpsWarningDebounce ?? 2,
        };

        if (Sentry && typeof Sentry.init === 'function') {
            Sentry.init({
                dsn: dsn || undefined,
                enableInExpoDevelopment: true,
                debug: __DEV__,
                environment: envName,
                tracesSampleRate: observabilityConfig.traceSampleRate ?? 0.2,
            });

            if (Sentry?.Native && typeof Sentry.Native.setTag === 'function') {
                try {
                    Sentry.Native.setTag('app.platform', 'mobile');
                    if (extra.eas?.projectId) {
                        Sentry.Native.setTag('eas.projectId', extra.eas.projectId);
                    }
                } catch (nativeError) {
                    // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
                    if (__DEV__) {
                        console.log('[observability] ⏱️ Sentry Native Client non disponible (non-bloquant)');
                    }
                }
            } else {
                // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
                if (__DEV__) {
                    console.log('[observability] ⏱️ Sentry Native Client non disponible, utilisation limitée (non-bloquant)');
                }
            }
        } else {
            // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
            if (__DEV__) {
                console.log('[observability] ⏱️ Sentry non disponible, observability désactivée (non-bloquant)');
            }
        }

        startFpsMonitor();

        appStateSubscription?.remove();
        appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        initialized = true;
    } catch (error) {
        console.error('[observability] ❌ Erreur initialisation observability:', error);
        // ✅ CRITIQUE: Ne pas bloquer l'app si l'observability échoue
    }
};

export const recordWebSocketStatusChange = (status: 'online' | 'offline', metadata?: { durationMs?: number }) => {
    recordMetric('mobile.ws.status', status === 'online' ? 1 : 0, 'none', { status });
    if (metadata?.durationMs !== undefined) {
        recordMetric('mobile.ws.connect_time_ms', metadata.durationMs, 'millisecond');
    }

    // ✅ CORRIGÉ: Vérifier si Sentry.Native est disponible avant utilisation
    if (Sentry?.Native && typeof Sentry.Native.addBreadcrumb === 'function') {
        try {
            Sentry.Native.addBreadcrumb({
                category: 'websocket',
                level: status === 'online' ? 'info' : 'warning',
                message: `WebSocket ${status}`,
                data: metadata,
            });
        } catch (error) {
            // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
            if (__DEV__) {
                console.log('[observability] ⏱️ Sentry non disponible pour WebSocket (non-bloquant)');
            }
        }
    }
};

export const recordWebSocketReconnect = (attempt: number, delayMs: number) => {
    recordMetric('mobile.ws.reconnect_delay_ms', delayMs, 'millisecond', { attempt: String(attempt) });
    const metrics = getMetricsEmitter();
    metrics?.increment?.('mobile.ws.reconnect_attempts', 1, { unit: 'none', tags: { attempt: String(attempt) } });

    if (attempt >= 3) {
        // ✅ CORRIGÉ: Vérifier si Sentry.Native est disponible avant utilisation
        if (Sentry?.Native && typeof Sentry.Native.captureMessage === 'function') {
            try {
                Sentry.Native.captureMessage(
                    `[WebSocket] ${attempt} tentatives de reconnexion (delay ${delayMs}ms)`,
                    attempt >= 5 ? 'error' : 'warning',
                );
            } catch (error) {
                // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
                if (__DEV__) {
                    console.log('[observability] ⏱️ Sentry non disponible pour WebSocket reconnect (non-bloquant)');
                }
            }
        }
    }
};

export const recordWebSocketError = (error: unknown) => {
    // ✅ CORRIGÉ: Vérifier si Sentry.Native est disponible avant utilisation
    if (Sentry?.Native && typeof Sentry.Native.captureException === 'function') {
        try {
            Sentry.Native.captureException(error);
        } catch (sentryError) {
            // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
            if (__DEV__) {
                console.log('[observability] ⏱️ Sentry non disponible pour WebSocket error (non-bloquant)');
            }
        }
    }
};

export const recordWebSocketMessage = (type: string) => {
    recordMetric('mobile.ws.message', 1, 'none', { type });
};

export const captureHandledError = (error: unknown, context?: Record<string, unknown>) => {
    // ✅ CORRIGÉ: Vérifier si Sentry.Native est disponible avant utilisation
    if (Sentry?.Native && typeof Sentry.Native.captureException === 'function') {
        try {
            Sentry.Native.captureException(error, { extra: context });
        } catch (sentryError) {
            // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
            if (__DEV__) {
                console.log('[observability] ⏱️ Sentry non disponible pour exception (non-bloquant)');
            }
        }
    }
};

type PreviewMetricPayload = {
    template?: string | null;
    durationSeconds?: number;
    clipCount?: number;
    warnings?: string[];
    latencyMs?: number;
};

export const recordPreviewMetrics = (payload: PreviewMetricPayload) => {
    const templateTag = payload.template ? payload.template.toLowerCase() : 'unknown';
    if (typeof payload.durationSeconds === 'number') {
        recordMetric('mobile.preview.duration_seconds', payload.durationSeconds, 'second', {
            template: templateTag,
        });
    }
    if (typeof payload.clipCount === 'number') {
        recordMetric('mobile.preview.clip_count', payload.clipCount, 'none', { template: templateTag });
    }
    if (typeof payload.latencyMs === 'number') {
        recordMetric('mobile.preview.latency_ms', payload.latencyMs, 'millisecond', {
            template: templateTag,
        });
    }
    const warningsCount = payload.warnings?.length ?? 0;
    recordMetric('mobile.preview.warnings', warningsCount, 'none', { template: templateTag });

    // ✅ CORRIGÉ: Vérifier si Sentry.Native est disponible avant utilisation
    if (Sentry?.Native && typeof Sentry.Native.addBreadcrumb === 'function') {
        try {
            Sentry.Native.addBreadcrumb({
                category: 'preview',
                level: warningsCount > 0 ? 'warning' : 'info',
                message: `Preview ${payload.template ?? 'unknown'} (${warningsCount} warnings)`,
                data: {
                    template: payload.template,
                    clipCount: payload.clipCount,
                    durationSeconds: payload.durationSeconds,
                    latencyMs: payload.latencyMs,
                    warnings: payload.warnings,
                },
            });
        } catch (error) {
            // ✅ REDUIT: Ne logger que si vraiment nécessaire (en dev uniquement)
            if (__DEV__) {
                console.log('[observability] ⏱️ Sentry non disponible pour preview (non-bloquant)');
            }
        }
    }
};




