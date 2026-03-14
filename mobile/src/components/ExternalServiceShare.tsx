import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as React from "react";
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, Card, Paragraph, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';

interface ServiceData {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  location: string;
  provider: string;
  rating: number;
  imageUrl?: string;
}

const ExternalServiceShare: React.FC = () => {
  const navigation = useNavigation();
  const [service, setService] = useState<ServiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServiceData();
  }, []);

  const loadServiceData = async () => {
    try {
      setLoading(true);
      const mockService: ServiceData = {
        id: '1',
        title: 'Réparation plomberie professionnelle',
        description: 'Service de réparation de plomberie à domicile avec garantie. Intervention rapide 24h/24.',
        category: 'Plomberie',
        price: 15000,
        location: 'Douala, Cameroun',
        provider: 'Plombier Pro',
        rating: 4.8,
      };
      setService(mockService);
    } catch (error) {
      console.error('Erreur chargement service:', error);
      Alert.alert('Erreur', 'Impossible de charger les informations du service');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!service) return;

    try {
      const shareMessage = `Découvrez ce service sur Yukpo:\n\n${service.title}\n\n${service.description}\n\nPrix: ${service.price.toLocaleString()} XAF\nLocalisation: ${service.location}\n\nTéléchargez Yukpo pour plus de services!`;

      await Share.share({
        message: shareMessage,
        title: service.title,
      });
    } catch (error) {
      console.error('Erreur partage:', error);
      Alert.alert('Erreur', 'Impossible de partager le service');
    }
  };

  const handleContact = () => {
    Alert.alert(
      'Contacter le prestataire',
      'Voulez-vous contacter ce prestataire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Contacter',
          onPress: () => {
            Alert.alert('Contact', 'Fonctionnalité de contact à implémenter');
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Chargement du service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Service non trouvé</Text>
          <Text style={styles.errorText}>
            Le service que vous recherchez n'existe pas ou a été supprimé.
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            Retour
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.serviceCard}>
          <Card.Content>
            <Title style={styles.serviceTitle}>{service.title}</Title>

            <View style={styles.serviceMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="business" size={16} color={theme.colors.primary} />
                <Text style={styles.metaText}>{service.provider}</Text>
              </View>

              <View style={styles.metaItem}>
                <Ionicons name="location" size={16} color={theme.colors.primary} />
                <Text style={styles.metaText}>{service.location}</Text>
              </View>

              <View style={styles.metaItem}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.metaText}>{service.rating}/5</Text>
              </View>
            </View>

            <Paragraph style={styles.description}>{service.description}</Paragraph>

            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Prix:</Text>
              <Text style={styles.price}>{service.price.toLocaleString()} XAF</Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.actionsContainer}>
          <Button
            mode="contained"
            onPress={handleContact}
            style={styles.contactButton}
            icon="message"
          >
            Contacter le prestataire
          </Button>

          <Button
            mode="outlined"
            onPress={handleShare}
            style={styles.shareButton}
            icon="share"
          >
            Partager ce service
          </Button>
        </View>

        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.infoTitle}>À propos de Yukpo</Title>
            <Paragraph style={styles.infoText}>
              Yukpo est une plateforme de connexion directe entre les besoins exprimés et les solutions concrètes.
              Téléchargez l'application pour découvrir plus de services et créer votre propre profil de prestataire.
            </Paragraph>
          </Card.Content>
        </Card>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.error,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
  },
  serviceCard: {
    marginBottom: 16,
    elevation: 2,
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  serviceMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  metaText: {
    marginLeft: 4,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  description: {
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  actionsContainer: {
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: theme.colors.primary,
    marginBottom: 12,
  },
  shareButton: {
    borderColor: theme.colors.primary,
  },
  infoCard: {
    elevation: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

export default ExternalServiceShare;






