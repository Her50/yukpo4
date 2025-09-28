import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import { servicesApi } from '@/services/api';
import {
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Star,
  Video
} from 'lucide-react';
import * as React from "react";
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';

interface InteractedService {
  id: string;
  serviceId: string;
  serviceTitle: string;
  serviceDescription: string;
  prestataireName: string;
  prestataireAvatar?: string;
  prestataireRating: number;
  lastInteraction: Date;
  interactionType: 'message' | 'call' | 'video' | 'review';
  interactionCount: number;
  isFavorite: boolean;
  location: string;
  price: number;
  category: string;
  status: 'active' | 'completed' | 'cancelled';
}

const InteractedServicesPage: React.FC = () => {
  const [services, setServices] = useState<InteractedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'interactions' | 'rating'>('recent');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      loadInteractedServices();
    }
  }, [user?.id]);

  const loadInteractedServices = async () => {
    setLoading(true);
    try {
      const response = await servicesApi.getInteractedServices();

      if (response.success) {
        const data = response.data;
        setServices(data.services || []);
      } else {
        // Si pas de services interagis, afficher une liste vide
        setServices([]);
      }
    } catch (error) {
      console.error('Erreur chargement services interagis:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos services interagis",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services
    .filter(service => {
      const matchesSearch = service.serviceTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.prestataireName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'all' || service.interactionType === filterType;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return b.lastInteraction.getTime() - a.lastInteraction.getTime();
        case 'interactions':
          return b.interactionCount - a.interactionCount;
        case 'rating':
          return b.prestataireRating - a.prestataireRating;
        default:
          return 0;
      }
    });

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageCircle style="w-4 h-4" />;
      case 'call': return <Texthone style="w-4 h-4" />;
      case 'video': return <Video style="w-4 h-4" />;
      case 'review': return <Star style="w-4 h-4" />;
      default: return <MessageCircle style="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <ResponsiveContainer>
        <View style="text-center py-12">
          <View style="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></View>
          <Text style="mt-4 text-gray-600">Chargement de vos services...</Text>
        </View>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <View style="py-8">
        {/* Header */}
        <View style="mb-8">
          <Text style="text-3xl font-bold text-gray-900 mb-2">
            Dashboard Prestataire
          </Text>
          <Text style="text-gray-600">
            Tableau de bord intelligent avec statistiques en temps réel
          </Text>
        </View>

        {/* Filtres et recherche */}
        <Card style="mb-6">
          <CardContent style="p-6">
            <View style="flex flex-col md:flex-row gap-4">
              {/* Recherche */}
              <View style="flex-1 relative">
                <Search style="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <TextInput
                  type="text"
                  placeholder="Rechercher un service ou prestataire..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </View>

              {/* Filtre par type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les types</option>
                <option value="message">Messages</option>
                <option value="call">Appels</option>
                <option value="video">Vidéos</option>
                <option value="review">Avis</option>
              </select>

              {/* Tri */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="recent">Plus récent</option>
                <option value="interactions">Plus d'interactions</option>
                <option value="rating">Meilleure note</option>
              </select>
            </View>
          </CardContent>
        </Card>

        {/* Liste des services */}
        <View style="space-y-4">
          {filteredServices.length === 0 ? (
            <Card>
              <CardContent style="text-center py-12">
                <MessageCircle style="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <Text style="text-lg font-medium text-gray-900 mb-2">
                  Aucun service interagi
                </Text>
                <Text style="text-gray-600">
                  Commencez à interagir avec des services pour les voir apparaître ici
                </Text>
              </CardContent>
            </Card>
          ) : (
            filteredServices.map((service) => (
              <Card key={service.id} style="hover:shadow-lg transition-shadow">
                <CardContent style="p-6">
                  <View style="flex items-start justify-between mb-4">
                    <View style="flex items-start gap-4">
                      <Avatar style="w-12 h-12">
                        <AvatarImage src={service.prestataireAvatar} />
                        <AvatarFallback style="bg-blue-500 text-white">
                          {service.prestataireName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <View style="flex-1">
                        <View style="flex items-center gap-2 mb-2">
                          <Text style="text-lg font-semibold text-gray-900">
                            {service.serviceTitle}
                          </Text>
                          <Badge style={getStatusColor(service.status)}>
                            {service.status}
                          </Badge>
                        </View>

                        <Text style="text-gray-600 mb-2">
                          {service.serviceDescription}
                        </Text>

                        <View style="flex items-center gap-4 text-sm text-gray-500">
                          <Text style="flex items-center gap-1">
                            <MapPin style="w-4 h-4" />
                            {service.location}
                          </Text>
                          <Text style="flex items-center gap-1">
                            <Star style="w-4 h-4 text-yellow-500" />
                            {service.prestataireRating}
                          </Text>
                          <Text style="flex items-center gap-1">
                            <Clock style="w-4 h-4" />
                            {formatTimeAgo(service.lastInteraction)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style="flex items-center gap-2">
                      <TouchableOpacity
                        variant="ghost"
                        size="sm"
                        style="text-red-500 hover:text-red-700"
                      >
                        <Heart style={`w-4 h-4 ${service.isFavorite ? 'fill-current' : ''}`} />
                      </TouchableOpacity>
                      <TouchableOpacity variant="ghost" size="sm">
                        <Share2 style="w-4 h-4" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style="flex items-center justify-between">
                    <View style="flex items-center gap-4">
                      <View style="flex items-center gap-2">
                        {getInteractionIcon(service.interactionType)}
                        <Text style="text-sm text-gray-600">
                          {service.interactionCount} interactions
                        </Text>
                      </View>
                      <View style="text-sm font-medium text-green-600">
                        {service.price.toLocaleString()} FCFA
                      </View>
                    </View>

                    <View style="flex items-center gap-2">
                      <TouchableOpacity
                        variant="outline"
                        size="sm"
                        onPress={() => {
                          // Ouvrir le chat
                          toast({
                            title: "Ouverture du chat",
                            description: `Chat avec ${service.prestataireName}`,
                            type: "success"
                          });
                        }}
                      >
                        <MessageCircle style="w-4 h-4 mr-2" />
                        Chat
                      </TouchableOpacity>
                      <TouchableOpacity
                        variant="outline"
                        size="sm"
                        onPress={() => {
                          // Appeler
                          toast({
                            title: "Appel",
                            description: `Appel vers ${service.prestataireName}`,
                            type: "success"
                          });
                        }}
                      >
                        <Texthone style="w-4 h-4 mr-2" />
                        Appeler
                      </TouchableOpacity>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </View>
    </ResponsiveContainer>
  );
};

export default InteractedServicesPage;





