import { ZImmersiveTimeline } from '../types/index.js';
export const getTimelineFromEnv = () => {
    const raw = process.env.TIMELINE;
    if (!raw) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(raw);
        const result = ZImmersiveTimeline.parse(parsed);
        return result;
    }
    catch (err) {
        console.error('[timeline] TIMELINE parsing error', err);
        return undefined;
    }
};
