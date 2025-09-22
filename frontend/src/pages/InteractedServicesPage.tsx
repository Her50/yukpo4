import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageCircle, 
  Phone, 
  Video, 
  Star, 
  Clock, 
  MapPin, 
  Calendar,
  Filter,
  Search,
  Heart,
  Share2
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/ui/use-toast';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

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
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      loadInteractedServices();
    }
  }, [user?.id]);

  const loadInteractedServices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/services/interacted', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      } else {
        // Simulation pour le développement
        const mockServices: InteractedService[] = [
          {
            id: '1',
            serviceId: 'service-1',
            serviceTitle: 'Réparation iPhone 12 Pro',
            serviceDescription: 'Réparation écran et batterie iPhone 12 Pro',
            prestataireName: 'Jean Tech',
            prestataireRating: 4.8,
            lastInteraction: new Date(Date.now() - 1000 * 60 * 30),
            interactionType: 'message',
            interactionCount: 15,
            isFavorite: true,
            location: 'Douala, Cameroun',
            price: 25000,
            category: 'Électronique',
            status: 'active'
          },
          {
            id: '2',
            serviceId: 'service-2',
            serviceTitle: 'Cours de guitare acoustique',
            serviceDescription: 'Apprentissage guitare pour débutants et intermédiaires',
            prestataireName: 'Marie Music',
            prestataireRating: 4.9,
            lastInteraction: new Date(Date.now() - 1000 * 60 * 60 * 2),
            interactionType: 'video',
            interactionCount: 8,
            isFavorite: false,
            location: 'Yaoundé, Cameroun',
            price: 5000,
            category: 'Formation',
            status: 'completed'
          },
          {
            id: '3',
            serviceId: 'service-3',
            serviceTitle: 'Coiffure mariée',
            serviceDescription: 'Coiffure sophistiquée pour mariage',
            prestataireName: 'Sophie Coiffure',
            prestataireRating: 4.7,
            lastInteraction: new Date(Date.now() - 1000 * 60 * 60 * 24),
            interactionType: 'call',
            interactionCount: 5,
            isFavorite: true,
            location: 'Douala, Cameroun',
            price: 15000,
            category: 'Beauté',
            status: 'completed'
          }
        ];
        setServices(mockServices);
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
      case 'message': return <MessageCircle className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'review': return <Star className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
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
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de vos services...</p>
        </div>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <div className="py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Services Interagis
          </h1>
          <p className="text-gray-600">
            Retrouvez tous les services avec lesquels vous avez interagi
          </p>
        </div>

        {/* Filtres et recherche */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Recherche */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un service ou prestataire..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filtre par type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="recent">Plus récent</option>
                <option value="interactions">Plus d'interactions</option>
                <option value="rating">Meilleure note</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Liste des services */}
        <div className="space-y-4">
          {filteredServices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun service interagi
                </h3>
                <p className="text-gray-600">
                  Commencez à interagir avec des services pour les voir apparaître ici
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredServices.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={service.prestataireAvatar} />
                        <AvatarFallback className="bg-blue-500 text-white">
                          {service.prestataireName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {service.serviceTitle}
                          </h3>
                          <Badge className={getStatusColor(service.status)}>
                            {service.status}
                          </Badge>
                        </div>

                        <p className="text-gray-600 mb-2">
                          {service.serviceDescription}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {service.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            {service.prestataireRating}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTimeAgo(service.lastInteraction)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Heart className={`w-4 h-4 ${service.isFavorite ? 'fill-current' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getInteractionIcon(service.interactionType)}
                        <span className="text-sm text-gray-600">
                          {service.interactionCount} interactions
                        </span>
                      </div>
                      <div className="text-sm font-medium text-green-600">
                        {service.price.toLocaleString()} FCFA
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Ouvrir le chat
                          toast({
                            title: "Ouverture du chat",
                            description: `Chat avec ${service.prestataireName}`,
                            type: "success"
                          });
                        }}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chat
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Appeler
                          toast({
                            title: "Appel",
                            description: `Appel vers ${service.prestataireName}`,
                            type: "success"
                          });
                        }}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Appeler
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </ResponsiveContainer>
  );
};

export default InteractedServicesPage;
