import * as React from "react";
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, Paragraph, Button, Avatar, TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';

const MonProfilScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const handleSave = async () => {
    try {
      await updateUser(formData);
      setEditing(false);
      Alert.alert('Succès', 'Profil mis à jour avec succès');
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil');
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setEditing(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Title style={styles.title}>Mon Profil</Title>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditing(!editing)}
          >
            <Ionicons 
              name={editing ? "close" : "create"} 
              size={24} 
              color={theme.colors.primary} 
            />
          </TouchableOpacity>
        </View>

        <Card style={styles.profileCard}>
          <Card.Content style={styles.profileContent}>
            <Avatar.Text
              size={80}
              label={user?.name ? getInitials(user.name) : '?'}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <Text style={styles.userRole}>Rôle: {user?.role}</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Informations personnelles</Title>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom complet</Text>
              {editing ? (
                <TextInput
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  style={styles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={styles.inputValue}>{user?.name || 'Non renseigné'}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              {editing ? (
                <TextInput
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="email-address"
                />
              ) : (
                <Text style={styles.inputValue}>{user?.email}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Téléphone</Text>
              {editing ? (
                <TextInput
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.inputValue}>{user?.phone || 'Non renseigné'}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Solde</Text>
              <Text style={styles.inputValue}>
                {user?.credits?.toLocaleString() || '0'} XAF
              </Text>
            </View>
          </Card.Content>
        </Card>

        {editing && (
          <View style={styles.editActions}>
            <TouchableOpacity
              mode="outlined"
              onPress={handleCancel}
              style={styles.cancelButton}
            >
              Annuler
            </TouchableOpacity>
            <TouchableOpacity
              mode="contained"
              onPress={handleSave}
              style={styles.saveButton}
            >
              Sauvegarder
            </TouchableOpacity>
          </View>
        )}

        <Card style={styles.actionsCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Actions</Title>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('Settings' as never)}
            >
              <Ionicons name="settings" size={24} color={theme.colors.primary} />
              <Text style={styles.actionText}>Paramètres</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('SoldeDetail' as never)}
            >
              <Ionicons name="time" size={24} color={theme.colors.primary} />
              <Text style={styles.actionText}>Historique</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('RechargeTokens' as never)}
            >
              <Ionicons name="card" size={24} color={theme.colors.primary} />
              <Text style={styles.actionText}>Recharger Tokens</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </Card.Content>
        </Card>
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  editButton: {
    padding: 8,
  },
  profileCard: {
    marginBottom: 16,
    elevation: 2,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: theme.colors.primary,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  infoCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  inputValue: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  input: {
    backgroundColor: theme.colors.surface,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  saveButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: theme.colors.primary,
  },
  actionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
});

export default MonProfilScreen;



