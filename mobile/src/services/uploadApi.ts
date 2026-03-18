// src/services/uploadApi.ts
// Service d'upload préalable de fichiers (avant création de service)

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { config } from '../config/environment';
import SafeStorage from '../utils/safeStorage';

export interface UploadedFile {
    url: string;
    media_type: string;
    size_bytes: number;
    media_id?: number;
}

export interface UploadResponse {
    success: boolean;
    files: UploadedFile[];
    message?: string;
}

/**
 * ✅ NOUVEAU: Upload préalable de fichiers (OPTIMISÉ - TOUS LES FICHIERS EN UNE SEULE REQUÊTE)
 * Le backend accepte plusieurs fichiers dans un multipart, donc on envoie tout en une fois
 * @param files Array de File objects ou URI React Native
 * @returns URLs des fichiers uploadés
 */
export const uploadFiles = async (files: Array<{ uri: string; type: string; name?: string }>): Promise<UploadedFile[]> => {
    console.log('[uploadApi] \uD83D\uDCE4 Upload préalable de', files.length, 'fichier(s)');

    if (files.length === 0) {
        return [];
    }

    try {
        // Récupérer le token
        const token = await SafeStorage.getItem('auth_token');
        const API_BASE_URL = config.API_BASE_URL;

        // ✅ OPTIMISATION: Créer UN SEUL FormData avec TOUS les fichiers
        // Le backend accepte plusieurs fichiers dans un multipart (media_controller.rs ligne 131)
        const formData = new FormData();

        // Ajouter tous les fichiers au FormData
        files.forEach((file, index) => {
            const fieldName = file.type.startsWith('image/') ? 'image' :
                file.type.startsWith('video/') ? 'video' :
                    file.type.startsWith('audio/') ? 'audio' : 'file';

            formData.append(fieldName, {
                uri: file.uri,
                type: file.type,
                name: file.name || `file_${index}.${file.type.split('/')[1] || 'bin'}`,
            } as any);
        });

        console.log('[uploadApi] \uD83D\uDCE6 Envoi de tous les fichiers en une seule requête...');

        // ✅ ENVOI UNIQUE: Tous les fichiers en une seule requête (beaucoup plus rapide)
        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
                'Accept': 'application/json',
                // Ne pas définir Content-Type pour FormData (React Native le fait automatiquement)
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(errorData.error || `Upload failed: ${response.status}`);
        }

        const data: UploadResponse = await response.json();

        if (!data.success || !data.files) {
            throw new Error(data.message || 'Erreur lors de l\'upload');
        }

        console.log('[uploadApi] ✅ Tous les fichiers uploadés en une seule requête:', data.files.length);
        return data.files;
    } catch (error: any) {
        console.error('[uploadApi] ❌ Erreur upload:', error);
        throw error;
    }
};

/**
 * Upload d'une image unique
 */
export const uploadImage = async (uri: string, type: string = 'image/jpeg'): Promise<UploadedFile> => {
    const files = await uploadFiles([{ uri, type }]);
    return files[0];
};

/**
 * Upload de plusieurs images
 */
export const uploadImages = async (images: Array<{ uri: string; type?: string }>): Promise<UploadedFile[]> => {
    return uploadFiles(images.map(img => ({
        uri: img.uri,
        type: img.type || 'image/jpeg',
    })));
};

