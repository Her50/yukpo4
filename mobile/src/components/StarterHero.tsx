// @ts-check
import { useNavigation } from '@react-navigation/native';
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from "../contexts/AuthContext";
import { useLanguageSafe } from '../contexts/LanguageContext';
import { navigateToMesServicesHub } from '../navigation/mesServicesNavigation';

const StarterHero: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
    const { t } = useLanguageSafe();

  const handlePress = () => {
    if (user) {
      navigateToMesServicesHub(navigation as any);
    } else {
      (navigation as any).navigate('Register');
    }
  };

  return (
    <View style={styles.container}>
      {/* Note: L'image banner nécessite un chemin valide ou peut être retirée */}
      <View style={styles.overlay}>
        <Text style={styles.title}>
          L'assistant intelligent qui transforme vos besoins en solutions.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handlePress}>
          <Text style={styles.buttonText}>Explorer les services</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 400,
    marginTop: 96,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  button: {
    marginTop: 24,
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    color: '#6366F1',
    fontWeight: '500',
  },
});

export default StarterHero;





