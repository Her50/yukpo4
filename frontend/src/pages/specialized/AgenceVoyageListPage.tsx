// ✅ Liste des résultats de recherche d'agences de voyage (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { Bus, MapPin, Phone, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface AgenceVoyage {
    id: number;
    service_id: number;
    user_id: number;
    nom_agence: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    destinations?: string[];
    compagnies_bus?: string[];
    telephone?: string;
    distance_km?: number;
}

const AgenceVoyageListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const filters = (location.state as any)?.filters || {};

    const [agences, setAgences] = useState<AgenceVoyage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadAgences();
    }, []);

    const loadAgences = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const queryParams = new URLSearchParams();
            if (filters.ville) queryParams.append('ville', filters.ville);
            if (filters.quartier) queryParams.append('quartier', filters.quartier);
            if (filters.lat) queryParams.append('lat', filters.lat.toString());
            if (filters.lng) queryParams.append('lng', filters.lng.toString());
            if (filters.max_distance_km) queryParams.append('max_distance_km', filters.max_distance_km.toString());
            if (filters.destination) queryParams.append('destination', filters.destination);
            if (filters.compagnie_bus) queryParams.append('compagnie_bus', filters.compagnie_bus);
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/agences-voyage/search?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                const newAgences = data.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setAgences(newAgences);
                } else {
                    setAgences([...agences, ...newAgences]);
                }
                setHasMore(newAgences.length === 20);
            } else {
                alert('Impossible de charger les agences de voyage');
            }
        } catch (error: any) {
            console.error('[AgenceVoyageListPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les agences de voyage');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadAgences();
        }
    };

    const handleAgenceClick = (agence: AgenceVoyage) => {
        navigate(`/agences-voyage/${agence.id}`);
    };

    if (loading && agences.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement des agences de voyage...</p>
                </div>
            </div>
        );
    }

    if (agences.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center py-16">
                        <Bus className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucune agence de voyage trouvée</h2>
                        <p className="text-gray-600 mb-6">
                            Essayez de modifier vos critères de recherche
                        </p>
                        <Button onClick={() => navigate('/agences-voyage/search')}>
                            Nouvelle recherche
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        {agences.length} agence{agences.length > 1 ? 's' : ''} de voyage trouvée{agences.length > 1 ? 's' : ''}
                    </h1>
                    <Button
                        variant="outline"
                        onClick={() => loadAgences(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {agences.map((agence) => (
                        <Card
                            key={agence.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => handleAgenceClick(agence)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {agence.nom_agence}
                                        </h3>
                                    </div>
                                    <Badge
                                        variant={agence.is_available_now ? 'default' : 'secondary'}
                                        className={agence.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}
                                    >
                                        {agence.is_available_now ? 'Disponible' : 'Indisponible'}
                                    </Badge>
                                </div>

                                <div className="space-y-2">
                                    {(agence.ville || agence.quartier) && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {[agence.ville, agence.quartier].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    {agence.distance_km !== undefined && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {agence.distance_km.toFixed(1)} km
                                        </div>
                                    )}
                                    {agence.telephone && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Phone className="w-4 h-4 mr-2" />
                                            {agence.telephone}
                                        </div>
                                    )}
                                    {agence.destinations && agence.destinations.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 mb-1">Destinations:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {agence.destinations.slice(0, 3).map((dest, idx) => (
                                                    <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                                        {dest}
                                                    </span>
                                                ))}
                                                {agence.destinations.length > 3 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{agence.destinations.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {hasMore && (
                    <div className="text-center mt-8">
                        <Button
                            variant="outline"
                            onClick={handleLoadMore}
                            disabled={loading}
                        >
                            {loading ? 'Chargement...' : 'Charger plus'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgenceVoyageListPage;

