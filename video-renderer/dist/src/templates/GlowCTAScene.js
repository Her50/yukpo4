import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { getColorGradeStyle } from '../utils/color.js';
import { StickerLayer } from './StickerLayer.js';
const computeGlowBoost = (frame, cues) => {
    if (!cues || cues.length === 0)
        return 0;
    const WINDOW = 10;
    const BASE = 0.5;
    return cues
        .filter((c) => c.cueType === 'beat' || c.cueType === 'riser')
        .reduce((acc, cue) => {
        const distance = Math.abs(frame - cue.frameOffset);
        if (distance > WINDOW)
            return acc;
        const strength = 1 - distance / WINDOW;
        return acc + strength * BASE;
    }, 0);
};
export const GlowCTAScene = ({ scene, audioCues }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const glowBoost = computeGlowBoost(frame, audioCues);
    const pulseBase = spring({
        frame,
        fps,
        config: {
            damping: 16,
            mass: 0.9,
            stiffness: 220
        }
    });
    const pulse = pulseBase + glowBoost * 0.3;
    const glowPulse = interpolate(frame, [0, fps * 0.5, fps, scene.durationInFrames], [0.35 + glowBoost * 0.4, 0.8 + glowBoost * 0.5, 0.45, 0.6], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
    });
    const headline = scene.assets.headline ?? 'Crée ta vidéo immersive maintenant';
    const subheadline = scene.assets.subheadline ??
        'Templates Remotion + Audio premium + Analytics temps réel';
    return (_jsxs(AbsoluteFill, { style: {
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 40%, #1e293b 100%)',
            color: 'white',
            overflow: 'hidden'
        }, children: [_jsx(AbsoluteFill, { style: {
                    backgroundImage: scene.assets.backgroundUrl
                        ? `url(${scene.assets.backgroundUrl})`
                        : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.4,
                    filter: 'blur(12px)'
                } }), _jsxs(AbsoluteFill, { style: {
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'column',
                    gap: 36,
                    padding: '0 140px',
                    textAlign: 'center',
                    ...getColorGradeStyle(scene.colorGrade)
                }, children: [_jsx("h2", { style: {
                            fontFamily: '"Poppins", sans-serif',
                            fontSize: 84,
                            lineHeight: 1.05,
                            letterSpacing: '-0.015em',
                            margin: 0
                        }, children: headline }), _jsx("p", { style: {
                            fontFamily: '"Inter", sans-serif',
                            fontSize: 34,
                            opacity: 0.82,
                            margin: 0,
                            maxWidth: 820
                        }, children: subheadline }), _jsxs("div", { style: {
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }, children: [_jsx("div", { style: {
                                    position: 'absolute',
                                    inset: '-22px -28px',
                                    background: 'radial-gradient(circle, rgba(99,102,241,0.8), transparent 70%)',
                                    filter: 'blur(20px)',
                                    opacity: glowPulse,
                                    transform: `scale(${1 + pulse * 0.05})`,
                                    transition: 'opacity 0.2s ease-out'
                                } }), _jsx("button", { style: {
                                    position: 'relative',
                                    padding: '26px 64px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(129,140,248,0.65)',
                                    background: 'linear-gradient(120deg, rgba(129,140,248,0.85), rgba(99,102,241,0.95))',
                                    color: '#f8fafc',
                                    fontFamily: '"Poppins", sans-serif',
                                    fontSize: 32,
                                    fontWeight: 600,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    boxShadow: '0 25px 60px rgba(99,102,241,0.45), inset 0 0 24px rgba(165,180,252,0.6)'
                                }, children: "Lancer ma vid\u00E9o Yukpo" })] })] }), _jsx(StickerLayer, { scene: scene, audioCues: audioCues })] }));
};
