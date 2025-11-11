export interface ManagedProduct {
    id: string;
    nom: string;
    type?: string;
    prix?: number | string;
    devise?: string;
    description?: string;
    is_active?: boolean;
    serviceId: string;
    serviceTitre: string;
    images?: string[];
    videos?: string[];
    rawProductId?: number;
    product_index?: number;
    category_key?: string;
    category_label?: string;
    views?: number;
    shares?: number;
    saves?: number;
    [key: string]: any;
}



