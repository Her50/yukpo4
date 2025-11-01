import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

// Fonction pour générer un token JWT de développement
function generateDevToken(): string {
  // En mode développement, utiliser un token simple qui contourne l'auth
  return 'dev-bypass-token';
}

// ✅ Fonction pour se connecter avec email/mot de passe
export async function login(email: string, password: string): Promise<{ token: string; tokens_balance: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (data.token) {
      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.removeItem('__DEV_FAKE_USER__'); // Supprimer le mode dev

      // Sauvegarder le solde initial
      if (data.tokens_balance !== undefined) {
        await AsyncStorage.setItem('tokens_balance', data.tokens_balance.toString());
        console.log('[yukpoaclient] Solde initial sauvegardé:', data.tokens_balance);
      }
    }

    return data;
  } catch (error: any) {
    console.error('❌ Erreur de connexion:', error);
    throw new Error(error.message || 'Erreur de connexion');
  }
}

// ✅ Fonction pour se déconnecter
export async function logout(): Promise<void> {
  await AsyncStorage.removeItem('auth_token');
  await AsyncStorage.removeItem('__DEV_FAKE_USER__');
}

// ✅ Fonction pour basculer en mode développement (pour le debug)
export async function toggleDevMode(): Promise<void> {
  const current = await AsyncStorage.getItem('__DEV_FAKE_USER__');
  const isDevMode = current === 'true';
  await AsyncStorage.setItem('__DEV_FAKE_USER__', isDevMode ? 'false' : 'true');
  if (!isDevMode) {
    await AsyncStorage.removeItem('auth_token'); // Supprimer le vrai token
  }
}

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

// Fonction qui appelle l'API backend IA
export async function appelerMoteurIA(input: any, onAfterCall?: () => void): Promise<IAResponseWithHeaders> {
  // Récupérer le token depuis AsyncStorage
  const token = await AsyncStorage.getItem('auth_token');
  const isDevMode = await AsyncStorage.getItem('__DEV_FAKE_USER__') === 'true';

  // Préparer les headers
  const headers: any = {
    'Content-Type': 'application/json'
  };

  // Ajouter le token d'autorisation si disponible
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (isDevMode) {
    // En mode dev, utiliser un token JWT de développement
    const devToken = generateDevToken();
    headers.Authorization = `Bearer ${devToken}`;
    console.warn('🧪 Mode développement : utilisation d\'un token JWT de développement');
  } else {
    console.warn('⚠️ Aucun token d\'authentification trouvé');
  }

  try {
    // ✅ CORRECTION: Ajouter un timeout pour éviter les connexions fermées (499)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s pour appel IA

    // Utiliser fetch pour éviter les limites de taille
    const response = await fetch(`${API_BASE_URL}/api/ia/creation-service`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[yukpoaclient] IA response payload:', data);
    if (onAfterCall) onAfterCall();

    // Mettre à jour le solde de tokens restant depuis l'en-tête
    const remaining = response.headers.get('x-tokens-remaining');
    if (remaining) {
      await AsyncStorage.setItem('tokens_balance', remaining);
      console.log('[yukpoaclient] Solde tokens mis à jour:', remaining);
    }

    return { data: data as IAResponse, headers: response.headers };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('❌ Timeout lors de l\'appel à l\'API IA (60 secondes)');
      throw new Error('Timeout: L\'appel à l\'IA a pris trop de temps (60 secondes). Vérifiez votre connexion internet.');
    }
    console.error('❌ Erreur lors de l\'appel à l\'API IA:', error);
    if (error.message?.includes('401')) {
      console.error('🔐 Erreur d\'authentification. Activez le mode développeur ou connectez-vous.');
    }
    throw error;
  }
}

