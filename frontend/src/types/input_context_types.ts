export interface InputContextIA {
    modalites: Record<string, unknown>;
    historique?: IAHistorique[]; // Si enrichissement activé
    user_id?: number;
  }
  
  export interface IAHistorique {
    timestamp: string; // ISO
    type: "texte" | "image" | "audio" | "fichier" | "gps";
    valeur: string | string[] | Record<string, any>;
    commentaire?: string;
  }
  