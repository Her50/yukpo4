import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Composition } from 'remotion';
import { ImmersiveVideo } from './compositions/ImmersiveVideo.js';
import { SAMPLE_TIMELINE } from './defaults/sampleTimeline.js';
import { getTimelineFromEnv } from './utils/timeline.js';
const resolveTimeline = () => {
    try {
        const timeline = getTimelineFromEnv();
        if (timeline) {
            return timeline;
        }
        return SAMPLE_TIMELINE;
    }
    catch (err) {
        console.error('[RemotionRoot] Timeline invalide via env TIMELINE', err);
        return SAMPLE_TIMELINE;
    }
};
export const RemotionRoot = () => {
    const timeline = resolveTimeline();
    const totalDuration = timeline.scenes.reduce((acc, scene) => acc + scene.durationInFrames, 0);
    return (_jsx(_Fragment, { children: _jsx(Composition, { id: "immersive-video", component: ImmersiveVideo, width: timeline.width, height: timeline.height, fps: timeline.fps, durationInFrames: totalDuration, defaultProps: timeline }) }));
};
