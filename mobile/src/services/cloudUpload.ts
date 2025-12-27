/**
 * Service de téléchargement de fichiers vers le cloud
 * Supporte images, vidéos, documents, audio, etc.
 */

import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config/api.config';
import SafeStorage from '../utils/safeStorage';

// ✅ CORRIGÉ: Utilise la configuration centralisée depuis .env

export interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export interface UploadResult {
    success: boolean;
    url?: string;
    cloudinaryUrl?: string;
    error?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
}

/**
 * Télécharge un fichier vers le cloud (Cloudinary via l'API backend)
 * @param fileUri URI local du fichier (peut être base64 ou file://)
 * @param fileType Type de fichier ('image', 'video', 'document', 'audio', etc.)
 * @param fileName Nom du fichier (optionnel)
 * @param onProgress Callback pour suivre la progression
 * @returns Résultat de l'upload avec l'URL du fichier
 */
export const uploadToCloud = async (
    fileUri: string,
    fileType: 'image' | 'video' | 'document' | 'audio' | 'excel' | 'logo' | 'banner',
    fileName?: string,
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
    try {
        console.log('[CloudUpload] Début upload:', { fileType, fileName });

        // Déterminer le type MIME
        const mimeType = getMimeType(fileType, fileName);

        // ✅ CORRECTION CRITIQUE: Pour les gros fichiers (surtout vidéos), utiliser FormData direct
        // au lieu de charger tout en base64 en mémoire (évite OutOfMemoryError)
        const formData = new FormData();

        // Vérifier si c'est un fichier volumineux (vidéo ou fichier > 10MB)
        let useDirectUpload = false;
        let fileSize = 0;

        if (fileUri.startsWith('file://')) {
            // Obtenir la taille du fichier
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (fileInfo.exists && 'size' in fileInfo) {
                fileSize = fileInfo.size;
                // Pour les vidéos ou fichiers > 10MB, utiliser upload direct
                useDirectUpload = fileType === 'video' || fileSize > 10 * 1024 * 1024;
            }
        }

        if (useDirectUpload && fileUri.startsWith('file://')) {
            // ✅ Upload direct via FormData (React Native compatible)
            // Pour React Native, on utilise l'URI file:// directement dans FormData
            console.log('[CloudUpload] 📤 Upload direct (FormData) pour fichier volumineux:', formatFileSize(fileSize));
            
            // En React Native, FormData accepte les objets avec uri, type, name
            formData.append('file', {
                uri: fileUri,
                type: mimeType,
                name: fileName || `file_${Date.now()}.${getExtension(mimeType)}`
            } as any);
            formData.append('type', fileType);
        } else {
            // ✅ Pour les petits fichiers, utiliser base64 (comportement existant)
            let base64Data: string;

            if (fileUri.startsWith('data:')) {
                // Déjà en base64
                base64Data = fileUri.split(',')[1];
            } else if (fileUri.startsWith('file://')) {
                // Lire le fichier depuis le système de fichiers
                base64Data = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: FileSystem.EncodingType.Base64
                });
            } else {
                // Assume que c'est déjà du base64 pur
                base64Data = fileUri;
            }

            // Calculer la taille approximative
            fileSize = Math.ceil((base64Data.length * 3) / 4);
            console.log('[CloudUpload] Taille fichier:', formatFileSize(fileSize));

            // Vérifier la taille (limite 10MB pour la plupart des fichiers, sauf vidéos)
            if (fileType !== 'video') {
                const maxSize = 10 * 1024 * 1024;
                if (fileSize > maxSize) {
                    return {
                        success: false,
                        error: `Fichier trop volumineux (max ${formatFileSize(maxSize)})`
                    };
                }
            }

            // Créer un blob depuis le base64
            const blob = base64ToBlob(base64Data, mimeType);
            const file = new File([blob], fileName || `file_${Date.now()}.${getExtension(mimeType)}`, {
                type: mimeType
            });

            formData.append('file', file);
            formData.append('type', fileType);
        }

        // Upload vers l'API
        const uploadUrl = `${API_BASE_URL}/api/upload`;

        // ✅ CORRIGÉ 2025-12-27: Récupérer le token d'authentification
        const token = await SafeStorage.getItem('auth_token');
        const isDevMode = await SafeStorage.getItem('__DEV_FAKE_USER__') === 'true';

        // Préparer les headers
        const headers: any = {};
        
        // Ajouter le token d'autorisation si disponible
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        } else if (isDevMode) {
            // En mode dev, utiliser un token JWT de développement
            console.warn('[CloudUpload] 🧪 Mode développement : aucun token trouvé');
        } else {
            console.warn('[CloudUpload] ⚠️ Aucun token d\'authentification trouvé');
        }

        // Ne pas définir Content-Type pour FormData, le navigateur le fera avec boundary

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[CloudUpload] Erreur serveur:', errorText);
            return {
                success: false,
                error: `Erreur serveur: ${response.status}`
            };
        }

        const result = await response.json();

        if (result.success && result.url) {
            console.log('[CloudUpload] Upload réussi:', result.url);
            return {
                success: true,
                url: result.url,
                cloudinaryUrl: result.cloudinaryUrl || result.url,
                fileName: fileName,
                fileSize: fileSize,
                mimeType: mimeType
            };
        } else {
            return {
                success: false,
                error: result.error || 'Erreur inconnue'
            };
        }

    } catch (error: any) {
        console.error('[CloudUpload] Erreur upload:', error);
        return {
            success: false,
            error: error.message || 'Erreur lors du téléchargement'
        };
    }
};

