// ✅ PHASE 4: Service pour gestion des produits via table service_products
// Date: 2026-01-03
// Objectif: Utiliser les nouveaux endpoints API pour récupérer les produits depuis service_products

import { apiGet, apiPost, apiPatch, apiDelete } from './api';

export interface Product {
  id: number;
  service_id: number;
  product_index: number;
  product_data: any;
  product_name: string;
  product_type: string;
  product_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  auto_deactivate_at: string | null;
}

export const productsService = {
  // Récupérer tous les produits d'un service
  getProductsByService: async (serviceId: number): Promise<Product[]> => {
    const response = await apiGet<Product[]>(`/api/services/${serviceId}/products`);
    return response.data || [];
  },

  // Récupérer un produit spécifique
  getProduct: async (serviceId: number, productIndex: number): Promise<Product> => {
    const response = await apiGet<Product>(`/api/services/${serviceId}/products/${productIndex}`);
    if (!response.data) {
      throw new Error('Produit non trouvé');
    }
    return response.data;
  },

  // Créer un produit (utilise déjà la queue via product_addition_controller)
  // Note: La création se fait via l'endpoint existant /api/services/{id}/add-product
  // Cette méthode est pour référence future si besoin
  createProduct: async (serviceId: number, productData: any): Promise<Product> => {
    // TODO: Implémenter si un endpoint direct est créé
    // Pour l'instant, utiliser l'endpoint existant /api/services/{id}/add-product
    throw new Error('Utiliser /api/services/{id}/add-product pour créer un produit');
  },

  // Mettre à jour un produit
  updateProduct: async (
    serviceId: number,
    productIndex: number,
    productData: any
  ): Promise<Product> => {
    const response = await apiPatch<Product>(`/api/services/${serviceId}/products/${productIndex}`, {
      product_data: productData,
    });
    if (!response.data) {
      throw new Error('Erreur lors de la mise à jour du produit');
    }
    return response.data;
  },

  // Supprimer un produit
  deleteProduct: async (serviceId: number, productIndex: number): Promise<void> => {
    await apiDelete(`/api/services/${serviceId}/products/${productIndex}`);
  },

  // Dupliquer un produit
  duplicateProduct: async (serviceId: number, productIndex: number): Promise<Product> => {
    const response = await apiPost<Product>(`/api/services/${serviceId}/products/${productIndex}/duplicate`, {});
    if (!response.data) {
      throw new Error('Erreur lors de la duplication du produit');
    }
    return response.data;
  },

  // Récupérer tous les produits d'un utilisateur (pour MesProduits)
  getProductsByUser: async (userId: number): Promise<Product[]> => {
    const response = await apiGet<Product[]>(`/api/products`, {
      params: { user_id: userId },
    });
    return response.data || [];
  },
};

