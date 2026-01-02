#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { renderTimelineToVideo, validateTimeline, } from '../core/render.js';
import { buildTimelineFromTemplate, STORY_TEMPLATE_IDS, } from '../templates/storyTemplates.js';
const parseArgs = () => {
    const args = process.argv.slice(2);
    const renderArgs = {};
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '--job') {
            renderArgs.job = args[i + 1];
            i += 1;
        }
        else if (arg === '--out-dir') {
            renderArgs.outDir = args[i + 1];
            i += 1;
        }
        else if (arg === '--composition') {
            renderArgs.compositionId = args[i + 1];
            i += 1;
        }
        else if (arg === '--overwrite') {
            renderArgs.overwrite = true;
        }
        else if (arg === '--template') {
            renderArgs.templateId = args[i + 1];
            i += 1;
        }
        else if (arg === '--context') {
            renderArgs.contextPath = args[i + 1];
            i += 1;
        }
    }
    return renderArgs;
};
const loadTimeline = (jobPath) => {
    const data = fs.readFileSync(jobPath, 'utf-8');
    const json = JSON.parse(data);
    try {
        return validateTimeline(json);
    }
    catch (err) {
        console.error(pc.red('❌ Timeline invalide:'), err);
        process.exit(1);
    }
};
const isTemplateId = (value) => typeof value === 'string' && STORY_TEMPLATE_IDS.includes(value);
const loadTemplateContext = (contextPath) => {
    if (!contextPath) {
        return {};
    }
    const absolute = path.resolve(process.cwd(), contextPath);
    if (!fs.existsSync(absolute)) {
        console.error(pc.red(`❌ Fichier contexte introuvable: ${absolute}`));
        process.exit(1);
    }
    try {
        const data = fs.readFileSync(absolute, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error(pc.red('❌ Impossible de lire le contexte template'), error);
        process.exit(1);
    }
};
const run = async () => {
    const { job, outDir, compositionId, overwrite, templateId, contextPath } = parseArgs();
    let timeline;
    let timelinePath;
    let derivedJobId;
    if (templateId) {
        if (!isTemplateId(templateId)) {
            console.error(pc.red(`❌ Template "${templateId}" invalide. Options: ${STORY_TEMPLATE_IDS.join(', ')}`));
            process.exit(1);
        }
        const templateContext = loadTemplateContext(contextPath);
        timeline = buildTimelineFromTemplate(templateId, templateContext);
        derivedJobId = `${templateId}-${Date.now()}`;
        console.log(pc.cyan(`🧩 Timeline générée depuis le template ${templateId} (${timeline.scenes.length} scènes)`));
    }
    else {
        if (!job) {
            console.error(pc.red('❌ Argument --job requis si aucun template story n’est fourni'));
            process.exit(1);
        }
        const jobPath = path.resolve(process.cwd(), job);
        if (!fs.existsSync(jobPath)) {
            console.error(pc.red(`❌ Fichier job non trouvé: ${jobPath}`));
            process.exit(1);
        }
        timeline = loadTimeline(jobPath);
        timelinePath = jobPath;
        derivedJobId = path.basename(job, '.json');
    }
    const jobLabel = derivedJobId ?? randomUUID();
    const outputDir = outDir ??
        path.join(process.cwd(), 'renders', templateId ? jobLabel : path.basename(job, '.json'));
    try {
        const result = await renderTimelineToVideo(timeline, {
            jobId: jobLabel,
            outputRoot: path.dirname(outputDir),
            overwrite,
            compositionId,
            timelinePath
        });
        console.log(pc.green(`✅ Vidéo générée: ${result.masterVideo}`));
    }
    catch (err) {
        console.error(pc.red('❌ Erreur de rendu Remotion'), err);
        process.exit(1);
    }
};
run().catch((err) => {
    console.error(pc.red('❌ Erreur de rendu Remotion'), err);
    process.exit(1);
});
