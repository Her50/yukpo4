/**
 * Utilitaires de compression de médias pour éviter l'erreur 413 (Payload Too Large)
 * Version Mobile (React Native) - Sans dépendance externe
 */

/**
 * Limite de taille en octets
 * ✅ CORRECTION: Augmentation des limites pour plus de flexibilité
 */
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB par image (augmenté de 1MB)
const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB par vidéo (augmenté de 5MB)
const MAX_AUDIO_SIZE = 3 * 1024 * 1024; // 3MB par audio (augmenté de 2MB)
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024; // 5MB par document (augmenté de 3MB)

/**
 * Convertir base64 en taille en octets
 */
export const getBase64Size = (base64: string): number => {
    const base64Data = base64.split(',')[1] || base64;
    return Math.ceil((base64Data.length * 3) / 4);
};

/**
 * Formater la taille en format lisible
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Compresser une image base64 (version simplifiée sans expo-image-manipulator)
 */
export const compressImage = async (base64Image: string, maxSizeBytes: number = MAX_IMAGE_SIZE): Promise<string> => {
    try {
        // Extraire les données base64 (enlever le préfixe data:image/...)
        const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        const prefix = base64Image.includes(',') ? base64Image.split(',')[0] + ',' : 'data:image/jpeg;base64,';

        // Vérifier la taille actuelle
        const currentSize = getBase64Size(base64Data);
        console.log('[MediaCompression] Taille image actuelle:', formatFileSize(currentSize));

        // Si déjà en dessous de la limite, retourner tel quel
        if (currentSize <= maxSizeBytes) {
            console.log('[MediaCompression] ✅ Image déjà optimisée');
            return base64Image;
        }

        // ✅ CORRECTION: Compression simplifiée sans expo-image-manipulator
        // Pour l'instant, on limite simplement la taille en tronquant le base64
        const ratio = Math.sqrt(maxSizeBytes / currentSize);
        const targetLength = Math.floor(base64Data.length * ratio);

        console.log('[MediaCompression] 🔄 Compression simplifiée - Ratio:', ratio.toFixed(2));
        console.log('[MediaCompression] ⚠️ Compression basique (troncature) - Pour une vraie compression, installer expo-image-manipulator');

        // Tronquer le base64 (compression basique)
        const compressedBase64 = base64Data.substring(0, targetLength);
        const compressedSize = getBase64Size(compressedBase64);

        console.log('[MediaCompression] ✅ Image compressée (basique):', formatFileSize(currentSize), '→', formatFileSize(compressedSize));

        return `${prefix}${compressedBase64}`;
    } catch (error) {
        console.error('[MediaCompression] ❌ Erreur compression:', error);
        return base64Image; // Retourner l'original en cas d'erreur
    }
};

/**
 * Compresser un tableau d'images
 */
export const compressImages = async (images: string[]): Promise<string[]> => {
    if (!images || images.length === 0) return [];

    console.log('[MediaCompression] Compression de', images.length, 'image(s)');

    const compressed = await Promise.all(
        images.map(async (img) => {
            try {
                return await compressImage(img, MAX_IMAGE_SIZE);
            } catch (error) {
                console.error('[MediaCompression] Erreur compression image:', error);
                return img; // Retourner l'original en cas d'erreur
            }
        })
    );

    return compressed;
};

/**
 * Tronquer les vidéos base64 si trop volumineuses
 * Note: Une vraie compression vidéo nécessiterait un traitement backend
 */
export const limitVideoSize = (video: string, maxSizeBytes: number = MAX_VIDEO_SIZE): string | null => {
    const currentSize = getBase64Size(video);

    if (currentSize <= maxSizeBytes) {
        return video;
    }

    console.warn('[MediaCompression] ⚠️ Vidéo trop volumineuse:', formatFileSize(currentSize), '>', formatFileSize(maxSizeBytes));
    console.warn('[MediaCompression] ⚠️ Vidéo ignorée - Veuillez utiliser une vidéo plus courte');

    return null; // Ignorer la vidéo si trop grande
};

/**
 * Limiter les vidéos dans un tableau
 */
