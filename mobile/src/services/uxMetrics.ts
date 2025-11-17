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

    // Sur mobile, on logge toujours en dev pour faciliter le bench
    // eslint-disable-next-line no-console
    console.log('[UxMetrics/mobile]', entry);

    return entry;
};

export const getUxMetricsBuffer = (): UxEvent[] => buffer.slice();

export const clearUxMetricsBuffer = (): void => {
    buffer.length = 0;
};


