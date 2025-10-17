/**
 * Service de téléchargement de fichiers depuis le cloud vers l'application
 * Permet de récupérer images, vidéos, documents depuis Cloudinary ou autre CDN
 */

import * as FileSystem from 'expo-file-system';

export interface DownloadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export interface DownloadResult {
    success: boolean;
    localUri?: string;
    base64?: string;
    error?: string;
    fileName?: string;
    fileSize?: number;
}

/**
 * Télécharge un fichier depuis une URL cloud vers l'application
 * @param cloudUrl URL du fichier dans le cloud (Cloudinary, S3, etc.)
 * @param options Options de téléchargement
 * @returns Résultat du téléchargement avec URI local ou base64
 */
export const downloadFromCloud = async (
    cloudUrl: string,
    options?: {
        asBase64?: boolean; // Retourner en base64 au lieu d'un fichier local
        fileName?: string;
        onProgress?: (progress: DownloadProgress) => void;
    }
): Promise<DownloadResult> => {
    try {
        console.log('[CloudDownload] Début téléchargement:', cloudUrl);

        // Vérifier que l'URL est valide
        if (!cloudUrl || !cloudUrl.startsWith('http')) {
            // Si c'est déjà du base64, le retourner directement
            if (cloudUrl.startsWith('data:')) {
                return {
                    success: true,
                    base64: cloudUrl,
                    localUri: cloudUrl
                };
            }
            return {
                success: false,
                error: 'URL invalide'
            };
        }

        // Déterminer le nom du fichier
        const fileName = options?.fileName || cloudUrl.split('/').pop() || `file_${Date.now()}`;
        
        if (options?.asBase64) {
            // Télécharger en base64
            const response = await fetch(cloudUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const base64 = await blobToBase64(blob);
            
            return {
                success: true,
                base64: base64,
                localUri: base64,
                fileName: fileName
            };
        } else {
            // Télécharger en tant que fichier local
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
            
            const downloadResumable = FileSystem.createDownloadResumable(
                cloudUrl,
                fileUri,
                {},
                (downloadProgress) => {
                    if (options?.onProgress) {
                        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                        options.onProgress({
                            loaded: downloadProgress.totalBytesWritten,
                            total: downloadProgress.totalBytesExpectedToWrite,
                            percentage: progress * 100
                        });
                    }
                }
            );

            const result = await downloadResumable.downloadAsync();
            
            if (result) {
                console.log('[CloudDownload] Téléchargement réussi:', result.uri);
                return {
                    success: true,
                    localUri: result.uri,
                    fileName: fileName
                };
            } else {
                return {
                    success: false,
                    error: 'Échec du téléchargement'
                };
            }
        }

    } catch (error: any) {
        console.error('[CloudDownload] Erreur téléchargement:', error);
        return {
            success: false,
            error: error.message || 'Erreur lors du téléchargement'
        };
    }
};

/**
 * Télécharge plusieurs fichiers depuis le cloud
 * @param cloudUrls Tableau d'URLs à télécharger
 * @param options Options de téléchargement
 * @returns Tableau de résultats
 */
export const downloadMultipleFromCloud = async (
    cloudUrls: string[],
    options?: {
        asBase64?: boolean;
        onProgress?: (completed: number, total: number) => void;
    }
): Promise<DownloadResult[]> => {
    const results: DownloadResult[] = [];
    let completed = 0;

    for (const url of cloudUrls) {
        const result = await downloadFromCloud(url, {
            asBase64: options?.asBase64
        });
        results.push(result);
        completed++;
        
        if (options?.onProgress) {
            options.onProgress(completed, cloudUrls.length);
        }
    }

    return results;
};

/**
 * Convertit un Blob en base64
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Vérifie si une URL est une URL cloud valide
 */
export const isCloudUrl = (url: string): boolean => {
    if (!url) return false;
    
    // Vérifier si c'est une URL HTTP/HTTPS
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return true;
    }
    
    // Vérifier si c'est du base64
    if (url.startsWith('data:')) {
        return false; // Déjà en base64, pas besoin de télécharger
    }
    
    return false;
};

/**
 * Récupère les métadonnées d'un fichier cloud sans le télécharger complètement
 */
