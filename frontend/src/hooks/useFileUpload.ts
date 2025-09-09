import { useState, useCallback, useMemo } from 'react';

export interface UploadedFile {
  name: string;
  data: string;
  type: string;
  size: number;
  id: string;
}

interface UseFileUploadOptions {
  maxFileSize?: number; // en bytes
  maxFiles?: number;
  allowedTypes?: string[];
  onError?: (error: string) => void;
}

interface UseFileUploadReturn {
  files: UploadedFile[];
  addFiles: (newFiles: File[]) => Promise<void>;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  totalSize: number;
  fileCount: number;
  isLoading: boolean;
  errors: string[];
}

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (augmenté de 10MB)
const DEFAULT_MAX_FILES = 10;

export const useFileUpload = (options: UseFileUploadOptions = {}): UseFileUploadReturn => {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxFiles = DEFAULT_MAX_FILES,
    allowedTypes = [],
    onError
  } = options;

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Fonction utilitaire pour convertir File en UploadedFile
  const fileToUploadedFile = useCallback(async (file: File): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const uploadedFile: UploadedFile = {
          name: file.name,
          data: reader.result as string,
          type: file.type,
          size: file.size,
          id: `${file.name}-${Date.now()}-${Math.random()}`
        };
        resolve(uploadedFile);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Validation des fichiers
  const validateFile = useCallback((file: File): string | null => {
    // Vérifier la taille
    if (file.size > maxFileSize) {
      return `Le fichier ${file.name} est trop volumineux (max: ${Math.round(maxFileSize / 1024 / 1024)}MB)`;
    }

    // Vérifier le type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return `Le type de fichier ${file.type} n'est pas autorisé`;
    }

    return null;
  }, [maxFileSize, allowedTypes]);

  // Ajouter des fichiers
  const addFiles = useCallback(async (newFiles: File[]) => {
    setIsLoading(true);
    setErrors([]);

    try {
      const validFiles: File[] = [];
      const newErrors: string[] = [];

      // Validation des fichiers
      for (const file of newFiles) {
        const error = validateFile(file);
        if (error) {
          newErrors.push(error);
          onError?.(error);
        } else {
          validFiles.push(file);
        }
      }

      // Vérifier le nombre maximum de fichiers
      if (files.length + validFiles.length > maxFiles) {
        const error = `Nombre maximum de fichiers dépassé (max: ${maxFiles})`;
        newErrors.push(error);
        onError?.(error);
      }

      if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
      }

      // Convertir les fichiers valides
      const uploadedFiles = await Promise.all(
        validFiles.map(fileToUploadedFile)
      );

      setFiles(prev => [...prev, ...uploadedFiles]);
    } catch (error) {
      const errorMessage = `Erreur lors de l'upload: ${error}`;
      setErrors(prev => [...prev, errorMessage]);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [files.length, maxFiles, validateFile, fileToUploadedFile, onError]);

  // Supprimer un fichier
  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  }, []);

  // Vider tous les fichiers
  const clearFiles = useCallback(() => {
    setFiles([]);
    setErrors([]);
  }, []);

  // Calculs memoïsés
  const totalSize = useMemo(() => {
    return files.reduce((total, file) => total + file.size, 0);
  }, [files]);

  const fileCount = useMemo(() => files.length, [files]);

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    totalSize,
    fileCount,
    isLoading,
    errors
  };
};

// Hook spécialisé pour les images
export const useImageUpload = (options: Omit<UseFileUploadOptions, 'allowedTypes'> = {}) => {
  return useFileUpload({
    ...options,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  });
};

// Hook spécialisé pour les documents
export const useDocumentUpload = (options: Omit<UseFileUploadOptions, 'allowedTypes'> = {}) => {
  return useFileUpload({
    ...options,
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  });
};

// Hook spécialisé pour les fichiers Excel
export const useExcelUpload = (options: Omit<UseFileUploadOptions, 'allowedTypes'> = {}) => {
  return useFileUpload({
    ...options,
    allowedTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  });
};

// Hook spécialisé pour les vidéos
export const useVideoUpload = (options: Omit<UseFileUploadOptions, 'allowedTypes'> = {}) => {
  return useFileUpload({
    ...options,
    allowedTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
  });
}; 