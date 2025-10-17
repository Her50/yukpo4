import { useEffect, useState } from 'react';
import { servicesApi } from '../services/api';

interface ServiceMedia {
  images: string[];
  videos: string[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}

interface MediaResponse {
  success: boolean;
  data: {
    images: string[];
    videos: string[];
    total_count: number;
  };
  error?: string;
}

/**
 * Hook pour récupérer les médias réels d'un service depuis l'API
 * Remplace les données statiques par des URLs construites dynamiquement
 */
export const useServiceMedia = (serviceId: string | number): ServiceMedia => {
  const [media, setMedia] = useState<ServiceMedia>({
    images: [],
    videos: [],
    totalCount: 0,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchServiceMedia = async () => {
      if (!serviceId) {
        setMedia(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        setMedia(prev => ({ ...prev, loading: true, error: null }));

        console.log(`📊 [useServiceMedia] Récupération des médias pour service ${serviceId}`);

        // Appel API pour récupérer les médias du service
        const response = await (servicesApi as any).getServiceMedia(serviceId) as MediaResponse;

        if (response.success && response.data) {
          const { images = [], videos = [], total_count = 0 } = response.data;

          console.log(`✅ [useServiceMedia] Médias récupérés:`, {
            images: images.length,
            videos: videos.length,
            total: total_count
          });

          setMedia({
            images,
            videos,
            totalCount: total_count,
            loading: false,
            error: null
          });
        } else {
          throw new Error(response.error || 'Erreur lors de la récupération des médias');
        }
      } catch (error) {
        console.error(`❌ [useServiceMedia] Erreur pour service ${serviceId}:`, error);

        setMedia({
          images: [],
          videos: [],
          totalCount: 0,
          loading: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
    };

    fetchServiceMedia();
  }, [serviceId]);

  return media;
};

export default useServiceMedia;

