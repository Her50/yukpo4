// ✅ Liste des résultats de recherche de banques de sang (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { Droplet, MapPin, Phone, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface BanqueSang {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    stocks?: Record<string, number>;
    telephone?: string;
    distance_km?: number;
}

const BanqueSangListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const filters = (location.state as any)?.filters || {};

    const [banques, setBanques] = useState<BanqueSang[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadBanques();
    }, []);

    const loadBanques = async (isRefresh = false) => {
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
            if (filters.groupe_sanguin) queryParams.append('groupe_sanguin', filters.groupe_sanguin);
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/banques-sang/search?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                const newBanques = data.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setBanques(newBanques);
                } else {
                    setBanques([...banques, ...newBanques]);
                }
                setHasMore(newBanques.length === 20);
            } else {
                alert('Impossible de charger les banques de sang');
            }
        } catch (error: any) {
            console.error('[BanqueSangListPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les banques de sang');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadBanques();
        }
    };

    const handleBanqueClick = (banque: BanqueSang) => {
        navigate(`/banques-sang/${banque.id}`);
    };

    if (loading && banques.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement des banques de sang...</p>
                </div>
            </div>
        );
    }

    if (banques.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center py-16">
                        <Droplet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucune banque de sang trouvée</h2>
                        <p className="text-gray-600 mb-6">
                            Essayez de modifier vos critères de recherche
                        </p>
                        <Button onClick={() => navigate('/banques-sang/search')}>
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
                        {banques.length} banque{banques.length > 1 ? 's' : ''} de sang trouvée{banques.length > 1 ? 's' : ''}
                    </h1>
                    <Button
                        variant="outline"
                        onClick={() => loadBanques(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {banques.map((banque) => (
                        <Card
                            key={banque.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => handleBanqueClick(banque)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {banque.nom}
                                        </h3>
                                    </div>
                                    <Badge
                                        variant={banque.is_available_now ? 'default' : 'secondary'}
                                        className={banque.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}
                                    >
                                        {banque.is_available_now ? 'Disponible' : 'Indisponible'}
                                    </Badge>
                                </div>

                                <div className="space-y-2">
                                    {(banque.ville || banque.quartier) && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {[banque.ville, banque.quartier].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    {banque.distance_km !== undefined && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {banque.distance_km.toFixed(1)} km
                                        </div>
                                    )}
                                    {banque.telephone && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Phone className="w-4 h-4 mr-2" />
                                            {banque.telephone}
                                        </div>
                                    )}
                                    {banque.stocks && Object.keys(banque.stocks).length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 mb-1">Stocks disponibles:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(banque.stocks).slice(0, 4).map(([groupe, qty]) => (
                                                    <span key={groupe} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                                                        {groupe}: {qty}
                                                    </span>
                                                ))}
                                                {Object.keys(banque.stocks).length > 4 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{Object.keys(banque.stocks).length - 4}
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

export default BanqueSangListPage;

