// @ts-check
import * as React from "react";
import { StyleSheet, Text, View } from 'react-native';

const HeroSection: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Couche foncée + Texte centré */}
      <View style={styles.overlay}>
        <Text style={styles.title}>
          Chez Yukpomnang, chaque besoin est une opportunité
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 400,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 16,
    maxWidth: 768,
  },
});

export default HeroSection;





