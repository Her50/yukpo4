import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
export const resolveTransitionWrapper = (transition) => {
    switch (transition?.type) {
        case 'orbit-3d':
            return orbit3dTransition(transition.durationInFrames ?? 24);
        case 'parallax':
            return parallaxTransition(transition.durationInFrames ?? 18);
        case 'speed-ramp':
            return speedRampTransition(transition.durationInFrames ?? 30);
        case 'hard-cut':
        default:
            return noTransition;
    }
};
const noTransition = (render) => render({ opacity: 1, transform: 'scale(1)' });
const orbit3dTransition = (duration) => (render) => {
    const frame = useCurrentFrame();
    const rotationY = interpolate(frame, [0, duration], [-25, 0], { extrapolateRight: 'clamp' });
    const opacity = interpolate(frame, [0, duration * 0.8], [0, 1], {
        extrapolateRight: 'clamp'
    });
    const scale = interpolate(frame, [0, duration], [0.92, 1], {
        extrapolateRight: 'clamp'
    });
    return render({
        opacity,
        transform: `perspective(1600px) rotateY(${rotationY}deg) scale(${scale})`
    });
};
const parallaxTransition = (duration) => (render) => {
    const frame = useCurrentFrame();
    const { width } = useVideoConfig();
    const translateX = interpolate(frame, [0, duration], [width * 0.12, 0], { extrapolateRight: 'clamp' });
    const opacity = interpolate(frame, [0, duration], [0, 1], {
        extrapolateRight: 'clamp'
    });
    return render({
        opacity,
        transform: `translateX(${translateX}px)`
    });
};
const speedRampTransition = (duration) => (render) => {
    const frame = useCurrentFrame();
    const opacity = interpolate(frame, [0, duration * 0.6, duration], [0, 1, 1], { extrapolateRight: 'clamp' });
    const blur = interpolate(frame, [0, duration * 0.4], [16, 0], {
        extrapolateRight: 'clamp'
    });
    const translateY = interpolate(frame, [0, duration], [60, 0], {
        extrapolateRight: 'clamp'
    });
    return render({
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${translateY}px)`
    });
};
