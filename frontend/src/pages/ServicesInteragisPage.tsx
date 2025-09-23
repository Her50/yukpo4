import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import {
    Clock,
    Eye,
    Filter,
    Heart,
    MapPin,
    MessageCircle,
    Phone,
    Search,
    Share2,
    Star,
    Video
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface InteractedService {
    id: string;
    serviceId: string;
    serviceTitle: string;
    serviceDescription: string;
    prestataireName: string;
    prestataireAvatar?: string;
    prestataireRating: number;
    lastInteraction: Date;
    interactionType: 'message' | 'call' | 'video' | 'review' | 'favorite' | 'share' | 'view';
    interactionCount: number;
    isFavorite: boolean;
    location: string;
    price: number;
    category: string;
    status: 'active' | 'completed' | 'cancelled';
}

const ServicesInteragisPage: React.FC = () => {
    const [services, setServices] = useState<InteractedService[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
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
                // Charger depuis localStorage si l'API échoue
                const savedServices = localStorage.getItem('interactedServices');
                if (savedServices) {
                    try {
                        const parsedServices = JSON.parse(savedServices);
                        setServices(parsedServices);
                    } catch (e) {
                        setServices([]);
                    }
                } else {
                    setServices([]);
                }
            }
        } catch (error) {
            console.error('Erreur chargement services interagis:', error);
            // Fallback: charger depuis localStorage
            const savedServices = localStorage.getItem('interactedServices');
            if (savedServices) {
                try {
                    const parsedServices = JSON.parse(savedServices);
                    setServices(parsedServices);
                } catch (e) {
                    setServices([]);
                }
            } else {
                setServices([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredServices = services
        .filter(service => {
            const matchesSearch = service.serviceTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                service.prestataireName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = filterType === 'all' || service.interactionType === filterType;
            const matchesCategory = filterCategory === 'all' || service.category === filterCategory;
            return matchesSearch && matchesFilter && matchesCategory;
        })
        .sort((a, b) => b.lastInteraction.getTime() - a.lastInteraction.getTime());

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
            case 'favorite': return <Heart className="w-4 h-4" />;
            case 'share': return <Share2 className="w-4 h-4" />;
            case 'view': return <Eye className="w-4 h-4" />;
            default: return <MessageCircle className="w-4 h-4" />;
        }
    };

    const getInteractionColor = (type: string) => {
        switch (type) {
            case 'message': return 'bg-blue-100 text-blue-800';
            case 'call': return 'bg-green-100 text-green-800';
            case 'video': return 'bg-purple-100 text-purple-800';
            case 'review': return 'bg-yellow-100 text-yellow-800';
            case 'favorite': return 'bg-red-100 text-red-800';
            case 'share': return 'bg-gray-100 text-gray-800';
            case 'view': return 'bg-indigo-100 text-indigo-800';
            default: return 'bg-gray-100 text-gray-800';
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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher un service..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

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
                                <option value="favorite">Favoris</option>
                                <option value="share">Partages</option>
                                <option value="view">Vues</option>
                            </select>

                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">Toutes les catégories</option>
                                <option value="Électronique">Électronique</option>
                                <option value="Formation">Formation</option>
                                <option value="Beauté">Beauté</option>
                                <option value="Mécanique">Mécanique</option>
                                <option value="Coiffure">Coiffure</option>
                            </select>

                            <Button
                                variant="outline"
                                onClick={loadInteractedServices}
                                className="flex items-center gap-2"
                            >
                                <Filter className="w-4 h-4" />
                                Actualiser
                            </Button>
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
                                                    <Badge className={getInteractionColor(service.interactionType)}>
                                                        {getInteractionIcon(service.interactionType)}
                                                        <span className="ml-1">{service.interactionType}</span>
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

export default ServicesInteragisPage;
