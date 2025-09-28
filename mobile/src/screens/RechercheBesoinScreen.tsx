import * as React from 'react';
import { TouchableOpacity } from 'react-native';
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Card, Title, Paragraph } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { theme } from '../theme/theme';

const RechercheBesoinScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { location } = useLocation();
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir votre recherche');
      return;
    }

    setLoading(true);
    try {
      // Simuler une recherche
      const mockResults = [
        {
          id: '1',
          titre: 'Service trouvé',
          description: 'Description du service',
          score: 0.95,
        }
      ];

      // Naviguer vers les résultats
      (navigation as any).navigate('ResultatBesoin', {
        searchResults: mockResults
      });
    } catch (error) {
      console.error('Erreur recherche:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la recherche');
    } finally {
      setLoading(false);
    }
  }, [searchText, navigation]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>🔍 Recherche de besoin</Title>
        <Paragraph style={styles.subtitle}>
          Décrivez votre besoin et trouvez les services adaptés
        </Paragraph>
      </View>

      <Card style={styles.searchCard}>
        <Card.Content>
          <TextInput
            label="Que recherchez-vous ?"
            value={searchText}
            onChangeText={setSearchText}
            multiline
            numberOfLines={4}
            style={styles.searchInput}
            placeholder="Ex: J'ai besoin d'un plombier pour réparer ma douche..."
          />

          {location && (
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={16} color={theme.colors.primary} />
              <Text style={styles.locationText}>
                Recherche près de votre position
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSearch}
            disabled={loading}
            style={styles.searchButton}
          >
            <Text style={styles.searchButtonLabel}>
              Rechercher
            </Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>

      <Card style={styles.helpCard}>
        <Card.Content>
          <Title style={styles.helpTitle}>💡 Conseils pour votre recherche</Title>
          <Paragraph style={styles.helpText}>
            • Soyez précis dans votre description{'\n'}
            • Mentionnez votre localisation si nécessaire{'\n'}
            • Utilisez des mots-clés pertinents{'\n'}
            • Décrivez votre budget si vous en avez un
          </Paragraph>
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
  header: {
    padding: 20,
    backgroundColor: theme.colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  searchCard: {
    margin: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  searchInput: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  searchButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
  },
  searchButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpCard: {
    margin: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
});

export default RechercheBesoinScreen;







