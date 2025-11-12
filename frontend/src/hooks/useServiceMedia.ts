import { useState, useEffect } from 'react';

interface MediaItem {
  id: number;
  service_id: number;
  type: string;
  path: string;
  uploaded_at: string;
}

interface ServiceMedia {
  images: string[];
  videos: string[];
  audios: string[];
  documents: string[];
  excel: string[];
  loading: boolean;
  error: string | null;
  totalCount: number;
}

export const useServiceMedia = (serviceId: number): ServiceMedia => {
  const [media, setMedia] = useState<ServiceMedia>({
    images: [],
    videos: [],
    audios: [],
    documents: [],
    excel: [],
    loading: true,
    error: null,
    totalCount: 0
  });

  useEffect(() => {
    const fetchServiceMedia = async () => {
      try {
        setMedia(prev => ({ ...prev, loading: true, error: null }));
        
        console.log(`🖼️ [useServiceMedia] === DÉBUT RÉCUPÉRATION MÉDIAS ===`);
        console.log(`📊 [useServiceMedia] Service ID: ${serviceId}`);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/services/${serviceId}/media`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        console.log(`🔗 [useServiceMedia] Statut API: ${response.status}`);

        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
        }

        const mediaItems: MediaItem[] = await response.json();
        console.log(`📊 [useServiceMedia] ${mediaItems.length} médias récupérés depuis DB:`, mediaItems);

        // Grouper les médias par type et construire les URLs
        const groupedMedia = mediaItems.reduce((acc, item) => {
          const mediaUrl = `/api/media/files/${item.path}`;
          console.log(`🔗 [useServiceMedia] URL construite pour ${item.type}: ${mediaUrl}`);
          
          switch (item.type) {
            case 'image':
              acc.images.push(mediaUrl);
              break;
            case 'video':
              acc.videos.push(mediaUrl);
              break;
            case 'audio':
              acc.audios.push(mediaUrl);
              break;
            case 'document':
              acc.documents.push(mediaUrl);
              break;
            case 'excel':
              acc.excel.push(mediaUrl);
              break;
            default:
              console.warn(`⚠️ [useServiceMedia] Type de média non reconnu: ${item.type}`);
          }
          return acc;
        }, {
          images: [] as string[],
          videos: [] as string[],
          audios: [] as string[],
          documents: [] as string[],
          excel: [] as string[]
        });

        setMedia({
          ...groupedMedia,
          loading: false,
          error: null,
          totalCount: mediaItems.length
        });

        console.log(`✅ [useServiceMedia] Médias groupés et URLs créées:`, {
          images: groupedMedia.images.length,
          videos: groupedMedia.videos.length,
          audios: groupedMedia.audios.length,
          documents: groupedMedia.documents.length,
          excel: groupedMedia.excel.length,
          total: mediaItems.length
        });

        console.log(`🖼️ [useServiceMedia] === FIN RÉCUPÉRATION MÉDIAS ===`);

      } catch (error) {
        console.error(`❌ [useServiceMedia] Erreur récupération médias:`, error);
        setMedia(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          totalCount: 0
        }));
      }
    };

    if (serviceId) {
      fetchServiceMedia();
    }
  }, [serviceId]);

  return media;
};

export default useServiceMedia; 