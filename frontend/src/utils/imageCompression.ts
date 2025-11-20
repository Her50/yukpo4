/**
 * Utilitaires de compression d'images pour les photos de colis
 */

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.8; // 80% de qualité

interface CompressionResult {
    compressedBase64: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
}

/**
 * Compresser une image File en base64
 */
export const compressImageFile = async (file: File): Promise<CompressionResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            compressImageBase64(base64)
                .then(resolve)
                .catch(reject);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Compresser une image base64
 */
export const compressImageBase64 = async (base64: string): Promise<CompressionResult> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                // Calculer les nouvelles dimensions
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                // Créer un canvas pour redimensionner et compresser
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Impossible de créer le contexte canvas'));
                    return;
                }

                // Dessiner l'image redimensionnée
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir en base64 avec compression
                const compressedBase64 = canvas.toDataURL('image/jpeg', QUALITY);

                // Calculer les tailles
                const originalSize = getBase64Size(base64);
                const compressedSize = getBase64Size(compressedBase64);
                const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

                resolve({
                    compressedBase64,
                    originalSize,
                    compressedSize,
                    compressionRatio,
                });
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image'));
        img.src = base64;
    });
};

/**
 * Obtenir la taille d'une chaîne base64 en bytes
 */
const getBase64Size = (base64: string): number => {
    // Retirer le préfixe data:image/...;base64,
    const base64Data = base64.split(',')[1] || base64;
    // Calculer la taille : chaque caractère base64 = 6 bits, mais padding peut réduire
    return (base64Data.length * 3) / 4;
};

/**
 * Compresser plusieurs images
 */
export const compressImages = async (files: File[]): Promise<CompressionResult[]> => {
    return Promise.all(files.map(compressImageFile));
};

/**
 * Formater la taille en format lisible
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

