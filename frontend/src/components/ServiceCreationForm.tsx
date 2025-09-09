import React, { useState, useRef } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Grid, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Switch, 
  FormControlLabel,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ServiceFormData {
  titre_service: string;
  category: string;
  description: string;
  is_tarissable: boolean;
  vitesse_tarissement?: string;
  gps_fixe?: string;
  logo?: File | null;
  banniere?: File | null;
  images_realisations: File[];
  videos: File[];
  prix?: number;
  devise?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  horaires?: string;
  zone_intervention?: string;
}

interface ServiceCreationFormProps {
  onSubmit: (data: ServiceFormData) => Promise<void>;
  loading?: boolean;
}

const ServiceCreationForm: React.FC<ServiceCreationFormProps> = ({ 
  onSubmit, 
  loading = false 
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ServiceFormData>({
    titre_service: '',
    category: '',
    description: '',
    is_tarissable: false,
    vitesse_tarissement: '',
    gps_fixe: '',
    logo: null,
    banniere: null,
    images_realisations: [],
    videos: [],
    prix: undefined,
    devise: 'XAF',
    adresse: '',
    telephone: '',
    email: '',
    horaires: '',
    zone_intervention: ''
  });

  const [errors, setErrors] = useState<Partial<ServiceFormData>>({});
  const fileInputRefs = {
    logo: useRef<HTMLInputElement>(null),
    banniere: useRef<HTMLInputElement>(null),
    images_realisations: useRef<HTMLInputElement>(null),
    videos: useRef<HTMLInputElement>(null)
  };

  const categories = [
    'Services automobiles',
    'Immobilier',
    'Éducation',
    'Santé',
    'Technologie',
    'Restauration',
    'Événementiel',
    'Commerce',
    'Services professionnels',
    'Artisanat',
    'Transport',
    'Loisirs',
    'Autres'
  ];

  const vitesses_tarissement = ['lente', 'moyenne', 'rapide'];
  const devises = ['XAF', 'EUR', 'USD', 'GBP'];

  const handleInputChange = (field: keyof ServiceFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFileChange = (field: keyof ServiceFormData, files: FileList | null) => {
    if (!files) return;

    if (field === 'logo' || field === 'banniere') {
      setFormData(prev => ({ ...prev, [field]: files[0] }));
    } else if (field === 'images_realisations') {
      const newImages = Array.from(files);
      setFormData(prev => ({ 
        ...prev, 
        images_realisations: [...prev.images_realisations, ...newImages] 
      }));
    } else if (field === 'videos') {
      const newVideos = Array.from(files);
      setFormData(prev => ({ 
        ...prev, 
        videos: [...prev.videos, ...newVideos] 
      }));
    }
  };

  const removeFile = (field: keyof ServiceFormData, index?: number) => {
    if (field === 'logo' || field === 'banniere') {
      setFormData(prev => ({ ...prev, [field]: null }));
    } else if (field === 'images_realisations' && index !== undefined) {
      setFormData(prev => ({
        ...prev,
        images_realisations: prev.images_realisations.filter((_, i) => i !== index)
      }));
    } else if (field === 'videos' && index !== undefined) {
      setFormData(prev => ({
        ...prev,
        videos: prev.videos.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<ServiceFormData> = {};

    if (!formData.titre_service.trim()) {
      newErrors.titre_service = 'Le titre du service est obligatoire';
    }
    if (!formData.category) {
      newErrors.category = 'La catégorie est obligatoire';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'La description est obligatoire';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Erreur lors de la création du service:', error);
    }
  };

  const openFileDialog = (field: keyof ServiceFormData) => {
    fileInputRefs[field].current?.click();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom align="center" color="primary">
        {t('service.creation.title', 'Créer un Nouveau Service')}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('service.creation.basic_info', 'Informations de Base')}
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('service.creation.title_label', 'Titre du Service *')}
                value={formData.titre_service}
                onChange={(e) => handleInputChange('titre_service', e.target.value)}
                error={!!errors.titre_service}
                helperText={errors.titre_service}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.category}>
                <InputLabel>{t('service.creation.category_label', 'Catégorie *')}</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  label={t('service.creation.category_label', 'Catégorie *')}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_tarissable}
                    onChange={(e) => handleInputChange('is_tarissable', e.target.checked)}
                  />
                }
                label={t('service.creation.tarissable_label', 'Service tarissable')}
              />
            </Grid>

            {formData.is_tarissable && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('service.creation.vitesse_label', 'Vitesse de tarissement')}</InputLabel>
                  <Select
                    value={formData.vitesse_tarissement || ''}
                    onChange={(e) => handleInputChange('vitesse_tarissement', e.target.value)}
                    label={t('service.creation.vitesse_label', 'Vitesse de tarissement')}
                  >
                    {vitesses_tarissement.map((vitesse) => (
                      <MenuItem key={vitesse} value={vitesse}>
                        {t(`service.creation.vitesse.${vitesse}`, vitesse)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label={t('service.creation.description_label', 'Description *')}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                error={!!errors.description}
                helperText={errors.description}
                required
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('service.creation.location', 'Localisation')}
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('service.creation.gps_fixe_label', 'Coordonnées GPS fixes (optionnel)')}
                placeholder="48.8566,2.3522"
                value={formData.gps_fixe}
                onChange={(e) => handleInputChange('gps_fixe', e.target.value)}
                helperText={t('service.creation.gps_fixe_help', 'Format: latitude,longitude (ex: 48.8566,2.3522)')}
                InputProps={{
                  startAdornment: <LocationIcon color="action" sx={{ mr: 1 }} />
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('service.creation.adresse_label', 'Adresse')}
                value={formData.adresse}
                onChange={(e) => handleInputChange('adresse', e.target.value)}
                placeholder="123 Rue de la Paix, Ville"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('service.creation.zone_intervention_label', 'Zone d\'intervention')}
                value={formData.zone_intervention}
                onChange={(e) => handleInputChange('zone_intervention', e.target.value)}
                placeholder="Paris et banlieue"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('service.creation.media', 'Médias et Visuels')}
          </Typography>
          
          <Grid container spacing={3}>
            {/* Logo */}
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('service.creation.logo_label', 'Logo du service')}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => openFileDialog('logo')}
                  sx={{ mb: 2 }}
                >
                  {formData.logo ? t('service.creation.change_logo', 'Changer le logo') : t('service.creation.add_logo', 'Ajouter un logo')}
                </Button>
                {formData.logo && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip 
                      label={formData.logo.name} 
                      onDelete={() => removeFile('logo')}
                      color="primary"
                    />
                  </Box>
                )}
                <input
                  ref={fileInputRefs.logo}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange('logo', e.target.files)}
                />
              </Box>
            </Grid>

            {/* Bannière */}
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('service.creation.banniere_label', 'Bannière du service')}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => openFileDialog('banniere')}
                  sx={{ mb: 2 }}
                >
                  {formData.banniere ? t('service.creation.change_banniere', 'Changer la bannière') : t('service.creation.add_banniere', 'Ajouter une bannière')}
                </Button>
                {formData.banniere && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip 
                      label={formData.banniere.name} 
                      onDelete={() => removeFile('banniere')}
                      color="primary"
                    />
                  </Box>
                )}
                <input
                  ref={fileInputRefs.banniere}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange('banniere', e.target.files)}
                />
              </Box>
            </Grid>

            {/* Images de réalisations */}
            <Grid item xs={12}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('service.creation.images_realisations_label', 'Images de réalisations')}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => openFileDialog('images_realisations')}
                  sx={{ mb: 2 }}
                >
                  {t('service.creation.add_images', 'Ajouter des images')}
                </Button>
                {formData.images_realisations.length > 0 && (
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {formData.images_realisations.map((file, index) => (
                      <Chip
                        key={index}
                        label={file.name}
                        onDelete={() => removeFile('images_realisations', index)}
                        color="secondary"
                      />
                    ))}
                  </Box>
                )}
                <input
                  ref={fileInputRefs.images_realisations}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange('images_realisations', e.target.files)}
                />
              </Box>
            </Grid>

            {/* Vidéos */}
            <Grid item xs={12}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('service.creation.videos_label', 'Vidéos de présentation')}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<VideoIcon />}
                  onClick={() => openFileDialog('videos')}
                  sx={{ mb: 2 }}
                >
                  {t('service.creation.add_videos', 'Ajouter des vidéos')}
                </Button>
                {formData.videos.length > 0 && (
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {formData.videos.map((file, index) => (
                      <Chip
                        key={index}
                        label={file.name}
                        onDelete={() => removeFile('videos', index)}
                        color="secondary"
                      />
                    ))}
                  </Box>
                )}
                <input
                  ref={fileInputRefs.videos}
                  type="file"
                  accept="video/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange('videos', e.target.files)}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('service.creation.contact', 'Informations de Contact')}
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('service.creation.telephone_label', 'Téléphone')}
                value={formData.telephone}
                onChange={(e) => handleInputChange('telephone', e.target.value)}
                placeholder="+237 6XX XXX XXX"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('service.creation.email_label', 'Email')}
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="contact@service.com"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('service.creation.horaires_label', 'Horaires d\'ouverture')}
                value={formData.horaires}
                onChange={(e) => handleInputChange('horaires', e.target.value)}
                placeholder="Lun-Ven: 8h-18h, Sam: 9h-17h"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box display="flex" justifyContent="center" gap={2}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? t('common.creating', 'Création...') : t('service.creation.submit', 'Créer le Service')}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mt: 2 }}>
        {t('service.creation.info', 'Les champs marqués d\'un * sont obligatoires. Les autres champs sont optionnels et peuvent être ajoutés plus tard.')}
      </Alert>
    </Box>
  );
};

export default ServiceCreationForm; 