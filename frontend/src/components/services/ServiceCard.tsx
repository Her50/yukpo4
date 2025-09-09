import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Tag,
  Star, 
  Phone, 
  Mail,
  Video,
  Share2,
  Heart,
  Clock,
  MessageSquare,
  Wifi,
  WifiOff,
  Globe,
  Calendar,
  MapPin,
  MessageCircle,
  Eye,
  ThumbsUp,
  TrendingUp,
  Users
} from 'lucide-react';
import { Service } from '@/types/service';
import ServiceMediaGallery from '@/components/ui/ServiceMediaGallery';
import { ServiceRating } from '@/components/ui/ServiceRating';
import LocationDisplay from '@/components/location/LocationDisplay';
import LocationDisplayModern from '@/components/location/LocationDisplayModern';
import ServiceStats from './ServiceStats';
import { useToast } from '@/components/ui/use-toast';
import useServiceMedia from '@/hooks/useServiceMedia';

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
    
    if (Object.keys(field).length > 0) {
      const possibleValues = ['value', 'content', 'text', 'data', 'info'];
      for (const key of possibleValues) {
        if (field[key] !== undefined) {
          const value = field[key];
          if (typeof value === 'string') return value;
          if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
          if (typeof value === 'number') return value.toString();
        }
      }
    }
  }
  
  if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
  if (typeof field === 'number') return field.toString();
  
  return 'Non spécifié';
};

// Fonction utilitaire pour vérifier si un champ média existe réellement
const hasValidMediaField = (field: any): boolean => {
  if (!field) return false;
  if (typeof field === 'string') return field.trim() !== '' && field !== 'Non spécifié';
  if (field.valeur !== undefined) {
    const value = field.valeur;
    if (typeof value === 'string') return value.trim() !== '' && value !== 'Non spécifié';
    if (Array.isArray(value)) return value.length > 0;
  }
  return false;
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

// Fonction pour calculer le padding top optimal du CardHeader
const calculateHeaderPadding = (hasLogo: boolean, wsConnected: boolean): string => {
  if (hasLogo) return 'pt-16';
  if (wsConnected) return 'pt-8';
  return 'pt-2';
};

// Fonction pour formater la date de manière complète
const formatDate = (dateString: string): string => {
  if (!dateString) return 'Date non disponible';
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const monthNames = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    
    return `${day} ${monthNames[month]} ${year}`;
  } catch {
    return 'Date invalide';
  }
};



// ?? NOUVEAU : Fonction pour vérifier le statut en ligne réel
const useOnlineStatus = (userId: number, wsConnected: boolean, userStatus: any, serviceCreatedAt: string) => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  useEffect(() => {
    if (wsConnected && userStatus) {
      // Vérifier le statut réel depuis les données WebSocket
      const isUserOnline = userStatus.status === 'online' || userStatus.isActive;
      setIsOnline(isUserOnline);
      
      if (!isUserOnline && userStatus.lastSeen) {
        setLastSeen(new Date(userStatus.lastSeen));
      }
    } else {
      // Si WebSocket non connecté, simuler un statut basé sur l'activité récente
      const now = new Date();
      const serviceDate = new Date(serviceCreatedAt || now);
      const diffHours = (now.getTime() - serviceDate.getTime()) / (1000 * 60 * 60);
      setIsOnline(diffHours < 24); // Considérer en ligne si service créé récemment
    }
  }, [userId, wsConnected, userStatus, serviceCreatedAt]);

  return { isOnline, lastSeen };
};

