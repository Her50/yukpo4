import { useCallback } from 'react';
import { useUserContext } from '../context/UserContext';

interface ApiResponse extends Response {
  headers: Headers;
}

export const useApiWithTokens = () => {
  const { updateTokensBalance } = useUserContext();

  const fetchWithTokenUpdate = useCallback(async (
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> => {
    // Ajouter le token d'authentification automatiquement
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    }) as ApiResponse;

    // 💰 Vérifier si la réponse contient un nouveau solde de tokens
    const tokensRemaining = response.headers.get('x-tokens-remaining');
    if (tokensRemaining) {
      const newBalance = parseInt(tokensRemaining, 10);
      if (!isNaN(newBalance)) {
        console.log('[useApiWithTokens] Nouveau solde détecté dans les headers:', newBalance);
        updateTokensBalance(newBalance);
      }
    }

    // 📊 Loguer la consommation de tokens si disponible
    const tokensConsumed = response.headers.get('x-tokens-consumed');
    if (tokensConsumed) {
      console.log('[useApiWithTokens] Tokens consommés:', tokensConsumed);
    }

    return response;
  }, [updateTokensBalance]);

  return { fetchWithTokenUpdate };
};

export default useApiWithTokens; 