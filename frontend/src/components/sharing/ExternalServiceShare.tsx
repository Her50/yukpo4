// Composant pour gérer le partage de services vers l'extérieur
// Redirection intelligente selon l'état d'authentification de l'utilisateur

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { apiService } from '@/services/apiService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { 
  ExternalLink, 
  UserPlus, 
  LogIn, 
  ArrowRight,
  Clock,
  MapPin,
  User,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Service } from '@/types/service';
import ServiceCard from '@/components/services/ServiceCard';
import { usePrestataireInfo } from '@/hooks/usePrestataireInfo';

interface ExternalServiceShareProps {
  serviceId?: string;
  redirectToService?: boolean;
}

export const ExternalServiceShare: React.FC<ExternalServiceShareProps> = ({ 
  serviceId, 
  redirectToService = false 
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: userLoading } = useUser();
  const { isAuthenticated, cleanInvalidToken } = useAuth();
  const { toast } = useToast();
  
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Hook pour récupérer les informations des prestataires
  const { prestataires, fetchPrestatairesBatch, loading: prestatairesLoading } = usePrestataireInfo();
  
  // Récupérer l'ID du service depuis les paramètres URL ou les props
  const serviceIdFromUrl = searchParams.get('serviceId') || serviceId;
  const sharedServiceId = searchParams.get('shared') || serviceIdFromUrl;

  useEffect(() => {
    if (sharedServiceId) {
      loadService(sharedServiceId);
    } else {
      setError('Aucun service spécifié');
      setLoading(false);
    }
  }, [sharedServiceId]);

  const loadService = async (id: string) => {
    try {
      setLoading(true);
      // Utiliser la route sécurisée pour les services partagés
      const response = await fetch(`/api/services/shared/${id}`);
      
      if (!response.ok) {
        throw new Error('Service non trouvé');
      }
      
      const serviceData = await response.json();
      setService(serviceData);
      
      // Les informations du prestataire sont déjà incluses dans la réponse
      if (serviceData.prestataire) {
        setPrestataireInfo(prev => ({
          ...prev,
          [serviceData.prestataire.id]: serviceData.prestataire
        }));
      }
    } catch (err) {
      console.error('Erreur lors du chargement du service:', err);
      setError('Service non trouvé ou inaccessible');
    } finally {
      setLoading(false);
    }
  };

  const handleViewService = () => {
    if (isAuthenticated && user) {
      // Utilisateur connecté : rediriger vers le service dans l'application
      navigate(`/service/${sharedServiceId}`);
    } else {
      // Utilisateur non connecté : rediriger vers l'inscription avec redirection
      const redirectUrl = encodeURIComponent(`/service/${sharedServiceId}`);
      navigate(`/register?redirect=${redirectUrl}&source=shared_service`);
    }
  };

  const handleLogin = () => {
    const redirectUrl = encodeURIComponent(`/service/${sharedServiceId}`);
    navigate(`/login?redirect=${redirectUrl}&source=shared_service`);
  };

  const handleRegister = () => {
    const redirectUrl = encodeURIComponent(`/service/${sharedServiceId}`);
    navigate(`/register?redirect=${redirectUrl}&source=shared_service`);
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/shared-service?serviceId=${sharedServiceId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Lien copié !",
        description: "Le lien de partage a été copié dans le presse-papiers.",
        variant: "default",
      });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Chargement du service...</p>
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Service non trouvé</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline">
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Service partagé
          </h1>
          <p className="text-gray-600">
            {isAuthenticated 
              ? "Vous êtes connecté. Cliquez pour voir le service complet."
              : "Connectez-vous ou créez un compte pour accéder au service complet."
            }
          </p>
        </div>

        {/* Carte de service complète comme dans resultatbesoin */}
        <div className="flex justify-center mb-8">
          <div className="max-w-md w-full">
            {prestatairesLoading ? (
              <Card className="p-8 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold mb-2">Chargement des informations</h3>
                <p className="text-gray-600">Récupération des données du prestataire...</p>
              </Card>
            ) : (
              <ServiceCard
                service={service}
                prestataires={prestataires}
                user={user}
                wsConnected={false} // Pas de WebSocket pour les utilisateurs externes
                userStatus={null}
                onContact={(service) => {
                  if (isAuthenticated) {
                    // Rediriger vers la page de contact
                    navigate(`/service/${service.id}/contact`);
                  } else {
                    handleRegister();
                  }
                }}
                onChat={(service) => {
                  if (isAuthenticated) {
                    // Rediriger vers le chat
                    navigate(`/service/${service.id}/chat`);
                  } else {
                    handleRegister();
                  }
                }}
                onGallery={(service) => {
                  if (isAuthenticated) {
                    // Rediriger vers la galerie
                    navigate(`/service/${service.id}/gallery`);
                  } else {
                    handleRegister();
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Actions d'authentification */}
        <Card className="mb-8">
          <CardContent className="p-6">
            {isAuthenticated ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span>Vous êtes connecté - Accès complet disponible</span>
                </div>
                <Button onClick={handleViewService} className="flex items-center">
                  Accéder à l'application
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center text-yellow-800 mb-2">
                    <ExternalLink className="h-5 w-5 mr-2" />
                    <span className="font-medium">Accès limité</span>
                  </div>
                  <p className="text-yellow-700 text-sm">
                    Pour contacter le prestataire, voir la galerie complète et accéder à toutes les fonctionnalités, 
                    vous devez créer un compte ou vous connecter.
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  <Button onClick={handleRegister} className="flex-1">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Créer un compte
                  </Button>
                  <Button onClick={handleLogin} variant="outline" className="flex-1">
                    <LogIn className="h-4 w-4 mr-2" />
                    Se connecter
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions supplémentaires */}
        <div className="text-center">
          <Button onClick={copyShareLink} variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Copier le lien de partage
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExternalServiceShare;
