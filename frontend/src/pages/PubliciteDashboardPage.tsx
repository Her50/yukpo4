import {
    Activity,
    ArrowLeft,
    Calendar,
    DollarSign,
    Eye,
    Globe,
    MapPin,
    Megaphone,
    MousePointer,
    Package,
    Plus,
    TrendingUp
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { apiGet } from '../services/apiService';

interface PubliciteStats {
    id: string;
    titre: string;
    status: 'active' | 'expired' | 'pending';
    vues: number;
    clics: number;
    conversion_rate: number;
    budget_depense: number;
    jours_restants: number;
    zone_geographique: string;
    produits_count: number;
    date_debut: string;
    date_fin: string;
}

interface GlobalStats {
    total_vues: number;
    total_clics: number;
    taux_conversion_moyen: number;
    budget_total_depense: number;
    publicites_actives: number;
}

const PubliciteDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [publicites, setPublicites] = useState<PubliciteStats[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalStats>({
        total_vues: 0,
        total_clics: 0,
        taux_conversion_moyen: 0,
        budget_total_depense: 0,
        publicites_actives: 0
    });

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/publicites/dashboard');

            if (response.success && response.data) {
                setPublicites(response.data.publicites || []);
                setGlobalStats(response.data.stats || globalStats);
            }

            setLoading(false);
        } catch (error) {
            console.error('[PubliciteDashboard] Erreur chargement:', error);
            setLoading(false);
        }
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'expired':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: string): string => {
        switch (status) {
            case 'active':
                return 'Active';
            case 'expired':
                return 'Expirée';
            case 'pending':
                return 'En attente';
            default:
                return status;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement du dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate('/mes-services')}
                            className="rounded-full"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Dashboard Publicité</h1>
                            <p className="text-gray-600">Analytics et performances</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => navigate('/creer-publicite')}
                        className="gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Créer une publicité
                    </Button>
                </div>

                {/* Stats globales */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-white border-blue-200">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Eye className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900 mb-1">
                                {globalStats.total_vues.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">Vues totales</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-green-200">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                    <MousePointer className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900 mb-1">
                                {globalStats.total_clics.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">Clics</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-yellow-200">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6 text-yellow-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900 mb-1">
                                {globalStats.taux_conversion_moyen.toFixed(1)}%
                            </p>
                            <p className="text-sm text-gray-600">Taux de conversion</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-red-200">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-red-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900 mb-1">
                                {globalStats.budget_total_depense.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">Budget dépensé</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Liste des publicités */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl">
                                Mes publicités ({publicites.length})
                            </CardTitle>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                <Activity className="w-4 h-4" />
                                {globalStats.publicites_actives} actives
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {publicites.length === 0 ? (
                            <div className="text-center py-16">
                                <Megaphone className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    Aucune publicité
                                </h3>
                                <p className="text-gray-600 mb-6">
                                    Créez votre première publicité pour booster vos produits
                                </p>
                                <Button onClick={() => navigate('/creer-publicite')}>
                                    <Plus className="w-5 h-5 mr-2" />
                                    Créer une publicité
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {publicites.map((pub) => (
                                    <div
                                        key={pub.id}
                                        className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                    {pub.titre}
                                                </h3>
                                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(pub.status)}`}>
                                                    <div className={`w-2 h-2 rounded-full ${pub.status === 'active' ? 'bg-green-500' :
                                                        pub.status === 'expired' ? 'bg-red-500' : 'bg-yellow-500'
                                                        }`}></div>
                                                    <span className="text-xs font-semibold">
                                                        {getStatusLabel(pub.status)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Métriques */}
                                        <div className="grid grid-cols-4 gap-4 mb-4">
                                            <div className="text-center">
                                                <Eye className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                                <p className="text-2xl font-bold text-gray-900">{pub.vues}</p>
                                                <p className="text-xs text-gray-500">vues</p>
                                            </div>
                                            <div className="text-center">
                                                <MousePointer className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                                <p className="text-2xl font-bold text-gray-900">{pub.clics}</p>
                                                <p className="text-xs text-gray-500">clics</p>
                                            </div>
                                            <div className="text-center">
                                                <TrendingUp className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                                <p className="text-2xl font-bold text-gray-900">{pub.conversion_rate.toFixed(1)}%</p>
                                                <p className="text-xs text-gray-500">taux</p>
                                            </div>
                                            <div className="text-center">
                                                <Package className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                                <p className="text-2xl font-bold text-gray-900">{pub.produits_count}</p>
                                                <p className="text-xs text-gray-500">produits</p>
                                            </div>
                                        </div>

                                        {/* Infos */}
                                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                            <div className="flex items-center gap-4 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>
                                                        {pub.jours_restants > 0
                                                            ? `${pub.jours_restants} jours restants`
                                                            : 'Expiré'
                                                        }
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {pub.zone_geographique === 'local' ? (
                                                        <MapPin className="w-4 h-4" />
                                                    ) : (
                                                        <Globe className="w-4 h-4" />
                                                    )}
                                                    <span>
                                                        {pub.zone_geographique === 'local' ? 'Local' :
                                                            pub.zone_geographique === 'regional' ? 'Régional' : 'International'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Barre de progression */}
                                        {pub.status === 'active' && (
                                            <div className="mt-4">
                                                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-blue-600 h-full transition-all duration-300"
                                                        style={{ width: `${Math.min(100, (pub.jours_restants / 30) * 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ✅ Boutons d'action */}
                                        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                                            {pub.status === 'expired' && (
                                                <Button
                                                    onClick={() => navigate(`/creer-publicite?relanceId=${pub.id}`)}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                                    size="sm"
                                                >
                                                    <span className="mr-2">🔄</span>
                                                    Relancer
                                                </Button>
                                            )}
                                            <Button
                                                onClick={() => navigate(`/creer-publicite?publiciteId=${pub.id}`)}
                                                variant="outline"
                                                className="flex-1"
                                                size="sm"
                                            >
                                                <span className="mr-2">✏️</span>
                                                Modifier
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PubliciteDashboardPage;

