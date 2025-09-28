import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useSearchParams, useNavigation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  Card, 
  CardContent, 
  CardHeader
} from '@/components/ui/card';
import { Button } from '@/components/ui/buttons';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Filter, 
  MapPin, 
  Star, 
  DollarSign,
  MessageCircle,
  Phone,
  Share2
} from 'lucide-react';
import axios from 'axios';

// Composant Badge simple
const Badge: React.FC<{ 
  children: React.ReactNode; 
  variant?: 'default' | 'secondary' | 'outline'; 
  className?: string;
}> = ({ children, variant = 'default', className = '' }) => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-input bg-background'
  };
  
  return (
    <Text style={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </Text>
  );
};

interface Service {
  id: string;
  titre: string;
  description: string;
  prix: number;
  devise: string;
  categorie: string;
  localisation: string;
  prestataire: {
    id: string;
    nom: string;
    email: string;
    avatar?: string;
  };
  statut: 'actif' | 'inactif';
  date_creation: string;
  tags?: string[];
  score_relevance?: number;
}

const ResultatsBesoin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigation();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    categorie: '',
    localisation: '',
    prix_min: '',
    prix_max: ''
  });

  const query = searchParams.get('q') || '';

  useEffect(() => {
    if (query) {
      setSearchTerm(query);
      searchServices(query);
    }
  }, [query]);

  const searchServices = async (searchQuery: string) => {
    try {
      setLoading(true);
      const response = await axios.get('/api/services/recherche', {
        params: {
          q: searchQuery,
          ...filters
        }
      });
      setServices(response.data.services || []);
    } catch (err: any) {
      console.error('Erreur lors de la recherche:', err);
      setError(err.response?.data?.message || 'Erreur lors de la recherche');
      toast.error('Impossible de rechercher les services');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchServices(searchTerm);
    }
  };

  const handleServiceClick = (serviceId: string) => {
    navigation.navigate(`/service/${serviceId}`);
  };

  const handleContact = (prestataireId: string, type: 'message' | 'call') => {
    if (type === 'message') {
      navigation.navigate(`/chat/${prestataireId}`);
    } else {
      toast.info('Fonctionnalité d\'appel en cours de développement');
    }
  };

  const handleShare = (service: Service) => {
    // Note: window.location.origin et navigator.share n'existent pas en React Native
    const url = `https://yukpomnang.com/service/${service.id}`;
    // Dans React Native, on utiliserait Linking.openURL ou react-native-share
    // Pour l'instant, on affiche juste le lien
    console.log('Partage de service:', url);
  };

  if (loading) {
    return (
      <View style="container mx-auto px-4 py-8">
        <View style="flex items-center justify-center min-h-[400px]">
          <View style="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></View>
        </View>
      </View>
    );
  }

  return (
    <View style="container mx-auto px-4 py-8">
      {/* Barre de recherche */}
      <Card style="mb-8">
        <CardContent style="pt-6">
          <form onSubmit={handleSearch} style="flex gap-4">
            <View style="flex-1 relative">
              <Search style="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <TextInput
                type="text"
                placeholder="Rechercher un service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style="pl-10"
              />
            </View>
            <TouchableOpacity type="submit">
              Rechercher
            </TouchableOpacity>
          </form>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card style="mb-8">
        <CardHeader>
          <View style="flex items-center gap-2 text-lg font-semibold">
            <Filter style="h-5 w-5" />
            Filtres
          </View>
        </CardHeader>
        <CardContent>
          <View style="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TextInput
              placeholder="Catégorie"
              value={filters.categorie}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({...filters, categorie: e.target.value})}
            />
            <TextInput
              placeholder="Localisation"
              value={filters.localisation}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({...filters, localisation: e.target.value})}
            />
            <TextInput
              type="number"
              placeholder="Prix min"
              value={filters.prix_min}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({...filters, prix_min: e.target.value})}
            />
            <TextInput
              type="number"
              placeholder="Prix max"
              value={filters.prix_max}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({...filters, prix_max: e.target.value})}
            />
          </View>
        </CardContent>
      </Card>

      {/* Résultats */}
      <View style="space-y-6">
        <View style="flex items-center justify-between">
          <Text style="text-2xl font-bold">
            Résultats de recherche
            {query && (
              <Text style="text-gray-600 font-normal ml-2">
                pour "{query}"
              </Text>
            )}
          </Text>
          <Badge variant="secondary">
            {services.length} service{services.length !== 1 ? 's' : ''} trouvé{services.length !== 1 ? 's' : ''}
          </Badge>
        </View>

        {error && (
          <Card>
            <CardContent style="pt-6">
              <View style="text-center text-red-600">
                {error}
              </View>
            </CardContent>
          </Card>
        )}

        {services.length === 0 && !error && (
          <Card>
            <CardContent style="pt-6">
              <View style="text-center">
                <Text style="text-xl font-semibold mb-2">Aucun service trouvé</Text>
                <Text style="text-gray-600 mb-4">
                  Essayez de modifier vos critères de recherche ou vos filtres.
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('/recherche-besoin')}>
                  Nouvelle recherche
                </TouchableOpacity>
              </View>
            </CardContent>
          </Card>
        )}

        <View style="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card 
              key={service.id} 
              style="cursor-pointer hover:shadow-lg transition-shadow"
              onPress={() => handleServiceClick(service.id)}
            >
              <CardHeader>
                <View style="flex items-start justify-between">
                  <View style="text-lg font-semibold line-clamp-2">
                    {service.titre}
                  </View>
                  <Badge variant={service.statut === 'actif' ? 'default' : 'secondary'}>
                    {service.statut === 'actif' ? 'Disponible' : 'Indisponible'}
                  </Badge>
                </View>
                <View style="flex items-center gap-4 text-sm text-gray-600">
                  <View style="flex items-center gap-1">
                    <MapPin style="h-4 w-4" />
                    {service.localisation}
                  </View>
                  <View style="flex items-center gap-1">
                    <DollarSign style="h-4 w-4" />
                    {service.prix} {service.devise}
                  </View>
                </View>
              </CardHeader>
              <CardContent>
                <Text style="text-gray-700 mb-4 line-clamp-3">
                  {service.description}
                </Text>
                
                {service.tags && service.tags.length > 0 && (
                  <View style="flex flex-wrap gap-1 mb-4">
                    {service.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" style="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {service.tags.length > 3 && (
                      <Badge variant="outline" style="text-xs">
                        +{service.tags.length - 3}
                      </Badge>
                    )}
                  </View>
                )}

                <View style="flex items-center justify-between">
                  <View style="flex items-center gap-2">
                    <Text style="text-sm font-medium">{service.prestataire.nom}</Text>
                    <Star style="h-4 w-4 text-yellow-500" />
                  </View>
                  
                  <View style="flex gap-2">
                    <TouchableOpacity
                      size="sm"
                      variant="ghost"
                      onPress={(e) => {
                        e.stopPropagation();
                        handleContact(service.prestataire.id, 'message');
                      }}
                    >
                      <MessageCircle style="h-4 w-4" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      size="sm"
                      variant="ghost"
                      onPress={(e) => {
                        e.stopPropagation();
                        handleContact(service.prestataire.id, 'call');
                      }}
                    >
                      <Texthone style="h-4 w-4" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      size="sm"
                      variant="ghost"
                      onPress={(e) => {
                        e.stopPropagation();
                        handleShare(service);
                      }}
                    >
                      <Share2 style="h-4 w-4" />
                    </TouchableOpacity>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>
    </View>
  );
};

export default ResultatsBesoin;





