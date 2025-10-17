import { useLocation as useLocationFromContext } from '../contexts/LocationContext';

export const useLocation = () => {
    // Utiliser directement le hook du contexte
    return useLocationFromContext();
};
