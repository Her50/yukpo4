// Suppression des warnings de dépréciation
// Ce fichier contient des utilitaires pour supprimer les warnings gênants

// Supprimer les warnings de dépréciation CSS
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args[0];
  if (typeof message === 'string') {
    // Ignorer les warnings de dépréciation CSS
    if (message.includes('-ms-high-contrast') || 
        message.includes('google.maps') ||
        message.includes('React Router Future Flag') ||
        message.includes('Timeout expired') ||
        message.includes('Erreur de suivi GPS') ||
        message.includes('Précision GPS insuffisante') ||
        message.includes('Erreur lors de la mise à jour GPS') ||
        message.includes('Erreur géolocalisation')) {
      return;
    }
  }
  originalWarn.apply(console, args);
};

// Supprimer les warnings de dépréciation spécifiques
const originalError = console.error;
console.error = (...args) => {
  const message = args[0];
  if (typeof message === 'string') {
    // Ignorer les erreurs de dépréciation spécifiques
    if (message.includes('google.maps.Marker is deprecated') ||
        message.includes('google.maps.places.SearchBox')) {
      return;
    }
  }
  originalError.apply(console, args);
};

export {}; 