// ✨ MON ACTIVITÉ - Dashboard intégré + Liste de services
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// @ts-ignore - Platform existe bien dans react-native
const Platform = require('react-native').Platform;
// @ts-ignore - Share existe bien dans react-native
const Share = require('react-native').Share;

import { NativeButton, NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import ServiceCardModern from '../components/ServiceCardModern';
import ServiceTeamManager from '../components/ServiceTeamManager';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiDelete, apiGet, apiPatch, apiPost, userApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

interface Service {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  views: number;
  interactions: number;
  user_id: string;
  data?: any;
  score?: number;
  [key: string]: any;
}

interface CategoryStats {
  name: string;
  count: number;
  views: number;
  interactions: number;
  icon: string;
  color: string;
  // KPIs spécifiques par catégorie
  kpis: {
    label: string;
    value: string | number;
    unit?: string;
    icon: string;
  }[];
}

const ServicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('dashboard');

  // Dashboard states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [selectedServiceForTeam, setSelectedServiceForTeam] = useState<string | null>(null);

  useEffect(() => {
    loadServicesAndDashboard();
  }, [selectedPeriod]);

  const loadServicesAndDashboard = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
      setLoading(true);
      }

      const token = await AsyncStorage.getItem('auth_token');

      // Charger les services
      const response = await apiGet('/api/prestataire/services');

      if (response.success) {
        const data = response.data;
        const servicesTries = Array.isArray(data) ? data.sort((a: any, b: any) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }) : [];

        const transformedServices = servicesTries.map((service: any) => ({
          id: service.id.toString(),
          title: service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.titre || 'Service sans titre',
          description: service.data?.description?.valeur || service.description || 'Aucune description',
          status: service.is_active !== undefined ? (service.is_active ? 'active' : 'inactive') :
            service.actif !== undefined ? (service.actif ? 'active' : 'inactive') : 'inactive',
          createdAt: service.created_at,
          views: service.views || 0,
          interactions: service.interactions || 0,
          data: service.data,
          ...service
        }));

        setServices(transformedServices);

        // Calculer les stats par catégorie
        calculateCategoryStats(transformedServices);

        // Charger les données du dashboard
        loadDashboardData(transformedServices);
      } else {
        console.error('Erreur API:', response);
        setServices([]);
      }
    } catch (error) {
      console.error('Erreur chargement services:', error);
      Alert.alert('Erreur', 'Impossible de charger vos services');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDashboardData = async (servicesData: Service[]) => {
    try {
      // ✅ UNIQUEMENT DONNÉES RÉELLES : Charger depuis l'API backend
      const response = await userApi.getDashboardPrestataire(selectedPeriod);

      if (response.success && response.data) {
        setDashboardData(response.data);
      } else {
        // ✅ Calculer à partir des VRAIES données des services (pas de données fictives)
        const activeServices = servicesData.filter(s => s.status === 'active').length;
        const totalViews = servicesData.reduce((sum, s) => sum + (s.views || 0), 0);
        const totalInteractions = servicesData.reduce((sum, s) => sum + (s.interactions || 0), 0);

        // ✅ Charger le vrai solde depuis l'API
        const budgetResponse = await userApi.getTokensBalance();
        const budgetData = budgetResponse.success ? (budgetResponse.data as any) : { consumed: 0, remaining: 0 };

        // ✅ Calculer les meilleurs services RÉELS (basés sur vraies interactions)
        const topPerformingServices = servicesData
          .filter(s => s.interactions > 0 || s.views > 0) // Seulement services avec activité réelle
          .sort((a, b) => (b.interactions || 0) - (a.interactions || 0))
          .slice(0, 5)
          .map(s => ({
            id: s.id,
            title: s.title,
            category: extractCategory(s),
            views: s.views || 0,
            interactions: s.interactions || 0,
            rating: s.rating || 0,
            status: s.status
          }));

        setDashboardData({
          totalServices: servicesData.length,
          activeServices,
          totalViews,
          totalInteractions,
          budgetConsumed: budgetData.consumed || 0,
          budgetRemaining: budgetData.remaining || 0,
          averageRating: calculateAverageRating(servicesData),
          topPerformingServices
        });
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      // ✅ En cas d'erreur, ne pas afficher de données fictives
      setDashboardData(null);
    }
  };

  // ✅ Fonction pour extraire la catégorie réelle
  const extractCategory = (service: Service): string => {
    if (service.data?.category?.valeur) {
      return service.data.category.valeur;
    } else if (service.data?.produits && Array.isArray(service.data.produits) && service.data.produits.length > 0) {
      return service.data.produits[0].type || 'Non spécifié';
    }
    return 'Non spécifié';
  };

  // ✅ Fonction pour calculer le vrai taux de satisfaction moyen
  const calculateAverageRating = (services: Service[]): number => {
    const servicesWithRating = services.filter(s => s.rating && s.rating > 0);
    if (servicesWithRating.length === 0) return 0;

    const total = servicesWithRating.reduce((sum, s) => sum + (s.rating || 0), 0);
    return Math.round((total / servicesWithRating.length) * 10) / 10; // Arrondi à 1 décimale
  };

  const calculateCategoryStats = (servicesData: Service[]) => {
    const categoryMap = new Map<string, CategoryStats>();

    // Catégories de produits avec icônes et couleurs
    const categoryIcons: { [key: string]: { icon: string; color: string } } = {
      'immobilier': { icon: 'home', color: '#3B82F6' },
      'automobile': { icon: 'car', color: '#EF4444' },
      'electromenager': { icon: 'zap', color: '#14B8A6' },
      'telephone': { icon: 'smartphone', color: '#FF9800' },
      'ordinateur': { icon: 'monitor', color: '#00BCD4' },
      'mobilier': { icon: 'package', color: '#F97316' },
      'vetement': { icon: 'shirt', color: '#EC4899' },
      'chaussure': { icon: 'shoe', color: '#6366F1' },
      'prestation_service': { icon: 'briefcase', color: '#8B5CF6' },
      'hopital_clinique': { icon: 'heart', color: '#DC2626' },
      'pharmacie': { icon: 'pill', color: '#059669' },
      'demenagement': { icon: 'truck', color: '#F97316' },
      'assurance': { icon: 'shield', color: '#0891B2' },
      'quincaillerie': { icon: 'hammer', color: '#F59E0B' },
      'decoration': { icon: 'palette', color: '#E91E63' },
      'autre': { icon: 'grid', color: '#6B7280' }
    };

    // Stockage temporaire pour calculer les KPIs par catégorie
    const categoryData: { [key: string]: any[] } = {};

    servicesData.forEach(service => {
      // Extraire la catégorie du service ou de ses produits
      let category = 'autre';

      if (service.data?.category?.valeur) {
        category = service.data.category.valeur.toLowerCase();
      } else if (service.data?.produits && Array.isArray(service.data.produits) && service.data.produits.length > 0) {
        const firstProduct = service.data.produits[0];
        if (firstProduct.type) {
          category = firstProduct.type.toLowerCase();
        }
      }

      // Nettoyer le nom de la catégorie
      const cleanCategory = category.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const categoryKey = category.replace(/\s+/g, '_').toLowerCase();

      if (!categoryMap.has(cleanCategory)) {
        const categoryInfo = categoryIcons[categoryKey] || categoryIcons['autre'];

        categoryMap.set(cleanCategory, {
          name: cleanCategory,
          count: 0,
          views: 0,
          interactions: 0,
          icon: categoryInfo.icon,
          color: categoryInfo.color,
          kpis: []
        });

        categoryData[cleanCategory] = [];
      }

      const stat = categoryMap.get(cleanCategory)!;
      stat.count++;
      stat.views += service.views || 0;
      stat.interactions += service.interactions || 0;

      // Stocker les données du service pour calcul des KPIs
      categoryData[cleanCategory].push(service);
    });

    // Calculer les KPIs spécifiques pour chaque catégorie
    categoryMap.forEach((stat, categoryName) => {
      const services = categoryData[categoryName];
      const categoryKey = categoryName.toLowerCase().replace(/\s+/g, '_');

      stat.kpis = calculateCategoryKPIs(categoryKey, services);
    });

    // Convertir en tableau et trier par nombre de services (uniquement catégories avec services)
    const stats = Array.from(categoryMap.values())
      .filter(stat => stat.count > 0)  // ✅ Filtrer les catégories vides
      .sort((a, b) => b.count - a.count);

    setCategoryStats(stats);
  };

  // Fonction pour calculer les KPIs spécifiques par catégorie
  const calculateCategoryKPIs = (categoryKey: string, services: Service[]): CategoryStats['kpis'] => {
    if (services.length === 0) return [];

    const produits = services.flatMap(s => s.data?.produits || []);

    switch (categoryKey) {
      case 'immobilier':
      case 'immobilier_batiment':
      case 'immobilier_terrain':
        const superficies = produits
          .map(p => parseFloat(p.superficie || p.surface || '0'))
          .filter(s => s > 0);
        const prix = produits
          .map(p => parseFloat(p.prix || '0'))
          .filter(p => p > 0);
        const nbChambres = produits
          .map(p => parseInt(p.nbChambres || p.chambres || '0'))
          .filter(n => n > 0);

        return [
          { label: 'Prix moyen', value: prix.length > 0 ? Math.round(prix.reduce((a, b) => a + b, 0) / prix.length) : 0, unit: 'FCFA', icon: 'dollar-sign' },
          { label: 'Superficie moy.', value: superficies.length > 0 ? Math.round(superficies.reduce((a, b) => a + b, 0) / superficies.length) : 0, unit: 'm²', icon: 'maximize' },
          { label: 'Chambres moy.', value: nbChambres.length > 0 ? Math.round(nbChambres.reduce((a, b) => a + b, 0) / nbChambres.length) : 0, icon: 'home' }
        ];

      case 'automobile':
        const kilometrages = produits
          .map(p => parseFloat(p.kilometrage || '0'))
          .filter(k => k > 0);
        const annees = produits
          .map(p => parseInt(p.annee || '0'))
          .filter(a => a > 0);
        const prixAuto = produits
          .map(p => parseFloat(p.prix || '0'))
          .filter(p => p > 0);

        return [
          { label: 'Prix moyen', value: prixAuto.length > 0 ? Math.round(prixAuto.reduce((a, b) => a + b, 0) / prixAuto.length) : 0, unit: 'FCFA', icon: 'dollar-sign' },
          { label: 'Km moyen', value: kilometrages.length > 0 ? Math.round(kilometrages.reduce((a, b) => a + b, 0) / kilometrages.length) : 0, unit: 'km', icon: 'navigation' },
          { label: 'Année moy.', value: annees.length > 0 ? Math.round(annees.reduce((a, b) => a + b, 0) / annees.length) : 0, icon: 'calendar' }
        ];

      case 'prestation_service':
        const prestations = produits.flatMap(p => p.prestations || []);
        const montants = prestations
          .map(p => parseFloat(p.montantMinimum || p.prix || '0'))
          .filter(m => m > 0);
        const tauxSatisfaction = services
          .map(s => s.rating || 0)
          .filter(r => r > 0);

        return [
          { label: 'Tarif moyen', value: montants.length > 0 ? Math.round(montants.reduce((a, b) => a + b, 0) / montants.length) : 0, unit: 'FCFA', icon: 'dollar-sign' },
          { label: 'Offres', value: prestations.length, icon: 'briefcase' },
          { label: 'Satisfaction', value: tauxSatisfaction.length > 0 ? (tauxSatisfaction.reduce((a, b) => a + b, 0) / tauxSatisfaction.length).toFixed(1) : '0', unit: '/5', icon: 'star' }
        ];

      case 'hopital_clinique':
        const prestationsMedicales = produits.flatMap(p => p.prestationsMedicales || []);
        const avecBanqueSang = produits.filter(p => p.banqueSang === true).length;
        const avecRdvEnLigne = produits.filter(p => p.rdvEnLigne === true).length;

        return [
          { label: 'Spécialités', value: new Set(prestationsMedicales).size, icon: 'heart' },
          { label: 'Banque sang', value: avecBanqueSang, unit: `/${produits.length}`, icon: 'droplet' },
          { label: 'RDV en ligne', value: avecRdvEnLigne, unit: `/${produits.length}`, icon: 'calendar' }
        ];

      case 'demenagement':
        const volumes = produits
          .map(p => parseFloat(p.volumeEstime || '0'))
          .filter(v => v > 0);
        const distances = produits
          .map(p => parseFloat(p.distanceKm || '0'))
          .filter(d => d > 0);
        const prixDem = produits
          .map(p => parseFloat(p.prix || '0'))
          .filter(p => p > 0);

        return [
          { label: 'Prix moyen', value: prixDem.length > 0 ? Math.round(prixDem.reduce((a, b) => a + b, 0) / prixDem.length) : 0, unit: 'FCFA', icon: 'dollar-sign' },
          { label: 'Volume moy.', value: volumes.length > 0 ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : 0, unit: 'm³', icon: 'package' },
          { label: 'Distance moy.', value: distances.length > 0 ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length) : 0, unit: 'km', icon: 'navigation' }
        ];

      case 'telephone':
      case 'ordinateur':
        const stockages = produits
          .map(p => parseInt(p.stockage || '0'))
          .filter(s => s > 0);
        const rams = produits
          .map(p => parseInt(p.RAM || p.ram || '0'))
          .filter(r => r > 0);
        const prixTech = produits
          .map(p => parseFloat(p.prix || '0'))
          .filter(p => p > 0);

        return [
          { label: 'Prix moyen', value: prixTech.length > 0 ? Math.round(prixTech.reduce((a, b) => a + b, 0) / prixTech.length) : 0, unit: 'FCFA', icon: 'dollar-sign' },
          { label: 'Stockage moy.', value: stockages.length > 0 ? Math.round(stockages.reduce((a, b) => a + b, 0) / stockages.length) : 0, unit: 'GB', icon: 'hard-drive' },
          { label: 'RAM moy.', value: rams.length > 0 ? Math.round(rams.reduce((a, b) => a + b, 0) / rams.length) : 0, unit: 'GB', icon: 'cpu' }
        ];

      case 'electromenager':
        const typesElectro = new Set(produits.map(p => p.typeElectro).filter(Boolean));
        const avecGarantie = produits.filter(p => p.garantie).length;
        const prixElectro = produits
          .map(p => parseFloat(p.prix || '0'))
          .filter(p => p > 0);

        return [
          { label: 'Prix moyen', value: prixElectro.length > 0 ? Math.round(prixElectro.reduce((a, b) => a + b, 0) / prixElectro.length) : 0, unit: 'FCFA', icon: 'dollar-sign' },
          { label: 'Types', value: typesElectro.size, icon: 'zap' },
          { label: 'Avec garantie', value: avecGarantie, unit: `/${produits.length}`, icon: 'shield' }
        ];

      case 'assurance':
        const couvertures = produits
          .map(p => parseFloat(p.couverture || '0'))
          .filter(c => c > 0);
        const primes = produits
          .map(p => parseFloat(p.prix || p.prime || '0'))
          .filter(p => p > 0);

        return [
          { label: 'Prime moy.', value: primes.length > 0 ? Math.round(primes.reduce((a, b) => a + b, 0) / primes.length) : 0, unit: 'FCFA', icon: 'dollar-sign' },
          { label: 'Couverture moy.', value: couvertures.length > 0 ? Math.round(couvertures.reduce((a, b) => a + b, 0) / couvertures.length) : 0, unit: 'FCFA', icon: 'shield' },
          { label: 'Offres', value: produits.length, icon: 'briefcase' }
        ];

      case 'pharmacie':
        const h24 = produits.filter(p => p.typePharmacie === 'Garde' || p.urgences24h).length;
        const avecConseil = produits.filter(p => p.services?.includes('Conseil')).length;

        return [
          { label: 'Services 24h', value: h24, unit: `/${produits.length}`, icon: 'clock' },
          { label: 'Avec conseil', value: avecConseil, unit: `/${produits.length}`, icon: 'user-check' },
          { label: 'Pharmacies', value: produits.length, icon: 'pill' }
        ];

      default:
        // KPIs génériques pour les autres catégories
        const prixGeneral = produits
          .map(p => parseFloat(p.prix || '0'))
          .filter(p => p > 0);
        const enStock = produits.filter(p => p.stock > 0 || p.disponible).length;

        return [
          { label: 'Prix moyen', value: prixGeneral.length > 0 ? Math.round(prixGeneral.reduce((a, b) => a + b, 0) / prixGeneral.length) : 0, unit: 'FCFA', icon: 'dollar-sign' },
          { label: 'En stock', value: enStock, unit: `/${produits.length}`, icon: 'package' },
          { label: 'Produits', value: produits.length, icon: 'shopping-bag' }
        ];
    }
  };

  const onRefresh = () => {
    loadServicesAndDashboard(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'inactive': return '#9E9E9E';
      case 'pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'inactive': return 'Inactif';
      case 'pending': return 'En attente';
      default: return 'Inconnu';
    }
  };

  const handleEditService = (service: any) => {
    try {
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'edit',
        serviceId: service.id,
        serviceData: service.data,
        suggestion: {
          data: service.data || {},
          intention: service.intention || 'creation_service',
          confidence: service.confidence || 0.8
        },
        type: 'modification_service',
        fromMesServices: true
      });
    } catch (error) {
      console.error('Erreur navigation modification:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la modification du service');
    }
  };

  const handleViewService = (service: any) => {
    try {
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'view',
        serviceId: service.id,
        serviceData: service.data,
        suggestion: {
          data: service.data || {},
          intention: service.intention || 'creation_service',
          confidence: service.confidence || 0.8
        },
        type: 'visualisation_service',
        readonly: true,
        fromMesServices: true
      });
    } catch (error) {
      console.error('Erreur navigation visualisation:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la visualisation du service');
    }
  };

  const handleShareService = async (service: any) => {
    try {
      const titre = service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.title || 'Service Yukpo';
      const description = service.data?.description?.valeur || service.description || 'Découvrez ce service sur Yukpo';
      const serviceUrl = `https://yukpomnang.com/service/${service.id}`;

      let shareText = `🌟 ${titre}\n\n${description}`;
      shareText += `\n\n📱 Voir ce service sur Yukpo :\n🔗 ${serviceUrl}`;

      const result = await Share.share({
        message: shareText,
        title: titre,
        url: serviceUrl
      });

      if (result.action === Share.sharedAction) {
        Alert.alert('Succès', 'Service partagé avec succès !');
      }
    } catch (error) {
      console.error('Erreur lors du partage:', error);
      Alert.alert('Erreur', 'Impossible de partager le service');
    }
  };

  const handleToggleServiceStatus = async (service: any) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const currentStatus = service.status === 'active';
      const newStatus = !currentStatus;

      if (!currentStatus) {
        const balanceResponse = await apiGet('/api/users/balance');

        if (balanceResponse.success) {
          const balanceData = balanceResponse.data as any;
          const currentBalance = balanceData?.tokens_balance || 0;
          const activationCost = 1000;

          if (currentBalance < activationCost) {
            Alert.alert(
              'Solde insuffisant',
              `Solde actuel: ${currentBalance} FCFA\nCoût de réactivation: ${activationCost} FCFA\n\nVeuillez recharger votre compte.`
            );
            return;
          }

          const deductResponse = await apiPost('/api/users/deduct-balance', {
            amount: activationCost,
            reason: 'service_reactivation'
          });

          if (deductResponse.success) {
            const newBalance = currentBalance - activationCost;
            loadServicesAndDashboard(true);
            Alert.alert(
              'Service réactivé !',
              `Coût: ${activationCost} FCFA\nNouveau solde: ${newBalance} FCFA`,
              [{ text: 'OK' }]
            );
          }
        }
      }

      const response = await apiPatch(`/api/services/${service.id}/toggle-status`, {
        actif: newStatus
      });

      if (response.success) {
        setServices(prevServices =>
          prevServices.map(s =>
            s.id === service.id
              ? { ...s, status: newStatus ? 'active' : 'inactive' }
              : s
          )
        );

        loadServicesAndDashboard(true);

        if (currentStatus) {
          Alert.alert('Succès', 'Service désactivé avec succès');
        }
      } else {
        console.error('Erreur API toggle status:', response);
        Alert.alert('Erreur', `Impossible de changer le statut`);
      }
    } catch (error: any) {
      console.error('Erreur toggle status:', error);
      Alert.alert('Erreur', error.message || 'Impossible de changer le statut du service');
    }
  };

  const handleDeleteService = async (service: any) => {
    Alert.alert(
      'Supprimer le service',
      `Êtes-vous sûr de vouloir supprimer définitivement le service "${service.title}" ?\n\nCette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');

              const response = await apiDelete(`/api/services/${service.id}/delete`);

              if (response.success) {
                setServices(prevServices => prevServices.filter(s => s.id !== service.id));
                loadServicesAndDashboard(true);
                Alert.alert('Succès', 'Service supprimé avec succès');
              } else {
                console.error('Erreur API delete:', response);
                Alert.alert('Erreur', `Impossible de supprimer le service`);
              }
            } catch (error: any) {
              console.error('Erreur suppression service:', error);
              Alert.alert('Erreur', error.message || 'Impossible de supprimer le service');
            }
          }
        }
      ]
    );
  };

  const handleManageTeam = (serviceId?: string) => {
    setSelectedServiceForTeam(serviceId || null);
    setShowTeamManager(true);
  };

  const handleCloseTeamManager = () => {
    setShowTeamManager(false);
    setSelectedServiceForTeam(null);
  };

  const filteredServices = services.filter(service => {
    if (filter === 'tous') return true;
    if (filter === 'actif') return service.status === 'active';
    if (filter === 'inactif') return service.status === 'inactive';
    return true;
  });

  if (loading) {
    return (
      <LinearGradient
        colors={modernColors.primaryGradient}
        style={styles.loadingContainer}
      >
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Chargement de votre activité...</Text>
      </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={modernColors.primaryGradient}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIcon}>
              <SafeIcon name="chart-bar" size={28} color="#fff" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{t('activity.title')}</Text>
              <Text style={styles.headerSubtitle}>
                {services.length} service{services.length > 1 ? 's' : ''} • {dashboardData?.activeServices || 0} actif{(dashboardData?.activeServices || 0) > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

          {/* Sélecteur de période */}
          <View style={styles.periodSelector}>
            {['7d', '30d', '90d'].map((period) => (
            <TouchableOpacity
                key={period}
              style={[
                  styles.periodButton,
                  selectedPeriod === period && styles.periodButtonActive
              ]}
                onPress={() => setSelectedPeriod(period as any)}
            >
              <Text style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive
              ]}>
                  {period === '7d' ? '7j' : period === '30d' ? '30j' : '90j'}
              </Text>
            </TouchableOpacity>
          ))}
      </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={modernColors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Dashboard Stats - ✅ UNIQUEMENT DONNÉES RÉELLES */}
        {dashboardData && (
          <View style={styles.dashboardSection}>
            <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
            <View style={styles.statsGrid}>
              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#3B82F620' }]}>
                  <SafeIcon name="eye" size={20} color="#3B82F6" />
        </View>
                <Text style={styles.statValue}>
                  {dashboardData.totalViews ? dashboardData.totalViews.toLocaleString('fr-FR') : '0'}
                </Text>
                <Text style={styles.statLabel}>Vues totales</Text>
              </NativeCard>

              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#10B98120' }]}>
                  <SafeIcon name="message-circle" size={20} color="#10B981" />
        </View>
                <Text style={styles.statValue}>
                  {dashboardData.totalInteractions ? dashboardData.totalInteractions.toLocaleString('fr-FR') : '0'}
                </Text>
                <Text style={styles.statLabel}>Interactions</Text>
              </NativeCard>

              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#F5990620' }]}>
                  <SafeIcon name="dollar-sign" size={20} color="#F59E0B" />
        </View>
                <Text style={styles.statValue}>
                  {dashboardData.budgetRemaining ? dashboardData.budgetRemaining.toLocaleString('fr-FR') : '0'} FCFA
                </Text>
                <Text style={styles.statLabel}>Solde restant</Text>
              </NativeCard>

              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#EF444420' }]}>
                  <SafeIcon name="trending-up" size={20} color="#EF4444" />
                </View>
                <Text style={styles.statValue}>
                  {dashboardData.budgetConsumed ? dashboardData.budgetConsumed.toLocaleString('fr-FR') : '0'} FCFA
        </Text>
                <Text style={styles.statLabel}>Consommé</Text>
              </NativeCard>
            </View>
          </View>
        )}

        {/* Stats par catégorie */}
        {categoryStats.length > 0 && (
          <View style={styles.categorySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Par catégorie</Text>
              <TouchableOpacity onPress={() => Alert.alert('Détails', 'Affichage détaillé bientôt disponible')}>
                <Text style={styles.viewMoreText}>Voir plus</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categoryStats.map((category, index) => (
                <NativeCard key={index} style={[styles.categoryCard, { borderLeftColor: category.color }]}>
                  <View style={[styles.categoryIconContainer, { backgroundColor: category.color + '20' }]}>
                    <SafeIcon name={category.icon} size={24} color={category.color} />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryCount}>{category.count} service{category.count > 1 ? 's' : ''}</Text>

                  {/* KPIs spécifiques */}
                  {category.kpis.length > 0 && (
                    <View style={styles.categoryKpisContainer}>
                      {category.kpis.map((kpi, kpiIndex) => (
                        <View key={kpiIndex} style={styles.categoryKpiItem}>
                          <SafeIcon name={kpi.icon} size={10} color={category.color} />
                          <Text style={styles.categoryKpiText}>
                            {kpi.value}{kpi.unit ? ` ${kpi.unit}` : ''}
            </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Stats générales (vues/interactions) */}
                  <View style={styles.categoryStats}>
                    <View style={styles.categoryStatItem}>
                      <SafeIcon name="eye" size={12} color={modernColors.textSecondary} />
                      <Text style={styles.categoryStatText}>{category.views}</Text>
                    </View>
                    <View style={styles.categoryStatItem}>
                      <SafeIcon name="message-circle" size={12} color={modernColors.textSecondary} />
                      <Text style={styles.categoryStatText}>{category.interactions}</Text>
                    </View>
                  </View>
                </NativeCard>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Top services */}
        {dashboardData?.topPerformingServices && dashboardData.topPerformingServices.length > 0 && (
          <View style={styles.topServicesSection}>
            <Text style={styles.sectionTitle}>Meilleurs services</Text>
            {dashboardData.topPerformingServices.slice(0, 3).map((service: any, index: number) => (
              <TouchableOpacity
                key={service.id}
                style={styles.topServiceCard}
                onPress={() => handleViewService(service)}
              >
                <View style={[styles.topServiceRank, { backgroundColor: modernColors.primary }]}>
                  <Text style={styles.topServiceRankText}>{index + 1}</Text>
                </View>
                <View style={styles.topServiceInfo}>
                  <Text style={styles.topServiceTitle}>{service.title}</Text>
                  <Text style={styles.topServiceCategory}>{service.category}</Text>
                </View>
                <View style={styles.topServiceStats}>
                  <View style={styles.topServiceStatItem}>
                    <SafeIcon name="eye" size={14} color={modernColors.textSecondary} />
                    <Text style={styles.topServiceStatText}>{service.views}</Text>
                  </View>
                  <View style={styles.topServiceStatItem}>
                    <SafeIcon name="message-circle" size={14} color={modernColors.textSecondary} />
                    <Text style={styles.topServiceStatText}>{service.interactions}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Liste des services */}
        <View style={styles.servicesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tous mes services</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.teamButton}
                onPress={() => handleManageTeam()}
              >
                <SafeIcon name="users" size={16} color="#6366F1" />
                <Text style={styles.teamButtonText}>Équipe</Text>
              </TouchableOpacity>
            <TouchableOpacity 
              style={styles.createButton}
                onPress={() => (navigation as any).navigate('FormulaireYukpoIntelligent', { mode: 'create' })}
            >
                <SafeIcon name="plus" size={16} color="#fff" />
                <Text style={styles.createButtonText}>Créer</Text>
            </TouchableOpacity>
          </View>
          </View>

          {/* Filtres */}
          <View style={styles.filterRow}>
            {['tous', 'actif', 'inactif'].map((filterOption) => (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterButton,
                  filter === filterOption && styles.filterButtonActive
                ]}
                onPress={() => setFilter(filterOption as any)}
              >
                <Text style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.filterButtonTextActive
                ]}>
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredServices.length === 0 ? (
            <NativeCard style={styles.emptyCard}>
              <SafeIcon name="briefcase" size={48} color={modernColors.textSecondary} />
              <Text style={styles.emptyTitle}>Aucun service</Text>
              <Text style={styles.emptyText}>
                {filter === 'tous'
                  ? 'Créez votre premier service pour commencer'
                  : `Aucun service ${filter === 'actif' ? 'actif' : 'inactif'} pour le moment`}
              </Text>
              {filter === 'tous' && (
                <NativeButton
                  title="Créer un service"
                  onPress={() => (navigation as any).navigate('FormulaireYukpoIntelligent', { mode: 'create' })}
                  variant="primary"
                  style={styles.emptyButton}
                />
              )}
            </NativeCard>
        ) : (
          filteredServices.map((service) => (
              <ServiceCardModern
              key={service.id}
              service={service}
                onEdit={() => handleEditService(service)}
                onView={() => handleViewService(service)}
                onShare={() => handleShareService(service)}
                onToggleStatus={() => handleToggleServiceStatus(service)}
                onDelete={() => handleDeleteService(service)}
            />
          ))
        )}
      </View>
    </ScrollView>

      {/* Modal de gestion d'équipe */}
      {showTeamManager && (
        <ServiceTeamManager
          serviceId={selectedServiceForTeam || undefined}
          onClose={handleCloseTeamManager}
          onMemberAdded={(member) => {
            // Rafraîchir les données si nécessaire
            console.log('Membre ajouté:', member);
          }}
          onMemberRemoved={(memberId) => {
            // Rafraîchir les données si nécessaire
            console.log('Membre retiré:', memberId);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    gap: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#fff',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  periodButtonTextActive: {
    color: modernColors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  dashboardSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    gap: 4,
  },
  teamButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: (width - 52) / 2,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.text,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryCard: {
    width: 160,
    padding: 16,
    marginRight: 12,
    borderLeftWidth: 3,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: modernColors.textSecondary,
    marginBottom: 12,
  },
  categoryStats: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryStatText: {
    fontSize: 11,
    color: modernColors.textSecondary,
  },
  categoryKpisContainer: {
    marginVertical: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: modernColors.border + '30',
    gap: 6,
  },
  categoryKpiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryKpiText: {
    fontSize: 10,
    fontWeight: '600',
    color: modernColors.text,
  },
  topServicesSection: {
    marginBottom: 24,
  },
  topServiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: modernColors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  topServiceRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topServiceRankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  topServiceInfo: {
    flex: 1,
  },
  topServiceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 2,
  },
  topServiceCategory: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  topServiceStats: {
    flexDirection: 'row',
    gap: 12,
  },
  topServiceStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topServiceStatText: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  servicesSection: {
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: modernColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: modernColors.surface,
  },
  filterButtonActive: {
    backgroundColor: modernColors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.textSecondary,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
  },
  emptyText: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 8,
  },
});

export default ServicesScreen;
