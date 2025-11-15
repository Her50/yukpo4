import { ImmersiveScene, ImmersiveTimeline } from '../types/index.js';

export type StoryTemplateId = 'blog' | 'tutorial' | 'testimonial' | 'comparison';

export interface StoryBusinessContext {
    serviceName?: string;
    serviceCategory?: string;
    tone?: string;
    ctaLabel?: string;
    ctaTarget?: string;
    painPoint?: string;
    highlightBenefit?: string;
    testimonialQuote?: string;
    testimonialAuthor?: string;
    comparisonTargets?: {
        primary?: string;
        secondary?: string;
    };
    tutorialSteps?: string[];
    durationSeconds?: number;
}

export interface StoryTemplateSpec {
    id: StoryTemplateId;
    label: string;
    description: string;
    recommendedCategories: string[];
    tones: string[];
    ctas: string[];
    defaultDurationSeconds: number;
    blueprint: (ctx: StoryBusinessContext) => ImmersiveScene[];
}

const secondsToFrames = (seconds: number | undefined, fallback = 4): number =>
    Math.max(30, Math.round((seconds ?? fallback) * 30));

const baseScene = (
    id: string,
    template: ImmersiveScene['template'],
    durationSeconds: number,
    assets: ImmersiveScene['assets'],
    transition: ImmersiveScene['transition'] = {
        type: 'hard-cut',
        durationInFrames: 18
    }
): ImmersiveScene => ({
    id,
    template,
    durationInFrames: secondsToFrames(durationSeconds),
    assets,
    transition
});

const storyTemplates: Record<StoryTemplateId, StoryTemplateSpec> = {
    blog: {
        id: 'blog',
        label: 'Blog / Chronicle',
        description:
            'Idéal pour des contenus éditoriaux, annonces de nouveautés ou récaps hebdo.',
        recommendedCategories: ['coaching', 'digital', 'immobilier', 'delivery'],
        tones: ['inspirational', 'thought leadership'],
        ctas: ['Découvrir', 'Lire la suite', 'Consulter l’étude'],
        defaultDurationSeconds: 30,
        blueprint: (ctx) => {
            const serviceName = ctx.serviceName ?? 'Studio Yukpo';
            const highlight = ctx.highlightBenefit ?? 'Diagnostic local + vidéo immersive';
            const cta = ctx.ctaLabel ?? 'Découvrir maintenant';

            return [
                baseScene('blog-intro', 'IntroPulse', 6, {
                    headline: `${serviceName} publie`,
                    subheadline: 'L’édition spéciale du jour'
                }),
                baseScene('blog-body', 'ProductShowcase', 12, {
                    headline: highlight,
                    body:
                        ctx.painPoint ??
                        'Analyse IA des besoins terrain, insights géolocalisés et formats sociaux.'
                }),
                baseScene(
                    'blog-cta',
                    'GlowCTA',
                    8,
                    {
                        headline: cta,
                        subheadline: ctx.ctaTarget ?? 'Disponible sur web + mobile Yukpo'
                    },
                    {
                        type: 'speed-ramp',
                        durationInFrames: 24
                    }
                )
            ];
        }
    },
    tutorial: {
        id: 'tutorial',
        label: 'Tutoriel / How-to',
        description: 'Guides pratiques étape par étape, parfait pour les apps et services.',
        recommendedCategories: ['formation', 'beauty', 'food', 'artisanat'],
        tones: ['educational', 'calm', 'empowering'],
        ctas: ['Essayer', 'Prendre RDV', 'Suivre la formation'],
        defaultDurationSeconds: 36,
        blueprint: (ctx) => {
            const steps =
                ctx.tutorialSteps && ctx.tutorialSteps.length > 0
                    ? ctx.tutorialSteps
                    : ['Choisir son besoin', 'Laisser l’IA préparer', 'Valider la diffusion'];

            return [
                baseScene('tuto-hook', 'IntroPulse', 6, {
                    headline: ctx.serviceName ?? 'Tutoriel express',
                    subheadline: ctx.painPoint ?? '3 étapes pour lancer sa campagne locale'
                }),
                ...steps.slice(0, 3).map((step, index) =>
                    baseScene(
                        `tuto-step-${index + 1}`,
                        'ProductShowcase',
                        8,
                        {
                            headline: `Étape ${index + 1}`,
                            body: step
                        },
                        {
                            type: 'parallax',
                            durationInFrames: 18
                        }
                    )
                ),
                baseScene(
                    'tuto-cta',
                    'GlowCTA',
                    8,
                    {
                        headline: ctx.ctaLabel ?? 'Essayer gratuitement',
                        subheadline: ctx.ctaTarget ?? 'Disponible dans Yukpo Studio'
                    },
                    {
                        type: 'orbit-3d',
                        durationInFrames: 20
                    }
                )
            ];
        }
    },
    testimonial: {
        id: 'testimonial',
        label: 'Témoignage client',
        description:
            'Renforce la preuve sociale avec citation, métriques et CTA de confiance.',
        recommendedCategories: ['services pro', 'santé', 'logistique', 'coaching'],
        tones: ['trust', 'warm', 'community'],
        ctas: ['Contacter', 'Obtenir un audit', 'Réserver un créneau'],
        defaultDurationSeconds: 28,
        blueprint: (ctx) => {
            const quote =
                ctx.testimonialQuote ??
                '“Yukpo Studio nous a permis de lancer des vidéos immersives en 48h.”';
            const author = ctx.testimonialAuthor ?? 'Kouam, fondateur de FreshEats';
            return [
                baseScene('testi-focus', 'ARHighlight', 7, {
                    headline: ctx.serviceName ?? 'Client Yukpo',
                    subheadline: author
                }),
                baseScene('testi-quote', 'ProductShowcase', 11, {
                    headline: 'Ce qu’il en dit',
                    body: quote
                }),
                baseScene(
                    'testi-cta',
                    'GlowCTA',
                    7,
                    {
                        headline: ctx.ctaLabel ?? 'Réserver un débrief vidéo',
                        subheadline: ctx.ctaTarget ?? 'Visio 15 min avec un créateur Yukpo'
                    },
                    {
                        type: 'speed-ramp',
                        durationInFrames: 18
                    }
                )
            ];
        }
    },
    comparison: {
        id: 'comparison',
        label: 'Comparatif / Benchmark',
        description:
            'Oppose deux options (avant/après, DIY vs service Yukpo) pour générer l’action.',
        recommendedCategories: ['logistique', 'retail', 'services maison', 'B2B'],
        tones: ['bold', 'efficient'],
        ctas: ['Passer à Yukpo', 'Demander une estimation', 'Planifier un essai'],
        defaultDurationSeconds: 32,
        blueprint: (ctx) => {
            const targets = {
                primary: ctx.comparisonTargets?.primary ?? 'Ancienne méthode',
                secondary: ctx.comparisonTargets?.secondary ?? 'Studio Yukpo'
            };

            return [
                baseScene('compare-intro', 'IntroPulse', 6, {
                    headline: 'Comparatif express',
                    subheadline: 'Ce que change Yukpo en 30 sec'
                }),
                baseScene('compare-before', 'ARHighlight', 9, {
                    headline: targets.primary,
                    body: ctx.painPoint ?? 'Briefs manuels, aucune analytics, diffusion lente.'
                }),
                baseScene('compare-after', 'ProductShowcase', 9, {
                    headline: targets.secondary,
                    body:
                        ctx.highlightBenefit ??
                        'Studio assisté IA, voice clones, diffusion multicanale automatisée.'
                }),
                baseScene(
                    'compare-cta',
                    'GlowCTA',
                    8,
                    {
                        headline: ctx.ctaLabel ?? 'Passer à Yukpo',
                        subheadline: ctx.ctaTarget ?? 'Activation en <72h'
                    },
                    {
                        type: 'orbit-3d',
                        durationInFrames: 22
                    }
                )
            ];
        }
    }
};

