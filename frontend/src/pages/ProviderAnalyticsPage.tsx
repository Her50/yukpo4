/**
 * ProviderAnalyticsPage - Dashboard analytics complet pour prestataire
 * Statistiques, métriques, graphiques et rapports exportables
 */

import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import { DateRange, providerAnalyticsService } from '@/services/providerAnalyticsService';
import {
    AlertTriangle,
    BarChart3,
    Calendar,
    CheckCircle,
    Clock,
    DollarSign,
    Download,
    RefreshCw,
    TrendingUp,
    XCircle,
    Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProviderAnalyticsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 jours
        end: new Date(),
    });

    const [dashboardData, setDashboardData] = useState<any>(null);

    useEffect(() => {
        if (user?.id) {
            loadDashboardData();
        }
    }, [user?.id, dateRange]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const data = await providerAnalyticsService.getDashboardData(user!.id, dateRange);
            setDashboardData(data);
        } catch (error: any) {
            console.error('[ProviderAnalyticsPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors du chargement des analytics',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: 'csv' | 'pdf') => {
        // TODO: Implémenter export CSV/PDF
        toast({
            title: 'Export',
            description: `Export ${format.toUpperCase()} en cours de développement`,
        });
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Chargement des analytics...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (!dashboardData) {
        return (
            <AppLayout>
                <div className="container mx-auto px-4 py-8">
                    <Card>
                        <CardContent className="text-center py-12">
                            <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg">Aucune donnée disponible</p>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    const {
        order_stats,
        preparation_time_stats,
        rejection_stats,
        cancellation_stats,
        penalties_stats,
        product_performance,
        immediate_availability_stats,
    } = dashboardData;

    return (
        <AppLayout>
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Prestataire</h1>
                        <p className="text-gray-600">Statistiques et métriques détaillées</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={loadDashboardData} variant="outline">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Actualiser
                        </Button>
                        <Button onClick={() => handleExport('csv')} variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                        </Button>
                        <Button onClick={() => handleExport('pdf')} variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export PDF
                        </Button>
                    </div>
                </div>

                {/* Sélecteur de période */}
                <Card className="mb-6">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <Calendar className="w-5 h-5 text-gray-500" />
                            <div className="flex gap-2">
                                {[
                                    { label: '7 jours', days: 7 },
                                    { label: '30 jours', days: 30 },
                                    { label: '90 jours', days: 90 },
                                ].map((period) => (
                                    <Button
                                        key={period.days}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setDateRange({
                                                start: new Date(Date.now() - period.days * 24 * 60 * 60 * 1000),
                                                end: new Date(),
                                            });
                                        }}
                                    >
                                        {period.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Statistiques commandes */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Total commandes</p>
                                    <p className="text-2xl font-bold">{order_stats?.total || 0}</p>
                                </div>
                                <BarChart3 className="w-8 h-8 text-blue-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">En attente</p>
                                    <p className="text-2xl font-bold text-yellow-600">
                                        {order_stats?.pending || 0}
                                    </p>
                                </div>
                                <Clock className="w-8 h-8 text-yellow-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Validées</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {order_stats?.validated || 0}
                                    </p>
                                </div>
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Rejetées</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {order_stats?.rejected || 0}
                                    </p>
                                </div>
                                <XCircle className="w-8 h-8 text-red-500" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Métriques délais de préparation */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Délais de préparation
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Temps moyen</p>
                                <p className="text-xl font-bold">
                                    {preparation_time_stats?.average_minutes?.toFixed(1) || '0'} min
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Temps médian</p>
                                <p className="text-xl font-bold">
                                    {preparation_time_stats?.median_minutes?.toFixed(1) || '0'} min
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Temps min</p>
                                <p className="text-xl font-bold">
                                    {preparation_time_stats?.min_minutes || '0'} min
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Temps max</p>
                                <p className="text-xl font-bold">
                                    {preparation_time_stats?.max_minutes || '0'} min
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Analyse annulations */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Analyse des annulations
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm text-gray-600 mb-2">Taux d'annulation global</p>
                                <p className="text-3xl font-bold text-red-600">
                                    {cancellation_stats?.cancellation_rate?.toFixed(1) || '0'}%
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {cancellation_stats?.total_cancellations || 0} annulations sur{' '}
                                    {cancellation_stats?.total_cancellations
                                        ? Math.round(
                                            (cancellation_stats.total_cancellations * 100) /
                                            (cancellation_stats.cancellation_rate || 1)
                                        )
                                        : 0}{' '}
                                    commandes
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600 mb-2">Par type d'annulation</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span>Timeout:</span>
                                        <Badge variant="secondary">
                                            {cancellation_stats?.by_type?.timeout || 0}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Rejet:</span>
                                        <Badge variant="secondary">
                                            {cancellation_stats?.by_type?.rejected || 0}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Annulation prestataire:</span>
                                        <Badge variant="secondary">
                                            {cancellation_stats?.by_type?.provider_cancelled || 0}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Coursier indisponible:</span>
                                        <Badge variant="secondary">
                                            {cancellation_stats?.by_type?.courier_unavailable || 0}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Produits avec taux élevé */}
                        {cancellation_stats?.high_cancellation_products &&
                            cancellation_stats.high_cancellation_products.length > 0 && (
                                <div className="mt-6">
                                    <p className="text-sm font-semibold text-gray-700 mb-3">
                                        Produits avec taux d'annulation élevé (&gt; 20%)
                                    </p>
                                    <div className="space-y-2">
                                        {cancellation_stats.high_cancellation_products.map((product: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                                            >
                                                <span className="text-sm">
                                                    Service {product.service_id} - Produit {product.product_index}
                                                </span>
                                                <Badge variant="destructive">
                                                    {product.cancellation_rate.toFixed(1)}%
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                    </CardContent>
                </Card>

                {/* Pénalités */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            Pénalités
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Nombre total</p>
                                <p className="text-2xl font-bold">{penalties_stats?.total_penalties || 0}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Montant total</p>
                                <p className="text-2xl font-bold">
                                    {penalties_stats?.total_amount_cents
                                        ? (penalties_stats.total_amount_cents / 100).toFixed(2)
                                        : '0'}{' '}
                                    FCFA
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Montant moyen</p>
                                <p className="text-2xl font-bold">
                                    {penalties_stats?.average_amount_cents
                                        ? (penalties_stats.average_amount_cents / 100).toFixed(2)
                                        : '0'}{' '}
                                    FCFA
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Performance par produit */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Performance par produit
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {product_performance && product_performance.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">Service ID</th>
                                            <th className="text-left p-2">Produit</th>
                                            <th className="text-right p-2">Commandes</th>
                                            <th className="text-right p-2">Temps moyen</th>
                                            <th className="text-right p-2">Taux validation</th>
                                            <th className="text-right p-2">Taux annulation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {product_performance.map((product: any, idx: number) => (
                                            <tr key={idx} className="border-b hover:bg-gray-50">
                                                <td className="p-2">{product.service_id}</td>
                                                <td className="p-2">{product.product_index}</td>
                                                <td className="p-2 text-right">{product.total_orders || 0}</td>
                                                <td className="p-2 text-right">
                                                    {product.average_preparation_minutes?.toFixed(1) || '0'} min
                                                </td>
                                                <td className="p-2 text-right">
                                                    <Badge
                                                        variant={
                                                            product.validation_rate >= 80
                                                                ? 'default'
                                                                : product.validation_rate >= 60
                                                                    ? 'secondary'
                                                                    : 'destructive'
                                                        }
                                                    >
                                                        {(product.validation_rate || 0).toFixed(1)}%
                                                    </Badge>
                                                </td>
                                                <td className="p-2 text-right">
                                                    <Badge
                                                        variant={
                                                            product.cancellation_rate < 10
                                                                ? 'default'
                                                                : product.cancellation_rate < 20
                                                                    ? 'secondary'
                                                                    : 'destructive'
                                                        }
                                                    >
                                                        {(product.cancellation_rate || 0).toFixed(1)}%
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-600 text-center py-8">Aucune donnée de performance</p>
                        )}
                    </CardContent>
                </Card>

                {/* Comparaison disponibilité immédiate */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5" />
                            Comparaison disponibilité immédiate vs délai
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 bg-green-50 rounded-lg">
                                <p className="text-sm font-semibold text-green-800 mb-2">
                                    Produits disponibles immédiatement
                                </p>
                                <p className="text-2xl font-bold text-green-600">
                                    {immediate_availability_stats?.immediate_products?.count || 0}
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    {immediate_availability_stats?.immediate_products?.total_orders || 0} commandes
                                </p>
                                <p className="text-sm text-gray-600">
                                    Temps moyen:{' '}
                                    {immediate_availability_stats?.immediate_products?.average_preparation_minutes?.toFixed(
                                        1
                                    ) || '0'}{' '}
                                    min
                                </p>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm font-semibold text-blue-800 mb-2">
                                    Produits avec délai
                                </p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {immediate_availability_stats?.delayed_products?.count || 0}
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    {immediate_availability_stats?.delayed_products?.total_orders || 0} commandes
                                </p>
                                <p className="text-sm text-gray-600">
                                    Temps moyen:{' '}
                                    {immediate_availability_stats?.delayed_products?.average_preparation_minutes?.toFixed(
                                        1
                                    ) || '0'}{' '}
                                    min
                                </p>
                            </div>
                        </div>

                        {immediate_availability_stats?.comparison && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Comparaison</p>
                                <div className="flex items-center gap-4">
                                    <div>
                                        <span className="text-sm text-gray-600">Différence volume:</span>
                                        <span
                                            className={`ml-2 font-bold ${immediate_availability_stats.comparison.order_volume_difference > 0
                                                    ? 'text-green-600'
                                                    : 'text-red-600'
                                                }`}
                                        >
                                            {immediate_availability_stats.comparison.order_volume_difference > 0
                                                ? '+'
                                                : ''}
                                            {immediate_availability_stats.comparison.order_volume_difference.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
};

export default ProviderAnalyticsPage;

