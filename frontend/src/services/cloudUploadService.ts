/**
 * Service de téléchargement de fichiers vers le cloud (CDN) pour le frontend web
 * Adapté depuis mobile/src/services/cloudUpload.ts
 * 
 * Fonctionnalités:
 * - Upload vers CDN (S3/Wasabi) via API backend
 * - Support progression upload
 * - Retry logic pour erreurs réseau
 * - Gestion fichiers volumineux (FormData direct)
 * - URLs CDN automatiques
 */

export interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export interface UploadResult {
    success: boolean;
    url?: string; // URL CDN publique
    cloudinaryUrl?: string; // Alias pour compatibilité
    error?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    path?: string; // Chemin de stockage
}

export type FileType = 'image' | 'video' | 'document' | 'audio' | 'excel' | 'logo' | 'banner';

class CloudUploadService {
    private baseUrl: string;
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // 1 seconde

    constructor() {
        this.baseUrl = '/api/upload';
    }

    /**
     * Détermine le type MIME basé sur le type de fichier
     */
    private getMimeType(fileType: FileType, fileName?: string): string {
        if (fileName) {
            const ext = fileName.split('.').pop()?.toLowerCase();
            const mimeMap: Record<string, string> = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'mp4': 'video/mp4',
                'mov': 'video/quicktime',
                'pdf': 'application/pdf',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'csv': 'text/csv',
                'mp3': 'audio/mpeg',
                'm4a': 'audio/mp4',
                'wav': 'audio/wav',
            };
            if (ext && mimeMap[ext]) {
                return mimeMap[ext];
            }
        }

