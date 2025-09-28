import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useParams, useNavigation, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { servicesApi } from '@/services/api';
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
  const navigate = useNavigation();
  const { user } = useAuth();
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
      const response = await servicesApi.getServiceById(serviceId);

      if (response.success) {
        const data = response.data;
        setService(data.service);
      } else {
        toast({
          title: "Erreur",
          description: "Service non trouvé",
          type: "error"
        });
        navigation.navigate('Home');
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
      navigation.navigate('Login', { state: { from: `/service/${serviceId}` } });
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
      // Note: Pas de méthode favori dans servicesApi, on utilise fetch pour l'instant
      const response = await fetch(`/api/services/${service.id}/favori`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    
    // Note: window.location.origin et navigator.share n'existent pas en React Native
    // On utilise Linking pour partager
    const url = `https://yukpomnang.com/service/${service.id}`;
    
    // Dans React Native, on utiliserait Linking.openURL ou react-native-share
    // Pour l'instant, on affiche juste le lien
    toast({
      title: "Partage de service",
      description: `Lien: ${url}`,
      type: "info"
    });
    }
  };

  const renderStars = (note: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        style={`w-4 h-4 ${
          i < Math.floor(note) 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <View style="container mx-auto px-4 py-8">
        <View style="flex items-center justify-center h-64">
          <View style="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></View>
        </View>
      </View>
    );
  }

  if (!service) {
    return (
      <View style="container mx-auto px-4 py-8">
        <Card>
          <CardContent style="p-8 text-center">
            <AlertCircle style="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <Text style="text-lg font-semibold mb-2">Service non trouvé</Text>
            <Text style="text-gray-600 mb-4">
              Le service que vous recherchez n'existe pas ou a été supprimé.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              Retour à l'accueil
            </TouchableOpacity>
          </CardContent>
        </Card>
      </View>
    );
  }

  return (
    <View style="container mx-auto px-4 py-8">
      {/* En-tête */}
      <View style="mb-6">
        <TouchableOpacity
          variant="ghost"
          onPress={() => navigation.navigate(-1)}
          style="mb-4"
        >
          <ArrowLeft style="w-4 h-4 mr-2" />
          Retour
        </TouchableOpacity>
        
        <View style="flex justify-between items-start">
          <View>
            <Text style="text-3xl font-bold mb-2">{service.titre}</Text>
            <View style="flex items-center gap-4 text-gray-600 mb-4">
              <View style="flex items-center gap-1">
                <MapPin style="w-4 h-4" />
                {service.localisation}
              </View>
              <View style="flex items-center gap-1">
                <Eye style="w-4 h-4" />
                {service.vues} vues
              </View>
              <View style="flex items-center gap-1">
                <ThumbsUp style="w-4 h-4" />
                {service.likes} j'aime
              </View>
            </View>
          </View>
          
          <View style="flex gap-2">
            <TouchableOpacity
              variant="ghost"
              onPress={toggleFavorite}
              style={service.favori ? 'text-red-500' : 'text-gray-400'}
            >
              <Heart style={`w-5 h-5 ${service.favori ? 'fill-current' : ''}`} />
            </TouchableOpacity>
            <TouchableOpacity
              variant="ghost"
              onPress={shareService}
            >
              <Share2 style="w-5 h-5" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style="grid lg:grid-cols-3 gap-8">
        {/* Contenu principal */}
        <View style="lg:col-span-2 space-y-6">
          {/* Onglets */}
          <View style="border-b">
            <nav style="flex space-x-8">
              {[
                { id: 'description', label: 'Description', icon: MessageSquare },
                { id: 'avis', label: 'Avis', icon: Star },
                { id: 'prestataire', label: 'Prestataire', icon: Users }
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  style={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon style="w-4 h-4" />
                  {tab.label}
                </TouchableOpacity>
              ))}
            </nav>
          </View>

          {/* Contenu des onglets */}
          <View style="min-h-64">
            {activeTab === 'description' && (
              <View style="space-y-4">
                <Text style="text-gray-700 leading-relaxed">{service.description}</Text>
                
                <View>
                  <Text style="font-semibold mb-2">Compétences</Text>
                  <View style="flex flex-wrap gap-2">
                    {service.competences.map((competence, index) => (
                      <Badge key={index} variant="secondary">
                        {competence}
                      </Badge>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style="font-semibold mb-2">Disponibilité</Text>
                  <View style="flex flex-wrap gap-2">
                    {service.disponibilite.map((jour, index) => (
                      <Badge key={index} variant="outline">
                        {jour}
                      </Badge>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'avis' && (
              <View style="space-y-4">
                {service.avis.length > 0 ? (
                  service.avis.map((avis) => (
                    <Card key={avis.id}>
                      <CardContent style="p-4">
                        <View style="flex items-start gap-3">
                          <Avatar style="w-10 h-10">
                            <AvatarImage src={avis.utilisateur.avatar} />
                            <AvatarFallback>
                              {avis.utilisateur.nom.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <View style="flex-1">
                            <View style="flex items-center gap-2 mb-1">
                              <Text style="font-medium">{avis.utilisateur.nom}</Text>
                              <View style="flex">
                                {renderStars(avis.note)}
                              </View>
                            </View>
                            <Text style="text-gray-700 mb-2">{avis.commentaire}</Text>
                            <Text style="text-xs text-gray-500">
                              {new Date(avis.date).toLocaleDateString('fr-FR')}
                            </Text>
                          </View>
                        </View>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <View style="text-center py-8 text-gray-500">
                    Aucun avis pour le moment
                  </View>
                )}
              </View>
            )}

            {activeTab === 'prestataire' && (
              <View style="space-y-4">
                <Card>
                  <CardContent style="p-6">
                    <View style="flex items-center gap-4 mb-4">
                      <Avatar style="w-16 h-16">
                        <AvatarImage src={service.prestataire.avatar} />
                        <AvatarFallback>
                          {service.prestataire.nom.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <View>
                        <Text style="text-xl font-semibold">{service.prestataire.nom}</Text>
                        <View style="flex items-center gap-2 mb-1">
                          {renderStars(service.prestataire.note)}
                          <Text style="text-sm text-gray-600">
                            ({service.prestataire.nombre_avis} avis)
                          </Text>
                        </View>
                        <View style="flex items-center gap-1">
                          <View style={`w-2 h-2 rounded-full ${
                            service.prestataire.statut === 'online' ? 'bg-green-500' :
                            service.prestataire.statut === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`} />
                          <Text style="text-sm text-gray-600 capitalize">
                            {service.prestataire.statut}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {service.prestataire.description && (
                      <Text style="text-gray-700 mb-4">{service.prestataire.description}</Text>
                    )}

                    <View style="grid md:grid-cols-2 gap-4">
                      <View>
                        <h4 style="font-semibold mb-2">Expérience</h4>
                        <Text style="text-gray-600">{service.prestataire.experience} an{service.prestataire.experience > 1 ? 's' : ''}</Text>
                      </View>
                      <View>
                        <h4 style="font-semibold mb-2">Compétences</h4>
                        <View style="flex flex-wrap gap-1">
                          {service.prestataire.competences.map((competence, index) => (
                            <Badge key={index} variant="outline" style="text-xs">
                              {competence}
                            </Badge>
                          ))}
                        </View>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              </View>
            )}
          </View>
        </View>

        {/* Sidebar */}
        <View style="space-y-6">
          {/* Prix et contact */}
          <Card>
            <CardContent style="p-6">
              <View style="text-center mb-6">
                <View style="text-3xl font-bold text-blue-600 mb-1">
                  {service.prix} {service.devise}
                </View>
                <Text style="text-gray-600">Prix du service</Text>
              </View>

              <View style="space-y-3">
                <TouchableOpacity onPress={handleContact} style="w-full">
                  <MessageCircle style="w-4 h-4 mr-2" />
                  Contacter le prestataire
                </TouchableOpacity>
                
                <View style="grid grid-cols-3 gap-2">
                  <TouchableOpacity
                    variant="outline"
                    size="sm"
                    onPress={handleContact}
                    disabled={!service.prestataire.telephone}
                  >
                    <Texthone style="w-4 h-4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    variant="outline"
                    size="sm"
                    onPress={handleContact}
                  >
                    <Video style="w-4 h-4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    variant="outline"
                    size="sm"
                    onPress={handleContact}
                  >
                    <Mail style="w-4 h-4" />
                  </TouchableOpacity>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Informations rapides */}
          <Card>
            <CardHeader>
              <CardTitle style="text-lg">Informations</CardTitle>
            </CardHeader>
            <CardContent style="space-y-3">
              <View style="flex items-center justify-between">
                <Text style="text-gray-600">Localisation</Text>
                <Text style="font-medium">{service.localisation}</Text>
              </View>
              <View style="flex items-center justify-between">
                <Text style="text-gray-600">Expérience</Text>
                <Text style="font-medium">{service.experience} an{service.experience > 1 ? 's' : ''}</Text>
              </View>
              <View style="flex items-center justify-between">
                <Text style="text-gray-600">Créé le</Text>
                <Text style="font-medium">
                  {new Date(service.date_creation).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </CardContent>
          </Card>
        </View>
      </View>

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
    </View>
  );
}; 




