import axios from "axios";
import { API_BASE_URL } from "../config/api";

// Configuration globale Axios pour augmenter les limites de taille
axios.defaults.maxContentLength = 200 * 1024 * 1024; // 200MB
axios.defaults.maxBodyLength = 200 * 1024 * 1024; // 200MB

// CORRECTION CRITIQUE: Configurer axios pour utiliser l'API_BASE_URL
axios.defaults.baseURL = API_BASE_URL;

// Fonction pour générer un token JWT de développement
function generateDevToken(): string {
  // En mode développement, utiliser un token simple qui contourne l'auth
  // Le backend devrait avoir une route spéciale pour le dev ou accepter ce token
  return 'dev-bypass-token';
}

// ✅ Fonction pour se connecter avec email/mot de passe
export async function login(email: string, password: string): Promise<{ token: string; tokens_balance: number }> {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });

    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.removeItem('__DEV_FAKE_USER__'); // Supprimer le mode dev

      // Sauvegarder le solde initial
      if (response.data.tokens_balance !== undefined) {
        localStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
        console.log('[yukpoaclient] Solde initial sauvegardé:', response.data.tokens_balance);
      }
    }

    return response.data;
  } catch (error: any) {
    console.error('❌ Erreur de connexion:', error);
    throw new Error(error.response?.data?.message || 'Erreur de connexion');
  }
}

// ✅ Fonction pour se déconnecter
export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('__DEV_FAKE_USER__');
  window.location.reload();
}

// ✅ Fonction pour basculer en mode développement (pour le debug)
export function toggleDevMode(): void {
  const current = localStorage.getItem('__DEV_FAKE_USER__') === 'true';
  localStorage.setItem('__DEV_FAKE_USER__', current ? 'false' : 'true');
  if (!current) {
    localStorage.removeItem('token'); // Supprimer le vrai token
  }
  window.location.reload();
}

// Ajouter en haut du fichier
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

  // Récupérer le token depuis le localStorage
  const token = localStorage.getItem('token');
  const isDevMode = localStorage.getItem('__DEV_FAKE_USER__') === 'true';

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
    // Utiliser fetch au lieu d'axios pour éviter les limites de taille
    const response = await fetch(`${API_BASE_URL}/api/ia/creation-service`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
      // Pas de limite de taille avec fetch
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[yukpoaclient] IA response payload:', data);
    if (onAfterCall) onAfterCall();

    // Mettre à jour le solde de tokens restant depuis l'en-tête
    const remaining = response.headers.get('x-tokens-remaining');
    if (remaining) {
      localStorage.setItem('tokens_balance', remaining);
      console.log('[yukpoaclient] Solde tokens mis à jour:', remaining);
    }

    return { data: data as IAResponse, headers: response.headers };
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'appel à l\'API IA:', error);
    if (error.message?.includes('401')) {
      console.error('🔐 Erreur d\'authentification. Activez le mode développeur ou connectez-vous.');
    }
    throw error;
  }
}

// ✅ Fonction pour générer des suggestions de service (sans créer le service)
export async function genererSuggestionsService(input: any): Promise<IAResponseWithHeaders> {
  const token = localStorage.getItem('token');
  const isDevMode = localStorage.getItem('__DEV_FAKE_USER__') === 'true';

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

  // Créer un AbortController pour gérer le timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes

  try {
    // ?? UNIQUEMENT ÉTAPE 1 : Appeler l'IA pour structurer les données
    const iaResponse = await fetch(`${API_BASE_URL}/api/ia/creation-service`, {
      method: 'POST',
      headers,
      body: JSON.stringify(serviceRequest),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!iaResponse.ok) {
      const errorData = await iaResponse.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur IA: ${iaResponse.status}: ${iaResponse.statusText}`);
    }

    const iaData = await iaResponse.json();
    console.log('[genererSuggestionsService] Suggestions générées par l\'IA:', iaData);

    // ?? RETOURNER UNIQUEMENT les suggestions, PAS la création du service
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
      throw new Error('Timeout: La génération des suggestions a pris trop de temps (5 minutes)');
    }
    throw error;
  }
}

// ✅ Fonction pour créer un service (maintenant utilisée dans le formulaire avec des données déjà structurées)
export async function creerService(donneesStructurees: any, tokensIAExterne?: number): Promise<IAResponseWithHeaders> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  // ?? NOUVEAU : Cette fonction reçoit maintenant des données déjà structurées depuis le formulaire
  // ?? Elle ne fait plus l'appel à l'IA, seulement la création du service

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
    // ?? UNIQUEMENT ÉTAPE 2 : Créer le service avec les données déjà structurées
    const response = await fetch(`${API_BASE_URL}/api/services/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: user_id,
        data: donneesStructurees, // ?? CORRECTION : Encapsuler les données dans le champ 'data' comme attendu par le backend
        ...(tokensIAExterne && { tokens_ia_externe: tokensIAExterne }) // ?? NOUVEAU : Transmettre les tokens IA externe
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
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
  const token = localStorage.getItem('token');
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erreur HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ✅ Fonction pour modifier un service existant (sans génération de frais IA)
export async function modifierService(serviceId: string | number, donneesStructurees: any, tokensIAExterne?: number): Promise<IAResponseWithHeaders> {
  const token = localStorage.getItem('token');
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
      const errorData = await response.json().catch(() => ({}));
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
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Token manquant');
  const response = await axios.post(`${API_BASE_URL}/api/services/vectorize`, servicePayload, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.data;
}
