// @ts-nocheck
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
            <YukpoBrand>Yukpo</YukpoBrand> � l'�coute qui comprend vraiment'
          </Text>

          <Text style={styles.paragraph}>
            Aussi appel� <YukpoBrand>Yukpo</YukpoBrand>, le nom de la plateforme signifie � l'�coute des gens � en langue Bayangam,'
            parl�e au c�ur de l'Afrique centrale par un peuple Bamil�k� du Cameroun.'
          </Text>

          <Text style={styles.paragraph}>
            Fid�le � cette racine linguistique et humaine, <YukpoBrand>Yukpo</YukpoBrand> est une plateforme de connexion directe
            entre <Text style={styles.highlightYellow}>les besoins exprim�s</Text> et <Text style={styles.highlightOrange}>les solutions concr�tes</Text> : services, opportunit�s, accompagnement.
          </Text>

          <Text style={styles.paragraph}>
            Gr�ce � son infrastructure multilingue, <YukpoBrand /> comprend et transmet les besoins dans plusieurs langues parl�es sur le continent africain :
            <Text style={styles.highlightBlue}>
              fulfuld�, lingala, ew�, swahili, wolof, baoul�, moor�, bambara, haoussa, sango
            </Text>, mais aussi dans les langues internationales comme le fran�ais, l"anglais, l'arabe ou le portugais."
          </Text>

          <Text style={styles.paragraph}>
            Que vous vous exprimiez � l'oral ou � l'�crit, m�me dans votre langue maternelle, <YukpoBrand /> vous comprend et vous r�pond.
            La plateforme est con�ue pour �tre accessible m�me aux personnes <Text style={styles.highlightPink}>aveugles, analphab�tes ou en situation de handicap</Text>.
          </Text>

          <Text style={styles.paragraph}>
            Que vous soyez <Text style={styles.highlightRed}>citoyen, entrepreneur, diaspora ou acteur public</Text>,
            <YukpoBrand>Yukpo</YukpoBrand> vous accompagne � chaque �tape : recherche, recommandation, mise en relation.
            C"est un r�seau de confiance, enracin� dans la culture et tourn� vers l'avenir."
          </Text>

          <Text style={styles.footer}>
            ?? <YukpoBrand /> � une oreille pour chacun, une r�ponse pour tous.
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