export const STORY_TEMPLATE_REGISTRY = storyTemplates;
export const STORY_TEMPLATE_IDS = Object.keys(
    storyTemplates
) as StoryTemplateId[];

export const pickTemplateForContext = (
    ctx: StoryBusinessContext
): StoryTemplateId => {
    const tone = ctx.tone?.toLowerCase();
    const category = ctx.serviceCategory?.toLowerCase();
    const cta = ctx.ctaLabel?.toLowerCase();

    const scored = STORY_TEMPLATE_IDS.map((id) => {
        const spec = storyTemplates[id];
        let score = 0;

        if (
            tone &&
            spec.tones.some((value) => value.toLowerCase().includes(tone))
        ) {
            score += 2;
        }
        if (
            category &&
            spec.recommendedCategories.some((value) =>
                value.toLowerCase().includes(category)
            )
        ) {
            score += 2;
        }
        if (
            cta &&
            spec.ctas.some((value) => value.toLowerCase().includes(cta))
        ) {
            score += 1;
        }

        // Petit boost lorsqu’un contexte clé est fourni
        if (id === 'tutorial' && ctx.tutorialSteps?.length) {
            score += 1;
        }
        if (id === 'testimonial' && ctx.testimonialQuote) {
            score += 1;
        }
        if (id === 'comparison' && ctx.comparisonTargets) {
            score += 1;
        }

        return { id, score };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0];
    return best && best.score > 0 ? (best.id as StoryTemplateId) : 'blog';
};

export const buildTimelineFromTemplate = (
    templateId: StoryTemplateId,
    ctx: StoryBusinessContext = {},
    overrides?: Partial<Pick<ImmersiveTimeline, 'fps' | 'width' | 'height'>>
): ImmersiveTimeline => {
    const spec = storyTemplates[templateId] ?? storyTemplates.blog;
    const scenes = spec.blueprint(ctx);

    return {
        fps: overrides?.fps ?? 30,
        width: overrides?.width ?? 1080,
        height: overrides?.height ?? 1920,
        scenes
    };
};

