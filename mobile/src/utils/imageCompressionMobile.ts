/**
 * Utilitaires de compression d'images pour React Native
 * Utilise expo-image-manipulator pour une compression de qualité
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { formatFileSize, getBase64Size } from './mediaCompression';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.8; // 80% de qualité

export interface CompressionResult {
    compressedBase64: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
}

/**
 * Compresser une image depuis une URI (file:// ou data:)
 */
export const compressImageFromUri = async (uri: string): Promise<CompressionResult> => {
    try {
        // Obtenir la taille originale
        const originalSize = getBase64Size(uri);

        // Charger et manipuler l'image
        const manipResult = await ImageManipulator.manipulateAsync(
            uri,
            [
                // Redimensionner si nécessaire
                { resize: { width: MAX_WIDTH, height: MAX_HEIGHT } },
            ],
            {
                compress: QUALITY,
                format: ImageManipulator.SaveFormat.JPEG,
                base64: true,
            }
        );

        if (!manipResult.base64) {
            throw new Error('Impossible d\'obtenir le base64 de l\'image compressée');
        }

        // Construire le data URI
        const compressedBase64 = `data:image/jpeg;base64,${manipResult.base64}`;
        const compressedSize = getBase64Size(compressedBase64);
        const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

        console.log(`[ImageCompression] Compression: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${compressionRatio.toFixed(1)}% réduit)`);

        return {
            compressedBase64,
            originalSize,
            compressedSize,
            compressionRatio,
        };
    } catch (error) {
        console.error('[ImageCompression] Erreur compression:', error);
        // Retourner l'original en cas d'erreur
        const originalSize = getBase64Size(uri);
        return {
            compressedBase64: uri,
            originalSize,
            compressedSize: originalSize,
            compressionRatio: 0,
        };
    }
};

/**
 * Compresser plusieurs images
 */
export const compressImagesFromUris = async (uris: string[]): Promise<CompressionResult[]> => {
    return Promise.all(uris.map(compressImageFromUri));
};

