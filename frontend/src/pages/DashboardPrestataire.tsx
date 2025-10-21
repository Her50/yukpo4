import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import {
  Activity,
  BarChart3,
  Clock,
  Eye,
  MessageCircle,
  RefreshCw,
  Star,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ServiceStats {
  id: string;
  title: string;
  views: number;
  interactions: number;
  messages: number;
  calls: number;
  videoCalls: number;
  rating: number;
  revenue: number;
  lastActivity: Date;
  status: 'active' | 'inactive' | 'pending';
  category: string;
  location: string;
}

interface DashboardData {
  totalServices: number;
  activeServices: number;
  totalViews: number;
  totalInteractions: number;
  budgetConsumed: number;
  budgetRemaining: number;
  averageRating: number;
  recentActivity: any[];
  topPerformingServices: ServiceStats[];
  monthlyStats: {
    views: number[];
    interactions: number[];
    budgetConsumed: number[];
  };
}

const DashboardPrestataire: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedService, setSelectedService] = useState<string>('all');
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id, selectedPeriod]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/prestataire?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        // Charger les données réelles depuis l'API des services et du budget
        const [servicesResponse, budgetResponse] = await Promise.all([
          fetch('/api/services/user', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch('/api/users/budget', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
        ]);

        const servicesData = servicesResponse.ok ? await servicesResponse.json() : { services: [] };
        const budgetData = budgetResponse.ok ? await budgetResponse.json() : { consumed: 0, remaining: 0 };

        // Calculer les statistiques réelles
        const services = servicesData.services || [];
        const activeServices = services.filter((s: any) => s.is_active).length;
        const totalViews = services.reduce((sum: number, s: any) => sum + (s.views || 0), 0);
        const totalInteractions = services.reduce((sum: number, s: any) => sum + (s.interactions || 0), 0);
        const averageRating = services.length > 0
          ? services.reduce((sum: number, s: any) => sum + (s.rating || 0), 0) / services.length
          : 0;

        const realData: DashboardData = {
          totalServices: services.length,
          activeServices,
          totalViews,
          totalInteractions,
          budgetConsumed: budgetData.consumed || 0,
          budgetRemaining: budgetData.remaining || 0,
          averageRating: Math.round(averageRating * 10) / 10,
          recentActivity: [],
          topPerformingServices: services
            .sort((a: any, b: any) => (b.interactions || 0) - (a.interactions || 0))
            .slice(0, 5)
            .map((s: any) => ({
              id: s.id,
              title: s.data?.title || 'Service sans titre',
              views: s.views || 0,
              interactions: s.interactions || 0,
              messages: s.messages || 0,
              calls: s.calls || 0,
              videoCalls: s.videoCalls || 0,
              rating: s.rating || 0,
              revenue: 0, // Supprimé
              lastActivity: new Date(s.updated_at || s.created_at),
              status: s.is_active ? 'active' : 'inactive',
              category: s.data?.category || 'Non spécifié',
              location: s.data?.location || 'Non spécifié'
            })),
          monthlyStats: {
            views: [],
            interactions: [],
            budgetConsumed: []
          }
        };
        setDashboardData(realData);
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données du dashboard",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <ResponsiveContainer>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </ResponsiveContainer>
    );
  }

  if (!dashboardData) {
    return (
      <ResponsiveContainer>
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucune donnée disponible
          </h3>
          <p className="text-gray-600">
            Créez votre premier service pour voir les statistiques
          </p>
        </div>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <div className="py-8">
        {/* Header avec contrôles */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📊 Dashboard Prestataire
            </h1>
            <p className="text-gray-600">
              Tableau de bord intelligent avec statistiques en temps réel
            </p>
          </div>

          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <Button
              onClick={() => window.location.href = '/mes-services'}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Gérer mes services
            </Button>

            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">90 derniers jours</option>
            </select>

            <Button
              onClick={loadDashboardData}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Métriques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Services Actifs</p>
                  <p className="text-3xl font-bold">{dashboardData.activeServices}</p>
                  <p className="text-blue-200 text-sm">sur {dashboardData.totalServices} total</p>
                </div>
                <Target className="w-12 h-12 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Vues Total</p>
                  <p className="text-3xl font-bold">{formatNumber(dashboardData.totalViews)}</p>
                  <p className="text-green-200 text-sm">+12% ce mois</p>
                </div>
                <Eye className="w-12 h-12 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Interactions</p>
                  <p className="text-3xl font-bold">{formatNumber(dashboardData.totalInteractions)}</p>
                  <p className="text-purple-200 text-sm">Messages + Appels</p>
                </div>
                <Activity className="w-12 h-12 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Budget Consommé</p>
                  <p className="text-3xl font-bold">{formatCurrency(dashboardData.budgetConsumed)}</p>
                  <p className="text-orange-200 text-sm">Restant: {formatCurrency(dashboardData.budgetRemaining)}</p>
                </div>
                <Zap className="w-12 h-12 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Graphiques et analyses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Graphique des performances */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Évolution des Performances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Graphique des performances</p>
                  <p className="text-sm">Données en temps réel</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Services les Plus Performants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.topPerformingServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucun service pour le moment</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.topPerformingServices.map((service, index) => (
                    <div key={service.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{service.title}</p>
                          <p className="text-sm text-gray-500">{service.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatNumber(service.views)} vues</p>
                        <p className="text-sm text-gray-500">{service.interactions} interactions</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activité récente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Activité Récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucune activité récente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{activity.description}</p>
                      <p className="text-sm text-gray-500">{activity.timestamp}</p>
                    </div>
                    <Badge className={getStatusColor(activity.status)}>
                      {activity.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveContainer>
  );
};

export default DashboardPrestataire;
