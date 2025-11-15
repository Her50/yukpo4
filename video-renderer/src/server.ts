import type { Request, Response } from 'express';
import express from 'express';
import pc from 'picocolors';

import {
    renderTimelineToVideo,
    validateTimeline,
    type RenderOptions
} from './core/render.js';
import {
    createStorageUploader
} from './storage/s3.js';
import {
    buildTimelineFromTemplate,
    STORY_TEMPLATE_IDS,
    type StoryBusinessContext,
    type StoryTemplateId
} from './templates/storyTemplates.js';

const app = express();
const PORT = Number(process.env.PORT ?? 8080);
const storageUploader = createStorageUploader();

app.use(
    express.json({
        limit: process.env.RENDERER_MAX_BODY_SIZE ?? '10mb'
    })
);

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', mode: process.env.VIDEO_RENDERER_ENABLE_GPU ?? 'cpu' });
});

const isTemplateId = (value: unknown): value is StoryTemplateId =>
    typeof value === 'string' && STORY_TEMPLATE_IDS.includes(value as StoryTemplateId);

app.post('/render', async (req: Request, res: Response) => {
    const {
        job_id: jobId,
        timeline: rawTimeline,
        story_template_id: storyTemplateId,
        story_context: storyContext,
        timeline_overrides: timelineOverrides
    } = req.body ?? {};

    let timeline = rawTimeline;
    const templateWarnings: string[] = [];

    if (!timeline && storyTemplateId) {
        if (!isTemplateId(storyTemplateId)) {
            res.status(400).json({
                error: `story_template_id invalide. Options: ${STORY_TEMPLATE_IDS.join(', ')}`
            });
            return;
        }
        const context = (typeof storyContext === 'object' && storyContext !== null
            ? storyContext
            : {}) as StoryBusinessContext;
        const overrides =
            typeof timelineOverrides === 'object' && timelineOverrides !== null
                ? timelineOverrides
                : undefined;
        timeline = buildTimelineFromTemplate(storyTemplateId, context, overrides);
        templateWarnings.push(`timeline_generated_from_template:${storyTemplateId}`);
    }

    if (!timeline) {
        res.status(400).json({ error: 'timeline field required' });
        return;
    }

    try {
        const validatedTimeline = validateTimeline(timeline);
        const options: RenderOptions = {
            jobId,
            overwrite: true
        };
        const result = await renderTimelineToVideo(validatedTimeline, options);

        let storageResult:
            | {
                storage_key?: string;
                storage_path?: string;
                public_url?: string;
                content_length?: number;
                timeline_storage_key?: string;
                timeline_storage_path?: string;
                timeline_public_url?: string;
                timeline_content_length?: number;
                warnings: string[];
            }
            | undefined;

        if (storageUploader) {
            const uploadOutcome = await storageUploader.uploadRenderedArtifacts(result);
            storageResult = {
                storage_key: uploadOutcome.video?.storageKey,
                storage_path: uploadOutcome.video?.storagePath,
                public_url: uploadOutcome.video?.publicUrl,
                content_length: uploadOutcome.video?.contentLength,
                timeline_storage_key: uploadOutcome.timeline?.storageKey,
                timeline_storage_path: uploadOutcome.timeline?.storagePath,
                timeline_public_url: uploadOutcome.timeline?.publicUrl,
                timeline_content_length: uploadOutcome.timeline?.contentLength,
                warnings: uploadOutcome.warnings
            };
        }

        res.json({
            job_id: result.jobId,
            master_video: result.masterVideo,
            timeline_json: result.timelineJson,
            output_dir: result.outputDir,
            storage_key: storageResult?.storage_key ?? null,
            storage_path: storageResult?.storage_path ?? null,
            public_url: storageResult?.public_url ?? null,
            content_length: storageResult?.content_length ?? null,
            timeline_storage_key: storageResult?.timeline_storage_key ?? null,
            timeline_storage_path: storageResult?.timeline_storage_path ?? null,
            timeline_public_url: storageResult?.timeline_public_url ?? null,
            timeline_content_length: storageResult?.timeline_content_length ?? null,
            warnings: [
                ...templateWarnings,
                ...result.warnings,
                ...(storageResult?.warnings ?? [])
            ]
        });
    } catch (error) {
        console.error(pc.red('❌ Rendu RPC échoué'), error);
        res.status(500).json({ error: (error as Error).message });
    }
});

app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
});

app.listen(PORT, () => {
    console.log(
        pc.green(
            `[video-renderer] 🚀 Serveur RPC prêt sur le port ${PORT} (mode GPU=${process.env.VIDEO_RENDERER_ENABLE_GPU ?? 'false'
            })`
        )
    );
});
