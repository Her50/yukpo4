import { useNavigation } from "@react-navigation/native";
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from "../contexts/AuthContext";
import { useLanguageSafe } from '../contexts/LanguageContext';

interface Feature {
  icon: string;
  title: string;
  desc: React.ReactNode;
  link: string;
}

const YukpoBrand: React.FC = () => (
  <Text style={styles.brandText}>
    Yukpo
  </Text>
);

const WhyUsSection: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
    const { t } = useLanguageSafe();

  const features: Feature[] = [
    {
      icon: "🎯",
      title: t('whyUsSection.connexionIntelligente'),
      desc: (
        <>
          <YukpoBrand /> vous connecte au bon service, au bon moment.
        </>
      ),
      link: "MesServices",
    },
    {
      icon: "⚡",
      title: t('whyUsSection.reponseImmediate'),
      desc: "Trouvez une solution sans attendre.",
      link: user ? "Dashboard" : "Login",
    },
    {
      icon: "🎙️",
      title: "Interaction vocale",
      desc: (
        <>
          Exprimez vos besoins, <YukpoBrand /> agit automatiquement.
        </>
      ),
      link: "Home", // TODO: Créer écran VoiceAssistant si nécessaire
    },
    {
      icon: "🛠️",
      title: t('whyUsSection.creationDeService1clic'),
      desc: t('whyUsSection.creezUnServiceEnQuelquesSecondes'),
      link: user ? "FormulaireYukpoIntelligent" : "Register",
    },
  ];

  const handlePress = (link: string) => {
    (navigation as any).navigate(link);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Pourquoi choisir <YukpoBrand /> ?
      </Text>

      <View style={styles.featuresContainer}>
        {features.map(({ icon, title, desc, link }) => (
          <TouchableOpacity
            key={title}
            style={styles.featureCard}
            onPress={() => handlePress(link)}
            activeOpacity={0.7}
          >
            <Text style={styles.featureTitle}>
              {icon} {title}
            </Text>
            <Text style={styles.featureDesc}>{desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 64,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 40,
    textAlign: 'center',
  },
  brandText: {
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 1152,
    gap: 24,
    paddingHorizontal: 16,
  },
  featureCard: {
    flex: 1,
    minWidth: 200,
    maxWidth: 280,
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureDesc: {
    color: '#4B5563',
    fontSize: 14,
  },
});

export default WhyUsSection;





