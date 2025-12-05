// ✅ Phase 5: Liste des résultats de recherche de taxis (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { Car, MapPin, Phone, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Taxi {
    id: number;
    service_id: number;
    user_id: number;
    zone: string;
    gps_actuel?: string;
    is_available_now: boolean;
    type_vehicule?: string;
    marque_modele?: string;
    telephone?: string;
    distance_km?: number;
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
    };
}

const TaxiListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const filters = (location.state as any)?.filters || {};

    const [taxis, setTaxis] = useState<Taxi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadTaxis();
    }, []);

    const loadTaxis = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const queryParams = new URLSearchParams();
            if (filters.zone) queryParams.append('zone', filters.zone);
            if (filters.lat) queryParams.append('lat', filters.lat.toString());
            if (filters.lng) queryParams.append('lng', filters.lng.toString());
            if (filters.max_distance_km) queryParams.append('max_distance_km', filters.max_distance_km.toString());
            if (filters.available_only) queryParams.append('available_only', 'true');
            if (filters.type_vehicule) queryParams.append('type_vehicule', filters.type_vehicule);
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/taxis/search?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                const newTaxis = data.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setTaxis(newTaxis);
                } else {
                    setTaxis([...taxis, ...newTaxis]);
                }
                setHasMore(newTaxis.length === 20);
            } else {
                alert('Impossible de charger les taxis');
            }
        } catch (error: any) {
            console.error('[TaxiListPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les taxis');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadTaxis();
        }
    };

    const handleTaxiClick = (taxi: Taxi) => {
        navigate(`/taxis/${taxi.id}`);
    };

    if (loading && taxis.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement des taxis...</p>
                </div>
            </div>
        );
    }

    if (taxis.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center py-16">
                        <Car className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun taxi trouvé</h2>
                        <p className="text-gray-600 mb-6">
                            Essayez de modifier vos critères de recherche
                        </p>
                        <Button onClick={() => navigate('/taxis/search')}>
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
                        {taxis.length} taxi{taxis.length > 1 ? 's' : ''} trouvé{taxis.length > 1 ? 's' : ''}
                    </h1>
                    <Button
                        variant="outline"
                        onClick={() => loadTaxis(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {taxis.map((taxi) => (
                        <Card
                            key={taxi.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => handleTaxiClick(taxi)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {taxi.zone}
                                        </h3>
                                        {taxi.type_vehicule && (
                                            <p className="text-sm text-gray-600">{taxi.type_vehicule}</p>
                                        )}
                                    </div>
                                    <Badge
                                        variant={taxi.is_available_now ? 'default' : 'secondary'}
                                        className={taxi.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}
                                    >
                                        {taxi.is_available_now ? 'Disponible' : 'Occupé'}
                                    </Badge>
                                </div>

                                {taxi.marque_modele && (
                                    <p className="text-sm text-gray-700 mb-3">{taxi.marque_modele}</p>
                                )}

                                <div className="space-y-2">
                                    {taxi.distance_km !== undefined && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {taxi.distance_km.toFixed(1)} km
                                        </div>
                                    )}
                                    {taxi.telephone && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Phone className="w-4 h-4 mr-2" />
                                            {taxi.telephone}
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

export default TaxiListPage;

