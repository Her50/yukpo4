import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'node:fs';
import pc from 'picocolors';
import { buildS3ClientConfig, isS3UploadEnabled, loadStorageConfig } from '../config/storage.js';
const trimSlashes = (value) => value.replace(/^\/+/, '').replace(/\/+$/, '');
const joinPath = (...segments) => segments
    .filter(Boolean)
    .map(trimSlashes)
    .join('/');
const buildPublicBaseUrl = (config) => {
    if (config.publicBaseUrl) {
        return config.publicBaseUrl.trim().replace(/\/+$/, '');
    }
    if (config.endpoint) {
        try {
            const endpointUrl = new URL(config.endpoint);
            if (config.forcePathStyle) {
                return `${endpointUrl.origin}/${config.bucket}`;
            }
            return `${endpointUrl.protocol}//${config.bucket}.${endpointUrl.host}`;
        }
        catch (error) {
            console.warn(pc.yellow(`[video-renderer] Impossible de parser S3_ENDPOINT (${config.endpoint}): ${String(error)}`));
        }
    }
    if (config.region) {
        return `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
    }
    return `https://${config.bucket}.s3.amazonaws.com`;
};
const uploadFile = async (client, bucket, key, filePath, contentType) => {
    const stats = await fs.promises.stat(filePath);
    const body = fs.createReadStream(filePath);
    const upload = new Upload({
        client,
        params: {
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType
        }
    });
    await upload.done();
    return stats.size;
};
export const createStorageUploader = () => {
    if (!isS3UploadEnabled()) {
        return null;
    }
    const config = loadStorageConfig();
    if (!config) {
        console.warn(pc.yellow('[video-renderer] RENDERER_S3_UPLOAD activé mais configuration S3 incomplète.'));
        return null;
    }
    const client = new S3Client(buildS3ClientConfig(config));
    const publicBaseUrl = buildPublicBaseUrl(config);
    const uploadRenderedArtifacts = async (result) => {
        const warnings = [];
        const uploadBaseKey = joinPath(config.uploadPrefix, result.jobId);
        const videoKey = joinPath(uploadBaseKey, 'master.mp4');
        const videoStoragePath = joinPath(config.storagePrefix, videoKey);
        let videoArtifact;
        try {
            const size = await uploadFile(client, config.bucket, videoStoragePath, result.masterVideo, 'video/mp4');
            const publicUrl = `${publicBaseUrl}/${videoStoragePath}`;
            videoArtifact = {
                storageKey: videoKey,
                storagePath: videoStoragePath,
                publicUrl,
                contentLength: size
            };
            console.log(pc.green(`[video-renderer] ✅ Vidéo uploadée vers S3 (${videoStoragePath})`));
        }
        catch (error) {
            const message = `[video-renderer] ❌ Upload S3 vidéo échoué: ${String(error)}`;
            console.error(pc.red(message));
            warnings.push(message);
        }
        const timelineArtifact = await (async () => {
            try {
                const exists = await fs.promises
                    .access(result.timelineJson, fs.constants.F_OK)
                    .then(() => true)
                    .catch(() => false);
                if (!exists) {
                    return undefined;
                }
                const timelineKey = joinPath(uploadBaseKey, 'timeline.json');
                const timelineStoragePath = joinPath(config.storagePrefix, timelineKey);
                const size = await uploadFile(client, config.bucket, timelineStoragePath, result.timelineJson, 'application/json');
                const publicUrl = `${publicBaseUrl}/${timelineStoragePath}`;
                console.log(pc.green(`[video-renderer] ✅ Timeline uploadée vers S3 (${timelineStoragePath})`));
                return {
                    storageKey: timelineKey,
                    storagePath: timelineStoragePath,
                    publicUrl,
                    contentLength: size
                };
            }
            catch (error) {
                const message = `[video-renderer] ⚠️ Upload S3 timeline échoué: ${String(error)}`;
                console.error(pc.yellow(message));
                warnings.push(message);
                return undefined;
            }
        })();
        return {
            video: videoArtifact,
            timeline: timelineArtifact,
            warnings
        };
    };
    return {
        uploadRenderedArtifacts
    };
};
