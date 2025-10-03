// Migration vers Phosphor React Native pour un design moderne
import { CurrencyDollar, MapPin, Plus, Star, User } from 'phosphor-react-native';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, RefreshControl } from 'react-native';
import { Card, Paragraph, Searchbar, Title, ActivityIndicator } from 'react-native-paper';
import { theme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi } from '../services/api';

const ServicesScreen: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const categories = [
    { id: 'all', name: 'Tous', icon: 'grid-outline' },
    { id: 'home', name: 'Maison', icon: 'home-outline' },
    { id: 'tech', name: 'Technologie', icon: 'laptop-outline' },
    { id: 'health', name: 'Santé', icon: 'medical-outline' },
    { id: 'education', name: 'Éducation', icon: 'school-outline' },
    { id: 'business', name: 'Business', icon: 'briefcase-outline' },
  ];

  // Charger les services de l'utilisateur (comme le frontend)
  useEffect(() => {
    if (user?.id) {
      loadUserServices();
    }
  }, [user?.id]);

  const loadUserServices = async () => {
    try {
      setLoading(true);
      console.log('[ServicesScreen] Chargement des services utilisateur...');
      
      const response = await servicesApi.getUserServices();
      
      if (response.success && response.data) {
        // Trier les services du plus récent au plus ancien (comme le frontend)
        const servicesTries = response.data.sort((a: any, b: any) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        console.log('[ServicesScreen] Services chargés:', servicesTries.length);
        setServices(servicesTries);
      } else {
        console.log('[ServicesScreen] Aucun service trouvé');
        setServices([]);
      }
    } catch (error) {
      console.error('[ServicesScreen] Erreur lors du chargement des services:', error);
      Alert.alert('Erreur', 'Impossible de charger vos services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserServices();
    setRefreshing(false);
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Services Disponibles</Text>
        <Text style={styles.subtitle}>Trouvez le service parfait pour vos besoins</Text>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Rechercher un service..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
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

        {filteredServices.map((service) => (
          <Card key={service.id} style={styles.serviceCard}>
            <Card.Content>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceInfo}>
                  <Title style={styles.serviceTitle}>{service.title}</Title>
                  <Paragraph style={styles.serviceDescription}>
                    {service.description}
                  </Paragraph>
                </View>
                <View style={styles.serviceRating}>
                  <Star size={16} color="#FFD700" fill="#FFD700" />
                  <Text style={styles.ratingText}>{service.rating}</Text>
                </View>
              </View>

              <View style={styles.serviceDetails}>
                <View style={styles.serviceDetail}>
                  <User size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.detailText}>{service.provider}</Text>
                </View>
                <View style={styles.serviceDetail}>
                  <MapPin size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.detailText}>{service.location}</Text>
                </View>
                <View style={styles.serviceDetail}>
                  <CurrencyDollar size={16} color={theme.colors.primary} />
                  <Text style={[styles.detailText, styles.priceText]}>{service.price}</Text>
                </View>
              </View>

              <View style={styles.serviceActions}>
                <TouchableOpacity
                  onPress={() => {
                    // Navigation vers les détails du service
                    console.log('Voir détails:', service.id);
                  }}
                  style={styles.actionButton}
                >
                  <Text>Voir détails</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    // Contacter le prestataire
                    console.log('Contacter:', service.id);
                  }}
                  style={styles.contactButton}
                >
                  <Text>Contacter</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>

      {/* Call to action */}
      <View style={styles.ctaContainer}>
        <Card style={styles.ctaCard}>
          <Card.Content style={styles.ctaContent}>
            <Plus size={48} color={theme.colors.primary} />
            <Title style={styles.ctaTitle}>Vous proposez un service ?</Title>
            <Paragraph style={styles.ctaDescription}>
              Rejoignez notre plateforme et commencez à proposer vos services dès aujourd'hui.
            </Paragraph>
            <TouchableOpacity
              onPress={() => {
                // Navigation vers la création de service
                console.log('Créer un service');
              }}
              style={styles.ctaButton}
            >
              <Text>Créer un service</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
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
    elevation: 2,
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
    marginBottom: 15,
    elevation: 2,
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
    elevation: 3,
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
    borderRadius: 8,
  },
});

export default ServicesScreen;



