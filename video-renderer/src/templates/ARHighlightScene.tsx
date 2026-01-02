import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import {
  AbsoluteFill,
  Video,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';

import { ImmersiveScene, LocalAudioCue } from '../types/index.js';
import { getColorGradeStyle } from '../utils/color.js';
import { StickerLayer } from './StickerLayer.js';

type ARHighlightProps = {
  scene: ImmersiveScene;
  audioCues?: LocalAudioCue[];
};

const FloatingOrb: React.FC<{ frame: number; fps: number; seed: number }> = ({
  frame,
  fps,
  seed
}) => {
  const progress = (frame / fps + seed) % (Math.PI * 2);
  const radius = 2.6 + seed * 0.25;
  const x = Math.cos(progress) * radius;
  const y = Math.sin(progress * 1.2) * 1.3 + seed * 0.25;
  const z = Math.sin(progress) * radius;

  const scale = 0.6 + Math.sin(progress * 1.5) * 0.08;

  return (
    <mesh position={[x, y, z]} scale={scale}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        color="#60a5fa"
        emissive="#1d4ed8"
        emissiveIntensity={1.6}
        roughness={0.25}
        metalness={0.7}
      />
    </mesh>
  );
};

const computeGlitchBoost = (frame: number, cues?: LocalAudioCue[]) => {
  if (!cues || cues.length === 0) return 0;
  const WINDOW = 8;
  const BASE = 0.7;
  return cues
    .filter((c) => c.cueType === 'glitch' || c.cueType === 'impact')
    .reduce((acc, cue) => {
      const distance = Math.abs(frame - cue.frameOffset);
      if (distance > WINDOW) return acc;
      const strength = 1 - distance / WINDOW;
      return acc + strength * BASE;
    }, 0);
};

export const ARHighlightScene: React.FC<ARHighlightProps> = ({
  scene,
  audioCues
}) => {
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
  const body =
    scene.assets.body ??
    'Overlay interactif, particules 3D, glow adaptatif — façonne ton aura digitale.';

  const orbSeeds = useMemo(() => [0.1, 0.35, 0.62, 0.9], []);

  const videoUrl = scene.assets.videoUrl;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #020617 0%, #172554 100%)',
        color: 'white'
      }}
    >
      {videoUrl ? (
        <AbsoluteFill
          style={{
            overflow: 'hidden'
          }}
        >
          <Video
            src={videoUrl}
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'saturate(1.15) brightness(1.05)'
            }}
          />
          <AbsoluteFill
            style={{
              background:
                'radial-gradient(circle at 40% 50%, rgba(59,130,246,0.25), transparent 70%)',
              mixBlendMode: 'screen'
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill>
          <Canvas
            camera={{
              position: [0, 0, 8 - cameraZoom * 1.3],
              fov: 55
            }}
          >
            <Suspense fallback={null}>
              <color attach="background" args={['#030712']} />
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 6, 10]} intensity={1.4} />
              <OrbitControls enablePan={false} enableZoom={false} />
              <PerspectiveCamera makeDefault position={[0, 0, 7]} />
              {orbSeeds.map((seed, index) => (
                <FloatingOrb key={index} frame={frame} fps={fps} seed={seed} />
              ))}
            </Suspense>
          </Canvas>
        </AbsoluteFill>
      )}

      <AbsoluteFill
        style={{
          opacity: 0.55,
          mixBlendMode: 'screen',
          background:
            'radial-gradient(circle at 40% 50%, rgba(59,130,246,0.32), transparent 60%)'
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 140px',
          textAlign: 'center',
          ...getColorGradeStyle(scene.colorGrade)
        }}
      >
        <h2
          style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: 78,
            marginBottom: 28,
            letterSpacing: '-0.01em'
          }}
        >
          {headline}
        </h2>
        <p
          style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: 32,
            lineHeight: 1.5,
            opacity: interpolate(
              frame,
              [0, fps * 0.6],
              [0, 0.9],
              { extrapolateRight: 'clamp' }
            )
          }}
        >
          {body}
        </p>
      </AbsoluteFill>

      <StickerLayer scene={scene} audioCues={audioCues} />
    </AbsoluteFill>
  );
};