// ✅ Fonction pour générer des suggestions de service (sans créer le service)
export async function genererSuggestionsService(input: any): Promise<IAResponseWithHeaders> {
  const token = await AsyncStorage.getItem('auth_token');
  const isDevMode = await AsyncStorage.getItem('__DEV_FAKE_USER__') === 'true';

  if (!token && !isDevMode) {
    throw new Error('Token d\'authentification manquant');
  }

  // Préparer les headers
  const headers: any = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (isDevMode) {
    const devToken = generateDevToken();
    headers.Authorization = `Bearer ${devToken}`;
    console.warn('🧪 Mode développement : utilisation d\'un token JWT de développement');
  }

  // Préparer la requête pour l'IA
  const serviceRequest = {
    texte: input.texte || input.description || '',
    base64_image: input.base64_image || [],
    audio_base64: input.audio_base64 || [],
    video_base64: input.video_base64 || [],
    doc_base64: input.doc_base64 || [],
    excel_base64: input.excel_base64 || [],
    pdf_base64: input.pdf_base64 || []
  };

  // ✅ CORRECTION: Timeout réduit à 60s (au lieu de 5 min) pour éviter les connexions fermées
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s pour appel IA

  try {
    // UNIQUEMENT ÉTAPE 1 : Appeler l'IA pour structurer les données
    const iaResponse = await fetch(`${API_BASE_URL}/api/ia/creation-service`, {
      method: 'POST',
      headers,
      body: JSON.stringify(serviceRequest),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!iaResponse.ok) {
      const errorData = await iaResponse.json().catch((error) => {
        console.error('Erreur parsing JSON IA response:', error);
        return {};
      });
      throw new Error(errorData.message || `Erreur IA: ${iaResponse.status}: ${iaResponse.statusText}`);
    }

    const iaData = await iaResponse.json();
    console.log('[genererSuggestionsService] Suggestions générées par l\'IA:', iaData);

    // RETOURNER UNIQUEMENT les suggestions, PAS la création du service
    return {
      data: {
        ...iaData,
        suggestions: iaData.data || iaData // Renommer pour clarifier
      },
      headers: iaResponse.headers
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout: La génération des suggestions a pris trop de temps (60 secondes)');
    }
    throw error;
  }
}

// ✅ Fonction pour créer un service (maintenant utilisée dans le formulaire avec des données déjà structurées)
export async function creerService(donneesStructurees: any, tokensIAExterne?: number): Promise<IAResponseWithHeaders> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  // Extraire user_id depuis les données ou utiliser l'utilisateur connecté
  let user_id = donneesStructurees.user_id;
  if (!user_id) {
    // Essayer de récupérer depuis le token JWT
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      user_id = tokenData.sub;
    } catch (e) {
      throw new Error('Impossible de déterminer l\'ID utilisateur');
    }
  }

  // Créer un AbortController pour gérer le timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes

  try {
    // ✅ CORRECTION: Ajouter tokens_ia_externe DANS le champ data, pas à la racine
    const serviceData = { ...donneesStructurees };
    if (tokensIAExterne) {
      serviceData.tokens_ia_externe = tokensIAExterne;
    }

    // UNIQUEMENT ÉTAPE 2 : Créer le service avec les données déjà structurées
    const response = await fetch(`${API_BASE_URL}/api/services/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: user_id,
        data: serviceData // ✅ CORRECTION : tokens_ia_externe est maintenant dans data
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch((error) => {
        console.error('Erreur parsing JSON response:', error);
        return {};
      });
      throw new Error(errorData.message || `Erreur HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[creerService] Service créé avec succès:', data);
    return { data, headers: response.headers };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout: La création du service a pris trop de temps (5 minutes)');
    }
    throw error;
  }
}

// ✅ Fonction pour valider un brouillon de service
export async function validerBrouillonService(donnees: any): Promise<any> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  const response = await fetch(`${API_BASE_URL}/api/services/draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(donnees)
  });

  if (!response.ok) {
    const errorData = await response.json().catch((error) => {
      console.error('Erreur parsing JSON response:', error);
      return {};
    });
    throw new Error(errorData.message || `Erreur HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ✅ Fonction pour modifier un service existant (sans génération de frais IA)
export async function modifierService(serviceId: string | number, donneesStructurees: any, tokensIAExterne?: number): Promise<IAResponseWithHeaders> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  // Extraire user_id depuis les données ou utiliser l'utilisateur connecté
  let user_id = donneesStructurees.user_id;
  if (!user_id) {
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      user_id = tokenData.sub;
    } catch (e) {
      throw new Error('Impossible de déterminer l\'ID utilisateur');
    }
  }

  // Créer un AbortController pour gérer le timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes

  try {
    // MODIFICATION : Utiliser l'endpoint PUT pour modifier un service existant
    const response = await fetch(`${API_BASE_URL}/api/services/${serviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: user_id,
        ...donneesStructurees,
        ...(tokensIAExterne && { tokens_ia_externe: tokensIAExterne }),
        mode: 'modification' // Indiquer au backend que c'est une modification
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch((error) => {
        console.error('Erreur parsing JSON response:', error);
        return {};
      });
      throw new Error(errorData.message || `Erreur HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[modifierService] Service modifié avec succès:', data);
    return { data, headers: response.headers };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout: La modification du service a pris trop de temps (5 minutes)');
    }
    throw error;
  }
}

// Fonction pour vectoriser un service existant (stub)
export async function vectoriserService(servicePayload: any): Promise<any> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) throw new Error('Token manquant');

  const response = await fetch(`${API_BASE_URL}/api/services/vectorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(servicePayload)
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
