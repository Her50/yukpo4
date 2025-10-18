import React, { useEffect, useState } from 'react';
// @ts-ignore
import ReactNative from 'react-native';
import { API_ENDPOINTS } from '../config/api.config';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch } from '../services/api';
import { theme } from '../theme/theme';

// @ts-ignore
const { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } = ReactNative;

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date | string;
  isRead: boolean;
  category: 'service' | 'system' | 'payment' | 'security';
  actionUrl?: string;
  actionText?: string;
}

interface NotificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationHistoryModal: React.FC<NotificationHistoryModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (isOpen && user?.id) {
      loadNotifications();

      // Rafraîchissement automatique toutes les 15 secondes quand le modal est ouvert
      const interval = setInterval(() => {
        console.log('[NotificationHistoryModal] 🔄 Rafraîchissement automatique des notifications');
        loadNotifications();
      }, 15000); // 15 secondes

      // Nettoyer l'intervalle quand le modal se ferme
      return () => {
        clearInterval(interval);
      };
    }
  }, [isOpen, user?.id]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // ✅ Utilise la configuration centralisée
      const response = await apiGet(API_ENDPOINTS.NOTIFICATIONS.USER_NOTIFICATIONS(user?.id || ''));

      if (response.data && Array.isArray(response.data)) {
        setNotifications(response.data);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      // En cas d'erreur API, afficher un tableau vide au lieu de données mockées
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = notifications
    .filter(notification => {
      const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || notification.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const dateA = typeof a.timestamp === 'string' ? new Date(a.timestamp) : a.timestamp;
      const dateB = typeof b.timestamp === 'string' ? new Date(b.timestamp) : b.timestamp;
      return dateB.getTime() - dateA.getTime();
    });

  const markAsRead = async (notificationId: string) => {
    try {
      // ✅ CORRIGÉ: Utilise PATCH au lieu de GET
      await apiPatch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId), {});

      // Mettre à jour le state local
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, isRead: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Erreur marquage notification comme lue:', error);
      Alert.alert('Erreur', 'Impossible de marquer la notification comme lue');
    }
  };

  const handleRefresh = async () => {
    console.log('[NotificationHistoryModal] 🔄 Rafraîchissement manuel des notifications');
    await loadNotifications();
  };

  const markAllAsRead = async () => {
    try {
      // ✅ CORRIGÉ: Utilise PATCH au lieu de GET
      await apiPatch(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ(user?.id || ''), {});

      // Mettre à jour le state local
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      Alert.alert('Succès', 'Toutes les notifications ont été marquées comme lues');
    } catch (error) {
      console.error('Erreur marquage toutes notifications:', error);
      Alert.alert('Erreur', 'Impossible de marquer toutes les notifications comme lues');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      // ✅ CORRIGÉ: Utilise DELETE au lieu de GET
      await apiDelete(API_ENDPOINTS.NOTIFICATIONS.DELETE(notificationId));

      // Mettre à jour le state local
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      Alert.alert('Supprimé', 'Notification supprimée');
    } catch (error) {
      console.error('Erreur suppression notification:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la notification');
    }
  };

  const formatTime = (date: Date | string) => {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const diff = now.getTime() - dateObj.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '🔔';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'error': return '#F44336';
      case 'info': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>
              🔔 Notifications
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount} non lues</Text>
              </View>
            )}
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={loading}
            >
              <Text style={[styles.refreshIcon, loading && styles.refreshIconDisabled]}>
                {loading ? '⏳' : '🔄'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <Text style={styles.checkIcon}>✅</Text>
              <Text style={[
                styles.markAllText,
                { color: unreadCount === 0 ? '#9E9E9E' : theme.colors.primary }
              ]}>
                Tout marquer comme lu
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher..."
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
                Tous
              </Text>
            </TouchableOpacity>

            {['info', 'success', 'warning', 'error'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, filterType === type && styles.filterChipActive]}
                onPress={() => setFilterType(type)}
              >
                <Text style={[styles.filterChipText, filterType === type && styles.filterChipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Liste des notifications */}
        <ScrollView style={styles.notificationsList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>Aucune notification trouvée</Text>
            </View>
          ) : (
            filteredNotifications.map((notification) => (
              <View
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.isRead && styles.unreadCard
                ]}
              >
                <View style={styles.cardContent}>
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationLeft}>
                      <Text style={styles.typeIcon}>
                        {getTypeIcon(notification.type)}
                      </Text>

                      <View style={styles.notificationInfo}>
                        <View style={styles.notificationTitleRow}>
                          <Text style={[
                            styles.notificationTitle,
                            !notification.isRead && styles.unreadText
                          ]}>
                            {notification.title}
                          </Text>

                          <View style={styles.badgesContainer}>
                            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(notification.type) }]}>
                              <Text style={styles.badgeText}>{notification.type}</Text>
                            </View>
                          </View>
                        </View>

                        <Text style={styles.notificationMessage}>
                          {notification.message}
                        </Text>

                        <View style={styles.notificationMeta}>
                          <Text style={styles.timestamp}>
                            {formatTime(notification.timestamp)}
                          </Text>
                          {!notification.isRead && (
                            <View style={styles.unreadDot} />
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.notificationActions}>
                    <View style={styles.actionButtons}>
                      {!notification.isRead && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => markAsRead(notification.id)}
                        >
                          <Text style={styles.actionIcon}>✅</Text>
                          <Text style={styles.actionButtonText}>Marquer lu</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => deleteNotification(notification.id)}
                      >
                        <Text style={styles.actionIcon}>🗑️</Text>
                        <Text style={[styles.actionButtonText, { color: '#F44336' }]}>Supprimer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  refreshIcon: {
    fontSize: 18,
    color: theme.colors.primary,
  },
  refreshIconDisabled: {
    color: '#9E9E9E',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  markAllText: {
    fontSize: 12,
    marginLeft: 4,
  },
  checkIcon: {
    fontSize: 16,
  },
  closeIconButton: {
    padding: 8,
  },
  closeIconText: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 12,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.colors.text,
  },
  filterChipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    textAlign: 'center',
    opacity: 0.5,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCard: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  cardContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  notificationLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  typeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginRight: 8,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  notificationMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: theme.colors.text,
  },
});

export default NotificationHistoryModal;