import { useNavigation, useRoute } from "@react-navigation/native";
import { Menu, X } from "lucide-react-native";
import * as React from "react";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';

type SidebarLink = {
  label: string;
  screen: string;
};

const links: SidebarLink[] = [
  { label: "Dashboard", screen: "Dashboard" },
  { label: t('responsiveSidebar.utilisateurs'), screen: "Users" },
  { label: "Services", screen: "MesServices" },
  { label: "Statistiques", screen: "Stats" },
  { label: t('responsiveSidebar.parametres'), screen: "Settings" },
];

const ResponsiveSidebar: React.FC = () => {
  const navigation = useNavigation();
    const { t } = useLanguageSafe();
  const route = useRoute();
  const [open, setOpen] = useState(false);

  const isActive = (screen: string) => route.name === screen;

  const handleNavigate = (screen: string) => {
    (navigation as any).navigate(screen);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setOpen(!open)}
        accessibilityLabel="Ouvrir le menu admin"
      >
        {open ? <X size={24} color="#1F2937" /> : <Menu size={24} color="#1F2937" />}
      </TouchableOpacity>

      {open && (
        <View style={styles.overlay} onTouchEnd={() => setOpen(false)}>
          <View style={styles.sidebar}>
            <View style={styles.header}>
              <Text style={styles.headerText}>🎯 Admin Panel</Text>
            </View>
            <View style={styles.nav}>
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
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  menuButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 50,
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 40,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: 256,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  nav: {
    padding: 16,
    gap: 8,
  },
  link: {
    paddingHorizontal: 16,
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

export default ResponsiveSidebar;





