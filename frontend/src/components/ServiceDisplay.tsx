import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  Grid,
  Rating,
  Button,
  Avatar,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  LocationOn,
  Phone,
  Email,
  AccessTime,
  Star,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  Map as MapIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ServiceData {
  id: number;
  titre_service: string;
  category: string;
  description: string;
  gps_fixe?: string;
  gps?: string;
  logo?: string;
  banniere?: string;
  images_realisations?: string[];
  videos?: string[];
  prix?: number;
  devise?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  horaires?: string;
  zone_intervention?: string;
  created_at: string;
  user_id: number;
  is_tarissable?: boolean;
  vitesse_tarissement?: string;
}

interface ServiceDisplayProps {
  service: ServiceData;
  onContact?: (service: ServiceData) => void;
  onViewDetails?: (service: ServiceData) => void;
  showActions?: boolean;
}

const ServiceDisplay: React.FC<ServiceDisplayProps> = ({
  service,
  onContact,
  onViewDetails,
  showActions = true
}) => {
  const { t } = useTranslation();

  const getLocationDisplay = () => {
    if (service.gps_fixe) {
      return service.gps_fixe;
    }
    if (service.gps) {
      return service.gps;
    }
    if (service.adresse) {
      return service.adresse;
    }
    return t('service.location.not_available', 'Localisation non disponible');
  };

  const getLocationType = () => {
    if (service.gps_fixe) {
      return t('service.location.fixed', 'Lieu fixe');
    }
    if (service.gps) {
      return t('service.location.provider', 'Localisation prestataire');
    }
    return t('service.location.address', 'Adresse');
  };

  const formatPrice = (prix?: number, devise?: string) => {
    if (!prix) return t('service.price.not_available', 'Prix non disponible');
    return `${prix.toLocaleString()} ${devise || 'XAF'}`;
  };

  const getMainImage = () => {
    return service.banniere || service.logo || service.images_realisations?.[0];
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Image principale */}
      {getMainImage() && (
        <CardMedia
          component="img"
          height="200"
          image={getMainImage()}
          alt={service.titre_service}
          sx={{ objectFit: 'cover' }}
        />
      )}

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* En-tête avec logo et titre */}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {service.logo && (
            <Avatar
              src={service.logo}
              alt={`Logo ${service.titre_service}`}
              sx={{ width: 56, height: 56 }}
            />
          )}
          <Box flex={1}>
            <Typography variant="h6" component="h2" gutterBottom>
              {service.titre_service}
            </Typography>
            <Chip 
              label={service.category} 
              color="primary" 
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" paragraph>
          {service.description}
        </Typography>

        {/* Informations de localisation */}
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <LocationOn color="action" fontSize="small" />
          <Box>
            <Typography variant="body2" component="span">
              {getLocationDisplay()}
            </Typography>
            <Chip 
              label={getLocationType()} 
              size="small" 
              variant="outlined"
              sx={{ ml: 1 }}
            />
          </Box>
        </Box>

        {/* Zone d'intervention */}
        {service.zone_intervention && (
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <MapIcon color="action" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {t('service.zone_intervention', 'Zone d\'intervention')}: {service.zone_intervention}
            </Typography>
          </Box>
        )}

        {/* Prix et tarification */}
        {service.is_tarissable && (
          <Box mb={2}>
            <Typography variant="body2" color="primary" fontWeight="bold">
              {formatPrice(service.prix, service.devise)}
            </Typography>
            {service.vitesse_tarissement && (
              <Chip 
                label={t(`service.tarissement.${service.vitesse_tarissement}`, service.vitesse_tarissement)} 
                size="small" 
                color="secondary"
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        )}

        {/* Horaires */}
        {service.horaires && (
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <AccessTime color="action" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {service.horaires}
            </Typography>
          </Box>
        )}

        {/* Médias disponibles */}
        <Box display="flex" gap={1} mb={2}>
          {service.logo && (
            <Tooltip title={t('service.media.logo', 'Logo disponible')}>
              <Chip icon={<ImageIcon />} label="Logo" size="small" variant="outlined" />
            </Tooltip>
          )}
          {service.banniere && (
            <Tooltip title={t('service.media.banniere', 'Bannière disponible')}>
              <Chip icon={<ImageIcon />} label="Bannière" size="small" variant="outlined" />
            </Tooltip>
          )}
          {service.images_realisations && service.images_realisations.length > 0 && (
            <Tooltip title={t('service.media.images', '{{count}} images de réalisations', { count: service.images_realisations.length })}>
              <Chip icon={<ImageIcon />} label={`${service.images_realisations.length} images`} size="small" variant="outlined" />
            </Tooltip>
          )}
          {service.videos && service.videos.length > 0 && (
            <Tooltip title={t('service.media.videos', '{{count}} vidéos disponibles', { count: service.videos.length })}>
              <Chip icon={<VideoIcon />} label={`${service.videos.length} vidéos`} size="small" variant="outlined" />
            </Tooltip>
          )}
        </Box>

        {/* Informations de contact */}
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            {t('service.contact.title', 'Contact')}
          </Typography>
          <Grid container spacing={1}>
            {service.telephone && (
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Phone fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {service.telephone}
                  </Typography>
                </Box>
              </Grid>
            )}
            {service.email && (
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Email fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {service.email}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Box>

        {/* Date de création */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
          {t('service.created_at', 'Créé le')} {new Date(service.created_at).toLocaleDateString()}
        </Typography>

        {/* Actions */}
        {showActions && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" gap={1}>
              {onViewDetails && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onViewDetails(service)}
                  fullWidth
                >
                  {t('service.actions.view_details', 'Voir les détails')}
                </Button>
              )}
              {onContact && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => onContact(service)}
                  fullWidth
                >
                  {t('service.actions.contact', 'Contacter')}
                </Button>
              )}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ServiceDisplay; 