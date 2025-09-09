// Configuration progressive des WebSockets
// Ce fichier permet de réactiver les WebSockets étape par étape

export const WEBSOCKET_PROGRESSIVE_CONFIG = {
  // Phase 1: Diagnostic et nettoyage (ACTUELLE)
  phase1: {
    enabled: false,
    description: "WebSockets désactivés pour diagnostic",
    components: {
      status: false,        // Statut en ligne des prestataires
      notifications: false, // Notifications push
      chat: false,          // Chat en temps réel
      access: false         // Accès en temps réel
    }
  },
  
  // Phase 2: Réactivation progressive
  phase2: {
    enabled: true,
    description: "Réactivation progressive des WebSockets",
    components: {
      status: true,         // Commencer par le statut (le plus simple)
      notifications: true,  // Activer les notifications
      chat: true,           // Activer le chat
      access: true          // Activer l'accès
    }
  },
  
  // Phase 3: Fonctionnalités avancées
  phase3: {
    enabled: true,
    description: "Toutes les fonctionnalités WebSocket activées",
    components: {
      status: true,
      notifications: true,
      chat: true,
      access: true
    }
  }
};

// Configuration actuelle (modifier cette ligne pour changer de phase)
export const CURRENT_PHASE: 'phase1' | 'phase2' | 'phase3' = 'phase3';

// Fonction utilitaire pour obtenir la configuration actuelle
export const getCurrentWebSocketConfig = () => {
  return WEBSOCKET_PROGRESSIVE_CONFIG[CURRENT_PHASE as keyof typeof WEBSOCKET_PROGRESSIVE_CONFIG];
};

// Fonction utilitaire pour vérifier si un composant est activé
export const isWebSocketComponentEnabled = (component: 'status' | 'notifications' | 'chat' | 'access') => {
  const config = getCurrentWebSocketConfig();
  return config.enabled && config.components[component];
};

// Messages d'information pour chaque phase
export const PHASE_MESSAGES = {
  phase1: {
    title: "🔌 WebSockets en diagnostic",
    description: "Les WebSockets sont temporairement désactivés pour résoudre les erreurs",
    actions: [
      "Diagnostic des composants",
      "Nettoyage du code",
      "Préparation de la réactivation"
    ]
  },
  phase2: {
    title: "🔄 WebSockets en réactivation",
    description: "Réactivation progressive des fonctionnalités WebSocket",
    actions: [
      "Statut en ligne activé",
      "Tests de stabilité",
      "Préparation des notifications"
    ]
  },
  phase3: {
    title: "✅ WebSockets opérationnels",
    description: "Toutes les fonctionnalités WebSocket sont actives",
    actions: [
      "Chat en temps réel",
      "Notifications push",
      "Statut en ligne",
      "Accès en temps réel"
    ]
  }
};

// Instructions pour passer à la phase suivante
export const getNextPhaseInstructions = () => {
  const currentPhase = CURRENT_PHASE as 'phase1' | 'phase2' | 'phase3';
  switch (currentPhase) {
    case 'phase1':
      return {
        nextPhase: 'phase2',
        instructions: [
          "1. Vérifier que le backend WebSocket fonctionne",
          "2. Tester le composant de statut en ligne",
          "3. Modifier CURRENT_PHASE = 'phase2'",
          "4. Redémarrer l'application"
        ]
      };
    case 'phase2':
      return {
        nextPhase: 'phase3',
        instructions: [
          "1. Vérifier la stabilité du statut en ligne",
          "2. Tester les notifications",
          "3. Modifier CURRENT_PHASE = 'phase3'",
          "4. Redémarrer l'application"
        ]
      };
    case 'phase3':
      return {
        nextPhase: 'complete',
        instructions: [
          "🎉 Toutes les fonctionnalités WebSocket sont opérationnelles !",
          "Surveiller les performances et la stabilité"
        ]
      };
    default:
      return {
        nextPhase: 'phase1',
        instructions: [
          "Revenir à la phase 1 pour le diagnostic"
        ]
      };
  }
}; 