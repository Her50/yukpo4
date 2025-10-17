import * as React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';

const YukpoBrand: React.FC<{ children?: string }> = ({ children = "Yukpo" }) => (
  <Text style={styles.brandText}>
    {children}
  </Text>
);

const AboutScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>
            <YukpoBrand>Yukpomnang</YukpoBrand> — l'écoute qui comprend vraiment
          </Text>

          <Text style={styles.paragraph}>
            Aussi appelé <YukpoBrand>Yukpo</YukpoBrand>, le nom de la plateforme signifie « l'écoute des gens » en langue Bayangam,
            parlée au cœur de l'Afrique centrale par un peuple Bamiléké du Cameroun.
          </Text>

          <Text style={styles.paragraph}>
            Fidèle à cette racine linguistique et humaine, <YukpoBrand>Yukpomnang</YukpoBrand> est une plateforme de connexion directe
            entre <Text style={styles.highlightYellow}>les besoins exprimés</Text> et <Text style={styles.highlightOrange}>les solutions concrètes</Text> : services, opportunités, accompagnement.
          </Text>

          <Text style={styles.paragraph}>
            Grâce à son infrastructure multilingue, <YukpoBrand /> comprend et transmet les besoins dans plusieurs langues parlées sur le continent africain :
            <Text style={styles.highlightBlue}>
              fulfuldé, lingala, ewé, swahili, wolof, baoulé, mooré, bambara, haoussa, sango
            </Text>, mais aussi dans les langues internationales comme le français, l'anglais, l'arabe ou le portugais.
          </Text>

          <Text style={styles.paragraph}>
            Que vous vous exprimiez à l'oral ou à l'écrit, même dans votre langue maternelle, <YukpoBrand /> vous comprend et vous répond.
            La plateforme est conçue pour être accessible même aux personnes <Text style={styles.highlightPink}>aveugles, analphabètes ou en situation de handicap</Text>.
          </Text>

          <Text style={styles.paragraph}>
            Que vous soyez <Text style={styles.highlightRed}>citoyen, entrepreneur, diaspora ou acteur public</Text>,
            <YukpoBrand>Yukpomnang</YukpoBrand> vous accompagne à chaque étape : recherche, recommandation, mise en relation.
            C'est un réseau de confiance, enraciné dans la culture et tourné vers l'avenir.
          </Text>

          <Text style={styles.footer}>
            🌍 <YukpoBrand /> — une oreille pour chacun, une réponse pour tous.
          </Text>
        </View>
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
    flexGrow: 1,
    padding: 20,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: theme.colors.text,
  },
  brandText: {
    color: '#FF8C00',
    fontWeight: 'bold',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    color: theme.colors.text,
    textAlign: 'justify',
  },
  highlightYellow: {
    color: '#FFD700',
    fontWeight: '600',
  },
  highlightOrange: {
    color: '#FF8C00',
    fontWeight: '600',
  },
  highlightBlue: {
    color: '#2196F3',
    fontWeight: '600',
  },
  highlightPink: {
    color: '#E91E63',
    fontWeight: '600',
  },
  highlightRed: {
    color: '#F44336',
    fontWeight: '700',
  },
  footer: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    color: theme.colors.text,
  },
});

export default AboutScreen;



