// ✅ Phase 6: Mes trajets de covoiturage (conducteur) - Frontend
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Car, Clock, Plus, RefreshCw, UserCheck, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface Trip {
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
    reservations_count: number;
    created_at: string;
}

const MyTripsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        if (user) {
            loadTrips(true);
        } else {
            alert('Veuillez vous connecter pour voir vos trajets');
            navigate('/login');
        }
    }, [user]);

    const loadTrips = async (isRefresh = false) => {
        if (!user) return;

        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const queryParams = new URLSearchParams();
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');
            if (statusFilter !== 'all') {
                queryParams.append('status', statusFilter);
            }

            const response = await apiGet(`/api/covoiturages/my-trips?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                const newTrips = data.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setTrips(newTrips);
                } else {
                    setTrips([...trips, ...newTrips]);
                }
                setHasMore(newTrips.length === 20);
            } else {
                alert('Impossible de charger vos trajets');
            }
        } catch (error: any) {
            console.error('[MyTripsPage] Erreur:', error);
            alert(error.message || 'Impossible de charger vos trajets');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadTrips();
        }
    };

    const handleTripClick = (trip: Trip) => {
        navigate(`/covoiturages/${trip.id}`);
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const formatPrice = (prix: number, devise: string) => {
        return `${prix.toLocaleString('fr-FR')} ${devise}`;
    };

    const getStatusColor = (statut: string) => {
        switch (statut) {
            case 'ouvert':
                return 'bg-green-100 text-green-800 border-green-300';
            case 'complet':
                return 'bg-red-100 text-red-800 border-red-300';
            case 'annule':
                return 'bg-gray-100 text-gray-800 border-gray-300';
            default:
                return '';
        }
    };

    const statusFilters = [
        { key: 'all', label: 'Tous' },
        { key: 'ouvert', label: 'Ouverts' },
        { key: 'complet', label: 'Complets' },
        { key: 'annule', label: 'Annulés' },
    ];

    if (loading && trips.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement de vos trajets...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Mes trajets</h1>
                    <Button
                        variant="outline"
                        onClick={() => loadTrips(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                </div>

                {/* Filtres de statut */}
                <div className="mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {statusFilters.map((filter) => (
                            <button
                                key={filter.key}
                                onClick={() => {
                                    setStatusFilter(filter.key);
                                    setPage(1);
                                    loadTrips(true);
                                }}
                                className={`px-4 py-2 rounded-lg border whitespace-nowrap transition ${statusFilter === filter.key
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {trips.length === 0 ? (
                    <div className="text-center py-16">
                        <Car className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun trajet trouvé</h2>
                        <p className="text-gray-600 mb-6">
                            {statusFilter === 'all'
                                ? 'Créez votre premier trajet de covoiturage'
                                : `Aucun trajet avec le statut "${statusFilters.find(f => f.key === statusFilter)?.label}"`}
                        </p>
                        <Button
                            onClick={() => navigate('/specialized/covoiturage', { state: { mode: 'create' } })}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Créer un trajet
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {trips.map((trip) => (
                                <Card
                                    key={trip.id}
                                    className="cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => handleTripClick(trip)}
                                >
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                                                    <span className="font-semibold text-gray-900">{trip.depart}</span>
                                                </div>
                                                <div className="w-0.5 h-6 bg-gray-300 ml-1.5"></div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-red-600"></div>
                                                    <span className="font-semibold text-gray-900">{trip.destination}</span>
                                                </div>
                                            </div>
                                            <Badge
                                                variant="default"
                                                className={getStatusColor(trip.statut)}
                                            >
                                                {trip.statut}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="flex items-center text-sm text-gray-600">
                                                <Calendar className="w-4 h-4 mr-2" />
                                                {formatDate(trip.date_depart)}
                                            </div>
                                            {trip.heure_depart && (
                                                <div className="flex items-center text-sm text-gray-600">
                                                    <Clock className="w-4 h-4 mr-2" />
                                                    {trip.heure_depart.substring(0, 5)}
                                                </div>
                                            )}
                                            <div className="flex items-center text-sm text-gray-600">
                                                <Users className="w-4 h-4 mr-2" />
                                                {trip.places_disponibles}/{trip.nombre_places}
                                            </div>
                                            {trip.reservations_count > 0 && (
                                                <div className="flex items-center text-sm text-blue-600 font-semibold">
                                                    <UserCheck className="w-4 h-4 mr-2" />
                                                    {trip.reservations_count} réservation{trip.reservations_count > 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t">
                                            <span className="text-xl font-bold text-blue-600">
                                                {formatPrice(trip.prix_par_place, trip.devise)} / place
                                            </span>
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
                    </>
                )}
            </div>
        </div>
    );
};

export default MyTripsPage;

