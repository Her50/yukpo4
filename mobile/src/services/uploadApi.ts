// src/services/uploadApi.ts
// Service d'upload préalable de fichiers (avant création de service)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config/environment';

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
 * ✅ NOUVEAU: Upload préalable de fichiers
 * @param files Array de File objects ou URI React Native
 * @returns URLs des fichiers uploadés
 */
export const uploadFiles = async (files: Array<{ uri: string; type: string; name?: string }>): Promise<UploadedFile[]> => {
    console.log('[uploadApi] 📤 Upload préalable de', files.length, 'fichier(s)');

    // Créer FormData
    const formData = new FormData();

    // Ajouter les fichiers au FormData
    files.forEach((file, index) => {
        const fieldName = file.type.startsWith('image/') ? 'image' :
            file.type.startsWith('video/') ? 'video' :
                file.type.startsWith('audio/') ? 'audio' : 'file';

        formData.append(fieldName, {
            uri: file.uri,
            type: file.type,
            name: file.name || `file_${index}.${file.type.split('/')[1]}`,
        } as any);
    });

    try {
        // Récupérer le token
        const token = await AsyncStorage.getItem('auth_token');

        // Utiliser fetch directement pour FormData (apiCall ne gère pas bien FormData)
        const API_BASE_URL = config.API_BASE_URL;

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
                'Accept': 'application/json',
                // Ne pas définir Content-Type pour FormData (le navigateur le fait automatiquement)
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

        console.log('[uploadApi] ✅ Fichiers uploadés:', data.files.length);
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

