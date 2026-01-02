import { z } from 'zod';
export const ZImmersiveScene = z.object({
    id: z.string(),
    template: z.enum(['IntroPulse', 'ProductShowcase', 'ARHighlight', 'GlowCTA']),
    durationInFrames: z.number().min(15),
    assets: z
        .object({
        headline: z.string().optional(),
        subheadline: z.string().optional(),
        body: z.string().optional(),
        productImageUrl: z.string().url().optional(),
        backgroundUrl: z.string().url().optional(),
        videoUrl: z.string().optional(),
        stickers: z
            .array(z.object({
            id: z.string(),
            src: z.string(),
            startFrame: z.number().min(0),
            durationInFrames: z.number().positive(),
            position: z
                .object({
                x: z.number(),
                y: z.number(),
                scale: z.number().positive().default(1)
            })
                .optional()
        }))
            .optional()
    })
        .default({}),
    transition: z
        .object({
        type: z.enum(['orbit-3d', 'parallax', 'speed-ramp', 'hard-cut']).default('hard-cut'),
        durationInFrames: z.number().min(1).max(90).default(24)
    })
        .default({
        type: 'hard-cut',
        durationInFrames: 12
    }),
    colorGrade: z
        .object({
        style: z.enum(['none', 'cinematic', 'glow']).default('cinematic'),
        intensity: z.number().min(0).max(1).default(0.6)
    })
        .optional()
});
export const ZImmersiveTimeline = z.object({
    fps: z.number().default(30),
    width: z.number().default(1080),
    height: z.number().default(1920),
    audioCueMap: z
        .array(z.object({
        id: z.string(),
        startFrame: z.number(),
        cueType: z.enum(['impact', 'glitch', 'riser', 'beat'])
    }))
        .optional(),
    scenes: z.array(ZImmersiveScene).min(1)
});
