/**
 * Page de redirection intelligente pour les services partagés
 * 
 * Fonctionnalités:
 * - Détecte si l'app mobile est installée
 * - Redirige vers l'app si installée (Universal Links / App Links)
 * - Redirige vers les stores si non installée
 * - Affiche une page de fallback avec options de téléchargement
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, ExternalLink, ArrowRight, Building2 } from 'lucide-react';

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

const ServiceRedirectPage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [isMobile, setIsMobile] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'unknown'>('unknown');
  const [redirectAttempted, setRedirectAttempted] = useState(false);

  // Générer les liens
  const deepLink = `yukpo://service/${serviceId}`;
  const webLink = `${window.location.origin}/service/${serviceId}`;
  const storeUrls = getStoreUrls(deepLink);

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
          console.log('[ServiceRedirectPage] 📱 App non installée sur iOS → Redirection vers App Store');
          window.location.href = storeUrls.ios;
        } else if (isAndroid) {
          console.log('[ServiceRedirectPage] 📱 App non installée sur Android → Redirection vers Play Store');
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
    // Rediriger vers la page web du service
    window.location.href = webLink;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Ouvrir dans l'app Yukpo</CardTitle>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceRedirectPage;

