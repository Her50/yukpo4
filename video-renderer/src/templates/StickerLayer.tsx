import { CSSProperties } from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';

import { ImmersiveScene } from '../types/index.js';

type StickerLayerProps = {
  scene: ImmersiveScene;
};

const defaultStickerStyle: CSSProperties = {
  position: 'absolute',
  transformOrigin: 'center',
  willChange: 'transform, opacity'
};

export const StickerLayer: React.FC<StickerLayerProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!scene.assets.stickers?.length) {
    return null;
  }

  return (
    <AbsoluteFill>
      {scene.assets.stickers.map((sticker) => {
        const inFrame = frame - sticker.startFrame;
        const visible =
          inFrame >= 0 && inFrame <= sticker.durationInFrames + fps * 0.3;

        if (!visible) {
          return null;
        }

        const appear = interpolate(
          inFrame,
          [0, fps * 0.45],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        const exit = interpolate(
          inFrame,
          [sticker.durationInFrames, sticker.durationInFrames + fps * 0.5],
          [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        const opacity = appear * exit;
        const translateY = interpolate(
          inFrame,
          [0, sticker.durationInFrames],
          [12, -8],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        const style: CSSProperties = {
          ...defaultStickerStyle,
          left: sticker.position?.x ?? 0,
          top: sticker.position?.y ?? 0,
          transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${sticker.position?.scale ?? 1
            })`,
          opacity
        };

        return (
          <img
            key={sticker.id}
            src={sticker.src}
            style={style}
            alt={sticker.id}
          />
        );
      })}
    </AbsoluteFill>
  );
};


