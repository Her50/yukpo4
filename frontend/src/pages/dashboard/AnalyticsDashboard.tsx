// ✅ Phase 10 - Page Analytics Dashboard pour prestataires
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import {
  BarChart3,
  Calendar,
  DollarSign,
  Package,
  TrendingUp,
  Truck,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface DeliveryStats {
  total_deliveries: number;
  completed_deliveries: number;
  cancelled_deliveries: number;
  pending_deliveries: number;
  success_rate: number;
  avg_delivery_time_minutes: number | null;
  total_revenue: number;
  avg_revenue_per_delivery: number;
}

interface ServiceStats {
  total_services: number;
  active_services: number;
  total_views: number;
  total_interactions: number;
  avg_rating: number | null;
  total_reviews: number;
}

interface RevenueStats {
  total_revenue: number;
  revenue_this_month: number;
  revenue_last_month: number;
  revenue_growth: number;
  avg_revenue_per_delivery: number;
  total_commissions: number;
}

interface TopProduct {
  service_id: number;
  product_index: number | null;
  product_name: string;
  order_count: number;
  total_revenue: number;
}

interface TopDeliveryZone {
  zone_id: string | null;
  zone_name: string | null;
  delivery_count: number;
  avg_distance_km: number | null;
}

interface PerformanceDataPoint {
  date: string;
  deliveries: number;
  revenue: number;
  success_rate: number;
}

interface ProviderAnalytics {
  delivery_stats: DeliveryStats;
  service_stats: ServiceStats;
  revenue_stats: RevenueStats;
  top_products: TopProduct[];
  top_delivery_zones: TopDeliveryZone[];
  performance_over_time: PerformanceDataPoint[];
  period_start: string;
  period_end: string;
}

const AnalyticsDashboard: React.FC = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ProviderAnalytics | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(30);

  useEffect(() => {
    if (user?.id) {
      loadAnalytics();
    }
  }, [user?.id, selectedDays]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/analytics/provider`, {
        params: { days: selectedDays },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setAnalytics(response.data.data);
      } else {
        throw new Error(response.data.error || 'Erreur lors du chargement des analytics');
      }
    } catch (error: any) {
      console.error('[AnalyticsDashboard] Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de charger les analytics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Aucune donnée disponible</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">📊 Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Statistiques du {new Date(analytics.period_start).toLocaleDateString('fr-FR')} au{' '}
            {new Date(analytics.period_end).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedDays(7)}
            className={`px-4 py-2 rounded-lg ${
              selectedDays === 7 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            7 jours
          </button>
          <button
            onClick={() => setSelectedDays(30)}
            className={`px-4 py-2 rounded-lg ${
              selectedDays === 30 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            30 jours
          </button>
          <button
            onClick={() => setSelectedDays(90)}
            className={`px-4 py-2 rounded-lg ${
              selectedDays === 90 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            90 jours
          </button>
        </div>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus totaux</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.revenue_stats.total_revenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.revenue_stats.revenue_growth >= 0 ? (
                <span className="text-green-600">
                  <TrendingUp className="inline h-3 w-3" /> +{analytics.revenue_stats.revenue_growth.toFixed(1)}%
                </span>
              ) : (
                <span className="text-red-600">
                  {analytics.revenue_stats.revenue_growth.toFixed(1)}%
                </span>
              )}{' '}
              vs mois précédent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Livraisons</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.delivery_stats.total_deliveries)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <CheckCircle2 className="inline h-3 w-3 text-green-600" />{' '}
              {analytics.delivery_stats.completed_deliveries} complétées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de succès</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.delivery_stats.success_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.delivery_stats.avg_delivery_time_minutes
                ? `Temps moyen: ${Math.round(analytics.delivery_stats.avg_delivery_time_minutes)} min`
                : 'Temps moyen: N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services actifs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.service_stats.active_services}</div>
            <p className="text-xs text-muted-foreground mt-1">
              sur {analytics.service_stats.total_services} services
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Delivery Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Statistiques de livraison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total livraisons</span>
                <span className="font-semibold">{formatNumber(analytics.delivery_stats.total_deliveries)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Complétées</span>
                <span className="font-semibold text-green-600">
                  {formatNumber(analytics.delivery_stats.completed_deliveries)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Annulées</span>
                <span className="font-semibold text-red-600">
                  {formatNumber(analytics.delivery_stats.cancelled_deliveries)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">En attente</span>
                <span className="font-semibold text-yellow-600">
                  {formatNumber(analytics.delivery_stats.pending_deliveries)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Revenu moyen par livraison</span>
                <span className="font-bold">{formatCurrency(analytics.delivery_stats.avg_revenue_per_delivery)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Statistiques de services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total services</span>
                <span className="font-semibold">{formatNumber(analytics.service_stats.total_services)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Services actifs</span>
                <span className="font-semibold text-green-600">
                  {formatNumber(analytics.service_stats.active_services)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total vues</span>
                <span className="font-semibold">{formatNumber(analytics.service_stats.total_views)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total interactions</span>
                <span className="font-semibold">{formatNumber(analytics.service_stats.total_interactions)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Note moyenne</span>
                <span className="font-semibold">
                  {analytics.service_stats.avg_rating
                    ? `${analytics.service_stats.avg_rating.toFixed(1)} ⭐`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Total avis</span>
                <span className="font-bold">{formatNumber(analytics.service_stats.total_reviews)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      {analytics.top_products.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top produits/services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.top_products.map((product, index) => (
                <div key={`${product.service_id}-${product.product_index}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-blue-600">#{index + 1}</span>
                    <div>
                      <p className="font-medium">{product.product_name}</p>
                      <p className="text-sm text-gray-500">
                        {formatNumber(product.order_count)} commande{product.order_count > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-green-600">{formatCurrency(product.total_revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Delivery Zones */}
      {analytics.top_delivery_zones.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Zones de livraison les plus fréquentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.top_delivery_zones.map((zone, index) => (
                <div key={zone.zone_id || index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-blue-600">#{index + 1}</span>
                    <div>
                      <p className="font-medium">{zone.zone_name || 'Zone inconnue'}</p>
                      <p className="text-sm text-gray-500">
                        {formatNumber(zone.delivery_count)} livraison{zone.delivery_count > 1 ? 's' : ''}
                        {zone.avg_distance_km && ` • ${zone.avg_distance_km.toFixed(1)} km en moyenne`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Over Time */}
      {analytics.performance_over_time.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance dans le temps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.performance_over_time.slice(-7).map((point) => (
                <div key={point.date} className="flex justify-between items-center p-2 border-b">
                  <div>
                    <p className="font-medium">{new Date(point.date).toLocaleDateString('fr-FR')}</p>
                    <p className="text-sm text-gray-500">
                      {formatNumber(point.deliveries)} livraison{point.deliveries > 1 ? 's' : ''} •{' '}
                      {point.success_rate.toFixed(1)}% succès
                    </p>
                  </div>
                  <span className="font-bold">{formatCurrency(point.revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsDashboard;

