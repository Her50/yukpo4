import { jsx as _jsx } from "react/jsx-runtime";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
const defaultStickerStyle = {
    position: 'absolute',
    transformOrigin: 'center',
    willChange: 'transform, opacity'
};
const computeAudioBoost = (frame, cues) => {
    if (!cues || cues.length === 0)
        return { beat: 0, impact: 0 };
    const BEAT_WINDOW = 6;
    const IMPACT_WINDOW = 8;
    let beat = 0;
    let impact = 0;
    for (const cue of cues) {
        const distance = Math.abs(frame - cue.frameOffset);
        if (cue.cueType === 'beat' && distance <= BEAT_WINDOW) {
            const strength = 1 - distance / BEAT_WINDOW;
            beat += strength * 0.5;
        }
        if ((cue.cueType === 'impact' || cue.cueType === 'riser') && distance <= IMPACT_WINDOW) {
            const strength = 1 - distance / IMPACT_WINDOW;
            impact += strength * 0.6;
        }
    }
    return { beat, impact };
};
export const StickerLayer = ({ scene, audioCues }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    if (!scene.assets.stickers?.length) {
        return null;
    }
    return (_jsx(AbsoluteFill, { children: scene.assets.stickers.map((sticker) => {
            const inFrame = frame - sticker.startFrame;
            const visible = inFrame >= 0 && inFrame <= sticker.durationInFrames + fps * 0.3;
            if (!visible) {
                return null;
            }
            const { beat, impact } = computeAudioBoost(inFrame, audioCues);
            const appear = interpolate(inFrame, [0, fps * 0.45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const exit = interpolate(inFrame, [sticker.durationInFrames, sticker.durationInFrames + fps * 0.5], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const baseOpacity = appear * exit;
            const opacity = Math.min(1, baseOpacity + beat * 0.3 + impact * 0.2);
            const translateYBase = interpolate(inFrame, [0, sticker.durationInFrames], [12, -8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const isPromo = sticker.id.toLowerCase().includes('promo') ||
                sticker.id.toLowerCase().includes('offre');
            const isDelivery = sticker.id.toLowerCase().includes('livraison') ||
                sticker.id.toLowerCase().includes('delivery');
            const translateY = translateYBase - beat * 4 - (isPromo ? impact * 6 : 0);
            const scaleBase = sticker.position?.scale ?? 1;
            const scale = scaleBase *
                (1 + beat * 0.25 + impact * 0.2 + (isPromo ? 0.1 : 0) + (isDelivery ? 0.05 : 0));
            const style = {
                ...defaultStickerStyle,
                left: sticker.position?.x ?? 0,
                top: sticker.position?.y ?? 0,
                transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${scale})`,
                opacity
            };
            return (_jsx("img", { src: sticker.src, style: style, alt: sticker.id }, sticker.id));
        }) }));
};
