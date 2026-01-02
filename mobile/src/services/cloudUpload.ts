/**
 * Service de téléchargement de fichiers vers le cloud
 * Supporte images, vidéos, documents, audio, etc.
 */

import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config/api.config';
import SafeStorage from '../utils/safeStorage';

// ✅ CORRIGÉ: Utilise la configuration centralisée depuis .env

// Fonction pour récupérer le token d'authentification
const getAuthToken = async (): Promise<string | null> => {
    try {
        return await SafeStorage.getItem('auth_token');
    } catch (error) {
        console.error('[CloudUpload] Erreur récupération token:', error);
        return null;
    }
};

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

        // ✅ CORRIGÉ 2025-12-28: Ajouter le header Authorization
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        // Ne pas définir Content-Type pour FormData, le navigateur le fera avec boundary

        console.log('[CloudUpload] 📤 Envoi upload:', {
            url: uploadUrl,
            fileType,
            fileName,
            useDirectUpload,
            hasToken: !!token,
            fileSize: formatFileSize(fileSize)
        });

        // ✅ AMÉLIORÉ: Gestion d'erreur réseau avec timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes pour les vidéos volumineuses

        let response: Response;
        try {
            response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            
            // Détecter le type d'erreur
            if (fetchError.name === 'AbortError') {
                console.error('[CloudUpload] ❌ Timeout upload (5 minutes dépassés)');
                return {
                    success: false,
                    error: 'Le téléchargement a pris trop de temps. Vérifiez votre connexion internet et réessayez avec un fichier plus petit.'
                };
            }
            
            if (fetchError.message && fetchError.message.includes('Network request failed')) {
                console.error('[CloudUpload] ❌ Erreur réseau:', fetchError);
                return {
                    success: false,
                    error: 'Erreur de connexion réseau. Vérifiez votre connexion internet et réessayez.'
                };
            }
            
            // Autre erreur
            console.error('[CloudUpload] ❌ Erreur fetch:', fetchError);
            return {
                success: false,
                error: fetchError.message || 'Erreur lors du téléchargement. Veuillez réessayer.'
            };
        }

        if (!response.ok) {
            let errorText = '';
            try {
                errorText = await response.text();
            } catch (e) {
                console.warn('[CloudUpload] Impossible de lire le message d\'erreur');
            }
            
            console.error('[CloudUpload] Erreur serveur:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 200) // Limiter la taille
            });
            
            let errorMessage = `Erreur serveur (${response.status})`;
            if (response.status === 413) {
                errorMessage = 'Fichier trop volumineux pour le serveur. Veuillez réduire la taille.';
            } else if (response.status === 500) {
                errorMessage = 'Erreur serveur interne. Veuillez réessayer plus tard.';
            } else if (response.status === 401 || response.status === 403) {
                errorMessage = 'Vous n\'êtes pas autorisé. Veuillez vous reconnecter.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }

        const result = await response.json();

        // ✅ CORRIGÉ: L'API retourne { success: true, files: [{ url: "...", ... }] }
        if (result.success && result.files && Array.isArray(result.files) && result.files.length > 0) {
            const uploadedFile = result.files[0];
            console.log('[CloudUpload] Upload réussi:', uploadedFile.url);
            return {
                success: true,
                url: uploadedFile.url,
                cloudinaryUrl: uploadedFile.url, // L'URL retournée est déjà l'URL publique
                fileName: fileName,
                fileSize: uploadedFile.size_bytes || fileSize,
                mimeType: mimeType
            };
        } else {
            // ✅ CORRIGÉ: Message d'erreur plus détaillé
            const errorMessage = result.message || result.error || 
                (result.files && result.files.length === 0 ? 'Aucun fichier uploadé' : 'Erreur inconnue');
            console.error('[CloudUpload] Erreur upload:', {
                success: result.success,
                files: result.files,
                message: result.message,
                error: result.error
            });
            return {
                success: false,
                error: errorMessage
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

