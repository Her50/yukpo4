// ✅ Phase 5: Liste des résultats de recherche de covoiturages (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Car, Clock, RefreshCw, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Covoiturage {
    id: number;
    service_id: number;
    user_id: number;
    depart: string;
    destination: string;
    date_depart: string;
    heure_depart?: string;
    nombre_places: number;
    places_disponibles: number;
    prix_par_place: number;
    devise: string;
    statut: string;
    type_vehicule?: string;
    marque_modele?: string;
}

const CovoiturageListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const filters = (location.state as any)?.filters || {};

    const [covoiturages, setCovoiturages] = useState<Covoiturage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadCovoiturages();
    }, []);

    const loadCovoiturages = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const queryParams = new URLSearchParams();
            if (filters.depart) queryParams.append('depart', filters.depart);
            if (filters.destination) queryParams.append('destination', filters.destination);
            if (filters.date_depart) queryParams.append('date_depart', filters.date_depart);
            if (filters.min_places) queryParams.append('min_places', filters.min_places.toString());
            if (filters.max_prix) queryParams.append('max_prix', filters.max_prix.toString());
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/covoiturages/search?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                const newCovoiturages = data.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setCovoiturages(newCovoiturages);
                } else {
                    setCovoiturages([...covoiturages, ...newCovoiturages]);
                }
                setHasMore(newCovoiturages.length === 20);
            } else {
                alert('Impossible de charger les covoiturages');
            }
        } catch (error: any) {
            console.error('[CovoiturageListPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les covoiturages');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadCovoiturages();
        }
    };

    const handleCovoiturageClick = (covoiturage: Covoiturage) => {
        navigate(`/covoiturages/${covoiturage.id}`);
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
            });
        } catch {
            return dateStr;
        }
    };

    const formatPrice = (prix: number, devise: string) => {
        return `${prix.toLocaleString('fr-FR')} ${devise}`;
    };

    if (loading && covoiturages.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement des trajets...</p>
                </div>
            </div>
        );
    }

    if (covoiturages.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center py-16">
                        <Car className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun trajet trouvé</h2>
                        <p className="text-gray-600 mb-6">
                            Essayez de modifier vos critères de recherche
                        </p>
                        <Button onClick={() => navigate('/covoiturages/search')}>
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
                        {covoiturages.length} trajet{covoiturages.length > 1 ? 's' : ''} trouvé{covoiturages.length > 1 ? 's' : ''}
                    </h1>
                    <Button
                        variant="outline"
                        onClick={() => loadCovoiturages(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {covoiturages.map((covoiturage) => (
                        <Card
                            key={covoiturage.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => handleCovoiturageClick(covoiturage)}
                        >
                            <CardContent className="p-6">
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                                        <span className="font-semibold text-gray-900">{covoiturage.depart}</span>
                                    </div>
                                    <div className="w-0.5 h-6 bg-gray-300 ml-1.5"></div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-600"></div>
                                        <span className="font-semibold text-gray-900">{covoiturage.destination}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        {formatDate(covoiturage.date_depart)}
                                    </div>
                                    {covoiturage.heure_depart && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Clock className="w-4 h-4 mr-2" />
                                            {covoiturage.heure_depart.substring(0, 5)}
                                        </div>
                                    )}
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Users className="w-4 h-4 mr-2" />
                                        {covoiturage.places_disponibles}/{covoiturage.nombre_places}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t">
                                    <span className="text-xl font-bold text-blue-600">
                                        {formatPrice(covoiturage.prix_par_place, covoiturage.devise)} / place
                                    </span>
                                    <Badge
                                        variant={covoiturage.statut === 'ouvert' ? 'default' : 'secondary'}
                                        className={covoiturage.statut === 'ouvert' ? 'bg-green-100 text-green-800 border-green-300' : ''}
                                    >
                                        {covoiturage.statut}
                                    </Badge>
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

export default CovoiturageListPage;

