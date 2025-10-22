import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

// Interface pour la réponse IA
export interface IAResponse {
  intention: string;
  tokens_consumed: number;
  ia_model_used: string;
  confidence: number;
  [key: string]: any;
}

// Interface pour la réponse complète avec headers
export interface IAResponseWithHeaders {
  data: IAResponse;
  headers: any;
}

// Helper pour obtenir le token
// Essaie plusieurs clés pour compatibilité (auth_token, token)
const getToken = async (): Promise<string | null> => {
  // Essayer 'auth_token' d'abord (nouvelle clé)
  let token = await AsyncStorage.getItem('auth_token');

  if (!token) {
    // Fallback vers 'token' (ancienne clé, compatibilité avec le frontend)
    token = await AsyncStorage.getItem('token');
    console.log('[yukpoclient] Token récupéré depuis clé "token" (fallback)');
  } else {
    console.log('[yukpoclient] Token récupéré depuis clé "auth_token"');
  }

  if (!token) {
    console.error('[yukpoclient] ❌ Aucun token trouvé (ni auth_token, ni token)');
  }

  return token;
};

// ✅ Fonction pour générer des suggestions de service (sans créer le service)
export async function genererSuggestionsService(input: any): Promise<IAResponseWithHeaders> {
  const token = await getToken();

  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  // Préparer la requête pour l'IA
  const serviceRequest = {
    texte: input.texte || input.text || input.description || '',
    base64_image: input.base64_image || [],
    audio_base64: input.audio_base64 || [],
    video_base64: input.video_base64 || [],
    doc_base64: input.doc_base64 || [],
    excel_base64: input.excel_base64 || [],
    pdf_base64: input.pdf_base64 || []
  };

  try {
    console.log('[yukpoclient] Appel /api/ia/creation-service (comme le frontend)...');
    const iaResponse = await fetch(`${API_BASE_URL}/api/ia/creation-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(serviceRequest),
    });

    if (!iaResponse.ok) {
      const errorData = await iaResponse.json().catch((error) => {
        console.error('Erreur parsing JSON IA response:', error);
        return {};
      });
      console.error('[yukpoclient] Erreur IA détaillée:', {
        status: iaResponse.status,
        statusText: iaResponse.statusText,
        errorData: errorData
      });

      if (iaResponse.status === 500) {
        throw new Error(`Erreur serveur IA (500): ${errorData.message || 'Erreur interne du serveur'}`);
      } else if (iaResponse.status === 401) {
        throw new Error('Erreur d\'authentification: Token invalide ou expiré');
      } else if (iaResponse.status === 400) {
        throw new Error(`Erreur de requête (400): ${errorData.message || 'Données invalides'}`);
      } else {
        throw new Error(`Erreur IA (${iaResponse.status}): ${errorData.message || iaResponse.statusText}`);
      }
    }

    const iaData = await iaResponse.json();
    console.log('[yukpoclient] Suggestions générées:', iaData);

    // Mettre à jour le solde de tokens
    const remaining = iaResponse.headers.get('x-tokens-remaining');
    if (remaining) {
      await AsyncStorage.setItem('tokens_balance', remaining);
    }

    return {
      data: {
        ...iaData,
        suggestions: iaData.data || iaData
      },
      headers: iaResponse.headers
    };
  } catch (error: any) {
    console.error('[yukpoclient] Erreur génération suggestions:', error);
    throw error;
  }
}

// ✅ Fonction pour rechercher des services
export async function rechercherServices(input: any): Promise<any> {
  const token = await getToken();

  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  try {
    console.log('[yukpoclient] Appel /api/search/direct...');
    const response = await fetch(`${API_BASE_URL}/api/search/direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    console.log('[yukpoclient] ===== RÉPONSE API RECHERCHE =====');
    console.log('[yukpoclient] Status:', response.status);
    console.log('[yukpoclient] Headers:', {
      contentType: response.headers.get('content-type'),
      tokensRemaining: response.headers.get('x-tokens-remaining')
    });
    console.log('[yukpoclient] Résultats bruts:', JSON.stringify(result, null, 2));
    console.log('[yukpoclient] Structure:', {
      hasResultats: !!result.resultats,
      typeResultats: typeof result.resultats,
      isArray: Array.isArray(result.resultats),
      hasNestedResultats: !!result.resultats?.resultats,
      nestedType: typeof result.resultats?.resultats,
      nestedIsArray: Array.isArray(result.resultats?.resultats),
      nestedLength: Array.isArray(result.resultats?.resultats) ? result.resultats.resultats.length : 'N/A'
    });

    // Mettre à jour le solde de tokens
    const remaining = response.headers.get('x-tokens-remaining');
    if (remaining) {
      await AsyncStorage.setItem('tokens_balance', remaining);
    }

    console.log('[yukpoclient] Retour du résultat complet');
    return result;
  } catch (error: any) {
    console.error('[yukpoclient] Erreur recherche:', error);
    throw error;
  }
}

// ✅ Fonction pour créer un service (depuis le formulaire avec données structurées)
export async function creerService(donneesStructurees: any, tokensIAExterne?: number): Promise<IAResponseWithHeaders> {
  const token = await getToken();

  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  // Extraire user_id depuis les données ou le token
  let user_id = donneesStructurees.user_id;
  if (!user_id) {
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      user_id = tokenData.sub;
    } catch (e) {
      throw new Error('Impossible de déterminer l\'ID utilisateur');
    }
  }

  try {
    console.log('[yukpoclient] Création service...');
    const response = await fetch(`${API_BASE_URL}/api/services/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: user_id,
        data: donneesStructurees, // ✅ CORRECTION : Encapsuler dans 'data'
        ...(tokensIAExterne && { tokens_ia_externe: tokensIAExterne })
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch((error) => {
        console.error('Erreur parsing JSON response:', error);
        return {};
      });
      throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[yukpoclient] Service créé:', data);

    // Mettre à jour le solde de tokens
    const remaining = response.headers.get('x-tokens-remaining');
    if (remaining) {
      await AsyncStorage.setItem('tokens_balance', remaining);
    }

    return { data, headers: response.headers };
  } catch (error: any) {
    console.error('[yukpoclient] Erreur création service:', error);
    throw error;
  }
}

export default {
  genererSuggestionsService,
  rechercherServices,
  creerService
};

