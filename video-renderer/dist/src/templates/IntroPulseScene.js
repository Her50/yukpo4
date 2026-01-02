import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { getColorGradeStyle } from '../utils/color.js';
import { StickerLayer } from './StickerLayer.js';
const headlineStyle = {
    fontFamily: '"Poppins", "Helvetica Neue", sans-serif',
    fontSize: 96,
    fontWeight: 700,
    lineHeight: 1.02,
    textAlign: 'center',
    margin: 0,
    letterSpacing: '-0.02em'
};
const subheadlineStyle = {
    fontFamily: '"Inter", sans-serif',
    fontSize: 46,
    fontWeight: 500,
    marginTop: 24,
    opacity: 0.8
};
const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 24px',
    borderRadius: 40,
    fontSize: 24,
    background: 'rgba(255, 255, 255, 0.14)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    letterSpacing: '0.24em',
    fontWeight: 600
};
const computeBeatBoost = (frame, cues) => {
    if (!cues || cues.length === 0)
        return 0;
    const BEAT_WINDOW = 6;
    const BEAT_BOOST = 0.4;
    return cues
        .filter((c) => c.cueType === 'beat')
        .reduce((acc, cue) => {
        const distance = Math.abs(frame - cue.frameOffset);
        if (distance > BEAT_WINDOW)
            return acc;
        const strength = 1 - distance / BEAT_WINDOW;
        return acc + strength * BEAT_BOOST;
    }, 0);
};
export const IntroPulseScene = ({ scene, audioCues }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const headline = scene.assets.headline ?? 'Propulse ton business avec Yukpo';
    const subheadline = scene.assets.subheadline ??
        'Vidéo immersive générée par IA + templates premium';
    const beatBoost = computeBeatBoost(frame, audioCues);
    const glowOpacity = interpolate(frame, [0, fps * 0.5, fps, scene.durationInFrames], [0.2 + beatBoost * 0.4, 0.5 + beatBoost * 0.5, 0.25, 0.35], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
    });
    const zoomBase = spring({
        fps,
        frame,
        config: {
            damping: 200,
            mass: 4,
            stiffness: 180
        }
    });
    const zoom = zoomBase + beatBoost * 0.15;
    const gradient = scene.assets.backgroundUrl
        ? `linear-gradient(120deg, rgba(13,19,64,0.6) 0%, rgba(18,9,54,0.82) 48%, rgba(54,8,78,0.9) 100%)`
        : `radial-gradient(circle at top, #6366f1 0%, #0f172a 52%, #020617 100%)`;
    return (_jsxs(AbsoluteFill, { style: {
            background: gradient,
            color: 'white',
            overflow: 'hidden'
        }, children: [scene.assets.backgroundUrl ? (_jsx(AbsoluteFill, { style: {
                    backgroundImage: `url(${scene.assets.backgroundUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.45,
                    filter: 'blur(12px) saturate(120%)',
                    transform: `scale(${1.05 + zoom * 0.08})`
                } })) : null, _jsx(AbsoluteFill, { style: {
                    background: 'radial-gradient(circle at 30% 30%, rgba(156,163,255,0.18), transparent 60%)'
                } }), _jsxs(AbsoluteFill, { style: {
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 32,
                    padding: '0 120px',
                    ...getColorGradeStyle(scene.colorGrade)
                }, children: [_jsx("div", { style: badgeStyle, children: "Immersive Yukpo" }), _jsx("h1", { style: headlineStyle, children: headline }), _jsx("p", { style: subheadlineStyle, children: subheadline })] }), _jsx(AbsoluteFill, { style: {
                    background: 'radial-gradient(circle, rgba(99,102,241,0.65), transparent 70%)',
                    opacity: glowOpacity,
                    mixBlendMode: 'screen'
                } }), _jsx(StickerLayer, { scene: scene, audioCues: audioCues })] }));
};
