/**
 * Page de redirection intelligente pour les produits partagés
 * 
 * Fonctionnalités:
 * - Détecte si l'app mobile est installée
 * - Redirige vers l'app si installée (Universal Links / App Links)
 * - Redirige vers les stores si non installée
 * - Affiche une page de fallback avec options de téléchargement
 * - ✅ NOUVEAU: Meta tags Open Graph pour prévisualisation riche avec images
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, ExternalLink, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { apiGet } from '@/services/apiService';

interface StoreUrls {
  android: string;
  ios: string;
}

// ✅ Configuration des stores
// ⚠️ APP_STORE_ID: À remplacer par l'ID réel après publication sur l'App Store
// Pour obtenir l'ID: https://appstoreconnect.apple.com → Votre app → Informations sur l'app → ID Apple
const APP_STORE_ID = process.env.REACT_APP_APP_STORE_ID || 'YOUR_APP_STORE_ID';
const PACKAGE_NAME = 'com.yukpomnang.mobile'; // Package name depuis app.config.js

const getStoreUrls = (deepLink: string): StoreUrls => {
  const encodedLink = encodeURIComponent(deepLink);
  return {
    android: `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}&referrer=${encodedLink}`,
    ios: `https://apps.apple.com/app/id${APP_STORE_ID}?ct=${encodedLink}`
  };
};

interface ProductData {
  nom: string;
  description?: string;
  prix?: number;
  devise?: string;
}

interface MediaItem {
  id: number;
  path: string;
  is_main_image: boolean;
  media_type: string;
}

const ProductRedirectPage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [searchParams] = useSearchParams();
  const productIndex = searchParams.get('index');
  const [isMobile, setIsMobile] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'unknown'>('unknown');
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [mainVideo, setMainVideo] = useState<string | null>(null); // ✅ NOUVEAU 2026-01-25: Support des vidéos
  const [loading, setLoading] = useState(true);

  // Générer les liens
  const deepLink = `yukpo://product/${serviceId}${productIndex ? `?productIndex=${productIndex}` : ''}`;
  const webLink = `${window.location.origin}/product/${serviceId}${productIndex ? `?index=${productIndex}` : ''}`;
  const storeUrls = getStoreUrls(deepLink);

  // ✅ NOUVEAU: Charger les données du produit pour meta tags
  useEffect(() => {
    const loadProductData = async () => {
      if (!serviceId) {
        setLoading(false);
        return;
      }

      try {
        // Récupérer les données du service
        const serviceResponse = await apiGet(`/api/services/${serviceId}`);
        const service = serviceResponse.data;

        if (service && service.data) {
          const products = service.data.produits || [];
          const index = productIndex ? parseInt(productIndex, 10) : 0;
          const product = products[index] || products[0];

          if (product) {
            setProductData({
              nom: product.nom || product.nom_produit?.valeur || 'Produit Yukpo',
              description: product.description || product.description_produit || '',
              prix: product.prix || product.prix_produit?.valeur,
              devise: product.devise || 'FCFA',
            });

            // ✅ NOUVEAU 2026-01-25: Récupérer les médias du produit (images ET vidéos)
            try {
              const mediaResponse = await apiGet(`/api/media/product/${serviceId}/${index}`);
              if (mediaResponse.data && mediaResponse.data.data) {
                const medias: MediaItem[] = mediaResponse.data.data;
                
                // Priorité 1: Image principale (pour prévisualisation)
                const mainImg = medias.find(m => m.is_main_image && m.media_type === 'image') 
                  || medias.find(m => m.media_type === 'image');
                
                if (mainImg && mainImg.path) {
                  setMainImage(mainImg.path);
                }
                
                // Priorité 2: Vidéo principale (pour meta tags og:video)
                const mainVid = medias.find(m => m.is_main_image && m.media_type === 'video')
                  || medias.find(m => m.media_type === 'video');
                
                if (mainVid && mainVid.path) {
                  setMainVideo(mainVid.path);
                  console.log('[ProductRedirectPage] ✅ Vidéo principale trouvée:', mainVid.path.substring(0, 80) + '...');
                }
              }
            } catch (mediaError) {
              console.warn('[ProductRedirectPage] Erreur récupération médias:', mediaError);
            }
          }
        }
      } catch (error) {
        console.error('[ProductRedirectPage] Erreur chargement produit:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProductData();
  }, [serviceId, productIndex]);

  useEffect(() => {
    // ✅ CORRIGÉ 2026-01-26: Détecter la plateforme mobile avec meilleure précision
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /android/i.test(userAgent);
    
    setIsMobile(isIOS || isAndroid);
    setPlatform(isIOS ? 'ios' : isAndroid ? 'android' : 'unknown');

    // ✅ CORRIGÉ 2026-01-26: Si l'utilisateur est sur mobile, priorité à la redirection vers le store
    // Si l'app n'est pas installée, rediriger IMMÉDIATEMENT vers le store approprié
    if (!isIOS && !isAndroid) {
      // Utilisateur sur desktop → afficher la page web normale (pas de redirection automatique)
      return;
    }

    // ✅ Tentative de redirection automatique vers l'app
    const attemptAppRedirect = () => {
      if (redirectAttempted) return;
      setRedirectAttempted(true);

      // Essayer d'ouvrir le deep link
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);

      // ✅ CORRIGÉ 2026-01-26: Si l'app n'est pas installée, rediriger IMMÉDIATEMENT vers le store
      // Réduire le délai à 1 seconde pour une meilleure expérience utilisateur
      setTimeout(() => {
        document.body.removeChild(iframe);
        
        // ✅ PRIORITÉ: Si l'utilisateur est sur mobile et l'app n'est pas installée
        // → Rediriger IMMÉDIATEMENT vers le store approprié (Play Store ou App Store)
        if (isIOS) {
          console.log('[ProductRedirectPage] 📱 App non installée sur iOS → Redirection vers App Store');
          window.location.href = storeUrls.ios;
        } else if (isAndroid) {
          console.log('[ProductRedirectPage] 📱 App non installée sur Android → Redirection vers Play Store');
          window.location.href = storeUrls.android;
        }
      }, 1000); // ✅ Réduit à 1 seconde pour redirection plus rapide
    };

    // ✅ Attendre un peu avant de tenter la redirection (pour laisser le temps à l'app de s'ouvrir si installée)
    const timer = setTimeout(attemptAppRedirect, 500);
    
    return () => clearTimeout(timer);
  }, [deepLink, storeUrls, isMobile, platform, redirectAttempted]);

  const handleOpenApp = () => {
    window.location.href = deepLink;
  };

  const handleDownloadApp = () => {
    if (platform === 'ios') {
      window.open(storeUrls.ios, '_blank');
    } else if (platform === 'android') {
      window.open(storeUrls.android, '_blank');
    } else {
      // Afficher les deux options
      const choice = window.confirm('Choisissez votre plateforme:\nOK = iOS\nAnnuler = Android');
      if (choice) {
        window.open(storeUrls.ios, '_blank');
      } else {
        window.open(storeUrls.android, '_blank');
      }
    }
  };

  const handleViewWeb = () => {
    // Rediriger vers la page web du produit
    window.location.href = webLink;
  };

  // Préparer les meta tags
  const productName = productData?.nom || 'Produit Yukpo';
  const productDescription = productData?.description || 'Découvrez ce produit sur Yukpo';
  const productPrice = productData?.prix 
    ? `${productData.prix.toLocaleString()} ${productData.devise || 'FCFA'}`
    : '';
  const fullDescription = `${productDescription}${productPrice ? ` - ${productPrice}` : ''}`;
  const imageUrl = mainImage || `${window.location.origin}/logo.png`;
  const videoUrl = mainVideo || undefined; // ✅ NOUVEAU 2026-01-25: URL de la vidéo pour meta tags

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
        
        {/* ✅ NOUVEAU 2026-01-25: Open Graph - Vidéo (si disponible) */}
        {videoUrl && (
          <>
            <meta property="og:video" content={videoUrl} />
            <meta property="og:video:type" content="video/mp4" />
            <meta property="og:video:width" content="1280" />
            <meta property="og:video:height" content="720" />
          </>
        )}
        
        {/* Twitter Cards */}
        <meta name="twitter:card" content={videoUrl ? "player" : "summary_large_image"} />
        <meta name="twitter:title" content={productName} />
        <meta name="twitter:description" content={fullDescription} />
        <meta name="twitter:image" content={imageUrl} />
        
        {/* ✅ NOUVEAU 2026-01-25: Twitter Cards - Vidéo (si disponible) */}
        {videoUrl && (
          <>
            <meta name="twitter:player" content={videoUrl} />
            <meta name="twitter:player:width" content="1280" />
            <meta name="twitter:player:height" content="720" />
          </>
        )}
        
        {/* Additional meta tags */}
        {productData?.prix && (
          <>
            <meta name="product:price:amount" content={productData.prix.toString()} />
            <meta name="product:price:currency" content={productData.devise || 'FCFA'} />
          </>
        )}
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            {/* ✅ Image du produit */}
            {mainImage && !loading && (
              <div className="mb-4 rounded-lg overflow-hidden">
                <img 
                  src={mainImage} 
                  alt={productName}
                  className="w-full h-64 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              {mainImage && !loading ? (
                <ImageIcon className="w-8 h-8 text-primary" />
              ) : (
                <Smartphone className="w-8 h-8 text-primary" />
              )}
            </div>
            
            <CardTitle className="text-2xl">
              {loading ? 'Chargement...' : productName}
            </CardTitle>
            
            {productDescription && !loading && (
              <p className="text-muted-foreground mt-2">{productDescription}</p>
            )}
            
            {productPrice && !loading && (
              <p className="text-lg font-semibold text-primary mt-2">{productPrice}</p>
            )}
            
            <p className="text-muted-foreground mt-2">
              {isMobile 
                ? 'Redirection automatique en cours...' 
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

          {/* Bouton: Voir sur le web */}
          <Button
            onClick={handleViewWeb}
            variant="ghost"
            className="w-full"
            size="lg"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Voir sur le web
            <ArrowRight className="w-4 h-4 ml-2" />
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

export default ProductRedirectPage;

