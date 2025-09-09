import React, { useState } from 'react';
import { Button } from '@/components/ui/buttons';
import { Play, Image, Volume2, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaItem {
  type: 'logo' | 'banniere' | 'image' | 'video';
  url: string;
  label: string;
}

interface ServiceMediaGalleryProps {
  logo?: string;
  banniere?: string;
  images_realisations?: string[];
  videos?: string[];
  className?: string;
}

export default function ServiceMediaGallery({
  logo,
  banniere,
  images_realisations = [],
  videos = [],
  className = ''
}: ServiceMediaGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Combiner tous les médias dans un tableau
  const allMedia: MediaItem[] = [
    ...(logo ? [{ type: 'logo' as const, url: logo, label: 'Logo' }] : []),
    ...(banniere ? [{ type: 'banniere' as const, url: banniere, label: 'Bannière' }] : []),
    ...images_realisations.map((url, index) => ({ 
      type: 'image' as const, 
      url, 
      label: `Réalisation ${index + 1}` 
    })),
    ...videos.map((url, index) => ({ 
      type: 'video' as const, 
      url, 
      label: `Vidéo ${index + 1}` 
    }))
  ];

  const openModal = (media: MediaItem, index: number) => {
    setSelectedMedia(media);
    setCurrentIndex(index);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMedia(null);
  };

  const nextMedia = () => {
    if (allMedia.length > 1) {
      const nextIndex = (currentIndex + 1) % allMedia.length;
      setCurrentIndex(nextIndex);
      setSelectedMedia(allMedia[nextIndex]);
    }
  };

  const prevMedia = () => {
    if (allMedia.length > 1) {
      const prevIndex = currentIndex === 0 ? allMedia.length - 1 : currentIndex - 1;
      setCurrentIndex(prevIndex);
      setSelectedMedia(allMedia[prevIndex]);
    }
  };

  if (allMedia.length === 0) {
    return null;
  }

  return (
    <>
      {/* Galerie compacte */}
      <div className={`space-y-3 ${className}`}>
        {/* Logo et bannière en haut */}
        {(logo || banniere) && (
          <div className="flex gap-2">
            {logo && (
              <div className="relative group">
                <img
                  src={logo}
                  alt="Logo du service"
                  className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors cursor-pointer shadow-sm"
                  onClick={() => openModal({ type: 'logo', url: logo, label: 'Logo' }, 0)}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                  <Image className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
            {banniere && (
              <div className="relative group flex-1">
                <img
                  src={banniere}
                  alt="Bannière du service"
                  className="w-full h-16 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors cursor-pointer shadow-sm"
                  onClick={() => openModal({ type: 'banniere', url: banniere, label: 'Bannière' }, logo ? 1 : 0)}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                  <Image className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Images de réalisations */}
        {images_realisations.length > 0 && (
          <div>
            <div className="grid grid-cols-3 gap-2">
              {images_realisations.slice(0, 6).map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Réalisation ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer shadow-sm"
                    onClick={() => openModal({ type: 'image', url, label: `Réalisation ${index + 1}` }, 
                      (logo ? 1 : 0) + (banniere ? 1 : 0) + index)}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                    <Image className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {index === 5 && images_realisations.length > 6 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-bold">+{images_realisations.length - 6}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vidéos */}
        {videos.length > 0 && (
          <div>
            <div className="grid grid-cols-2 gap-2">
              {videos.slice(0, 4).map((url, index) => (
                <div key={index} className="relative group">
                  <div className="w-full h-20 bg-gray-100 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                       onClick={() => openModal({ type: 'video', url, label: `Vidéo ${index + 1}` }, 
                         (logo ? 1 : 0) + (banniere ? 1 : 0) + images_realisations.length + index)}>
                    <Play className="w-6 h-6 text-gray-500 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="absolute top-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                    Vidéo
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal pour afficher les médias en grand */}
      {isModalOpen && selectedMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            {/* Bouton fermer */}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white"
            >
              <X className="w-6 h-6" />
            </Button>

            {/* Navigation */}
            {allMedia.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prevMedia}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextMedia}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </>
            )}

            {/* Contenu du média */}
            <div className="text-center">
              <h3 className="text-white text-lg font-medium mb-4">{selectedMedia.label}</h3>
              
              {selectedMedia.type === 'video' ? (
                <video
                  src={selectedMedia.url}
                  controls
                  className="max-w-full max-h-[80vh] rounded-lg"
                  autoPlay
                >
                  Votre navigateur ne supporte pas la lecture de vidéos.
                </video>
              ) : (
                <img
                  src={selectedMedia.url}
                  alt={selectedMedia.label}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              )}
            </div>

            {/* Indicateur de position */}
            {allMedia.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {allMedia.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
} 