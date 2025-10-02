import * as React from 'react';
import { TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, TextInput, Button, Chip, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useLocation } from '../../contexts/LocationContext';
import { serviceService } from '../../services/api';

const CreateServiceScreen: React.FC = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    location: '',
    contact: '',
  });
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { location } = useLocation();

  const categories = [
    'Coiffure',
    'Beauté',
    'Réparation',
    'Nettoyage',
    'Transport',
    'Cuisine',
    'Éducation',
    'Autre',
  ];

  const handleSubmit = async () => {
    if (!formData.title || !formData.description || !formData.category) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);

      const serviceData = {
        ...formData,
        price: formData.price ? parseFloat(formData.price) : null,
        gps_mobile: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
        } : null,
      };

      await serviceService.createService(serviceData);
      
      Alert.alert(
        'Succès',
        'Service créé avec succès !',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de créer le service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Créer un service</Text>
            <Text style={styles.subtitle}>Partagez votre expertise avec la communauté</Text>

            <TextInput
              label="Titre du service *"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              mode="outlined"
              style={styles.input}
              placeholder="Ex: Coiffure à domicile"
            />

            <TextInput
              label="Description *"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
              placeholder="Décrivez votre service en détail..."
            />

            <View style={styles.categoryContainer}>
              <Text style={styles.label}>Catégorie *</Text>
              <View style={styles.chipContainer}>
                {categories.map((category) => (
                  <Chip
                    key={category}
                    selected={formData.category === category}
                    onPress={() => setFormData({ ...formData, category })}
                    style={[
                      styles.chip,
                      formData.category === category && styles.selectedChip
                    ]}
                    textStyle={[
                      styles.chipText,
                      formData.category === category && styles.selectedChipText
                    ]}
                  >
                    {category}
                  </Chip>
                ))}
              </View>
            </View>

            <TextInput
              label="Prix (€)"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              placeholder="Ex: 25"
            />

            <TextInput
              label="Localisation"
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
              mode="outlined"
              style={styles.input}
              placeholder="Ex: Paris, France"
            />

            {location && (
              <View style={styles.locationInfo}>
                <Text style={styles.locationText}>
                  📍 Position actuelle: {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </Text>
              </View>
            )}

            <TextInput
              label="Contact"
              value={formData.contact}
              onChangeText={(text) => setFormData({ ...formData, contact: text })}
              mode="outlined"
              style={styles.input}
              placeholder="Email ou téléphone"
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={styles.submitButton}
            >
              <Text style={{ color: "#000" }}>Créer le service</Text>
            </TouchableOpacity>
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
  card: {
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  categoryContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedChip: {
    backgroundColor: '#FFD700',
  },
  chipText: {
    color: '#333',
  },
  selectedChipText: {
    color: '#000',
  },
  locationInfo: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#1976D2',
  },
  submitButton: {
    marginTop: 16,
  },
});

export default CreateServiceScreen;




















