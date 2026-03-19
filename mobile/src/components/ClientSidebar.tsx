// @ts-check
import { useNavigation, useRoute } from "@react-navigation/native";
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';

const links = [
  { label: t('clientSidebar.tableauDeBord'), screen: "Dashboard" },
  { label: t('clientSidebar.mesServices'), screen: "MesServices" },
  { label: "Bourse du Livre", screen: "LivreScolaireHome" },
  { label: t('clientSidebar.parametres'), screen: "Settings" },
];

const ClientSidebar: React.FC = () => {
  const navigation = useNavigation();
    const { t } = useLanguageSafe();
  const route = useRoute();
  const isActive = (screen: string) => route.name === screen;

  const handleNavigate = (screen: string) => {
    (navigation as any).navigate(screen);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👤 Espace Client</Text>
      {links.map((link) => (
        <TouchableOpacity
          key={link.screen}
          style={[
            styles.link,
            isActive(link.screen) && styles.linkActive
          ]}
          onPress={() => handleNavigate(link.screen)}
        >
          <Text style={[
            styles.linkText,
            isActive(link.screen) && styles.linkTextActive
          ]}>
            {link.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 256,
    height: '100%',
    padding: 24,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 8,
  },
  link: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  linkActive: {
    backgroundColor: '#E5E7EB',
  },
  linkText: {
    fontSize: 14,
    color: '#1F2937',
  },
  linkTextActive: {
    fontWeight: '600',
    color: '#1F2937',
  },
});

export default ClientSidebar;





