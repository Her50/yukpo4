import {
    Activity,
    Calendar,
    DollarSign,
    Edit3,
    Eye,
    Film,
    Globe,
    History,
    MapPin,
    Megaphone,
    MousePointer,
    Package,
    PlayCircle,
    Plus,
    RefreshCw,
    Sparkles,
    TrendingUp
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdvancedAnalyticsChart from '../components/AdvancedAnalyticsChart';
import OptimizationSuggestions from '../components/OptimizationSuggestions';
import PubliciteVersionHistory from '../components/PubliciteVersionHistory';
import { Button } from '../components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useUserSWR } from '../hooks/useUserSWR';
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
    videos_meta?: PubliciteVideoMeta[];
    video_stats?: Record<string, any>;
}

interface GlobalStats {
    total_vues: number;
    total_clics: number;
    taux_conversion_moyen: number;
    budget_total_depense: number;
    publicites_actives: number;
    video_summary: VideoSummary;
}

interface PubliciteVideoMeta {
    format?: string | null;
    source?: string | null;
    duration_ms?: number | null;
    ai_generated?: boolean | null;
}

interface VideoSummary {
    views_by_format: Record<string, number>;
    clicks_by_format: Record<string, number>;
    ai_generated_videos: number;
    manual_videos: number;
}

const defaultVideoSummary: VideoSummary = {
    views_by_format: {},
    clicks_by_format: {},
    ai_generated_videos: 0,
    manual_videos: 0,
};

const PubliciteDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useUserSWR();
    const [loading, setLoading] = useState(true);
    const [selectedPubliciteForHistory, setSelectedPubliciteForHistory] = useState<string | null>(null);
    const [publicites, setPublicites] = useState<PubliciteStats[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalStats>({
        total_vues: 0,
        total_clics: 0,
        taux_conversion_moyen: 0,
        budget_total_depense: 0,
        publicites_actives: 0,
        video_summary: defaultVideoSummary,
    });

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/publicites/dashboard');

            if (response.success && response.data) {
                const statsPayload = response.data.stats || {};
                setGlobalStats({
                    total_vues: statsPayload.total_vues ?? 0,
                    total_clics: statsPayload.total_clics ?? 0,
                    taux_conversion_moyen: statsPayload.taux_conversion_moyen ?? 0,
                    budget_total_depense: statsPayload.budget_total_depense ?? 0,
                    publicites_actives: statsPayload.publicites_actives ?? 0,
                    video_summary: statsPayload.video_summary ?? defaultVideoSummary,
                });

                const pubsPayload: PubliciteStats[] = (response.data.publicites || []).map((pub: any) => ({
                    ...pub,
                    videos_meta: Array.isArray(pub.videos_meta) ? pub.videos_meta : [],
                    video_stats: pub.video_stats || {},
                }));
                setPublicites(pubsPayload);
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

    const renderFormatBadges = (
        data: Record<string, number>,
        label: string,
        options?: { compact?: boolean },
    ) => {
        const entries = Object.entries(data || {})
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .slice(0, 3);

        if (entries.length === 0) {
            return null;
        }

        const compact = options?.compact;
        const badgeClasses = compact
            ? 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold'
            : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold';

        return (
            <div className={`flex flex-wrap gap-2 ${compact ? 'mt-2' : ''}`}>
                {entries.map(([format, value]) => (
                    <div key={`${label}_${format}`} className={badgeClasses}>
                        <PlayCircle className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                        <span>
                            {label} {format.toUpperCase()} · {value}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    const renderVideoDetails = (pub: PubliciteStats) => {
        const metas = Array.isArray(pub.videos_meta) ? pub.videos_meta : [];
        const stats = pub.video_stats || {};
        const views = stats.views || {};
        const clicks = stats.clicks || {};

        if (
            metas.length === 0 &&
            Object.keys(views).length === 0 &&
            Object.keys(clicks).length === 0
        ) {
            return null;
        }

        return (
            <div className="mt-4 pt-4 border-t border-dashed border-gray-200 space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 tracking-wide uppercase">
                    Vidéos
                </h4>

                {metas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {metas.slice(0, 4).map((meta, index) => {
                            const format =
                                typeof meta.format === 'string' && meta.format.trim().length > 0
                                    ? meta.format.trim().toUpperCase()
                                    : meta.ai_generated
                                        ? 'SQUARE'
                                        : 'VIDEO';
                            const source =
                                typeof meta.source === 'string' && meta.source.trim().length > 0
                                    ? meta.source.trim().toUpperCase()
                                    : meta.ai_generated
                                        ? 'IA'
                                        : 'MANUEL';

                            const Icon = meta.ai_generated ? Sparkles : Film;
                            const chipClasses = meta.ai_generated
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

                            return (
                                <div
                                    key={`${pub.id}_meta_${index}`}
                                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${chipClasses}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>
                                        {format} · {source}
                                    </span>
                                </div>
                            );
                        })}
                        {metas.length > 4 && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                                <Plus className="w-4 h-4" />
                                <span>+{metas.length - 4}</span>
                            </div>
                        )}
                    </div>
                )}

                {Object.keys(views).length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Eye className="w-4 h-4" />
                        <span>Vues par format</span>
                    </div>
                )}
                {renderFormatBadges(views, 'Vue', { compact: true })}

                {Object.keys(clicks).length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MousePointer className="w-4 h-4" />
                        <span>Clics par format</span>
                    </div>
                )}
                {renderFormatBadges(clicks, 'Clic', { compact: true })}
            </div>
        );
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
                {/* Header - Design amélioré */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => navigate('/mes-services')}
                                className="rounded-full border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Megaphone className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    Dashboard Publicité
                                </h1>
                                <p className="text-gray-600 font-medium">Analytics et performances de vos campagnes</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => navigate('/creer-publicite')}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] px-6 py-3"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            <span className="font-semibold">Créer une publicité</span>
                        </Button>
                    </div>
                </div>

                {/* Stats globales - Design amélioré */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Eye className="w-7 h-7 text-white" />
                            </div>
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-blue-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 mb-2">
                            {globalStats.total_vues.toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-gray-600">Vues totales</p>
                        <div className="mt-3 h-1 bg-blue-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                                <MousePointer className="w-7 h-7 text-white" />
                            </div>
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-green-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 mb-2">
                            {globalStats.total_clics.toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-gray-600">Clics totaux</p>
                        <div className="mt-3 h-1 bg-green-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ width: '60%' }}></div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-6 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                <TrendingUp className="w-7 h-7 text-white" />
                            </div>
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <Activity className="w-4 h-4 text-purple-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 mb-2">
                            {globalStats.taux_conversion_moyen.toFixed(1)}%
                        </p>
                        <p className="text-sm font-medium text-gray-600">Taux de conversion</p>
                        <div className="mt-3 h-1 bg-purple-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full" style={{ width: `${Math.min(100, globalStats.taux_conversion_moyen * 10)}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-6 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                                <DollarSign className="w-7 h-7 text-white" />
                            </div>
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                <Activity className="w-4 h-4 text-red-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 mb-2">
                            {globalStats.budget_total_depense.toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-gray-600">Budget dépensé</p>
                        <div className="mt-3 h-1 bg-red-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                    </div>
                </div>

                {/* Résumé vidéos */}
                <Card className="bg-white border-indigo-200 mb-8">
                    <CardContent className="py-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Performance vidéo</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <Sparkles className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {globalStats.video_summary.ai_generated_videos}
                                    </p>
                                    <p className="text-sm text-gray-600">Vidéos IA générées</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <Film className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {globalStats.video_summary.manual_videos}
                                    </p>
                                    <p className="text-sm text-gray-600">Vidéos importées</p>
                                </div>
                            </div>
                        </div>

                        {renderFormatBadges(globalStats.video_summary.views_by_format, 'Vues')}
                        {renderFormatBadges(globalStats.video_summary.clicks_by_format, 'Clics')}
                    </CardContent>
                </Card>

                {/* ✅ NOUVEAU: Analytics Avancés */}
                {user?.id && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" />
                                Analytics Avancés
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AdvancedAnalyticsChart userId={parseInt(user.id)} periodDays={30} />
                        </CardContent>
                    </Card>
                )}

                {/* ✅ NOUVEAU: Suggestions d'Optimisation */}
                {user?.id && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                Optimisation Automatique
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <OptimizationSuggestions userId={parseInt(user.id)} />
                        </CardContent>
                    </Card>
                )}

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

                                        {/* Métriques - Design amélioré */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 hover:shadow-md transition-shadow">
                                                <div className="flex flex-col items-center text-center">
                                                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mb-2">
                                                        <Eye className="w-5 h-5 text-white" />
                                                    </div>
                                                    <p className="text-2xl font-bold text-blue-900">{pub.vues.toLocaleString()}</p>
                                                    <p className="text-xs text-blue-700 font-medium">Vues</p>
                                                </div>
                                            </div>
                                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 hover:shadow-md transition-shadow">
                                                <div className="flex flex-col items-center text-center">
                                                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-2">
                                                        <MousePointer className="w-5 h-5 text-white" />
                                                    </div>
                                                    <p className="text-2xl font-bold text-green-900">{pub.clics.toLocaleString()}</p>
                                                    <p className="text-xs text-green-700 font-medium">Clics</p>
                                                </div>
                                            </div>
                                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 hover:shadow-md transition-shadow">
                                                <div className="flex flex-col items-center text-center">
                                                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mb-2">
                                                        <TrendingUp className="w-5 h-5 text-white" />
                                                    </div>
                                                    <p className="text-2xl font-bold text-purple-900">{pub.conversion_rate.toFixed(1)}%</p>
                                                    <p className="text-xs text-purple-700 font-medium">Conversion</p>
                                                </div>
                                            </div>
                                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200 hover:shadow-md transition-shadow">
                                                <div className="flex flex-col items-center text-center">
                                                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mb-2">
                                                        <Package className="w-5 h-5 text-white" />
                                                    </div>
                                                    <p className="text-2xl font-bold text-orange-900">{pub.produits_count}</p>
                                                    <p className="text-xs text-orange-700 font-medium">Produits</p>
                                                </div>
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

                                        {/* ✅ Boutons d'action - Design amélioré */}
                                        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                                            {pub.status === 'expired' && (
                                                <Button
                                                    onClick={() => navigate(`/creer-publicite?relanceId=${pub.id}`)}
                                                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                                                    size="sm"
                                                >
                                                    <RefreshCw className="w-4 h-4 mr-2" />
                                                    <span className="font-medium">Relancer</span>
                                                </Button>
                                            )}
                                            <Button
                                                onClick={() => navigate(`/creer-publicite?publiciteId=${pub.id}`)}
                                                variant="outline"
                                                className="flex-1 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 h-10"
                                                size="sm"
                                            >
                                                <Edit3 className="w-4 h-4 mr-2" />
                                                <span className="font-medium">Modifier</span>
                                            </Button>
                                            <Button
                                                onClick={() => setSelectedPubliciteForHistory(selectedPubliciteForHistory === pub.id ? null : pub.id)}
                                                variant={selectedPubliciteForHistory === pub.id ? "default" : "outline"}
                                                className={`flex-1 transition-all duration-200 h-10 ${selectedPubliciteForHistory === pub.id
                                                    ? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'
                                                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                                    }`}
                                                size="sm"
                                            >
                                                <History className="w-4 h-4 mr-2" />
                                                <span className="font-medium">
                                                    {selectedPubliciteForHistory === pub.id ? 'Masquer' : 'Historique'}
                                                </span>
                                            </Button>
                                        </div>

                                        {/* ✅ Historique des versions */}
                                        {selectedPubliciteForHistory === pub.id && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <PubliciteVersionHistory
                                                    campaignId={parseInt(pub.id)}
                                                    onVersionSelect={(versionNumber) => {
                                                        console.log('Version sélectionnée:', versionNumber);
                                                        loadDashboard();
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {renderVideoDetails(pub)}
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

