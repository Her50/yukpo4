// src/components/Footer.tsx
// @ts-check
import { useNavigation } from "@react-navigation/native";
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Utilitaire React pour branding Yukpo
export const YukpoBrand: React.FC<{ style?: any }> = ({ style }) => (
  <Text style={[styles.brandText, style]}>
    <Text style={styles.brandYellow}>Yuk</Text>
    <Text style={styles.brandRed}>po</Text>
  </Text>
);

const legalLinks = [
  { path: "MentionsLegales", label: "Mentions légales" },
  { path: "Confidentialite", label: "Confidentialité" },
  { path: "Cookies", label: "Cookies" },
  { path: "APropos", label: "À propos" },
];

const uniqueLinks = legalLinks.filter(
  (link, index, self) => self.findIndex((l) => l.path === link.path) === index
);

const Footer: React.FC = () => {
  const navigation = useNavigation();

  const handleLinkPress = (path: string) => {
    (navigation as any).navigate(path);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Bloc 1 : Brand + Signature */}
        <View style={styles.block}>
          <View style={styles.brandContainer}>
            <YukpoBrand style={styles.brandTitle} />
          </View>
          <Text style={styles.description}>
            L'assistant intelligent qui transforme vos besoins en solutions.
          </Text>
          <Text style={styles.copyright}>
            © {new Date().getFullYear()} — Tous droits réservés.
          </Text>
        </View>

        {/* Bloc 2 : Liens légaux */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Liens utiles</Text>
          <View style={styles.linksContainer}>
            {uniqueLinks.map(({ path, label }) => (
              <TouchableOpacity
                key={path + '-' + label}
                onPress={() => handleLinkPress(path)}
                style={styles.link}
              >
                <Text style={styles.linkText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bloc 3 : Contact rapide */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Contact</Text>
          <Text style={styles.contactText}>📞 +237 6 90 00 00 00</Text>
          <Text style={styles.contactText}>📧 contact@yukpo.app</Text>
          <Text style={styles.contactText}>💬 WhatsApp : +237 6 70 00 00 00</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  content: {
    maxWidth: 1280,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
  },
  block: {
    flex: 1,
    minWidth: 200,
    gap: 8,
  },
  brandContainer: {
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  brandText: {
    fontWeight: 'bold',
  },
  brandYellow: {
    color: '#EAB308',
  },
  brandRed: {
    color: '#DC2626',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },
  copyright: {
    fontSize: 12,
    marginTop: 4,
    color: '#9CA3AF',
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  linksContainer: {
    gap: 4,
  },
  link: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    color: '#6366F1',
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
});

export default Footer;





