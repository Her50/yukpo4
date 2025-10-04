// Migration vers Phosphor React Native pour un design moderne
import { CurrencyDollar, MapPin, Plus, Star, User } from 'phosphor-react-native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, TextInput } from 'react-native';
// Remplacement des composants react-native-paper par des composants natifs
import { servicesApi } from '../services/api';
import { theme } from '../theme/theme';

const ServicesScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserServices();
  }, []);

  const loadUserServices = async () => {
    try {
      setLoading(true);
      const response = await servicesApi.getUserServices();

      if (response.success && response.data) {
        const servicesData = response.data as any[];
        setServices(servicesData);
        console.log('[ServicesScreen] Services chargés:', servicesData.length);
      } else {
        setServices([]);
      }
    } catch (error) {
      console.error('Erreur chargement services:', error);
      Alert.alert('Erreur', 'Impossible de charger vos services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'Tous', icon: 'grid-outline' },
    { id: 'home', name: 'Maison', icon: 'home-outline' },
    { id: 'tech', name: 'Technologie', icon: 'laptop-outline' },
    { id: 'health', name: 'Santé', icon: 'medical-outline' },
    { id: 'education', name: 'Éducation', icon: 'school-outline' },
    { id: 'business', name: 'Business', icon: 'briefcase-outline' },
  ];

  // Helper pour extraire la valeur d'un champ qui peut être un objet {valeur, type_donnee, origine_champs}
  const extractValue = (field: any): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && field.valeur) return String(field.valeur);
    return '';
  };

  const filteredServices = services.filter(service => {
    const serviceTitle = extractValue(service.data?.title) || extractValue(service.nom) || '';
    const serviceDescription = extractValue(service.data?.description) || extractValue(service.description) || '';
    const serviceCategory = extractValue(service.data?.category) || extractValue(service.categorie) || '';
    
    const matchesSearch = serviceTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      serviceDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || serviceCategory.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement de vos services...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes Services</Text>
        <Text style={styles.subtitle}>Gérez tous vos services en un coup d'œil</Text>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <TextInput
            placeholder="Rechercher un service..."
            placeholderTextColor="#999"
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* Catégories */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Star
                size={20}
                color={selectedCategory === category.id ? 'white' : theme.colors.primary}
              />
              <Text style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Statistiques rapides */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{services.length}</Text>
          <Text style={styles.statLabel}>Services</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>4.7</Text>
          <Text style={styles.statLabel}>Note moyenne</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>24h</Text>
          <Text style={styles.statLabel}>Disponibilité</Text>
        </View>
      </View>

      {/* Liste des services */}
      <View style={styles.servicesContainer}>
        <Text style={styles.sectionTitle}>
          {filteredServices.length} service{filteredServices.length > 1 ? 's' : ''} trouvé{filteredServices.length > 1 ? 's' : ''}
        </Text>

        {filteredServices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== 'all' 
                ? 'Aucun service ne correspond à votre recherche' 
                : 'Vous n\'avez pas encore de services'}
            </Text>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => console.log('Créer un service')}
            >
              <Plus size={20} color="#FFF" />
              <Text style={styles.createButtonText}>Créer un service</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredServices.map((service) => {
            const serviceTitle = extractValue(service.data?.title) || extractValue(service.nom) || 'Service sans titre';
            const serviceDescription = extractValue(service.data?.description) || extractValue(service.description) || '';
            const servicePrice = extractValue(service.data?.price) || extractValue(service.price) || 'Prix sur demande';
            const serviceLocation = extractValue(service.data?.location) || extractValue(service.gps_zone) || 'Non spécifié';
            const serviceRating = typeof service.rating === 'number' ? service.rating : 0;

            return (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceContent}>
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceTitle}>{serviceTitle}</Text>
                      <Text style={styles.serviceDescription}>
                        {serviceDescription}
                      </Text>
                    </View>
                    {serviceRating > 0 && (
                      <View style={styles.serviceRating}>
                        <Star size={16} color="#FFD700" fill="#FFD700" />
                        <Text style={styles.ratingText}>{serviceRating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.serviceDetails}>
                    <View style={styles.serviceDetail}>
                      <MapPin size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.detailText}>{serviceLocation}</Text>
                    </View>
                    <View style={styles.serviceDetail}>
                      <CurrencyDollar size={16} color={theme.colors.primary} />
                      <Text style={[styles.detailText, styles.priceText]}>{servicePrice}</Text>
                    </View>
                  </View>

                  <View style={styles.serviceActions}>
                    <TouchableOpacity
                      onPress={() => {
                        console.log('Voir détails:', service.id);
                      }}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>Voir détails</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        console.log('Modifier:', service.id);
                      }}
                      style={styles.editButton}
                    >
                      <Text style={styles.editButtonText}>Modifier</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Call to action */}
      <View style={styles.ctaContainer}>
        <View style={styles.ctaCard}>
          <View style={styles.ctaContent}>
            <Plus size={48} color={theme.colors.primary} />
            <Text style={styles.ctaTitle}>Vous proposez un service ?</Text>
            <Text style={styles.ctaDescription}>
              Rejoignez notre plateforme et commencez à proposer vos services dès aujourd'hui.
            </Text>
            <TouchableOpacity
              onPress={() => {
                // Navigation vers la création de service
                console.log('Créer un service');
              }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaButtonText}>Créer un service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  searchContainer: {
    padding: 20,
    paddingTop: 15,
  },
  searchBar: {
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  categoryTextActive: {
    color: 'white',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
  servicesContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 15,
  },
  serviceCard: {
    backgroundColor: 'white',
    marginBottom: 15,
    marginHorizontal: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  serviceContent: {
    padding: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 10,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 5,
  },
  serviceDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  serviceRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
  },
  serviceDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 15,
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 5,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  priceText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  serviceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  contactButton: {
    flex: 1,
  },
  ctaContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  ctaCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  ctaContent: {
    alignItems: 'center',
    padding: 30,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  ctaButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ServicesScreen;



