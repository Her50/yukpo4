/**
 * Page web complète pour afficher un produit partagé
 * 
 * Fonctionnalités:
 * - Affiche les meta tags Open Graph pour prévisualisation riche
 * - Charge les données du produit depuis l'API
 * - Affiche l'image principale du produit
 * - Bouton pour ouvrir dans l'app
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, ExternalLink, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { apiGet } from '@/services/api';

interface ProductData {
  nom: string;
  description?: string;
  prix?: number;
  devise?: string;
  location?: string;
  service_id: number;
  product_index: number;
}

interface MediaItem {
  id: number;
  path: string;
  is_main_image: boolean;
  media_type: string;
}

interface StoreUrls {
  android: string;
  ios: string;
}

const APP_STORE_ID = process.env.REACT_APP_APP_STORE_ID || 'YOUR_APP_STORE_ID';
const PACKAGE_NAME = 'com.yukpomnang.mobile';
const WEB_BASE_URL = process.env.REACT_APP_SHARE_URL || window.location.origin;

const getStoreUrls = (deepLink: string): StoreUrls => {
  const encodedLink = encodeURIComponent(deepLink);
  return {
    android: `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}&referrer=${encodedLink}`,
    ios: `https://apps.apple.com/app/id${APP_STORE_ID}?ct=${encodedLink}`
  };
};

const ProductPage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productIndex = searchParams.get('index');
  
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'unknown'>('unknown');

  // Générer les liens
  const deepLink = `yukpo://product/${serviceId}${productIndex ? `?productIndex=${productIndex}` : ''}`;
  const webLink = `${WEB_BASE_URL}/product/${serviceId}${productIndex ? `?index=${productIndex}` : ''}`;
  const storeUrls = getStoreUrls(deepLink);

  // Charger les données du produit
  useEffect(() => {
    const loadProductData = async () => {
      if (!serviceId) return;

      try {
        setLoading(true);

        // Détecter la plateforme
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
        const isAndroid = /android/i.test(userAgent);
        setIsMobile(isIOS || isAndroid);
        setPlatform(isIOS ? 'ios' : isAndroid ? 'android' : 'unknown');

        // Récupérer les données du service (qui contient les produits)
        const serviceResponse = await apiGet(`/api/services/${serviceId}`);
        const service = serviceResponse.data;

        if (service && service.data) {
          // Extraire le produit spécifique
          const products = service.data.produits || [];
          const index = productIndex ? parseInt(productIndex, 10) : 0;
          const product = products[index] || products[0];

          if (product) {
            const productInfo: ProductData = {
              nom: product.nom || product.nom_produit?.valeur || 'Produit',
              description: product.description || product.description_produit || '',
              prix: product.prix || product.prix_produit?.valeur,
              devise: product.devise || 'FCFA',
              location: service.data.localisation?.valeur || '',
              service_id: parseInt(serviceId, 10),
              product_index: index,
            };
            setProductData(productInfo);

            // Récupérer les médias du produit
            try {
              const mediaResponse = await apiGet(`/api/media/product/${serviceId}/${index}`);
              if (mediaResponse.data && mediaResponse.data.data) {
                const medias: MediaItem[] = mediaResponse.data.data;
                // Trouver l'image principale ou la première image
                const mainImg = medias.find(m => m.is_main_image && m.media_type === 'image') 
                  || medias.find(m => m.media_type === 'image')
                  || medias[0];
                
                if (mainImg && mainImg.path) {
                  setMainImage(mainImg.path);
                }
              }
            } catch (mediaError) {
              console.warn('[ProductPage] Erreur récupération médias:', mediaError);
              // Continuer sans image
            }
          }
        }
      } catch (error) {
        console.error('[ProductPage] Erreur chargement produit:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProductData();
  }, [serviceId, productIndex]);

  const handleOpenApp = () => {
    window.location.href = deepLink;
  };

  const handleDownloadApp = () => {
    if (platform === 'ios') {
      window.open(storeUrls.ios, '_blank');
    } else if (platform === 'android') {
      window.open(storeUrls.android, '_blank');
    } else {
      const choice = window.confirm('Choisissez votre plateforme:\nOK = iOS\nAnnuler = Android');
      if (choice) {
        window.open(storeUrls.ios, '_blank');
      } else {
        window.open(storeUrls.android, '_blank');
      }
    }
  };

  // Préparer les meta tags
  const productName = productData?.nom || 'Produit Yukpo';
  const productDescription = productData?.description || 'Découvrez ce produit sur Yukpo';
  const productPrice = productData?.prix 
    ? `${productData.prix.toLocaleString()} ${productData.devise || 'FCFA'}`
    : '';
  const fullDescription = `${productDescription}${productPrice ? ` - ${productPrice}` : ''}`;
  const imageUrl = mainImage || `${WEB_BASE_URL}/logo.png`; // Fallback vers logo

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement du produit...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ✅ Meta Tags Open Graph pour prévisualisation riche */}
      <Helmet>
        <title>{productName} - Yukpo</title>
        <meta name="description" content={fullDescription} />
        
        {/* Open Graph (Facebook, WhatsApp, LinkedIn) */}
        <meta property="og:title" content={productName} />
        <meta property="og:description" content={fullDescription} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={webLink} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="Yukpo" />
        
        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={productName} />
        <meta name="twitter:description" content={fullDescription} />
        <meta name="twitter:image" content={imageUrl} />
        
        {/* Additional meta tags */}
        <meta name="product:price:amount" content={productData?.prix?.toString() || ''} />
        <meta name="product:price:currency" content={productData?.devise || 'FCFA'} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            {/* Image du produit */}
            {mainImage && (
              <div className="mb-4 rounded-lg overflow-hidden">
                <img 
                  src={mainImage} 
                  alt={productName}
                  className="w-full h-64 object-cover"
                  onError={(e) => {
                    // Fallback si image ne charge pas
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              {mainImage ? (
                <ImageIcon className="w-8 h-8 text-primary" />
              ) : (
                <Smartphone className="w-8 h-8 text-primary" />
              )}
            </div>
            
            <CardTitle className="text-2xl">{productName}</CardTitle>
            
            {productDescription && (
              <p className="text-muted-foreground mt-2">{productDescription}</p>
            )}
            
            {productPrice && (
              <p className="text-lg font-semibold text-primary mt-2">{productPrice}</p>
            )}
            
            <p className="text-muted-foreground mt-2 text-sm">
              {isMobile 
                ? 'Ouvrez dans l\'app pour une meilleure expérience' 
                : 'Téléchargez l\'app pour une meilleure expérience'}
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Bouton principal: Ouvrir l'app */}
            <Button
              onClick={handleOpenApp}
              className="w-full"
              size="lg"
            >
              <Smartphone className="w-5 h-5 mr-2" />
              Ouvrir dans l'app
            </Button>

            {/* Bouton: Télécharger l'app */}
            <Button
              onClick={handleDownloadApp}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Download className="w-5 h-5 mr-2" />
              {platform === 'ios' && 'Télécharger sur l\'App Store'}
              {platform === 'android' && 'Télécharger sur Google Play'}
              {platform === 'unknown' && 'Télécharger l\'app'}
            </Button>

            {/* Informations */}
            <div className="pt-4 border-t text-center text-sm text-muted-foreground">
              <p>Service ID: {serviceId}</p>
              {productIndex && <p>Produit #{productIndex}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ProductPage;

