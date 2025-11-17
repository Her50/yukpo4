import { AbsoluteFill, Sequence } from 'remotion';

import {
    ARHighlightScene,
    GlowCTAScene,
    IntroPulseScene,
    ProductShowcaseScene
} from '../templates/index.js';
import type { AudioCue, ImmersiveTimeline } from '../types/index.js';
import { resolveTransitionWrapper } from '../utils/transitions.js';

type ImmersiveVideoProps = ImmersiveTimeline;

type LocalAudioCue = {
    frameOffset: number;
    cueType: AudioCue['cueType'];
};

export const ImmersiveVideo: React.FC<ImmersiveVideoProps> = ({
    scenes,
    audioCueMap
}) => {
    let currentFrame = 0;

    const allCues: AudioCue[] = audioCueMap ?? [];

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {scenes.map((scene) => {
                const from = currentFrame;
                const duration = scene.durationInFrames;
                currentFrame += duration;

                const SceneComponent = (() => {
                    switch (scene.template) {
                        case 'IntroPulse':
                            return IntroPulseScene;
                        case 'ProductShowcase':
                            return ProductShowcaseScene;
                        case 'ARHighlight':
                            return ARHighlightScene;
                        case 'GlowCTA':
                            return GlowCTAScene;
                        default:
                            return IntroPulseScene;
                    }
                })();

                const transition = resolveTransitionWrapper(scene.transition);

                const sceneCues: LocalAudioCue[] = allCues
                    .filter(
                        (cue) =>
                            cue.startFrame >= from && cue.startFrame < from + duration
                    )
                    .map((cue) => ({
                        frameOffset: cue.startFrame - from,
                        cueType: cue.cueType
                    }));

                return (
                    <Sequence
                        key={scene.id}
                        from={from}
                        durationInFrames={scene.durationInFrames}
                    >
                        {transition((style) => (
                            <AbsoluteFill style={style}>
                                <SceneComponent scene={scene} audioCues={sceneCues} />
                            </AbsoluteFill>
                        ))}
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};


