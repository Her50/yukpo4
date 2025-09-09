export interface GroupeSortie {
    groupe_actuel: string;
    ordre_groupe: number;
    terminé: boolean;
    contenu: Record<string, any>; // ou un objet contenant des ComposantFrontend plus typés
  }
  