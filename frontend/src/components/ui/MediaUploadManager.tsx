/**
 * MediaUploadManager pour le frontend web
 * Gère l'upload de médias (images, vidéos) vers CDN avec progression
 * Utilise cloudUploadService pour upload préalable
 */

import React, { useState, useCallback } from 'react';
import { ImageIcon, Video, X, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/buttons';
import { cloudUploadService, FileType } from '@/services/cloudUploadService';
import { compressImage, compressImages } from '@/utils/mediaCompression';
import { toast } from 'react-hot-toast';

interface MediaUploadManagerProps {
    images: string[]; // URLs CDN ou base64
    videos: string[]; // URLs CDN ou base64
    onImagesChange: (images: string[]) => void;
    onVideosChange: (videos: string[]) => void;
    readonly?: boolean;
    maxImages?: number;
    maxVideos?: number;
    uploadToCDN?: boolean; // Si true, upload vers CDN avant de stocker
    onUploadProgress?: (type: 'images' | 'videos', completed: number, total: number) => void;
}

interface UploadingFile {
    id: string;
    file: File;
    type: 'image' | 'video';
    progress: number;
    url?: string;
    error?: string;
}

const MediaUploadManager: React.FC<MediaUploadManagerProps> = ({
    images: imagesProp,
    videos: videosProp,
    onImagesChange,
    onVideosChange,
    readonly = false,
    maxImages = 10,
    maxVideos = 3,
    uploadToCDN = true, // Par défaut, upload vers CDN
    onUploadProgress,
}) => {
    const images = imagesProp || [];
    const videos = videosProp || [];

    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [uploading, setUploading] = useState(false);

    /**
     * Gère l'upload d'images
     */
    const handleImageUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        if (images.length >= maxImages) {
            toast.error(`Maximum ${maxImages} images autorisées`);
            return;
        }

        const remainingSlots = maxImages - images.length;
        const filesToProcess = Array.from(files).slice(0, remainingSlots);

        if (filesToProcess.length === 0) {
            toast.error(`Limite de ${maxImages} images atteinte`);
            return;
        }

        setUploading(true);

        try {
            const newImages: string[] = [];
            const uploadingItems: UploadingFile[] = filesToProcess.map((file, idx) => ({
                id: `img_${Date.now()}_${idx}`,
                file,
                type: 'image' as const,
                progress: 0,
            }));

            setUploadingFiles(prev => [...prev, ...uploadingItems]);

            // Traiter chaque fichier
            for (let i = 0; i < filesToProcess.length; i++) {
                const file = filesToProcess[i];
                const uploadingItem = uploadingItems[i];

                try {
                    // Compresser l'image
                    const reader = new FileReader();
                    const base64 = await new Promise<string>((resolve, reject) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    const compressedBase64 = await compressImage(base64);
                    
                    if (uploadToCDN) {
                        // Upload vers CDN
                        const result = await cloudUploadService.uploadToCloud(
                            compressedBase64,
                            'image',
                            file.name,
                            (progress) => {
                                setUploadingFiles(prev => prev.map(item =>
                                    item.id === uploadingItem.id
                                        ? { ...item, progress: progress.percentage }
                                        : item
                                ));
                            }
                        );

                        if (result.success && result.url) {
                            newImages.push(result.url);
                            setUploadingFiles(prev => prev.map(item =>
                                item.id === uploadingItem.id
                                    ? { ...item, progress: 100, url: result.url }
                                    : item
                            ));
                        } else {
                            // Fallback: utiliser base64 si upload échoue
                            newImages.push(compressedBase64);
                            setUploadingFiles(prev => prev.map(item =>
                                item.id === uploadingItem.id
                                    ? { ...item, error: result.error || 'Erreur upload', progress: 100 }
                                    : item
                            ));
                        }
                    } else {
                        // Utiliser base64 directement
                        newImages.push(compressedBase64);
                        setUploadingFiles(prev => prev.map(item =>
                            item.id === uploadingItem.id
                                ? { ...item, progress: 100 }
                                : item
                        ));
                    }

                    if (onUploadProgress) {
                        onUploadProgress('images', i + 1, filesToProcess.length);
                    }
                } catch (error: any) {
                    console.error('[MediaUploadManager] Erreur upload image:', error);
                    setUploadingFiles(prev => prev.map(item =>
                        item.id === uploadingItem.id
                            ? { ...item, error: error.message || 'Erreur upload', progress: 100 }
                            : item
                    ));
                }
            }

            // Mettre à jour les images
            if (newImages.length > 0) {
                onImagesChange([...images, ...newImages]);
                toast.success(`${newImages.length} image(s) ajoutée(s)`);
            }

            // Nettoyer les fichiers en cours d'upload après 2 secondes
            setTimeout(() => {
                setUploadingFiles(prev => prev.filter(item => !uploadingItems.find(ui => ui.id === item.id)));
            }, 2000);
        } catch (error: any) {
            console.error('[MediaUploadManager] Erreur upload images:', error);
            toast.error('Erreur lors de l\'upload des images');
        } finally {
            setUploading(false);
        }
    }, [images, maxImages, uploadToCDN, onImagesChange, onUploadProgress]);

    /**
     * Gère l'upload de vidéos
     */
    const handleVideoUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        if (videos.length >= maxVideos) {
            toast.error(`Maximum ${maxVideos} vidéos autorisées`);
            return;
        }

        const remainingSlots = maxVideos - videos.length;
        const filesToProcess = Array.from(files).slice(0, remainingSlots);

        if (filesToProcess.length === 0) {
            toast.error(`Limite de ${maxVideos} vidéos atteinte`);
            return;
        }

        setUploading(true);

        try {
            const newVideos: string[] = [];
            const uploadingItems: UploadingFile[] = filesToProcess.map((file, idx) => ({
                id: `vid_${Date.now()}_${idx}`,
                file,
                type: 'video' as const,
                progress: 0,
            }));

            setUploadingFiles(prev => [...prev, ...uploadingItems]);

            // Traiter chaque fichier
            for (let i = 0; i < filesToProcess.length; i++) {
                const file = filesToProcess[i];
                const uploadingItem = uploadingItems[i];

                try {
                    // Convertir en base64
                    const reader = new FileReader();
                    const base64 = await new Promise<string>((resolve, reject) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    if (uploadToCDN) {
                        // Upload vers CDN
                        const result = await cloudUploadService.uploadToCloud(
                            base64,
                            'video',
                            file.name,
                            (progress) => {
                                setUploadingFiles(prev => prev.map(item =>
                                    item.id === uploadingItem.id
                                        ? { ...item, progress: progress.percentage }
                                        : item
                                ));
                            }
                        );

                        if (result.success && result.url) {
                            newVideos.push(result.url);
                            setUploadingFiles(prev => prev.map(item =>
                                item.id === uploadingItem.id
                                    ? { ...item, progress: 100, url: result.url }
                                    : item
                            ));
                        } else {
                            // Fallback: utiliser base64 si upload échoue
                            newVideos.push(base64);
                            setUploadingFiles(prev => prev.map(item =>
                                item.id === uploadingItem.id
                                    ? { ...item, error: result.error || 'Erreur upload', progress: 100 }
                                    : item
                            ));
                        }
                    } else {
                        // Utiliser base64 directement
                        newVideos.push(base64);
                        setUploadingFiles(prev => prev.map(item =>
                            item.id === uploadingItem.id
                                ? { ...item, progress: 100 }
                                : item
                        ));
                    }

                    if (onUploadProgress) {
                        onUploadProgress('videos', i + 1, filesToProcess.length);
                    }
                } catch (error: any) {
                    console.error('[MediaUploadManager] Erreur upload vidéo:', error);
                    setUploadingFiles(prev => prev.map(item =>
                        item.id === uploadingItem.id
                            ? { ...item, error: error.message || 'Erreur upload', progress: 100 }
                            : item
                    ));
                }
            }

            // Mettre à jour les vidéos
            if (newVideos.length > 0) {
                onVideosChange([...videos, ...newVideos]);
                toast.success(`${newVideos.length} vidéo(s) ajoutée(s)`);
            }

            // Nettoyer les fichiers en cours d'upload après 2 secondes
            setTimeout(() => {
                setUploadingFiles(prev => prev.filter(item => !uploadingItems.find(ui => ui.id === item.id)));
            }, 2000);
        } catch (error: any) {
            console.error('[MediaUploadManager] Erreur upload vidéos:', error);
            toast.error('Erreur lors de l\'upload des vidéos');
        } finally {
            setUploading(false);
        }
    }, [videos, maxVideos, uploadToCDN, onVideosChange, onUploadProgress]);

    /**
     * Supprime une image
     */
    const removeImage = useCallback((index: number) => {
        onImagesChange(images.filter((_, i) => i !== index));
    }, [images, onImagesChange]);

    /**
     * Supprime une vidéo
     */
    const removeVideo = useCallback((index: number) => {
        onVideosChange(videos.filter((_, i) => i !== index));
    }, [videos, onVideosChange]);

    return (
        <div className="space-y-4">
            {/* Images */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                        Images ({images.length}/{maxImages})
                    </label>
                    {!readonly && images.length < maxImages && (
                        <label className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                                <span>
                                    <ImageIcon className="w-4 h-4 mr-2" />
                                    Ajouter
                                </span>
                            </Button>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                hidden
                                onChange={(e) => handleImageUpload(e.target.files)}
                                disabled={uploading}
                            />
                        </label>
                    )}
                </div>

                {/* Liste des images */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {images.map((image, index) => (
                        <div key={index} className="relative group">
                            <img
                                src={image}
                                alt={`Image ${index + 1}`}
                                className="w-full h-24 object-cover rounded border"
                            />
                            {!readonly && (
                                <button
                                    onClick={() => removeImage(index)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Fichiers en cours d'upload */}
                    {uploadingFiles.filter(f => f.type === 'image').map((file) => (
                        <div key={file.id} className="relative border rounded bg-gray-50 h-24 flex items-center justify-center">
                            {file.progress < 100 ? (
                                <div className="text-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-1" />
                                    <p className="text-xs text-gray-600">{file.progress.toFixed(0)}%</p>
                                </div>
                            ) : file.error ? (
                                <div className="text-center">
                                    <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                                    <p className="text-xs text-red-600">Erreur</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                                    <p className="text-xs text-green-600">Terminé</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Vidéos */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                        Vidéos ({videos.length}/{maxVideos})
                    </label>
                    {!readonly && videos.length < maxVideos && (
                        <label className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                                <span>
                                    <Video className="w-4 h-4 mr-2" />
                                    Ajouter
                                </span>
                            </Button>
                            <input
                                type="file"
                                accept="video/*"
                                multiple
                                hidden
                                onChange={(e) => handleVideoUpload(e.target.files)}
                                disabled={uploading}
                            />
                        </label>
                    )}
                </div>

                {/* Liste des vidéos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {videos.map((video, index) => (
                        <div key={index} className="relative group">
                            <div className="w-full h-24 bg-gray-100 rounded border flex items-center justify-center">
                                <Video className="w-8 h-8 text-gray-400" />
                            </div>
                            {!readonly && (
                                <button
                                    onClick={() => removeVideo(index)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Fichiers en cours d'upload */}
                    {uploadingFiles.filter(f => f.type === 'video').map((file) => (
                        <div key={file.id} className="relative border rounded bg-gray-50 h-24 flex items-center justify-center">
                            {file.progress < 100 ? (
                                <div className="text-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-1" />
                                    <p className="text-xs text-gray-600">{file.progress.toFixed(0)}%</p>
                                </div>
                            ) : file.error ? (
                                <div className="text-center">
                                    <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                                    <p className="text-xs text-red-600">Erreur</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                                    <p className="text-xs text-green-600">Terminé</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MediaUploadManager;

