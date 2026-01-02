import { jsx as _jsx } from "react/jsx-runtime";
import { AbsoluteFill, Sequence } from 'remotion';
import { ARHighlightScene, GlowCTAScene, IntroPulseScene, ProductShowcaseScene } from '../templates/index.js';
import { resolveTransitionWrapper } from '../utils/transitions.js';
export const ImmersiveVideo = ({ scenes, audioCueMap }) => {
    let currentFrame = 0;
    const allCues = audioCueMap ?? [];
    return (_jsx(AbsoluteFill, { style: { backgroundColor: 'black' }, children: scenes.map((scene) => {
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
            const sceneCues = allCues
                .filter((cue) => cue.startFrame >= from && cue.startFrame < from + duration)
                .map((cue) => ({
                frameOffset: cue.startFrame - from,
                cueType: cue.cueType
            }));
            return (_jsx(Sequence, { from: from, durationInFrames: scene.durationInFrames, children: transition((style) => (_jsx(AbsoluteFill, { style: style, children: _jsx(SceneComponent, { scene: scene, audioCues: sceneCues }) }))) }, scene.id));
        }) }));
};
