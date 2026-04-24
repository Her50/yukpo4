export type UxEventName =
    | 'wizard_open'
    | 'storyboard_generate_click'
    | 'storyboard_generate_completed'
    | 'storyboard_generate_failed'
    | 'storyboard_apply'
    | 'scene_chip_tap'
    | 'media_assignment_change'
    | 'preview_short_click'
    | 'preview_short_completed'
    | 'preview_short_failed'
    | 'preview_short_prewarm_start'
    | 'preview_short_prewarm_completed'
    | 'preview_short_prewarm_failed';

export interface UxEvent {
    ts: number;
    event: UxEventName;
    device: 'web' | 'mobile';
    durationMs?: number;
    sessionId?: string;
    serviceId?: number;
    productIndex?: number;
    step?: number;
    sceneIndex?: number;
    scenarioId?: string;
    prewarmed?: boolean;
    extra?: Record<string, unknown>;
}

const buffer: UxEvent[] = [];

export const trackUxEvent = (event: UxEventName, payload: Omit<UxEvent, 'ts' | 'event'>): UxEvent => {
    const entry: UxEvent = {
        ts: Date.now(),
        event,
        ...payload,
    };
    buffer.push(entry);

    if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        if (win.__YUKPO_UX_DEBUG__) {
            // eslint-disable-next-line no-console
            console.log('[UxMetrics]', entry);
        }
    }

    return entry;
};

export const getUxMetricsBuffer = (): UxEvent[] => buffer.slice();

export const clearUxMetricsBuffer = (): void => {
    buffer.length = 0;
};

/**
 * Optionnel : envoi batch vers une API interne pour analyse offline.
 * Peut être appelée manuellement depuis la console en cours de bench.
 */
export const flushUxMetrics = (endpoint: string = '/internal/metrics/ui'): void => {
    if (buffer.length === 0) {
        return;
    }

    const payload = JSON.stringify({ events: buffer });

    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        const blob = new Blob([payload], { type: 'application/json' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).sendBeacon(endpoint, blob);
    } else if (typeof fetch !== 'undefined') {
        void fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
        }).catch(() => {
            // best-effort uniquement
        });
    }
}



