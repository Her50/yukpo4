/**
 * Hook personnalisé pour gérer les fichiers cloud
 * Permet de télécharger, mettre en cache et afficher des fichiers depuis le cloud
 */

import { useEffect, useState } from 'react';
import { 
    downloadFromCloud, 
    downloadMultipleFromCloud, 
    cacheCloudFile, 
    isCloudUrl,
    DownloadResult 
} from '../services/cloudDownload';

interface UseCloudFilesOptions {
    autoDownload?: boolean; // Télécharger automatiquement au montage
    asBase64?: boolean; // Retourner en base64
    useCache?: boolean; // Utiliser le cache
}

/**
 * Hook pour gérer un seul fichier cloud
 */
export const useCloudFile = (
    cloudUrl: string | null | undefined,
    options: UseCloudFilesOptions = {}
) => {
    const [localUri, setLocalUri] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const { autoDownload = true, asBase64 = false, useCache = true } = options;

    const download = async () => {
        if (!cloudUrl) return;

        // Si ce n'est pas une URL cloud, l'utiliser directement
        if (!isCloudUrl(cloudUrl)) {
            setLocalUri(cloudUrl);
            return;
        }

        setIsDownloading(true);
        setError(null);

        try {
            let result: DownloadResult;

            if (useCache) {
                // Utiliser le cache
                const cacheKey = generateCacheKey(cloudUrl);
                const cachedUri = await cacheCloudFile(cloudUrl, cacheKey);
                
                if (cachedUri) {
                    result = {
                        success: true,
                        localUri: cachedUri
                    };
                } else {
                    result = await downloadFromCloud(cloudUrl, {
                        asBase64,
                        onProgress: (prog) => setProgress(prog.percentage)
                    });
                }
            } else {
                result = await downloadFromCloud(cloudUrl, {
                    asBase64,
                    onProgress: (prog) => setProgress(prog.percentage)
                });
            }

            if (result.success) {
                setLocalUri(result.localUri || result.base64 || null);
            } else {
                setError(result.error || 'Erreur de téléchargement');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    useEffect(() => {
        if (autoDownload && cloudUrl) {
            download();
        }
    }, [cloudUrl, autoDownload]);

    return {
        localUri,
        isDownloading,
        progress,
        error,
        download,
        retry: download
    };
};

/**
 * Hook pour gérer plusieurs fichiers cloud
 */
export const useCloudFiles = (
    cloudUrls: string[],
    options: UseCloudFilesOptions = {}
) => {
    const [localUris, setLocalUris] = useState<string[]>([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState({ completed: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);

    const { autoDownload = true, asBase64 = false } = options;

    const download = async () => {
        if (!cloudUrls || cloudUrls.length === 0) return;

        setIsDownloading(true);
        setError(null);
        setProgress({ completed: 0, total: cloudUrls.length });

        try {
            // Séparer les URLs cloud des URLs non-cloud
            const filesToDownload: string[] = [];
            const directUris: string[] = [];

            cloudUrls.forEach(url => {
                if (isCloudUrl(url)) {
                    filesToDownload.push(url);
                } else {
                    directUris.push(url);
                }
            });

            // Télécharger les fichiers cloud
            const results = await downloadMultipleFromCloud(filesToDownload, {
                asBase64,
                onProgress: (completed, total) => {
                    setProgress({ completed, total });
                }
            });

            // Combiner les URIs téléchargées avec les URIs directes
            const downloadedUris = results
                .filter(r => r.success)
                .map(r => r.localUri || r.base64 || '');

            const allUris = [...directUris, ...downloadedUris];
            setLocalUris(allUris);

            // Vérifier s'il y a eu des erreurs
            const failedDownloads = results.filter(r => !r.success);
            if (failedDownloads.length > 0) {
                setError(`${failedDownloads.length} fichier(s) n'ont pas pu être téléchargés`);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    useEffect(() => {
        if (autoDownload && cloudUrls.length > 0) {
            download();
        }
    }, [JSON.stringify(cloudUrls), autoDownload]);

    return {
        localUris,
        isDownloading,
        progress,
        error,
        download,
        retry: download
    };
};

/**
 * Génère une clé de cache unique pour une URL
 */
function generateCacheKey(url: string): string {
    // Utiliser une hash simple de l'URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Ajouter l'extension du fichier si possible
    const extension = url.split('.').pop()?.split('?')[0] || 'file';
    return `${Math.abs(hash)}.${extension}`;
}

