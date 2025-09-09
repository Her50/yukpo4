// Types pour les services basés sur la structure réelle de l'API

export interface ServiceField {
  valeur: string | boolean | number;
  type_donnee: string;
  origine_champs: string;
}

export interface Promotion {
  active: boolean;
  type: 'reduction' | 'offre' | 'bon_plan' | 'flash';
  valeur: string; // ex: "20%", "50€", "Gratuit"
  description?: string;
  date_fin?: string;
  conditions?: string;
}

// Nouveaux types pour les avis et notations
export interface Review {
  id: number;
  service_id: number;
  user_id: number;
  user_name: string;
  user_avatar?: string;
  rating: number; // 1-5 étoiles
  comment: string;
  created_at: string;
  helpful_count: number;
  reported: boolean;
}

export interface ServiceStats {
  average_rating: number; // Note moyenne (1-5)
  total_reviews: number; // Nombre total d'avis
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  completion_rate: number; // Taux de réalisation des services
  response_time: number; // Temps de réponse moyen en heures
}

export interface ServiceData {
  titre_service?: string | ServiceField;
  titre?: string | ServiceField;
  description?: string | ServiceField;
  category?: string | ServiceField;
  is_tarissable?: boolean | ServiceField;
  gps_fixe?: string | ServiceField;
  // Champs média
  logo?: string | ServiceField;
  banniere?: string | ServiceField;
  images_realisations?: string[] | ServiceField;
  videos?: string[] | ServiceField;
  // Champs de contact
  telephone?: string | ServiceField;
  email?: string | ServiceField;
  website?: string | ServiceField;
  whatsapp?: string | ServiceField;
  // Nouveaux champs pour les statistiques
  stats?: ServiceStats;
  [key: string]: any; // Pour les autres champs dynamiques
}

export interface Service {
  id: number;
  data: ServiceData;
  is_active: boolean;
  created_at: string;
  user_id: number;
  favori?: boolean;
  score?: number; // Score de pertinence de la recherche
  distance?: number; // Distance en km depuis l'utilisateur
  promotion?: Promotion; // Informations de promotion
  // Nouvelles propriétés pour les avis
  reviews?: Review[];
  user_rating?: number; // Note donnée par l'utilisateur actuel
}

export interface ServiceSearchResult {
  id: string;
  score: number;
  metadata: {
    active: boolean;
    service_id: number;
    type: string;
    type_metier: string;
    langue: string;
    ia_response?: string;
  };
} 