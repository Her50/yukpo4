import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, Paragraph, Searchbar, Title } from 'react-native-paper';
import { theme } from '../theme/theme';

const ServicesScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'Tous', icon: 'grid-outline' },
    { id: 'home', name: 'Maison', icon: 'home-outline' },
    { id: 'tech', name: 'Technologie', icon: 'laptop-outline' },
    { id: 'health', name: 'Santé', icon: 'medical-outline' },
    { id: 'education', name: 'Éducation', icon: 'school-outline' },
    { id: 'business', name: 'Business', icon: 'briefcase-outline' },
  ];

  const services = [
        {
          id: 1,
      title: 'Plomberie Express',
      category: 'home',
      description: 'Réparation rapide de fuites et installations',
      price: 'À partir de 25€',
      rating: 4.8,
      provider: 'Jean Dupont',
      location: 'Paris 15e',
        },
        {
          id: 2,
      title: 'Cours de Mathématiques',
      category: 'education',
      description: 'Soutien scolaire niveau collège et lycée',
      price: 'À partir de 20€/h',
      rating: 4.9,
      provider: 'Marie Martin',
      location: 'Lyon',
    },
    {
      id: 3,
      title: 'Développement Web',
      category: 'tech',
      description: 'Création de sites web et applications',
      price: 'À partir de 50€/h',
      rating: 4.7,
      provider: 'Pierre Durand',
      location: 'Marseille',
    },
    {
      id: 4,
      title: 'Ménage à domicile',
      category: 'home',
      description: 'Service de ménage complet et régulier',
      price: 'À partir de 15€/h',
      rating: 4.6,
      provider: 'Sophie Leroy',
      location: 'Toulouse',
    },
  ];

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
              <Ionicons
                name={category.icon as any}
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
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>{service.rating}</Text>
                </View>
              </View>

              <View style={styles.serviceDetails}>
                <View style={styles.serviceDetail}>
                  <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.detailText}>{service.provider}</Text>
                </View>
                <View style={styles.serviceDetail}>
                  <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.detailText}>{service.location}</Text>
                </View>
                <View style={styles.serviceDetail}>
                  <Ionicons name="cash-outline" size={16} color={theme.colors.primary} />
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
            <Ionicons name="add-circle" size={48} color={theme.colors.primary} />
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



