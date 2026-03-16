// @ts-nocheck
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';
import { useNavigation } from '@react-navigation/native';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ServiceItem {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  type: string;
  icon: string;
}

const mockServices: ServiceItem[] = [
  {
    id: '1',
    nom: 'Yukpo Immobilier',
    description: 'Publication et gestion de biens immobiliers',
    categorie: 'Immobilier',
    type: 'plateforme',
    icon: '🏠',
  },
  {
    id: '2',
    nom: 'Yukpo Transport',
    description: t('servicesList.reservationDeBilletsEtHotels'),
    categorie: 'Transport',
    type: 'service',
    icon: '🚗',
  },
  {
    id: '3',
    nom: 'Yukpo Social Listening',
    description: t('servicesList.suiviIntelligentDesTendancesSociales'),
    categorie: 'Analyse & Intelligence',
    type: 'moteur',
    icon: '📊',
  },
  {
    id: '4',
    nom: 'Yukpo Commerce',
    description: t('servicesList.gestionDeBoutiqueEnLigne'),
    categorie: 'E-commerce',
    type: 'plateforme',
    icon: '🛍️',
  },
  {
    id: '5',
    nom: 'Yukpo Formation',
    description: 'Plateforme de cours et formations',
    categorie: t('servicesListScreen.education'),
    type: 'service',
    icon: '📚',
  },
];

const ServicesListScreen: React.FC = () => {
  const navigation = useNavigation();
    const { t } = useLanguageSafe();
  const [query, setQuery] = useState('');

  const filtered = mockServices.filter(
    (s) =>
      s.nom.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase()) ||
      s.categorie.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SafeNativeView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('servicesList.catalogueDesServices')}</Text>
          <Text style={styles.subtitle}>
            Découvrez tous les services disponibles sur{' '}
            <Text style={styles.brandYuk}>Yuk</Text>
            <Text style={styles.brandPo}>po</Text>
          </Text>
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('servicesList.rechercherUnService')}
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* Boutons d'accès rapide */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardPrimary]}
            onPress={() => (navigation as any).navigate('Home')}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={styles.actionTitle}>Trouver un service</Text>
            <Text style={styles.actionDescription}>
              Exprimez un besoin, Yukpo vous connecte automatiquement
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardSecondary]}
            onPress={() => (navigation as any).navigate('Home')}
          >
            <Text style={styles.actionIcon}>⚙️</Text>
            <Text style={styles.actionTitle}>{t('servicesList.creerUnService')}</Text>
            <Text style={styles.actionDescription}>
              Service assisté personnalisé en quelques clics
            </Text>
          </TouchableOpacity>
        </View>

        {/* Liste des services */}
        <Text style={styles.sectionTitle}>{t('servicesList.servicesDisponibles')}</Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyText}>
              Aucun service ne correspond à votre recherche
            </Text>
          </View>
        ) : (
          <View style={styles.servicesGrid}>
            {filtered.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={styles.serviceCard}
                onPress={() => {
                  // Navigation vers détail du service
                  console.log('Service sélectionné:', service.id);
                }}
              >
                <Text style={styles.serviceIcon}>{service.icon}</Text>
                <View style={styles.serviceContent}>
                  <View style={styles.serviceHeader}>
                    <Text style={styles.serviceName}>{service.nom}</Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{service.categorie}</Text>
                    </View>
                  </View>
                  <Text style={styles.serviceDescription}>{service.description}</Text>
                  <View style={styles.serviceFooter}>
                    <Text style={styles.serviceType}>{service.type.toUpperCase()}</Text>
                    <TouchableOpacity style={styles.discoverButton}>
                      <Text style={styles.discoverText}>{t('servicesList.decouvrir')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeNativeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 32,
    marginBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  brandYuk: {
    color: '#FFC107',
    fontWeight: 'bold',
  },
  brandPo: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
  },
  quickActions: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 32,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionCardPrimary: {
    backgroundColor: '#6366F1',
  },
  actionCardSecondary: {
    backgroundColor: '#10B981',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.9,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  servicesGrid: {
    paddingHorizontal: 20,
  },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  serviceContent: {
    flex: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceType: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  discoverButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  discoverText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
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
    color: '#999',
    textAlign: 'center',
  },
});

export default ServicesListScreen;


