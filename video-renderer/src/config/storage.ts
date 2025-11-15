import type { S3ClientConfig } from '@aws-sdk/client-s3';

const truthy = new Set(['1', 'true', 'yes', 'on']);

const env = (name: string): string | undefined => {
    const value = process.env[name];
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const envBool = (name: string, fallback = false): boolean => {
    const value = env(name);
    if (!value) {
        return fallback;
    }
    const normalized = value.toLowerCase();
    if (truthy.has(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return fallback;
};

export type RendererStorageConfig = {
    bucket: string;
    region?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    forcePathStyle: boolean;
    storagePrefix: string;
    uploadPrefix: string;
    publicBaseUrl?: string;
};

export const isS3UploadEnabled = (): boolean => {
    return (
        envBool('RENDERER_S3_UPLOAD', false) ||
        envBool('VIDEO_RENDERER_S3_UPLOAD', false) ||
        envBool('VIDEO_RENDERER_UPLOAD_TO_S3', false)
    );
};

export const loadStorageConfig = (): RendererStorageConfig | null => {
    const bucket =
        env('S3_BUCKET') ??
        env('AWS_S3_BUCKET');

    if (!bucket) {
        return null;
    }

    const region = env('S3_REGION') ?? env('AWS_REGION');
    const endpoint = env('S3_ENDPOINT') ?? env('AWS_S3_ENDPOINT');
    const accessKeyId = env('S3_ACCESS_KEY') ?? env('AWS_ACCESS_KEY_ID');
    const secretAccessKey =
        env('S3_SECRET_KEY') ?? env('AWS_SECRET_ACCESS_KEY');
    const sessionToken = env('S3_SESSION_TOKEN') ?? env('AWS_SESSION_TOKEN');
    const forcePathStyle = envBool(
        'S3_FORCE_PATH_STYLE',
        Boolean(endpoint)
    );

    const storagePrefix =
        env('S3_STORAGE_PREFIX') ??
        env('MEDIA_STORAGE_PREFIX') ??
        'uploads';
    const uploadPrefix =
        env('S3_RENDER_UPLOAD_PREFIX') ??
        env('VIDEO_RENDERER_UPLOAD_PREFIX') ??
        'renders';
    const publicBaseUrl =
        env('UPLOAD_BASE_URL') ??
        env('PUBLIC_BASE_URL');

    return {
        bucket,
        region,
        endpoint,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        forcePathStyle,
        storagePrefix: storagePrefix.replace(/^\/+|\/+$/g, ''),
        uploadPrefix: uploadPrefix.replace(/^\/+|\/+$/g, ''),
        publicBaseUrl: publicBaseUrl?.trim()
    };
};

export const buildS3ClientConfig = (
    config: RendererStorageConfig
): S3ClientConfig => {
    const clientConfig: S3ClientConfig = {};

    if (config.region) {
        clientConfig.region = config.region;
    }

    if (config.accessKeyId && config.secretAccessKey) {
        clientConfig.credentials = {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sessionToken: config.sessionToken
        };
    }

    if (config.endpoint) {
        clientConfig.endpoint = config.endpoint;
    }

    if (config.forcePathStyle) {
        clientConfig.forcePathStyle = true;
    }

    return clientConfig;
};


