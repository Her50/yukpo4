// @ts-nocheck
import AppLayout from "@/components/layout/AppLayout";
import ShareServiceModal from "@/components/ShareServiceModal";
import { Button } from "@/components/ui/buttons";
import ServiceMediaGallery from "@/components/ui/ServiceMediaGallery";
import { useUser } from "@/hooks/useUser";
import axios from "axios";
import { Edit2, Eye, Power, PowerOff, Share2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS, buildUrl } from "../../config/api.config";
import { ROUTES } from "../../routes/AppRoutesRegistry";


const MesServices = () => {
  console.log('[MesServices] Composant monté');
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const [services, setServices] = useState(() => {
    const persisted = localStorage.getItem('mes_services');
    return persisted ? JSON.parse(persisted) : [];
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"tous" | "actif" | "inactif">("tous");
  const [hasFetched, setHasFetched] = useState(false);
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [selectedServiceForPromotion, setSelectedServiceForPromotion] = useState<any>(null);

  // État pour le modal de partage
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedServiceForShare, setSelectedServiceForShare] = useState<any>(null);

  console.log('[MesServices] État initial - user:', user, 'isLoading:', isLoading, 'loading:', loading, 'services count:', services.length);

  // Guard d'authentification : redirige vers /login si pas d'utilisateur
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Écouter les événements de création et modification de service
  useEffect(() => {
    const handleServiceCreated = () => {
      console.log('[MesServices] Event service_created reçu, actualisation des services...');
      setHasFetched(false); // Forcer un nouveau chargement
    };

    const handleServiceUpdated = () => {
      console.log('[MesServices] Event service_updated reçu, actualisation des services...');
      setHasFetched(false); // Forcer un nouveau chargement
    };

    window.addEventListener('service_created', handleServiceCreated);
    window.addEventListener('service_updated', handleServiceUpdated);

    return () => {
      window.removeEventListener('service_created', handleServiceCreated);
      window.removeEventListener('service_updated', handleServiceUpdated);
    };
  }, []);

  // Fonction simple pour rafraîchir les services
  const refreshServices = () => {
    console.log('[MesServices] Rafraîchissement manuel des services...');
    setHasFetched(false);
  };

  // Suppression du rafraîchissement automatique permanent
  // Les services ne se rafraîchissent que lors des actions utilisateur

  useEffect(() => {
    if (!user || hasFetched) {
      console.log('[MesServices] useEffect ignoré - user:', !!user, 'hasFetched:', hasFetched);
      return;
    }
    setHasFetched(true);
    console.log('[MesServices] useEffect déclenché, user:', user);
    if (!user) {
      console.log('[MesServices] Pas d\'utilisateur, arrêt du chargement');
      return;
    }

    const fetchServices = async () => {
      try {
        console.log('[MesServices] Début du chargement des services');
        setLoading(true);

        const token = localStorage.getItem('token');
        console.log('[MesServices] Token présent:', !!token);

        // ✅ CORRIGÉ: Utilise buildUrl et API_ENDPOINTS
        const res = await axios.get(buildUrl(API_ENDPOINTS.SERVICES.PRESTATAIRE_SERVICES), {
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: 10000 // 10 secondes de timeout
        });

        console.log('[MesServices] Réponse API reçue:', res.status, res.data);
        console.log('[MesServices] Nombre de services:', res.data?.length || 0);

        // Trier les services du plus récent au plus ancien
        const servicesTries = res.data.sort((a: any, b: any) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        console.log('[MesServices] Services triés:', servicesTries);
        setServices(servicesTries);
        localStorage.setItem('mes_services', JSON.stringify(servicesTries));

      } catch (error) {
        console.error("[MesServices] Erreur lors du chargement des services:", error);
        console.error("[MesServices] Détails de l'erreur:", error.response?.data);

        // Essayer de charger depuis le localStorage en cas d'erreur
        const cachedServices = localStorage.getItem('mes_services');
        if (cachedServices) {
          try {
            const parsedServices = JSON.parse(cachedServices);
            setServices(parsedServices);
            console.log('[MesServices] Services chargés depuis le cache:', parsedServices.length);
          } catch (parseError) {
            console.error('[MesServices] Erreur lors du parsing du cache:', parseError);
            setServices([]);
          }
        } else {
          setServices([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [user, hasFetched]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  // Fonction pour formater les dates
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Date invalide';
    }
  };

  // Filtrer les services selon le filtre sélectionné
  const filtered = services.filter((s: any) => {
    if (filter === "tous") return true;
    const isActive = s.is_active !== undefined ? s.is_active : s.actif;
    if (filter === "actif") return isActive;
    if (filter === "inactif") return !isActive;
    return true;
  });

  const toggleServiceStatus = async (serviceId: number, currentStatus: boolean) => {
    try {
      // Si on réactive un service (passage de inactif à actif), facturer 1000 FCFA
      if (!currentStatus) {
        // Vérifier le solde avant la réactivation
        const token = localStorage.getItem('token');
        const balanceResponse = await axios.get('/api/users/balance', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const currentBalance = balanceResponse.data.tokens_balance;
        const activationCost = 1000; // 1000 FCFA pour réactivation

        if (currentBalance < activationCost) {
          toast.error(`Solde insuffisant pour réactiver le service. Solde actuel: ${currentBalance} FCFA, Coût: ${activationCost} FCFA`);
          return;
        }

        // Déduire le coût de réactivation
        await axios.post('/api/users/deduct-balance', {
          amount: activationCost,
          reason: 'service_reactivation'
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        // Mettre à jour le solde dans localStorage
        const newBalance = currentBalance - activationCost;
        localStorage.setItem('tokens_balance', newBalance.toString());

        // Déclencher un événement pour mettre à jour l'affichage du solde
        window.dispatchEvent(new CustomEvent('tokens_updated'));

        toast.success(`Service réactivé ! Coût: ${activationCost} FCFA. Nouveau solde: ${newBalance} FCFA`, {
          duration: 5000,
          icon: '💰'
        });
      }

      // Procéder au changement de statut
      await axios.patch(`/api/services/${serviceId}/toggle-status`, {
        actif: !currentStatus
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Mettre à jour l'état local
      const updatedServices = services.map((s: any) =>
        s.id === serviceId ? { ...s, is_active: !currentStatus, actif: !currentStatus } : s
      );
      setServices(updatedServices);

      // Vérifier si c'était le dernier service actif qui a été désactivé
      if (currentStatus) {
        const remainingActiveServices = updatedServices.filter((s: any) => {
          const isActive = s.is_active !== undefined ? s.is_active : s.actif;
          return isActive;
        });

        // Si plus aucun service actif, émettre l'événement service_deleted
        if (remainingActiveServices.length === 0) {
          window.dispatchEvent(new CustomEvent('service_deleted'));
        }

        toast.success("Service désactivé");
      }
      // Le message de réactivation est déjà affiché plus haut
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error);
      toast.error("Erreur lors du changement de statut");
    }
  };

  // Fonction pour ouvrir le modal de partage
  const handleShareService = (service: any) => {
    setSelectedServiceForShare(service);
    setShareModalOpen(true);
  };

  const handlePromotionService = (service: any) => {
    setSelectedServiceForPromotion(service);
    setPromotionModalOpen(true);
  };

  // Fonction pour fermer le modal de partage
  const handleCloseShareModal = () => {
    setShareModalOpen(false);
    setSelectedServiceForShare(null);
  };

  // Fonction pour supprimer un service
  const supprimerService = async (serviceId: number) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/services/${serviceId}/delete`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Mettre à jour l'état local en supprimant le service
      setServices(services.filter(s => s.id !== serviceId));

      toast.success('Service supprimé avec succès');

      // Émettre l'événement de suppression pour mettre à jour les autres composants
      window.dispatchEvent(new CustomEvent('service_deleted'));

      // Forcer le rafraîchissement de la liste
      refreshServices();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression du service');
    }
  };


  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-primary">🧰 Mes services Yukpo</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard-prestataire')}
              className="flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Voir le Dashboard
            </Button>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              🏠 Accueil
            </Button>
            <Button
              onClick={refreshServices}
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Actualisation...
                </>
              ) : (
                <>
                  🔄 Actualiser
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-800">
            Vous avez <span className="font-bold">{services.length}</span> service(s) créé(s)
            {loading && (
              <span className="ml-2 text-sm text-blue-600">
                🔄 Actualisation en cours...
              </span>
            )}
          </p>
        </div>

        <div className="flex justify-center gap-2 flex-wrap">
          <Button
            variant={filter === "tous" ? "default" : "outline"}
            onClick={() => setFilter("tous")}
            size="sm"
          >
            📋 Tous ({services.length})
          </Button>
          <Button
            variant={filter === "actif" ? "default" : "outline"}
            onClick={() => setFilter("actif")}
            size="sm"
          >
            ✅ Actifs ({services.filter((s: any) => {
              const isActive = s.is_active !== undefined ? s.is_active : s.actif;
              return isActive;
            }).length})
          </Button>
          <Button
            variant={filter === "inactif" ? "default" : "outline"}
            onClick={() => setFilter("inactif")}
            size="sm"
          >
            🚫 Inactifs ({services.filter((s: any) => {
              const isActive = s.is_active !== undefined ? s.is_active : s.actif;
              return !isActive;
            }).length})
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              {filter === "tous"
                ? "Aucun service créé pour le moment."
                : `Aucun service ${filter}.`}
            </p>
            <Button onClick={() => navigate('/formulaire-yukpo-intelligent', { state: { mode: 'create' } })}>
              ➕ Créer un nouveau service
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s: any) => {
              // Extraire le titre depuis la structure data
              const titre = s.data?.titre_service?.valeur ||
                s.data?.titre?.valeur ||
                s.titre ||
                'Service sans titre';

              // Extraire la description
              const description = s.data?.description?.valeur ||
                s.description ||
                'Aucune description';

              // Extraire la catégorie
              const categorie = s.data?.category?.valeur ||
                s.data?.categorie?.valeur ||
                s.categorie ||
                null;

              // Extraire le prix
              const prix = s.data?.prix?.valeur ||
                s.prix ||
                null;

              // Extraire la localisation
              const localisation = s.data?.localisation?.valeur ||
                s.localisation ||
                null;

              return (
                <div
                  key={s.id}
                  className={`border rounded-lg p-5 space-y-3 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden group ${(s.is_active !== undefined ? s.is_active : s.actif)
                    ? 'border-green-200 bg-white'
                    : 'border-red-200 bg-red-50'
                    }`}
                >
                  {/* Bannière en arrière-plan */}
                  {(s.data?.banniere?.valeur || s.banniere) && (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-10 transition-opacity duration-300 group-hover:opacity-20"
                      style={{
                        backgroundImage: `url(${s.data?.banniere?.valeur || s.banniere})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    />
                  )}

                  {/* Overlay pour maintenir la lisibilité */}
                  <div className="relative bg-white/95 backdrop-blur-sm min-h-full p-4 rounded-lg">
                    {/* Logo avatar en haut à droite */}
                    {(s.data?.logo?.valeur || s.logo) && (
                      <div className="absolute top-2 right-2 z-30">
                        <div className="w-14 h-14 rounded-full border-3 border-white shadow-lg overflow-hidden bg-white">
                          <img
                            src={s.data?.logo?.valeur || s.logo}
                            className="w-full h-full object-cover"
                            alt="Logo du service"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className={`${(s.data?.logo?.valeur || s.logo) ? 'pt-16' : 'pt-2'}`}>
                      <div className="flex justify-between items-start">
                        <h2 className="text-lg font-semibold flex-1 pr-2">{titre}</h2>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${(s.is_active !== undefined ? s.is_active : s.actif)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {(s.is_active !== undefined ? s.is_active : s.actif) ? '● Actif' : '○ Inactif'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                        {description}
                      </p>

                      {/* Galerie média du service */}
                      <div className="mt-3">
                        <ServiceMediaGallery
                          logo={s.data?.logo?.valeur || s.logo}
                          banniere={s.data?.banniere?.valeur || s.banniere}
                          images_realisations={
                            Array.isArray(s.data?.images_realisations?.valeur)
                              ? s.data.images_realisations.valeur
                              : Array.isArray(s.data?.images_realisations)
                                ? s.data.images_realisations
                                : Array.isArray(s.images_realisations)
                                  ? s.images_realisations
                                  : []
                          }
                          videos={
                            Array.isArray(s.data?.videos?.valeur)
                              ? s.data.videos.valeur
                              : Array.isArray(s.data?.videos)
                                ? s.data.videos
                                : Array.isArray(s.videos)
                                  ? s.videos
                                  : []
                          }
                          className="bg-gray-50 rounded-lg p-3"
                        />
                      </div>

                      <div className="space-y-1 text-xs text-gray-500 mt-3">
                        {categorie && (
                          <p>📁 <span className="font-medium">{categorie}</span></p>
                        )}
                        {localisation && (
                          <p>📍 {localisation}</p>
                        )}
                        {prix && (
                          <p className="text-blue-600 font-mono font-medium">
                            💰 {prix} FCFA
                          </p>
                        )}
                        <p className="text-gray-400">
                          🗓 Créé le {formatDate(s.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                        {/* Modifier */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate(`/formulaire-yukpo-intelligent`, {
                            state: {
                              suggestion: {
                                data: s.data || {},
                                intention: s.intention || 'creation_service',
                                confidence: s.confidence || 0.8
                              },
                              type: 'modification_service',
                              mode: 'edit',
                              serviceId: s.id
                            }
                          })}
                          title="Modifier"
                        >
                          <Edit2 className="h-5 w-5" />
                        </Button>
                        {/* Voir */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate(`/formulaire-yukpo-intelligent`, {
                            state: {
                              suggestion: {
                                data: s.data || {},
                                intention: s.intention || 'creation_service',
                                confidence: s.confidence || 0.8
                              },
                              type: 'visualisation_service',
                              mode: 'readonly'
                            }
                          })}
                          title="Voir"
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                        {/* Partager */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleShareService(s)}
                          title="Partager"
                        >
                          <Share2 className="h-5 w-5 text-blue-600" />
                        </Button>
                        {/* Promotion rapide */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handlePromotionService(s)}
                          title="Gérer la promotion"
                          className={s.promotion?.active ? 'text-orange-600' : 'text-gray-600'}
                        >
                          {s.promotion?.active ? (
                            <div className="relative">
                              <span className="text-lg">🎉</span>
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></div>
                            </div>
                          ) : (
                            <span className="text-lg">🎉</span>
                          )}
                        </Button>
                        {/* Activer/Désactiver */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleServiceStatus(s.id, s.is_active !== undefined ? s.is_active : s.actif)}
                          title={s.is_active !== undefined ? (s.is_active ? 'Désactiver' : 'Activer') : (s.actif ? 'Désactiver' : 'Activer')}
                        >
                          {(s.is_active !== undefined ? s.is_active : s.actif)
                            ? <PowerOff className="h-5 w-5 text-red-600" />
                            : <Power className="h-5 w-5 text-green-600" />}
                        </Button>
                        {/* Supprimer */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le service "${s.data?.titre?.valeur || s.data?.titre_service?.valeur || 'ce service'}" ?\n\nCette action est irréversible.`)) {
                              supprimerService(s.id);
                            }
                          }}
                          title="Supprimer"
                        >
                          <Trash2 className="h-5 w-5 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Boutons d'action - toujours visibles */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex flex-col gap-4">
            <div className="flex justify-center gap-3 flex-wrap">
              <Button
                onClick={() => navigate(ROUTES.MES_PRODUITS)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                📦 Mes Produits
              </Button>
              <Button
                onClick={() => navigate('/creer-publicite')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                ⚡ Créer une publicité
              </Button>
              <Button
                onClick={() => navigate('/dashboard-publicite')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                📊 Analytics Publicité
              </Button>
              <Button
                onClick={() => navigate('/dashboard-prestataire')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                📈 Dashboard Global
              </Button>
              {/* ✅ Phase 9 - Amélioration 32 : Lien vers la gestion des lieux de stock */}
              <Button
                onClick={() => navigate('/delivery/storage-locations')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                📦 Gérer les lieux de stock
              </Button>
            </div>
            <div className="flex justify-center">
              <Button
                onClick={() => navigate('/')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                🏠 Retour à l'accueil
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de partage */}
      {selectedServiceForShare && (
        <ShareServiceModal
          open={shareModalOpen}
          onClose={handleCloseShareModal}
          serviceId={selectedServiceForShare.id.toString()}
          titre={selectedServiceForShare.data?.titre_service?.valeur || selectedServiceForShare.data?.titre?.valeur || selectedServiceForShare.titre || 'Service Yukpo'}
        />
      )}

      {/* Modal de promotion rapide */}
      {selectedServiceForPromotion && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${promotionModalOpen ? 'block' : 'hidden'}`}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                🎉 Promotion du service
              </h3>
              <button
                onClick={() => setPromotionModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                <strong>{selectedServiceForPromotion.data?.titre_service?.valeur || selectedServiceForPromotion.data?.titre?.valeur || 'Service'}</strong>
              </p>

              {/* Statut actuel de la promotion */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Statut actuel</h4>
                {selectedServiceForPromotion.promotion?.active ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-600">🎉</span>
                      <span className="text-sm font-medium">
                        {selectedServiceForPromotion.promotion.type === 'reduction' ? 'Réduction' : 'Promotion'} active
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Valeur :</strong> {selectedServiceForPromotion.promotion.valeur}
                    </div>
                    {selectedServiceForPromotion.promotion.description && (
                      <div className="text-sm text-gray-600">
                        <strong>Description :</strong> {selectedServiceForPromotion.promotion.description}
                      </div>
                    )}
                    {selectedServiceForPromotion.promotion.date_fin && (
                      <div className="text-sm text-gray-600">
                        <strong>Valide jusqu'au :</strong> {formatDate(selectedServiceForPromotion.promotion.date_fin)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Aucune promotion active
                  </div>
                )}
              </div>

              {/* Actions rapides */}
              <div className="space-y-3">
                {selectedServiceForPromotion.promotion?.active ? (
                  <>
                    <Button
                      onClick={() => {
                        // Désactiver la promotion
                        if (window.confirm('Êtes-vous sûr de vouloir désactiver cette promotion ?')) {
                          // TODO: Appel API pour désactiver la promotion
                          toast.success('Promotion désactivée avec succès');
                          setPromotionModalOpen(false);
                          // Recharger les services
                          setHasFetched(false);
                        }
                      }}
                      variant="outline"
                      className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    >
                      ❌ Désactiver la promotion
                    </Button>
                    <Button
                      onClick={() => {
                        setPromotionModalOpen(false);
                        // Rediriger vers le formulaire de modification
                        navigate(`/formulaire-yukpo-intelligent`, {
                          state: {
                            suggestion: {
                              data: selectedServiceForPromotion.data || {},
                              intention: selectedServiceForPromotion.intention || 'creation_service',
                              confidence: selectedServiceForPromotion.confidence || 0.8
                            },
                            type: 'modification_service',
                            mode: 'edit',
                            serviceId: selectedServiceForPromotion.id
                          }
                        });
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      ✏️ Modifier la promotion
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setPromotionModalOpen(false);
                        // Rediriger vers le formulaire de modification
                        navigate(`/formulaire-yukpo-intelligent`, {
                          state: {
                            suggestion: {
                              data: selectedServiceForPromotion.data || {},
                              intention: selectedServiceForPromotion.intention || 'creation_service',
                              confidence: selectedServiceForPromotion.confidence || 0.8
                            },
                            type: 'modification_service',
                            mode: 'edit',
                            serviceId: selectedServiceForPromotion.id
                          }
                        });
                      }}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      🎉 Créer une promotion
                    </Button>
                  </>
                )}

                <Button
                  onClick={() => setPromotionModalOpen(false)}
                  variant="ghost"
                  className="w-full"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default MesServices;
