import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
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
  const navigate = useNavigate();
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
    navigate(`/service/${serviceId}`);
  };

  const handleContact = (prestataireId: string, type: 'message' | 'call') => {
    if (type === 'message') {
      navigate(`/chat/${prestataireId}`);
    } else {
      toast.info('Fonctionnalité d\'appel en cours de développement');
    }
  };

  const handleShare = (service: Service) => {
    const url = `${window.location.origin}/service/${service.id}`;
    if (navigator.share) {
      navigator.share({
        title: service.titre,
        text: service.description,
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Lien copié dans le presse-papiers');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Barre de recherche */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Rechercher un service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">
              Rechercher
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Filter className="h-5 w-5" />
            Filtres
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Catégorie"
              value={filters.categorie}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({...filters, categorie: e.target.value})}
            />
            <Input
              placeholder="Localisation"
              value={filters.localisation}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({...filters, localisation: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Prix min"
              value={filters.prix_min}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({...filters, prix_min: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Prix max"
              value={filters.prix_max}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({...filters, prix_max: e.target.value})}
            />
          </div>
        </CardContent>
      </Card>

      {/* Résultats */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Résultats de recherche
            {query && (
              <span className="text-gray-600 font-normal ml-2">
                pour "{query}"
              </span>
            )}
          </h2>
          <Badge variant="secondary">
            {services.length} service{services.length !== 1 ? 's' : ''} trouvé{services.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                {error}
              </div>
            </CardContent>
          </Card>
        )}

        {services.length === 0 && !error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Aucun service trouvé</h3>
                <p className="text-gray-600 mb-4">
                  Essayez de modifier vos critères de recherche ou vos filtres.
                </p>
                <Button onClick={() => navigate('/recherche-besoin')}>
                  Nouvelle recherche
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card 
              key={service.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleServiceClick(service.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="text-lg font-semibold line-clamp-2">
                    {service.titre}
                  </div>
                  <Badge variant={service.statut === 'actif' ? 'default' : 'secondary'}>
                    {service.statut === 'actif' ? 'Disponible' : 'Indisponible'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {service.localisation}
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {service.prix} {service.devise}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4 line-clamp-3">
                  {service.description}
                </p>
                
                {service.tags && service.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {service.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {service.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{service.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{service.prestataire.nom}</span>
                    <Star className="h-4 w-4 text-yellow-500" />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContact(service.prestataire.id, 'message');
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContact(service.prestataire.id, 'call');
                      }}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(service);
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResultatsBesoin;
