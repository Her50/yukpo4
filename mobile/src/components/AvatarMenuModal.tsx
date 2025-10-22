// Migration vers Lucide React Native pour un design moderne
import { ChevronRight, LogOut, X } from 'lucide-react-native';
import React from 'react';
import {
  Alert,
  Modal,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { Avatar } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';

interface AvatarMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
}

const AvatarMenuModal: React.FC<AvatarMenuModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              onClose();
            } catch (error) {
              console.error('Erreur déconnexion:', error);
              Alert.alert('Erreur', 'Impossible de se déconnecter');
            }
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      id: 'settings',
      title: '⚙️ Paramètres',
      subtitle: 'Gérer vos préférences',
      onPress: () => {
        onNavigate('Settings');
        onClose();
      },
      color: '#FF9800',
    },
  ];

  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '?';
    return name
      .replace(/[^\p{L}\p{N}]/gu, '')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header avec avatar et infos utilisateur */}
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              {user?.photo ? (
                <Avatar.Image
                  size={60}
                  source={{ uri: user.photo }}
                  style={styles.avatar}
                />
              ) : (
                <Avatar.Text
                  size={60}
                  label={getInitials(user?.name || '')}
                  style={[styles.avatar, { backgroundColor: theme.colors.primary }]}
                />
              )}
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                👤 {user?.name || "Utilisateur"}
              </Text>
              <Text style={styles.userRole}>
                🛡 Rôle : <Text style={styles.roleBold}>{user?.role || 'Utilisateur'}</Text>
              </Text>
              <Text style={styles.userEmail}>
                📧 {user?.email}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Menu items */}
          <View style={styles.menuContainer}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <View style={styles.menuItemContent}>
                  <View style={styles.menuItemLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
                      <ChevronRight
                        size={16}
                        color={item.color}
                      />
                    </View>
                    <View style={styles.menuItemText}>
                      <Text style={styles.menuItemTitle}>{item.title}</Text>
                      <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                    </View>
                  </View>
                  <ChevronRight
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Bouton déconnexion */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <View style={styles.logoutContent}>
              <LogOut size={24} color="#F44336" />
              <Text style={styles.logoutText}>🚪 Déconnexion</Text>
            </View>
          </TouchableOpacity>

          {/* Bouton fermer */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <X size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Pour l'iPhone avec home indicator
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 30,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  roleBold: {
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  divider: {
    marginHorizontal: 20,
    marginVertical: 10,
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  menuItem: {
    marginBottom: 8,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginLeft: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
});

export default AvatarMenuModal;






