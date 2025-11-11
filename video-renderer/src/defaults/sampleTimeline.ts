import { ImmersiveTimeline } from '../types/index.js';

export const SAMPLE_TIMELINE: ImmersiveTimeline = {
  fps: 30,
  width: 1080,
  height: 1920,
  scenes: [
    {
      id: 'intro',
      template: 'IntroPulse',
      durationInFrames: 120,
      assets: {
        headline: 'Yukpo vous propulse',
        subheadline: 'Boostez votre visibilité locale en 60 secondes'
      },
      transition: {
        type: 'orbit-3d',
        durationInFrames: 24
      },
      colorGrade: {
        style: 'cinematic',
        intensity: 0.65
      }
    },
    {
      id: 'product',
      template: 'ProductShowcase',
      durationInFrames: 180,
      assets: {
        headline: 'Pack Découverte',
        body: 'Stories IA + Vidéo immersive + Ads locales'
      },
      transition: {
        type: 'parallax',
        durationInFrames: 18
      },
      colorGrade: {
        style: 'glow',
        intensity: 0.5
      }
    },
    {
      id: 'cta',
      template: 'GlowCTA',
      durationInFrames: 120,
      assets: {
        headline: 'Crée ta vidéo immersive',
        subheadline: 'Disponible dans Yukpo Studio'
      },
      transition: {
        type: 'speed-ramp',
        durationInFrames: 30
      },
      colorGrade: {
        style: 'cinematic',
        intensity: 0.7
      }
    }
  ]
};


