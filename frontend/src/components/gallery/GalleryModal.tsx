import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Service } from '@/types/service';

// Fonction utilitaire pour extraire la valeur d'un champ de service
const getServiceFieldValue = (field: any): string => {
  if (!field) return 'Non spécifié';
  
  if (typeof field === 'string') return field;
  
  if (field && typeof field === 'object') {
    if (field.valeur !== undefined) {
      const value = field.valeur;
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
      if (typeof value === 'number') return value.toString();
      if (Array.isArray(value)) return value.join(', ');
      return String(value);
    }
  }
  
  if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
  if (typeof field === 'number') return field.toString();
  
  return 'Non spécifié';
};

// Fonction utilitaire pour extraire les valeurs des champs média
const getServiceMediaValue = (field: any): string[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (field.valeur !== undefined) {
    if (Array.isArray(field.valeur)) return field.valeur;
    if (typeof field.valeur === 'string') return [field.valeur];
  }
  return [];
};

interface GalleryModalProps {
  service: Service;
  prestataires: Map<number, any>;
  user: any;
  onClose: () => void;
}

const GalleryModal: React.FC<GalleryModalProps> = ({
  service,
  prestataires,
  user,
  onClose
}) => {
  const [prestataireGallery, setPrestataireGallery] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Fonction pour charger la galerie du prestataire
  const loadPrestataireGallery = async () => {
    setLoadingGallery(true);
    try {
      const response = await fetch(`/api/services/${service.id}/media`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const media = await response.json();
        setPrestataireGallery(media);
      } else {
        // Fallback: utiliser les données du service
        const serviceMedia = [];
        
        if (service.data?.realisations && Array.isArray(service.data.realisations)) {
          serviceMedia.push(...service.data.realisations);
        } else if (service.data?.realisations && typeof service.data.realisations === 'object') {
          const realisationsValue = getServiceFieldValue(service.data.realisations);
          if (Array.isArray(realisationsValue)) {
            serviceMedia.push(...realisationsValue);
          }
        }
        
        if (service.data?.videos && Array.isArray(service.data.videos)) {
          serviceMedia.push(...service.data.videos);
        } else if (service.data?.videos && typeof service.data.videos === 'object') {
          const videosValue = getServiceFieldValue(service.data.videos);
          if (Array.isArray(videosValue)) {
            serviceMedia.push(...videosValue);
          }
        }
        
        setPrestataireGallery(serviceMedia);
      }
    } catch (error) {
      console.error('Erreur chargement galerie:', error);
      // Fallback: utiliser les données du service
      const serviceMedia = [];
      
      if (service.data?.realisations && Array.isArray(service.data.realisations)) {
        serviceMedia.push(...service.data.realisations);
      } else if (service.data?.realisations && typeof service.data.realisations === 'object') {
        const realisationsValue = getServiceFieldValue(service.data.realisations);
        if (Array.isArray(realisationsValue)) {
          serviceMedia.push(...realisationsValue);
        }
      }
      
      if (service.data?.videos && Array.isArray(service.data.videos)) {
        serviceMedia.push(...service.data.videos);
      } else if (service.data?.videos && typeof service.data.videos === 'object') {
        const videosValue = getServiceFieldValue(service.data.videos);
        if (Array.isArray(videosValue)) {
          serviceMedia.push(...videosValue);
        }
      }
      
      setPrestataireGallery(serviceMedia);
    } finally {
      setLoadingGallery(false);
    }
  };

  // Fonction pour envoyer un média de la galerie du prestataire
  const sendGalleryMedia = async (mediaItem: any) => {
    try {
      const message = {
        id: Date.now().toString() + Math.random(),
        from: 'prestataire',
        content: mediaItem.type === 'image' ? '🖼️ Réalisation' : '🎥 Vidéo de présentation',
        timestamp: new Date(),
        status: 'sent',
        type: mediaItem.type === 'image' ? 'image' : 'video',
        fileUrl: mediaItem.url || mediaItem.valeur,
        fileName: mediaItem.label || mediaItem.nom || 'Média',
        fileSize: mediaItem.size || 0
      };

      console.log('Média partagé:', message);
      onClose();
    } catch (error) {
      console.error('Erreur partage média:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-96 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold">Galerie du prestataire</h3>
              <p className="text-sm text-gray-600">
                Réalisations et vidéos de {getServiceFieldValue(service.data?.nom_prestataire) || `Prestataire #${service.user_id}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (prestataireGallery.length === 0) {
                  loadPrestataireGallery();
                }
              }}
              className="text-blue-600 hover:text-blue-800"
              disabled={loadingGallery}
            >
              {loadingGallery ? (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </Button>
          </div>
        </div>
        
        <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
          {loadingGallery ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement de la galerie...</p>
              </div>
            </div>
          ) : prestataireGallery.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h4 className="text-lg font-medium text-gray-600 mb-2">Aucun média disponible</h4>
                <p className="text-gray-500 mb-4">
                  Ce prestataire n'a pas encore ajouté de réalisations ou de vidéos à sa galerie.
                </p>
                <Button
                  onClick={loadPrestataireGallery}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  🔄 Actualiser
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {prestataireGallery.map((mediaItem, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  onClick={() => sendGalleryMedia(mediaItem)}
                >
                  {mediaItem.type === 'image' || mediaItem.url?.includes('image') || mediaItem.valeur?.includes('image') ? (
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      <img 
                        src={mediaItem.url || mediaItem.valeur} 
                        alt={mediaItem.label || mediaItem.nom || `Image ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden w-full h-full bg-gray-200 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {mediaItem.label || mediaItem.nom || `Média ${index + 1}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {mediaItem.type === 'image' ? '🖼️ Image' : '🎥 Vidéo'}
                    </p>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          sendGalleryMedia(mediaItem);
                        }}
                      >
                        📤 Partager dans le chat
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GalleryModal; 