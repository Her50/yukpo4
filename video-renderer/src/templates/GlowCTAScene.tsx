import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';

import { ImmersiveScene } from '../types/index.js';
import { getColorGradeStyle } from '../utils/color.js';
import { StickerLayer } from './StickerLayer.js';

type GlowCTAProps = {
  scene: ImmersiveScene;
};

export const GlowCTAScene: React.FC<GlowCTAProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = spring({
    frame,
    fps,
    config: {
      damping: 16,
      mass: 0.9,
      stiffness: 220
    }
  });

  const glowPulse = interpolate(
    frame,
    [0, fps * 0.5, fps, scene.durationInFrames],
    [0.35, 0.8, 0.45, 0.6],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    }
  );

  const headline = scene.assets.headline ?? 'Crée ta vidéo immersive maintenant';
  const subheadline =
    scene.assets.subheadline ??
    'Templates Remotion + Audio premium + Analytics temps réel';

  return (
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(180deg, #020617 0%, #0f172a 40%, #1e293b 100%)',
        color: 'white',
        overflow: 'hidden'
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: scene.assets.backgroundUrl
            ? `url(${scene.assets.backgroundUrl})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.4,
          filter: 'blur(12px)'
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 36,
          padding: '0 140px',
          textAlign: 'center',
          ...getColorGradeStyle(scene.colorGrade)
        }}
      >
        <h2
          style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: 84,
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            margin: 0
          }}
        >
          {headline}
        </h2>
        <p
          style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: 34,
            opacity: 0.82,
            margin: 0,
            maxWidth: 820
          }}
        >
          {subheadline}
        </p>

        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-22px -28px',
              background:
                'radial-gradient(circle, rgba(99,102,241,0.8), transparent 70%)',
              filter: 'blur(20px)',
              opacity: glowPulse,
              transform: `scale(${1 + pulse * 0.05})`,
              transition: 'opacity 0.2s ease-out'
            }}
          />
          <button
            style={{
              position: 'relative',
              padding: '26px 64px',
              borderRadius: 999,
              border: '1px solid rgba(129,140,248,0.65)',
              background:
                'linear-gradient(120deg, rgba(129,140,248,0.85), rgba(99,102,241,0.95))',
              color: '#f8fafc',
              fontFamily: '"Poppins", sans-serif',
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              boxShadow:
                '0 25px 60px rgba(99,102,241,0.45), inset 0 0 24px rgba(165,180,252,0.6)'
            }}
          >
            Lancer ma vidéo Yukpo
          </button>
        </div>
      </AbsoluteFill>

      <StickerLayer scene={scene} />
    </AbsoluteFill>
  );
};


