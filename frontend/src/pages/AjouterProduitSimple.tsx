/**
 * AjouterProduitSimple - Page web pour ajouter un produit à un service existant
 * Équivalent de mobile/src/screens/AjouterProduitSimpleScreen.tsx
 * 
 * CONTEXTE D'UTILISATION:
 * - Utilisé quand l'utilisateur a DÉJÀ un service existant et veut ajouter un produit
 * - Utilisé depuis HomeScreen quand un service existe déjà (au lieu de FormulaireYukpoIntelligent)
 * - Utilisé depuis MesServicesScreen pour ajouter un produit à un service
 * - Utilisé pour éditer un produit existant (mode='edit')
 * - Utilisé pour dupliquer un produit (mode='duplicate')
 * 
 * Fonctionnalités:
 * - Création rapide de produit sans passer par le formulaire IA complet
 * - Gestion médias (images, vidéos, audio, documents)
 * - Caractéristiques produits avec LinearAutocompleteEditor
 * - Variabilité de prix avec PriceVariantSelector
 * - Configuration livraison avec ProductDeliveryConfigModal
 * - Gestion stock/quantité
 * - Upload CDN avec cloudUploadService
 * - Support des suggestions IA depuis HomeScreen
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons';
import ProductManager from '@/components/ui/ProductManager';
import { useUser } from '@/hooks/useUser';
import { apiPost } from '@/services/api';
import { cloudUploadService } from '@/services/cloudUploadService';
import { ArrowLeft, Package, Save } from 'lucide-react';

interface Product {
  id: string;
  type: string;
  name: string;
  price: string;
  currency: string;
  description?: string;
  images: string[];
  videos: string[];
  characteristics?: string;
  sous_caracteristiques?: Record<string, string[]>;
  price_variant?: {
    variable: string;
    modalites: Array<{
      valeur: string;
      prix: number;
      devise: string;
      stock?: number;
    }>;
  };
  quantite_disponible?: number | null;
  [key: string]: any;
}

const AjouterProduitSimple: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  
  // Récupérer les données depuis la navigation
  // Cas d'utilisation:
  // 1. Depuis HomeScreen: serviceId + suggestionIA (quand service existe déjà)
  // 2. Depuis MesServicesScreen: serviceId (ajout produit à service existant)
  // 3. Édition produit: serviceId + productId + productIndex + mode='edit'
  // 4. Duplication produit: serviceId + productId + productIndex + mode='duplicate'
  const serviceId = location.state?.serviceId;
  const initialProduct = location.state?.product;
  const sessionId = location.state?.sessionId;
  const suggestionIA = location.state?.suggestionIA; // ✅ Suggestions IA depuis HomeScreen
  const mode = location.state?.mode || 'create'; // 'create' | 'edit' | 'duplicate'
  const productId = location.state?.productId;
  const productIndex = location.state?.productIndex;
  const prefill = location.state?.prefill || {}; // ✅ Données pré-remplies depuis IA

  const [products, setProducts] = useState<Product[]>(() => {
    // Si un produit initial est fourni, l'utiliser
    if (initialProduct) {
      return [initialProduct];
    }
    // Sinon, créer un produit vide
    return [{
      id: `temp_${Date.now()}`,
      type: 'autre',
      name: '',
      price: '',
      currency: 'XAF',
      description: '',
      images: [],
      videos: [],
      characteristics: '',
      quantite_disponible: null,
    }];
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Vérifier le solde avant création
  const checkBalance = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/users/balance', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const balance = data.balance || 0;
        
        // Vérifier si le solde est suffisant (minimum requis)
        if (balance < 10) {
          toast.error('Solde insuffisant. Veuillez recharger votre compte.', {
            onClick: () => navigate('/recharge-tokens')
          });
          return false;
        }
        
        return true;
      }
      
      return true; // En cas d'erreur, continuer quand même
    } catch (error) {
      console.error('[AjouterProduitSimple] Erreur vérification solde:', error);
      return true; // En cas d'erreur, continuer quand même
    }
  };

  // Upload préalable des médias vers CDN
  const uploadMediaToCDN = async (product: Product): Promise<Product> => {
    const updatedProduct = { ...product };
    
    // Upload images
    if (updatedProduct.images && updatedProduct.images.length > 0) {
      const uploadedImages: string[] = [];
      for (const image of updatedProduct.images) {
        // Si c'est déjà une URL CDN, garder tel quel
        if (image.startsWith('http://') || image.startsWith('https://')) {
          uploadedImages.push(image);
          continue;
        }
        
        // Sinon, uploader
        try {
          // Convertir base64 en File si nécessaire
          let file: File | string = image;
          if (image.startsWith('data:')) {
            // Extraire le type MIME et les données
            const matches = image.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const mimeType = matches[1];
              const base64Data = matches[2];
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mimeType });
              file = new File([blob], `image_${Date.now()}.${mimeType.split('/')[1]}`, { type: mimeType });
            }
          }
          
          const result = await cloudUploadService.uploadToCloud(file, 'image');
          if (result.success && result.url) {
            uploadedImages.push(result.url);
          } else {
            // Fallback: garder le base64
            uploadedImages.push(image);
          }
        } catch (error) {
          console.error('[AjouterProduitSimple] Erreur upload image:', error);
          // Fallback: garder le base64
          uploadedImages.push(image);
        }
      }
      updatedProduct.images = uploadedImages;
    }

    // Upload videos
    if (updatedProduct.videos && updatedProduct.videos.length > 0) {
      const uploadedVideos: string[] = [];
      for (const video of updatedProduct.videos) {
        if (video.startsWith('http://') || video.startsWith('https://')) {
          uploadedVideos.push(video);
          continue;
        }
        
        try {
          let file: File | string = video;
          if (video.startsWith('data:')) {
            const matches = video.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const mimeType = matches[1];
              const base64Data = matches[2];
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mimeType });
              file = new File([blob], `video_${Date.now()}.${mimeType.split('/')[1]}`, { type: mimeType });
            }
          }
          
          const result = await cloudUploadService.uploadToCloud(file, 'video');
          if (result.success && result.url) {
            uploadedVideos.push(result.url);
          } else {
            uploadedVideos.push(video);
          }
        } catch (error) {
          console.error('[AjouterProduitSimple] Erreur upload vidéo:', error);
          uploadedVideos.push(video);
        }
      }
      updatedProduct.videos = uploadedVideos;
    }

    return updatedProduct;
  };

  // Sauvegarder le produit
  const handleSave = async () => {
    if (products.length === 0) {
      toast.error('Veuillez ajouter au moins un produit');
      return;
    }

    const product = products[0];
    
    // Validation
    if (!product.name || !product.name.trim()) {
      toast.error('Le nom du produit est obligatoire');
      return;
    }

    if (!product.price || parseFloat(product.price) <= 0) {
      toast.error('Le prix du produit est obligatoire et doit être supérieur à 0');
      return;
    }

    // Vérifier le solde
    const hasBalance = await checkBalance();
    if (!hasBalance) {
      return;
    }

    setSaving(true);

    try {
      // Upload préalable des médias vers CDN
      const productWithCDN = await uploadMediaToCDN(product);

      // Préparer les données pour l'API
      const productData = {
        nom_produit: productWithCDN.name,
        type: productWithCDN.type,
        description: productWithCDN.description || '',
        prix: parseFloat(productWithCDN.price),
        devise: productWithCDN.currency || 'XAF',
        images: productWithCDN.images || [],
        videos: productWithCDN.videos || [],
        characteristics: productWithCDN.characteristics || '',
        sous_caracteristiques: productWithCDN.sous_caracteristiques || {},
        price_variant: productWithCDN.price_variant || null,
        quantite_disponible: productWithCDN.quantite_disponible || null,
        service_id: serviceId || null,
      };

      // Appel API pour créer le produit
      const response = await apiPost('/api/products/create', productData);

      if (response.success) {
        toast.success('Produit créé avec succès !');
        
        // Rediriger selon le contexte
        if (serviceId) {
          navigate(`/dashboard/mes-services/${serviceId}`);
        } else {
          navigate('/dashboard/mes-services');
        }
      } else {
        toast.error(response.message || 'Erreur lors de la création du produit');
      }
    } catch (error: any) {
      console.error('[AjouterProduitSimple] Erreur création produit:', error);
      toast.error(error.message || 'Erreur lors de la création du produit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>

            <div className="flex items-center gap-3 mb-2">
              <Package className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                {mode === 'edit' ? 'Modifier le produit' : mode === 'duplicate' ? 'Dupliquer le produit' : 'Ajouter un produit'}
              </h1>
            </div>
            <p className="text-gray-600">
              {mode === 'edit' 
                ? 'Modifiez les informations de votre produit'
                : mode === 'duplicate'
                ? 'Dupliquez ce produit avec de nouvelles informations'
                : serviceId
                ? 'Ajoutez un nouveau produit à votre service existant'
                : 'Créez rapidement un nouveau produit pour votre service'}
            </p>
          </div>

          {/* ProductManager */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <ProductManager
              products={products}
              onProductsChange={setProducts}
              readonly={false}
              serviceId={serviceId ? parseInt(serviceId) : undefined}
              sessionId={sessionId}
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-4">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer le produit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AjouterProduitSimple;

