// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';

const MyServicesScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleCreateService = () => {
    (navigation as any).navigate('CreateService');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Mes Services</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleCreateService}
          >
            <Text style={styles.iconText}>+</Text>
            <Text style={styles.addButtonText}>Nouveau</Text>
          </TouchableOpacity>
        </View>

        {/* Contenu principal */}
        <View style={styles.content}>
          {/* Message d'information */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>?</Text>
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Gérez vos services</Text>
              <Text style={styles.infoDescription}>
                Créez et gérez vos services pour attirer plus de clients
              </Text>
            </View>
          </View>

          {/* Bouton de création rapide */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateService}
          >
            <Text style={styles.createIcon}>+</Text>
            <Text style={styles.createButtonText}>Créer un nouveau service</Text>
          </TouchableOpacity>

          {/* Liste des services (vide pour l'instant) */}
          <View style={styles.servicesList}>
            <Text style={styles.emptyText}>
              Aucun service créé pour le moment
            </Text>
            <Text style={styles.emptySubtext}>
              Commencez par créer votre premier service
            </Text>
          </View>
        </View>
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
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#000',
    fontWeight: '600',
    marginLeft: 4,
  },
  iconText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  infoIcon: {
    fontSize: 24,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  createIcon: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  servicesList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default MyServicesScreen;
