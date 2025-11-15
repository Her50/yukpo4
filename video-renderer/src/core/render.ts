import { bundle } from '@remotion/bundler';
import {
    getCompositions,
    renderFrames,
    stitchFramesToVideo
} from '@remotion/renderer';
import { mkdirp } from 'fs-extra';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

import {
    ImmersiveTimeline,
    ZImmersiveTimeline
} from '../types/index.js';

export type RenderOptions = {
    jobId?: string;
    outputRoot?: string;
    overwrite?: boolean;
    compositionId?: string;
    timelinePath?: string;
    warnings?: string[];
};

export type RenderResult = {
    jobId: string;
    masterVideo: string;
    timelineJson: string;
    outputDir: string;
    warnings: string[];
};

const resolveProjectEntry = (): string => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(currentDir, '..', '..', '..');
    const entryPoint = path.join(projectRoot, 'dist', 'src', 'index.js');
    if (!fs.existsSync(entryPoint)) {
        throw new Error(
            `Entry point introuvable (${entryPoint}). Compile avec "npm run build".`
        );
    }
    return entryPoint;
};

const writeTimelineFile = async (
    timeline: ImmersiveTimeline,
    filePath: string
): Promise<void> => {
    await mkdirp(path.dirname(filePath));
    await fs.promises.writeFile(filePath, JSON.stringify(timeline, null, 2), 'utf-8');
};

const renderFramesToVideo = async ({
    timeline,
    outputDir,
    compositionId
}: {
    timeline: ImmersiveTimeline;
    outputDir: string;
    compositionId?: string;
}): Promise<{
    assetsInfo: Awaited<ReturnType<typeof renderFrames>>['assetsInfo'];
    videoOut: string;
    warnings: string[];
}> => {
    const entryPoint = resolveProjectEntry();

    if (process.env.REMOTION_BROWSER_DOWNLOAD_DIR) {
        process.env.REMOTION_BROWSER_DOWNLOAD_FOLDER =
            process.env.REMOTION_BROWSER_DOWNLOAD_DIR;
    }

    const bundleLocation = await bundle(entryPoint);

    const compositions = await getCompositions(bundleLocation, {
        inputProps: timeline,
        envVariables: {
            TIMELINE: JSON.stringify(timeline)
        }
    });

    const compId = compositionId ?? 'immersive-video';
    const composition = compositions.find((c) => c.id === compId);

    if (!composition) {
        throw new Error(`Composition ${compId} introuvable`);
    }

    console.log(pc.cyan('🎬 Rendu des frames...'));
    const framesDir = path.join(outputDir, 'frames');
    await mkdirp(framesDir);

    const { assetsInfo } = await renderFrames({
        onStart: () => undefined,
        onFrameUpdate: () => undefined,
        composition,
        serveUrl: bundleLocation,
        outputDir: framesDir,
        imageFormat: 'jpeg',
        inputProps: timeline,
        envVariables: {
            TIMELINE: JSON.stringify(timeline)
        }
    });

    console.log(pc.cyan('🎞️  Assemblage vidéo...'));
    const videoOut = path.join(outputDir, 'master.mp4');
    await stitchFramesToVideo({
        assetsInfo,
        fps: composition.fps,
        width: composition.width,
        height: composition.height,
        outputLocation: videoOut,
        codec: 'h264',
        audioCodec: 'aac',
        force: true
    });

    return { assetsInfo, videoOut, warnings: [] };
};

export const validateTimeline = (data: unknown): ImmersiveTimeline => {
    const parsed = ZImmersiveTimeline.safeParse(data);
    if (!parsed.success) {
        throw new Error(
            `Timeline invalide: ${JSON.stringify(parsed.error.format(), null, 2)}`
        );
    }
    return parsed.data;
};

export const renderTimelineToVideo = async (
    timelineInput: ImmersiveTimeline,
    options: RenderOptions = {}
): Promise<RenderResult> => {
    const timeline = timelineInput;
    const jobId = options.jobId ?? randomUUID();
    const outputRoot =
        options.outputRoot ??
        process.env.VIDEO_RENDERER_SHARED_VOLUME ??
        '/app/renders';
    const jobDir = path.resolve(outputRoot, jobId);
    const timelinePath =
        options.timelinePath ?? path.join(jobDir, `${jobId}.timeline.json`);

    if (!options.overwrite && fs.existsSync(jobDir)) {
        throw new Error(
            `Le dossier ${jobDir} existe déjà. Active l'option overwrite pour forcer le rendu.`
        );
    }

    await mkdirp(jobDir);
    await writeTimelineFile(timeline, timelinePath);

    const { videoOut, warnings } = await renderFramesToVideo({
        timeline,
        outputDir: jobDir,
        compositionId: options.compositionId
    });

    return {
        jobId,
        masterVideo: videoOut,
        timelineJson: timelinePath,
        outputDir: jobDir,
        warnings: options.warnings ?? warnings
    };
};


