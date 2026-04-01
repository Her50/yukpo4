// ✅ Liste des résultats de recherche de pharmacies (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Phone, Pill, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Pharmacie {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    is_on_duty: boolean;
    telephone?: string;
    telephone_urgence?: string;
    distance_km?: number;
    nom_produit?: string;
    prix?: number;
    can_fulfill_quantity?: boolean;
}

const PharmacieListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const filters = (location.state as any)?.filters || {};

    const [pharmacies, setPharmacies] = useState<Pharmacie[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadPharmacies();
    }, []);

    const loadPharmacies = async (isRefresh = false) => {
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
            if (filters.on_duty_only) queryParams.append('on_duty_only', 'true');
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const hasProductSearch = Boolean(filters.product_search);
            const response = hasProductSearch
                ? await apiGet(`/api/medicines/nearby?q=${encodeURIComponent(filters.product_search)}${filters.lat ? `&lat=${filters.lat}` : ''}${filters.lng ? `&lng=${filters.lng}` : ''}${filters.max_distance_km ? `&radius_km=${filters.max_distance_km}` : ''}${filters.on_duty_only ? '&on_duty_only=true' : ''}&limit=20`)
                : await apiGet(`/api/pharmacies/search?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success) {
                const newPharmacies = hasProductSearch
                    ? (data.items || []).map((item: any) => ({
                        id: item.pharmacy_id || item.id,
                        service_id: item.pharmacy_service_id || item.service_id,
                        user_id: item.user_id || 0,
                        nom: item.pharmacy_nom || 'Pharmacie',
                        ville: item.ville,
                        quartier: item.quartier,
                        is_available_now: true,
                        is_on_duty: !!item.is_on_duty_now,
                        telephone: item.telephone,
                        distance_km: item.distance_km,
                        nom_produit: item.nom_produit,
                        prix: item.prix,
                        can_fulfill_quantity: !!item.can_fulfill_quantity,
                    }))
                    : (data.data?.data || []);
                if (isRefresh || currentPage === 1) {
                    setPharmacies(newPharmacies);
                } else {
                    setPharmacies([...pharmacies, ...newPharmacies]);
                }
                setHasMore(newPharmacies.length === 20);
            } else {
                alert('Impossible de charger les pharmacies');
            }
        } catch (error: any) {
            console.error('[PharmacieListPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les pharmacies');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadPharmacies();
        }
    };

    const handlePharmacieClick = (pharmacie: Pharmacie) => {
        navigate(`/pharmacies/${pharmacie.id}`);
    };

    if (loading && pharmacies.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement des pharmacies...</p>
                </div>
            </div>
        );
    }

    if (pharmacies.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center py-16">
                        <Pill className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucune pharmacie trouvée</h2>
                        <p className="text-gray-600 mb-6">
                            Essayez de modifier vos critères de recherche
                        </p>
                        <Button onClick={() => navigate('/pharmacies/search')}>
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
                        {pharmacies.length} pharmacie{pharmacies.length > 1 ? 's' : ''} trouvée{pharmacies.length > 1 ? 's' : ''}
                    </h1>
                    <Button
                        variant="outline"
                        onClick={() => loadPharmacies(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pharmacies.map((pharmacie) => (
                        <Card
                            key={pharmacie.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => handlePharmacieClick(pharmacie)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                                            {pharmacie.nom}
                                        </h3>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Badge
                                            variant={pharmacie.is_available_now ? 'default' : 'secondary'}
                                            className={pharmacie.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}
                                        >
                                            {pharmacie.is_available_now ? 'Disponible' : 'Indisponible'}
                                        </Badge>
                                        {pharmacie.is_on_duty && (
                                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                                De garde
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {(pharmacie.ville || pharmacie.quartier) && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {[pharmacie.ville, pharmacie.quartier].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    {pharmacie.distance_km !== undefined && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            {pharmacie.distance_km.toFixed(1)} km
                                        </div>
                                    )}
                                    {pharmacie.telephone && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Phone className="w-4 h-4 mr-2" />
                                            {pharmacie.telephone}
                                        </div>
                                    )}
                                    {pharmacie.nom_produit && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Pill className="w-4 h-4 mr-2" />
                                            {pharmacie.nom_produit}
                                            {pharmacie.prix ? ` • ${Number(pharmacie.prix).toLocaleString()} FCFA` : ''}
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

export default PharmacieListPage;

