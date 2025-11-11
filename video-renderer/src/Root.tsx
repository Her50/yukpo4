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
  } catch (err) {
    console.error('[RemotionRoot] Timeline invalide via env TIMELINE', err);
    return SAMPLE_TIMELINE;
  }
};

export const RemotionRoot: React.FC = () => {
  const timeline = resolveTimeline();
  const totalDuration = timeline.scenes.reduce(
    (acc, scene) => acc + scene.durationInFrames,
    0
  );

  return (
    <>
      <Composition
        id="immersive-video"
        component={ImmersiveVideo}
        width={timeline.width}
        height={timeline.height}
        fps={timeline.fps}
        durationInFrames={totalDuration}
        defaultProps={timeline}
      />
    </>
  );
};



