import { toast } from 'react-hot-toast';

/**
 * Toast unifié pour la création de service avec coût et navigation
 */
export const showServiceCreationToast = (
  coutFactureXAF: number,
  tokensConsommes: number,
  onNavigateHome?: () => void,
  onNavigateToServices?: () => void
) => {
  const message = `Service créé avec succès !\nCoût: ${coutFactureXAF} XAF (${tokensConsommes} tokens)`;
  
  toast.success(message, {
    duration: 15000,
    icon: '🎉',
    style: {
      fontSize: '16px',
      padding: '20px',
      borderRadius: '12px',
      backgroundColor: '#10b981',
      color: 'white',
      fontWeight: 'bold',
      minWidth: '300px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    },
  });

  // Pas de navigation automatique - l'utilisateur choisit
  // Les boutons de navigation sont gérés dans le composant parent
};

/**
 * Toast simple pour la création de service (sans coût)
 */
export const showSimpleServiceCreationToast = () => {
  toast.success('Service créé avec succès !', {
    duration: 5000,
    icon: '✅'
  });
};

/**
 * Toast d'erreur unifié pour la création de service
 */
export const showServiceCreationErrorToast = (error?: string) => {
  toast.error(error || "Erreur lors de la création du service. Veuillez réessayer.", {
    duration: 5000,
    icon: '❌'
  });
}; 