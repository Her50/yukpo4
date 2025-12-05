// ✅ Phase 4: Liste des résultats de recherche d'hôpitaux (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Hospital, MapPin, Phone, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Hopital {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    type_etablissement: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    urgences_disponible: boolean;
    prestations_medicales?: string[];
    telephone?: string;
    telephone_urgence?: string;
    distance_km?: number;
}

const HopitalListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const filters = (location.state as any)?.filters || {};

    const [hopitaux, setHopitaux] = useState<Hopital[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadHopitaux();
    }, []);

    const loadHopitaux = async (isRefresh = false) => {
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
            if (filters.type_etablissement) queryParams.append('type_etablissement', filters.type_etablissement);
            if (filters.prestation) queryParams.append('prestation', filters.prestation);
            if (filters.urgences_only) queryParams.append('urgences_only', 'true');
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/hopitaux/search?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                const newHopitaux = data.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setHopitaux(newHopitaux);
                } else {
                    setHopitaux([...hopitaux, ...newHopitaux]);
                }
                setHasMore(newHopitaux.length === 20);
            } else {
                alert('Impossible de charger les hôpitaux');
            }
        } catch (error: any) {
            console.error('[HopitalListPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les hôpitaux');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadHopitaux();
        }
    };

    const handleHopitalClick = (hopital: Hopital) => {
        navigate(`/hopitaux/${hopital.id}`);
    };

    if (loading && hopitaux.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement des hôpitaux...</p>
                </div>
            </div>
        );
    }

    if (hopitaux.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center py-16">
                        <Hospital className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun hôpital trouvé</h2>
                        <p className="text-gray-600 mb-6">
                            Essayez de modifier vos critères de recherche
                        </p>
                        <Button onClick={() => navigate('/hopitaux/search')}>
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
                        {hopitaux.length} hôpital{hopitaux.length > 1 ? 'aux' : ''} trouvé{hopitaux.length > 1 ? 's' : ''}
                    </h1>
                    <Button
                        variant="outline"
                        onClick={() => loadHopitaux(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {hopitaux.map((hopital) => (
                        <Card
                            key={hopital.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => handleHopitalClick(hopital)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {hopital.nom}
                                        </h3>
                                        <p className="text-sm text-gray-600">{hopital.type_etablissement}</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Badge
                                            variant={hopital.is_available_now ? 'default' : 'secondary'}
                                            className={hopital.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}
                                        >
                                            {hopital.is_available_now ? 'Disponible' : 'Indisponible'}
                                        </Badge>
                                        {hopital.urgences_disponible && (
                                            <Badge className="bg-red-100 text-red-800 border-red-300">
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                Urgences
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {(hopital.ville || hopital.quartier) && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {[hopital.ville, hopital.quartier].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    {hopital.distance_km !== undefined && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {hopital.distance_km.toFixed(1)} km
                                        </div>
                                    )}
                                    {hopital.telephone && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Phone className="w-4 h-4 mr-2" />
                                            {hopital.telephone}
                                        </div>
                                    )}
                                    {hopital.prestations_medicales && hopital.prestations_medicales.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 mb-1">Prestations:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {hopital.prestations_medicales.slice(0, 3).map((prest, idx) => (
                                                    <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                                        {prest}
                                                    </span>
                                                ))}
                                                {hopital.prestations_medicales.length > 3 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{hopital.prestations_medicales.length - 3}
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

export default HopitalListPage;

