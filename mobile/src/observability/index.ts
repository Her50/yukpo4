import Constants from 'expo-constants';
import { AppState, AppStateStatus } from 'react-native';
import * as Sentry from 'sentry-expo';

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

const getMetricsEmitter = (): SentryMetricEmitter | undefined =>
    (Sentry as unknown as { metrics?: SentryMetricEmitter }).metrics;

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
    // Fallback: breadcrumb for manual monitoring
    Sentry.Native.addBreadcrumb({
        category: 'metrics',
        level: 'info',
        message: `${name}=${value}`,
        data: { unit, ...tags },
    });
};

const startFpsMonitor = () => {
    stopFrameCollection();
    collectFrames();

    if (fpsInterval) {
        clearInterval(fpsInterval);
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
            Sentry.Native.captureMessage(
                `[Performance] FPS moyen ${fps.toFixed(
                    1,
                )} durant ${fpsConfig.fpsSampleInterval / 1000}s (seuil ${fpsConfig.fpsWarningThreshold})`,
                'warning',
            );
            lowFpsCounter = 0;
        }
    }, fpsConfig.fpsSampleInterval);
};

const stopFpsMonitor = () => {
    if (fpsInterval) {
        clearInterval(fpsInterval);
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

    Sentry.init({
        dsn: dsn || undefined,
        enableInExpoDevelopment: true,
        debug: __DEV__,
        environment: envName,
        tracesSampleRate: observabilityConfig.traceSampleRate ?? 0.2,
    });

    Sentry.Native.setTag('app.platform', 'mobile');
    if (extra.eas?.projectId) {
        Sentry.Native.setTag('eas.projectId', extra.eas.projectId);
    }

    startFpsMonitor();

    appStateSubscription?.remove();
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    initialized = true;
};

export const recordWebSocketStatusChange = (status: 'online' | 'offline', metadata?: { durationMs?: number }) => {
    recordMetric('mobile.ws.status', status === 'online' ? 1 : 0, 'none', { status });
    if (metadata?.durationMs !== undefined) {
        recordMetric('mobile.ws.connect_time_ms', metadata.durationMs, 'millisecond');
    }

    Sentry.Native.addBreadcrumb({
        category: 'websocket',
        level: status === 'online' ? 'info' : 'warning',
        message: `WebSocket ${status}`,
        data: metadata,
    });
};

export const recordWebSocketReconnect = (attempt: number, delayMs: number) => {
    recordMetric('mobile.ws.reconnect_delay_ms', delayMs, 'millisecond', { attempt: String(attempt) });
    const metrics = getMetricsEmitter();
    metrics?.increment?.('mobile.ws.reconnect_attempts', 1, { unit: 'none', tags: { attempt: String(attempt) } });

    if (attempt >= 3) {
        Sentry.Native.captureMessage(
            `[WebSocket] ${attempt} tentatives de reconnexion (delay ${delayMs}ms)`,
            attempt >= 5 ? 'error' : 'warning',
        );
    }
};

export const recordWebSocketError = (error: unknown) => {
    Sentry.Native.captureException(error);
};

export const recordWebSocketMessage = (type: string) => {
    recordMetric('mobile.ws.message', 1, 'none', { type });
};

export const captureHandledError = (error: unknown, context?: Record<string, unknown>) => {
    Sentry.Native.captureException(error, { extra: context });
};

