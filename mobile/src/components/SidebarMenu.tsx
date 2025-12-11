// @ts-check
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

type Role = 'public' | 'user' | 'admin';

interface SidebarMenuProps {
  currentRole: Role;
}

// Note: ROUTES_CONFIG doit être adapté pour React Native
// Pour l'instant, on utilise un placeholder vide
const ROUTES_CONFIG: any[] = [];

const SidebarMenu: React.FC<SidebarMenuProps> = ({ currentRole }) => {
  const navigation = useNavigation();
  const route = useRoute();

  const groupedRoutes: Record<Role, any[]> = {
    public: [],
    user: [],
    admin: [],
  };

  for (const routeItem of ROUTES_CONFIG) {
    for (const role of routeItem.roles || []) {
      if (!groupedRoutes[role].some((r) => r.path === routeItem.path)) {
        groupedRoutes[role].push(routeItem);
      }
    }
  }

  const sectionOrder: Role[] = ['admin', 'user', 'public'];

  const roleLabels: Record<Role, string> = {
    admin: '🔐 Admin',
    user: '👤 Utilisateur',
    public: '🌐 Public',
  };

  const handleNavigate = (path: string) => {
    (navigation as any).navigate(path);
  };

  return (
    <View style={styles.container}>
      {sectionOrder.map((role) => {
        const items = groupedRoutes[role].filter(
          (r) => r.roles?.includes(currentRole) || currentRole === 'admin'
        );

        if (items.length === 0) return null;

        return (
          <View key={role} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {roleLabels[role]}
            </Text>
            <View style={styles.menuList}>
              {items.map((routeItem) => {
                const isActive = route.name === routeItem.path;
                return (
                  <TouchableOpacity
                    key={routeItem.path}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => handleNavigate(routeItem.path)}
                  >
                    <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                      {routeItem.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  menuList: {
    gap: 4,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  menuItemActive: {
    backgroundColor: '#FED7AA',
  },
  menuItemText: {
    color: '#1F2937',
    fontSize: 14,
  },
  menuItemTextActive: {
    color: '#9A3412',
    fontWeight: '600',
  },
});

export default SidebarMenu;





