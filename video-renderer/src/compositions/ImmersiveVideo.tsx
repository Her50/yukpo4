import { AbsoluteFill, Sequence } from 'remotion';

import {
    ARHighlightScene,
    GlowCTAScene,
    IntroPulseScene,
    ProductShowcaseScene
} from '../templates/index.js';
import { ImmersiveTimeline } from '../types/index.js';
import { resolveTransitionWrapper } from '../utils/transitions.js';

type ImmersiveVideoProps = ImmersiveTimeline;

export const ImmersiveVideo: React.FC<ImmersiveVideoProps> = ({
    scenes
}) => {
    let currentFrame = 0;

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {scenes.map((scene) => {
                const from = currentFrame;
                currentFrame += scene.durationInFrames;
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

                return (
                    <Sequence
                        key={scene.id}
                        from={from}
                        durationInFrames={scene.durationInFrames}
                    >
                        {transition((style) => (
                            <AbsoluteFill style={style}>
                                <SceneComponent scene={scene} />
                            </AbsoluteFill>
                        ))}
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};


