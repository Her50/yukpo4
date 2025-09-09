// Configuration des API de géocodage
// Copiez ce fichier vers api-keys.ts et ajoutez vos clés API

export const API_KEYS = {
  // Clé API Google Maps (optionnel)
  // Obtenez votre clé sur: https://console.cloud.google.com/apis/credentials
  GOOGLE_MAPS_API_KEY: 'your_google_maps_api_key_here',
  
  // Configuration du service de géocodage
  // true = utiliser Google Maps API (nécessite une clé)
  // false = utiliser Nominatim (gratuit, mais avec limitations CORS)
  USE_GOOGLE_GEOCODING: false,
};

// Instructions:
// 1. Copiez ce fichier vers api-keys.ts
// 2. Remplacez 'your_google_maps_api_key_here' par votre vraie clé API Google Maps
// 3. Si vous voulez utiliser Google Maps, mettez USE_GOOGLE_GEOCODING à true
// 4. Si vous voulez utiliser Nominatim (gratuit), laissez USE_GOOGLE_GEOCODING à false 