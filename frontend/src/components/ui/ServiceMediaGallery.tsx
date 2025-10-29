import { Button } from '@/components/ui/buttons';
import { ChevronLeft, ChevronRight, Image, Play, X } from 'lucide-react';
import { useState } from 'react';

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
  products?: any[]; // Ajout des produits
  className?: string;
}

export default function ServiceMediaGallery({
  logo,
  banniere,
  images_realisations = [],
  videos = [],
  products = [],
  className = ''
}: ServiceMediaGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Organiser les médias par catégories
  const categorizedProducts: Record<string, { images: string[], videos: string[] }> = {};

  if (Array.isArray(products)) {
    products.forEach((product: any) => {
      const productType = product.type || 'autre';
      const productTypeLabel = getProductTypeLabel(productType);

      // Initialiser la catégorie si elle n'existe pas
      if (!categorizedProducts[productTypeLabel]) {
        categorizedProducts[productTypeLabel] = { images: [], videos: [] };
      }

      // Images du produit
      if (product.images && Array.isArray(product.images)) {
        categorizedProducts[productTypeLabel].images.push(...product.images);
      }

      // Vidéos du produit
      if (product.videos && Array.isArray(product.videos)) {
        categorizedProducts[productTypeLabel].videos.push(...product.videos);
      }

      // Images de réalisations (pour prestations de service)
      if (product.imagesRealisations && Array.isArray(product.imagesRealisations)) {
        categorizedProducts[productTypeLabel].images.push(...product.imagesRealisations);
      }

      // Vidéos de réalisations (pour prestations de service)
      if (product.videosRealisations && Array.isArray(product.videosRealisations)) {
        categorizedProducts[productTypeLabel].videos.push(...product.videosRealisations);
      }
    });
  }

  // Extraire toutes les images et vidéos des produits pour l'affichage global
  const productImages: string[] = [];
  const productVideos: string[] = [];

  Object.values(categorizedProducts).forEach(media => {
    productImages.push(...media.images);
    productVideos.push(...media.videos);
  });

  const getProductTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'immobilier_batiment': '🏢 Immobilier Bâtiment',
      'immobilier_terrain': '🏞️ Immobilier Terrain',
      'automobile': '🚗 Automobile',
      'ticket_voyage': '🚌 Tickets de Voyage',
      'covoiturage': '🚕 Covoiturage',
      'vetement': '👔 Vêtements',
      'chaussure': '👟 Chaussures',
      'electromenager': '📱 Électroménager',
      'mobilier': '🪑 Mobilier',
      'aliments': '🍕 Alimentation',
      'livres_fournitures': '📚 Livres & Fournitures',
      'quincaillerie': '🔧 Quincaillerie',
      'bien_etre_spa': '🧘 Bien-être & Spa',
      'prestation_service': '💼 Prestations de Service',
      'autre': '📦 Autres Produits'
    };
    return labels[type] || '📦 Autres Produits';
  };

  // Combiner tous les médias dans un tableau
  const allMedia: MediaItem[] = [
    ...(logo ? [{ type: 'logo' as const, url: logo, label: '🎨 Logo' }] : []),
    ...(banniere ? [{ type: 'banniere' as const, url: banniere, label: '🎨 Bannière' }] : []),
    ...productImages.map((url, index) => ({
      type: 'image' as const,
      url,
      label: `📦 Produit ${index + 1}`
    })),
    ...images_realisations.map((url, index) => ({
      type: 'image' as const,
      url,
      label: `🖼️ Réalisation ${index + 1}`
    })),
    ...productVideos.map((url, index) => ({
      type: 'video' as const,
      url,
      label: `🎬 Produit ${index + 1}`
    })),
    ...videos.map((url, index) => ({
      type: 'video' as const,
      url,
      label: `🎥 Vidéo ${index + 1}`
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
      {/* Galerie organisée par sections */}
      <div className={`space-y-4 ${className}`}>
        {/* Section: Identité Visuelle */}
        {(logo || banniere) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-500">
              <span className="text-lg">🎨</span>
              <h3 className="text-sm font-semibold text-gray-800 flex-1">Identité Visuelle</h3>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                {(logo ? 1 : 0) + (banniere ? 1 : 0)}
              </span>
            </div>
            <div className="flex gap-2">
              {logo && (
                <div className="relative group">
                  <img
                    src={logo}
                    alt="Logo du service"
                    className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors cursor-pointer shadow-sm"
                    onClick={() => openModal({ type: 'logo', url: logo, label: '🎨 Logo' }, 0)}
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
                    onClick={() => openModal({ type: 'banniere', url: banniere, label: '🎨 Bannière' }, logo ? 1 : 0)}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                    <Image className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section: Produits (par type) */}
        {Object.keys(categorizedProducts).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-indigo-500">
              <span className="text-lg">📦</span>
              <h3 className="text-sm font-semibold text-gray-800 flex-1">Produits</h3>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                {productImages.length + productVideos.length}
              </span>
            </div>
            {Object.entries(categorizedProducts).map(([typeLabel, media]) => {
              const totalMedia = media.images.length + media.videos.length;
              if (totalMedia === 0) return null;

              return (
                <div key={typeLabel} className="space-y-1 pl-2">
                  <h4 className="text-xs font-medium text-gray-600">{typeLabel}</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {media.images.map((url, idx) => (
                      <div key={`${typeLabel}-img-${idx}`} className="relative group flex-shrink-0">
                        <img
                          src={url}
                          alt={`${typeLabel} ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:border-indigo-400 transition-colors cursor-pointer shadow-sm"
                          onClick={() => openModal({ type: 'image', url, label: `📦 ${typeLabel}` }, allMedia.findIndex(m => m.url === url))}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                          <Image className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                    {media.videos.map((url, idx) => (
                      <div key={`${typeLabel}-vid-${idx}`} className="relative group flex-shrink-0">
                        <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 hover:border-indigo-400 transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                          onClick={() => openModal({ type: 'video', url, label: `🎬 ${typeLabel}` }, allMedia.findIndex(m => m.url === url))}>
                          <Play className="w-5 h-5 text-gray-500 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <div className="absolute top-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                          Vidéo
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Section: Réalisations */}
        {(images_realisations.length > 0 || videos.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-500">
              <span className="text-lg">🖼️</span>
              <h3 className="text-sm font-semibold text-gray-800 flex-1">Réalisations</h3>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                {images_realisations.length + videos.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {images_realisations.slice(0, 6).map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Réalisation ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border border-gray-200 hover:border-purple-400 transition-colors cursor-pointer shadow-sm"
                    onClick={() => openModal({ type: 'image', url, label: `🖼️ Réalisation ${index + 1}` }, allMedia.findIndex(m => m.url === url))}
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
            {videos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {videos.slice(0, 4).map((url, index) => (
                  <div key={index} className="relative group">
                    <div className="w-full h-20 bg-gray-100 rounded-lg border border-gray-200 hover:border-purple-400 transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                      onClick={() => openModal({ type: 'video', url, label: `🎥 Vidéo ${index + 1}` }, allMedia.findIndex(m => m.url === url))}>
                      <Play className="w-6 h-6 text-gray-500 group-hover:text-purple-500 transition-colors" />
                    </div>
                    <div className="absolute top-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                      Vidéo
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    className={`w-2 h-2 rounded-full ${index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
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