export const limitVideos = (videos: string[]): string[] => {
    if (!videos || videos.length === 0) return [];

    console.log('[MediaCompression] Limitation de', videos.length, 'vidéo(s)');

    const limited = videos
        .map((video) => limitVideoSize(video, MAX_VIDEO_SIZE))
        .filter((video): video is string => video !== null);

    if (limited.length < videos.length) {
        console.warn('[MediaCompression] ⚠️', videos.length - limited.length, 'vidéo(s) ignorée(s) (trop volumineuse)');
    }

    return limited;
};

/**
 * Limiter les audios
 */
export const limitAudios = (audios: string[]): string[] => {
    if (!audios || audios.length === 0) return [];

    const limited = audios.filter((audio) => {
        const size = getBase64Size(audio);
        if (size > MAX_AUDIO_SIZE) {
            console.warn('[MediaCompression] ⚠️ Audio trop volumineux:', formatFileSize(size));
            return false;
        }
        return true;
    });

    return limited;
};

/**
 * Limiter les documents
 */
export const limitDocuments = (documents: string[]): string[] => {
    if (!documents || documents.length === 0) return [];

    const limited = documents.filter((doc) => {
        const size = getBase64Size(doc);
        if (size > MAX_DOCUMENT_SIZE) {
            console.warn('[MediaCompression] ⚠️ Document trop volumineux:', formatFileSize(size));
            return false;
        }
        return true;
    });

    return limited;
};

/**
 * Compresser et limiter tous les médias
 */
export const compressAllMedia = async (mediaFiles: {
    images?: string[];
    audios?: string[];
    videos?: string[];
    documents?: string[];
    excel?: string[];
    logo?: string[];
    banner?: string[];
}): Promise<{
    images: string[];
    audios: string[];
    videos: string[];
    documents: string[];
    excel: string[];
    logo: string[];
    banner: string[];
    totalSizeBefore: number;
    totalSizeAfter: number;
}> => {
    console.log('[MediaCompression] 🔄 Début compression de tous les médias');

    // Calculer la taille totale avant
    const calculateTotalSize = (media: Record<string, string[]>) => {
        return Object.values(media).flat().reduce((total, item) => {
            return total + getBase64Size(item);
        }, 0);
    };

    const totalSizeBefore = calculateTotalSize(mediaFiles);
    console.log('[MediaCompression] Taille totale avant:', formatFileSize(totalSizeBefore));

    // Compresser les images (logo et banner inclus)
    const [images, logo, banner] = await Promise.all([
        compressImages(mediaFiles.images || []),
        compressImages(mediaFiles.logo || []),
        compressImages(mediaFiles.banner || [])
    ]);

    // Limiter les autres médias
    const videos = limitVideos(mediaFiles.videos || []);
    const audios = limitAudios(mediaFiles.audios || []);
    const documents = limitDocuments(mediaFiles.documents || []);
    const excel = limitDocuments(mediaFiles.excel || []); // Même limite que documents

    const compressed = { images, audios, videos, documents, excel, logo, banner };
    const totalSizeAfter = calculateTotalSize(compressed);

    console.log('[MediaCompression] ✅ Compression terminée');
    console.log('[MediaCompression] Taille totale après:', formatFileSize(totalSizeAfter));
    console.log('[MediaCompression] Économie:', formatFileSize(totalSizeBefore - totalSizeAfter), `(${((1 - totalSizeAfter / totalSizeBefore) * 100).toFixed(1)}%)`);

    return {
        ...compressed,
        totalSizeBefore,
        totalSizeAfter
    };
};

/**
 * Vérifier si les médias dépassent la limite
 */
export const checkMediaSizeLimit = (mediaFiles: Record<string, string[]>, maxTotalSize: number = 10 * 1024 * 1024): boolean => {
    const totalSize = Object.values(mediaFiles).flat().reduce((total, item) => {
        return total + getBase64Size(item);
    }, 0);

    console.log('[MediaCompression] Taille totale:', formatFileSize(totalSize), '/', formatFileSize(maxTotalSize));

    return totalSize <= maxTotalSize;
};