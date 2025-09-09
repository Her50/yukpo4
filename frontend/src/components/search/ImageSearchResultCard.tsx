import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { ImageSearchResult } from '@/services/imageSearchService';
import { 
  Star, 
  MapPin, 
  Tag, 
  Phone, 
  Mail, 
  MessageCircle,
  Eye,
  Camera
} from 'lucide-react';

interface ImageSearchResultCardProps {
  result: ImageSearchResult;
  onViewService?: (serviceId: number) => void;
}

const ImageSearchResultCard: React.FC<ImageSearchResultCardProps> = ({ 
  result, 
  onViewService 
}) => {
  const serviceData = result.service_data;
  
  // Extraire les informations du service
  const getServiceFieldValue = (field: any): string => {
    if (!field) return 'Non spécifié';
    if (typeof field === 'string') return field;
    if (field && typeof field === 'object' && field.valeur !== undefined) {
      return String(field.valeur);
    }
    return 'Non spécifié';
  };

  const serviceTitle = serviceData ? getServiceFieldValue(serviceData.titre_service) : 'Service non trouvé';
  const serviceCategory = serviceData ? getServiceFieldValue(serviceData.category) : 'Non spécifié';
  const serviceDescription = serviceData ? getServiceFieldValue(serviceData.description) : 'Aucune description';
  const serviceLocation = serviceData ? getServiceFieldValue(serviceData.localisation) : 'Non spécifié';

  return (
    <Card className="w-full hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
              {serviceTitle}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                <Tag className="w-3 h-3 mr-1" />
                {serviceCategory}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Camera className="w-3 h-3 mr-1" />
                Similarité: {(result.similarity_score * 100).toFixed(1)}%
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Score: {result.similarity_score.toFixed(3)}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Image de l'image trouvée */}
        <div className="mb-4">
          <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            <img
              src={result.path}
              alt={`Image similaire - ${serviceTitle}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder-image.jpg';
              }}
            />
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-xs bg-black bg-opacity-50 text-white">
                <Eye className="w-3 h-3 mr-1" />
                Image trouvée
              </Badge>
            </div>
          </div>
        </div>

        {/* Informations du service */}
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
            {serviceDescription}
          </p>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <MapPin className="w-4 h-4" />
            <span>{serviceLocation}</span>
          </div>

          {/* Métadonnées de l'image */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div>Format: {result.image_metadata.format.toUpperCase()}</div>
            <div>Taille: {result.image_metadata.width}×{result.image_metadata.height}</div>
            <div>Luminosité: {(result.image_metadata.brightness * 100).toFixed(0)}%</div>
            <div>Contraste: {(result.image_metadata.contrast * 100).toFixed(0)}%</div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {onViewService && (
              <Button
                onClick={() => onViewService(result.service_id)}
                className="flex-1"
                size="sm"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Voir le service
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ImageSearchResultCard; 