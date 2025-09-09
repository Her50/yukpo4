import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  MyLocation,
  Search,
  Map,
  LocationOn,
  Route,
  Layers,
  Settings,
  Clear,
  ZoomIn,
  ZoomOut
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface AdvancedGeospatialSearchProps {
  onSearch: (searchParams: any) => void;
  loading?: boolean;
  initialLocation?: { latitude: number; longitude: number };
}

const AdvancedGeospatialSearch: React.FC<AdvancedGeospatialSearchProps> = ({
  onSearch,
  loading = false,
  initialLocation
}) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useState({
    latitude: initialLocation?.latitude || 0,
    longitude: initialLocation?.longitude || 0,
    radiusKm: 50,
    category: '',
    maxResults: 20,
    useCurrentLocation: false,
    advancedFilters: {
      gpsFixeOnly: false,
      mobileServices: false,
      urgentServices: false,
      verifiedServices: false
    }
  });

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);

  const [locationError, setLocationError] = useState<string>('');
  const [searchHistory, setSearchHistory] = useState<Array<{
    id: string;
    name: string;
    params: any;
    timestamp: Date;
  }>>([]);

  const mapRef = useRef<HTMLDivElement>(null);

  // Obtenir la localisation actuelle
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Géolocalisation non supportée par le navigateur');
      return;
    }

    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setCurrentLocation(location);
        setSearchParams(prev => ({
          ...prev,
          latitude: location.latitude,
          longitude: location.longitude,
          useCurrentLocation: true
        }));
      },
      (error) => {
        setLocationError(`Erreur de géolocalisation: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  // Gérer les changements de paramètres
  const handleParamChange = (field: string, value: any) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Gérer les changements de filtres avancés
  const handleAdvancedFilterChange = (filter: string, value: boolean) => {
    setSearchParams(prev => ({
      ...prev,
      advancedFilters: {
        ...prev.advancedFilters,
        [filter]: value
      }
    }));
  };

  // Lancer la recherche
  const handleSearch = () => {
    const searchId = `search_${Date.now()}`;
    const searchName = `Recherche ${searchParams.category || 'générale'} - ${searchParams.radiusKm}km`;
    
    // Ajouter à l'historique
    setSearchHistory(prev => [{
      id: searchId,
      name: searchName,
      params: { ...searchParams },
      timestamp: new Date()
    }, ...prev.slice(0, 9)]); // Garder seulement les 10 dernières recherches

    // Lancer la recherche
    onSearch(searchParams);
  };

  // Réutiliser une recherche précédente
  const reuseSearch = (searchItem: any) => {
    setSearchParams(searchItem.params);
    onSearch(searchItem.params);
  };

  // Effacer tous les paramètres
  const clearSearch = () => {
    setSearchParams({
      latitude: 0,
      longitude: 0,
      radiusKm: 50,
      category: '',
      maxResults: 20,
      useCurrentLocation: false,
      advancedFilters: {
        gpsFixeOnly: false,
        mobileServices: false,
        urgentServices: false,
        verifiedServices: false
      }
    });
  };

  // Utiliser la localisation actuelle
  useEffect(() => {
    if (searchParams.useCurrentLocation && currentLocation) {
      setSearchParams(prev => ({
        ...prev,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      }));
    }
  }, [searchParams.useCurrentLocation, currentLocation]);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🗺️ {t('search.geospatial.advanced', 'Recherche Géospatiale Avancée')}
        </Typography>

        <Grid container spacing={3}>
          {/* Section Localisation */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              📍 {t('search.geospatial.location', 'Localisation')}
            </Typography>
            
            <Box display="flex" gap={2} mb={2}>
              <Button
                variant="outlined"
                startIcon={<MyLocation />}
                onClick={getCurrentLocation}
                disabled={loading}
              >
                {t('search.geospatial.use_current', 'Utiliser ma position')}
              </Button>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={searchParams.useCurrentLocation}
                    onChange={(e) => handleParamChange('useCurrentLocation', e.target.checked)}
                  />
                }
                label={t('search.geospatial.auto_update', 'Mise à jour automatique')}
              />
            </Box>

            {locationError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {locationError}
              </Alert>
            )}

            {currentLocation && (
              <Alert severity="success" sx={{ mb: 2 }}>
                📍 Position actuelle: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                {currentLocation.accuracy && ` (Précision: ±${Math.round(currentLocation.accuracy)}m)`}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label={t('search.geospatial.latitude', 'Latitude')}
                  type="number"
                  value={searchParams.latitude}
                  onChange={(e) => handleParamChange('latitude', parseFloat(e.target.value))}
                  inputProps={{ step: 0.000001 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label={t('search.geospatial.longitude', 'Longitude')}
                  type="number"
                  value={searchParams.longitude}
                  onChange={(e) => handleParamChange('longitude', parseFloat(e.target.value))}
                  inputProps={{ step: 0.000001 }}
                />
              </Grid>
            </Grid>
          </Grid>

          {/* Section Paramètres de Recherche */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              ⚙️ {t('search.geospatial.parameters', 'Paramètres de Recherche')}
            </Typography>

            <Box mb={2}>
              <Typography gutterBottom>
                {t('search.geospatial.radius', 'Rayon de recherche:')} {searchParams.radiusKm} km
              </Typography>
              <Slider
                value={searchParams.radiusKm}
                onChange={(_, value) => handleParamChange('radiusKm', value)}
                min={1}
                max={500}
                step={1}
                marks={[
                  { value: 1, label: '1km' },
                  { value: 50, label: '50km' },
                  { value: 100, label: '100km' },
                  { value: 500, label: '500km' }
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>{t('search.geospatial.category', 'Catégorie')}</InputLabel>
              <Select
                value={searchParams.category}
                onChange={(e) => handleParamChange('category', e.target.value)}
                label={t('search.geospatial.category', 'Catégorie')}
              >
                <MenuItem value="">{t('search.geospatial.all_categories', 'Toutes les catégories')}</MenuItem>
                <MenuItem value="Services automobiles">Services automobiles</MenuItem>
                <MenuItem value="Immobilier">Immobilier</MenuItem>
                <MenuItem value="Éducation">Éducation</MenuItem>
                <MenuItem value="Santé">Santé</MenuItem>
                <MenuItem value="Technologie">Technologie</MenuItem>
                <MenuItem value="Restauration">Restauration</MenuItem>
                <MenuItem value="Événementiel">Événementiel</MenuItem>
                <MenuItem value="Commerce">Commerce</MenuItem>
                <MenuItem value="Services professionnels">Services professionnels</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label={t('search.geospatial.max_results', 'Nombre maximum de résultats')}
              type="number"
              value={searchParams.maxResults}
              onChange={(e) => handleParamChange('maxResults', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>

          {/* Section Filtres Avancés */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              🔍 {t('search.geospatial.advanced_filters', 'Filtres Avancés')}
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={searchParams.advancedFilters.gpsFixeOnly}
                      onChange={(e) => handleAdvancedFilterChange('gpsFixeOnly', e.target.checked)}
                    />
                  }
                  label={t('search.geospatial.gps_fixe_only', 'GPS fixe uniquement')}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={searchParams.advancedFilters.mobileServices}
                      onChange={(e) => handleAdvancedFilterChange('mobileServices', e.target.checked)}
                    />
                  }
                  label={t('search.geospatial.mobile_services', 'Services mobiles')}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={searchParams.advancedFilters.urgentServices}
                      onChange={(e) => handleAdvancedFilterChange('urgentServices', e.target.checked)}
                    />
                  }
                  label={t('search.geospatial.urgent_services', 'Services urgents')}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={searchParams.advancedFilters.verifiedServices}
                      onChange={(e) => handleAdvancedFilterChange('verifiedServices', e.target.checked)}
                    />
                  }
                  label={t('search.geospatial.verified_services', 'Services vérifiés')}
                />
              </Grid>
            </Grid>
          </Grid>

          {/* Section Actions */}
          <Grid item xs={12}>
            <Box display="flex" gap={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<Search />}
                onClick={handleSearch}
                disabled={loading}
                size="large"
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    {t('search.geospatial.searching', 'Recherche...')}
                  </>
                ) : (
                  t('search.geospatial.search', 'Rechercher')
                )}
              </Button>

              <Button
                variant="outlined"
                startIcon={<Clear />}
                onClick={clearSearch}
                disabled={loading}
              >
                {t('search.geospatial.clear', 'Effacer')}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Historique des recherches */}
        {searchHistory.length > 0 && (
          <Box mt={3}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              📚 {t('search.geospatial.history', 'Historique des Recherches')}
            </Typography>
            
            <Box display="flex" flexWrap="wrap" gap={1}>
              {searchHistory.map((searchItem) => (
                <Chip
                  key={searchItem.id}
                  label={searchItem.name}
                  onClick={() => reuseSearch(searchItem)}
                  variant="outlined"
                  size="small"
                  clickable
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AdvancedGeospatialSearch; 