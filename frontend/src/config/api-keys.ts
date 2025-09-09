// Configuration des API de géocodage
// Configuration automatique avec la clé API Google Maps trouvée

export const API_KEYS = {
  // Clé API Google Maps (configurée automatiquement)
  // Clé trouvée dans fix-env.ps1
  GOOGLE_MAPS_API_KEY: 'AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ',
  
  // Configuration du service de géocodage
  // true = utiliser Google Maps API (plus fiable et moderne)
  // false = utiliser Nominatim (gratuit, mais avec limitations CORS)
  USE_GOOGLE_GEOCODING: true, // Activé automatiquement pour une solution moderne
}; 