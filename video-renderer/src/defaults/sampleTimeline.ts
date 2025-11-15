import { buildTimelineFromTemplate } from '../templates/storyTemplates.js';
import { ImmersiveTimeline } from '../types/index.js';

export const SAMPLE_TIMELINE: ImmersiveTimeline = buildTimelineFromTemplate(
  'blog',
  {
    serviceName: 'Yukpo Studio',
    highlightBenefit: 'Stories IA + Vidéo immersive + Ads locales',
    ctaLabel: 'Créer ma vidéo immersive',
    ctaTarget: 'Disponible dans Yukpo Studio'
  }
);


