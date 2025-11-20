import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { listActiveDeliveries, getCourierNavigation } from '@/services/deliveryApi';
import { useUser } from '@/hooks/useUser';
import { Navigation2, Package, TrendingUp, DollarSign, Clock, MapPin } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import formatCurrency from '@/utils/formatCurrency';

interface DeliveryStats {
    totalDeliveries: number;
    completedDeliveries: number;
    activeDeliveries: number;
    totalEarnings: number;
    currentMonthEarnings: number;
    averageRating: number;
}

const CourierMyDeliveriesPage: React.FC = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [stats, setStats] = useState<DeliveryStats>({
        totalDeliveries: 0,
        completedDeliveries: 0,
        activeDeliveries: 0,
        totalEarnings: 0,
        currentMonthEarnings: 0,
        averageRating: 0,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const deliveriesData = await listActiveDeliveries();
            setDeliveries(Array.isArray(deliveriesData) ? deliveriesData : []);

            // TODO: Charger les statistiques du coursier depuis l'API
            // const statsResponse = await getCourierStats(user?.id);
            // setStats(statsResponse);
        } catch (error: any) {
            console.error('[CourierMyDeliveriesPage] Erreur chargement:', error);
            toast.error('Impossible de charger les données');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenNavigation = async (deliveryId: string) => {
        try {
            const navigation = await getCourierNavigation(deliveryId);
            const origin = `${navigation.origin.latitude},${navigation.origin.longitude}`;
            const destination = `${navigation.destination.latitude},${navigation.destination.longitude}`;
            const googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;
            window.open(googleMapsUrl, '_blank');
        } catch (error: any) {
            console.error('[CourierMyDeliveriesPage] Erreur navigation:', error);
            toast.error('Impossible d\'ouvrir la navigation');
        }
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-700',
        awaiting_courier: 'bg-amber-100 text-amber-700',
        assigned: 'bg-blue-100 text-blue-700',
        en_route_pickup: 'bg-sky-100 text-sky-700',
        shopping_in_progress: 'bg-emerald-100 text-emerald-700',
        en_route_delivery: 'bg-indigo-100 text-indigo-700',
        delivered: 'bg-emerald-200 text-emerald-800',
        cancelled: 'bg-rose-100 text-rose-700',
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="mx-auto max-w-4xl px-4 py-16 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-600">Chargement...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="mx-auto max-w-6xl px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Suivre mes courses</h1>
                    <p className="text-slate-600">Tableau de bord coursier - Gérez vos livraisons et suivez vos performances</p>
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <Package className="h-5 w-5 text-slate-400" />
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{stats.completedDeliveries}</p>
                        <p className="text-sm text-slate-600">Livraisons complétées</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <DollarSign className="h-5 w-5 text-slate-400" />
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold text-slate-900">
                            {formatCurrency(stats.totalEarnings, 'XAF')}
                        </p>
                        <p className="text-sm text-slate-600">Gains totaux</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <Clock className="h-5 w-5 text-slate-400" />
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold text-slate-900">
                            {formatCurrency(stats.currentMonthEarnings, 'XAF')}
                        </p>
                        <p className="text-sm text-slate-600">Ce mois</p>
                    </div>
                </div>

                {/* Livraisons actives */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-slate-900">Livraisons actives</h2>
                        <Button variant="outline" size="sm" onClick={loadData}>
                            Rafraîchir
                        </Button>
                    </div>
                    {deliveries.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
                            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-600">Aucune livraison active</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {deliveries.map((delivery) => (
                                <div
                                    key={delivery.id}
                                    className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold text-slate-900">
                                                    Livraison #{delivery.id.slice(-6)}
                                                </h3>
                                                <Badge className={statusColors[delivery.status] || 'bg-slate-100 text-slate-700'}>
                                                    {delivery.status.replace(/_/g, ' ')}
                                                </Badge>
                                            </div>
                                            <div className="space-y-2 text-sm text-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4" />
                                                    <span>
                                                        <strong>Pickup:</strong> {delivery.pickup?.label || 'Non précisé'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Navigation2 className="h-4 w-4" />
                                                    <span>
                                                        <strong>Dropoff:</strong> {delivery.dropoff?.label || 'Non précisé'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={() => handleOpenNavigation(delivery.id)}
                                            >
                                                <Navigation2 className="h-4 w-4 mr-2" />
                                                Navigation
                                            </Button>
                                            <Link to={`/delivery/${delivery.id}/courier`}>
                                                <Button size="sm" variant="outline">
                                                    Détails
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions rapides */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link to="/courier/stats">
                        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            <TrendingUp className="h-8 w-8 text-primary mb-3" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Statistiques détaillées</h3>
                            <p className="text-sm text-slate-600">Consultez vos performances et votre historique</p>
                        </div>
                    </Link>
                    <Link to="/courier/earnings">
                        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            <DollarSign className="h-8 w-8 text-green-500 mb-3" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Gains et paiements</h3>
                            <p className="text-sm text-slate-600">Suivez vos revenus et demandez un paiement</p>
                        </div>
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
};

export default CourierMyDeliveriesPage;


