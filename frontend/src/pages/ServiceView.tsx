import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Clock, 
  Star, 
  MessageCircle, 
  Phone, 
  Video, 
  Mail,
  Share2,
  Heart,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Eye,
  ThumbsUp,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import ContactModal from '@/components/contact/ContactModal';
import { Service } from '@/types/service';

interface ServiceViewData {
  id: string;
  titre: string;
  title: string; // Ajouté pour ContactModal
  description: string;
  categorie: string;
  prix: number;
  devise: string;
  localisation: string;
  prestataire: {
    id: string;
    nom: string;
    email: string;
    telephone?: string;
    avatar?: string;
    note: number;
    nombre_avis: number;
    statut: 'online' | 'offline' | 'away';
    description?: string;
    experience: number;
    competences: string[];
  };
  disponibilite: string[];
  competences: string[];
  experience: number;
  date_creation: string;
  favori: boolean;
  vues: number;
  likes: number;
  avis: Array<{
    id: string;
    utilisateur: {
      nom: string;
      avatar?: string;
    };
    note: number;
    commentaire: string;
    date: string;
  }>;
}

export const ServiceView: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [service, setService] = useState<ServiceViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'avis' | 'prestataire'>('description');

  useEffect(() => {
    if (serviceId) {
      fetchService();
    }
  }, [serviceId]);

  const fetchService = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setService(data.service);
      } else {
        toast({
          title: "Erreur",
          description: "Service non trouvé",
          type: "error"
        });
        navigate('/');
      }
    } catch (error) {
      console.error('Erreur lors du chargement du service:', error);
      toast({
        title: "Erreur",
        description: "Erreur de connexion",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour contacter le prestataire",
        type: "error"
      });
      navigate('/login', { state: { from: `/service/${serviceId}` } });
      return;
    }
    
    setShowContactModal(true);
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour ajouter aux favoris",
        type: "error"
      });
      return;
    }

    if (!service) return;

    try {
      const response = await fetch(`/api/services/${service.id}/favori`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setService(prev => prev ? { ...prev, favori: !prev.favori } : null);
        
        toast({
          title: "Succès",
          description: "Favori mis à jour",
          type: "success"
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le favori",
        type: "error"
      });
    }
  };

  const shareService = () => {
    if (!service) return;
    
    const url = `${window.location.origin}/service/${service.id}`;
    if (navigator.share) {
      navigator.share({
        title: service.titre,
        text: service.description,
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: "Lien copié",
        description: "Le lien du service a été copié",
        type: "success"
      });
    }
  };

  const renderStars = (note: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(note) 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Service non trouvé</h3>
            <p className="text-gray-600 mb-4">
              Le service que vous recherchez n'existe pas ou a été supprimé.
            </p>
            <Button onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* En-tête */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{service.titre}</h1>
            <div className="flex items-center gap-4 text-gray-600 mb-4">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {service.localisation}
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {service.vues} vues
              </div>
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-4 h-4" />
                {service.likes} j'aime
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={toggleFavorite}
              className={service.favori ? 'text-red-500' : 'text-gray-400'}
            >
              <Heart className={`w-5 h-5 ${service.favori ? 'fill-current' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              onClick={shareService}
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Contenu principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Onglets */}
          <div className="border-b">
            <nav className="flex space-x-8">
              {[
                { id: 'description', label: 'Description', icon: MessageSquare },
                { id: 'avis', label: 'Avis', icon: Star },
                { id: 'prestataire', label: 'Prestataire', icon: Users }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Contenu des onglets */}
          <div className="min-h-64">
            {activeTab === 'description' && (
              <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">{service.description}</p>
                
                <div>
                  <h3 className="font-semibold mb-2">Compétences</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.competences.map((competence, index) => (
                      <Badge key={index} variant="secondary">
                        {competence}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Disponibilité</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.disponibilite.map((jour, index) => (
                      <Badge key={index} variant="outline">
                        {jour}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'avis' && (
              <div className="space-y-4">
                {service.avis.length > 0 ? (
                  service.avis.map((avis) => (
                    <Card key={avis.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={avis.utilisateur.avatar} />
                            <AvatarFallback>
                              {avis.utilisateur.nom.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{avis.utilisateur.nom}</span>
                              <div className="flex">
                                {renderStars(avis.note)}
                              </div>
                            </div>
                            <p className="text-gray-700 mb-2">{avis.commentaire}</p>
                            <span className="text-xs text-gray-500">
                              {new Date(avis.date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Aucun avis pour le moment
                  </div>
                )}
              </div>
            )}

            {activeTab === 'prestataire' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={service.prestataire.avatar} />
                        <AvatarFallback>
                          {service.prestataire.nom.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-semibold">{service.prestataire.nom}</h3>
                        <div className="flex items-center gap-2 mb-1">
                          {renderStars(service.prestataire.note)}
                          <span className="text-sm text-gray-600">
                            ({service.prestataire.nombre_avis} avis)
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${
                            service.prestataire.statut === 'online' ? 'bg-green-500' :
                            service.prestataire.statut === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`} />
                          <span className="text-sm text-gray-600 capitalize">
                            {service.prestataire.statut}
                          </span>
                        </div>
                      </div>
                    </div>

                    {service.prestataire.description && (
                      <p className="text-gray-700 mb-4">{service.prestataire.description}</p>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Expérience</h4>
                        <p className="text-gray-600">{service.prestataire.experience} an{service.prestataire.experience > 1 ? 's' : ''}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Compétences</h4>
                        <div className="flex flex-wrap gap-1">
                          {service.prestataire.competences.map((competence, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {competence}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Prix et contact */}
          <Card>
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {service.prix} {service.devise}
                </div>
                <p className="text-gray-600">Prix du service</p>
              </div>

              <div className="space-y-3">
                <Button onClick={handleContact} className="w-full">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contacter le prestataire
                </Button>
                
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleContact}
                    disabled={!service.prestataire.telephone}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleContact}
                  >
                    <Video className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleContact}
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informations rapides */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Localisation</span>
                <span className="font-medium">{service.localisation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Expérience</span>
                <span className="font-medium">{service.experience} an{service.experience > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Créé le</span>
                <span className="font-medium">
                  {new Date(service.date_creation).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {service && (
        <ContactModal
          service={{
            id: parseInt(service.id),
            data: {
              titre_service: service.titre,
              description: service.description,
              telephone: service.prestataire.telephone,
              email: service.prestataire.email,
              gps_fixe: service.localisation
            },
            is_active: true,
            created_at: service.date_creation,
            user_id: parseInt(service.prestataire.id)
          }}
          prestataires={new Map()}
          user={user}
          onClose={() => setShowContactModal(false)}
        />
      )}
    </div>
  );
}; 