/**
 * Upload multiple fichiers en parallèle
 * @param files Tableau de fichiers à uploader
 * @param fileType Type de fichiers
 * @param onProgress Callback pour suivre la progression globale
 * @returns Tableau de résultats
 */
export const uploadMultipleToCloud = async (
    files: Array<{ uri: string; name?: string }>,
    fileType: 'image' | 'video' | 'document' | 'audio' | 'excel' | 'logo' | 'banner',
    onProgress?: (completed: number, total: number) => void
): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    let completed = 0;

    for (const file of files) {
        const result = await uploadToCloud(file.uri, fileType, file.name);
        results.push(result);
        completed++;

        if (onProgress) {
            onProgress(completed, files.length);
        }
    }

    return results;
};

/**
 * Convertit base64 en Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

/**
 * Détermine le type MIME basé sur le type de fichier
 */
function getMimeType(fileType: string, fileName?: string): string {
    if (fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'jpg':
            case 'jpeg':
                return 'image/jpeg';
            case 'png':
                return 'image/png';
            case 'gif':
                return 'image/gif';
            case 'webp':
                return 'image/webp';
            case 'mp4':
                return 'video/mp4';
            case 'mov':
                return 'video/quicktime';
            case 'pdf':
                return 'application/pdf';
            case 'doc':
                return 'application/msword';
            case 'docx':
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case 'xls':
                return 'application/vnd.ms-excel';
            case 'xlsx':
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            case 'csv':
                return 'text/csv';
            case 'mp3':
                return 'audio/mpeg';
            case 'm4a':
                return 'audio/mp4';
        }
    }

    // Fallback basé sur le type
    switch (fileType) {
        case 'image':
        case 'logo':
        case 'banner':
            return 'image/jpeg';
        case 'video':
            return 'video/mp4';
        case 'audio':
            return 'audio/mpeg';
        case 'excel':
            return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'document':
        default:
            return 'application/pdf';
    }
}

/**
 * Obtient l'extension de fichier depuis le type MIME
 */
function getExtension(mimeType: string): string {
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'text/csv': 'csv',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a'
    };

    return map[mimeType] || 'bin';
}

/**
 * Formate la taille d'un fichier en format lisible
 */
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Vérifie si un fichier peut être uploadé (taille, type, etc.)
 */
export const canUploadFile = (
    fileSize: number,
    fileType: string
): { canUpload: boolean; error?: string } => {
    const maxSizes: Record<string, number> = {
        image: 10 * 1024 * 1024, // 10 MB
        // ✅ PHASE 10: Suppression de la contrainte vidéo (pas de limite)
        video: Infinity, // Plus de limite pour les vidéos
        document: 10 * 1024 * 1024, // 10 MB
        audio: 10 * 1024 * 1024, // 10 MB
        excel: 5 * 1024 * 1024, // 5 MB
        logo: 5 * 1024 * 1024, // 5 MB
        banner: 5 * 1024 * 1024 // 5 MB
    };

    const maxSize = maxSizes[fileType] || 10 * 1024 * 1024;

    // ✅ PHASE 10: Ne pas bloquer les vidéos même si très volumineuses
    if (fileType === 'video') {
        return { canUpload: true };
    }

    if (fileSize > maxSize) {
        return {
            canUpload: false,
            error: `Fichier trop volumineux (max ${formatFileSize(maxSize)})`
        };
    }

    return { canUpload: true };
};

