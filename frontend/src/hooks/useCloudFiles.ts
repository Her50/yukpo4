/**
 * Hook React pour gérer les fichiers cloud (CDN)
 * Adapté depuis mobile/src/hooks/useCloudFiles.ts
 * 
 * Fonctionnalités:
 * - Upload fichiers vers CDN
 * - Gestion état upload (loading, progress, errors)
 * - Retry automatique
 * - Cache des URLs CDN
 */

import { useState, useCallback } from 'react';
import { cloudUploadService, UploadResult, UploadProgress, FileType } from '@/services/cloudUploadService';

export interface CloudFile {
    id: string;
    file: File | string; // File object ou base64 string
    fileName?: string;
    fileType: FileType;
    url?: string; // URL CDN après upload
    uploading: boolean;
    progress: number; // 0-100
    error?: string;
    uploaded: boolean;
}

export interface UseCloudFilesReturn {
    files: CloudFile[];
    uploadFile: (file: File | string, fileType: FileType, fileName?: string) => Promise<string | null>;
    uploadMultiple: (files: Array<{ file: File | string; name?: string }>, fileType: FileType) => Promise<string[]>;
    removeFile: (id: string) => void;
    clearFiles: () => void;
    isUploading: boolean;
    hasErrors: boolean;
}

export const useCloudFiles = (): UseCloudFilesReturn => {
    const [files, setFiles] = useState<CloudFile[]>([]);

    /**
     * Upload un fichier vers le CDN
     */
    const uploadFile = useCallback(async (
        file: File | string,
        fileType: FileType,
        fileName?: string
    ): Promise<string | null> => {
        const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Créer l'entrée de fichier
        const cloudFile: CloudFile = {
            id,
            file,
            fileName: fileName || (file instanceof File ? file.name : undefined),
            fileType,
            uploading: true,
            progress: 0,
            uploaded: false,
        };

        setFiles(prev => [...prev, cloudFile]);

        try {
            // Vérifier si le fichier peut être uploadé
            const fileSize = file instanceof File ? file.size : Math.ceil((file.length * 3) / 4);
            const canUpload = cloudUploadService.canUploadFile(fileSize, fileType);
            
            if (!canUpload.canUpload) {
                setFiles(prev => prev.map(f => 
                    f.id === id 
                        ? { ...f, uploading: false, error: canUpload.error }
                        : f
                ));
                return null;
            }

            // Upload avec progression
            const result = await cloudUploadService.uploadToCloud(
                file,
                fileType,
                fileName,
                (progress: UploadProgress) => {
                    setFiles(prev => prev.map(f => 
                        f.id === id 
                            ? { ...f, progress: progress.percentage }
                            : f
                    ));
                }
            );

            if (result.success && result.url) {
                setFiles(prev => prev.map(f => 
                    f.id === id 
                        ? { 
                            ...f, 
                            uploading: false, 
                            uploaded: true, 
                            url: result.url,
                            progress: 100
                        }
                        : f
                ));
                return result.url;
            } else {
                setFiles(prev => prev.map(f => 
                    f.id === id 
                        ? { 
                            ...f, 
                            uploading: false, 
                            error: result.error || 'Erreur upload inconnue'
                        }
                        : f
                ));
                return null;
            }
        } catch (error: any) {
            setFiles(prev => prev.map(f => 
                f.id === id 
                    ? { 
                        ...f, 
                        uploading: false, 
                        error: error.message || 'Erreur upload'
                    }
                    : f
            ));
            return null;
        }
    }, []);

    /**
     * Upload multiple fichiers
     */
    const uploadMultiple = useCallback(async (
        filesToUpload: Array<{ file: File | string; name?: string }>,
        fileType: FileType
    ): Promise<string[]> => {
        const uploadedUrls: string[] = [];
        
        for (const fileData of filesToUpload) {
            const url = await uploadFile(fileData.file, fileType, fileData.name);
            if (url) {
                uploadedUrls.push(url);
            }
        }
        
        return uploadedUrls;
    }, [uploadFile]);

    /**
     * Supprimer un fichier de la liste
     */
    const removeFile = useCallback((id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    }, []);

    /**
     * Vider la liste de fichiers
     */
    const clearFiles = useCallback(() => {
        setFiles([]);
    }, []);

    // États calculés
    const isUploading = files.some(f => f.uploading);
    const hasErrors = files.some(f => f.error);

    return {
        files,
        uploadFile,
        uploadMultiple,
        removeFile,
        clearFiles,
        isUploading,
        hasErrors,
    };
};




