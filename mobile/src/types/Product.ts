export interface Product {
  id: string;
  nom: string;
  type: string;
  prix: number;
  prixParNuit?: number;
  description?: string;
  images?: string[];
  videos?: string[];
  devise?: string;
  [key: string]: any;
}
