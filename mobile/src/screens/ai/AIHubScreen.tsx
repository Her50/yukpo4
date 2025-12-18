// @ts-nocheck
import * as React from 'react';
import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

const AIHubScreen: React.FC = () => {
  const navigation = useNavigation();

  const aiFeatures = [
    {
      title: 'Chat IA',
      description: 'Discutez avec notre assistant intelligent',
      icon: '??',
      onPress: () => navigation.navigate('AIChat' as never),
    },
    {
      title: 'Recherche Intelligente',
      description: 'Trouvez des services avec l\'IA',
      icon: '??',
      onPress: () => navigation.navigate('Search' as never),
    },
    {
      title: 'Cr�ation Assist�e',
      description: 'Cr�ez des services avec l\'aide de l\'IA',
      icon: '??',
      onPress: () => navigation.navigate('CreateService' as never),
    },
    {
      title: 'Suggestions Personnalis�es',
      description: 'Recevez des recommandations adapt�es',
      icon: '?',
      onPress: () => {},
    },
  ];

  const quickActions = [
    {
      title: 'Rechercher un coiffeur',
      description: 'Trouvez un coiffeur pr�s de chez vous',
      onPress: () => {
        // Navigation avec param�tres de recherche
        navigation.navigate('Search' as never);
      },
    },
    {
      title: 'Cr�er un service de nettoyage',
      description: 'Proposez vos services de m�nage',
      onPress: () => navigation.navigate('CreateService' as never),
    },
    {
      title: 'Demander de l\'aide',
      description: 'Posez une question � l\'IA',
      onPress: () => navigation.navigate('AIChat' as never),
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>IA Hub</Text>
          <Text style={styles.subtitle}>
            D�couvrez la puissance de l'intelligence artificielle
          </Text>
        </View>

        {/* AI Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fonctionnalit�s IA</Text>
          <View style={styles.featuresGrid}>
            {aiFeatures.map((feature, index) => (
              <TouchableOpacity
                key={index}
                style={styles.featureCard}
                onPress={feature.onPress}
              >
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          {quickActions.map((action, index) => (
            <Card key={index} style={styles.actionCard}>
              <Card.Content>
                <TouchableOpacity onPress={action.onPress}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* AI Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Statistiques IA</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>1,234</Text>
                <Text style={styles.statLabel}>Requ�tes trait�es</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>98%</Text>
                <Text style={styles.statLabel}>Pr�cision</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>2.3s</Text>
                <Text style={styles.statLabel}>Temps moyen</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Tips */}
        <Card style={styles.tipsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>?? Conseils d'utilisation</Text>
            <View style={styles.tipsList}>
              <Text style={styles.tipItem}>� Soyez pr�cis dans vos demandes</Text>
              <Text style={styles.tipItem}>� Utilisez des mots-cl�s pertinents</Text>
              <Text style={styles.tipItem}>� L'IA apprend de vos interactions</Text>
              <Text style={styles.tipItem}>� N'h�sitez pas � reformuler si n�cessaire</Text>
            </View>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionCard: {
    marginBottom: 12,
    elevation: 2,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
  },
  statsCard: {
    marginBottom: 24,
    elevation: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tipsCard: {
    elevation: 2,
  },
  tipsList: {
    marginTop: 8,
  },
  tipItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default AIHubScreen;




