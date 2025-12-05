// ✅ Phase 4: Liste des résultats de recherche de laboratoires (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Microscope, Phone, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Laboratoire {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    type_laboratoire: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    analyses_disponibles?: string[];
    imagerie_disponible?: string[];
    rdv_requis: boolean;
    resultats_en_ligne: boolean;
    telephone?: string;
    distance_km?: number;
}

const LaboratoireListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const filters = (location.state as any)?.filters || {};

    const [laboratoires, setLaboratoires] = useState<Laboratoire[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadLaboratoires();
    }, []);

    const loadLaboratoires = async (isRefresh = false) => {
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
            if (filters.type_laboratoire) queryParams.append('type_laboratoire', filters.type_laboratoire);
            if (filters.analyse) queryParams.append('analyse', filters.analyse);
            if (filters.imagerie) queryParams.append('imagerie', filters.imagerie);
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/laboratoires/search?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                const newLaboratoires = data.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setLaboratoires(newLaboratoires);
                } else {
                    setLaboratoires([...laboratoires, ...newLaboratoires]);
                }
                setHasMore(newLaboratoires.length === 20);
            } else {
                alert('Impossible de charger les laboratoires');
            }
        } catch (error: any) {
            console.error('[LaboratoireListPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les laboratoires');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadLaboratoires();
        }
    };

    const handleLaboratoireClick = (laboratoire: Laboratoire) => {
        navigate(`/laboratoires/${laboratoire.id}`);
    };

    if (loading && laboratoires.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement des laboratoires...</p>
                </div>
            </div>
        );
    }

    if (laboratoires.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center py-16">
                        <Microscope className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun laboratoire trouvé</h2>
                        <p className="text-gray-600 mb-6">
                            Essayez de modifier vos critères de recherche
                        </p>
                        <Button onClick={() => navigate('/laboratoires/search')}>
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
                        {laboratoires.length} laboratoire{laboratoires.length > 1 ? 's' : ''} trouvé{laboratoires.length > 1 ? 's' : ''}
                    </h1>
                    <Button
                        variant="outline"
                        onClick={() => loadLaboratoires(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {laboratoires.map((laboratoire) => (
                        <Card
                            key={laboratoire.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => handleLaboratoireClick(laboratoire)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {laboratoire.nom}
                                        </h3>
                                        <p className="text-sm text-gray-600">{laboratoire.type_laboratoire}</p>
                                    </div>
                                    <Badge
                                        variant={laboratoire.is_available_now ? 'default' : 'secondary'}
                                        className={laboratoire.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}
                                    >
                                        {laboratoire.is_available_now ? 'Disponible' : 'Indisponible'}
                                    </Badge>
                                </div>

                                <div className="space-y-2">
                                    {(laboratoire.ville || laboratoire.quartier) && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {[laboratoire.ville, laboratoire.quartier].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    {laboratoire.distance_km !== undefined && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {laboratoire.distance_km.toFixed(1)} km
                                        </div>
                                    )}
                                    {laboratoire.telephone && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Phone className="w-4 h-4 mr-2" />
                                            {laboratoire.telephone}
                                        </div>
                                    )}
                                    {laboratoire.analyses_disponibles && laboratoire.analyses_disponibles.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 mb-1">Analyses:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {laboratoire.analyses_disponibles.slice(0, 3).map((anal, idx) => (
                                                    <span key={idx} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                                        {anal}
                                                    </span>
                                                ))}
                                                {laboratoire.analyses_disponibles.length > 3 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{laboratoire.analyses_disponibles.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {laboratoire.imagerie_disponible && laboratoire.imagerie_disponible.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 mb-1">Imagerie:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {laboratoire.imagerie_disponible.slice(0, 2).map((img, idx) => (
                                                    <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                                        {img}
                                                    </span>
                                                ))}
                                                {laboratoire.imagerie_disponible.length > 2 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{laboratoire.imagerie_disponible.length - 2}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {laboratoire.resultats_en_ligne && (
                                        <Badge className="bg-green-50 text-green-700 text-xs">
                                            Résultats en ligne
                                        </Badge>
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

export default LaboratoireListPage;

