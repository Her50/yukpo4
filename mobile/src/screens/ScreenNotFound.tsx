import * as React from 'react';
import { useState, useEffect } from 'react';
// import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
// import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
// import { motion } from 'framer-motion'; // Animation React Native
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ import ajouté

const PageNotFound: React.FC = () => {
  // const { t } = useTranslation();
  const navigate = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.subtitle}>
          Page introuvable
        </Text>
        <Text style={styles.message}>
          La page demandée n'existe pas ou a été déplacée.
        </Text>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigate.navigate('Home' as never)}
        >
          <Ionicons name="arrow-back" size={18} color="white" />
          <Text style={styles.buttonText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PageNotFound;




