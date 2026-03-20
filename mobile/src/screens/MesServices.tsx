// @ts-nocheck
import * as React from "react";
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, Paragraph, Button, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface Service {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  views: number;
  interactions: number;
}

const MesServicesScreen: React.FC = () => {
  const navigation = useNavigation();
    const { t } = useLanguageSafe();
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const mockServices: Service[] = [
        {
          id: '1',
          title: 'R�paration plomberie',
          description: t('mesServices.serviceDeRparationDePlomberie'),
          status: 'active',
          createdAt: '2024-01-15',
          views: 45,
          interactions: 12
        },
        {
          id: '2',
          title: t('mesServices.coursDeMathmatiques'),
          description: t('mesServices.coursParticuliersDeMathmatiquesNiveau'),
          status: 'active',
          createdAt: '2024-01-10',
          views: 23,
          interactions: 8
        }
      ];
      setServices(mockServices);
    } catch (error) {
      console.error('Erreur chargement services:', error);
      Alert.alert('Erreur', 'Impossible de charger vos services');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>{t('mesServices.chargementDeVosServices')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Title style={styles.title}>{t('mesServices.mesServices')}</Title>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateService' as never)}
          >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addButtonText}>{t('mesServices.nouveau')}</Text>
          </TouchableOpacity>
        </View>

        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color="#9E9E9E" />
            <Text style={styles.emptyTitle}>{t('mesServices.aucunService')}</Text>
            <Text style={styles.emptyText}>
              Vous n'avez pas encore cr�� de service. Cr�ez votre premier service pour commencer.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateService' as never)}
              style={styles.createButton}
            >
              <Text style={styles.createButtonText}>Cr�er un service</Text>
            </TouchableOpacity>
          </View>
        ) : (
          services.map((service) => (
            <Card key={service.id} style={styles.serviceCard}>
              <Card.Content>
                <View style={styles.serviceHeader}>
                  <Title style={styles.serviceTitle}>{service.title}</Title>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(service.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(service.status)}</Text>
                  </View>
                </View>
                
                <Paragraph style={styles.serviceDescription}>
                  {service.description}
                </Paragraph>
                
                <View style={styles.serviceStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="eye" size={16} color={theme.colors.primary} />
                    <Text style={styles.statText}>{service.views} vues</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="chatbubbles" size={16} color={theme.colors.primary} />
                    <Text style={styles.statText}>{service.interactions} interactions</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="calendar" size={16} color={theme.colors.primary} />
                    <Text style={styles.statText}>{new Date(service.createdAt).toLocaleDateString()}</Text>
                  </View>
                </View>
                
                <View style={styles.serviceActions}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ServiceDetail' as never, { serviceId: service.id })}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>Voir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('�dition', 'Fonctionnalit� d\'�dition � impl�menter');
                    }}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>Modifier</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  serviceCard: {
    marginBottom: 16,
    elevation: 2,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  serviceDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  serviceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  serviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MesServicesScreen;




