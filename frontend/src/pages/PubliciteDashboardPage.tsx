import {
    Activity,
    ArrowLeft,
    Calendar,
    DollarSign,
    Eye,
    Film,
    Globe,
    MapPin,
    Megaphone,
    MousePointer,
    Package,
    PlayCircle,
    Plus,
    Sparkles,
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
    const [loading, setLoading] = useState(true);
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

