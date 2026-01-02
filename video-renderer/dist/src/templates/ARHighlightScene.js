import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import { AbsoluteFill, Video, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { getColorGradeStyle } from '../utils/color.js';
import { StickerLayer } from './StickerLayer.js';
const FloatingOrb = ({ frame, fps, seed }) => {
    const progress = (frame / fps + seed) % (Math.PI * 2);
    const radius = 2.6 + seed * 0.25;
    const x = Math.cos(progress) * radius;
    const y = Math.sin(progress * 1.2) * 1.3 + seed * 0.25;
    const z = Math.sin(progress) * radius;
    const scale = 0.6 + Math.sin(progress * 1.5) * 0.08;
    return (_jsxs("mesh", { position: [x, y, z], scale: scale, children: [_jsx("sphereGeometry", { args: [1, 64, 64] }), _jsx("meshStandardMaterial", { color: "#60a5fa", emissive: "#1d4ed8", emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.7 })] }));
};
const computeGlitchBoost = (frame, cues) => {
    if (!cues || cues.length === 0)
        return 0;
    const WINDOW = 8;
    const BASE = 0.7;
    return cues
        .filter((c) => c.cueType === 'glitch' || c.cueType === 'impact')
        .reduce((acc, cue) => {
        const distance = Math.abs(frame - cue.frameOffset);
        if (distance > WINDOW)
            return acc;
        const strength = 1 - distance / WINDOW;
        return acc + strength * BASE;
    }, 0);
};
export const ARHighlightScene = ({ scene, audioCues }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const glitchBoost = computeGlitchBoost(frame, audioCues);
    const cameraZoomBase = spring({
        frame,
        fps,
        config: {
            damping: 18,
            mass: 1.1,
            stiffness: 180
        }
    });
    const cameraZoom = cameraZoomBase + glitchBoost * 0.4;
    const headline = scene.assets.headline ?? 'Révèle ton produit en AR';
    const body = scene.assets.body ??
        'Overlay interactif, particules 3D, glow adaptatif — façonne ton aura digitale.';
    const orbSeeds = useMemo(() => [0.1, 0.35, 0.62, 0.9], []);
    const videoUrl = scene.assets.videoUrl;
    return (_jsxs(AbsoluteFill, { style: {
            background: 'linear-gradient(160deg, #020617 0%, #172554 100%)',
            color: 'white'
        }, children: [videoUrl ? (_jsxs(AbsoluteFill, { style: {
                    overflow: 'hidden'
                }, children: [_jsx(Video, { src: videoUrl, muted: true, style: {
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: 'saturate(1.15) brightness(1.05)'
                        } }), _jsx(AbsoluteFill, { style: {
                            background: 'radial-gradient(circle at 40% 50%, rgba(59,130,246,0.25), transparent 70%)',
                            mixBlendMode: 'screen'
                        } })] })) : (_jsx(AbsoluteFill, { children: _jsx(Canvas, { camera: {
                        position: [0, 0, 8 - cameraZoom * 1.3],
                        fov: 55
                    }, children: _jsxs(Suspense, { fallback: null, children: [_jsx("color", { attach: "background", args: ['#030712'] }), _jsx("ambientLight", { intensity: 0.6 }), _jsx("directionalLight", { position: [5, 6, 10], intensity: 1.4 }), _jsx(OrbitControls, { enablePan: false, enableZoom: false }), _jsx(PerspectiveCamera, { makeDefault: true, position: [0, 0, 7] }), orbSeeds.map((seed, index) => (_jsx(FloatingOrb, { frame: frame, fps: fps, seed: seed }, index)))] }) }) })), _jsx(AbsoluteFill, { style: {
                    opacity: 0.55,
                    mixBlendMode: 'screen',
                    background: 'radial-gradient(circle at 40% 50%, rgba(59,130,246,0.32), transparent 60%)'
                } }), _jsxs(AbsoluteFill, { style: {
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '0 140px',
                    textAlign: 'center',
                    ...getColorGradeStyle(scene.colorGrade)
                }, children: [_jsx("h2", { style: {
                            fontFamily: '"Poppins", sans-serif',
                            fontSize: 78,
                            marginBottom: 28,
                            letterSpacing: '-0.01em'
                        }, children: headline }), _jsx("p", { style: {
                            fontFamily: '"Inter", sans-serif',
                            fontSize: 32,
                            lineHeight: 1.5,
                            opacity: interpolate(frame, [0, fps * 0.6], [0, 0.9], { extrapolateRight: 'clamp' })
                        }, children: body })] }), _jsx(StickerLayer, { scene: scene, audioCues: audioCues })] }));
};
