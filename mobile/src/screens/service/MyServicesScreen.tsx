import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../theme/theme';

// Simuler le composant BusinessServiceCard du frontend
interface BusinessServiceCardProps {
  nom: string;
  description: string;
  plan_requis: 'free' | 'pro' | 'enterprise';
}

const BusinessServiceCard: React.FC<BusinessServiceCardProps> = ({ nom, description, plan_requis }) => {
  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return theme.colors.accent;
      case 'pro': return theme.colors.primary;
      case 'enterprise': return theme.colors.secondary;
      default: return theme.colors.textSecondary;
    }
  };

  return (
    <Card style={styles.serviceCard}>
      <Card.Content>
        <View style={styles.serviceCardHeader}>
          <Title style={styles.serviceCardTitle}>{nom}</Title>
          <Text style={[styles.planBadge, { backgroundColor: getPlanColor(plan_requis) }]}>
            {plan_requis.toUpperCase()}
          </Text>
        </View>
        <Paragraph style={styles.serviceCardDescription}>{description}</Paragraph>
        {/* TODO: Ajouter un bouton "Voir les détails" ou "Gérer" */}
      </Card.Content>
    </Card>
  );
};

interface Service {
  id: number;
  nom: string;
  description: string;
  categorie?: string;
  plan: 'free' | 'pro' | 'enterprise';
}

const MyServicesScreen: React.FC = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  // Simuler le plan de l'utilisateur (pourrait venir de l'API ou du contexte utilisateur)
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'enterprise'>('free');

  useEffect(() => {
    // Simuler le chargement des services (logique identique au frontend)
    const fetchServices = async () => {
      setLoading(true);
      
      // En production, vous feriez un appel API ici
      // const response = await api.get('/api/user/services');
      // const data = response.data;

      // Liste complète des services (identique au frontend)
      const fullList: Service[] = [
        {
          id: 1,
          nom: 'Yukpo Immobilier',
          description: 'Publier et gérer vos annonces immobilières professionnelles.',
          plan: 'free',
        },
        {
          id: 2,
          nom: 'Yukpo Transport',
          description: 'Réservation de billets et hôtels partenaires.',
          plan: 'pro',
        },
        {
          id: 3,
          nom: 'Yukpo Partenaires',
          description: 'Accès aux prestataires validés et services complémentaires.',
          plan: 'enterprise',
        },
        {
          id: 4,
          nom: 'Yukpo IA Avancée',
          description: 'Accès aux modèles d\'IA premium et fonctionnalités avancées.',
          plan: 'pro',
        },
        {
          id: 5,
          nom: 'Yukpo Support Prioritaire',
          description: 'Support client 24/7 avec des temps de réponse garantis.',
          plan: 'enterprise',
        },
      ];

      // Filtrer les services en fonction du plan de l'utilisateur (logique identique au frontend)
      const tiers = ['free', 'pro', 'enterprise'];
      const filtered = fullList.filter((s) => tiers.indexOf(userPlan) >= tiers.indexOf(s.plan));
      setServices(filtered);
      setLoading(false);
    };

    fetchServices();
  }, [userPlan]); // Recharger si le plan de l'utilisateur change

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement de vos services...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>
          ⚙️ Mes services <Text style={styles.yukpoText}>Yukpo</Text>
        </Title>
        <Paragraph style={styles.subtitle}>
          Gérez vos services et découvrez de nouvelles opportunités.
        </Paragraph>
        <Text style={styles.planInfo}>
          Votre plan actuel : <Text style={styles.currentPlan}>{userPlan.toUpperCase()}</Text>
        </Text>
      </View>

      {services.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Title style={styles.emptyTitle}>
              Aucun service disponible
            </Title>
            <Paragraph style={styles.emptyText}>
              Aucun service disponible avec votre formule actuelle.
            </Paragraph>
            <Text style={styles.emptySubtext}>
              Consultez nos formules pour accéder à plus de services.
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <View style={styles.servicesGrid}>
          {services.map((service) => (
            <BusinessServiceCard
              key={service.id}
              nom={service.nom}
              description={service.description}
              plan_requis={service.plan}
            />
          ))}
        </View>
      )}

      {/* Section pour découvrir d'autres services */}
      <Card style={styles.discoveryCard}>
        <Card.Content>
          <Title style={styles.discoveryTitle}>🚀 Découvrir d'autres services</Title>
          <Paragraph style={styles.discoveryText}>
            Explorez notre catalogue complet de services et fonctionnalités.
          </Paragraph>
          {/* TODO: Ajouter un bouton pour naviguer vers la page des services */}
        </Card.Content>
      </Card>

      {/* Section pour voir les formules */}
      <Card style={styles.plansCard}>
        <Card.Content>
          <Title style={styles.plansTitle}>💎 Voir les formules</Title>
          <Paragraph style={styles.plansText}>
            Découvrez nos formules et choisissez celle qui correspond à vos besoins.
          </Paragraph>
          {/* TODO: Ajouter un bouton pour naviguer vers la page des formules */}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: theme.colors.text,
  },
  yukpoText: {
    color: '#FF8C00', // Orange pour la marque Yukpo
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 15,
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  planInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  currentPlan: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  servicesGrid: {
    padding: 20,
    gap: 15,
  },
  serviceCard: {
    marginBottom: 15,
    elevation: 2,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  serviceCardDescription: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    margin: 20,
    elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 30,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: theme.colors.text,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  emptySubtext: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  discoveryCard: {
    margin: 20,
    marginTop: 10,
    elevation: 2,
    backgroundColor: theme.colors.surface,
  },
  discoveryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 10,
  },
  discoveryText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  plansCard: {
    margin: 20,
    marginTop: 10,
    elevation: 2,
    backgroundColor: theme.colors.surface,
  },
  plansTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.secondary,
    marginBottom: 10,
  },
  plansText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
});

export default MyServicesScreen;