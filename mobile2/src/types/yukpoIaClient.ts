// Types pour l'IA Yukpo Mobile

export interface MultiModalInput {
  texte?: string;
  site_web?: string;
  base64_image?: string[];
  audio_base64?: string[];
  video_base64?: string[];
  doc_base64?: string[];
  excel_base64?: string[];
  logo?: string[];
  banner?: string[];
  gps_mobile?: string;
  gps_fixe?: boolean;
  gps_fixe_coords?: string;
}

export interface IAResponse {
  confidence: number;
  tokens_used: number;
  suggestion?: any;
  success?: boolean;
  message?: string;
  data?: any;
}

export interface SearchResponse {
  results?: any[];
  resultats?: {
    resultats?: any[];
  };
  success?: boolean;
  message?: string;
  data?: any;
}

export interface Service {
  id: string;
  nom: string;
  description: string;
  user_id: string;
  data?: any;
}

export interface Prestataire {
  id: string;
  nom: string;
  email: string;
  phone?: string;
  is_online?: boolean;
  last_seen?: string;
}
