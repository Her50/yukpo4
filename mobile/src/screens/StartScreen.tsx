// @ts-nocheck
import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';

const StartScreen = () => {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          ?? D�marrer avec Yukpo
        </Text>
        <Text style={styles.subtitle}>
          Dites-nous ce que vous cherchez ou proposez : Yukpo vous guide.
        </Text>
        
        <View style={styles.cardsContainer}>
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.cardTitle}>?? Je suis prestataire</Title>
              <TouchableOpacity 
                style={styles.button}
                onPress={() => navigation.navigate('CreateService' as never)}
              >
                <Text style={styles.buttonText}>Cr�er ou g�rer mes services</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>
          
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.cardTitle}>?? Je cherche une solution</Title>
              <TouchableOpacity 
                style={styles.button}
                onPress={() => navigation.navigate('RechercheBesoin' as never)}
              >
                <Text style={styles.buttonText}>Exprimer mon besoin</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>
          
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.cardTitle}>?? Acc�s IA Yukpo</Title>
              <TouchableOpacity 
                style={styles.button}
                onPress={() => navigation.navigate('AIHub' as never)}
              >
                <Text style={styles.buttonText}>Outils intelligents Yukpo</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 32,
    maxWidth: 300,
  },
  cardsContainer: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardContent: {
    alignItems: 'center',
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StartScreen;






