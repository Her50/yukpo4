import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AbsoluteFill, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { getColorGradeStyle } from '../utils/color.js';
import { StickerLayer } from './StickerLayer.js';
const computeImpactBoost = (frame, cues) => {
    if (!cues || cues.length === 0)
        return 0;
    const WINDOW = 8;
    const BASE = 0.5;
    return cues
        .filter((c) => c.cueType === 'impact' || c.cueType === 'beat')
        .reduce((acc, cue) => {
        const distance = Math.abs(frame - cue.frameOffset);
        if (distance > WINDOW)
            return acc;
        const strength = 1 - distance / WINDOW;
        return acc + strength * BASE;
    }, 0);
};
export const ProductShowcaseScene = ({ scene, audioCues }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const impactBoost = computeImpactBoost(frame, audioCues);
    const heroZoom = interpolate(frame, [0, scene.durationInFrames], [1.0 + impactBoost * 0.08, 1.12 + impactBoost * 0.12], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
    });
    const cardEnteringBase = spring({
        frame,
        fps,
        config: {
            damping: 14,
            mass: 0.8,
            stiffness: 210
        }
    });
    const cardEntering = Math.min(1, cardEnteringBase + impactBoost * 0.3);
    const productImageUrl = scene.assets.productImageUrl;
    const headline = scene.assets.headline ?? 'Offre immersive Yukpo';
    const body = scene.assets.body ??
        'Animations 3D, b-roll IA, mastering audio pro et suivi analytics.';
    return (_jsxs(AbsoluteFill, { style: {
            background: 'linear-gradient(160deg, #0f172a 0%, rgba(15,23,42,0.92) 40%, #1f2937 100%)',
            color: 'white',
            overflow: 'hidden'
        }, children: [_jsx(AbsoluteFill, { style: {
                    background: 'radial-gradient(circle at 20% 20%, rgba(147, 51, 234, 0.18), transparent 60%)'
                } }), _jsx(Sequence, { from: 0, children: _jsx(AbsoluteFill, { style: {
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        paddingBottom: 140,
                        paddingLeft: 120,
                        paddingRight: 120
                    }, children: _jsxs("div", { style: {
                            width: '100%',
                            maxWidth: 680,
                            borderRadius: 36,
                            padding: '56px 54px',
                            background: 'linear-gradient(120deg, rgba(15,23,42,0.92), rgba(30,58,138,0.82))',
                            border: '1px solid rgba(99,102,241,0.24)',
                            boxShadow: '0 40px 100px rgba(99,102,241,0.25), inset 0 0 30px rgba(59,130,246,0.15)',
                            transform: `translateY(${(1 - cardEntering) * 120}px)`,
                            opacity: cardEntering,
                            ...getColorGradeStyle(scene.colorGrade)
                        }, children: [_jsx("h2", { style: {
                                    fontFamily: '"Poppins", sans-serif',
                                    fontSize: 64,
                                    margin: 0,
                                    letterSpacing: '-0.01em'
                                }, children: headline }), _jsx("p", { style: {
                                    fontFamily: '"Inter", sans-serif',
                                    fontSize: 30,
                                    lineHeight: 1.4,
                                    opacity: 0.86,
                                    marginTop: 28
                                }, children: body }), _jsx("div", { style: {
                                    display: 'flex',
                                    gap: 16,
                                    marginTop: 36,
                                    flexWrap: 'wrap'
                                }, children: ['B-roll IA', 'Transitions 3D', 'Audio premium', 'Analytics live'].map((tag) => (_jsx("span", { style: {
                                        padding: '12px 18px',
                                        borderRadius: 999,
                                        background: 'rgba(99,102,241,0.18)',
                                        border: '1px solid rgba(129,140,248,0.35)',
                                        fontSize: 20,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.18em',
                                        fontWeight: 600
                                    }, children: tag }, tag))) })] }) }) }), productImageUrl ? (_jsx(Sequence, { from: Math.round(fps * 0.5), children: _jsx(AbsoluteFill, { style: {
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden'
                    }, children: _jsx(Img, { src: productImageUrl, style: {
                            width: '70%',
                            filter: 'drop-shadow(0 45px 90px rgba(59, 130, 246, 0.35))',
                            transform: `scale(${heroZoom}) rotate(${interpolate(frame, [0, scene.durationInFrames], [-2, 3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}deg)`
                        } }) }) })) : null, _jsx(StickerLayer, { scene: scene, audioCues: audioCues })] }));
};
