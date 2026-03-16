// @ts-nocheck
import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Button, Chip, Avatar, Divider } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { serviceService } from '../../services/api';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  price?: number;
  location?: string;
  contact?: string;
  rating?: number;
  reviews?: number;
  provider: {
    name: string;
    avatar?: string;
    rating?: number;
  };
}

const ServiceDetailScreen: React.FC = () => {
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const route = useRoute();
  const navigation = useNavigation();
    const { t } = useLanguageSafe();
  const { serviceId } = route.params as { serviceId: string };

  useEffect(() => {
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    try {
      const response = await serviceService.getServiceById(serviceId);
      setService(response.data as Service);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les d�tails du service');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (service?.contact) {
      Alert.alert(
        'Contacter le prestataire',
        `Voulez-vous contacter ${service.provider.name} ?`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.contact'), onPress: () => {
            // Ici on pourrait ouvrir l'email ou le t�l�phone
            Alert.alert('Contact', `Contact: ${service.contact}`);
          }},
        ]
      );
    }
  };

  const handleBook = () => {
    Alert.alert(
      'R�server le service',
      'Voulez-vous r�server ce service ?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'R�server', onPress: () => {
          Alert.alert('Succ�s', 'Service r�serv� avec succ�s !');
        }},
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>{t('serviceDetail.chargement')}</Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.errorContainer}>
        <Text>{t('serviceDetail.serviceNonTrouv')}/Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text style={styles.title}>{service.title}</Text>
            <Chip style={styles.categoryChip} textStyle={styles.chipText}>
              {service.category}
            </Chip>
            {service.price && (
              <Text style={styles.price}>{service.price}�</Text>
            )}
          </Card.Content>
        </Card>

        {/* Provider Info */}
        <Card style={styles.providerCard}>
          <Card.Content>
            <View style={styles.providerInfo}>
              <Avatar.Text
                size={50}
                label={service.provider.name.charAt(0)}
                style={styles.providerAvatar}
              />
              <View style={styles.providerDetails}>
                <Text style={styles.providerName}>{service.provider.name}</Text>
                {service.provider.rating && (
                  <Text style={styles.providerRating}>
                    ? {service.provider.rating}/5
                  </Text>
                )}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Description */}
        <Card style={styles.descriptionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{service.description}</Text>
          </Card.Content>
        </Card>

        {/* Details */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>D�tails</Text>
            
            {service.location && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('serviceDetail.localisation')}/Text>
                <Text style={styles.detailValue}>{service.location}</Text>
              </View>
            )}

            {service.rating && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('serviceDetail.note')}/Text>
                <Text style={styles.detailValue}>
                  {service.rating}/5 ({service.reviews || 0} avis)
                </Text>
              </View>
            )}

            {service.contact && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('serviceDetail.contact')}/Text>
                <Text style={styles.detailValue}>{service.contact}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Reviews */}
        <Card style={styles.reviewsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Avis clients</Text>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewText}>
                "Excellent service, tr�s professionnel !"
              </Text>
              <Text style={styles.reviewAuthor}>- Marie L.</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.reviewItem}>
              <Text style={styles.reviewText}>
                "Je recommande vivement ce prestataire."
              </Text>
              <Text style={styles.reviewAuthor}>- Jean P.</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={handleContact}
            style={styles.contactButton}
          >
            <Text style={{ color: "#FFD700" }}>Contacter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBook}
            style={styles.bookButton}
          >
            <Text style={{ color: "#000" }}>R�server</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  headerCard: {
    marginBottom: 16,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  categoryChip: {
    backgroundColor: '#E3F2FD',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  chipText: {
    color: '#1976D2',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  providerCard: {
    marginBottom: 16,
    elevation: 2,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerAvatar: {
    backgroundColor: '#FFD700',
    marginRight: 16,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  providerRating: {
    fontSize: 14,
    color: '#666',
  },
  descriptionCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  detailsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  detailItem: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#666',
  },
  reviewsCard: {
    marginBottom: 24,
    elevation: 2,
  },
  reviewItem: {
    marginBottom: 12,
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  reviewAuthor: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  divider: {
    marginVertical: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  contactButton: {
    flex: 1,
    marginRight: 8,
    borderColor: '#FFD700',
  },
  bookButton: {
    flex: 1,
    marginLeft: 8,
  },
});

export default ServiceDetailScreen;













