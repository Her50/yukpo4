#!/usr/bin/env node
import { bundle } from '@remotion/bundler';
import {
    getCompositions,
    renderFrames,
    stitchFramesToVideo
} from '@remotion/renderer';
import { mkdirp } from 'fs-extra';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

import { ImmersiveTimeline, ZImmersiveTimeline } from '../types/index.js';

type RenderArgs = {
    job: string;
    outDir?: string;
    compositionId?: string;
    overwrite?: boolean;
};

const parseArgs = (): RenderArgs => {
    const args = process.argv.slice(2);
    const renderArgs: RenderArgs = { job: '' };

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '--job') {
            renderArgs.job = args[i + 1];
            i += 1;
        } else if (arg === '--out-dir') {
            renderArgs.outDir = args[i + 1];
            i += 1;
        } else if (arg === '--composition') {
            renderArgs.compositionId = args[i + 1];
            i += 1;
        } else if (arg === '--overwrite') {
            renderArgs.overwrite = true;
        }
    }

    return renderArgs;
};

const loadTimeline = (jobPath: string): ImmersiveTimeline => {
    const data = fs.readFileSync(jobPath, 'utf-8');
    const json = JSON.parse(data);
    const parsed = ZImmersiveTimeline.safeParse(json);

    if (!parsed.success) {
        console.error(pc.red('❌ Timline invalide:'), parsed.error.format());
        process.exit(1);
    }

    return parsed.data;
};

const run = async () => {
    const { job, outDir, compositionId, overwrite } = parseArgs();

    if (!job) {
        console.error(pc.red('❌ Argument --job requis (fichier JSON timeline)'));
        process.exit(1);
    }

    const jobPath = path.resolve(process.cwd(), job);
    if (!fs.existsSync(jobPath)) {
        console.error(pc.red(`❌ Fichier job non trouvé: ${jobPath}`));
        process.exit(1);
    }

    const timeline = loadTimeline(jobPath);
    const outputDir =
        outDir ?? path.join(process.cwd(), 'renders', path.basename(job, '.json'));
    const framesDir = path.join(outputDir, 'frames');

    if (!overwrite && fs.existsSync(outputDir)) {
        console.error(
            pc.yellow(
                `⚠️  Le dossier ${outputDir} existe déjà. Utilise --overwrite pour forcer.`
            )
        );
        process.exit(1);
    }

    await mkdirp(framesDir);

    console.log(pc.cyan('🚀 Bundling Remotion...'));
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(currentDir, '..', '..', '..');
    const entryPoint = path.join(projectRoot, 'dist', 'src', 'index.js');
    if (!fs.existsSync(entryPoint)) {
        console.error(
            pc.red(
                `❌ Entry point introuvable (${entryPoint}). Compile avec "npm run build" auparavant.`
            )
        );
        process.exit(1);
    }

    if (process.env.REMOTION_BROWSER_DOWNLOAD_DIR) {
        process.env.REMOTION_BROWSER_DOWNLOAD_FOLDER =
            process.env.REMOTION_BROWSER_DOWNLOAD_DIR;
    }

    const remotionBundle = await bundle(entryPoint);

    const compId = compositionId ?? 'immersive-video';

    const compositions = await getCompositions(remotionBundle, {
        inputProps: timeline,
        envVariables: {
            TIMELINE: JSON.stringify(timeline)
        }
    });

    const composition = compositions.find((c) => c.id === compId);

    if (!composition) {
        console.error(pc.red(`❌ Composition ${compId} introuvable`));
        process.exit(1);
    }

    console.log(pc.cyan('🎬 Rendu des frames...'));
    const { assetsInfo } = await renderFrames({
        onStart: () => undefined,
        onFrameUpdate: () => undefined,
        composition,
        serveUrl: remotionBundle,
        outputDir: framesDir,
        imageFormat: 'jpeg',
        inputProps: timeline,
        envVariables: {
            TIMELINE: JSON.stringify(timeline)
        }
    });

    const videoOut = path.join(outputDir, 'master.mp4');
    console.log(pc.cyan('🎞️  Assemblage vidéo...'));
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

    console.log(pc.green(`✅ Vidéo générée: ${videoOut}`));
};

run().catch((err) => {
    console.error(pc.red('❌ Erreur de rendu Remotion'), err);
    process.exit(1);
});


