import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../contexts/LocationContext';
import { theme } from '../theme/theme';

const LocationDisplayDemo: React.FC = () => {
  const { location, getCurrentLocation, loading } = useLocation();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handleGetLocation = async () => {
    try {
      await getCurrentLocation();
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erreur récupération position:', error);
      Alert.alert('Erreur', 'Impossible de récupérer votre position');
    }
  };

  const formatLocation = () => {
    if (!location) return 'Position non disponible';
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  };

  const formatAccuracy = () => {
    if (!location?.accuracy) return 'N/A';
    return `${location.accuracy.toFixed(0)}m`;
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Démonstration GPS</Title>
          
          <View style={styles.locationInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={theme.colors.primary} />
              <Text style={styles.label}>Position:</Text>
              <Text style={styles.value}>{formatLocation()}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="speedometer" size={20} color={theme.colors.primary} />
              <Text style={styles.label}>Précision:</Text>
              <Text style={styles.value}>{formatAccuracy()}</Text>
            </View>
            
            {lastUpdate && (
              <View style={styles.infoRow}>
                <Ionicons name="time" size={20} color={theme.colors.primary} />
                <Text style={styles.label}>Dernière mise à jour:</Text>
                <Text style={styles.value}>{lastUpdate.toLocaleTimeString()}</Text>
              </View>
            )}
          </View>
          
          <Button
            mode="contained"
            onPress={handleGetLocation}
            loading={loading}
            disabled={loading}
            style={styles.button}
            icon="refresh"
          >
            {loading ? 'Récupération...' : 'Obtenir ma position'}
          </Button>
          
          <Text style={styles.note}>
            Cette démonstration utilise le GPS de votre appareil pour obtenir votre position actuelle.
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  card: {
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  locationInfo: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  button: {
    backgroundColor: theme.colors.primary,
    marginBottom: 16,
  },
  note: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default LocationDisplayDemo;

