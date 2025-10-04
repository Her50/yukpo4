import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://yukpomnang.onrender.com';

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
const getToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('auth_token');
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
    console.log('[yukpoclient] Appel /api/ia/creation-service...');
    const iaResponse = await fetch(`${API_BASE_URL}/api/ia/creation-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(serviceRequest),
    });

    if (!iaResponse.ok) {
      const errorData = await iaResponse.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur IA: ${iaResponse.status}`);
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
    console.log('[yukpoclient] Résultats recherche:', result);

    // Mettre à jour le solde de tokens
    const remaining = response.headers.get('x-tokens-remaining');
    if (remaining) {
      await AsyncStorage.setItem('tokens_balance', remaining);
    }

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
        ...donneesStructurees,
        ...(tokensIAExterne && { tokens_ia_externe: tokensIAExterne })
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
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

