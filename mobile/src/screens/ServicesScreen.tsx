// @ts-nocheck
// 🛍️ MON ACTIVITÉ - Dashboard intégré + Liste de services
// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import SafeIcon from '../components/SafeIcon';
import { NativeButton, NativeCard } from '../components/SafeNativeDesign';
import ServiceCardModern from '../components/ServiceCardModern';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiDelete, apiPatch, userApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { getFieldValue } from '../utils/productNormalizer';

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
  avgScore: number;
}

interface DashboardStats {
  totalServices: number;
  totalViews: number;
  totalInteractions: number;
  activeServices: number;
  pendingServices: number;
  avgScore: number;
  categoryStats: CategoryStats[];
}

const ServicesScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { t } = useLanguageSafe();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalServices: 0,
    totalViews: 0,
    totalInteractions: 0,
    activeServices: 0,
    pendingServices: 0,
    avgScore: 0,
    categoryStats: []
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'interactions' | 'score'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showStats, setShowStats] = useState(false); // ✅ NOUVEAU: Masquer/afficher les stats

  useEffect(() => {
    loadServices();
  }, [user?.id]);

  const loadServices = async () => {
    try {
      setLoading(true);

      console.log('[ServicesScreen] 🔄 Chargement des services...');

      // Charger les services de l'utilisateur
      const response = await userApi.getUserServices();

      console.log('[ServicesScreen] 📡 Réponse API:', {
        success: response.success,
        hasData: !!response.data,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        count: Array.isArray(response.data) ? response.data.length : 'N/A',
        error: response.error
      });

      if (response.success && response.data) {
        // ✅ TRANSFORMATION: Convertir le format backend vers le format frontend
        const rawServices = Array.isArray(response.data) ? response.data : [];
        console.log('[ServicesScreen] 📥 Services bruts reçus:', rawServices.length);

        const servicesData: Service[] = rawServices.map((rawService: any) => {
          // Extraire les données du champ 'data'
          const serviceData = rawService.data || {};

          // ✅ CORRECTION: Utiliser getFieldValue pour extraire les valeurs
          const extractValue = (field: any): string => {
            const value = getFieldValue(field);
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number') return String(value);
            if (typeof value === 'object') return ''; // Objet complexe non convertible
            return String(value);
          };

          return {
            id: String(rawService.id),
            title: extractValue(serviceData.titre_service) || extractValue(serviceData.titre) || extractValue(serviceData.title) || 'Service sans titre',
            description: extractValue(serviceData.description) || 'Aucune description',
            status: rawService.actif ? 'active' : 'inactive',
            createdAt: rawService.created_at,
            views: 0, // TODO: récupérer depuis les stats
            interactions: 0, // TODO: récupérer depuis les stats
            user_id: String(user?.id || ''),
            data: serviceData,
            score: 0
          };
        });

        console.log('[ServicesScreen] ✅ Services transformés:', servicesData.length, 'services');
        console.log('[ServicesScreen] 📦 Premier service transformé:', servicesData[0]);
        setServices(servicesData);
        calculateStats(servicesData);
      } else {
        console.error('[ServicesScreen] ❌ Erreur chargement services:', response.error);
        setServices([]);
      }
    } catch (error) {
      console.error('[ServicesScreen] ❌ Exception lors du chargement:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (servicesData: Service[]) => {
    const totalServices = servicesData.length;
    const totalViews = servicesData.reduce((sum, service) => sum + (service.views || 0), 0);
    const totalInteractions = servicesData.reduce((sum, service) => sum + (service.interactions || 0), 0);
    const activeServices = servicesData.filter(s => s.status === 'active').length;
    const pendingServices = servicesData.filter(s => s.status === 'pending').length;
    const avgScore = servicesData.length > 0
      ? servicesData.reduce((sum, service) => sum + (service.score || 0), 0) / servicesData.length
      : 0;

    // Calculer les statistiques par catégorie
    const categoryMap = new Map<string, CategoryStats>();

    servicesData.forEach(service => {
      // ✅ CORRECTION: Extraire la valeur de category qui peut être {valeur, type_donnee, origine_champs}
      const categoryField = service.data?.category;
      const category = getFieldValue(categoryField) || 'Autre';

      const existing = categoryMap.get(category) || {
        name: category,
        count: 0,
        views: 0,
        interactions: 0,
        avgScore: 0
      };

      existing.count += 1;
      existing.views += service.views || 0;
      existing.interactions += service.interactions || 0;
      existing.avgScore = (existing.avgScore + (service.score || 0)) / 2;

      categoryMap.set(category, existing);
    });

    setStats({
      totalServices,
      totalViews,
      totalInteractions,
      activeServices,
      pendingServices,
      avgScore: Math.round(avgScore * 10) / 10,
      categoryStats: Array.from(categoryMap.values())
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadServices();
    setRefreshing(false);
  };

  const handleCreateService = () => {
    navigation.navigate('FormulaireYukpoIntelligent' as never);
  };

  const handleEditService = (service: Service) => {
    try {
      // ✅ CORRECTION: Validation et passage complet des données
      if (!service || !service.id) {
        console.error('[ServicesScreen] Service invalide pour édition:', service);
        Alert.alert('Erreur', 'Impossible d\'éditer ce service (données manquantes)');
        return;
      }

      console.log('[ServicesScreen] ✏️ Ouverture édition service:', {
        id: service.id,
        title: service.title,
        hasData: !!service.data,
        dataKeys: service.data ? Object.keys(service.data) : []
      });

      // ✅ IMPORTANT: Passer toutes les données du service pour le mode édition
      navigation.navigate('FormulaireYukpoIntelligent' as never, {
        mode: 'edit',
        serviceId: service.id,
        serviceData: service.data || {},
        suggestion: {
          data: service.data || {},
          intention: 'modification_service',
          confidence: 1.0
        },
        type: 'modification_service',
        editMode: true,
        fromServicesScreen: true
      } as never);
    } catch (error) {
      console.error('[ServicesScreen] ❌ Erreur navigation édition:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'édition du service');
    }
  };

  const handleDeleteService = async (service: Service) => {
    Alert.alert(
      'Supprimer le service',
      `Êtes-vous sûr de vouloir supprimer "${service.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiDelete(`/api/services/${service.id}`);
              if (response.success) {
                setServices(prev => prev.filter(s => s.id !== service.id));
                Alert.alert('Succès', 'Service supprimé avec succès');
              } else {
                Alert.alert('Erreur', 'Impossible de supprimer le service');
              }
            } catch (error) {
              console.error('Erreur suppression service:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le service');
            }
          }
        }
      ]
    );
  };

  const handleShareService = async (service: Service) => {
    try {
      const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_URL || 'https://yukpo-backend-376093909298.europe-west1.run.app';
      const shareUrl = `${SHARE_BASE_URL}/service/${service.id}`;
      const titre = service.title || service.titre || 'Service <Text style={styles.brandYuk}>Yuk</Text><Text style={styles.brandPo}>po</Text>';
      const description = service.description || '';
      const prix = service.prix || service.price;

      let shareText = ` ${titre}`;
      if (description) shareText += `\n\n${description}`;
      if (prix) shareText += `\n Prix: ${prix} ${service.devise || 'XAF'}`;
      shareText += `\n\n Voir sur <Text style={styles.brandYuk}>Yuk</Text><Text style={styles.brandPo}>po</Text>:\n${shareUrl}`;

      await Share.share({
        message: shareText,
        url: shareUrl,
        title: titre
      });
    } catch (error) {
      console.error('Erreur partage:', error);
    }
  };

  const handleToggleStatus = async (service: Service) => {
    try {
      const newStatus = service.status === 'active' ? 'inactive' : 'active';
      const response = await apiPatch(`/api/services/${service.id}`, { status: newStatus });

      if (response.success) {
        setServices(prev => prev.map(s =>
          s.id === service.id ? { ...s, status: newStatus } : s
        ));
        Alert.alert('Succès', `Service ${newStatus === 'active' ? 'activé' : 'désactivé'} avec succès`);
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le statut du service');
      }
    } catch (error) {
      console.error('Erreur modification statut:', error);
      Alert.alert('Erreur', 'Impossible de modifier le statut du service');
    }
  };

  const handleViewProducts = (service: Service) => {
    try {
      // ✅ Navigation vers les produits du service
      navigation.navigate('MesProduits' as never, { serviceId: service.id } as never);
    } catch (error) {
      console.error('Erreur navigation produits:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder aux produits');
    }
  };

  const handleViewService = (service: Service) => {
    try {
      // ✅ CORRECTION: Validation des données avant navigation
      if (!service || !service.id) {
        console.error('[ServicesScreen] Service invalide:', service);
        Alert.alert('Erreur', 'Impossible d\'afficher ce service (données manquantes)');
        return;
      }

      console.log('[ServicesScreen] 👁️ Ouverture visualisation service:', {
        id: service.id,
        title: service.title,
        hasData: !!service.data
      });

      // Navigation vers la visualisation du service
      navigation.navigate('FormulaireYukpoIntelligent' as never, {
        mode: 'view',
        serviceId: service.id,
        serviceData: service.data || {},
        suggestion: {
          data: service.data || {},
          intention: 'visualisation_service',
          confidence: 1.0
        },
        readonly: true,
        fromServicesScreen: true
      } as never);
    } catch (error) {
      console.error('[ServicesScreen] ❌ Erreur navigation visualisation:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la visualisation du service');
    }
  };

  const filteredServices = services.filter(service => {
    if (selectedCategory === 'all') return true;
    // ✅ CORRECTION: Extraire la valeur de category avant comparaison
    const categoryField = service.data?.category;
    const category = getFieldValue(categoryField);
    return category === selectedCategory;
  });

  const sortedServices = [...filteredServices].sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortBy) {
      case 'date':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'views':
        aValue = a.views || 0;
        bValue = b.views || 0;
        break;
      case 'interactions':
        aValue = a.interactions || 0;
        bValue = b.interactions || 0;
        break;
      case 'score':
        aValue = a.score || 0;
        bValue = b.score || 0;
        break;
      default:
        return 0;
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const renderStatsCard = (title: string, value: string | number, icon: string, color: string) => (
    <NativeCard style={[styles.statsCard, { borderLeftColor: color }]}>
      <View style={styles.statsContent}>
        <Text style={styles.statsIcon}>{icon}</Text>
        <View style={styles.statsText}>
          <Text style={styles.statsValue}>{value}</Text>
          <Text style={styles.statsTitle}>{title}</Text>
        </View>
      </View>
    </NativeCard>
  );

  const renderCategoryFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryFilter}
    >
      <TouchableOpacity
        style={[
          styles.categoryChip,
          selectedCategory === 'all' && styles.categoryChipActive
        ]}
        onPress={() => setSelectedCategory('all')}
      >
        <Text style={[
          styles.categoryChipText,
          selectedCategory === 'all' && styles.categoryChipTextActive
        ]}>
          Tous ({stats.totalServices})
        </Text>
      </TouchableOpacity>

      {stats.categoryStats.map((category, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.categoryChip,
            selectedCategory === category.name && styles.categoryChipActive
          ]}
          onPress={() => setSelectedCategory(category.name)}
        >
          <Text style={[
            styles.categoryChipText,
            selectedCategory === category.name && styles.categoryChipTextActive
          ]}>
            {category.name} ({category.count})
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSortControls = () => (
    <View style={styles.sortControls}>
      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => {
          const sortOptions = ['date', 'views', 'interactions', 'score'];
          const currentIndex = sortOptions.indexOf(sortBy);
          const nextIndex = (currentIndex + 1) % sortOptions.length;
          setSortBy(sortOptions[nextIndex] as any);
        }}
      >
        <SafeIcon name="arrow-up-down" size={16} color={modernColors.primary} />
        <Text style={styles.sortButtonText}>
          Trier par: {sortBy === 'date' ? 'Date' :
            sortBy === 'views' ? 'Vues' :
              sortBy === 'interactions' ? 'Interactions' : 'Score'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
      >
        <SafeIcon
          name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
          size={16}
          color={modernColors.primary}
        />
        <Text style={styles.sortButtonText}>
          {sortOrder === 'asc' ? 'Croissant' : 'Décroissant'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.viewModeButton}
        onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
      >
        <SafeIcon
          name={viewMode === 'grid' ? 'list' : 'grid'}
          size={16}
          color={modernColors.primary}
        />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={modernColors.primary} />
        <Text style={styles.loadingText}>Chargement de vos services...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header moderne avec boutons d'action en haut à droite */}
      <LinearGradient
        colors={[modernColors.primary, modernColors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <SafeIcon name="briefcase" size={28} color="#fff" />
            <View>
              <Text style={styles.headerTitle}>Mes Services</Text>
              <Text style={styles.headerSubtitle}>
                Gérez et suivez vos services
              </Text>
            </View>
          </View>

          {/* Boutons miniaturisés en haut à droite */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.miniButton}
              onPress={() => setShowStats(!showStats)}
            >
              <SafeIcon name="bar-chart" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.miniButton}
              onPress={() => navigation.navigate('Profile' as never)}
            >
              <SafeIcon name="crown" size={18} color="#FFD700" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.miniButton}
              onPress={() => navigation.navigate('CreatePublicite' as never)}
            >
              <SafeIcon name="megaphone" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Statistiques - Affichage conditionnel */}
        {showStats && (
          <View style={styles.statsContainer}>
            <View style={styles.statsTitleRow}>
              <Text style={styles.sectionTitle}>📊 Statistiques</Text>
              <TouchableOpacity onPress={() => setShowStats(false)}>
                <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.statsGrid}>
              {renderStatsCard('Total Services', stats.totalServices, '📦', '#3498db')}
              {renderStatsCard('Vues Total', stats.totalViews, '👁️', '#e74c3c')}
              {renderStatsCard('Interactions', stats.totalInteractions, '💬', '#f39c12')}
              {renderStatsCard('Score Moyen', stats.avgScore, '⭐', '#2ecc71')}
            </View>
          </View>
        )}

        {/* Filtres et contrôles */}
        <View style={styles.controlsContainer}>
          {renderCategoryFilter()}
          {renderSortControls()}
        </View>

        {/* Liste des services */}
        <View style={styles.servicesContainer}>
          <Text style={styles.sectionTitle}>
            📋 Services ({sortedServices.length})
          </Text>

          {sortedServices.length === 0 ? (
            <NativeCard style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Aucun service trouvé</Text>
              <Text style={styles.emptySubtitle}>
                {selectedCategory === 'all'
                  ? 'Créez votre premier service pour commencer'
                  : `Aucun service dans la catégorie "${selectedCategory}"`
                }
              </Text>
              {selectedCategory === 'all' && (
                <NativeButton
                  title="Créer un service"
                  onPress={handleCreateService}
                  variant="primary"
                  style={styles.emptyButton}
                />
              )}
            </NativeCard>
          ) : (
            <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
              {sortedServices.map((service) => (
                <ServiceCardModern
                  key={service.id}
                  service={service}
                  viewMode={viewMode}
                  onEdit={() => handleEditService(service)}
                  onView={() => handleViewService(service)}
                  onDelete={() => handleDeleteService(service)}
                  onShare={() => handleShareService(service)}
                  onToggleStatus={() => handleToggleStatus(service)}
                  onViewProducts={() => handleViewProducts(service)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    backgroundColor: modernColors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: modernColors.text,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  miniButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    marginBottom: 20,
    backgroundColor: modernColors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  statsTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: modernColors.text,
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statsCard: {
    flex: 1,
    minWidth: (width - 60) / 2,
    borderLeftWidth: 4,
    padding: 15,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statsText: {
    flex: 1,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: modernColors.text,
  },
  statsTitle: {
    fontSize: 12,
    color: modernColors.textSecondary,
    marginTop: 2,
  },
  controlsContainer: {
    marginBottom: 20,
  },
  categoryFilter: {
    marginBottom: 15,
  },
  categoryChip: {
    backgroundColor: modernColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  categoryChipActive: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: modernColors.text,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: 'white',
  },
  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: modernColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: modernColors.border,
    gap: 6,
  },
  sortButtonText: {
    fontSize: 12,
    color: modernColors.text,
    fontWeight: '500',
  },
  viewModeButton: {
    backgroundColor: modernColors.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  actionsContainer: {
    marginBottom: 20,
  },
  createButton: {
    width: '100%',
  },
  servicesContainer: {
    marginBottom: 20,
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: modernColors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    minWidth: 150,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  listContainer: {
    gap: 10,
  },
  brandYuk: {
    color: '#3B82F6', // Bleu (cohérent avec le logo officiel)
  },
  brandPo: {
    color: '#7C3AED', // Violet (cohérent avec le logo officiel)
  },
});

export default ServicesScreen;