interface ServiceCardProps {
  service: Service;
  prestataires: Map<number, any>;
  user: any;
  wsConnected: boolean;
  userStatus: any;
  onContact: (service: Service) => void;
  onChat: (service: Service) => void;
  onGallery: (service: Service) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  prestataires,
  user,
  wsConnected,
  userStatus,
  onContact,
  onChat,
  onGallery
}) => {
  const prestataireInfo = prestataires.get(service.user_id);
  const { isOnline, lastSeen } = useOnlineStatus(service.user_id, wsConnected, userStatus, service.created_at);
  const { toast } = useToast();
  
  // Récupérer les médias réels depuis la base de données
  const serviceMedia = useServiceMedia(service.id);

  const handleFavorite = () => {
    toast({
      title: "Ajouté aux favoris !",
      description: "Ce service a été ajouté à votre liste de favoris",
      type: "success"
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: getServiceFieldValue(service.data?.titre_service),
        text: getServiceFieldValue(service.data?.description),
        url: `${window.location.origin}/service/${service.id}`
      }).catch(console.error);
    } else {
      const serviceUrl = `${window.location.origin}/service/${service.id}`;
      navigator.clipboard.writeText(serviceUrl).then(() => {
        toast({
          title: "Lien copié !",
          description: "Le lien du service a été copié dans le presse-papier",
          type: "success"
        });
      });
    }
  };

  const handleGalleryClick = () => {
    console.log('🖼️ [ServiceCard] Ouverture galerie pour service:', service.id);
    console.log('📊 [ServiceCard] Médias disponibles:', serviceMedia);
    onGallery(service);
  };

  // Afficher les médias réels ou fallback sur les données du service
  const getDisplayMedia = () => {
    console.log('📊 [ServiceCard] État médias:', {
      loading: serviceMedia.loading,
      error: serviceMedia.error,
      totalCount: serviceMedia.totalCount,
      images: serviceMedia.images.length,
      videos: serviceMedia.videos.length
    });

    if (serviceMedia.loading) {
      return {
        images: [],
        videos: [],
        hasMedia: false
      };
    }

    if (serviceMedia.error) {
      console.warn('⚠️ [ServiceCard] Erreur médias, utilisation fallback:', serviceMedia.error);
      // Fallback sur les données du service si l'API échoue
      return {
        images: getServiceMediaValue(service.data?.images_realisations),
        videos: getServiceMediaValue(service.data?.videos),
        hasMedia: getServiceMediaValue(service.data?.images_realisations).length > 0 || 
                 getServiceMediaValue(service.data?.videos).length > 0
      };
    }

    // Utiliser les médias de la base de données (URLs déjà construites)
    const hasMedia = serviceMedia.images.length > 0 || serviceMedia.videos.length > 0;
    
    console.log('✅ [ServiceCard] Utilisation médias DB:', {
      images: serviceMedia.images,
      videos: serviceMedia.videos,
      hasMedia
    });
    
    return {
      images: serviceMedia.images,
      videos: serviceMedia.videos,
      hasMedia
    };
  };

  const displayMedia = getDisplayMedia();

  return (
    <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-xl border-2 border-blue-200 hover:border-blue-400 bg-white group transform hover:scale-[1.01] font-['SF_Pro_Display',_'Segoe_UI',_'system-ui',_sans-serif]">
      {/* Fond subtil et élégant */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 to-indigo-50/60"></div>
      
      {/* Bannière en arrière-plan très subtile */}
      {hasValidMediaField(service.data?.banniere) && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-8 transition-opacity duration-300 group-hover:opacity-12"
          style={{ 
            backgroundImage: `url(${getServiceFieldValue(service.data?.banniere)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
      )}
      
      {/* Contenu principal */}
      <div className="relative z-10">
        {/* Logo en haut à droite si disponible */}
        {hasValidMediaField(service.data?.logo) && (
          <div className="absolute top-3 right-3 z-20">
            <div className="w-12 h-12 rounded-xl bg-white shadow-md border border-gray-100 p-1">
              <Avatar className="w-full h-full rounded-lg">
                <AvatarImage 
                  src={getServiceFieldValue(service.data?.logo)} 
                  alt="Logo"
                  className="object-cover rounded-lg"
                />
                <AvatarFallback className="bg-blue-50 text-blue-600 font-bold text-xs rounded-lg">
                  {getServiceFieldValue(service.data?.titre_service).substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        )}

        <CardHeader className="pb-2 pt-4 px-4">
          {/* Statistiques épurées */}
          <div className="flex items-center justify-between mb-3">
            <ServiceStats service={service} compact={true} />
            
            {/* Bouton partage simple */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg w-8 h-8 p-0 transition-all"
              title="Partager"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Titre épuré */}
          <CardTitle className="text-lg font-bold text-gray-900 leading-snug mb-2">
            {getServiceFieldValue(service.data?.titre_service)}
          </CardTitle>

          {/* Catégorie simple */}
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-blue-500 text-white text-xs font-medium px-3 py-1">
              {getServiceFieldValue(service.data?.category)}
            </Badge>
            <span className="text-xs text-gray-500 font-medium ml-auto">
              {formatDate(service.created_at)}
            </span>
          </div>

          {/* Description complète */}
          <div className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-100">
            <p className="text-gray-700 text-sm leading-relaxed text-center">
              {getServiceFieldValue(service.data?.description)}
            </p>
          </div>

          {/* Créateur sans avatar */}
          <div className="text-center mb-2 bg-blue-50 rounded-lg p-2 border border-blue-100">
            <h4 className="font-semibold text-base text-gray-900 mb-1">
              {prestataireInfo?.nom_complet || 
               getServiceFieldValue(service.data?.nom_prestataire) || 
               `Créateur #${service.user_id}`}
            </h4>
            
            {/* Statut simple */}
            <div className="flex items-center justify-center gap-1">
              {wsConnected && userStatus ? (
                isOnline ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-600 text-xs font-medium">En ligne</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-500 text-xs">
                      {lastSeen ? `Il y a ${Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60))}min` : 'Hors ligne'}
                    </span>
                  </>
                )
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
                  <span className="text-gray-400 text-xs">Vérification...</span>
                </>
              )}
            </div>
          </div>

          {/* GPS simplifié */}
          <div className="mb-2">
            {!prestataires.has(service.user_id) ? (
              <div className="text-center bg-yellow-50 rounded-lg p-2 border border-yellow-100">
                <span className="text-yellow-600 text-xs font-medium">Localisation en cours...</span>
              </div>
            ) : (
              <LocationDisplayModern 
                service={service} 
                serviceCreatorInfo={prestataires.get(service.user_id)} 
                compact={true}
                className="bg-green-50 rounded-lg border border-green-100"
              />
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4 px-4">
          {/* Galerie média simplifiée */}
          {displayMedia.hasMedia && (
            <div className="mb-3">
              <ServiceMediaGallery
                logo={undefined}
                banniere={undefined}
                images_realisations={displayMedia.images}
                videos={displayMedia.videos}
                className="bg-gray-50 rounded-lg p-3 border border-gray-100"
              />
            </div>
          )}

          {/* Bouton conversation principal */}
          <div className="mb-3">
            <Button 
              onClick={() => onChat(service)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
            >
              <div className="flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5" />
                <span className="text-base">Démarrer une conversation</span>
                {isOnline && (
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                )}
              </div>
            </Button>
          </div>

          {/* Actions secondaires épurées */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Button 
              variant="outline" 
              onClick={handleGalleryClick}
              className="bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 py-2 rounded-lg transition-all duration-300 text-sm font-medium"
            >
              <Eye className="w-4 h-4 mr-2" />
              Galerie
            </Button>
            <Button 
              variant="outline" 
              onClick={handleFavorite}
              className="bg-white hover:bg-red-50 border-gray-200 hover:border-red-200 text-gray-700 hover:text-red-600 py-2 rounded-lg transition-all duration-300 text-sm font-medium"
            >
              <Heart className="w-4 h-4 mr-2" />
              Favoris
            </Button>
          </div>

          {/* Section notation et avis réintégrée */}
          <div className="border-t border-gray-200 pt-3">
            <ServiceRating
              service={service}
              onRatingSubmit={() => {}}
              onReviewHelpful={() => {}}
              className="bg-gray-50 rounded-lg p-3 border border-gray-100"
            />
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export default ServiceCard; 