        // Fallback basé sur le type
        const typeMap: Record<FileType, string> = {
            'image': 'image/jpeg',
            'logo': 'image/jpeg',
            'banner': 'image/jpeg',
            'video': 'video/mp4',
            'audio': 'audio/mpeg',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'document': 'application/pdf',
        };
        return typeMap[fileType] || 'application/octet-stream';
    }

    /**
     * Obtient l'extension de fichier depuis le type MIME
     */
    private getExtension(mimeType: string): string {
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
            'audio/mp4': 'm4a',
            'audio/wav': 'wav',
        };
        return map[mimeType] || 'bin';
    }

    /**
     * Formate la taille d'un fichier en format lisible
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Convertit base64 en Blob
     */
    private base64ToBlob(base64: string, mimeType: string): Blob {
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    /**
     * Retry logic avec délai exponentiel
     */
    private async retry<T>(
        fn: () => Promise<T>,
        retries: number = this.maxRetries,
        delay: number = this.retryDelay
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            if (retries <= 0) {
                throw error;
            }
            console.log(`[CloudUploadService] ⚠️ Erreur, retry dans ${delay}ms (${retries} tentatives restantes)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retry(fn, retries - 1, delay * 2); // Délai exponentiel
        }
    }

    /**
     * Télécharge un fichier vers le cloud (CDN) via l'API backend
     * @param file File object ou base64 string
     * @param fileType Type de fichier
     * @param fileName Nom du fichier (optionnel)
     * @param onProgress Callback pour suivre la progression
     * @returns Résultat de l'upload avec l'URL CDN
     */
    async uploadToCloud(
        file: File | string, // File object ou base64 string
        fileType: FileType,
        fileName?: string,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<UploadResult> {
        try {
            console.log('[CloudUploadService] 📤 Début upload:', { fileType, fileName });

            const mimeType = this.getMimeType(fileType, fileName);
            const formData = new FormData();
            let fileSize = 0;

            // Gérer File object ou base64 string
            if (file instanceof File) {
                fileSize = file.size;
                formData.append('file', file);
                formData.append('type', fileType);
            } else {
                // Base64 string
                const base64Data = file.includes(',') ? file.split(',')[1] : file;
                fileSize = Math.ceil((base64Data.length * 3) / 4);
                
                // Créer un blob depuis le base64
                const blob = this.base64ToBlob(file, mimeType);
                const finalFileName = fileName || `file_${Date.now()}.${this.getExtension(mimeType)}`;
                const fileObj = new File([blob], finalFileName, { type: mimeType });
                
                formData.append('file', fileObj);
                formData.append('type', fileType);
            }

            console.log('[CloudUploadService] Taille fichier:', this.formatFileSize(fileSize));

            // Vérifier la taille (limite 10MB pour la plupart des fichiers, sauf vidéos)
            if (fileType !== 'video' && fileSize > 10 * 1024 * 1024) {
                return {
                    success: false,
                    error: `Fichier trop volumineux (max ${this.formatFileSize(10 * 1024 * 1024)})`
                };
            }

            // Upload avec retry logic
            const result = await this.retry(async () => {
                const token = localStorage.getItem('token');
                const headers: HeadersInit = {};
                
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                // Utiliser XMLHttpRequest pour suivre la progression
                return new Promise<UploadResult>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();

                    // Suivre la progression
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable && onProgress) {
                            onProgress({
                                loaded: e.loaded,
                                total: e.total,
                                percentage: (e.loaded / e.total) * 100
                            });
                        }
                    });

                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const result = JSON.parse(xhr.responseText);
                                if (result.success && result.url) {
                                    console.log('[CloudUploadService] ✅ Upload réussi:', result.url);
                                    resolve({
                                        success: true,
                                        url: result.url,
                                        cloudinaryUrl: result.cloudinaryUrl || result.url,
                                        fileName: fileName,
                                        fileSize: fileSize,
                                        mimeType: mimeType,
                                        path: result.path
                                    });
                                } else {
                                    reject(new Error(result.error || 'Erreur inconnue'));
                                }
                            } catch (e) {
                                reject(new Error('Erreur parsing réponse'));
                            }
                        } else {
                            reject(new Error(`Erreur HTTP: ${xhr.status}`));
                        }
                    });

                    xhr.addEventListener('error', () => {
                        reject(new Error('Erreur réseau'));
                    });

                    xhr.addEventListener('abort', () => {
                        reject(new Error('Upload annulé'));
                    });

                    xhr.open('POST', this.baseUrl);
                    Object.entries(headers).forEach(([key, value]) => {
                        xhr.setRequestHeader(key, value);
                    });
                    xhr.send(formData);
                });
            });

            return result;
        } catch (error: any) {
            console.error('[CloudUploadService] ❌ Erreur upload:', error);
            return {
                success: false,
                error: error.message || 'Erreur lors du téléchargement'
            };
        }
    }

    /**
     * Upload multiple fichiers en parallèle
     * @param files Tableau de fichiers à uploader
     * @param fileType Type de fichiers
     * @param onProgress Callback pour suivre la progression globale
     * @returns Tableau de résultats
     */
    async uploadMultipleToCloud(
        files: Array<{ file: File | string; name?: string }>,
        fileType: FileType,
        onProgress?: (completed: number, total: number) => void
    ): Promise<UploadResult[]> {
        const results: UploadResult[] = [];
        let completed = 0;

        // Upload en parallèle (max 3 simultanés pour éviter surcharge)
        const maxConcurrent = 3;
        const chunks: Array<Array<{ file: File | string; name?: string }>> = [];
        
        for (let i = 0; i < files.length; i += maxConcurrent) {
            chunks.push(files.slice(i, i + maxConcurrent));
        }

        for (const chunk of chunks) {
            const chunkResults = await Promise.all(
                chunk.map(async (file) => {
                    const result = await this.uploadToCloud(file.file, fileType, file.name);
                    completed++;
                    if (onProgress) {
                        onProgress(completed, files.length);
                    }
                    return result;
                })
            );
            results.push(...chunkResults);
        }

        return results;
    }

    /**
     * Vérifie si un fichier peut être uploadé (taille, type, etc.)
     */
    canUploadFile(fileSize: number, fileType: FileType): { canUpload: boolean; error?: string } {
        const maxSizes: Record<FileType, number> = {
            image: 10 * 1024 * 1024, // 10 MB
            video: Infinity, // Pas de limite pour les vidéos
            document: 10 * 1024 * 1024, // 10 MB
            audio: 10 * 1024 * 1024, // 10 MB
            excel: 5 * 1024 * 1024, // 5 MB
            logo: 5 * 1024 * 1024, // 5 MB
            banner: 5 * 1024 * 1024 // 5 MB
        };

        const maxSize = maxSizes[fileType] || 10 * 1024 * 1024;

        // Ne pas bloquer les vidéos même si très volumineuses
        if (fileType === 'video') {
            return { canUpload: true };
        }

        if (fileSize > maxSize) {
            return {
                canUpload: false,
                error: `Fichier trop volumineux (max ${this.formatFileSize(maxSize)})`
            };
        }

        return { canUpload: true };
    }
}

export const cloudUploadService = new CloudUploadService();