export const getCloudFileMetadata = async (
    cloudUrl: string
): Promise<{
    size?: number;
    type?: string;
    lastModified?: Date;
}> => {
    try {
        const response = await fetch(cloudUrl, { method: 'HEAD' });
        
        return {
            size: parseInt(response.headers.get('content-length') || '0'),
            type: response.headers.get('content-type') || undefined,
            lastModified: response.headers.get('last-modified') 
                ? new Date(response.headers.get('last-modified')!) 
                : undefined
        };
    } catch (error) {
        console.error('[CloudDownload] Erreur métadonnées:', error);
        return {};
    }
};

/**
 * Met en cache un fichier cloud pour un accès hors ligne
 * @param cloudUrl URL du fichier
 * @param cacheKey Clé unique pour identifier le cache
 * @returns URI local du fichier en cache
 */
export const cacheCloudFile = async (
    cloudUrl: string,
    cacheKey: string
): Promise<string | null> => {
    try {
        const cacheDir = `${FileSystem.cacheDirectory}cloud_cache/`;
        
        // Créer le dossier de cache s'il n'existe pas
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        }

        const cachedFilePath = `${cacheDir}${cacheKey}`;
        
        // Vérifier si le fichier est déjà en cache
        const fileInfo = await FileSystem.getInfoAsync(cachedFilePath);
        if (fileInfo.exists) {
            console.log('[CloudDownload] Fichier déjà en cache:', cachedFilePath);
            return cachedFilePath;
        }

        // Télécharger et mettre en cache
        const result = await downloadFromCloud(cloudUrl, {
            fileName: cacheKey
        });

        if (result.success && result.localUri) {
            // Déplacer vers le dossier de cache
            await FileSystem.moveAsync({
                from: result.localUri,
                to: cachedFilePath
            });
            
            console.log('[CloudDownload] Fichier mis en cache:', cachedFilePath);
            return cachedFilePath;
        }

        return null;
    } catch (error) {
        console.error('[CloudDownload] Erreur mise en cache:', error);
        return null;
    }
};

/**
 * Nettoie le cache des fichiers cloud
 */
export const clearCloudCache = async (): Promise<void> => {
    try {
        const cacheDir = `${FileSystem.cacheDirectory}cloud_cache/`;
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        
        if (dirInfo.exists) {
            await FileSystem.deleteAsync(cacheDir, { idempotent: true });
            console.log('[CloudDownload] Cache nettoyé');
        }
    } catch (error) {
        console.error('[CloudDownload] Erreur nettoyage cache:', error);
    }
};

/**
 * Obtient la taille du cache cloud
 */
export const getCloudCacheSize = async (): Promise<number> => {
    try {
        const cacheDir = `${FileSystem.cacheDirectory}cloud_cache/`;
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        
        if (!dirInfo.exists) {
            return 0;
        }

        const files = await FileSystem.readDirectoryAsync(cacheDir);
        let totalSize = 0;

        for (const file of files) {
            const fileInfo = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
            if (fileInfo.exists && 'size' in fileInfo) {
                totalSize += fileInfo.size;
            }
        }

        return totalSize;
    } catch (error) {
        console.error('[CloudDownload] Erreur calcul taille cache:', error);
        return 0;
    }
};

/**
 * Convertit une URL Cloudinary en différentes résolutions
 * Utile pour les miniatures et optimisations
 */
export const getCloudinaryVariants = (cloudinaryUrl: string) => {
    if (!cloudinaryUrl.includes('cloudinary.com')) {
        return {
            original: cloudinaryUrl,
            thumbnail: cloudinaryUrl,
            medium: cloudinaryUrl,
            large: cloudinaryUrl
        };
    }

    // Extraire la partie de l'URL avant /upload/
    const parts = cloudinaryUrl.split('/upload/');
    if (parts.length !== 2) {
        return {
            original: cloudinaryUrl,
            thumbnail: cloudinaryUrl,
            medium: cloudinaryUrl,
            large: cloudinaryUrl
        };
    }

    const baseUrl = parts[0];
    const imagePath = parts[1];

    return {
        original: cloudinaryUrl,
        thumbnail: `${baseUrl}/upload/w_150,h_150,c_fill/${imagePath}`,
        medium: `${baseUrl}/upload/w_500,h_500,c_fit/${imagePath}`,
        large: `${baseUrl}/upload/w_1200,h_1200,c_fit/${imagePath}`
    };
};

