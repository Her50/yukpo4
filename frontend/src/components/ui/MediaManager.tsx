import React, { useState, useRef } from 'react';
import { Upload, X, Image, Video, FileText, FileSpreadsheet, Play, Eye, Crown, Flag } from 'lucide-react';

interface MediaManagerProps {
  mediaFiles: {
    images: string[];
    audios: string[];
    videos: string[];
    documents: string[];
    excel: string[];
    logo?: string[];
    banner?: string[];
  };
  onMediaChange: (mediaFiles: any) => void;
  readonly?: boolean;
}

const MediaManager: React.FC<MediaManagerProps> = ({ mediaFiles, onMediaChange, readonly = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'branding'>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    console.log('📁 [MediaManager] Traitement de', files.length, 'fichiers');
    
    Array.from(files).forEach((file, index) => {
      console.log(`📄 [MediaManager] Fichier ${index + 1}:`, {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const mediaType = getMediaType(file);
        
        console.log(`📊 [MediaManager] Fichier ${index + 1} traité:`, {
          fileName: file.name,
          mediaType,
          base64Length: base64?.length,
          hasBase64: !!base64
        });
        
        if (mediaType) {
          const newMediaFiles = { ...mediaFiles };
          const currentFiles = newMediaFiles[mediaType] || [];
          newMediaFiles[mediaType] = [...currentFiles, base64];
          
          console.log(`✅ [MediaManager] Ajout à ${mediaType}:`, {
            avant: currentFiles.length,
            après: newMediaFiles[mediaType].length,
            totalFichiers: Object.values(newMediaFiles).flat().length
          });
          
          onMediaChange(newMediaFiles);
        } else {
          console.warn('⚠️ [MediaManager] Type de média non reconnu pour:', file.name, file.type);
        }
      };
      
      reader.onerror = (error) => {
        console.error('❌ [MediaManager] Erreur lecture fichier:', file.name, error);
      };
      
      reader.readAsDataURL(file);
    });
  };

  const getMediaType = (file: File): keyof typeof mediaFiles | null => {
    if (file.type.startsWith('image/')) return 'images';
    if (file.type.startsWith('video/')) return 'videos';
    if (file.type.startsWith('audio/')) return 'audios';
    if (file.type.includes('document') || file.type.includes('pdf')) return 'documents';
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return 'excel';
    return null;
  };

  const removeMedia = (type: keyof typeof mediaFiles, index: number) => {
    const newMediaFiles = { ...mediaFiles };
    if (Array.isArray(newMediaFiles[type])) {
      newMediaFiles[type] = (newMediaFiles[type] as string[]).filter((_, i) => i !== index);
      onMediaChange(newMediaFiles);
    }
  };

  const getMediaIcon = (type: keyof typeof mediaFiles) => {
    switch (type) {
      case 'images': return <Image className="w-4 h-4" />;
      case 'videos': return <Video className="w-4 h-4" />;
      case 'audios': return <Play className="w-4 h-4" />;
      case 'documents': return <FileText className="w-4 h-4" />;
      case 'excel': return <FileSpreadsheet className="w-4 h-4" />;
      case 'logo': return <Crown className="w-4 h-4" />;
      case 'banner': return <Flag className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getMediaLabel = (type: keyof typeof mediaFiles) => {
    switch (type) {
      case 'images': return 'Images';
      case 'videos': return 'Vidéos';
      case 'audios': return 'Audios';
      case 'documents': return 'Documents';
      case 'excel': return 'Fichiers Excel';
      case 'logo': return 'Logo';
      case 'banner': return 'Bannière';
      default: return 'Fichiers';
    }
  };

  const totalMedia = Object.values(mediaFiles).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

  return (
    <div className="space-y-3">

      {/* Onglets */}
      <div className="flex space-x-1 bg-white rounded-lg p-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'general'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📁 Général
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'branding'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🎨 Identité visuelle
        </button>
      </div>

      {activeTab === 'general' && (
        <>
          {/* Zone de dépôt pour médias généraux */}
          {!readonly && (
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 bg-white hover:border-blue-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">
                Glissez-déposez vos fichiers ici ou cliquez pour sélectionner
              </p>
              <p className="text-xs text-gray-500">
                Images, vidéos, audios, documents, Excel
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Sélectionner des fichiers
              </button>
            </div>
          )}

          {/* Résumé des médias généraux */}
          {totalMedia > 0 && (
            <div className="bg-white rounded p-3 border border-blue-200">
              <h4 className="font-semibold text-sm text-blue-800 mb-3">
                📊 Résumé des médias ({totalMedia} fichier{totalMedia > 1 ? 's' : ''})
              </h4>
              
              <div className="space-y-3">
                {Object.entries(mediaFiles).map(([type, files]) => {
                  if (!Array.isArray(files) || files.length === 0 || (type === 'logo' || type === 'banner')) return null;
                  
                  return (
                    <div key={type} className="border-l-4 border-blue-300 pl-3">
                      <div className="flex items-center gap-2 mb-2">
                        {getMediaIcon(type as keyof typeof mediaFiles)}
                        <span className="font-medium text-sm text-gray-700">
                          {getMediaLabel(type as keyof typeof mediaFiles)} ({files.length})
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {files.map((file, index) => (
                          <div key={index} className="relative group">
                            {type === 'images' ? (
                              <img
                                src={file}
                                alt={`Image ${index + 1}`}
                                className="w-full h-20 object-cover rounded border border-gray-200"
                              />
                            ) : (
                              <div className="w-full h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                                {getMediaIcon(type as keyof typeof mediaFiles)}
                              </div>
                            )}
                            
                            {!readonly && (
                              <button
                                type="button"
                                onClick={() => removeMedia(type as keyof typeof mediaFiles, index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'branding' && (
        <>
          {/* Logo */}
          <div className="bg-white rounded p-3 border border-blue-200">
            <h4 className="font-semibold text-sm text-blue-800 mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Logo de votre service
            </h4>
            
            {!readonly && (
              <div className="mb-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const newMediaFiles = { ...mediaFiles };
                        newMediaFiles.logo = [e.target?.result as string];
                        onMediaChange(newMediaFiles);
                      };
                      reader.readAsDataURL(e.target.files[0]);
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format recommandé : PNG ou SVG, taille max 2MB
                </p>
              </div>
            )}
            
            {mediaFiles.logo && mediaFiles.logo.length > 0 && (
              <div className="relative group">
                <img
                  src={mediaFiles.logo[0]}
                  alt="Logo du service"
                  className="w-32 h-32 object-contain border border-gray-200 rounded"
                />
                {!readonly && (
                  <button
                    type="button"
                    onClick={() => {
                      const newMediaFiles = { ...mediaFiles };
                      newMediaFiles.logo = [];
                      onMediaChange(newMediaFiles);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bannière */}
          <div className="bg-white rounded p-3 border border-blue-200">
            <h4 className="font-semibold text-sm text-blue-800 mb-3 flex items-center gap-2">
              <Flag className="w-4 h-4" />
              Bannière de votre service
            </h4>
            
            {!readonly && (
              <div className="mb-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const newMediaFiles = { ...mediaFiles };
                        newMediaFiles.banner = [e.target?.result as string];
                        onMediaChange(newMediaFiles);
                      };
                      reader.readAsDataURL(e.target.files[0]);
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format recommandé : JPG ou PNG, taille max 5MB, ratio 16:9 ou 3:1
                </p>
              </div>
            )}
            
            {mediaFiles.banner && mediaFiles.banner.length > 0 && (
              <div className="relative group">
                <img
                  src={mediaFiles.banner[0]}
                  alt="Bannière du service"
                  className="w-full h-32 object-cover border border-gray-200 rounded"
                />
                {!readonly && (
                  <button
                    type="button"
                    onClick={() => {
                      const newMediaFiles = { ...mediaFiles };
                      newMediaFiles.banner = [];
                      onMediaChange(newMediaFiles);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Conseils */}
      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
        💡 <strong>Conseil :</strong> Ajoutez des images de qualité pour attirer plus de clients. 
        Un logo professionnel et une bannière attractive peuvent considérablement améliorer la présentation de votre service.
      </div>
    </div>
  );
};

export default MediaManager; 