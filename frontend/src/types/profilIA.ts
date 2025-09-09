// 📁 frontend/src/types/profilIA.ts

export type ChampIA = {
    valeur: any;
    type_donnee: string;
  };
  
  export type ProfilIA = {
    contexte_demande: ChampIA;
    [cle: string]: ChampIA;
  };
  
  export type OrigineChamps = Record<string, string[]>;
  
  export type MediasUtilises = {
    images: string[];
    documents: string[];
    audio: boolean;
    texte: boolean;
  };
  
  export type ServiceDetecte = {
    modele_service: string;
    profil_ia: ProfilIA;
    origine_champs: OrigineChamps;
    medias_utilises: MediasUtilises;
  };
  
  export type YukpoIAResponse = {
    services_detectes?: ServiceDetecte[];
    service_refuse?: boolean;
    motif_refus?: string;
  };
  