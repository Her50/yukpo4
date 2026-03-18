import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface YukpoLogoProps {
  size?: number;
  color?: string;
  backgroundColor?: string;
}

const YukpoLogo: React.FC<YukpoLogoProps> = ({
  size = 40,
  color = '#FFD700',
  backgroundColor = '#000'
}) => {
  return (
    <View style={[styles.container, {
      width: size,
      height: size,
      backgroundColor
    }]}>
      {/* Icône d'écoute principale */}
      <Text style={[styles.mainIcon, {
        fontSize: size * 0.4,
        color
      }]}>
        \uD83C\uDFA7
      </Text>

      {/* Petites ondes sonores */}
      <View style={styles.waveContainer}>
        <View style={[styles.wave, styles.wave1, { borderColor: color }]} />
        <View style={[styles.wave, styles.wave2, { borderColor: color }]} />
        <View style={[styles.wave, styles.wave3, { borderColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  mainIcon: {
    zIndex: 2,
    fontWeight: 'bold',
  },
  waveContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wave: {
    position: 'absolute',
    borderRadius: 50,
    borderWidth: 2,
    opacity: 0.3,
  },
  wave1: {
    width: 30,
    height: 30,
  },
  wave2: {
    width: 40,
    height: 40,
  },
  wave3: {
    width: 50,
    height: 50,
  },
});

export default YukpoLogo;