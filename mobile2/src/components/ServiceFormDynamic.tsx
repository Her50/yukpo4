import * as React from "react";
import { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, TextInput, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme/theme';

interface ServiceFormData {
  title: string;
  description: string;
  category: string;
  price: string;
  location: string;
}

const ServiceFormDynamic: React.FC = () => {
  const navigation = useNavigation();
  const [formData, setFormData] = useState<ServiceFormData>({
    title: '',
    description: '',
    category: '',
    price: '',
    location: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      if (!formData.title || !formData.description) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert('Succès', 'Service créé avec succès', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Erreur création service:', error);
      Alert.alert('Erreur', 'Impossible de créer le service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.formCard}>
          <Card.Content>
            <Title style={styles.title}>Créer un Service</Title>

            <TextInput
              label="Titre du service *"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="Description *"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={4}
            />

            <TextInput
              label="Catégorie"
              value={formData.category}
              onChangeText={(text) => setFormData({ ...formData, category: text })}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="Prix (XAF)"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              style={styles.input}
              mode="outlined"
              keyboardType="numeric"
            />

            <TextInput
              label="Localisation"
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
              style={styles.input}
              mode="outlined"
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                mode="outlined"
                onPress={() => navigation.goBack()}
                style={styles.cancelButton}
              >
                Annuler
              </TouchableOpacity>
              <TouchableOpacity
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.submitButton}
              >
                Créer le service
              </TouchableOpacity>
            </View>
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
  formCard: {
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  submitButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: theme.colors.primary,
  },
});

export default ServiceFormDynamic;






