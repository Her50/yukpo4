import * as React from 'react';
import { TouchableOpacity } from 'react-native';
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Card, Title, Paragraph } from 'react-native-paper';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { theme } from '../theme/theme';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { servicesApi } from '../services/api';
import { IntelligentSearchService } from '../services/intelligentSearch';

const RechercheBesoinScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { location } = useLocation();
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir votre recherche');
      return;
    }

    setLoading(true);
    try {
      console.log('[RechercheBesoinScreen] 🔍 Démarrage de la recherche intelligente');
      console.log('[RechercheBesoinScreen] 📝 Texte recherché:', searchText);
      console.log('[RechercheBesoinScreen] 📍 Géolocalisation:', location ? `${location.coords.latitude},${location.coords.longitude}` : 'Non disponible');

      // Préparer les données de recherche avec géolocalisation
      const searchData = {
        texte: searchText,
        gps_mobile: location ? `${location.coords.latitude},${location.coords.longitude}` : null,
        user_id: user?.id || null
      };

      console.log('[RechercheBesoinScreen] 📤 Envoi de la requête API:', searchData);

      // Appel à la recherche intelligente (PostgreSQL + IA)
      const results = await IntelligentSearchService.intelligentSearch(searchText, {
        user_id: user?.id || undefined,
        location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        } : undefined
      });
      
      console.log('[RechercheBesoinScreen] 📥 Résultats intelligents reçus:', results.length);

      if (results.length > 0) {
        // Naviguer vers les résultats avec les vraies données
        (navigation as any).navigate('ResultatBesoin', {
          results: results,
          searchText: searchText,
          searchMetadata: {
            timestamp: new Date().toISOString(),
            location: location ? `${location.coords.latitude},${location.coords.longitude}` : null,
            userId: user?.id || null,
            intelligent_search: true,
            ai_enhanced: results.some(r => r.ai_confidence)
          }
        });
      } else {
        console.log('[RechercheBesoinScreen] ⚠️ Aucun résultat trouvé');
        Alert.alert('Aucun résultat', 'Aucun service trouvé pour votre recherche. Essayez avec d\'autres mots-clés.');
      }
    } catch (error) {
      console.error('[RechercheBesoinScreen] ❌ Erreur recherche:', error);
      Alert.alert('Erreur', `Erreur lors de la recherche: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  }, [searchText, navigation, location, user]);

  // Suggestions en temps réel
  const handleTextChange = useCallback(async (text: string) => {
    setSearchText(text);
    
    if (text.length >= 3) {
      try {
        const suggestions = await IntelligentSearchService.getSearchSuggestions(text);
        setSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch (error) {
        console.warn('[RechercheBesoinScreen] ⚠️ Erreur suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setSearchText(suggestion);
    setShowSuggestions(false);
  }, []);

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
            onChangeText={handleTextChange}
            multiline
            numberOfLines={4}
            style={styles.searchInput}
            placeholder="Ex: J'ai besoin d'un plombier pour réparer ma douche..."
          />

          {/* Suggestions IA en temps réel */}
          {showSuggestions && suggestions.length > 0 && (
            <Card style={styles.suggestionsCard}>
              <Card.Content>
                <Text style={styles.suggestionsTitle}>💡 Suggestions IA :</Text>
                {suggestions.slice(0, 5).map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionSelect(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </Card.Content>
            </Card>
          )}

          <View style={styles.locationInfo}>
            <MaterialIcons name="location-on" size={16} color="#FFD700" />
            <Text style={styles.locationText}>
              {location ? `Recherche près de vous (${location.coords.latitude.toFixed(2)}, ${location.coords.longitude.toFixed(2)})` : 'Recherche dans votre région'}
            </Text>
          </View>

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
  suggestionsCard: {
    marginTop: 8,
    backgroundColor: '#F0F9FF',
    borderColor: '#0EA5E9',
    borderWidth: 1,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0369A1',
    marginBottom: 8,
  },
  suggestionItem: {
    padding: 8,
    backgroundColor: '#E0F2FE',
    borderRadius: 6,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 13,
    color: '#0C4A6E',
  },
});

export default RechercheBesoinScreen;












