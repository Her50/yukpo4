// Configuration du debug - Modifier cette valeur pour activer/désactiver le debug
export const DEBUG_CONFIG = {
  // Activer le debug WebSocket
  SHOW_WEBSOCKET_DEBUG: false,
  
  // Activer le debug des positions des indicateurs
  SHOW_POSITION_DEBUG: false,
  
  // Activer tous les composants de debug
  SHOW_ALL_DEBUG: false
};

// Fonction utilitaire pour vérifier si le debug est activé
export const isDebugEnabled = (type: keyof typeof DEBUG_CONFIG): boolean => {
  return DEBUG_CONFIG.SHOW_ALL_DEBUG || DEBUG_CONFIG[type];
}; 