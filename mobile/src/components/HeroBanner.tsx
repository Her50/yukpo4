// src/components/HeroBanner.tsx
import { useNavigation } from "@react-navigation/native";
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { navigateToMesServicesHub } from '../navigation/mesServicesNavigation';

const HeroBanner: React.FC = () => {
  const navigation = useNavigation();
    const { t } = useLanguageSafe();

  const handlePress = () => {
    navigateToMesServicesHub(navigation as any);
  };

  return (
    <View style={styles.container}>
      {/* Overlay assombri */}
      <View style={styles.overlay} />

      {/* Texte ajusté à gauche */}
      <View style={styles.content}>
        <Text style={styles.title}>
          L'assistant intelligent{'\n'}
          qui transforme vos besoins{'\n'}
          en solutions.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handlePress}>
            <Text style={styles.buttonText}>Explorer les services</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 600,
    marginTop: 96,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  content: {
    position: 'relative',
    zIndex: 20,
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
    maxWidth: 896,
    paddingLeft: 32,
    paddingRight: 16,
  },
  title: {
    fontSize: 32,
    color: 'white',
    fontWeight: 'bold',
    lineHeight: 40,
  },
  buttonContainer: {
    marginTop: 24,
  },
  button: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    color: 'black',
    fontWeight: '500',
  },
});

export default HeroBanner;





