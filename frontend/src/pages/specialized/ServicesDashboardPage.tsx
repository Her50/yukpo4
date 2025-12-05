// ✅ NOUVEAU Phase 5.4: Dashboard statistiques pour services spécialisés (Web)
// Affiche statistiques détaillées avec graphiques Recharts

import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/services/apiService';
import {
    Activity,
    ArrowLeft,
    BarChart3,
    CheckCircle,
    Layers,
    TrendingUp,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

interface DetailedStatistics {
    total: number;
    active: number;
    inactive: number;
    by_type: Record<string, { total: number; active: number; inactive: number }>;
    evolution: Array<{
        date: string;
        created: number;
        activated: number;
        deactivated: number;
    }>;
    recent_activity: {
        last_7_days: number;
        last_30_days: number;
        this_month: number;
    };
}

const ServicesDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DetailedStatistics | null>(null);

    useEffect(() => {
        loadStatistics();
    }, []);

    const loadStatistics = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/specialized-services/statistics/detailed');
            const data = await response.json();

            if (data.success && data.data) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('[ServicesDashboard] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-7xl mx-auto">
                    <Skeleton className="h-12 w-64 mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-32" />
                        ))}
                    </div>
                    <Skeleton className="h-96 mb-6" />
                    <Skeleton className="h-96" />
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <div className="text-6xl mb-4">📊</div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Aucune statistique disponible
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Créez des services spécialisés pour voir vos statistiques
                        </p>
                        <Button onClick={() => navigate('/specialized/gestion')}>
                            Retour à la gestion
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Préparer données pour graphique par type
    const typeChartData = Object.entries(stats.by_type).map(([type, data]) => {
        const typeLabels: Record<string, string> = {
            pharmacie: 'Pharmacie',
            hopital: 'Hôpital',
            laboratoire: 'Laboratoire',
            banque_sang: 'Banque Sang',
            agence_voyage: 'Agence',
            covoiturage: 'Covoiturage',
            taxi: 'Taxi',
        };
        return {
            type: typeLabels[type] || type,
            total: data.total || 0,
            active: data.active || 0,
            inactive: data.inactive || 0,
        };
    });

    // Préparer données pour graphique évolution (7 derniers jours pour lisibilité)
    const evolutionChartData = stats.evolution.slice(-7).map((point) => ({
        date: new Date(point.date).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
        }),
        créés: point.created,
    }));

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => navigate('/specialized/gestion')}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Retour
                        </Button>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Dashboard Statistiques
                        </h1>
                    </div>
                    <Button onClick={loadStatistics} variant="outline">
                        <Activity className="w-4 h-4 mr-2" />
                        Actualiser
                    </Button>
                </div>

                {/* Statistiques principales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">
                                        Total
                                    </p>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {stats.total}
                                    </p>
                                </div>
                                <div className="p-3 bg-indigo-100 rounded-lg">
                                    <Layers className="w-6 h-6 text-indigo-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">
                                        Actifs
                                    </p>
                                    <p className="text-3xl font-bold text-green-600">
                                        {stats.active}
                                    </p>
                                </div>
                                <div className="p-3 bg-green-100 rounded-lg">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">
                                        Inactifs
                                    </p>
                                    <p className="text-3xl font-bold text-orange-600">
                                        {stats.inactive}
                                    </p>
                                </div>
                                <div className="p-3 bg-orange-100 rounded-lg">
                                    <XCircle className="w-6 h-6 text-orange-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Activité récente */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Activité Récente
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-indigo-600 mb-2">
                                    {stats.recent_activity.last_7_days}
                                </p>
                                <p className="text-sm text-gray-600">7 derniers jours</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-indigo-600 mb-2">
                                    {stats.recent_activity.last_30_days}
                                </p>
                                <p className="text-sm text-gray-600">30 derniers jours</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-indigo-600 mb-2">
                                    {stats.recent_activity.this_month}
                                </p>
                                <p className="text-sm text-gray-600">Ce mois</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Graphiques */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Graphique répartition par type */}
                    {typeChartData.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5" />
                                    Répartition par Type
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={typeChartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="type" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="active" fill="#10B981" name="Actifs" />
                                        <Bar dataKey="inactive" fill="#F59E0B" name="Inactifs" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Graphique évolution */}
                    {evolutionChartData.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    Évolution (7 derniers jours)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={evolutionChartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip />
                                        <Line
                                            type="monotone"
                                            dataKey="créés"
                                            stroke="#6366F1"
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Détails par type */}
                {Object.keys(stats.by_type).length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Détails par Type</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {Object.entries(stats.by_type).map(([type, data]) => {
                                    const typeLabels: Record<string, string> = {
                                        pharmacie: '💊 Pharmacie',
                                        hopital: '🏥 Hôpital',
                                        laboratoire: '🔬 Laboratoire',
                                        banque_sang: '🩸 Banque Sang',
                                        agence_voyage: '🚌 Agence',
                                        covoiturage: '🚗 Covoiturage',
                                        taxi: '🚕 Taxi',
                                    };
                                    return (
                                        <div
                                            key={type}
                                            className="flex items-center justify-between p-4 border rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">
                                                    {typeLabels[type]?.split(' ')[0] || '📋'}
                                                </span>
                                                <div>
                                                    <p className="font-semibold text-gray-900">
                                                        {typeLabels[type]?.split(' ').slice(1).join(' ') || type}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-center">
                                                    <p className="text-lg font-bold text-gray-900">
                                                        {data.total}
                                                    </p>
                                                    <p className="text-xs text-gray-600">Total</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg font-bold text-green-600">
                                                        {data.active}
                                                    </p>
                                                    <p className="text-xs text-gray-600">Actifs</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg font-bold text-orange-600">
                                                        {data.inactive}
                                                    </p>
                                                    <p className="text-xs text-gray-600">Inactifs</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default ServicesDashboardPage;



